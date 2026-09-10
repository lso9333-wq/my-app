import type { GaitMetrics } from '../types'

interface Props {
  metrics: GaitMetrics
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function symmetryNote(percent: number): string {
  if (percent < 5) return '매우 대칭적'
  if (percent < 10) return '대체로 대칭적'
  if (percent < 20) return '경미한 비대칭'
  return '뚜렷한 비대칭'
}

export function GaitMetricsPanel({ metrics }: Props) {
  const {
    totalSteps,
    durationSec,
    cadenceStepsPerMin,
    stepIntervalCV,
    leftMeanStepIntervalSec,
    rightMeanStepIntervalSec,
    temporalSymmetryPercent,
    stepLengthSymmetryPercent,
  } = metrics

  if (totalSteps < 2) {
    return (
      <div className="metrics-empty">
        걸음을 충분히 감지하지 못했습니다. 인물이 화면에 온전히, 옆에서 걷는 모습으로 나오는
        영상으로 다시 시도해 보세요.
      </div>
    )
  }

  return (
    <div className="stat-grid">
      <StatTile
        label="케이던스"
        value={`${cadenceStepsPerMin.toFixed(0)} 걸음/분`}
        sub={`총 ${totalSteps}걸음 · ${durationSec.toFixed(1)}초`}
      />
      <StatTile
        label="평균 걸음 간격"
        value={`${(metrics.meanStepIntervalSec * 1000).toFixed(0)}ms`}
        sub={`변동성(CV) ${stepIntervalCV.toFixed(1)}%`}
      />
      <StatTile
        label="좌우 시간 대칭성"
        value={`${temporalSymmetryPercent.toFixed(1)}%`}
        sub={`${symmetryNote(temporalSymmetryPercent)} · 좌 ${(leftMeanStepIntervalSec * 1000).toFixed(0)}ms / 우 ${(rightMeanStepIntervalSec * 1000).toFixed(0)}ms`}
      />
      <StatTile
        label="좌우 보폭 대칭성"
        value={`${stepLengthSymmetryPercent.toFixed(1)}%`}
        sub={symmetryNote(stepLengthSymmetryPercent)}
      />
    </div>
  )
}
