import { useRef, useState } from 'react'
import { VideoUploader } from '../../shared/components/VideoUploader'
import { ComparisonBarChart } from '../../shared/components/ComparisonBarChart'
import { SkeletonViewer } from './components/SkeletonViewer'
import { GaitMetricsPanel } from './components/GaitMetricsPanel'
import { StepIntervalChart } from './components/GaitCharts'
import { GaitDiagnosticsHistory } from './components/GaitDiagnosticsHistory'
import { GaitGroundTruthPanel } from './components/GaitGroundTruthPanel'
import { PdfExportButton } from '../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../shared/components/PrintReportHeader'
import { ANALYSIS_PIPELINE_VERSION, extractPoseFrames, getPoseDetector } from '../../shared/lib/poseDetector'
import type { ExtractDebugStats } from '../../shared/lib/poseDetector'
import { computeGaitMetrics } from './lib/gaitAnalysis'
import { saveGaitDiagnostic, updateGaitDiagnosticGroundTruth } from './lib/gaitDiagnosticsApi'
import { AuthError } from '../../shared/lib/authApi'
import type { AnalysisStage, GaitGroundTruth, GaitMetrics } from './types'
import type { PoseFrame } from '../../shared/types/pose'

const SAMPLING_FPS = 12
const MAX_ANALYSIS_SECONDS = 20

interface Props {
  token: string
  onAuthError: () => void
}

function GaitApp({ token, onAuthError }: Props) {
  const analysisVideoRef = useRef<HTMLVideoElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<AnalysisStage>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [frames, setFrames] = useState<PoseFrame[]>([])
  const [metrics, setMetrics] = useState<GaitMetrics | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [debugStats, setDebugStats] = useState<ExtractDebugStats | null>(null)
  const [diagSaveState, setDiagSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [diagHistoryKey, setDiagHistoryKey] = useState(0)
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [groundTruth, setGroundTruth] = useState<GaitGroundTruth[]>([])
  const savedDiagnosticIdRef = useRef<number | null>(null)
  const groundTruthSaveTimerRef = useRef<number | null>(null)

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setFrames([])
    setMetrics(null)
    setErrorMsg(null)
    setProgress(0)
    setDebugStats(null)
    setDiagSaveState('idle')
    setGroundTruth([])
    savedDiagnosticIdRef.current = null
    if (groundTruthSaveTimerRef.current !== null) {
      window.clearTimeout(groundTruthSaveTimerRef.current)
      groundTruthSaveTimerRef.current = null
    }
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
      const stats: ExtractDebugStats = {
        videoWidth: 0,
        videoHeight: 0,
        attemptedFrames: 0,
        noPoseFrames: 0,
        droppedFrames: 0,
        keptFrames: 0,
        avgHipScore: 0,
        avgLeftAnkleScore: 0,
        avgRightAnkleScore: 0,
        avgLeftHeelScore: 0,
        avgRightHeelScore: 0,
        sampledTimesChecksum: 0,
      }
      const extracted = await extractPoseFrames(
        video,
        {
          samplingFps: SAMPLING_FPS,
          maxDurationSec: MAX_ANALYSIS_SECONDS,
          onProgress: setProgress,
        },
        stats,
      )

      setStage('analyzing')
      const computed = computeGaitMetrics(extracted)

      setFrames(extracted)
      setMetrics(computed)
      setDebugStats(stats)
      setStage('done')

      // 걸음이 잘 감지되지 않는 기기/브라우저 조합을 나중에 비교할 수 있도록
      // 진단 정보를 매 분석마다 자동 저장한다 (성공/실패 여부와 무관하게).
      setDiagSaveState('saving')
      try {
        const { id } = await saveGaitDiagnostic(token, {
          videoName: file.name,
          deviceInfo: navigator.userAgent,
          clientName: clientName.trim() || undefined,
          trainerName: trainerName.trim() || undefined,
          videoWidth: stats.videoWidth,
          videoHeight: stats.videoHeight,
          durationSec: computed.durationSec,
          attemptedFrames: stats.attemptedFrames,
          noPoseFrames: stats.noPoseFrames,
          droppedFrames: stats.droppedFrames,
          keptFrames: stats.keptFrames,
          avgHipScore: stats.avgHipScore,
          avgLeftAnkleScore: stats.avgLeftAnkleScore,
          avgRightAnkleScore: stats.avgRightAnkleScore,
          avgLeftHeelScore: stats.avgLeftHeelScore,
          avgRightHeelScore: stats.avgRightHeelScore,
          sampledTimesChecksum: stats.sampledTimesChecksum,
          totalSteps: computed.totalSteps,
          cadenceStepsPerMin: computed.cadenceStepsPerMin,
          // 진단 기록 상세의 PDF "2페이지"에 지금 이 화면과 같은 통계/그래프를 함께
          // 넣을 수 있도록, 계산된 전체 지표를 그대로 함께 저장해둔다.
          gaitMetrics: computed,
          calcVersion: ANALYSIS_PIPELINE_VERSION,
        })
        savedDiagnosticIdRef.current = id
        setDiagSaveState('saved')
        setDiagHistoryKey((k) => k + 1)
      } catch (err) {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        setDiagSaveState('error')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '분석 중 알 수 없는 오류가 발생했습니다.')
      setStage('error')
    }
  }

  /**
   * 케이던스·좌우 대칭성·전도 위험 점수처럼 AI가 이미 계산한 지표 옆에 트레이너가
   * 실제 관찰한 값을 적어두는 "정답값"을 갱신한다. ROM의 handleGroundTruthChange와
   * 같은 목적으로, 분석 직후 자동 저장(POST)이 끝난 뒤 별도 PUT으로 갱신한다.
   */
  const handleGroundTruthChange = (id: string, value: number | null) => {
    setGroundTruth((prev) => {
      const idx = prev.findIndex((g) => g.id === id)
      const next =
        idx === -1 ? [...prev, { id, verifiedValue: value }] : prev.map((g, i) => (i === idx ? { ...g, verifiedValue: value } : g))

      const diagnosticId = savedDiagnosticIdRef.current
      if (diagnosticId !== null) {
        if (groundTruthSaveTimerRef.current !== null) window.clearTimeout(groundTruthSaveTimerRef.current)
        groundTruthSaveTimerRef.current = window.setTimeout(() => {
          updateGaitDiagnosticGroundTruth(token, diagnosticId, next).catch((err) => {
            if (err instanceof AuthError) {
              onAuthError()
              return
            }
            console.error('[GaitApp] 트레이너 실측값 저장 실패', err)
          })
        }, 500)
      }
      return next
    })
  }

  return (
    <div className="gait-app">
      {/*
        프레임 분석에만 쓰이는 비디오 엘리먼트. `hidden`(display:none)으로 두면
        일부 브라우저(모바일 크롬 포함)가 화면에 그려지지 않는 비디오는
        requestVideoFrameCallback을 아예 호출해주지 않는 경우가 있어, 실제
        재생 기반 프레임 추출이 조용히 멈춰버릴 수 있다. 그래서 레이아웃상
        완전히 사라지게 하는 대신, 화면 밖으로 밀어내고 투명하게 만드는
        방식으로 "보이지는 않지만 렌더링 파이프라인은 살아있는" 상태를 유지한다.
      */}
      <video
        ref={analysisVideoRef}
        muted
        playsInline
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, width: 2, height: 2, opacity: 0.01, pointerEvents: 'none' }}
      />

      <p className="app-subtitle">
        핸드폰으로 옆에서 촬영한 걷는 영상을 업로드하면, 브라우저에서 곧바로 걸음걸이를 분석합니다.
      </p>
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 보행 평가를 대체할 수 없습니다.
      </p>

      {stage === 'idle' && (
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
          {clientName.trim() === '' ? (
            <p className="rom-validation">먼저 회원 이름을 입력해 주세요.</p>
          ) : (
            <VideoUploader onSelect={handleSelect} />
          )}
        </div>
      )}

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

          <div ref={reportRef} className="gait-report">
            <PrintReportHeader
              title="보행 분석 결과"
              clientName={clientName}
              trainerName={trainerName}
              subtitle={fileName}
            />
            <PdfExportButton targetRef={reportRef} fileName={`보행분석_${clientName || fileName}`} />

            <GaitMetricsPanel metrics={metrics} debugStats={debugStats} />

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

            <GaitGroundTruthPanel
              metrics={metrics}
              groundTruth={groundTruth}
              onGroundTruthChange={handleGroundTruthChange}
            />
          </div>

          <p className="rom-save-status no-print">
            {diagSaveState === 'saving' && '진단 기록 저장 중...'}
            {diagSaveState === 'saved' && '진단 기록이 저장되었습니다.'}
            {diagSaveState === 'error' && '진단 기록 저장에 실패했습니다.'}
          </p>

          <button type="button" className="reset-button no-print" onClick={reset}>
            다른 영상 분석하기
          </button>
        </div>
      )}

      <GaitDiagnosticsHistory refreshKey={diagHistoryKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}

export default GaitApp
