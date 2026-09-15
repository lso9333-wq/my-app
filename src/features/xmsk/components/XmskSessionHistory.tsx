import { useEffect, useRef, useState } from 'react'
import type { XmskSessionDetail, XmskSessionListItem } from '../types'
import { deleteXmskSession, getXmskSession, listXmskSessions, XmskAuthError } from '../lib/xmskApi'
import { XMSK_RECIPE_MAP } from '../lib/xmskRecipes'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  token: string
  refreshKey: number
  onAuthError: () => void
}

function fmt(v: number | undefined, unit: string): string {
  return v === undefined || v === null ? '—' : `${v}${unit}`
}

export function XmskSessionHistory({ token, refreshKey, onAuthError }: Props) {
  const [sessions, setSessions] = useState<XmskSessionListItem[]>([])
  const [detail, setDetail] = useState<XmskSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listXmskSessions(token)
      .then(setSessions)
      .catch((err) => {
        if (err instanceof XmskAuthError) {
          onAuthError()
          return
        }
        setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.')
      })
  }, [refreshKey, token, onAuthError])

  const openDetail = async (id: number) => {
    try {
      setDetail(await getXmskSession(token, id))
    } catch (err) {
      if (err instanceof XmskAuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 세션 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteXmskSession(token, id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setDetail((prev) => (prev?.id === id ? null : prev))
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      if (err instanceof XmskAuthError) {
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

  /** RomSessionHistory와 같은 방식으로 기존 단건 삭제를 순차 호출하되, 인증 토큰이
   * 만료된 경우(XmskAuthError)는 그 시점까지 성공한 삭제만 반영하고 나머지는 중단한 뒤
   * 잠금 화면으로 돌아간다(다른 XMSK 화면들의 기존 처리와 동일). */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 세션 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const idsToDelete = Array.from(selectedIds)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of idsToDelete) {
      try {
        await deleteXmskSession(token, id)
        deletedIds.add(id)
      } catch (err) {
        if (err instanceof XmskAuthError) {
          authFailed = true
          break
        }
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
    const failedCount = idsToDelete.length - deletedIds.size
    if (failedCount > 0) setError(`${failedCount}개 항목 삭제에 실패했습니다.`)
  }

  if (error) return <p className="error-panel">{error}</p>
  if (sessions.length === 0) return <p className="rom-history-empty">저장된 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 세션 기록</h3>
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
              {new Date(s.createdAt).toLocaleString('ko-KR')} · {XMSK_RECIPE_MAP[s.region].title} · {s.clientName}
              {s.avgAbsDelta !== null && (
                <span className="rom-history-delta"> · 평균 변화 폭 {s.avgAbsDelta.toFixed(1)}</span>
              )}
            </button>
            <button type="button" className="rom-history-delete" onClick={() => handleDelete(s.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="rom-history-detail" ref={detailRef}>
          <h4>
            {new Date(detail.createdAt).toLocaleString('ko-KR')} · {XMSK_RECIPE_MAP[detail.region].title} · {detail.clientName}
            {detail.trainerName && <span className="xmsk-unit"> (담당: {detail.trainerName})</span>}
          </h4>
          {detail.note && <p className="app-subtitle">메모: {detail.note}</p>}
          <PdfExportButton
            targetRef={detailRef}
            fileName={`XMSK_${XMSK_RECIPE_MAP[detail.region].title}_${detail.clientName}`}
          />
          <table className="rom-table">
            <thead>
              <tr>
                <th>측정 항목</th>
                <th>이전</th>
                <th>이후</th>
              </tr>
            </thead>
            <tbody>
              {XMSK_RECIPE_MAP[detail.region].measurements.map((m) => {
                const b = detail.before.find((v) => v.id === m.id)
                const a = detail.after.find((v) => v.id === m.id)
                if (m.sides === 'single') {
                  return (
                    <tr key={m.id}>
                      <td>{m.label}</td>
                      <td>{fmt(b?.value, m.unit)}</td>
                      <td>{fmt(a?.value, m.unit)}</td>
                    </tr>
                  )
                }
                return (
                  <tr key={m.id}>
                    <td>{m.label} (좌/우)</td>
                    <td>
                      {fmt(b?.left, m.unit)} / {fmt(b?.right, m.unit)}
                    </td>
                    <td>
                      {fmt(a?.left, m.unit)} / {fmt(a?.right, m.unit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
