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
  note: string | null
  avgAbsDelta: number | null
}

export interface XmskSessionDetail extends XmskSessionListItem {
  redFlagsCleared: boolean
  before: XmskMeasurementValue[]
  after: XmskMeasurementValue[]
}

export type XmskFlowStage = 'redflag' | 'before' | 'recipe' | 'after' | 'summary'

export type XmskModule = 'recipes' | 'dictionary' | 'evaluation'

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
