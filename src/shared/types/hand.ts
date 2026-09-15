import type { Point, Side } from './pose'

/**
 * MediaPipe Hands 21개 랜드마크 중 분석에 쓰는 21개 전부를 이름별로 추린 프레임 데이터.
 * BlazePose(가동범위/보행 분석에 쓰는 몸 전체 포즈 모델)와는 별도의 모델
 * (`@tensorflow-models/hand-pose-detection`, MediaPipeHands)로 감지한다 — 자세한 배경은
 * shared/lib/handDetector.ts, docs/ai-training-plan.md 참고.
 */
export interface HandFrame {
  time: number
  /**
   * 모델의 handedness(좌/우 손 판정) 결과를 그대로 담는다. 카메라를 보는 사람 기준
   * 좌/우와 화면상 좌/우가 촬영 방향(정면/후면 카메라, 미러링 여부)에 따라 반대로
   * 나올 수 있어 참고용으로만 쓴다.
   */
  side: Side
  score: number
  wrist: Point
  thumbCmc: Point
  thumbMcp: Point
  thumbIp: Point
  thumbTip: Point
  indexMcp: Point
  indexPip: Point
  indexDip: Point
  indexTip: Point
  middleMcp: Point
  middlePip: Point
  middleDip: Point
  middleTip: Point
  ringMcp: Point
  ringPip: Point
  ringDip: Point
  ringTip: Point
  pinkyMcp: Point
  pinkyPip: Point
  pinkyDip: Point
  pinkyTip: Point
}
