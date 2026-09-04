export type Side = 'left' | 'right'

export interface Point {
  x: number
  y: number
  score: number
}

/** MoveNet(COCO-17) 키포인트 중 보행 분석에 사용하는 부분만 추린 프레임 데이터 */
export interface PoseFrame {
  time: number
  leftHip: Point
  rightHip: Point
  leftKnee: Point
  rightKnee: Point
  leftAnkle: Point
  rightAnkle: Point
  leftShoulder: Point
  rightShoulder: Point
  leftElbow: Point
  rightElbow: Point
  leftWrist: Point
  rightWrist: Point
  /** 프레임 전체 원본 키포인트 (스켈레톤 그리기용) */
  keypoints: { name: string; x: number; y: number; score: number }[]
}

export interface StepEvent {
  time: number
  foot: Side
  ankleX: number
  ankleY: number
  /** 보폭(정규화 단위, 다리 길이 기준) — 이전 반대쪽 발과의 수평 거리 */
  stepLengthNorm: number | null
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
}

export type AnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'
