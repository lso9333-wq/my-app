import { useState } from 'react'
import { XMSK_MUSCLE_GROUPS } from '../lib/xmskMuscles'
import type { XmskMuscle } from '../types/xmsk'

export function XmskMuscleDictionary() {
  const [groupKey, setGroupKey] = useState(XMSK_MUSCLE_GROUPS[0].key)
  const [openMuscleId, setOpenMuscleId] = useState<string | null>(null)

  const group = XMSK_MUSCLE_GROUPS.find((g) => g.key === groupKey) ?? XMSK_MUSCLE_GROUPS[0]

  const selectGroup = (key: string) => {
    setGroupKey(key)
    setOpenMuscleId(null)
  }

  const toggleMuscle = (id: string) => {
    setOpenMuscleId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="xmsk-dict">
      <div className="xmsk-dict-tabs">
        {XMSK_MUSCLE_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={g.key === groupKey ? 'app-tab active' : 'app-tab'}
            onClick={() => selectGroup(g.key)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {group.safetyNote && <p className="xmsk-note xmsk-dict-safety">⚠️ {group.safetyNote}</p>}

      <ul className="xmsk-dict-list">
        {group.muscles.map((m: XmskMuscle) => {
          const open = openMuscleId === m.id
          return (
            <li key={m.id} className="xmsk-dict-item">
              <button type="button" className="xmsk-dict-item-head" onClick={() => toggleMuscle(m.id)}>
                <span className="xmsk-dict-code">{m.code}</span>
                <span className="xmsk-dict-name">
                  {m.nameKo} <span className="xmsk-unit">({m.nameEn})</span>
                </span>
                <span className="xmsk-dict-caret">{open ? '−' : '+'}</span>
              </button>
              {open && (
                <div className="xmsk-dict-detail">
                  <p>
                    <strong>붙는 곳</strong> {m.originInsertion}
                  </p>
                  <p>
                    <strong>작용</strong> {m.action}
                  </p>

                  <h4>STRETCH · 스트레칭</h4>
                  <p>{m.stretch.action}</p>
                  <ul className="xmsk-bullet-list">
                    <li>
                      <em>오류-반응 기준</em> {m.stretch.errorResponse.target}
                    </li>
                    <li>⚠ 많이 — {m.stretch.errorResponse.overDone}</li>
                    <li>△ 조금 — {m.stretch.errorResponse.underDone}</li>
                    <li>✅ 정확 — {m.stretch.errorResponse.correct}</li>
                  </ul>

                  <h4>RELEASE · 근막이완</h4>
                  <ul className="xmsk-bullet-list">
                    <li>
                      <em>포지션</em> {m.release.position}
                    </li>
                    <li>
                      <em>도구·강도</em> {m.release.toolIntensity}
                    </li>
                    <li>
                      <em>움직임 결합</em> {m.release.movement}
                    </li>
                    {m.release.caution && (
                      <li>
                        <em>⚠ 주의</em> {m.release.caution}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
