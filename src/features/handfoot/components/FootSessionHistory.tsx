import { useEffect, useRef, useState } from 'react'
import type { FootManualToeInput, FootSessionDetail, FootSessionListItem } from '../types'
import { deleteFootSession, getFootSession, listFootSessions, updateFootSessionManualToeInputs } from '../lib/handFootApi'
import { AuthError } from '../../../shared/lib/authApi'
import { FootResultsPanel } from './FootResultsPanel'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  refreshKey: number
  token: string
  onAuthError: () => void
}

export function FootSessionHistory({ refreshKey, token, onAuthError }: Props) {
  const [sessions, setSessions] = useState<FootSessionListItem[]>([])
  const [detail, setDetail] = useState<FootSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const manualToeSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    listFootSessions(token)
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
      setDetail(await getFootSession(token, id))
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  /** 발가락 10마디는 AI 시뮬레이션 초기값이 채워져 있지만, 저장된 기록을 다시 열어서도
   * 트레이너가 계속 확인/수정할 수 있어야 한다(RomSessionHistory의 ground-truth 갱신과
   * 같은 이유). 값을 편집하는 순간 source를 'trainer'로 바꿔 더 이상 미확인 시뮬레이션이
   * 아니라는 것을 남긴다(FootAnalysisPanel의 handleManualToeInputChange와 동일한 규칙). */
  const handleManualToeInputChange = (id: string, phase: 'before' | 'after', value: number | null) => {
    setDetail((prev) => {
      if (!prev) return prev
      const idx = prev.manualToeInputs.findIndex((m) => m.id === id)
      const nextInputs: FootManualToeInput[] =
        idx === -1
          ? [...prev.manualToeInputs, { id, beforeValue: phase === 'before' ? value : null, afterValue: phase === 'after' ? value : null, source: 'trainer' }]
          : prev.manualToeInputs.map((m, i) =>
              i === idx ? { ...m, [phase === 'before' ? 'beforeValue' : 'afterValue']: value, source: 'trainer' as const } : m,
            )

      if (manualToeSaveTimerRef.current !== null) window.clearTimeout(manualToeSaveTimerRef.current)
      manualToeSaveTimerRef.current = window.setTimeout(() => {
        updateFootSessionManualToeInputs(token, prev.id, nextInputs).catch((err) => {
          if (err instanceof AuthError) {
            onAuthError()
            return
          }
          console.error('[FootSessionHistory] 수기 입력 저장 실패', err)
        })
      }, 500)

      return { ...prev, manualToeInputs: nextInputs }
    })
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteFootSession(token, id)
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

  /** RomSessionHistory와 같은 방식 — 새 벌크 삭제 API 없이 기존 단건 삭제를 선택된
   * 개수만큼 순차 호출한다. */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of selectedIds) {
      try {
        await deleteFootSession(token, id)
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
              {s.avgAbsDelta !== null && (
                <span className="rom-history-delta"> · 평균 변화 {s.avgAbsDelta.toFixed(1)}°</span>
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
          <FootResultsPanel
            toeEstimates={detail.toeEstimates}
            manualToeInputs={detail.manualToeInputs}
            onManualToeInputChange={handleManualToeInputChange}
            clientName={detail.clientName}
            trainerName={detail.trainerName}
            videoName={detail.videoName}
            createdAt={detail.createdAt}
            eegContext={detail.eegContext}
          />
        </div>
      )}
    </div>
  )
}
