import type { Side } from '../../shared/types/pose'

export interface StepEvent {
  time: number
  foot: Side
  ankleX: number
  ankleY: number
  /** 보폭(정규화 단위, 다리 길이 기준) — 이전 반대쪽 발과의 수평 거리 */
  stepLengthNorm: number | null
}

export interface GaitMetrics {
  durationSec: number
  frameCount: number
  totalSteps: number
  cadenceStepsPerMin: number
  meanStepIntervalSec: number
  stepIntervalCV: number
  leftMeanStepIntervalSec: number
  rightMeanStepIntervalSec: number
  temporalSymmetryPercent: number
  meanStepLengthNorm: number
  leftMeanStepLengthNorm: number
  rightMeanStepLengthNorm: number
  stepLengthSymmetryPercent: number
  lateralSwayNorm: number
  stepEvents: StepEvent[]
  stepIntervalSeries: { index: number; time: number; intervalSec: number; foot: Side }[]
}

export type AnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'
