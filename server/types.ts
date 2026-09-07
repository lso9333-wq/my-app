export type JointKey =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'

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

export interface RomSessionCreateRequest {
  videoName: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  results: RomJointResult[]
}

export interface RomSessionRow {
  id: number
  created_at: string
  video_name: string
  before_start_sec: number
  before_end_sec: number
  after_start_sec: number
  after_end_sec: number
  results_json: string
}

export type XmskRegionKey =
  | 'neckShoulder'
  | 'lowBack'
  | 'knee'
  | 'ankle'
  | 'hip'
  | 'elbow'
  | 'wrist'
  | 'upperBack'

export interface XmskMeasurementValue {
  id: string
  value?: number
  left?: number
  right?: number
}

export interface XmskSessionCreateRequest {
  region: XmskRegionKey
  redFlagsCleared: boolean
  note?: string
  before: XmskMeasurementValue[]
  after: XmskMeasurementValue[]
}

export interface XmskSessionRow {
  id: number
  created_at: string
  region: string
  red_flags_cleared: number
  note: string | null
  before_json: string
  after_json: string
}

export interface XmskEvaluationCreateRequest {
  traineeName: string
  evaluatorName?: string
  evaluationDate: string
  scores: Record<string, number>
  requiredPass: Record<string, boolean>
  comment?: string
}

export interface XmskEvaluationRow {
  id: number
  created_at: string
  trainee_name: string
  evaluator_name: string | null
  evaluation_date: string
  scores_json: string
  required_pass_json: string
  comment: string | null
}
