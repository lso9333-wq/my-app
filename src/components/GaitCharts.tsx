import { useState } from 'react'
import type { GaitMetrics } from '../types/gait'

const CHART_W = 640
const CHART_H = 200
const PAD = { top: 16, right: 12, bottom: 24, left: 40 }

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const norm = value / magnitude
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * magnitude
}

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

interface ComparisonChartProps {
  title: string
  leftValue: number
  rightValue: number
  format: (v: number) => string
}

export function ComparisonBarChart({ title, leftValue, rightValue, format }: ComparisonChartProps) {
  const w = 280
  const h = 160
  const pad = { top: 12, right: 16, bottom: 28, left: 16 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const maxVal = niceMax(Math.max(leftValue, rightValue) * 1.2)
  const barW = 56
  const gap = 2
  const items = [
    { label: '왼쪽', value: leftValue, color: 'var(--series-left)' },
    { label: '오른쪽', value: rightValue, color: 'var(--series-right)' },
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
