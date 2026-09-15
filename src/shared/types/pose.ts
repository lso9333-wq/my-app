export type Side = 'left' | 'right'

export interface Point {
  x: number
  y: number
  score: number
}

/** BlazePose(33포인트) 키포인트 중 분석에 사용하는 부분만 추린 프레임 데이터 (보행/ROM 공유) */
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
  /** 발뒤꿈치 — 발이 바닥에 닿는 시점(입각기 시작)을 발목보다 더 정확히 나타내는 기준점 */
  leftHeel: Point
  rightHeel: Point
  /** 발끝(앞꿈치) — 이지(toe-off) 시점 추정 및 발 방향 참고용 */
  leftFootIndex: Point
  rightFootIndex: Point
  /** 프레임 전체 원본 키포인트 (스켈레톤 그리기용) */
  keypoints: { name: string; x: number; y: number; score: number }[]
}
