import { niceMax } from '../lib/chartUtils'

interface ComparisonChartProps {
  title: string
  leftValue: number
  rightValue: number
  format: (v: number) => string
  leftLabel?: string
  rightLabel?: string
}

/** 좌/우 또는 이전/이후 두 값을 비교하는 범용 막대그래프. 보행/ROM/XMSK에서 공유. */
export function ComparisonBarChart({
  title,
  leftValue,
  rightValue,
  format,
  leftLabel = '왼쪽',
  rightLabel = '오른쪽',
}: ComparisonChartProps) {
  const w = 280
  const h = 160
  const pad = { top: 12, right: 16, bottom: 28, left: 16 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const maxVal = niceMax(Math.max(leftValue, rightValue) * 1.2)
  const barW = 56
  const gap = 2
  const items = [
    { label: leftLabel, value: leftValue, color: 'var(--series-left)' },
    { label: rightLabel, value: rightValue, color: 'var(--series-right)' },
  ]
  const slotW = innerW / 2

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
      </div>
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" role="img" aria-label={title}>
          {items.map((item, i) => {
            const barH = maxVal > 0 ? (item.value / maxVal) * innerH : 0
            const x = pad.left + i * slotW + (slotW - barW) / 2
            const y = pad.top + innerH - barH
            return (
              <g key={item.label}>
                <rect x={x} y={y} width={barW - gap} height={Math.max(barH, 1)} rx={4} fill={item.color}>
                  <title>
                    {item.label}: {format(item.value)}
                  </title>
                </rect>
                <text x={x + (barW - gap) / 2} y={y - 6} textAnchor="middle" className="chart-value-label">
                  {format(item.value)}
                </text>
                <text
                  x={x + (barW - gap) / 2}
                  y={pad.top + innerH + 16}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {item.label}
                </text>
              </g>
            )
          })}
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={pad.top + innerH}
            y2={pad.top + innerH}
            className="chart-baseline"
          />
        </svg>
      </div>
    </div>
  )
}
