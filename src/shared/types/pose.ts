export type Side = 'left' | 'right'

export interface Point {
  x: number
  y: number
  score: number
}

/** MoveNet(COCO-17) 키포인트 중 분석에 사용하는 부분만 추린 프레임 데이터 (보행/ROM 공유) */
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
