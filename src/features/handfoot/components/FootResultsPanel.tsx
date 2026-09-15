import { useRef } from 'react'
import type { EegHandFootContext, FootManualToeInput, FootToeEstimateResult } from '../types'
import { FOOT_MANUAL_TOE_ITEMS } from '../lib/handfootManualItems'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../../shared/components/PrintReportHeader'
import { EegContextPanel } from './EegContextPanel'

interface Props {
  toeEstimates: FootToeEstimateResult[]
  manualToeInputs?: FootManualToeInput[]
  /** 지정하면 수기 입력 칸이 편집 가능해진다(분석 직후 화면과 저장 기록 조회 화면 양쪽
   * 모두에서 편집 가능 — AI가 개별 발가락을 구분하지 못해 전부 수기 입력이므로, ROM의
   * wristResist 수기 입력과 달리 이 기능은 저장 기록 조회 화면에서도 계속 채워 넣는
   * 경우가 많을 것으로 보고 제한을 두지 않았다). */
  onManualToeInputChange?: (id: string, phase: 'before' | 'after', value: number | null) => void
  clientName?: string
  trainerName?: string | null
  videoName?: string
  createdAt?: string
  eegContext?: EegHandFootContext | null
}

function fmtEstimate(v: number | null, unit: string): string {
  return v === null ? '데이터 부족' : `${v.toFixed(1)}${unit.startsWith('도') ? '°' : ''}`
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}°`
}

/** 트레이너가 값을 고친 뒤, AI가 처음에 뭐라고 추정했었는지·그 차이가 얼마인지를 바로
 * 옆에서 보여준다 — estimatedBeforeValue/estimatedAfterValue가 영구 보존되기
 * 시작한 이후(2026-09)의 항목에서만 나타난다(handleManualToeInputChange가 이 두
 * 필드를 손대지 않기 때문). 나중에 이 보정 폭을 모아 TOE_SEGMENT_SIM_PARAMS를
 * 다시 맞추는 데 참고할 수 있다는 것이 이 필드를 넣어둔 목적이다(docs/ai-training-plan.md).
 * 값 자체는 어떤 계산에도 관여하지 않는 참고 문구일 뿐이다. */
function CorrectionHint({ current, estimated }: { current: number | null; estimated: number | null | undefined }) {
  if (current === null || estimated === null || estimated === undefined) return null
  const diff = current - estimated
  if (Math.abs(diff) < 0.05) return <span className="rom-xmsk-unit"> (AI 추정과 동일)</span>
  const sign = diff > 0 ? '+' : ''
  return (
    <span className="rom-xmsk-unit">
      {' '}
      (AI: {estimated.toFixed(1)}, {sign}
      {diff.toFixed(1)})
    </span>
  )
}

function SourceBadge({ source }: { source: FootManualToeInput['source'] }) {
  if (source === 'trainer') {
    return <span className="rom-xmsk-evidence rom-xmsk-evidence-approximate">트레이너 확인</span>
  }
  if (source === 'estimated') {
    return <span className="rom-xmsk-evidence rom-xmsk-evidence-experimental">AI 시뮬레이션(미확인)</span>
  }
  return <span className="rom-xmsk-evidence">수기 입력</span>
}

function ManualToeRow({
  id,
  label,
  manualToeInputs,
  onManualToeInputChange,
}: {
  id: string
  label: string
  manualToeInputs: FootManualToeInput[]
  onManualToeInputChange?: (id: string, phase: 'before' | 'after', value: number | null) => void
}) {
  const entry = manualToeInputs.find((m) => m.id === id)
  const before = entry?.beforeValue ?? null
  const after = entry?.afterValue ?? null
  const delta = before !== null && after !== null ? after - before : null

  const parseInput = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  return (
    <tr>
      <td>{label}</td>
      <td>
        {onManualToeInputChange ? (
          <input
            type="number"
            step="0.1"
            className="rom-xmsk-manual-input"
            value={before ?? ''}
            onChange={(e) => onManualToeInputChange(id, 'before', parseInput(e.target.value))}
          />
        ) : (
          (before ?? '데이터 없음')
        )}
        {entry?.source === 'trainer' && <CorrectionHint current={before} estimated={entry.estimatedBeforeValue} />}
      </td>
      <td>
        {onManualToeInputChange ? (
          <input
            type="number"
            step="0.1"
            className="rom-xmsk-manual-input"
            value={after ?? ''}
            onChange={(e) => onManualToeInputChange(id, 'after', parseInput(e.target.value))}
          />
        ) : (
          (after ?? '데이터 없음')
        )}
        {entry?.source === 'trainer' && <CorrectionHint current={after} estimated={entry.estimatedAfterValue} />}
      </td>
      <td className={delta !== null && delta > 0 ? 'rom-delta-positive' : ''}>
        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
      </td>
      <td>
        <SourceBadge source={entry?.source} />
      </td>
    </tr>
  )
}

export function FootResultsPanel({
  toeEstimates,
  manualToeInputs = [],
  onManualToeInputChange,
  clientName,
  trainerName,
  videoName,
  createdAt,
  eegContext,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const leftItems = FOOT_MANUAL_TOE_ITEMS.filter((i) => i.id.endsWith('_left'))
  const rightItems = FOOT_MANUAL_TOE_ITEMS.filter((i) => i.id.endsWith('_right'))

  return (
    <div className="rom-results" ref={printRef}>
      <PrintReportHeader
        title="발·발가락 분석 결과"
        clientName={clientName}
        trainerName={trainerName}
        subtitle={videoName}
        date={createdAt}
      />
      <PdfExportButton targetRef={printRef} fileName={`발분석_${clientName || videoName || '결과'}`} />

      <div className="rom-xmsk-estimates">
        <p className="app-subtitle">
          카메라로는 발가락 하나하나의 관절을 구분해 인식하는 검증된 모델이 없어, AI는 발 전체를 대표하는 실험적
          근사치 하나만 계산합니다. 발가락 10마디(발 한쪽 기준, 엄지~새끼 각 MTP·IP)는 이 실험적 근사치를 연구
          기반 결합계수로 배분한 "AI 시뮬레이션" 초기값이 자동으로 채워지며, 트레이너가 직접 관찰·측정해 확인하거나
          수정할 수 있습니다 — "값 출처" 열에서 아직 미확인 시뮬레이션인지, 트레이너가 확인/수정했는지 구분됩니다.
        </p>

        <table className="rom-table rom-xmsk-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>이전</th>
              <th>이후</th>
              <th>변화</th>
              <th>근거 수준</th>
            </tr>
          </thead>
          <tbody>
            {toeEstimates.map((e) => (
              <tr key={e.side}>
                <td>
                  {e.label}
                  <span className="rom-xmsk-unit"> ({e.unit})</span>
                </td>
                <td>{fmtEstimate(e.beforeValue, e.unit)}</td>
                <td>{fmtEstimate(e.afterValue, e.unit)}</td>
                <td className={e.deltaValue !== null && e.deltaValue > 0 ? 'rom-delta-positive' : ''}>
                  {fmtDelta(e.deltaValue)}
                </td>
                <td>
                  <span className="rom-xmsk-evidence rom-xmsk-evidence-experimental">실험적 추정</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {toeEstimates[0] && <p className="rom-xmsk-manual-note">{toeEstimates[0].note}</p>}
        <p className="rom-xmsk-manual-note">
          ⚠️ 발가락 마디별 값은 실제 관절 랜드마크를 인식한 값이 아니라, 위 발 전체 실험적 근사치를 연구 근거(엄지가
          발목 움직임과 가장 강하게 연동된다는 연구, 2~5번 발가락이 더 제한적으로 서로 묶여 움직인다는 연구 등 —
          자세한 근거는 CLAUDE.md 및 footToeEstimate.ts 주석 참고)에 따라 부위별 비율로 나눈 시뮬레이션입니다. 실제
          측정값과 다를 수 있으니 트레이너가 확인 후 필요하면 직접 수정해 주세요.
        </p>

        <h5>왼발 발가락 (AI 시뮬레이션 + 트레이너 확인/수정)</h5>
        <table className="rom-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>이전</th>
              <th>이후</th>
              <th>변화</th>
              <th>값 출처</th>
            </tr>
          </thead>
          <tbody>
            {leftItems.map((item) => (
              <ManualToeRow
                key={item.id}
                id={item.id}
                label={item.label}
                manualToeInputs={manualToeInputs}
                onManualToeInputChange={onManualToeInputChange}
              />
            ))}
          </tbody>
        </table>

        <h5>오른발 발가락 (AI 시뮬레이션 + 트레이너 확인/수정)</h5>
        <table className="rom-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>이전</th>
              <th>이후</th>
              <th>변화</th>
              <th>값 출처</th>
            </tr>
          </thead>
          <tbody>
            {rightItems.map((item) => (
              <ManualToeRow
                key={item.id}
                id={item.id}
                label={item.label}
                manualToeInputs={manualToeInputs}
                onManualToeInputChange={onManualToeInputChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      <EegContextPanel eegContext={eegContext} />
    </div>
  )
}
