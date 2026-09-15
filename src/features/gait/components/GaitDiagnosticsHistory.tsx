import { useEffect, useRef, useState } from 'react'
import type { GaitDiagnosticRecord, GaitGroundTruth } from '../types'
import { deleteGaitDiagnostic, listGaitDiagnostics, updateGaitDiagnosticGroundTruth } from '../lib/gaitDiagnosticsApi'
import { AuthError } from '../../../shared/lib/authApi'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../../shared/components/PrintReportHeader'
import { ComparisonBarChart } from '../../../shared/components/ComparisonBarChart'
import { GaitMetricsPanel } from './GaitMetricsPanel'
import { GaitGroundTruthPanel } from './GaitGroundTruthPanel'
import { StepIntervalChart } from './GaitCharts'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  refreshKey: number
  token: string
  onAuthError: () => void
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

function RecordDetail({
  record,
  onGroundTruthChange,
}: {
  record: GaitDiagnosticRecord
  onGroundTruthChange?: (id: string, value: number | null) => void
}) {
  const printRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rom-history-detail" ref={printRef}>
      <PrintReportHeader
        title="보행분석 진단 기록"
        clientName={record.clientName ?? undefined}
        trainerName={record.trainerName}
        subtitle={record.videoName}
        date={record.createdAt}
      />
      <PdfExportButton
        targetRef={printRef}
        fileName={`보행진단_${record.clientName || record.videoName}`}
      />
      {!record.gaitMetrics && (
        <p className="app-subtitle no-print">
          ℹ️ 이 기록은 예전 버전에서 저장되어 그래프 데이터가 없습니다(요약 정보만 있음). 이 업데이트
          이후 새로 분석하는 기록부터는 아래 그래프가 PDF 2페이지로 함께 포함됩니다.
        </p>
      )}
      <p className="app-subtitle">{record.deviceInfo}</p>
      <ul className="debug-stats-list">
        <li>
          영상 해상도: {record.videoWidth}×{record.videoHeight} · 길이 {record.durationSec.toFixed(1)}초
        </li>
        <li>
          시도한 프레임: {record.attemptedFrames}개 · 사람 미검출: {record.noPoseFrames}개 · 신뢰도 부족으로
          제외: {record.droppedFrames}개 · 최종 채택: {record.keptFrames}개
        </li>
        <li>
          평균 신뢰도 — 골반 {pct(record.avgHipScore)} · 왼쪽 발목 {pct(record.avgLeftAnkleScore)} · 오른쪽
          발목 {pct(record.avgRightAnkleScore)} · 왼쪽 뒤꿈치 {pct(record.avgLeftHeelScore)} · 오른쪽
          뒤꿈치 {pct(record.avgRightHeelScore)}
        </li>
        <li>
          샘플링 시간 체크섬: {record.sampledTimesChecksum} — 같은 영상을 여러 번 분석했을 때 이 값이
          매번 같다면 프레임 선택은 안정적이라는 뜻입니다.
        </li>
        <li>
          감지된 걸음: {record.totalSteps}개 · 케이던스 {record.cadenceStepsPerMin.toFixed(0)} 걸음/분
        </li>
        {record.calcVersion && (
          <li>계산 버전: {record.calcVersion}</li>
        )}
      </ul>

      {record.gaitMetrics && (
        // `gait-diagnostic-page2`는 App.css의 @media print 규칙으로 인쇄 시 항상 새
        // 페이지에서 시작하도록 강제한다 — "방금 분석한 결과" 화면과 같은 통계/그래프를
        // 이 진단 기록 PDF의 2페이지로 넣어달라는 요청에 따른 것.
        <div className="gait-diagnostic-page2">
          <h3 className="gait-diagnostic-page2-title">분석 당시 상세 결과</h3>
          <GaitMetricsPanel metrics={record.gaitMetrics} />
          {record.gaitMetrics.totalSteps >= 2 && (
            <>
              <StepIntervalChart series={record.gaitMetrics.stepIntervalSeries} />
              <div className="chart-row">
                <ComparisonBarChart
                  title="좌우 걸음 간격 비교"
                  leftValue={record.gaitMetrics.leftMeanStepIntervalSec * 1000}
                  rightValue={record.gaitMetrics.rightMeanStepIntervalSec * 1000}
                  format={(v) => `${v.toFixed(0)}ms`}
                />
                <ComparisonBarChart
                  title="좌우 보폭 비교 (상대 단위)"
                  leftValue={record.gaitMetrics.leftMeanStepLengthNorm}
                  rightValue={record.gaitMetrics.rightMeanStepLengthNorm}
                  format={(v) => v.toFixed(2)}
                />
              </div>
            </>
          )}

          <GaitGroundTruthPanel
            metrics={record.gaitMetrics}
            groundTruth={record.groundTruth ?? undefined}
            onGroundTruthChange={onGroundTruthChange}
          />
        </div>
      )}
    </div>
  )
}

export function GaitDiagnosticsHistory({ refreshKey, token, onAuthError }: Props) {
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState<GaitDiagnosticRecord[]>([])
  const [detail, setDetail] = useState<GaitDiagnosticRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const groundTruthSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      listGaitDiagnostics(token, search)
        .then(setRecords)
        .catch((err) => {
          if (err instanceof AuthError) {
            onAuthError()
            return
          }
          setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.')
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search, refreshKey, token, onAuthError])

  /**
   * 저장된 진단 기록을 다시 열어서도 트레이너 실측값을 입력할 수 있게 한다 — 분석
   * 당일이 아니라 시간을 두고 관찰한 뒤 값을 채워 넣는 경우가 많기 때문이다(GaitApp의
   * 분석 직후 화면에서도 같은 값을 입력할 수 있고, 두 화면 모두 같은 서버 레코드를
   * 갱신한다).
   */
  const handleGroundTruthChange = (id: string, value: number | null) => {
    setDetail((prev) => {
      if (!prev) return prev
      const prevGroundTruth = prev.groundTruth ?? []
      const idx = prevGroundTruth.findIndex((g) => g.id === id)
      const nextGroundTruth: GaitGroundTruth[] =
        idx === -1
          ? [...prevGroundTruth, { id, verifiedValue: value }]
          : prevGroundTruth.map((g, i) => (i === idx ? { ...g, verifiedValue: value } : g))

      if (groundTruthSaveTimerRef.current !== null) window.clearTimeout(groundTruthSaveTimerRef.current)
      groundTruthSaveTimerRef.current = window.setTimeout(() => {
        updateGaitDiagnosticGroundTruth(token, prev.id, nextGroundTruth).catch((err) => {
          if (err instanceof AuthError) {
            onAuthError()
            return
          }
          console.error('[GaitDiagnosticsHistory] 트레이너 실측값 저장 실패', err)
        })
      }, 500)

      return { ...prev, groundTruth: nextGroundTruth }
    })
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 진단 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteGaitDiagnostic(token, id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      setDetail((prev) => (prev?.id === id ? null : prev))
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다.')
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === records.length ? new Set() : new Set(records.map((r) => r.id))))
  }

  /** RomSessionHistory와 같은 방식 — 새 벌크 삭제 API 없이 기존 단건 삭제를 선택된
   * 개수만큼 순차 호출한다. */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 진단 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of selectedIds) {
      try {
        await deleteGaitDiagnostic(token, id)
        deletedIds.add(id)
      } catch (err) {
        if (err instanceof AuthError) authFailed = true
        // 실패한 항목은 아래에서 선택 상태로 남긴다.
      }
    }
    setRecords((prev) => prev.filter((r) => !deletedIds.has(r.id)))
    setDetail((prev) => (prev && deletedIds.has(prev.id) ? null : prev))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      deletedIds.forEach((id) => next.delete(id))
      return next
    })
    setBulkDeleting(false)
    if (authFailed) {
      onAuthError()
      return
    }
    const failedCount = selectedIds.size - deletedIds.size
    if (failedCount > 0) setError(`${failedCount}개 항목 삭제에 실패했습니다.`)
  }

  return (
    <div className="rom-history">
      <h3>보행분석 진단 기록</h3>
      <input
        type="text"
        className="gait-diagnostics-search"
        placeholder="파일명 · 회원 · 트레이너 · 기기 정보로 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className="error-panel">{error}</p>}
      {!error && records.length === 0 && (
        <p className="rom-history-empty">
          {search.trim() ? '검색 결과가 없습니다.' : '저장된 진단 기록이 없습니다.'}
        </p>
      )}

      {records.length > 0 && (
        <>
          <BulkSelectionBar
            totalCount={records.length}
            selectedCount={selectedIds.size}
            onToggleAll={toggleSelectAll}
            onDeleteSelected={handleBulkDelete}
            deleting={bulkDeleting}
          />
          <ul className="rom-history-list">
            {records.map((r) => (
              <li key={r.id} className="rom-history-row">
                <input
                  type="checkbox"
                  className="rom-history-row-checkbox"
                  aria-label="선택"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
                <button type="button" className="rom-history-row-main" onClick={() => setDetail(r)}>
                  {new Date(r.createdAt).toLocaleString('ko-KR')} · {r.videoName}
                  {r.clientName && ` · ${r.clientName}`}
                  <span className="rom-history-delta">
                    {' '}
                    · 채택 {r.keptFrames}/{r.attemptedFrames}프레임 · 걸음 {r.totalSteps}개
                  </span>
                </button>
                <button type="button" className="rom-history-delete" onClick={() => handleDelete(r.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {detail && <RecordDetail record={detail} onGroundTruthChange={handleGroundTruthChange} />}
    </div>
  )
}
