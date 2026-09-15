export type JointKey =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'

export interface RomRange {
  start: number
  end: number
}

export interface RomJointResult {
  joint: JointKey
  label: string
  beforeMinDeg: number | null
  beforeMaxDeg: number | null
  beforeRomDeg: number | null
  afterMinDeg: number | null
  afterMaxDeg: number | null
  afterRomDeg: number | null
  deltaRomDeg: number | null
}

/**
 * XMSK 통증 레시피의 "0.5 상태체크"/"3. 마무리" 입력 항목 중 영상 프레임 분석으로
 * 추정할 수 있는 항목들의 결과. 근거 수준(evidence)은 두 단계로만 나눈다 —
 * 이 용도에 정확히 검증된 방법은 없으므로 "validated"는 쓰지 않는다:
 * - 'approximate': 관련(유사) 측정을 다룬 발표 연구가 있어 어느 정도 근거가 있는 근사치
 * - 'experimental': 기하학적으로는 타당하지만 이 방식 자체를 검증한 연구를 찾지 못한 추정치
 * 자세한 근거는 romXmskEstimates.ts의 주석과 CLAUDE.md 참고.
 */
export type XmskEstimateEvidence = 'approximate' | 'experimental'

export interface RomXmskEstimateResult {
  id: string
  label: string
  unit: string
  beforeValue: number | null
  afterValue: number | null
  deltaValue: number | null
  evidence: XmskEstimateEvidence
  note: string
}

/**
 * 영상으로는 측정할 수 없어(예: 손목 신전·굴곡 저항 — 도수근력검사) 트레이너가 직접
 * 관찰한 값을 입력하는 항목. id는 XmskManualItemDef.id(예: 'wristResist_left')와 같다.
 */
export interface RomXmskManualInput {
  id: string
  beforeValue: number | null
  afterValue: number | null
}

/**
 * "AI가 영상으로 추정한 값"과는 별개로, 트레이너가 실제로 관찰·측정한 값을 같은 항목
 * 옆에 기록해두는 것 — RomXmskManualInput(영상으로 아예 잴 수 없는 항목 전용)과 달리,
 * 이건 AI 추정치가 이미 있는 항목(RomXmskEstimateResult)에 대해 "그 추정이 실제와
 * 얼마나 맞았는지"를 나중에 확인하기 위한 것이다. estimateId는
 * RomXmskEstimateResult.id(예: 'legAbduction_left')와 같은 값을 쓴다.
 *
 * 이 값들은 지금 당장 화면에 어떤 계산도 바꾸지 않는다 — 오직 "AI 추정 vs 트레이너
 * 실측"을 짝지어 쌓아두는 것이 목적으로, 나중에 데이터가 충분히 모이면(수십~수백 건)
 * 이 계산 로직을 트레이너 실측값에 더 가깝게 보정하는 경량 모델을 학습시키는 데 쓴다
 * (자세한 배경은 docs/ai-training-plan.md 참고).
 */
export interface RomXmskGroundTruth {
  estimateId: string
  verifiedValue: number | null
}

export interface RomSessionCreateRequest {
  videoName: string
  clientName: string
  trainerName?: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  results: RomJointResult[]
  xmskEstimates?: RomXmskEstimateResult[]
  xmskManualInputs?: RomXmskManualInput[]
  xmskGroundTruth?: RomXmskGroundTruth[]
  /** 이 결과를 계산한 코드 버전 (ANALYSIS_PIPELINE_VERSION, shared/lib/poseDetector.ts).
   * ground truth와 짝지어 비교할 때 버전이 다른 값끼리 섞이지 않도록 하기 위함. */
  calcVersion?: string
}

export interface RomSessionCreateResponse {
  id: number
  createdAt: string
}

export interface RomSessionListItem {
  id: number
  createdAt: string
  videoName: string
  clientName: string
  trainerName: string | null
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  avgDeltaRomDeg: number | null
}

export interface RomSessionDetail extends RomSessionListItem {
  results: RomJointResult[]
  xmskEstimates: RomXmskEstimateResult[]
  xmskManualInputs: RomXmskManualInput[]
  xmskGroundTruth: RomXmskGroundTruth[]
  /** 이 컬럼이 생기기 전에 저장된 기록은 null. */
  calcVersion: string | null
}

export type RomAnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'marking-range'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'
