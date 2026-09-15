import type { HandFrame } from '../../../shared/types/hand'
import type { HandJointKey, HandJointResult } from '../types'
import { computeHandJointAngles, HAND_JOINT_LABELS } from './handAngles'
import { movingAverage } from '../../../shared/lib/mathUtils'

const JOINT_KEYS = Object.keys(HAND_JOINT_LABELS) as HandJointKey[]
const MIN_SAMPLES = 3

interface PhaseRom {
  minDeg: number | null
  maxDeg: number | null
  romDeg: number | null
}

function phaseRomForJoint(frames: HandFrame[], joint: HandJointKey): PhaseRom {
  const samples = frames
    .map((f) => computeHandJointAngles(f)[joint])
    .filter((v): v is number => v !== null)

  if (samples.length < MIN_SAMPLES) return { minDeg: null, maxDeg: null, romDeg: null }

  const smoothed = movingAverage(samples, 3)
  const minDeg = Math.min(...smoothed)
  const maxDeg = Math.max(...smoothed)
  return { minDeg, maxDeg, romDeg: maxDeg - minDeg }
}

/** 한쪽 손의 전/후 구간 프레임으로부터 관절 각도 14개의 가동범위 변화를 계산한다.
 * src/features/rom/lib/romAnalysis.ts의 computeRomSummary와 동일한 방식(구간 내
 * 최소~최대 각도를 그 구간의 "가동범위"로 본다)이다. */
export function computeHandRomSummary(beforeFrames: HandFrame[], afterFrames: HandFrame[]): HandJointResult[] {
  return JOINT_KEYS.map((joint) => {
    const before = phaseRomForJoint(beforeFrames, joint)
    const after = phaseRomForJoint(afterFrames, joint)
    const deltaRomDeg =
      before.romDeg !== null && after.romDeg !== null ? after.romDeg - before.romDeg : null

    return {
      joint,
      label: HAND_JOINT_LABELS[joint],
      beforeMinDeg: before.minDeg,
      beforeMaxDeg: before.maxDeg,
      beforeRomDeg: before.romDeg,
      afterMinDeg: after.minDeg,
      afterMaxDeg: after.maxDeg,
      afterRomDeg: after.romDeg,
      deltaRomDeg,
    }
  })
}
