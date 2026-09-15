import { useMemo, useRef, useState } from 'react'
import type { XmskFlowStage, XmskMeasurementValue, XmskRegionKey } from '../types'
import { XMSK_INTENSITY_NOTE, XMSK_RECIPE_MAP } from '../lib/xmskRecipes'
import { createXmskSession, XmskAuthError } from '../lib/xmskApi'
import { ComparisonBarChart } from '../../../shared/components/ComparisonBarChart'
import { PdfExportButton } from '../../../shared/components/PdfExportButton'
import { PrintReportHeader } from '../../../shared/components/PrintReportHeader'

type MeasureEntry = { value?: string; left?: string; right?: string }
type MeasureState = Record<string, MeasureEntry>

function toMeasurementValues(state: MeasureState): XmskMeasurementValue[] {
  return Object.entries(state).map(([id, v]) => ({
    id,
    value: v.value && v.value !== '' ? Number(v.value) : undefined,
    left: v.left && v.left !== '' ? Number(v.left) : undefined,
    right: v.right && v.right !== '' ? Number(v.right) : undefined,
  }))
}

interface Props {
  region: XmskRegionKey
  token: string
  onExit: () => void
  onSaved: () => void
  onAuthError: () => void
}

export function XmskRecipeFlow({ region, token, onExit, onSaved, onAuthError }: Props) {
  const recipe = XMSK_RECIPE_MAP[region]
  const summaryRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<XmskFlowStage>('redflag')
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [redFlagsCleared, setRedFlagsCleared] = useState(false)
  const [before, setBefore] = useState<MeasureState>({})
  const [after, setAfter] = useState<MeasureState>({})
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const beforeValues = useMemo(() => toMeasurementValues(before), [before])
  const afterValues = useMemo(() => toMeasurementValues(after), [after])

  const updateMeasure = (
    setter: (updater: (prev: MeasureState) => MeasureState) => void,
    id: string,
    field: keyof MeasureEntry,
    raw: string,
  ) => {
    setter((prev) => ({ ...prev, [id]: { ...prev[id], [field]: raw } }))
  }

  const toggleStep = (key: string) => {
    setDoneSteps((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    if (clientName.trim() === '') {
      setSaveState('error')
      setSaveError('회원 이름을 입력해 주세요.')
      return
    }
    setSaveState('saving')
    setSaveError(null)
    try {
      await createXmskSession(token, {
        region,
        clientName: clientName.trim(),
        trainerName: trainerName.trim() || undefined,
        redFlagsCleared,
        note: note.trim() || undefined,
        before: beforeValues,
        after: afterValues,
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

  const renderMeasureInputs = (state: MeasureState, setter: typeof setBefore) => (
    <div className="xmsk-measure-grid">
      {recipe.measurements.map((m) => (
        <div key={m.id} className="xmsk-measure-item">
          <label>
            {m.label} <span className="xmsk-unit">({m.unit})</span>
          </label>
          {m.sides === 'single' ? (
            <input
              type="number"
              inputMode="decimal"
              value={state[m.id]?.value ?? ''}
              onChange={(e) => updateMeasure(setter, m.id, 'value', e.target.value)}
            />
          ) : (
            <div className="xmsk-measure-lr">
              <input
                type="number"
                inputMode="decimal"
                placeholder="좌"
                value={state[m.id]?.left ?? ''}
                onChange={(e) => updateMeasure(setter, m.id, 'left', e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="우"
                value={state[m.id]?.right ?? ''}
                onChange={(e) => updateMeasure(setter, m.id, 'right', e.target.value)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const comparisonCharts = recipe.measurements.flatMap((m) => {
    const b = before[m.id]
    const a = after[m.id]
    const charts = []
    if (m.sides === 'single') {
      if (b?.value && a?.value) {
        charts.push(
          <ComparisonBarChart
            key={m.id}
            title={m.label}
            leftValue={Number(b.value)}
            rightValue={Number(a.value)}
            leftLabel="이전"
            rightLabel="이후"
            format={(v) => `${v.toFixed(1)}${m.unit}`}
          />,
        )
      }
      return charts
    }
    if (b?.left && a?.left) {
      charts.push(
        <ComparisonBarChart
          key={`${m.id}-left`}
          title={`${m.label} (좌)`}
          leftValue={Number(b.left)}
          rightValue={Number(a.left)}
          leftLabel="이전"
          rightLabel="이후"
          format={(v) => `${v.toFixed(1)}${m.unit}`}
        />,
      )
    }
    if (b?.right && a?.right) {
      charts.push(
        <ComparisonBarChart
          key={`${m.id}-right`}
          title={`${m.label} (우)`}
          leftValue={Number(b.right)}
          rightValue={Number(a.right)}
          leftLabel="이전"
          rightLabel="이후"
          format={(v) => `${v.toFixed(1)}${m.unit}`}
        />,
      )
    }
    return charts
  })

  return (
    <div className="xmsk-flow">
      <div className="xmsk-flow-head">
        <button type="button" className="xmsk-back" onClick={onExit}>
          ← 부위 다시 선택
        </button>
        <h2>{recipe.title}</h2>
        <p className="app-subtitle">{recipe.subtitle}</p>
      </div>

      <section className="xmsk-section">
        <div className="xmsk-eval-header-grid">
          <label>
            회원 이름
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="회원 이름" />
          </label>
          <label>
            담당 트레이너
            <input
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="담당 트레이너 이름 (선택)"
            />
          </label>
        </div>
      </section>

      {stage === 'redflag' && (
        <section className="xmsk-section">
          <h3>0. 먼저 거른다 — Red Flag</h3>
          <div className="xmsk-translate">
            <table>
              <thead>
                <tr>
                  <th>회원님 표현</th>
                  <th>트레이너가 읽는 것</th>
                </tr>
              </thead>
              <tbody>
                {recipe.translate.map((t) => (
                  <tr key={t.symptom}>
                    <td>{t.symptom}</td>
                    <td>{t.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="xmsk-redflag-box">
            <strong>즉시 의뢰 (응급 · 전후 무관)</strong>
            <ul>
              {recipe.emergencyFlags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <p className="xmsk-note">{XMSK_INTENSITY_NOTE}</p>
          <label className="xmsk-checkbox">
            <input
              type="checkbox"
              checked={redFlagsCleared}
              onChange={(e) => setRedFlagsCleared(e.target.checked)}
            />
            위 응급 신호가 없는 것을 확인했습니다. 진행합니다.
          </label>
          <div className="xmsk-flow-actions">
            <button type="button" disabled={!redFlagsCleared} onClick={() => setStage('before')}>
              다음: Before 측정
            </button>
          </div>
        </section>
      )}

      {stage === 'before' && (
        <section className="xmsk-section">
          <h3>0.5 상태 체크 — Before</h3>
          <ul className="xmsk-bullet-list">
            {recipe.beforeChecklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {renderMeasureInputs(before, setBefore)}
          <div className="xmsk-flow-actions">
            <button type="button" onClick={() => setStage('redflag')}>
              이전
            </button>
            <button type="button" onClick={() => setStage('recipe')}>
              다음: 레시피 진행
            </button>
          </div>
        </section>
      )}

      {stage === 'recipe' && (
        <section className="xmsk-section">
          <h3>1. 기본 레시피 (순서대로)</h3>
          <ul className="xmsk-steps">
            {recipe.steps.map((s) => (
              <li key={s.step}>
                <label className="xmsk-checkbox">
                  <input type="checkbox" checked={doneSteps.has(s.step)} onChange={() => toggleStep(s.step)} />
                  <span>
                    <strong>{s.step}.</strong> {s.title} — {s.detail}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <h3>2. 관찰 → 조정</h3>
          <ul className="xmsk-bullet-list">
            {recipe.adjustRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="xmsk-flow-actions">
            <button type="button" onClick={() => setStage('before')}>
              이전
            </button>
            <button type="button" onClick={() => setStage('after')}>
              다음: After 측정
            </button>
          </div>
        </section>
      )}

      {stage === 'after' && (
        <section className="xmsk-section">
          <h3>3. 마무리 — After 확인</h3>
          {renderMeasureInputs(after, setAfter)}
          <div className="xmsk-flow-actions">
            <button type="button" onClick={() => setStage('recipe')}>
              이전
            </button>
            <button type="button" onClick={() => setStage('summary')}>
              다음: 결과 요약
            </button>
          </div>
        </section>
      )}

      {stage === 'summary' && (
        <section className="xmsk-section">
          <div ref={summaryRef}>
            <PrintReportHeader title={`${recipe.title} — 결과 비교`} clientName={clientName} trainerName={trainerName} />
            {comparisonCharts.length > 0 ? (
              <div className="chart-row xmsk-chart-row">{comparisonCharts}</div>
            ) : (
              <p className="metrics-empty">Before/After 측정값을 입력하면 비교 그래프가 표시됩니다.</p>
            )}

            <div className="xmsk-closing">
              <h4>마무리 멘트</h4>
              <p>“{recipe.closingScript}”</p>
            </div>

            <div className="xmsk-selfcare">
              <h4>셀프 과제</h4>
              <ul className="xmsk-bullet-list">
                {recipe.selfCare.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <PdfExportButton targetRef={summaryRef} fileName={`XMSK_${recipe.title}_${clientName || '결과'}`} />

          <label className="xmsk-note-field">
            메모 (선택)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="특이사항을 적어두세요" />
          </label>

          <div className="xmsk-flow-actions">
            <button type="button" onClick={() => setStage('after')}>
              이전
            </button>
            <button type="button" onClick={handleSave} disabled={saveState === 'saving'}>
              {saveState === 'saving' ? '저장 중...' : '기록 저장'}
            </button>
          </div>
          {saveState === 'saved' && <p className="xmsk-save-status">기록이 저장되었습니다.</p>}
          {saveState === 'error' && <p className="error-panel">{saveError}</p>}
        </section>
      )}
    </div>
  )
}
