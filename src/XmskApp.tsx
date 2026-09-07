import { useState } from 'react'
import { XmskPasswordGate } from './components/XmskPasswordGate'
import { XmskRegionPicker } from './components/XmskRegionPicker'
import { XmskRecipeFlow } from './components/XmskRecipeFlow'
import { XmskSessionHistory } from './components/XmskSessionHistory'
import { XmskMuscleDictionary } from './components/XmskMuscleDictionary'
import { XmskEvaluationForm } from './components/XmskEvaluationForm'
import { XmskEvaluationHistory } from './components/XmskEvaluationHistory'
import type { XmskModule, XmskRegionKey } from './types/xmsk'

const TOKEN_STORAGE_KEY = 'xmsk_token'

function XmskApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [xmskModule, setXmskModule] = useState<XmskModule>('recipes')
  const [region, setRegion] = useState<XmskRegionKey | null>(null)
  const [sessionHistoryKey, setSessionHistoryKey] = useState(0)
  const [evalHistoryKey, setEvalHistoryKey] = useState(0)

  const handleUnlock = (t: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, t)
    setToken(t)
  }

  const handleLock = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setRegion(null)
  }

  if (!token) return <XmskPasswordGate onUnlock={handleUnlock} />

  return (
    <div className="xmsk-app">
      <div className="xmsk-toolbar">
        <p className="app-subtitle">FORéSTRETCH 트레이너 전용 도구 — 통증 레시피 · 근육 사전 · 현장투입 평가표</p>
        <button type="button" onClick={handleLock}>
          잠그기
        </button>
      </div>
      <p className="disclaimer">⚠️ 트레이너 내부용 참고 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>

      <nav className="app-tabs xmsk-module-tabs">
        <button
          type="button"
          className={xmskModule === 'recipes' ? 'app-tab active' : 'app-tab'}
          onClick={() => setXmskModule('recipes')}
        >
          통증 레시피
        </button>
        <button
          type="button"
          className={xmskModule === 'dictionary' ? 'app-tab active' : 'app-tab'}
          onClick={() => setXmskModule('dictionary')}
        >
          근육 사전
        </button>
        <button
          type="button"
          className={xmskModule === 'evaluation' ? 'app-tab active' : 'app-tab'}
          onClick={() => setXmskModule('evaluation')}
        >
          평가표
        </button>
      </nav>

      {xmskModule === 'recipes' && (
        <>
          {!region && <XmskRegionPicker onSelect={setRegion} />}
          {region && (
            <XmskRecipeFlow
              region={region}
              token={token}
              onExit={() => setRegion(null)}
              onSaved={() => setSessionHistoryKey((k) => k + 1)}
              onAuthError={handleLock}
            />
          )}
          <XmskSessionHistory token={token} refreshKey={sessionHistoryKey} onAuthError={handleLock} />
        </>
      )}

      {xmskModule === 'dictionary' && <XmskMuscleDictionary />}

      {xmskModule === 'evaluation' && (
        <>
          <XmskEvaluationForm token={token} onSaved={() => setEvalHistoryKey((k) => k + 1)} onAuthError={handleLock} />
          <XmskEvaluationHistory token={token} refreshKey={evalHistoryKey} onAuthError={handleLock} />
        </>
      )}
    </div>
  )
}

export default XmskApp
