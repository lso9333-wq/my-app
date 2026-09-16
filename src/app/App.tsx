import { useState } from 'react'
import './App.css'
import { HomeScreen } from '../features/home/HomeScreen'
import GaitApp from '../features/gait/GaitApp'
import RomApp from '../features/rom/RomApp'
import HandFootApp from '../features/handfoot/HandFootApp'
import XmskApp from '../features/xmsk/XmskApp'
import EegApp from '../features/eeg/EegApp'
import XctsApp from '../features/xcts/XctsApp'
import { BottomNav, type AppTab } from '../navigation/BottomNav'
import { InfoModal } from '../shared/components/InfoModal'
import { AppPasswordGate } from '../shared/components/AppPasswordGate'
import { clearStoredToken, getStoredToken, storeToken } from '../shared/lib/authApi'
import { INFO_PAGES, FOOTER_LINKS, type InfoKey } from './legalContent'

const TAB_TITLES: Record<AppTab, string> = {
  home: 'MyDoctor',
  gait: '보행 분석',
  rom: '스트레칭 가동범위 분석',
  handfoot: '손·발 분석',
  xmsk: 'XMSK',
  eeg: '뇌파 실시간 표시',
  xcts: 'XCTS',
}

// 로그인(비밀번호 잠금)이 필요한 탭 — 트레이너 전용 도구인 보행/ROM/손발/XMSK/XCTS/뇌파 6개.
//
// 2026-09 보안 점검(사용자 질문 "지금까지 작업에 대한 보안은 철저하게 되는거야?")에서
// 이 4개 탭의 서버 API에 인증이 전혀 없다는 게 드러나(회원 이름이 담긴 기록을 누구나
// 만들고/읽고/지울 수 있었음 — server/xmskAuth.ts의 requireAuth 주석 참고), XMSK가
// 이미 쓰고 있던 비밀번호/토큰을 4개 탭 전체로 확대했다. 토큰은 이제 XmskApp이 아니라
// 여기 App.tsx가 최상위에서 하나로 관리한다 — 그래야 한 탭에서 토큰이 만료돼도(401)
// 다른 탭들도 같이 잠금 화면으로 돌아간다(onAuthError → handleLock).
//
// 홈은 로그인 없이 누구나 볼 수 있어야 하는 랜딩 화면이라 뺐다.
//
// 2026-09 추가: XCTS(심혈관/전신 컨디션 측정 도구 모음)도 회원 이름이 담긴 기록을
// 서버에 저장하므로 같은 이유로 여기에 포함한다 — 별도 비밀번호를 새로 만들지 않고
// 이미 있는 앱 전체 로그인을 그대로 재사용한다(트레이너 도구마다 다른 비밀번호를
// 두지 않는다는 원래 결정과 같은 이유).
//
// 2026-09 추가: 뇌파(EEG)도 원래는 100% 클라이언트 전용이라 로그인 없이 뒀지만
// ("서버에 저장할 회원 개인정보가 없다"는 게 이유였음 — EegApp.tsx 상단 주석 참고),
// XCTS처럼 회원별 기록을 저장하는 기능이 추가되면서 그 전제가 깨졌다. 같은 이유로
// 여기에 포함한다.
const GATED_TABS: ReadonlySet<AppTab> = new Set(['gait', 'rom', 'handfoot', 'xmsk', 'xcts', 'eeg'])

function App() {
  const [tab, setTab] = useState<AppTab>('home')
  const [homeResetKey, setHomeResetKey] = useState(0)
  const [activeInfo, setActiveInfo] = useState<InfoKey | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())

  // 홈 탭 아이콘을 누르면 이미 홈 탭이어도(대시보드 2페이지에 있어도) 항상
  // 1페이지(히어로)부터 다시 보여주도록 HomeScreen을 강제로 리마운트합니다.
  const handleTabChange = (next: AppTab) => {
    if (next === 'home') {
      setHomeResetKey((key) => key + 1)
    }
    setTab(next)
  }

  const handleUnlock = (t: string) => {
    storeToken(t)
    setToken(t)
  }

  const handleLock = () => {
    clearStoredToken()
    setToken(null)
  }

  // 홈 화면은 히어로 자체에 브랜드 로고가 있고, 화면당 내용이 핸드폰 한 화면에
  // 딱 맞아야 해서 공용 헤더/푸터는 숨기고, 안내 링크는 홈의 2페이지(대시보드)
  // 안에서 직접 렌더링합니다 (onOpenInfo로 같은 모달을 재사용).
  const isHome = tab === 'home'
  const isGatedTab = GATED_TABS.has(tab)
  const needsGate = isGatedTab && !token

  return (
    <div className="app-shell">
      {!isHome && (
        <header className="app-header">
          <h1>{TAB_TITLES[tab]}</h1>
          {isGatedTab && token && (
            <button type="button" onClick={handleLock}>
              잠그기
            </button>
          )}
        </header>
      )}

      <main className="app-content">
        {tab === 'home' && (
          <HomeScreen key={homeResetKey} onNavigate={handleTabChange} onOpenInfo={setActiveInfo} />
        )}
        {needsGate && <AppPasswordGate onUnlock={handleUnlock} />}
        {!needsGate && tab === 'gait' && <GaitApp token={token!} onAuthError={handleLock} />}
        {!needsGate && tab === 'rom' && <RomApp token={token!} onAuthError={handleLock} />}
        {!needsGate && tab === 'handfoot' && <HandFootApp token={token!} onAuthError={handleLock} />}
        {!needsGate && tab === 'xmsk' && <XmskApp token={token!} onLock={handleLock} />}
        {!needsGate && tab === 'xcts' && <XctsApp token={token!} onAuthError={handleLock} />}
        {!needsGate && tab === 'eeg' && <EegApp token={token!} onAuthError={handleLock} />}
      </main>

      {!isHome && (
        <footer className="app-footer">
          <nav className="app-footer-links" aria-label="사이트 정보">
            {FOOTER_LINKS.map((link) => (
              <button key={link.key} type="button" onClick={() => setActiveInfo(link.key)}>
                {link.label}
              </button>
            ))}
          </nav>
          <p className="app-footer-copyright">Copyright © 2026 MyDoctor. All Rights Reserved.</p>
        </footer>
      )}

      <BottomNav active={tab} onChange={handleTabChange} />

      {activeInfo && <InfoModal page={INFO_PAGES[activeInfo]} onClose={() => setActiveInfo(null)} />}

      {/*
        PDF 내보내기는 결과 화면의 "PDF로 다운로드" 버튼을 눌러야만 동작한다(그 버튼이
        클릭 시점에만 인쇄 대상에 클래스를 붙이기 때문 — PdfExportButton.tsx 참고).
        브라우저 자체의 "인쇄/PDF" 메뉴(모바일 크롬의 ⋮ 메뉴 등)로 아무 페이지에서나
        인쇄를 실행하면, 그 클래스가 전혀 붙지 않은 상태이므로 App.css의
        `body * { visibility: hidden }` 규칙만 적용되어 완전히 빈 페이지가 인쇄된다
        (실제로 사용자가 이렇게 시도해 빈 페이지를 겪은 것으로 확인됨). 이건 버그가
        아니라 이 방식의 당연한 결과이지만, 아무 안내 없이 빈 종이만 나오면 매우
        혼란스러우므로, 그런 상황(인쇄 대상 클래스가 어디에도 없을 때)에만 화면
        전체를 대신해 안내 문구가 인쇄되도록 해둔다.
      */}
      <div id="print-fallback-notice" className="print-fallback-notice">
        인쇄할 내용이 선택되지 않았습니다.
        <br />
        웹페이지 메뉴의 "인쇄/PDF"가 아니라, 결과 화면 안에 있는 <strong>"PDF로 다운로드"</strong> 버튼을
        눌러주세요.
      </div>
    </div>
  )
}

export default App
