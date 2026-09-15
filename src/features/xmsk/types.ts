export type XmskRegionKey =
  | 'neckShoulder'
  | 'lowBack'
  | 'knee'
  | 'ankle'
  | 'hip'
  | 'elbow'
  | 'wrist'
  | 'upperBack'

export interface XmskMeasurementItem {
  id: string
  label: string
  unit: string
  sides: 'single' | 'lr'
}

export interface XmskRecipeStep {
  step: string
  title: string
  detail: string
}

export interface XmskTranslateRow {
  symptom: string
  meaning: string
}

export interface XmskRecipe {
  key: XmskRegionKey
  title: string
  subtitle: string
  translate: XmskTranslateRow[]
  emergencyFlags: string[]
  beforeChecklist: string[]
  measurements: XmskMeasurementItem[]
  steps: XmskRecipeStep[]
  adjustRules: string[]
  closingScript: string
  selfCare: string[]
}

export interface XmskMeasurementValue {
  id: string
  value?: number
  left?: number
  right?: number
}

export interface XmskAuthResponse {
  token: string
}

export interface XmskSessionCreateRequest {
  region: XmskRegionKey
  clientName: string
  trainerName?: string
  redFlagsCleared: boolean
  note?: string
  before: XmskMeasurementValue[]
  after: XmskMeasurementValue[]
}

export interface XmskSessionCreateResponse {
  id: number
  createdAt: string
}

export interface XmskSessionListItem {
  id: number
  createdAt: string
  region: XmskRegionKey
  clientName: string
  trainerName: string | null
  note: string | null
  avgAbsDelta: number | null
}

export interface XmskSessionDetail extends XmskSessionListItem {
  redFlagsCleared: boolean
  before: XmskMeasurementValue[]
  after: XmskMeasurementValue[]
}

export type XmskFlowStage = 'redflag' | 'before' | 'recipe' | 'after' | 'summary'

export type XmskModule = 'recipes' | 'dictionary' | 'evaluation' | 'dataQuality'

/**
 * 데이터 품질 대시보드 응답 형태 — server/types.ts의 DataQualitySummary와 같음
 * (프론트/서버 타입 중복 관례). AI 추정치가 있는 항목마다 트레이너 실측값이 얼마나
 * 쌓였는지 보여준다. 자세한 배경은 docs/ai-training-plan.md 참고.
 */
export interface DataQualityItemStat {
  id: string
  label: string
  unit: string
  withEstimate: number
  withGroundTruth: number
  /** (선택) 발가락 마디별 시뮬레이션처럼 AI 추정값 자체가 남아있는 항목에서, 트레이너
   * 보정값과 AI 추정값의 평균 절대 차이(°) — server/types.ts의 같은 필드 주석 참고. */
  avgAbsCorrectionDeg?: number | null
}

export interface DataQualityVersionCount {
  calcVersion: string | null
  count: number
}

export interface DataQualityFeatureSummary {
  totalRecords: number
  byCalcVersion: DataQualityVersionCount[]
  items: DataQualityItemStat[]
}

export interface DataQualitySummary {
  rom: DataQualityFeatureSummary
  gait: DataQualityFeatureSummary
  foot: DataQualityFeatureSummary
  hand: DataQualityFeatureSummary
}

export interface XmskMuscleErrorResponse {
  target: string
  overDone: string
  underDone: string
  correct: string
}

export interface XmskMuscleStretch {
  action: string
  errorResponse: XmskMuscleErrorResponse
}

export interface XmskMuscleRelease {
  position: string
  toolIntensity: string
  movement: string
  caution?: string
}

export interface XmskMuscle {
  id: string
  code: string
  nameKo: string
  nameEn: string
  originInsertion: string
  action: string
  stretch: XmskMuscleStretch
  release: XmskMuscleRelease
}

export interface XmskMuscleGroup {
  key: string
  title: string
  safetyNote?: string
  muscles: XmskMuscle[]
}

export interface XmskEvalScoreItem {
  id: string
  label: string
  hint: string
  max: number
}

export interface XmskEvalRequiredItem {
  id: string
  label: string
  hint: string
}

export interface XmskEvalSection {
  key: string
  title: string
  maxTotal: number | null
  items: XmskEvalScoreItem[]
  requiredItems: XmskEvalRequiredItem[]
}

export type XmskEvalVerdict = 'approved' | 'retry' | 'hold'

export interface XmskEvaluationCreateRequest {
  traineeName: string
  evaluatorName?: string
  evaluationDate: string
  scores: Record<string, number>
  requiredPass: Record<string, boolean>
  comment?: string
}

export interface XmskEvaluationCreateResponse {
  id: number
  createdAt: string
}

export interface XmskEvaluationListItem {
  id: number
  createdAt: string
  traineeName: string
  evaluatorName: string | null
  evaluationDate: string
  totalScore: number
  verdict: XmskEvalVerdict
}

export interface XmskEvaluationDetail extends XmskEvaluationListItem {
  scores: Record<string, number>
  requiredPass: Record<string, boolean>
  comment: string | null
}
