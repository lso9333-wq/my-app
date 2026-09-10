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

export interface RomSessionCreateRequest {
  videoName: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  results: RomJointResult[]
}

export interface RomSessionCreateResponse {
  id: number
  createdAt: string
}

export interface RomSessionListItem {
  id: number
  createdAt: string
  videoName: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  avgDeltaRomDeg: number | null
}

export interface RomSessionDetail extends RomSessionListItem {
  results: RomJointResult[]
}

export type RomAnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'marking-range'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'
