import { useEffect, useState } from 'react'
import type { XmskEvaluationDetail, XmskEvaluationListItem } from '../types/xmsk'
import { getXmskEvaluation, listXmskEvaluations, XmskAuthError } from '../lib/xmskApi'
import { XMSK_EVAL_SECTIONS, XMSK_EVAL_VERDICT_LABEL } from '../lib/xmskEvaluation'

interface Props {
  token: string
  refreshKey: number
  onAuthError: () => void
}

export function XmskEvaluationHistory({ token, refreshKey, onAuthError }: Props) {
  const [evaluations, setEvaluations] = useState<XmskEvaluationListItem[]>([])
  const [detail, setDetail] = useState<XmskEvaluationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  if (error) return <p className="error-panel">{error}</p>
  if (evaluations.length === 0) return <p className="rom-history-empty">저장된 평가 기록이 없습니다.</p>

  return (
    <div className="rom-history">
      <h3>저장된 평가 기록</h3>
      <ul className="rom-history-list">
        {evaluations.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => openDetail(e.id)}>
              {e.evaluationDate} · {e.traineeName}
              <span className="rom-history-delta">
                {' '}
                · {e.totalScore}/100점 · {XMSK_EVAL_VERDICT_LABEL[e.verdict]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="rom-history-detail">
          <h4>
            {detail.evaluationDate} · {detail.traineeName}
            {detail.evaluatorName && <span className="xmsk-unit"> (평가자: {detail.evaluatorName})</span>}
          </h4>
          <p className={`xmsk-eval-verdict-label xmsk-eval-verdict-${detail.verdict}`}>
            {detail.totalScore}/100점 · {XMSK_EVAL_VERDICT_LABEL[detail.verdict]}
          </p>
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
