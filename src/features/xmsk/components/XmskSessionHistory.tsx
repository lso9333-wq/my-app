import { useEffect, useState } from 'react'
import type { XmskSessionDetail, XmskSessionListItem } from '../types'
import { deleteXmskSession, getXmskSession, listXmskSessions, XmskAuthError } from '../lib/xmskApi'
import { XMSK_RECIPE_MAP } from '../lib/xmskRecipes'

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
    } catch (err) {
      if (err instanceof XmskAuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다.')
    }
  }

  if (error) return <p className="error-panel">{error}</p>
  if (sessions.length === 0) return <p className="rom-history-empty">저장된 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 세션 기록</h3>
      <ul className="rom-history-list">
        {sessions.map((s) => (
          <li key={s.id} className="rom-history-row">
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
        <div className="rom-history-detail">
          <h4>
            {new Date(detail.createdAt).toLocaleString('ko-KR')} · {XMSK_RECIPE_MAP[detail.region].title} · {detail.clientName}
            {detail.trainerName && <span className="xmsk-unit"> (담당: {detail.trainerName})</span>}
          </h4>
          {detail.note && <p className="app-subtitle">메모: {detail.note}</p>}
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
