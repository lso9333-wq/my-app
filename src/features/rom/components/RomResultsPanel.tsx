import { useRef } from 'react'
import type { RomJointResult, RomXmskEstimateResult, RomXmskGroundTruth, RomXmskManualInput } from '../types'
import { ComparisonBarChart } from '../../../shared/components/ComparisonBarChart'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../../shared/components/PrintReportHeader'
import { groupEstimatesByRegion, XMSK_MANUAL_ITEMS } from '../lib/xmskEstimates'

interface Props {
  results: RomJointResult[]
  /** XMSK 통증 레시피 연동 추정 항목 (선택 — 과거 저장 기록에는 없을 수 있음) */
  xmskEstimates?: RomXmskEstimateResult[]
  /** 영상으로 측정할 수 없어 트레이너가 직접 입력하는 항목(예: 손목 저항 검사) */
  manualInputs?: RomXmskManualInput[]
  /** 지정하면 수기 입력 칸이 편집 가능해진다(분석 직후 화면). 지정하지 않으면(저장 기록
   * 조회 화면) 읽기 전용으로 표시된다. */
  onManualInputChange?: (id: string, phase: 'before' | 'after', value: number | null) => void
  /** AI가 이미 추정한 항목 옆에 트레이너가 실제 관찰·측정한 값을 적어두는 "정답값"
   * (계산 로직 개선용 학습 데이터 — docs/ai-training-plan.md 참고). */
  groundTruth?: RomXmskGroundTruth[]
  /** 지정하면 실측값 입력 칸이 편집 가능해진다 — 수기 입력과 달리 분석 직후 화면과
   * 저장된 기록 조회 화면 양쪽에서 모두 입력받는다(트레이너가 실제로 관찰할 시간이
   * 필요해, 분석 당일이 아니라 나중에 기록을 다시 열어 입력하는 경우가 많기 때문). */
  onGroundTruthChange?: (estimateId: string, value: number | null) => void
  /** 이 결과를 계산한 코드 버전(ANALYSIS_PIPELINE_VERSION) — 방법론 안내 영역에
   * 작게 표시해, 나중에 이 기록의 트레이너 실측값을 다른 버전 데이터와 섞지 않고
   * 구분할 수 있게 한다. 이 컬럼이 생기기 전 기록은 null/undefined. */
  calcVersion?: string | null
  /** 헤더 표시 및 PDF 내보내기 파일명에 쓰는 부가 정보 (모두 선택) */
  clientName?: string
  trainerName?: string | null
  videoName?: string
  /** 저장된 기록을 볼 때의 저장 시각. 없으면 지금 시각(방금 분석한 결과)으로 표시한다. */
  createdAt?: string
}

function fmtDeg(v: number | null): string {
  return v === null ? '데이터 부족' : `${v.toFixed(1)}°`
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}°`
}

function fmtEstimate(v: number | null, unit: string): string {
  if (v === null) return '데이터 부족'
  const digits = unit.startsWith('점') || unit.startsWith('상대') ? 2 : 1
  return `${v.toFixed(digits)}${unit.startsWith('도') ? '°' : ''}`
}

function fmtEstimateDelta(v: number | null, unit: string): string {
  if (v === null) return '—'
  const digits = unit.startsWith('점') || unit.startsWith('상대') ? 2 : 1
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}${unit.startsWith('도') ? '°' : ''}`
}

const EVIDENCE_LABEL: Record<RomXmskEstimateResult['evidence'], string> = {
  approximate: '근거 있음(근사)',
  experimental: '실험적 추정',
}

function ManualInputRow({
  id,
  label,
  unit,
  manualInputs,
  onManualInputChange,
}: {
  id: string
  label: string
  unit: string
  manualInputs: RomXmskManualInput[]
  onManualInputChange?: (id: string, phase: 'before' | 'after', value: number | null) => void
}) {
  const entry = manualInputs.find((m) => m.id === id)
  const before = entry?.beforeValue ?? null
  const after = entry?.afterValue ?? null
  const delta = before !== null && after !== null ? after - before : null

  const parseInput = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null
  }

  return (
    <tr>
      <td>
        {label}
        <span className="rom-xmsk-unit"> ({unit})</span>
      </td>
      <td>
        {onManualInputChange ? (
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            className="rom-xmsk-manual-input"
            value={before ?? ''}
            onChange={(e) => onManualInputChange(id, 'before', parseInput(e.target.value))}
          />
        ) : (
          (before ?? '데이터 없음')
        )}
      </td>
      <td>
        {onManualInputChange ? (
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            className="rom-xmsk-manual-input"
            value={after ?? ''}
            onChange={(e) => onManualInputChange(id, 'after', parseInput(e.target.value))}
          />
        ) : (
          (after ?? '데이터 없음')
        )}
      </td>
      <td className={delta !== null && delta > 0 ? 'rom-delta-positive' : ''}>
        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
      </td>
      <td>
        <span className="rom-xmsk-evidence rom-xmsk-evidence-manual">수기 입력</span>
      </td>
      <td>—</td>
    </tr>
  )
}

function GroundTruthCell({
  estimateId,
  unit,
  groundTruth,
  onGroundTruthChange,
}: {
  estimateId: string
  unit: string
  groundTruth: RomXmskGroundTruth[]
  onGroundTruthChange?: (estimateId: string, value: number | null) => void
}) {
  const entry = groundTruth.find((g) => g.estimateId === estimateId)
  const value = entry?.verifiedValue ?? null

  const parseInput = (raw: string): number | null => {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  return (
    <td>
      {onGroundTruthChange ? (
        <input
          type="number"
          step="0.1"
          className="rom-xmsk-groundtruth-input"
          placeholder={unit}
          value={value ?? ''}
          onChange={(e) => onGroundTruthChange(estimateId, parseInput(e.target.value))}
        />
      ) : (
        (value ?? '—')
      )}
    </td>
  )
}

export function RomResultsPanel({
  results,
  xmskEstimates = [],
  manualInputs = [],
  onManualInputChange,
  groundTruth = [],
  onGroundTruthChange,
  calcVersion,
  clientName,
  trainerName,
  videoName,
  createdAt,
}: Props) {
  const regionGroups = groupEstimatesByRegion(xmskEstimates)
  const printRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rom-results" ref={printRef}>
      <PrintReportHeader
        title="스트레칭 ROM 분석 결과"
        clientName={clientName}
        trainerName={trainerName}
        subtitle={videoName}
        date={createdAt}
      />
      <PdfExportButton targetRef={printRef} fileName={`ROM분석_${clientName || videoName || '결과'}`} />

      <table className="rom-table">
        <thead>
          <tr>
            <th>관절</th>
            <th>0.5 상태체크 ROM</th>
            <th>3. 마무리 ROM</th>
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

      {xmskEstimates.length > 0 && (
        <div className="rom-xmsk-estimates">
          <h4>XMSK 통증 레시피 연동 추정 항목</h4>
          <p className="app-subtitle">
            같은 영상에서 XMSK 통증 레시피 8개 부위의 "0.5 상태체크"/"3. 마무리" 입력 항목에
            해당하는 값을 영상 분석으로 추정해봤습니다. 수기 측정을 대신할 수 있는 정확한
            값이 아니라, 참고용 보조 지표입니다.
          </p>
          <p className="app-subtitle">
            아래 "트레이너 실측값" 칸에 실제로 관찰·측정한 값을 입력해두면, AI 추정이 실제와
            얼마나 차이 나는지 나중에 확인해 계산 방식을 개선하는 데 쓰입니다(입력하지 않아도
            결과 이용에는 지장이 없습니다).
          </p>

          {regionGroups.map((group) => (
            <div key={group.key} className="rom-xmsk-region">
              <h5>{group.title}</h5>

              {(group.rows.length > 0 || group.manualIds.length > 0) && (
                <table className="rom-table rom-xmsk-table">
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th>0.5 상태체크</th>
                      <th>3. 마무리</th>
                      <th>변화</th>
                      <th>근거 수준</th>
                      <th>트레이너 실측값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.label}
                          <span className="rom-xmsk-unit"> ({e.unit})</span>
                        </td>
                        <td>{fmtEstimate(e.beforeValue, e.unit)}</td>
                        <td>{fmtEstimate(e.afterValue, e.unit)}</td>
                        <td className={e.deltaValue !== null && e.deltaValue > 0 ? 'rom-delta-positive' : ''}>
                          {fmtEstimateDelta(e.deltaValue, e.unit)}
                        </td>
                        <td>
                          <span className={`rom-xmsk-evidence rom-xmsk-evidence-${e.evidence}`}>
                            {EVIDENCE_LABEL[e.evidence]}
                          </span>
                        </td>
                        <GroundTruthCell
                          estimateId={e.id}
                          unit={e.unit}
                          groundTruth={groundTruth}
                          onGroundTruthChange={onGroundTruthChange}
                        />
                      </tr>
                    ))}
                    {group.manualIds.map((id) => {
                      const def = XMSK_MANUAL_ITEMS.find((m) => m.id === id)
                      if (!def) return null
                      return (
                        <ManualInputRow
                          key={id}
                          id={id}
                          label={def.label}
                          unit={def.unit}
                          manualInputs={manualInputs}
                          onManualInputChange={onManualInputChange}
                        />
                      )
                    })}
                  </tbody>
                </table>
              )}

              {group.coveredNotes.length > 0 && (
                <ul className="rom-xmsk-covered-notes">
                  {group.coveredNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              {group.manualNote && <p className="rom-xmsk-manual-note">{group.manualNote}</p>}
            </div>
          ))}

          <details className="rom-xmsk-methodology">
            <summary>이 항목들의 계산 방식과 한계 (참고문헌 포함)</summary>
            <ul className="debug-stats-list">
              {xmskEstimates.map((e) => (
                <li key={e.id}>
                  <strong>{e.label}</strong>: {e.note}
                </li>
              ))}
              {calcVersion && (
                <li>
                  <strong>계산 버전</strong>: {calcVersion}
                </li>
              )}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
