import { describe, expect, it } from 'vitest'
import type { Point, PoseFrame } from '../../../shared/types/pose'
import { angleAtVertexDeg, computeJointAngles } from './jointAngles'

function pt(x: number, y: number, score = 1): Point {
  return { x, y, score }
}

describe('angleAtVertexDeg', () => {
  it('직각을 이루는 세 점은 90도를 반환한다', () => {
    // 정점 b=(0,0), a=(1,0)(오른쪽), c=(0,1)(위쪽) → 90도
    expect(angleAtVertexDeg(pt(1, 0), pt(0, 0), pt(0, 1))).toBeCloseTo(90, 10)
  })

  it('일직선(완전히 편 상태)은 180도를 반환한다', () => {
    expect(angleAtVertexDeg(pt(1, 0), pt(0, 0), pt(-1, 0))).toBeCloseTo(180, 10)
  })

  it('완전히 접힌 상태(같은 방향)는 0도를 반환한다', () => {
    expect(angleAtVertexDeg(pt(1, 0), pt(0, 0), pt(2, 0))).toBeCloseTo(0, 10)
  })
})

function baseFrame(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    time: 0,
    leftHip: pt(0, 1),
    rightHip: pt(10, 1),
    leftKnee: pt(0, 0),
    rightKnee: pt(10, 0),
    leftAnkle: pt(0, -1),
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
    ...overrides,
  }
}

describe('computeJointAngles', () => {
  it('무릎이 직각이면 leftKnee 각도가 90도로 계산된다', () => {
    // hip=(0,1), knee=(0,0)(정점), ankle=(1,0) → v1=hip-knee=(0,1), v2=ankle-knee=(1,0) → 90도
    const frame = baseFrame({ leftAnkle: pt(1, 0) })
    const angles = computeJointAngles(frame)
    expect(angles.leftKnee).toBeCloseTo(90, 10)
  })

  it('신뢰도(score)가 임계값 미만인 관절이 하나라도 있으면 null을 반환한다', () => {
    const frame = baseFrame({ leftAnkle: pt(1, 0, 0.1) }) // score 0.1 < MIN_SCORE(0.3)
    const angles = computeJointAngles(frame)
    expect(angles.leftKnee).toBeNull()
    // 다른 관절(발목과 무관한 것)은 영향받지 않아야 한다.
    expect(angles.leftHip).not.toBeNull()
  })

  it('8개 관절 모두를 계산해 반환한다', () => {
    const angles = computeJointAngles(baseFrame())
    expect(Object.keys(angles).sort()).toEqual(
      [
        'leftShoulder',
        'rightShoulder',
        'leftElbow',
        'rightElbow',
        'leftHip',
        'rightHip',
        'leftKnee',
        'rightKnee',
      ].sort(),
    )
  })
})
