import type { GaitGroundTruth, GaitMetrics } from '../types'
import { GAIT_VERIFIABLE_ITEMS } from '../lib/gaitGroundTruth'

interface Props {
  metrics: GaitMetrics
  groundTruth?: GaitGroundTruth[]
  /** 지정하면 입력 칸이 편집 가능해진다. 지정하지 않으면 읽기 전용으로 표시된다. */
  onGroundTruthChange?: (id: string, value: number | null) => void
}

function fmtAiValue(v: number | null, unit: string): string {
  if (v === null) return '데이터 부족'
  return `${v.toFixed(1)}${unit === '%' ? '%' : ''}`
}

/**
 * 보행 분석 지표(케이던스, 좌우 대칭성, 전도 위험 점수) 옆에 트레이너 실측값을 입력하는
 * 패널. ROM의 RomResultsPanel 안 "트레이너 실측값" 컬럼과 같은 목적으로, AI 추정 vs
 * 실제 관찰값을 짝지어 쌓아 나중에 계산 로직을 보정하는 데 쓴다
 * (docs/ai-training-plan.md 참고). 걸음 수가 적어 지표 자체가 없을 때는 표시하지 않는다.
 */
export function GaitGroundTruthPanel({ metrics, groundTruth = [], onGroundTruthChange }: Props) {
  if (metrics.totalSteps < 2) return null

  const parseInput = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="rom-xmsk-estimates gait-ground-truth-panel">
      <h4>트레이너 실측값 (참고용)</h4>
      <p className="app-subtitle">
        아래 항목에 실제로 관찰·측정한 값을 입력해두면, AI 추정이 실제와 얼마나 차이 나는지
        나중에 확인해 계산 방식을 개선하는 데 쓰입니다(입력하지 않아도 결과 이용에는 지장이
        없습니다).
      </p>
      <table className="rom-table rom-xmsk-table">
        <thead>
          <tr>
            <th>항목</th>
            <th>AI 추정값</th>
            <th>트레이너 실측값</th>
          </tr>
        </thead>
        <tbody>
          {GAIT_VERIFIABLE_ITEMS.map((item) => {
            const aiValue = item.getAiValue(metrics)
            const entry = groundTruth.find((g) => g.id === item.id)
            const value = entry?.verifiedValue ?? null
            return (
              <tr key={item.id}>
                <td>
                  {item.label}
                  <span className="rom-xmsk-unit"> ({item.unit})</span>
                </td>
                <td>{fmtAiValue(aiValue, item.unit)}</td>
                <td>
                  {onGroundTruthChange ? (
                    <input
                      type="number"
                      step="0.1"
                      className="rom-xmsk-groundtruth-input"
                      placeholder={item.unit}
                      value={value ?? ''}
                      onChange={(e) => onGroundTruthChange(item.id, parseInput(e.target.value))}
                    />
                  ) : (
                    (value ?? '—')
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
