import type { Side } from '../../shared/types/pose'

export interface StepEvent {
  time: number
  foot: Side
  /** 발 기준점(뒤꿈치 신뢰도가 충분하면 뒤꿈치, 아니면 발목)의 x좌표 — 정규화 단위 */
  footX: number
  /** 발 기준점의 y좌표 — 정규화 단위 */
  footY: number
  /** 보폭(정규화 단위, 다리 길이 기준) — 이전 반대쪽 발과의 수평 거리 */
  stepLengthNorm: number | null
}

/** 전도(낙상) 위험 참고 점수를 구성하는 개별 요인 */
export interface FallRiskFactor {
  key: string
  label: string
  points: number
  maxPoints: number
  note: string
}

export type FallRiskLevel = 'low' | 'moderate' | 'high' | 'insufficient-data'

/**
 * 전도(낙상) 위험 참고 지표. 검증된 임상 확률이 아니라, 여러 보행 변동성·대칭성
 * 연구의 방향성을 종합한 0~100 참고 점수다 (자세한 근거는 gaitAnalysis.ts 참고).
 */
export interface FallRiskAssessment {
  score: number
  level: FallRiskLevel
  factors: FallRiskFactor[]
}

export interface GaitMetrics {
  durationSec: number
  frameCount: number
  totalSteps: number
  cadenceStepsPerMin: number
  meanStepIntervalSec: number
  stepIntervalCV: number
  leftMeanStepIntervalSec: number
  rightMeanStepIntervalSec: number
  temporalSymmetryPercent: number
  meanStepLengthNorm: number
  leftMeanStepLengthNorm: number
  rightMeanStepLengthNorm: number
  stepLengthSymmetryPercent: number
  lateralSwayNorm: number
  stepEvents: StepEvent[]
  stepIntervalSeries: { index: number; time: number; intervalSec: number; foot: Side }[]
  fallRisk: FallRiskAssessment
}

/**
 * AI가 이미 계산한 지표(케이던스, 좌우 대칭성, 전도 위험 점수 등) 옆에 트레이너가 실제
 * 관찰한 값을 나란히 기록해두는 "정답값" — ROM의 RomXmskGroundTruth와 같은 목적으로,
 * 나중에 데이터가 쌓이면 계산 로직을 보정하는 데 쓴다(docs/ai-training-plan.md 참고).
 * id는 GAIT_VERIFIABLE_ITEMS(lib/gaitGroundTruth.ts)의 항목 id와 같다.
 */
export interface GaitGroundTruth {
  id: string
  verifiedValue: number | null
}

export type AnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'

/**
 * 걸음이 잘 감지되지 않을 때 원인 파악을 위해 서버에 저장해두는 진단 기록.
 * 기기/브라우저별로 포즈 인식이 왜 실패하는지 비교할 수 있도록 검색·삭제가 가능하다.
 */
export interface GaitDiagnosticCreateRequest {
  videoName: string
  deviceInfo: string
  clientName?: string
  trainerName?: string
  videoWidth: number
  videoHeight: number
  durationSec: number
  attemptedFrames: number
  noPoseFrames: number
  droppedFrames: number
  keptFrames: number
  avgHipScore: number
  avgLeftAnkleScore: number
  avgRightAnkleScore: number
  avgLeftHeelScore: number
  avgRightHeelScore: number
  /** 실행마다 같은 영상에서 같은 프레임이 뽑혔는지 비교하기 위한 체크섬 (ExtractDebugStats 참고) */
  sampledTimesChecksum: number
  totalSteps: number
  cadenceStepsPerMin: number
  note?: string
  /**
   * 진단 기록 PDF에 방금 분석한 결과 화면과 같은 통계/그래프를 "2페이지"로 함께
   * 넣기 위해 저장 시점의 전체 GaitMetrics를 함께 보낸다(GaitApp에서 채워줌).
   */
  gaitMetrics?: GaitMetrics
  /** 이 결과를 계산한 코드 버전 (ANALYSIS_PIPELINE_VERSION, shared/lib/poseDetector.ts).
   * ground truth와 짝지어 비교할 때 버전이 다른 값끼리 섞이지 않도록 하기 위함. */
  calcVersion?: string
}

export interface GaitDiagnosticRecord
  extends Omit<GaitDiagnosticCreateRequest, 'clientName' | 'trainerName' | 'note' | 'gaitMetrics' | 'calcVersion'> {
  id: number
  createdAt: string
  clientName: string | null
  trainerName: string | null
  note: string | null
  /** 이 컬럼이 생기기 전에 저장된 기록은 null — 그런 기록은 2페이지(그래프)를 만들 수 없다. */
  gaitMetrics: GaitMetrics | null
  /** 이 컬럼이 생기기 전에 저장된 기록은 null. */
  groundTruth: GaitGroundTruth[] | null
  /** 이 컬럼이 생기기 전에 저장된 기록은 null. */
  calcVersion: string | null
}
