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
