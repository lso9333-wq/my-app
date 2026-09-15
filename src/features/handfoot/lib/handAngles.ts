import type { HandFrame } from '../../../shared/types/hand'
import type { Point } from '../../../shared/types/pose'
import type { HandJointKey } from '../types'

const MIN_SCORE = 0.5

/** src/features/rom/lib/jointAngles.ts의 angleAtVertexDeg와 동일한 공식이다 — 교차
 * 기능 참조를 피하는 기존 관례(CLAUDE.md 참고)에 따라 작은 순수 함수만 복제했다. */
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

export const HAND_JOINT_LABELS: Record<HandJointKey, string> = {
  thumbMcp: '엄지 MCP',
  thumbIp: '엄지 IP',
  indexMcp: '검지 MCP',
  indexPip: '검지 PIP',
  indexDip: '검지 DIP',
  middleMcp: '중지 MCP',
  middlePip: '중지 PIP',
  middleDip: '중지 DIP',
  ringMcp: '약지 MCP',
  ringPip: '약지 PIP',
  ringDip: '약지 DIP',
  pinkyMcp: '소지 MCP',
  pinkyPip: '소지 PIP',
  pinkyDip: '소지 DIP',
}

/** 한 프레임에서 손가락 관절 각도 14개(네 손가락 3관절 + 엄지 2관절)를 계산한다. */
export function computeHandJointAngles(frame: HandFrame): Record<HandJointKey, number | null> {
  return {
    thumbMcp: angleIfUsable(frame.wrist, frame.thumbMcp, frame.thumbIp),
    thumbIp: angleIfUsable(frame.thumbMcp, frame.thumbIp, frame.thumbTip),
    indexMcp: angleIfUsable(frame.wrist, frame.indexMcp, frame.indexPip),
    indexPip: angleIfUsable(frame.indexMcp, frame.indexPip, frame.indexDip),
    indexDip: angleIfUsable(frame.indexPip, frame.indexDip, frame.indexTip),
    middleMcp: angleIfUsable(frame.wrist, frame.middleMcp, frame.middlePip),
    middlePip: angleIfUsable(frame.middleMcp, frame.middlePip, frame.middleDip),
    middleDip: angleIfUsable(frame.middlePip, frame.middleDip, frame.middleTip),
    ringMcp: angleIfUsable(frame.wrist, frame.ringMcp, frame.ringPip),
    ringPip: angleIfUsable(frame.ringMcp, frame.ringPip, frame.ringDip),
    ringDip: angleIfUsable(frame.ringPip, frame.ringDip, frame.ringTip),
    pinkyMcp: angleIfUsable(frame.wrist, frame.pinkyMcp, frame.pinkyPip),
    pinkyPip: angleIfUsable(frame.pinkyMcp, frame.pinkyPip, frame.pinkyDip),
    pinkyDip: angleIfUsable(frame.pinkyPip, frame.pinkyDip, frame.pinkyTip),
  }
}
