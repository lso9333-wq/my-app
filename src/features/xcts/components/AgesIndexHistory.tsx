import { useEffect, useState } from 'react'
import { AuthError } from '../../../shared/lib/authApi'
import { deleteAgesIndexRecord, listAgesIndexRecords } from '../lib/xctsApi'
import type { AgesIndexRecordListItem } from '../types'

interface Props {
  refreshKey: number
  token: string
  onAuthError: () => void
}

/**
 * 저장된 최종당화산물지수 기록을 날짜별로 나열한다. XctsSessionHistory와 달리
 * before/after 세션 개념이 없는 단순 시계열 목록이라 별도 상세 화면을 두지 않고
 * 목록 각 줄에 바로 값·등급을 보여준다("464 · 적절" 형태, 요구사항 예시 그대로).
 */
export function AgesIndexHistory({ refreshKey, token, onAuthError }: Props) {
  const [records, setRecords] = useState<AgesIndexRecordListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAgesIndexRecords(token)
      .then(setRecords)
      .catch((err) => {
        if (err instanceof AuthError) {
          onAuthError()
          return
        }
        setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.')
      })
  }, [refreshKey, token, onAuthError])

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteAgesIndexRecord(token, id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setError(err instanceof Error ? err.message : '삭제하지 못했습니다.')
    }
  }

  if (error) return <p className="error-panel">{error}</p>
  if (records.length === 0) return null

  return (
    <div className="rom-history">
      <h3>최종당화산물지수 기록</h3>
      <ul className="rom-history-list">
        {records.map((r) => (
          <li key={r.id} className="rom-history-row">
            <span className="rom-history-row-main">
              {r.dayTimeLabel ?? r.dayTimeRaw} · {r.score} · {r.grade}
              {r.clientName && ` (${r.clientName}${r.trainerName ? `, ${r.trainerName}` : ''})`}
            </span>
            <button type="button" className="rom-history-delete" onClick={() => handleDelete(r.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
