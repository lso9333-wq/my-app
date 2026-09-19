import { computeHeartRateInterpretation } from '../../../shared/lib/heartRate/heartRateInterpretation'
import { SAMSUNG_HEALTH_HRV_NOTE } from '../../../shared/lib/heartRate/samsungHealthImport'
import type { HeartRateWindowSummary, XctsMeasurementSource } from '../types'

interface Props {
  baseline: HeartRateWindowSummary | null
  post: HeartRateWindowSummary | null
  deviceName?: string | null
  deviceSource?: XctsMeasurementSource | null
}

function fmtValue(v: number | null, digits = 1): string {
  return v === null ? '데이터 없음' : v.toFixed(digits)
}

function fmtDelta(v: number | null, digits = 1): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}`
}

const DIRECTION_LABEL: Record<'up' | 'down' | 'flat', string> = {
  up: '▲ 증가',
  down: '▼ 감소',
  flat: '— 뚜렷한 변화 없음',
}

const EVIDENCE_LABEL: Record<'approximate' | 'experimental', string> = {
  approximate: '근거 있음(근사)',
  experimental: '실험적 추정',
}

/**
 * XCTS의 심박·HRV 결과표 — EegContextPanel.tsx와 같은 스타일(rom-xmsk-table, 근거
 * 수준 배지, methodology <details>)로 보여준다. baseline/post 둘 다 없으면(아직 아무
 * 것도 캡처하지 않은 세션) 아무것도 렌더링하지 않는다.
 */
export function XctsResultsPanel({ baseline, post, deviceName, deviceSource }: Props) {
  if (!baseline && !post) return null

  const rows = computeHeartRateInterpretation(baseline, post)
  const isSamsungHealthImport = deviceSource === 'samsung-health-export'
  const lowSampleWarning =
    !isSamsungHealthImport &&
    ((baseline && baseline.rrIntervalCount < 10) || (post && post.rrIntervalCount < 10))

  return (
    <div className="rom-xmsk-estimates">
      <h5>심박·HRV 측정 결과{deviceName ? ` (${deviceName})` : ''}</h5>
      <p className="app-subtitle">
        ① 안정 상태(활동 전)와 ② 활동 직후 두 시점을 각 60초씩 측정해 그 사이의 변화를 참고용으로 기록한 것입니다.
        의료적 진단이나 정식 심박변이도(HRV) 검사를 대체하지 않습니다 — 아래 방법론 참고.
      </p>
      {isSamsungHealthImport && (
        <p className="app-subtitle" style={{ color: '#b45309' }}>
          ⚠️ {SAMSUNG_HEALTH_HRV_NOTE}
        </p>
      )}
      {lowSampleWarning && (
        <p className="app-subtitle" style={{ color: '#b45309' }}>
          ⚠️ 한쪽 이상의 측정에서 RR간격 데이터가 10개 미만입니다 — 센서 접촉이 불안정했거나 캡처 중 움직임이 있었을
          수 있어, HRV(RMSSD) 값의 신뢰도가 낮을 수 있습니다.
        </p>
      )}

      <table className="rom-table rom-xmsk-table">
        <thead>
          <tr>
            <th>지표</th>
            <th>① 안정</th>
            <th>② 활동 직후</th>
            <th>변화</th>
            <th>근거 수준</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                {row.label}
                <span className="rom-xmsk-unit"> ({row.unit})</span>
              </td>
              <td>{fmtValue(row.baselineValue)}</td>
              <td>{fmtValue(row.postValue)}</td>
              <td className={row.deltaValue !== null && row.deltaValue > 0 ? 'rom-delta-positive' : ''}>
                {fmtDelta(row.deltaValue)}
                {row.direction && <span className="rom-xmsk-unit"> {DIRECTION_LABEL[row.direction]}</span>}
              </td>
              <td>
                <span className={`rom-xmsk-evidence rom-xmsk-evidence-${row.evidence}`}>
                  {EVIDENCE_LABEL[row.evidence]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="rom-xmsk-methodology">
        <summary>계산 방식·연구 근거 참고</summary>
        <ul className="debug-stats-list">
          {rows.map((row) => (
            <li key={row.key}>
              <strong>{row.label}:</strong> {row.note}
            </li>
          ))}
          {baseline && (
            <li>① 안정 측정: 샘플 {baseline.sampleCount}개, RR간격 {baseline.rrIntervalCount}개 수집.</li>
          )}
          {post && <li>② 활동 직후 측정: 샘플 {post.sampleCount}개, RR간격 {post.rrIntervalCount}개 수집.</li>}
          <li>
            표준 BLE 심박 서비스를 지원하는 가슴띠형 센서(Polar H10 등) 전제입니다 — 손목형 PPG 센서(대부분의
            스마트워치)는 움직임에 취약해 이런 방식으로 연결되지도 않고, 연결되더라도 신뢰도가 낮습니다(2026-09
            웨어러블 연동 검토, docs/wearable-biometric-integration-review.md 참고).
          </li>
        </ul>
      </details>
    </div>
  )
}
