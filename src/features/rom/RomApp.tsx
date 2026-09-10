import { useRef, useState } from 'react'
import { VideoUploader } from '../../shared/components/VideoUploader'
import { RangeSelector } from './components/RangeSelector'
import { RomResultsPanel } from './components/RomResultsPanel'
import { RomSessionHistory } from './components/RomSessionHistory'
import { extractPoseFrames, getPoseDetector } from '../../shared/lib/poseDetector'
import { computeRomSummary } from './lib/romAnalysis'
import { createRomSession } from './lib/romApi'
import type { RomAnalysisStage, RomJointResult, RomRange } from './types'

const SAMPLING_FPS = 12
const MIN_RANGE_SEC = 0.5

function RomApp() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<RomAnalysisStage>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [before, setBefore] = useState<RomRange>({ start: 0, end: 1 })
  const [after, setAfter] = useState<RomRange>({ start: 0, end: 1 })
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RomJointResult[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setDuration(0)
    setProgress(0)
    setResults(null)
    setErrorMsg(null)
    setSaveState('idle')
    setSaveError(null)
    setStage('idle')
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
      setResults(summary)
      setStage('done')

      setSaveState('saving')
      try {
        await createRomSession({
          videoName: fileName,
          beforeStartSec: before.start,
          beforeEndSec: before.end,
          afterStartSec: after.start,
          afterEndSec: after.end,
          results: summary,
        })
        setSaveState('saved')
        setHistoryKey((k) => k + 1)
      } catch (err) {
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

  return (
    <div className="rom-app">
      <p className="app-subtitle">
        하나의 영상 안에서 스트레칭 "전" 구간과 "후" 구간을 지정하면, 상체(어깨·팔꿈치)와
        하체(엉덩이·무릎)의 관절 가동범위 변화를 계산합니다.
      </p>
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.
      </p>

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
          <button type="button" disabled={!rangesValid} onClick={handleAnalyze}>
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
          <RomResultsPanel results={results} />
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

      <RomSessionHistory refreshKey={historyKey} />
    </div>
  )
}

export default RomApp
