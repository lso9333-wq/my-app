import type { GaitMetrics, PoseFrame, Side, StepEvent } from '../types/gait'
import { mean, movingAverage, stddev } from './mathUtils'

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

/**
 * 지역 극댓값을 찾는다. 발목의 y좌표(이미지 좌표, 아래로 갈수록 값이 큼)가
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
  }
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

  const leftY = frames.map((f, i) => f.leftAnkle.y / scales[i])
  const rightY = frames.map((f, i) => f.rightAnkle.y / scales[i])
  const leftYSmooth = movingAverage(leftY, 3)
  const rightYSmooth = movingAverage(rightY, 3)

  const leftPeaks = findPeaks(times, leftYSmooth, minPeakDistanceSec, 0.15)
  const rightPeaks = findPeaks(times, rightYSmooth, minPeakDistanceSec, 0.15)

  const events: StepEvent[] = []
  for (const idx of leftPeaks) {
    events.push({
      time: times[idx],
      foot: 'left',
      ankleX: frames[idx].leftAnkle.x / scales[idx],
      ankleY: leftYSmooth[idx],
      stepLengthNorm: null,
    })
  }
  for (const idx of rightPeaks) {
    events.push({
      time: times[idx],
      foot: 'right',
      ankleX: frames[idx].rightAnkle.x / scales[idx],
      ankleY: rightYSmooth[idx],
      stepLengthNorm: null,
    })
  }
  events.sort((a, b) => a.time - b.time)

  const lastOpposite: Record<Side, StepEvent | null> = { left: null, right: null }
  for (const ev of events) {
    const opp: Side = ev.foot === 'left' ? 'right' : 'left'
    const prevOpp = lastOpposite[opp]
    if (prevOpp) ev.stepLengthNorm = Math.abs(ev.ankleX - prevOpp.ankleX)
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

  return {
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
}
