import { useRef, useState } from 'react'
import { VideoUploader } from '../../shared/components/VideoUploader'
import { RangeSelector } from './components/RangeSelector'
import { FootResultsPanel } from './components/FootResultsPanel'
import { FootSessionHistory } from './components/FootSessionHistory'
import { EegCaptureControl } from './components/EegCaptureControl'
import { ANALYSIS_PIPELINE_VERSION, extractPoseFrames, getPoseDetector } from '../../shared/lib/poseDetector'
import { computeFootToeEstimates, computeFootToeSegmentEstimates, FOOT_TOE_SIM_VERSION } from './lib/footToeEstimate'
import { createFootSession, updateFootSessionEegContext, updateFootSessionManualToeInputs } from './lib/handFootApi'
import { AuthError } from '../../shared/lib/authApi'
import type {
  EegHandFootContext,
  FootManualToeInput,
  FootToeEstimateResult,
  HandFootAnalysisStage,
  HandFootRange,
} from './types'

const EMPTY_EEG_CONTEXT: EegHandFootContext = { deviceName: null, baseline: null, during: null }

const SAMPLING_FPS = 12
const MIN_RANGE_SEC = 0.5

interface Props {
  token: string
  onAuthError: () => void
}

export function FootAnalysisPanel({ token, onAuthError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<HandFootAnalysisStage>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [before, setBefore] = useState<HandFootRange>({ start: 0, end: 1 })
  const [after, setAfter] = useState<HandFootRange>({ start: 0, end: 1 })
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [progress, setProgress] = useState(0)
  const [toeEstimates, setToeEstimates] = useState<FootToeEstimateResult[]>([])
  const [manualToeInputs, setManualToeInputs] = useState<FootManualToeInput[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [eegContext, setEegContext] = useState<EegHandFootContext>(EMPTY_EEG_CONTEXT)
  const savedSessionIdRef = useRef<number | null>(null)
  const manualToeSaveTimerRef = useRef<number | null>(null)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setDuration(0)
    setProgress(0)
    setToeEstimates([])
    setManualToeInputs([])
    setErrorMsg(null)
    setSaveState('idle')
    setSaveError(null)
    setStage('idle')
    setEegContext(EMPTY_EEG_CONTEXT)
    savedSessionIdRef.current = null
    if (manualToeSaveTimerRef.current !== null) {
      window.clearTimeout(manualToeSaveTimerRef.current)
      manualToeSaveTimerRef.current = null
    }
  }

  /** HandAnalysisPanel.handleEegContextChange와 같은 이유·같은 패턴. */
  const handleEegContextChange = (context: EegHandFootContext) => {
    setEegContext(context)
    const sessionId = savedSessionIdRef.current
    if (sessionId !== null) {
      updateFootSessionEegContext(token, sessionId, context).catch((err) => {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        console.error('[FootAnalysisPanel] 뇌파 컨텍스트 저장 실패', err)
      })
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

  /** 발가락 10마디는 이제 AI 시뮬레이션 초기값(computeFootToeSegmentEstimates)이 자동
   * 채워지지만, 실제 관절을 인식한 값은 아니므로 트레이너가 관찰해 확정/수정하는 것을
   * 기본 흐름으로 본다 — ROM의 handleManualInputChange(손목 저항 검사)와 같은 방식으로,
   * 분석 직후 자동 저장(POST) 이후에는 별도 PUT으로 이미 저장된 세션에 갱신한다.
   * 트레이너가 값을 직접 편집하는 순간 source를 'trainer'로 바꿔, 그 항목이 더 이상
   * 미확인 AI 시뮬레이션이 아니라는 것을 데이터에 남긴다. */
  const handleManualToeInputChange = (id: string, phase: 'before' | 'after', value: number | null) => {
    setManualToeInputs((prev) => {
      const idx = prev.findIndex((m) => m.id === id)
      const next =
        idx === -1
          ? [...prev, { id, beforeValue: phase === 'before' ? value : null, afterValue: phase === 'after' ? value : null, source: 'trainer' as const }]
          : prev.map((m, i) => (i === idx ? { ...m, [phase === 'before' ? 'beforeValue' : 'afterValue']: value, source: 'trainer' as const } : m))

      const sessionId = savedSessionIdRef.current
      if (sessionId !== null) {
        if (manualToeSaveTimerRef.current !== null) window.clearTimeout(manualToeSaveTimerRef.current)
        manualToeSaveTimerRef.current = window.setTimeout(() => {
          updateFootSessionManualToeInputs(token, sessionId, next).catch((err) => {
            if (err instanceof AuthError) {
              onAuthError()
              return
            }
            console.error('[FootAnalysisPanel] 수기 입력 저장 실패', err)
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
      const estimates = computeFootToeEstimates(beforeFrames, afterFrames)
      setToeEstimates(estimates)
      // 발가락 10마디(20개 항목)의 시뮬레이션 초기값을 채운다 — 트레이너가 아직 아무것도
      // 입력하지 않은 상태라면 이 값이 그대로 기본값이 되고, source: 'estimated'로
      // 표시되어 UI에서 "AI 시뮬레이션(미확인)"으로 구분된다.
      const segmentEstimates = computeFootToeSegmentEstimates(beforeFrames, afterFrames)
      setManualToeInputs(segmentEstimates)
      setStage('done')

      setSaveState('saving')
      try {
        const hasEegContext = eegContext.baseline !== null || eegContext.during !== null
        const { id } = await createFootSession(token, {
          videoName: fileName,
          clientName: clientName.trim(),
          trainerName: trainerName.trim() || undefined,
          beforeStartSec: before.start,
          beforeEndSec: before.end,
          afterStartSec: after.start,
          afterEndSec: after.end,
          toeEstimates: estimates,
          manualToeInputs: segmentEstimates,
          // 발 분석은 두 개의 독립적인 계산 단계를 갖는다: 몸 전체 포즈 추출/스무딩
          // (ANALYSIS_PIPELINE_VERSION)과 발가락 마디별 시뮬레이션 배분식
          // (FOOT_TOE_SIM_VERSION, footToeEstimate.ts). 두 버전을 합쳐 기록해야 나중에
          // 트레이너 실측값을 정확한 계산 버전과 짝지을 수 있다.
          calcVersion: `${ANALYSIS_PIPELINE_VERSION}+toeSim:${FOOT_TOE_SIM_VERSION}`,
          eegContext: hasEegContext ? eegContext : undefined,
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

  const rangesValid = before.end - before.start >= MIN_RANGE_SEC && after.end - after.start >= MIN_RANGE_SEC
  const canAnalyze = rangesValid && clientName.trim() !== ''

  return (
    <div className="rom-app">
      <p className="app-subtitle">
        하나의 영상 안에서 "이전" 구간과 "이후" 구간을 지정하면, 발 전체를 대표하는 실험적 발가락 굽힘 추정치를
        계산하고, 이 신호를 연구 기반 결합계수로 배분해 발가락 10마디(양발 20개 항목)의 시뮬레이션 초기값도 자동으로
        채워줍니다. 이 초기값은 실제 관절을 하나하나 측정한 값이 아니므로, 트레이너가 직접 관찰해 확인·수정하는 것이
        원칙입니다(아래 결과 화면에서 편집 가능).
      </p>
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다. 발가락 마디별 값은 개별 랜드마크로
        측정한 것이 아니라 발 전체 신호를 시뮬레이션으로 배분한 참고값이니, 실제 값과 다르면 반드시 트레이너가
        수정해 주세요.
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

      {stage !== 'idle' && stage !== 'loading-model' && (
        <EegCaptureControl eegContext={eegContext} onContextChange={handleEegContextChange} />
      )}

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} muted playsInline hidden={stage === 'idle'} className="rom-preview-video" />

      {stage === 'idle' && <VideoUploader onSelect={handleSelect} title="발 동작을 촬영한 동영상을 업로드하세요" />}

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
            beforeLabel="이전"
            afterLabel="이후"
            onChange={(b, a) => {
              setBefore(b)
              setAfter(a)
            }}
            onScrub={handleScrub}
          />
          {!rangesValid && <p className="rom-validation">각 구간은 최소 {MIN_RANGE_SEC}초 이상이어야 합니다.</p>}
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
          {stage === 'analyzing' && <p>발가락 굽힘 추정 계산 중...</p>}
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

      {stage === 'done' && (
        <div className="results">
          <FootResultsPanel
            toeEstimates={toeEstimates}
            manualToeInputs={manualToeInputs}
            onManualToeInputChange={handleManualToeInputChange}
            clientName={clientName}
            trainerName={trainerName}
            videoName={fileName}
            eegContext={eegContext}
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

      <FootSessionHistory refreshKey={historyKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}
