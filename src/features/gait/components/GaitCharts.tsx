import { useState } from 'react'
import type { GaitMetrics } from '../types'
import { niceMax } from '../../../shared/lib/chartUtils'

const CHART_W = 640
const CHART_H = 200
const PAD = { top: 16, right: 12, bottom: 24, left: 40 }

interface StepIntervalChartProps {
  series: GaitMetrics['stepIntervalSeries']
}

export function StepIntervalChart({ series }: StepIntervalChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  if (series.length === 0) return null

  const innerW = CHART_W - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom
  const values = series.map((s) => s.intervalSec * 1000)
  const maxVal = niceMax(Math.max(...values) * 1.15)
  const gap = 2
  const barW = Math.max(2, Math.min(24, innerW / series.length - gap))
  const slotW = innerW / series.length

  const yTicks = [0, maxVal / 2, maxVal]

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>걸음 간격 추이</h3>
        <div className="legend">
          <span className="legend-item">
            <i className="legend-dot" style={{ background: 'var(--series-left)' }} /> 왼발
          </span>
          <span className="legend-item">
            <i className="legend-dot" style={{ background: 'var(--series-right)' }} /> 오른발
          </span>
        </div>
      </div>
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="chart-svg" role="img" aria-label="걸음 간격 추이 막대그래프">
          {yTicks.map((t) => {
            const y = PAD.top + innerH - (t / maxVal) * innerH
            return (
              <g key={t}>
                <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} className="chart-grid" />
                <text x={PAD.left - 8} y={y} className="chart-axis-label" textAnchor="end" dominantBaseline="middle">
                  {Math.round(t)}
                </text>
              </g>
            )
          })}
          {series.map((s, i) => {
            const h = (s.intervalSec * 1000 / maxVal) * innerH
            const x = PAD.left + i * slotW + (slotW - barW) / 2
            const y = PAD.top + innerH - h
            const color = s.foot === 'left' ? 'var(--series-left)' : 'var(--series-right)'
            return (
              <rect
                key={s.index}
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 1)}
                rx={2}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {s.index}번째 걸음 ({s.foot === 'left' ? '왼발' : '오른발'}) · {(s.intervalSec * 1000).toFixed(0)}ms
                </title>
              </rect>
            )
          })}
          <line
            x1={PAD.left}
            x2={CHART_W - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
            className="chart-baseline"
          />
        </svg>
      </div>
      <button type="button" className="table-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? '표 숨기기' : '표로 보기'}
      </button>
      {showTable && (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                <th>#</th>
                <th>시각(초)</th>
                <th>발</th>
                <th>간격(ms)</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.index}>
                  <td>{s.index}</td>
                  <td>{s.time.toFixed(2)}</td>
                  <td>{s.foot === 'left' ? '왼발' : '오른발'}</td>
                  <td>{(s.intervalSec * 1000).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
