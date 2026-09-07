import { useState } from 'react'
import { XmskPasswordGate } from './components/XmskPasswordGate'
import { XmskRegionPicker } from './components/XmskRegionPicker'
import { XmskRecipeFlow } from './components/XmskRecipeFlow'
import { XmskSessionHistory } from './components/XmskSessionHistory'
import type { XmskRegionKey } from './types/xmsk'

const TOKEN_STORAGE_KEY = 'xmsk_token'

function XmskApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [region, setRegion] = useState<XmskRegionKey | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

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
        <p className="app-subtitle">
          FORéSTRETCH 통증 레시피 가이드 — 부위를 선택하면 Red Flag 확인부터 Before/After 비교까지 안내합니다.
        </p>
        <button type="button" onClick={handleLock}>
          잠그기
        </button>
      </div>
      <p className="disclaimer">⚠️ 트레이너 내부용 참고 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>

      {!region && <XmskRegionPicker onSelect={setRegion} />}
      {region && (
        <XmskRecipeFlow
          region={region}
          token={token}
          onExit={() => setRegion(null)}
          onSaved={() => setHistoryKey((k) => k + 1)}
          onAuthError={handleLock}
        />
      )}

      <XmskSessionHistory token={token} refreshKey={historyKey} onAuthError={handleLock} />
    </div>
  )
}

export default XmskApp
