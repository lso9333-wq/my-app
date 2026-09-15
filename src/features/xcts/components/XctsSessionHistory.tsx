import { useEffect, useState } from 'react'
import type { XctsSessionDetail, XctsSessionListItem } from '../types'
import { deleteXctsSession, getXctsSession, listXctsSessions } from '../lib/xctsApi'
import { AuthError } from '../../../shared/lib/authApi'
import { XctsResultsPanel } from './XctsResultsPanel'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  refreshKey: number
  token: string
  onAuthError: () => void
}

/** RomSessionHistory/HandSessionHistory와 같은 구조 — 저장된 XCTS 측정 기록 목록·상세·삭제. */
export function XctsSessionHistory({ refreshKey, token, onAuthError }: Props) {
  const [sessions, setSessions] = useState<XctsSessionListItem[]>([])
  const [detail, setDetail] = useState<XctsSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    listXctsSessions(token)
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
      setDetail(await getXctsSession(token, id))
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteXctsSession(token, id)
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

  /** RomSessionHistory/HandSessionHistory와 같은 방식 — 기존 단건 삭제를 선택된 개수만큼 순차 호출. */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of selectedIds) {
      try {
        await deleteXctsSession(token, id)
        deletedIds.add(id)
      } catch (err) {
        if (err instanceof AuthError) authFailed = true
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
              {new Date(s.createdAt).toLocaleString('ko-KR')} · {s.clientName}
              {s.trainerName && ` (${s.trainerName})`}
              {s.avgHeartRateDeltaBpm !== null && (
                <span className="rom-history-delta"> · 심박 변화 {s.avgHeartRateDeltaBpm.toFixed(1)}bpm</span>
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
          <XctsResultsPanel baseline={detail.baseline} post={detail.post} deviceName={detail.deviceName} />
        </div>
      )}
    </div>
  )
}
