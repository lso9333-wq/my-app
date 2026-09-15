import type { FallRiskAssessment, FallRiskFactor, GaitMetrics, StepEvent } from '../types'
import type { Point, PoseFrame, Side } from '../../../shared/types/pose'
import { mean, movingAverage, stddev } from '../../../shared/lib/mathUtils'

/** 두 값의 좌우 대칭 지수(%). 0에 가까울수록 대칭적. */
function symmetryPercent(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  return (Math.abs(a - b) / ((a + b) / 2)) * 100
}

/** 골반-발목 거리로 다리 길이(픽셀)를 추정해 프레임별 정규화 스케일로 사용 */
function legScale(frame: PoseFrame): number {
  const leftLen = Math.hypot(frame.leftHip.x - frame.leftAnkle.x, frame.leftHip.y - frame.leftAnkle.y)
  const rightLen = Math.hypot(frame.rightHip.x - frame.rightAnkle.x, frame.rightHip.y - frame.rightAnkle.y)
  return (leftLen + rightLen) / 2 || 1
}

const HEEL_MIN_SCORE = 0.35
/** 이 비율 이상의 프레임에서 신뢰도 있는 뒤꿈치가 잡혀야 발목 대신 뒤꿈치를 기준점으로 쓴다. */
const HEEL_MIN_COVERAGE = 0.6

/** 해당 발의 뒤꿈치 키포인트가 충분히 신뢰할 만한 프레임의 비율 */
function heelCoverage(frames: PoseFrame[], side: Side): number {
  if (frames.length === 0) return 0
  const good = frames.filter((f) => (side === 'left' ? f.leftHeel : f.rightHeel).score >= HEEL_MIN_SCORE).length
  return good / frames.length
}

/**
 * 발이 바닥에 닿는 위치의 기준점. 뒤꿈치(heel)가 발목보다 실제 입각기(heel-strike)
 * 시점의 지면 접촉을 더 정확히 반영한다는 최신 연구 결과에 따라, 해당 프레임에서
 * 뒤꿈치 신뢰도가 충분하면 뒤꿈치를, 아니면 발목을 사용한다(그레이스풀 폴백).
 */
function footPoint(frame: PoseFrame, side: Side, useHeel: boolean): Point {
  const heel = side === 'left' ? frame.leftHeel : frame.rightHeel
  const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle
  return useHeel && heel.score >= HEEL_MIN_SCORE ? heel : ankle
}

/** 이 신뢰도 미만인 프레임의 발 좌표는 튀는 값으로 보고 직전 값으로 대체한다. */
const FOOT_MIN_SCORE = 0.2

/**
 * 프레임별 발 y좌표(정규화 단위) 시계열을 만든다. 옆에서 찍은 보행 영상은
 * 걸음마다 한쪽 발이 반대쪽 다리에 가려 그 프레임만 신뢰도가 순간적으로
 * 떨어지는 경우가 흔하다(정상적인 자기 폐색). 이런 프레임까지 그대로 쓰면
 * 좌표가 튀어 걸음으로 잘못 감지될 수 있으므로, 신뢰도가 낮은 프레임은
 * 직전의 신뢰도 높은 값으로 유지(hold)한다.
 */
function buildFootYSeries(frames: PoseFrame[], side: Side, useHeel: boolean, scales: number[]): number[] {
  const series: number[] = []
  let last: number | null = null
  for (let i = 0; i < frames.length; i++) {
    const pt = footPoint(frames[i], side, useHeel)
    const val = pt.y / scales[i]
    if (pt.score >= FOOT_MIN_SCORE || last === null) {
      last = val
      series.push(val)
    } else {
      series.push(last)
    }
  }
  return series
}

/**
 * 지역 극댓값을 찾는다. 발 기준점의 y좌표(이미지 좌표, 아래로 갈수록 값이 큼)가
 * 극댓값을 가질 때 발이 바닥에 닿는 시점(입각기)으로 간주한다.
 */
function findPeaks(
  times: number[],
  values: number[],
  minDistanceSec: number,
  minProminenceRatio: number,
): number[] {
  const n = values.length
  if (n < 3) return []

  const candidates: number[] = []
  for (let i = 1; i < n - 1; i++) {
    if (values[i] > values[i - 1] && values[i] >= values[i + 1]) candidates.push(i)
  }

  const spaced: number[] = []
  for (const idx of candidates) {
    const last = spaced[spaced.length - 1]
    if (last !== undefined && times[idx] - times[last] < minDistanceSec) {
      if (values[idx] > values[last]) spaced[spaced.length - 1] = idx
    } else {
      spaced.push(idx)
    }
  }
  if (spaced.length === 0) return []

  const range = Math.max(...values) - Math.min(...values) || 1
  const minProminence = range * minProminenceRatio

  return spaced.filter((idx, i) => {
    const prevIdx = i > 0 ? spaced[i - 1] : 0
    const nextIdx = i < spaced.length - 1 ? spaced[i + 1] : n - 1
    const leftMin = Math.min(...values.slice(prevIdx, idx + 1))
    const rightMin = Math.min(...values.slice(idx, nextIdx + 1))
    const prominence = values[idx] - Math.max(leftMin, rightMin)
    return prominence >= minProminence
  })
}

function intervalsForFoot(series: GaitMetrics['stepIntervalSeries'], foot: Side): number[] {
  return series.filter((s) => s.foot === foot).map((s) => s.intervalSec)
}

const EMPTY_FALL_RISK: FallRiskAssessment = {
  score: 0,
  level: 'insufficient-data',
  factors: [],
}

function emptyMetrics(frames: PoseFrame[]): GaitMetrics {
  const durationSec = frames.length > 1 ? frames[frames.length - 1].time - frames[0].time : 0
  return {
    durationSec,
    frameCount: frames.length,
    totalSteps: 0,
    cadenceStepsPerMin: 0,
    meanStepIntervalSec: 0,
    stepIntervalCV: 0,
    leftMeanStepIntervalSec: 0,
    rightMeanStepIntervalSec: 0,
    temporalSymmetryPercent: 0,
    meanStepLengthNorm: 0,
    leftMeanStepLengthNorm: 0,
    rightMeanStepLengthNorm: 0,
    stepLengthSymmetryPercent: 0,
    lateralSwayNorm: 0,
    stepEvents: [],
    stepIntervalSeries: [],
    fallRisk: EMPTY_FALL_RISK,
  }
}

/**
 * 전도(낙상) 위험 참고 점수 (0~100, 높을수록 위험 신호가 많음).
 *
 * 보행 변수와 낙상 위험의 연관성을 다룬 최신 연구들을 참고해 구성했다:
 * - 걸음(스트라이드) 시간 변동성(CV%)이 클수록 낙상 이력·낙상 위험군에서
 *   일관되게 높게 나타난다는 것은 노인 보행 연구에서 가장 널리 반복 검증된
 *   소견 중 하나이며, 2024~2025년 보행 변동성·머신러닝 기반 낙상 위험 분류
 *   연구에서도 케이던스·걸음 시간 변동성이 핵심 예측 변수로 쓰인다.
 * - 좌우 시간/보폭 비대칭(asymmetry)이 클수록 낙상 위험과 관련된다는 소견도
 *   보행 분석 문헌에서 반복적으로 보고된다.
 * - 좌우 흔들림(측면 sway)의 증가 역시 자세 불안정성·낙상 위험과 연관된다는
 *   것이 최근 보행 변동성 연구(2025)에서 보고된다.
 * - 케이던스가 뚜렷하게 느린 경우(조심스러운 보행) 역시 노쇠·낙상 위험과
 *   연관된다고 알려져 있다.
 *
 * 다만 여러 리뷰 논문에서 공통적으로 지적하듯, 이 지표들에 대한 "표준화된
 * 임상 컷오프"는 아직 존재하지 않는다. 실제 임상 낙상 확률 예측 모델(예: 2024년
 * BMC Public Health 로지스틱 회귀 모델)은 이 앱이 얻을 수 없는 입력값(임상
 * 평가 점수, 미터 단위 실측 보폭 등)을 필요로 한다. 따라서 아래 점수는 검증된
 * 임상 확률이 아니라, 이미 계산된 상대 단위 보행 지표를 연구 근거의 방향성에
 * 따라 종합한 "참고용" 지표로만 사용해야 한다.
 */
function computeFallRisk(metrics: Omit<GaitMetrics, 'fallRisk'>): FallRiskAssessment {
  if (metrics.totalSteps < 4) return EMPTY_FALL_RISK

  const factors: FallRiskFactor[] = []

  const cv = metrics.stepIntervalCV
  factors.push({
    key: 'stepIntervalCV',
    label: '걸음 시간 변동성(CV)',
    points: cv < 4 ? 0 : cv < 8 ? 12 : cv < 15 ? 24 : 35,
    maxPoints: 35,
    note: `${cv.toFixed(1)}% — 걸음마다 리듬이 얼마나 일정한지 (변동성이 클수록 낙상 위험과 관련된다는 연구가 다수)`,
  })

  const tSym = metrics.temporalSymmetryPercent
  factors.push({
    key: 'temporalSymmetry',
    label: '좌우 시간 대칭성',
    points: tSym < 5 ? 0 : tSym < 10 ? 7 : tSym < 20 ? 14 : 20,
    maxPoints: 20,
    note: `${tSym.toFixed(1)}% — 좌우 다리의 걸음 리듬 차이`,
  })

  const lSym = metrics.stepLengthSymmetryPercent
  factors.push({
    key: 'stepLengthSymmetry',
    label: '좌우 보폭 대칭성',
    points: lSym < 5 ? 0 : lSym < 10 ? 5 : lSym < 20 ? 10 : 15,
    maxPoints: 15,
    note: `${lSym.toFixed(1)}% — 좌우 다리의 보폭 차이`,
  })

  // 좌우 흔들림을 다리 길이가 아닌 "평균 보폭" 대비 비율로 봐, 전진 이동량 대비
  // 옆으로 얼마나 흔들리는지를 나타내는 상대 지표로 사용한다.
  if (metrics.meanStepLengthNorm > 0) {
    const swayRatio = metrics.lateralSwayNorm / metrics.meanStepLengthNorm
    factors.push({
      key: 'lateralSway',
      label: '좌우 흔들림(체간 sway)',
      points: swayRatio < 0.15 ? 0 : swayRatio < 0.3 ? 5 : swayRatio < 0.5 ? 10 : 15,
      maxPoints: 15,
      note: `보폭 대비 ${(swayRatio * 100).toFixed(0)}% — 걷는 동안 골반 중심이 옆으로 흔들리는 정도`,
    })
  }

  const cadence = metrics.cadenceStepsPerMin
  factors.push({
    key: 'cadence',
    label: '케이던스(걸음 속도감)',
    points: cadence >= 100 ? 0 : cadence >= 80 ? 5 : cadence >= 60 ? 10 : 15,
    maxPoints: 15,
    note: `${cadence.toFixed(0)} 걸음/분 — 지나치게 느리고 조심스러운 보행은 노쇠·낙상 위험과 연관될 수 있음`,
  })

  const maxTotal = factors.reduce((sum, f) => sum + f.maxPoints, 0)
  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0)
  const score = maxTotal > 0 ? Math.round((rawTotal / maxTotal) * 100) : 0
  const level: FallRiskAssessment['level'] = score < 25 ? 'low' : score < 50 ? 'moderate' : 'high'

  return { score, level, factors }
}

/**
 * 프레임 시퀀스로부터 보행 지표를 계산한다.
 * 절대 길이(m)가 아닌 다리 길이(픽셀) 기준 상대 단위를 사용하므로,
 * 카메라 거리·각도가 일정하지 않으면 절대값보다 좌우 대칭성 비교에 더 신뢰할 수 있다.
 */
export function computeGaitMetrics(frames: PoseFrame[], minPeakDistanceSec = 0.25): GaitMetrics {
  if (frames.length < 5) return emptyMetrics(frames)

  const times = frames.map((f) => f.time)
  const scales = movingAverage(frames.map(legScale), 5)

  const useHeelLeft = heelCoverage(frames, 'left') >= HEEL_MIN_COVERAGE
  const useHeelRight = heelCoverage(frames, 'right') >= HEEL_MIN_COVERAGE

  const leftFootY = buildFootYSeries(frames, 'left', useHeelLeft, scales)
  const rightFootY = buildFootYSeries(frames, 'right', useHeelRight, scales)
  const leftYSmooth = movingAverage(leftFootY, 3)
  const rightYSmooth = movingAverage(rightFootY, 3)

  const leftPeaks = findPeaks(times, leftYSmooth, minPeakDistanceSec, 0.15)
  const rightPeaks = findPeaks(times, rightYSmooth, minPeakDistanceSec, 0.15)

  const events: StepEvent[] = []
  for (const idx of leftPeaks) {
    events.push({
      time: times[idx],
      foot: 'left',
      footX: footPoint(frames[idx], 'left', useHeelLeft).x / scales[idx],
      footY: leftYSmooth[idx],
      stepLengthNorm: null,
    })
  }
  for (const idx of rightPeaks) {
    events.push({
      time: times[idx],
      foot: 'right',
      footX: footPoint(frames[idx], 'right', useHeelRight).x / scales[idx],
      footY: rightYSmooth[idx],
      stepLengthNorm: null,
    })
  }
  events.sort((a, b) => a.time - b.time)

  const lastOpposite: Record<Side, StepEvent | null> = { left: null, right: null }
  for (const ev of events) {
    const opp: Side = ev.foot === 'left' ? 'right' : 'left'
    const prevOpp = lastOpposite[opp]
    if (prevOpp) ev.stepLengthNorm = Math.abs(ev.footX - prevOpp.footX)
    lastOpposite[ev.foot] = ev
  }

  const stepIntervalSeries: GaitMetrics['stepIntervalSeries'] = []
  for (let i = 1; i < events.length; i++) {
    stepIntervalSeries.push({
      index: i,
      time: events[i].time,
      intervalSec: events[i].time - events[i - 1].time,
      foot: events[i].foot,
    })
  }

  const durationSec = times[times.length - 1] - times[0]
  const totalSteps = events.length
  const cadenceStepsPerMin = durationSec > 0 ? (totalSteps / durationSec) * 60 : 0

  const intervals = stepIntervalSeries.map((s) => s.intervalSec)
  const meanStepIntervalSec = mean(intervals)
  const stepIntervalCV = meanStepIntervalSec > 0 ? (stddev(intervals) / meanStepIntervalSec) * 100 : 0

  const leftMeanStepIntervalSec = mean(intervalsForFoot(stepIntervalSeries, 'left'))
  const rightMeanStepIntervalSec = mean(intervalsForFoot(stepIntervalSeries, 'right'))
  const temporalSymmetryPercent = symmetryPercent(leftMeanStepIntervalSec, rightMeanStepIntervalSec)

  const leftStepLengths = events
    .filter((e) => e.foot === 'left' && e.stepLengthNorm !== null)
    .map((e) => e.stepLengthNorm as number)
  const rightStepLengths = events
    .filter((e) => e.foot === 'right' && e.stepLengthNorm !== null)
    .map((e) => e.stepLengthNorm as number)
  const allStepLengths = [...leftStepLengths, ...rightStepLengths]

  const meanStepLengthNorm = mean(allStepLengths)
  const leftMeanStepLengthNorm = mean(leftStepLengths)
  const rightMeanStepLengthNorm = mean(rightStepLengths)
  const stepLengthSymmetryPercent = symmetryPercent(leftMeanStepLengthNorm, rightMeanStepLengthNorm)

  const hipMidX = frames.map((f, i) => (f.leftHip.x + f.rightHip.x) / 2 / scales[i])
  const lateralSwayNorm = stddev(hipMidX)

  const base: Omit<GaitMetrics, 'fallRisk'> = {
    durationSec,
    frameCount: frames.length,
    totalSteps,
    cadenceStepsPerMin,
    meanStepIntervalSec,
    stepIntervalCV,
    leftMeanStepIntervalSec,
    rightMeanStepIntervalSec,
    temporalSymmetryPercent,
    meanStepLengthNorm,
    leftMeanStepLengthNorm,
    rightMeanStepLengthNorm,
    stepLengthSymmetryPercent,
    lateralSwayNorm,
    stepEvents: events,
    stepIntervalSeries,
  }

  return { ...base, fallRisk: computeFallRisk(base) }
}
