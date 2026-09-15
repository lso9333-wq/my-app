import { useRef, useState } from 'react'
import { VideoUploader } from '../../shared/components/VideoUploader'
import { RangeSelector } from './components/RangeSelector'
import { RomResultsPanel } from './components/RomResultsPanel'
import { RomSessionHistory } from './components/RomSessionHistory'
import { ANALYSIS_PIPELINE_VERSION, extractPoseFrames, getPoseDetector } from '../../shared/lib/poseDetector'
import { computeRomSummary } from './lib/romAnalysis'
import { computeXmskEstimates } from './lib/xmskEstimates'
import { createRomSession, updateRomSessionGroundTruth, updateRomSessionManualInputs } from './lib/romApi'
import { AuthError } from '../../shared/lib/authApi'
import type {
  RomAnalysisStage,
  RomJointResult,
  RomRange,
  RomXmskEstimateResult,
  RomXmskGroundTruth,
  RomXmskManualInput,
} from './types'

const SAMPLING_FPS = 12
const MIN_RANGE_SEC = 0.5

interface Props {
  token: string
  onAuthError: () => void
}

function RomApp({ token, onAuthError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<RomAnalysisStage>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [before, setBefore] = useState<RomRange>({ start: 0, end: 1 })
  const [after, setAfter] = useState<RomRange>({ start: 0, end: 1 })
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RomJointResult[] | null>(null)
  const [xmskEstimates, setXmskEstimates] = useState<RomXmskEstimateResult[]>([])
  const [xmskManualInputs, setXmskManualInputs] = useState<RomXmskManualInput[]>([])
  const [xmskGroundTruth, setXmskGroundTruth] = useState<RomXmskGroundTruth[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const savedSessionIdRef = useRef<number | null>(null)
  const manualInputSaveTimerRef = useRef<number | null>(null)
  const groundTruthSaveTimerRef = useRef<number | null>(null)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setDuration(0)
    setProgress(0)
    setResults(null)
    setXmskEstimates([])
    setXmskManualInputs([])
    setXmskGroundTruth([])
    setErrorMsg(null)
    setSaveState('idle')
    setSaveError(null)
    setStage('idle')
    savedSessionIdRef.current = null
    if (manualInputSaveTimerRef.current !== null) {
      window.clearTimeout(manualInputSaveTimerRef.current)
      manualInputSaveTimerRef.current = null
    }
    if (groundTruthSaveTimerRef.current !== null) {
      window.clearTimeout(groundTruthSaveTimerRef.current)
      groundTruthSaveTimerRef.current = null
    }
  }

  const handleSelect = async (file: File) => {
    reset()
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setFileName(file.name)
    setStage('loading-model')

    const video = videoRef.current
    if (!video) return

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('동영상을 불러올 수 없습니다. 다른 파일로 시도해 주세요.'))
        video.src = url
      })

      const d = video.duration
      setDuration(d)
      setBefore({ start: 0, end: Math.min(3, d * 0.15) })
      setAfter({ start: Math.max(0, d - 3), end: d })

      await getPoseDetector()
      setStage('marking-range')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '영상을 불러오는 중 오류가 발생했습니다.')
      setStage('error')
    }
  }

  const handleScrub = (t: number) => {
    const video = videoRef.current
    if (video) video.currentTime = t
  }

  /**
   * 손목 저항 검사처럼 영상으로 잴 수 없어 트레이너가 직접 입력하는 항목 값을 갱신한다.
   * 분석 결과는 이미 분석 직후 자동 저장(POST)되어 있으므로, 그 뒤에 입력하는 수기
   * 입력값은 별도 PUT으로 이미 저장된 세션에 갱신한다(타이핑마다 요청을 보내지 않도록
   * 짧게 디바운스한다).
   */
  const handleManualInputChange = (id: string, phase: 'before' | 'after', value: number | null) => {
    setXmskManualInputs((prev) => {
      const idx = prev.findIndex((m) => m.id === id)
      const next =
        idx === -1
          ? [...prev, { id, beforeValue: phase === 'before' ? value : null, afterValue: phase === 'after' ? value : null }]
          : prev.map((m, i) => (i === idx ? { ...m, [phase === 'before' ? 'beforeValue' : 'afterValue']: value } : m))

      const sessionId = savedSessionIdRef.current
      if (sessionId !== null) {
        if (manualInputSaveTimerRef.current !== null) window.clearTimeout(manualInputSaveTimerRef.current)
        manualInputSaveTimerRef.current = window.setTimeout(() => {
          updateRomSessionManualInputs(token, sessionId, next).catch((err) => {
            if (err instanceof AuthError) {
              onAuthError()
              return
            }
            console.error('[RomApp] 수기 입력 저장 실패', err)
          })
        }, 500)
      }
      return next
    })
  }

  /**
   * AI가 이미 추정한 항목(예: 다리 벌리기, 배측굴곡) 옆에 트레이너가 실제 관찰·측정한
   * 값을 적어두는 "정답값"을 갱신한다. handleManualInputChange(영상으로 아예 잴 수
   * 없는 항목용)와 구조는 비슷하지만 별도 엔드포인트(ground-truth)로 저장한다 — 나중에
   * 이 값들을 모아 계산 로직을 보정하는 데 쓴다(docs/ai-training-plan.md 참고).
   */
  const handleGroundTruthChange = (estimateId: string, value: number | null) => {
    setXmskGroundTruth((prev) => {
      const idx = prev.findIndex((g) => g.estimateId === estimateId)
      const next =
        idx === -1
          ? [...prev, { estimateId, verifiedValue: value }]
          : prev.map((g, i) => (i === idx ? { ...g, verifiedValue: value } : g))

      const sessionId = savedSessionIdRef.current
      if (sessionId !== null) {
        if (groundTruthSaveTimerRef.current !== null) window.clearTimeout(groundTruthSaveTimerRef.current)
        groundTruthSaveTimerRef.current = window.setTimeout(() => {
          updateRomSessionGroundTruth(token, sessionId, next).catch((err) => {
            if (err instanceof AuthError) {
              onAuthError()
              return
            }
            console.error('[RomApp] 트레이너 실측값 저장 실패', err)
          })
        }, 500)
      }
      return next
    })
  }

  const handleAnalyze = async () => {
    const video = videoRef.current
    if (!video) return

    setStage('processing')
    setProgress(0)

    try {
      const beforeFrames = await extractPoseFrames(video, {
        samplingFps: SAMPLING_FPS,
        startTimeSec: before.start,
        maxDurationSec: before.end - before.start,
        onProgress: (r) => setProgress(r * 0.5),
      })
      const afterFrames = await extractPoseFrames(video, {
        samplingFps: SAMPLING_FPS,
        startTimeSec: after.start,
        maxDurationSec: after.end - after.start,
        onProgress: (r) => setProgress(0.5 + r * 0.5),
      })

      setStage('analyzing')
      const summary = computeRomSummary(beforeFrames, afterFrames)
      const estimates = computeXmskEstimates(beforeFrames, afterFrames)
      setResults(summary)
      setXmskEstimates(estimates)
      setStage('done')

      setSaveState('saving')
      try {
        const { id } = await createRomSession(token, {
          videoName: fileName,
          clientName: clientName.trim(),
          trainerName: trainerName.trim() || undefined,
          beforeStartSec: before.start,
          beforeEndSec: before.end,
          afterStartSec: after.start,
          afterEndSec: after.end,
          results: summary,
          xmskEstimates: estimates,
          xmskManualInputs,
          xmskGroundTruth,
          calcVersion: ANALYSIS_PIPELINE_VERSION,
        })
        savedSessionIdRef.current = id
        setSaveState('saved')
        setHistoryKey((k) => k + 1)
      } catch (err) {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        setSaveState('error')
        setSaveError(err instanceof Error ? err.message : '기록 저장에 실패했습니다.')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '분석 중 알 수 없는 오류가 발생했습니다.')
      setStage('error')
    }
  }

  const rangesValid =
    before.end - before.start >= MIN_RANGE_SEC && after.end - after.start >= MIN_RANGE_SEC
  const canAnalyze = rangesValid && clientName.trim() !== ''

  return (
    <div className="rom-app">
      <p className="app-subtitle">
        하나의 영상 안에서 스트레칭 "전" 구간과 "후" 구간을 지정하면, 상체(어깨·팔꿈치)와
        하체(엉덩이·무릎)의 관절 가동범위 변화를 계산합니다.
      </p>
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.
      </p>

      <div className="xmsk-section">
        <div className="xmsk-eval-header-grid">
          <label>
            회원 이름
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="회원 이름"
            />
          </label>
          <label>
            담당 트레이너
            <input
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="담당 트레이너 이름 (선택)"
            />
          </label>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} muted playsInline hidden={stage === 'idle'} className="rom-preview-video" />

      {stage === 'idle' && (
        <VideoUploader onSelect={handleSelect} title="스트레칭 처치 전후를 촬영한 동영상을 업로드하세요" />
      )}

      {stage === 'loading-model' && (
        <div className="progress-panel">
          <p className="progress-file">{fileName}</p>
          <p>포즈 인식 모델을 불러오는 중...</p>
        </div>
      )}

      {stage === 'marking-range' && (
        <div className="rom-marking">
          <p className="progress-file">{fileName}</p>
          <RangeSelector
            duration={duration}
            before={before}
            after={after}
            onChange={(b, a) => {
              setBefore(b)
              setAfter(a)
            }}
            onScrub={handleScrub}
          />
          {!rangesValid && (
            <p className="rom-validation">각 구간은 최소 {MIN_RANGE_SEC}초 이상이어야 합니다.</p>
          )}
          {rangesValid && clientName.trim() === '' && (
            <p className="rom-validation">회원 이름을 입력해야 분석할 수 있습니다.</p>
          )}
          <button type="button" disabled={!canAnalyze} onClick={handleAnalyze}>
            분석하기
          </button>
        </div>
      )}

      {(stage === 'processing' || stage === 'analyzing') && (
        <div className="progress-panel">
          <p className="progress-file">{fileName}</p>
          {stage === 'processing' && (
            <>
              <p>영상 프레임 분석 중... {Math.round(progress * 100)}%</p>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </>
          )}
          {stage === 'analyzing' && <p>가동범위 계산 중...</p>}
        </div>
      )}

      {stage === 'error' && (
        <div className="error-panel">
          <p>{errorMsg}</p>
          <button type="button" onClick={reset}>
            다시 시도
          </button>
        </div>
      )}

      {stage === 'done' && results && (
        <div className="results">
          <RomResultsPanel
            results={results}
            xmskEstimates={xmskEstimates}
            manualInputs={xmskManualInputs}
            onManualInputChange={handleManualInputChange}
            groundTruth={xmskGroundTruth}
            onGroundTruthChange={handleGroundTruthChange}
            calcVersion={ANALYSIS_PIPELINE_VERSION}
            clientName={clientName}
            trainerName={trainerName}
            videoName={fileName}
          />
          <p className="rom-save-status">
            {saveState === 'saving' && '기록 저장 중...'}
            {saveState === 'saved' && '기록이 저장되었습니다.'}
            {saveState === 'error' && `저장 실패: ${saveError}`}
          </p>
          <button type="button" className="reset-button" onClick={reset}>
            다른 영상 분석하기
          </button>
        </div>
      )}

      <RomSessionHistory refreshKey={historyKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}

export default RomApp
