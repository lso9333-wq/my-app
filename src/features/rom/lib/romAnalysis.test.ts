import { describe, expect, it } from 'vitest'
import type { Point, PoseFrame } from '../../../shared/types/pose'
import { computeRomSummary } from './romAnalysis'

function pt(x: number, y: number, score = 1): Point {
  return { x, y, score }
}

/** leftKnee 각도만 theta(도)로 통제하고 나머지 7개 관절은 모든 프레임에서 고정해두는
 * 테스트용 프레임 — leftHip=(0,1), leftKnee=(0,0)(정점)을 고정하고 leftAnkle만
 * 원 위의 점으로 움직여서, angleAtVertexDeg(hip, knee, ankle) = theta가 정확히
 * 나오도록 한다(jointAngles.test.ts의 90도 케이스와 같은 원리를 일반화한 것). */
function frameWithKneeAngle(thetaDeg: number): PoseFrame {
  const theta = (thetaDeg * Math.PI) / 180
  return {
    time: 0,
    leftHip: pt(0, 1),
    rightHip: pt(10, 1),
    leftKnee: pt(0, 0),
    rightKnee: pt(10, 0),
    leftAnkle: pt(Math.sin(theta), Math.cos(theta)),
    rightAnkle: pt(10, -1),
    leftShoulder: pt(0, 5),
    rightShoulder: pt(10, 5),
    leftElbow: pt(0, 4),
    rightElbow: pt(10, 4),
    leftWrist: pt(0, 3),
    rightWrist: pt(10, 3),
    leftHeel: pt(0, -2),
    rightHeel: pt(10, -2),
    leftFootIndex: pt(1, -2),
    rightFootIndex: pt(11, -2),
    keypoints: [],
  }
}

describe('computeRomSummary', () => {
  it('구간별 최솟값~최댓값 차이를 leftKnee의 ROM으로 계산한다', () => {
    // 스무딩(movingAverage, window=3)에 뭉개지지 않도록 각 극값을 3프레임씩 유지한다
    // (mathUtils.test.ts에서 이 전제 자체를 별도로 검증해뒀다).
    const beforeThetas = [90, 90, 90, 120, 120, 120, 90, 90, 90]
    const afterThetas = [80, 80, 80, 150, 150, 150, 80, 80, 80]
    const beforeFrames = beforeThetas.map(frameWithKneeAngle)
    const afterFrames = afterThetas.map(frameWithKneeAngle)

    const results = computeRomSummary(beforeFrames, afterFrames)
    const knee = results.find((r) => r.joint === 'leftKnee')!

    expect(knee.beforeMinDeg).toBeCloseTo(90, 6)
    expect(knee.beforeMaxDeg).toBeCloseTo(120, 6)
    expect(knee.beforeRomDeg).toBeCloseTo(30, 6)

    expect(knee.afterMinDeg).toBeCloseTo(80, 6)
    expect(knee.afterMaxDeg).toBeCloseTo(150, 6)
    expect(knee.afterRomDeg).toBeCloseTo(70, 6)

    expect(knee.deltaRomDeg).toBeCloseTo(40, 6)
  })

  it('유효 샘플이 3개 미만인 구간은 모두 null(데이터 부족)로 남긴다', () => {
    const beforeFrames = [frameWithKneeAngle(90), frameWithKneeAngle(120)] // 2개뿐
    const afterFrames = [frameWithKneeAngle(90), frameWithKneeAngle(120), frameWithKneeAngle(100)]

    const results = computeRomSummary(beforeFrames, afterFrames)
    const knee = results.find((r) => r.joint === 'leftKnee')!

    expect(knee.beforeMinDeg).toBeNull()
    expect(knee.beforeMaxDeg).toBeNull()
    expect(knee.beforeRomDeg).toBeNull()
    // after는 3개라 계산되고, before가 null이므로 deltaRomDeg도 null이어야 한다.
    expect(knee.afterRomDeg).not.toBeNull()
    expect(knee.deltaRomDeg).toBeNull()
  })

  it('8개 관절 전부에 대해 결과를 반환한다', () => {
    const frames = [frameWithKneeAngle(90), frameWithKneeAngle(100), frameWithKneeAngle(110)]
    const results = computeRomSummary(frames, frames)
    expect(results).toHaveLength(8)
  })
})
