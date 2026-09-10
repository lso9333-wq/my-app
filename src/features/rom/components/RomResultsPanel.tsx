import type { RomJointResult } from '../types'
import { ComparisonBarChart } from '../../../shared/components/ComparisonBarChart'

interface Props {
  results: RomJointResult[]
}

function fmtDeg(v: number | null): string {
  return v === null ? '데이터 부족' : `${v.toFixed(1)}°`
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}°`
}

export function RomResultsPanel({ results }: Props) {
  return (
    <div className="rom-results">
      <table className="rom-table">
        <thead>
          <tr>
            <th>관절</th>
            <th>이전 ROM</th>
            <th>이후 ROM</th>
            <th>변화량</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.joint}>
              <td>{r.label}</td>
              <td>{fmtDeg(r.beforeRomDeg)}</td>
              <td>{fmtDeg(r.afterRomDeg)}</td>
              <td className={r.deltaRomDeg !== null && r.deltaRomDeg > 0 ? 'rom-delta-positive' : ''}>
                {fmtDelta(r.deltaRomDeg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="chart-row rom-chart-row">
        {results
          .filter((r) => r.beforeRomDeg !== null && r.afterRomDeg !== null)
          .map((r) => (
            <ComparisonBarChart
              key={r.joint}
              title={r.label}
              leftValue={r.beforeRomDeg ?? 0}
              rightValue={r.afterRomDeg ?? 0}
              leftLabel="이전"
              rightLabel="이후"
              format={(v) => `${v.toFixed(0)}°`}
            />
          ))}
      </div>
    </div>
  )
}
