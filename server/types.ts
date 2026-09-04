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
