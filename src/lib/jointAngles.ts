import type { Point, PoseFrame } from '../types/gait'
import type { JointKey } from '../types/rom'

const MIN_SCORE = 0.3

/**
 * 정점 b에서 인접점 a·c가 이루는 각도(0~180도).
 * atan2(cross, dot) 형태를 사용해 0도/180도 근처에서도 수치적으로 안정적이다.
 */
function angleAtVertexDeg(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const cross = v1x * v2y - v1y * v2x
  const dot = v1x * v2x + v1y * v2y
  return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI)
}

function angleIfUsable(a: Point, b: Point, c: Point): number | null {
  if (a.score < MIN_SCORE || b.score < MIN_SCORE || c.score < MIN_SCORE) return null
  return angleAtVertexDeg(a, b, c)
}

export const JOINT_LABELS: Record<JointKey, string> = {
  leftShoulder: '왼쪽 어깨',
  rightShoulder: '오른쪽 어깨',
  leftElbow: '왼쪽 팔꿈치',
  rightElbow: '오른쪽 팔꿈치',
  leftHip: '왼쪽 엉덩이',
  rightHip: '오른쪽 엉덩이',
  leftKnee: '왼쪽 무릎',
  rightKnee: '오른쪽 무릎',
}

/** 한 프레임에서 상체(어깨·팔꿈치)와 하체(엉덩이·무릎) 8개 관절 각도를 계산한다. */
export function computeJointAngles(frame: PoseFrame): Record<JointKey, number | null> {
  return {
    leftShoulder: angleIfUsable(frame.leftHip, frame.leftShoulder, frame.leftElbow),
    rightShoulder: angleIfUsable(frame.rightHip, frame.rightShoulder, frame.rightElbow),
    leftElbow: angleIfUsable(frame.leftShoulder, frame.leftElbow, frame.leftWrist),
    rightElbow: angleIfUsable(frame.rightShoulder, frame.rightElbow, frame.rightWrist),
    leftHip: angleIfUsable(frame.leftShoulder, frame.leftHip, frame.leftKnee),
    rightHip: angleIfUsable(frame.rightShoulder, frame.rightHip, frame.rightKnee),
    leftKnee: angleIfUsable(frame.leftHip, frame.leftKnee, frame.leftAnkle),
    rightKnee: angleIfUsable(frame.rightHip, frame.rightKnee, frame.rightAnkle),
  }
}
