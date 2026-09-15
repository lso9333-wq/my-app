import type { GaitMetrics } from '../types'

/**
 * 보행 분석 결과 중 트레이너가 실제로 관찰·측정해서 비교해볼 수 있는 항목들.
 * ROM의 XMSK_MANUAL_ITEMS(계산 자체가 불가능한 항목)와 달리, 이 항목들은 모두 이미
 * AI가 계산해서 GaitMetricsPanel에 보여주고 있는 값이다 — 그 옆에 트레이너가 실측한
 * 값을 나란히 기록해, "AI 추정이 실제와 얼마나 맞았는지"를 나중에 확인하기 위한
 * 것이다(자세한 배경은 docs/ai-training-plan.md 참고). id는 GaitGroundTruth.id와 같다.
 */
export interface GaitVerifiableItemDef {
  id: string
  label: string
  unit: string
  /** 이 항목의 AI 추정값을 GaitMetrics에서 뽑아낸다(값이 없으면 null). */
  getAiValue: (metrics: GaitMetrics) => number | null
}

export const GAIT_VERIFIABLE_ITEMS: GaitVerifiableItemDef[] = [
  {
    id: 'cadence',
    label: '케이던스(분당 걸음 수)',
    unit: '걸음/분',
    getAiValue: (m) => m.cadenceStepsPerMin,
  },
  {
    id: 'temporalSymmetry',
    label: '좌우 걸음 간격 대칭성',
    unit: '%',
    getAiValue: (m) => m.temporalSymmetryPercent,
  },
  {
    id: 'stepLengthSymmetry',
    label: '좌우 보폭 대칭성',
    unit: '%',
    getAiValue: (m) => m.stepLengthSymmetryPercent,
  },
  {
    id: 'fallRiskScore',
    label: '전도(낙상) 위험 점수',
    unit: '점(0~100)',
    getAiValue: (m) => m.fallRisk.score,
  },
]
