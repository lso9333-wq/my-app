import type { PoseFrame } from '../types/pose'

/**
 * One Euro Filter (Casiez, Roussel & Vogel, "1€ Filter: A Simple Speed-based Low-pass Filter
 * for Noisy Input in Interactive Systems," CHI 2012, ACM, doi:10.1145/2207676.2208639).
 *
 * 이 프로젝트에서 쓰는 이유: 같은 영상을 PC와 폰에서 각각 분석하면 최종 지표(케이던스,
 * ROM 각도 등)가 다르게 나오는 문제의 원인 중 하나가, 기기마다 GPU 연산 정밀도(WebGL의
 * fp16 vs fp32)와 하드웨어 비디오 디코더가 달라 "같은 프레임"이어도 좌표가 아주 살짝씩
 * 다르게 검출되기 때문이다(TensorFlow 자체에서도 GPU 부동소수점 비결정성이 결과 분산의
 * 대부분을 차지한다는 보고가 있다 — Morin & Willetts, "Non-Determinism in TensorFlow
 * ResNets," arXiv:2001.11396, 2020; MediaPipe도 기기별로 다른 결과가 나온다는 이슈가
 * 공식 저장소에 있다 — google-ai-edge/mediapipe#2497). 이런 미세한 좌표 잡음(jitter)은
 * 관절 각도 계산에 그대로 전파돼 기기 간 차이를 키운다.
 *
 * One Euro Filter는 이런 고주파 잡음은 강하게 누르면서도, 실제 빠른 움직임(발 디딤,
 * 관절이 빠르게 펴지는 순간 등)은 지연 없이 따라가도록 설계된 표준 저역통과 필터로,
 * MediaPipe 자체의 랜드마크 스무딩 옵션을 포함해 여러 포즈 추정 파이프라인에서 널리
 * 쓰인다. 완전히 다른 기기의 GPU/디코더가 만들어내는 근본적인 차이 자체를 없애주지는
 * 못하지만(그건 이 필터로 해결할 수 있는 문제가 아니다 — 자세한 내용은 CLAUDE.md 참고),
 * 프레임 단위의 미세한 좌표 잡음을 줄여 최종 지표(각도 범위, 걸음 수 등)가 그 잡음에
 * 과민하게 반응하지 않도록 하는 데는 실질적으로 도움이 된다.
 */

class LowPassFilter {
  private y: number | null = null
  private s = 0

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value
    } else {
      this.s = alpha * value + (1 - alpha) * this.s
    }
    this.y = value
    return this.s
  }
}

class OneEuroFilter {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number
  private readonly xFilter = new LowPassFilter()
  private readonly dxFilter = new LowPassFilter()
  private lastTime: number | null = null
  private lastRaw: number | null = null

  constructor(minCutoff = 1.0, beta = 0.015, dCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  /** value: 원본 좌표값, timeSec: 초 단위 타임스탬프(프레임 간격이 균일하지 않아도 됨) */
  filter(value: number, timeSec: number): number {
    const dt = this.lastTime === null ? 1 / 30 : Math.max(timeSec - this.lastTime, 1 / 240)
    this.lastTime = timeSec

    const rawDx = this.lastRaw === null ? 0 : (value - this.lastRaw) / dt
    const dx = this.dxFilter.filter(rawDx, this.alpha(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(dx)
    const filtered = this.xFilter.filter(value, this.alpha(cutoff, dt))
    this.lastRaw = value
    return filtered
  }
}

interface NamedPointField {
  x: number
  y: number
  score: number
}

const NAMED_POINT_FIELDS: (keyof PoseFrame)[] = [
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHeel',
  'rightHeel',
  'leftFootIndex',
  'rightFootIndex',
]

/**
 * PoseFrame 시계열 전체에 One Euro Filter를 적용해, 좌표(x/y)의 프레임 단위 잡음을
 * 줄인 새 배열을 반환한다. 신뢰도 점수(score)는 그대로 둔다 — 스무딩된 좌표가 아니라
 * 실제 검출 신뢰도를 기준으로 프레임 채택 여부를 판단해야 하기 때문이다. 정렬은
 * frame.time 오름차순이라고 가정한다(추출 파이프라인이 항상 그렇게 만든다).
 */
export function smoothPoseFrames(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length < 2) return frames

  const namedFilters = new Map<string, { x: OneEuroFilter; y: OneEuroFilter }>()
  const keypointFilters = new Map<string, { x: OneEuroFilter; y: OneEuroFilter }>()

  const getNamedFilter = (field: string) => {
    let f = namedFilters.get(field)
    if (!f) {
      f = { x: new OneEuroFilter(), y: new OneEuroFilter() }
      namedFilters.set(field, f)
    }
    return f
  }
  const getKeypointFilter = (name: string) => {
    let f = keypointFilters.get(name)
    if (!f) {
      f = { x: new OneEuroFilter(), y: new OneEuroFilter() }
      keypointFilters.set(name, f)
    }
    return f
  }

  return frames.map((frame) => {
    const next: PoseFrame = { ...frame }

    for (const field of NAMED_POINT_FIELDS) {
      const point = frame[field] as unknown as NamedPointField
      const filters = getNamedFilter(field as string)
      const smoothed: NamedPointField = {
        x: filters.x.filter(point.x, frame.time),
        y: filters.y.filter(point.y, frame.time),
        score: point.score,
      }
      ;(next as unknown as Record<string, NamedPointField>)[field as string] = smoothed
    }

    next.keypoints = frame.keypoints.map((kp) => {
      const filters = getKeypointFilter(kp.name)
      return {
        name: kp.name,
        x: filters.x.filter(kp.x, frame.time),
        y: filters.y.filter(kp.y, frame.time),
        score: kp.score,
      }
    })

    return next
  })
}
