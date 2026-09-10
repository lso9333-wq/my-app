import { useEffect, useState } from 'react'
import type { RomSessionDetail, RomSessionListItem } from '../types'
import { getRomSession, listRomSessions } from '../lib/romApi'
import { RomResultsPanel } from './RomResultsPanel'

export function RomSessionHistory({ refreshKey }: { refreshKey: number }) {
  const [sessions, setSessions] = useState<RomSessionListItem[]>([])
  const [detail, setDetail] = useState<RomSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRomSessions()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : '기록을 불러오지 못했습니다.'))
  }, [refreshKey])

  const openDetail = async (id: number) => {
    try {
      setDetail(await getRomSession(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
    }
  }

  if (error) return <p className="error-panel">{error}</p>
  if (sessions.length === 0) return <p className="rom-history-empty">저장된 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 기록</h3>
      <ul className="rom-history-list">
        {sessions.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => openDetail(s.id)}>
              {new Date(s.createdAt).toLocaleString('ko-KR')} · {s.videoName}
              {s.avgDeltaRomDeg !== null && (
                <span className="rom-history-delta"> · 평균 변화 {s.avgDeltaRomDeg.toFixed(1)}°</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="rom-history-detail">
          <h4>
            {new Date(detail.createdAt).toLocaleString('ko-KR')} · {detail.videoName}
          </h4>
          <RomResultsPanel results={detail.results} />
        </div>
      )}
    </div>
  )
}
