import { useState } from 'react'
import { XmskRegionPicker } from './components/XmskRegionPicker'
import { XmskRecipeFlow } from './components/XmskRecipeFlow'
import { XmskSessionHistory } from './components/XmskSessionHistory'
import { XmskMuscleDictionary } from './components/XmskMuscleDictionary'
import { XmskEvaluationForm } from './components/XmskEvaluationForm'
import { XmskEvaluationHistory } from './components/XmskEvaluationHistory'
import { XmskDataQualityDashboard } from './components/XmskDataQualityDashboard'
import type { XmskModule, XmskRegionKey } from './types'

const MODULE_DESCRIPTIONS: Record<XmskModule, string> = {
  recipes: '부위를 선택하면 Red Flag 확인부터 Before/After 비교까지 순서대로 안내합니다.',
  dictionary: '부위를 고르고 근육을 눌러 붙는 곳·작용, 스트레칭·근막이완 방법을 확인하세요.',
  evaluation: '이론·실기·안전·CS 항목을 채점하면 합계와 투입 판정(승인/재평가/보류)을 자동으로 계산합니다.',
  dataQuality: 'AI 추정 항목마다 트레이너 실측값이 얼마나 쌓였는지 확인합니다(계산 로직 보정용 데이터 현황).',
}

interface Props {
  token: string
  onLock: () => void
}

/**
 * 2026-09 보안 점검 이후 token/onLock을 App.tsx가 소유해서 props로 내려준다.
 *
 * 예전엔 이 컴포넌트가 자기만의 useState(() => localStorage.getItem(...))로 토큰을
 * 관리했다 — XMSK 하나만 잠겨 있던 시절엔 문제없었지만, 이제 보행/ROM/손발도 같은
 * 비밀번호로 잠기면서 App.tsx가 최상위에서 토큰 하나를 관리해야 한다(그래야 예를
 * 들어 손발 탭에서 토큰이 만료돼 로그아웃되면 XMSK 탭도 같이 잠금 화면으로 돌아간다).
 * 이 컴포넌트가 계속 자기 state를 따로 들고 있었다면, 두 상태가 어긋나는(state
 * desync) 버그가 생겼을 것이다 — 예를 들어 XMSK의 "잠그기" 버튼이 자기 로컬 state와
 * localStorage만 지우고 App.tsx가 들고 있는 token state는 그대로 남아, 다른 탭에서는
 * 여전히 로그인된 것처럼 보이는 식으로.
 */
function XmskApp({ token, onLock }: Props) {
  const [xmskModule, setXmskModule] = useState<XmskModule>('recipes')
  const [region, setRegion] = useState<XmskRegionKey | null>(null)
  const [sessionHistoryKey, setSessionHistoryKey] = useState(0)
  const [evalHistoryKey, setEvalHistoryKey] = useState(0)

  const handleLock = () => {
    setRegion(null)
    onLock()
  }

  return (
    <div className="xmsk-app">
      <div className="xmsk-toolbar">
        <p className="app-subtitle">FORéSTRETCH 트레이너 전용 도구</p>
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
        <button
          type="button"
          className={xmskModule === 'dataQuality' ? 'app-tab active' : 'app-tab'}
          onClick={() => setXmskModule('dataQuality')}
        >
          데이터 품질
        </button>
      </nav>
      <p className="app-subtitle xmsk-module-desc">{MODULE_DESCRIPTIONS[xmskModule]}</p>

      {xmskModule === 'recipes' && (
        <>
          {!region && <XmskRegionPicker onSelect={setRegion} />}
          {region && (
            <XmskRecipeFlow
              region={region}
              token={token}
              onExit={() => setRegion(null)}
              onSaved={() => setSessionHistoryKey((k) => k + 1)}
              onAuthError={onLock}
            />
          )}
          <XmskSessionHistory token={token} refreshKey={sessionHistoryKey} onAuthError={onLock} />
        </>
      )}

      {xmskModule === 'dictionary' && <XmskMuscleDictionary />}

      {xmskModule === 'evaluation' && (
        <>
          <XmskEvaluationForm token={token} onSaved={() => setEvalHistoryKey((k) => k + 1)} onAuthError={onLock} />
          <XmskEvaluationHistory token={token} refreshKey={evalHistoryKey} onAuthError={onLock} />
        </>
      )}

      {xmskModule === 'dataQuality' && <XmskDataQualityDashboard token={token} onAuthError={onLock} />}
    </div>
  )
}

export default XmskApp
