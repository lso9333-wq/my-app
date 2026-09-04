import { useRef, useState } from 'react'
import { VideoUploader } from './components/VideoUploader'
import { SkeletonViewer } from './components/SkeletonViewer'
import { GaitMetricsPanel } from './components/GaitMetricsPanel'
import { StepIntervalChart, ComparisonBarChart } from './components/GaitCharts'
import { extractPoseFrames, getPoseDetector } from './lib/poseDetector'
import { computeGaitMetrics } from './lib/gaitAnalysis'
import type { AnalysisStage, GaitMetrics, PoseFrame } from './types/gait'

const SAMPLING_FPS = 12
const MAX_ANALYSIS_SECONDS = 20

function GaitApp() {
  const analysisVideoRef = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<AnalysisStage>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [frames, setFrames] = useState<PoseFrame[]>([])
  const [metrics, setMetrics] = useState<GaitMetrics | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setFrames([])
    setMetrics(null)
    setErrorMsg(null)
    setProgress(0)
    setStage('idle')
  }

  const handleSelect = async (file: File) => {
    reset()
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setFileName(file.name)
    setStage('loading-model')

    const video = analysisVideoRef.current
    if (!video) return

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('동영상을 불러올 수 없습니다. 다른 파일로 시도해 주세요.'))
        video.src = url
      })

      await getPoseDetector()

      setStage('processing')
      const extracted = await extractPoseFrames(video, {
        samplingFps: SAMPLING_FPS,
        maxDurationSec: MAX_ANALYSIS_SECONDS,
        onProgress: setProgress,
      })

      setStage('analyzing')
      const computed = computeGaitMetrics(extracted)

      setFrames(extracted)
      setMetrics(computed)
      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '분석 중 알 수 없는 오류가 발생했습니다.')
      setStage('error')
    }
  }

  return (
    <div className="gait-app">
      {/* 프레임 분석에만 쓰이는 숨김 비디오 엘리먼트 */}
      <video ref={analysisVideoRef} muted playsInline hidden />

      <p className="app-subtitle">
        핸드폰으로 옆에서 촬영한 걷는 영상을 업로드하면, 브라우저에서 곧바로 걸음걸이를 분석합니다.
      </p>
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 보행 평가를 대체할 수 없습니다.
      </p>

      {stage === 'idle' && <VideoUploader onSelect={handleSelect} />}

      {(stage === 'loading-model' || stage === 'processing' || stage === 'analyzing') && (
        <div className="progress-panel">
          <p className="progress-file">{fileName}</p>
          {stage === 'loading-model' && <p>포즈 인식 모델을 불러오는 중...</p>}
          {stage === 'processing' && (
            <>
              <p>영상 프레임 분석 중... {Math.round(progress * 100)}%</p>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </>
          )}
          {stage === 'analyzing' && <p>보행 지표 계산 중...</p>}
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

      {stage === 'done' && metrics && videoUrl && (
        <div className="results">
          <SkeletonViewer videoUrl={videoUrl} frames={frames} />
          <GaitMetricsPanel metrics={metrics} />

          {metrics.totalSteps >= 2 && (
            <>
              <StepIntervalChart series={metrics.stepIntervalSeries} />
              <div className="chart-row">
                <ComparisonBarChart
                  title="좌우 걸음 간격 비교"
                  leftValue={metrics.leftMeanStepIntervalSec * 1000}
                  rightValue={metrics.rightMeanStepIntervalSec * 1000}
                  format={(v) => `${v.toFixed(0)}ms`}
                />
                <ComparisonBarChart
                  title="좌우 보폭 비교 (상대 단위)"
                  leftValue={metrics.leftMeanStepLengthNorm}
                  rightValue={metrics.rightMeanStepLengthNorm}
                  format={(v) => v.toFixed(2)}
                />
              </div>
            </>
          )}

          <button type="button" className="reset-button" onClick={reset}>
            다른 영상 분석하기
          </button>
        </div>
      )}
    </div>
  )
}

export default GaitApp
