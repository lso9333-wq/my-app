import { useEffect, useRef, useState } from 'react'
import type { XmskEvaluationDetail, XmskEvaluationListItem } from '../types'
import { deleteXmskEvaluation, getXmskEvaluation, listXmskEvaluations, XmskAuthError } from '../lib/xmskApi'
import { XMSK_EVAL_SECTIONS, XMSK_EVAL_VERDICT_LABEL } from '../lib/xmskEvaluation'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { BulkSelectionBar } from '../../../shared/components/BulkSelectionBar'

interface Props {
  token: string
  refreshKey: number
  onAuthError: () => void
}

export function XmskEvaluationHistory({ token, refreshKey, onAuthError }: Props) {
  const [evaluations, setEvaluations] = useState<XmskEvaluationListItem[]>([])
  const [detail, setDetail] = useState<XmskEvaluationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listXmskEvaluations(token)
      .then(setEvaluations)
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
      setDetail(await getXmskEvaluation(token, id))
    } catch (err) {
      if (err instanceof XmskAuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 평가 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteXmskEvaluation(token, id)
      setEvaluations((prev) => prev.filter((e) => e.id !== id))
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
    setSelectedIds((prev) => (prev.size === evaluations.length ? new Set() : new Set(evaluations.map((e) => e.id))))
  }

  /** XmskSessionHistory와 같은 방식 — 인증 만료 시 그때까지의 성공분만 반영하고 중단. */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 평가 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBulkDeleting(true)
    const idsToDelete = Array.from(selectedIds)
    const deletedIds = new Set<number>()
    let authFailed = false
    for (const id of idsToDelete) {
      try {
        await deleteXmskEvaluation(token, id)
        deletedIds.add(id)
      } catch (err) {
        if (err instanceof XmskAuthError) {
          authFailed = true
          break
        }
      }
    }
    setEvaluations((prev) => prev.filter((e) => !deletedIds.has(e.id)))
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
  if (evaluations.length === 0) return <p className="rom-history-empty">저장된 평가 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 평가 기록</h3>
      <BulkSelectionBar
        totalCount={evaluations.length}
        selectedCount={selectedIds.size}
        onToggleAll={toggleSelectAll}
        onDeleteSelected={handleBulkDelete}
        deleting={bulkDeleting}
      />
      <ul className="rom-history-list">
        {evaluations.map((e) => (
          <li key={e.id} className="rom-history-row">
            <input
              type="checkbox"
              className="rom-history-row-checkbox"
              aria-label="선택"
              checked={selectedIds.has(e.id)}
              onChange={() => toggleSelect(e.id)}
            />
            <button type="button" className="rom-history-row-main" onClick={() => openDetail(e.id)}>
              {e.evaluationDate} · {e.traineeName}
              <span className="rom-history-delta">
                {' '}
                · {e.totalScore}/100점 · {XMSK_EVAL_VERDICT_LABEL[e.verdict]}
              </span>
            </button>
            <button type="button" className="rom-history-delete" onClick={() => handleDelete(e.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="rom-history-detail" ref={detailRef}>
          <h4>
            {detail.evaluationDate} · {detail.traineeName}
            {detail.evaluatorName && <span className="xmsk-unit"> (평가자: {detail.evaluatorName})</span>}
          </h4>
          <p className={`xmsk-eval-verdict-label xmsk-eval-verdict-${detail.verdict}`}>
            {detail.totalScore}/100점 · {XMSK_EVAL_VERDICT_LABEL[detail.verdict]}
          </p>
          <PdfExportButton targetRef={detailRef} fileName={`XMSK평가_${detail.traineeName}_${detail.evaluationDate}`} />
          <table className="rom-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>점수 / 통과여부</th>
              </tr>
            </thead>
            <tbody>
              {XMSK_EVAL_SECTIONS.flatMap((section) => [
                ...section.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>
                      {detail.scores[item.id] ?? 0} / {item.max}
                    </td>
                  </tr>
                )),
                ...section.requiredItems.map((item) => (
                  <tr key={item.id}>
                    <td>[필수] {item.label}</td>
                    <td>{detail.requiredPass[item.id] ? '통과' : '미달'}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
          {detail.comment && <p className="app-subtitle">총평: {detail.comment}</p>}
        </div>
      )}
    </div>
  )
}
