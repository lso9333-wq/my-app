import { computeEegInterpretation } from '../../../shared/lib/eeg/eegInterpretation'
import type { EegHandFootContext } from '../types'

interface Props {
  eegContext?: EegHandFootContext | null
}

function fmtValue(v: number | null): string {
  return v === null ? '데이터 없음' : v.toFixed(3)
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(3)}`
}

const DIRECTION_LABEL: Record<'up' | 'down' | 'flat', string> = {
  up: '▲ 증가',
  down: '▼ 감소',
  flat: '— 뚜렷한 변화 없음',
}

/**
 * 손·발 분석 결과에 곁들이는 "동시 측정 뇌파 참고 지표" 표 — 계산 자체는
 * shared/lib/eeg/eegInterpretation.ts의 computeEegInterpretation()이 전담하고, 이 컴포넌트는
 * 그 결과를 ROM의 XMSK 추정 항목(rom-xmsk-table, evidence 배지, methodology <details>)과
 * 같은 스타일로만 표시한다. baseline/during 둘 다 없으면(=Muse를 연결하지 않았거나 아직
 * 캡처하지 않은 세션) 아무것도 렌더링하지 않는다 — PDF 인쇄본에도 그대로 반영된다(부모의
 * printRef로 감싸인 영역 안에 이미 포함돼 있으므로).
 */
export function EegContextPanel({ eegContext }: Props) {
  if (!eegContext || (!eegContext.baseline && !eegContext.during)) return null

  const rows = computeEegInterpretation(eegContext)

  return (
    <div className="rom-xmsk-estimates">
      <h5>동시 측정 뇌파 참고 지표{eegContext.deviceName ? ` (${eegContext.deviceName})` : ''}</h5>
      <p className="app-subtitle">
        Muse 뇌파 헤드밴드로 분석 전(① 안정)/분석 직후(② 활동) 두 시점을 측정해 그 사이의 변화를 참고용으로
        기록한 것입니다. 손·발 관절 가동범위 계산 자체와는 별개이며, "어느 손/발이 더 잘 움직였는지"를 해석하지
        않습니다 — 아래 방법론 참고.
      </p>

      <table className="rom-table rom-xmsk-table">
        <thead>
          <tr>
            <th>지표</th>
            <th>① 안정</th>
            <th>② 활동</th>
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
              <td>{fmtValue(row.duringValue)}</td>
              <td className={row.deltaValue !== null && row.deltaValue > 0 ? 'rom-delta-positive' : ''}>
                {fmtDelta(row.deltaValue)}
                {row.direction && <span className="rom-xmsk-unit"> {DIRECTION_LABEL[row.direction]}</span>}
              </td>
              <td>
                <span className="rom-xmsk-evidence rom-xmsk-evidence-experimental">실험적 참고 지표</span>
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
          <li>
            Muse의 전극 위치(TP9·AF7·AF8·TP10)로는 "어느 손/발이 더 잘 움직였는가" 자체를 EEG로 구분할 수 없다는
            것이 최근 연구로 확인돼(전운동/보조운동 영역 전극이 필요 — Frontiers in Neuroscience 2020;
            Frontiers in Human Neuroscience 2026), 이 표는 그런 판정을 절대 하지 않으며 손·발 결과를 읽을 때의
            정서적·신체적 각성 상태 참고 정보로만 제공됩니다.
          </li>
        </ul>
      </details>
    </div>
  )
}
