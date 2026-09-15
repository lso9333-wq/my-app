import { useRef, useState } from 'react'
import { VideoUploader } from '../../shared/components/VideoUploader'
import { RangeSelector } from './components/RangeSelector'
import { HandResultsPanel } from './components/HandResultsPanel'
import { HandSessionHistory } from './components/HandSessionHistory'
import { EegCaptureControl } from './components/EegCaptureControl'
import {
  extractHandFrames,
  getHandDetector,
  HAND_ANALYSIS_PIPELINE_VERSION,
  splitHandFramesBySide,
} from '../../shared/lib/handDetector'
import { computeHandRomSummary } from './lib/handAnalysis'
import { createHandSession, updateHandSessionEegContext, updateHandSessionGroundTruth } from './lib/handFootApi'
import { AuthError } from '../../shared/lib/authApi'
import type {
  EegHandFootContext,
  HandFootAnalysisStage,
  HandFootRange,
  HandJointGroundTruth,
  HandJointResult,
} from './types'

const EMPTY_EEG_CONTEXT: EegHandFootContext = { deviceName: null, baseline: null, during: null }

const SAMPLING_FPS = 8
const MIN_RANGE_SEC = 0.5

interface Props {
  token: string
  onAuthError: () => void
}

export function HandAnalysisPanel({ token, onAuthError }: Props) {
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
  const [leftResults, setLeftResults] = useState<HandJointResult[]>([])
  const [rightResults, setRightResults] = useState<HandJointResult[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [eegContext, setEegContext] = useState<EegHandFootContext>(EMPTY_EEG_CONTEXT)
  const [handGroundTruth, setHandGroundTruth] = useState<HandJointGroundTruth[]>([])
  const savedSessionIdRef = useRef<number | null>(null)
  const handGroundTruthSaveTimerRef = useRef<number | null>(null)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setDuration(0)
    setProgress(0)
    setLeftResults([])
    setRightResults([])
    setErrorMsg(null)
    setSaveState('idle')
    setSaveError(null)
    setStage('idle')
    setEegContext(EMPTY_EEG_CONTEXT)
    setHandGroundTruth([])
    savedSessionIdRef.current = null
    if (handGroundTruthSaveTimerRef.current !== null) {
      window.clearTimeout(handGroundTruthSaveTimerRef.current)
      handGroundTruthSaveTimerRef.current = null
    }
  }

  /** 손가락 관절은 이미 실제 랜드마크로 계산한 값이라, 발가락 시뮬레이션의
   * handleManualToeInputChange(FootAnalysisPanel)과 달리 트레이너가 값을 고쳐도
   * 'source' 같은 상태 전환은 없다 — 그냥 "AI 계산 vs 트레이너 실측" 정답값 하나를
   * 쌓는다(ROM의 handleGroundTruthChange, RomSessionHistory와 같은 방식). 분석 직후
   * 자동 저장(POST)이 끝난 뒤라야 세션 id가 있으므로 그 전까지는 로컬 상태만 갱신하고,
   * 이후에는 별도 PUT으로 이미 저장된 세션에 디바운스 저장한다. */
  const handleHandGroundTruthChange = (id: string, value: number | null) => {
    setHandGroundTruth((prev) => {
      const idx = prev.findIndex((g) => g.id === id)
      const next: HandJointGroundTruth[] =
        idx === -1 ? [...prev, { id, verifiedValue: value }] : prev.map((g, i) => (i === idx ? { ...g, verifiedValue: value } : g))

      const sessionId = savedSessionIdRef.current
      if (sessionId !== null) {
        if (handGroundTruthSaveTimerRef.current !== null) window.clearTimeout(handGroundTruthSaveTimerRef.current)
        handGroundTruthSaveTimerRef.current = window.setTimeout(() => {
          updateHandSessionGroundTruth(token, sessionId, next).catch((err) => {
            if (err instanceof AuthError) {
              onAuthError()
              return
            }
            console.error('[HandAnalysisPanel] 트레이너 실측값 저장 실패', err)
          })
        }, 500)
      }
      return next
    })
  }

  /** Muse 캡처(안정/활동)가 바뀔 때마다 호출된다 — 세션이 아직 저장 전(POST 이전)이면
   * state만 갱신해 다음 createHandSession 호출에 실려 가고, 이미 저장된 뒤(주로 "②
   * 활동"은 분석 완료 후에 캡처하는 흐름이라 이 경우가 많다)라면 별도 PUT으로 이미 저장된
   * 세션을 바로 갱신한다 — FootAnalysisPanel의 수기 발가락 입력과 같은 패턴. */
  const handleEegContextChange = (context: EegHandFootContext) => {
    setEegContext(context)
    const sessionId = savedSessionIdRef.current
    if (sessionId !== null) {
      updateHandSessionEegContext(token, sessionId, context).catch((err) => {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        console.error('[HandAnalysisPanel] 뇌파 컨텍스트 저장 실패', err)
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

      await getHandDetector()
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

  const handleAnalyze = async () => {
    const video = videoRef.current
    if (!video) return

    setStage('processing')
    setProgress(0)

    try {
      const beforeFrames = await extractHandFrames(video, {
        samplingFps: SAMPLING_FPS,
        startTimeSec: before.start,
        maxDurationSec: before.end - before.start,
        onProgress: (r) => setProgress(r * 0.5),
      })
      const afterFrames = await extractHandFrames(video, {
        samplingFps: SAMPLING_FPS,
        startTimeSec: after.start,
        maxDurationSec: after.end - after.start,
        onProgress: (r) => setProgress(0.5 + r * 0.5),
      })

      setStage('analyzing')
      const beforeSplit = splitHandFramesBySide(beforeFrames)
      const afterSplit = splitHandFramesBySide(afterFrames)
      const left = computeHandRomSummary(beforeSplit.left, afterSplit.left)
      const right = computeHandRomSummary(beforeSplit.right, afterSplit.right)
      setLeftResults(left)
      setRightResults(right)
      setStage('done')

      setSaveState('saving')
      try {
        const hasEegContext = eegContext.baseline !== null || eegContext.during !== null
        const { id } = await createHandSession(token, {
          videoName: fileName,
          clientName: clientName.trim(),
          trainerName: trainerName.trim() || undefined,
          beforeStartSec: before.start,
          beforeEndSec: before.end,
          afterStartSec: after.start,
          afterEndSec: after.end,
          leftResults: left,
          rightResults: right,
          calcVersion: HAND_ANALYSIS_PIPELINE_VERSION,
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
        하나의 영상 안에서 "이전"(예: 스트레칭·마사지 전) 구간과 "이후" 구간을 지정하면, 손가락 관절 각도
        14개(검지·중지·약지·소지 각 3관절 + 엄지 2관절)의 가동범위 변화를 양손 각각 계산합니다.
      </p>
      <p className="disclaimer">⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>

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

      {stage === 'idle' && <VideoUploader onSelect={handleSelect} title="손 동작을 촬영한 동영상을 업로드하세요" />}

      {stage === 'loading-model' && (
        <div className="progress-panel">
          <p className="progress-file">{fileName}</p>
          <p>손 인식 모델을 불러오는 중...</p>
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

      {stage === 'done' && (
        <div className="results">
          <HandResultsPanel
            leftResults={leftResults}
            rightResults={rightResults}
            calcVersion={HAND_ANALYSIS_PIPELINE_VERSION}
            clientName={clientName}
            trainerName={trainerName}
            videoName={fileName}
            eegContext={eegContext}
            groundTruth={handGroundTruth}
            onGroundTruthChange={handleHandGroundTruthChange}
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

      <HandSessionHistory refreshKey={historyKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}
