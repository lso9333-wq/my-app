import { useMemo, useState } from 'react'
import { XMSK_EVAL_SECTIONS, XMSK_EVAL_VERDICT_LABEL, computeXmskEvalVerdict } from '../lib/xmskEvaluation'
import { createXmskEvaluation, XmskAuthError } from '../lib/xmskApi'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  token: string
  onSaved: () => void
  onAuthError: () => void
}

export function XmskEvaluationForm({ token, onSaved, onAuthError }: Props) {
  const [traineeName, setTraineeName] = useState('')
  const [evaluatorName, setEvaluatorName] = useState('')
  const [evaluationDate, setEvaluationDate] = useState(today())
  const [scores, setScores] = useState<Record<string, string>>({})
  const [requiredPass, setRequiredPass] = useState<Record<string, boolean>>({})
  const [comment, setComment] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const totalScore = useMemo(() => {
    let sum = 0
    for (const section of XMSK_EVAL_SECTIONS) {
      for (const item of section.items) {
        sum += Number(scores[item.id] || 0)
      }
    }
    return sum
  }, [scores])

  const allRequiredPassed = useMemo(() => {
    return XMSK_EVAL_SECTIONS.every((section) => section.requiredItems.every((item) => requiredPass[item.id] === true))
  }, [requiredPass])

  const verdict = computeXmskEvalVerdict(totalScore, allRequiredPassed)

  const setScore = (id: string, raw: string) => setScores((prev) => ({ ...prev, [id]: raw }))
  const togglePass = (id: string) => setRequiredPass((prev) => ({ ...prev, [id]: !prev[id] }))

  const resetForm = () => {
    setTraineeName('')
    setEvaluatorName('')
    setEvaluationDate(today())
    setScores({})
    setRequiredPass({})
    setComment('')
    setSaveState('idle')
    setSaveError(null)
  }

  const handleSave = async () => {
    if (traineeName.trim() === '') {
      setSaveState('error')
      setSaveError('트레이니 이름을 입력해 주세요.')
      return
    }
    setSaveState('saving')
    setSaveError(null)
    try {
      const scoreValues: Record<string, number> = {}
      for (const section of XMSK_EVAL_SECTIONS) {
        for (const item of section.items) {
          scoreValues[item.id] = Number(scores[item.id] || 0)
        }
      }
      const requiredValues: Record<string, boolean> = {}
      for (const section of XMSK_EVAL_SECTIONS) {
        for (const item of section.requiredItems) {
          requiredValues[item.id] = requiredPass[item.id] === true
        }
      }

      await createXmskEvaluation(token, {
        traineeName: traineeName.trim(),
        evaluatorName: evaluatorName.trim() || undefined,
        evaluationDate,
        scores: scoreValues,
        requiredPass: requiredValues,
        comment: comment.trim() || undefined,
      })
      setSaveState('saved')
      onSaved()
    } catch (err) {
      if (err instanceof XmskAuthError) {
        onAuthError()
        return
      }
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div className="xmsk-eval-form">
      <section className="xmsk-section">
        <h3>LEVEL 1 현장 투입 최종 평가표</h3>
        <p className="app-subtitle">이 사람에게 고객을 맡겨도 되는가 — 안전 · 기본기 · CS</p>
        <div className="xmsk-eval-header-grid">
          <label>
            이름
            <input type="text" value={traineeName} onChange={(e) => setTraineeName(e.target.value)} placeholder="트레이니 이름" />
          </label>
          <label>
            평가일
            <input type="date" value={evaluationDate} onChange={(e) => setEvaluationDate(e.target.value)} />
          </label>
          <label>
            평가자
            <input type="text" value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} placeholder="평가자 이름 (선택)" />
          </label>
        </div>
      </section>

      {XMSK_EVAL_SECTIONS.map((section) => (
        <section key={section.key} className="xmsk-section">
          <h3>
            {section.title}
            {section.maxTotal !== null && <span className="xmsk-unit"> ({section.maxTotal}점)</span>}
          </h3>
          {section.items.length > 0 && (
            <div className="xmsk-eval-score-grid">
              {section.items.map((item) => (
                <div key={item.id} className="xmsk-measure-item">
                  <label>
                    {item.label} <span className="xmsk-unit">(최대 {item.max}점)</span>
                  </label>
                  <p className="xmsk-note">{item.hint}</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.max}
                    value={scores[item.id] ?? ''}
                    onChange={(e) => setScore(item.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
          {section.requiredItems.length > 0 && (
            <ul className="xmsk-steps">
              {section.requiredItems.map((item) => (
                <li key={item.id}>
                  <label className="xmsk-checkbox">
                    <input type="checkbox" checked={requiredPass[item.id] === true} onChange={() => togglePass(item.id)} />
                    <span>
                      <strong>[필수] {item.label}</strong> — {item.hint}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className={`xmsk-section xmsk-eval-verdict xmsk-eval-verdict-${verdict}`}>
        <h3>종합 판정</h3>
        <p className="xmsk-eval-total">
          합계 {totalScore} / 100점 · 필수 항목 {allRequiredPassed ? '전부 통과' : '미달 있음'}
        </p>
        <p className="xmsk-eval-verdict-label">{XMSK_EVAL_VERDICT_LABEL[verdict]}</p>

        <label className="xmsk-note-field">
          평가자 총평
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="총평을 적어주세요 (선택)" />
        </label>

        <div className="xmsk-flow-actions">
          <button type="button" onClick={resetForm}>
            초기화
          </button>
          <button type="button" onClick={handleSave} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? '저장 중...' : '평가 저장'}
          </button>
        </div>
        {saveState === 'saved' && <p className="xmsk-save-status">평가가 저장되었습니다.</p>}
        {saveState === 'error' && <p className="error-panel">{saveError}</p>}
      </section>
    </div>
  )
}
