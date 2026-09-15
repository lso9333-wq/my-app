import { useRef } from 'react'
import type { EegHandFootContext, HandJointGroundTruth, HandJointResult } from '../types'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../../shared/components/PrintReportHeader'
import { EegContextPanel } from './EegContextPanel'

interface Props {
  leftResults: HandJointResult[]
  rightResults: HandJointResult[]
  calcVersion?: string | null
  clientName?: string
  trainerName?: string | null
  videoName?: string
  createdAt?: string
  eegContext?: EegHandFootContext | null
  /** AI가 이미 계산한 관절 각도 옆에 트레이너가 실제 관찰·측정한 값을 적어두는
   * "정답값"(계산 로직/포즈 인식 파이프라인 검증용 — docs/ai-training-plan.md 참고).
   * id는 `${side}_${joint}` 형식이다(HandJointGroundTruth 주석 참고). */
  groundTruth?: HandJointGroundTruth[]
  /** 지정하면 실측값 입력 칸이 편집 가능해진다 — 분석 직후 화면과 저장된 기록 조회
   * 화면 양쪽 모두에서 입력받는다(ROM의 xmsk ground truth와 같은 이유). */
  onGroundTruthChange?: (id: string, value: number | null) => void
}

function fmtDeg(v: number | null): string {
  return v === null ? '데이터 부족' : `${v.toFixed(1)}°`
}

function fmtDelta(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}°`
}

function GroundTruthCell({
  id,
  groundTruth,
  onGroundTruthChange,
}: {
  id: string
  groundTruth: HandJointGroundTruth[]
  onGroundTruthChange?: (id: string, value: number | null) => void
}) {
  const entry = groundTruth.find((g) => g.id === id)
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
          placeholder="도"
          value={value ?? ''}
          onChange={(e) => onGroundTruthChange(id, parseInput(e.target.value))}
        />
      ) : (
        (value ?? '—')
      )}
    </td>
  )
}

function HandTable({
  title,
  side,
  results,
  groundTruth,
  onGroundTruthChange,
}: {
  title: string
  side: 'left' | 'right'
  results: HandJointResult[]
  groundTruth: HandJointGroundTruth[]
  onGroundTruthChange?: (id: string, value: number | null) => void
}) {
  const hasAny = results.some((r) => r.beforeRomDeg !== null || r.afterRomDeg !== null)
  return (
    <div className="rom-xmsk-region">
      <h5>{title}</h5>
      {!hasAny && <p className="rom-history-empty">이 손은 촬영 구간 동안 인식되지 않았습니다.</p>}
      {hasAny && (
        <table className="rom-table">
          <thead>
            <tr>
              <th>관절</th>
              <th>이전 가동범위</th>
              <th>이후 가동범위</th>
              <th>변화량</th>
              <th>트레이너 확인/보정</th>
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
                <GroundTruthCell
                  id={`${side}_${r.joint}`}
                  groundTruth={groundTruth}
                  onGroundTruthChange={onGroundTruthChange}
                />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function HandResultsPanel({
  leftResults,
  rightResults,
  calcVersion,
  clientName,
  trainerName,
  videoName,
  createdAt,
  eegContext,
  groundTruth = [],
  onGroundTruthChange,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rom-results" ref={printRef}>
      <PrintReportHeader
        title="손 관절 가동범위 분석 결과"
        clientName={clientName}
        trainerName={trainerName}
        subtitle={videoName}
        date={createdAt}
      />
      <PdfExportButton targetRef={printRef} fileName={`손분석_${clientName || videoName || '결과'}`} />

      <div className="rom-xmsk-estimates">
        <p className="app-subtitle">
          MediaPipe 손 랜드마크(21점)로 손가락 관절 각도 14개(검지·중지·약지·소지 각 3관절 + 엄지 2관절)의
          "이전"/"이후" 구간 가동범위를 계산합니다.
        </p>
        <p className="app-subtitle">
          아래 "트레이너 확인/보정" 칸에 실제로 관찰·측정한 각도를 입력해두면, 나중에 이 포즈 인식 계산이 실제와
          얼마나 차이 나는지 확인하는 데 쓰입니다(입력하지 않아도 결과 이용에는 지장이 없습니다). 발가락 마디별
          시뮬레이션과 달리 손가락 관절은 이미 실제 랜드마크로 직접 계산한 값이므로, 이 입력은 "잘못된 값을 대신
          채우는 시뮬레이션"이 아니라 그 계산이 실제와 맞는지 검증하는 실측값입니다.
        </p>
        <HandTable
          title="왼손"
          side="left"
          results={leftResults}
          groundTruth={groundTruth}
          onGroundTruthChange={onGroundTruthChange}
        />
        <HandTable
          title="오른손"
          side="right"
          results={rightResults}
          groundTruth={groundTruth}
          onGroundTruthChange={onGroundTruthChange}
        />
        {calcVersion && (
          <details className="rom-xmsk-methodology">
            <summary>계산 방식 참고</summary>
            <ul className="debug-stats-list">
              <li>계산 버전: {calcVersion}</li>
              <li>
                좌/우 손 구분은 모델의 손 판정(handedness) 결과를 그대로 쓰므로, 촬영 방향(전면/후면 카메라)에 따라
                반대로 표시될 수 있습니다.
              </li>
            </ul>
          </details>
        )}
      </div>

      <EegContextPanel eegContext={eegContext} />
    </div>
  )
}
