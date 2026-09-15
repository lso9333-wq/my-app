import { useEffect, useRef, useState } from 'react'
import type { RomSessionDetail, RomSessionListItem, RomXmskGroundTruth } from '../types'
import { deleteRomSession, getRomSession, listRomSessions, updateRomSessionGroundTruth } from '../lib/romApi'
import { AuthError } from '../../../shared/lib/authApi'
import { RomResultsPanel } from './RomResultsPanel'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  refreshKey: number
  token: string
  onAuthError: () => void
}

export function RomSessionHistory({ refreshKey, token, onAuthError }: Props) {
  const [sessions, setSessions] = useState<RomSessionListItem[]>([])
  const [detail, setDetail] = useState<RomSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const groundTruthSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    listRomSessions(token)
      .then(setSessions)
      .catch((err) => {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.')
      })
  }, [refreshKey, token, onAuthError])

  const openDetail = async (id: number) => {
    try {
      setDetail(await getRomSession(token, id))
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  /**
   * 저장된 기록을 다시 열어서도 트레이너 실측값을 입력할 수 있게 한다 — 분석 당일이
   * 아니라 시간을 두고 관찰한 뒤 값을 채워 넣는 경우가 많기 때문이다(RomApp의 분석
   * 직후 화면에서도 같은 값을 입력할 수 있고, 두 화면 모두 같은 서버 레코드를 갱신한다).
   */
  const handleGroundTruthChange = (estimateId: string, value: number | null) => {
    setDetail((prev) => {
      if (!prev) return prev
      const idx = prev.xmskGroundTruth.findIndex((g) => g.estimateId === estimateId)
      const nextGroundTruth: RomXmskGroundTruth[] =
        idx === -1
          ? [...prev.xmskGroundTruth, { estimateId, verifiedValue: value }]
          : prev.xmskGroundTruth.map((g, i) => (i === idx ? { ...g, verifiedValue: value } : g))

      if (groundTruthSaveTimerRef.current !== null) window.clearTimeout(groundTruthSaveTimerRef.current)
      groundTruthSaveTimerRef.current = window.setTimeout(() => {
        updateRomSessionGroundTruth(token, prev.id, nextGroundTruth).catch((err) => {
          if (err instanceof AuthError) {
            onAuthError()
            return
          }
          console.error('[RomSessionHistory] 트레이너 실측값 저장 실패', err)
        })
      }, 500)

      return { ...prev, xmskGroundTruth: nextGroundTruth }
    })
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteRomSession(token, id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
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
    setSelectedIds((prev) => (prev.size === sessions.length ? new Set() : new Set(sessions.map((s) => s.id))))
  }

  /** 여러 기록을 한 번에 삭제 — 새 벌크 삭제 API를 추가하는 대신(개인용 앱 규모라 이
   * 정도 요청 수는 부담이 없다는 기존 전제), 이미 있는 단건 삭제(DELETE /:id)를
   * 선택된 개수만큼 순차 호출한다. 일부만 실패해도 성공한 것만 목록에서 지우고,
   * 실패한 항목은 선택 상태로 남겨 다시 시도할 수 있게 한다. */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of selectedIds) {
      try {
        await deleteRomSession(token, id)
        deletedIds.add(id)
      } catch (err) {
        if (err instanceof AuthError) authFailed = true
        // 실패한 항목은 아래에서 선택 상태로 남긴다.
      }
    }
    setSessions((prev) => prev.filter((s) => !deletedIds.has(s.id)))
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

  if (error) return <p className="error-panel">{error}</p>
  if (sessions.length === 0) return <p className="rom-history-empty">저장된 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 기록</h3>
      <BulkSelectionBar
        totalCount={sessions.length}
        selectedCount={selectedIds.size}
        onToggleAll={toggleSelectAll}
        onDeleteSelected={handleBulkDelete}
        deleting={bulkDeleting}
      />
      <ul className="rom-history-list">
        {sessions.map((s) => (
          <li key={s.id} className="rom-history-row">
            <input
              type="checkbox"
              className="rom-history-row-checkbox"
              aria-label="선택"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleSelect(s.id)}
            />
            <button type="button" className="rom-history-row-main" onClick={() => openDetail(s.id)}>
              {new Date(s.createdAt).toLocaleString('ko-KR')} · {s.videoName}
              {s.clientName && ` · ${s.clientName}`}
              {s.trainerName && ` (${s.trainerName})`}
              {s.avgDeltaRomDeg !== null && (
                <span className="rom-history-delta"> · 평균 변화 {s.avgDeltaRomDeg.toFixed(1)}°</span>
              )}
            </button>
            <button type="button" className="rom-history-delete" onClick={() => handleDelete(s.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="rom-history-detail">
          <RomResultsPanel
            results={detail.results}
            xmskEstimates={detail.xmskEstimates}
            manualInputs={detail.xmskManualInputs}
            groundTruth={detail.xmskGroundTruth}
            onGroundTruthChange={handleGroundTruthChange}
            calcVersion={detail.calcVersion}
            clientName={detail.clientName}
            trainerName={detail.trainerName}
            videoName={detail.videoName}
            createdAt={detail.createdAt}
          />
        </div>
      )}
    </div>
  )
}
