import type { PoseFrame } from '../types/gait'
import type { JointKey, RomJointResult } from '../types/rom'
import { computeJointAngles, JOINT_LABELS } from './jointAngles'
import { movingAverage } from './mathUtils'

const JOINT_KEYS = Object.keys(JOINT_LABELS) as JointKey[]
const MIN_SAMPLES = 3

interface PhaseRom {
  minDeg: number | null
  maxDeg: number | null
  romDeg: number | null
}

function phaseRomForJoint(frames: PoseFrame[], joint: JointKey): PhaseRom {
  const samples = frames
    .map((f) => computeJointAngles(f)[joint])
    .filter((v): v is number => v !== null)

  if (samples.length < MIN_SAMPLES) return { minDeg: null, maxDeg: null, romDeg: null }

  const smoothed = movingAverage(samples, 3)
  const minDeg = Math.min(...smoothed)
  const maxDeg = Math.max(...smoothed)
  return { minDeg, maxDeg, romDeg: maxDeg - minDeg }
}

/** 전/후 구간의 프레임으로부터 8개 관절의 가동범위(ROM) 변화를 계산한다. */
export function computeRomSummary(beforeFrames: PoseFrame[], afterFrames: PoseFrame[]): RomJointResult[] {
  return JOINT_KEYS.map((joint) => {
    const before = phaseRomForJoint(beforeFrames, joint)
    const after = phaseRomForJoint(afterFrames, joint)
    const deltaRomDeg =
      before.romDeg !== null && after.romDeg !== null ? after.romDeg - before.romDeg : null

    return {
      joint,
      label: JOINT_LABELS[joint],
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
