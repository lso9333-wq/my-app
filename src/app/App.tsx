import { useState } from 'react'
import './App.css'
import { HomeScreen } from '../features/home/HomeScreen'
import GaitApp from '../features/gait/GaitApp'
import RomApp from '../features/rom/RomApp'
import XmskApp from '../features/xmsk/XmskApp'
import { BottomNav, type AppTab } from '../navigation/BottomNav'
import { InfoModal } from '../shared/components/InfoModal'
import { INFO_PAGES, FOOTER_LINKS, type InfoKey } from './legalContent'

const TAB_TITLES: Record<AppTab, string> = {
  home: 'MyDoctor',
  gait: '보행 분석',
  rom: '스트레칭 가동범위 분석',
  xmsk: 'XMSK',
}

function App() {
  const [tab, setTab] = useState<AppTab>('home')
  const [homeResetKey, setHomeResetKey] = useState(0)
  const [activeInfo, setActiveInfo] = useState<InfoKey | null>(null)

  // 홈 탭 아이콘을 누르면 이미 홈 탭이어도(대시보드 2페이지에 있어도) 항상
  // 1페이지(히어로)부터 다시 보여주도록 HomeScreen을 강제로 리마운트합니다.
  const handleTabChange = (next: AppTab) => {
    if (next === 'home') {
      setHomeResetKey((key) => key + 1)
    }
    setTab(next)
  }

  // 홈 화면은 히어로 자체에 브랜드 로고가 있고, 화면당 내용이 핸드폰 한 화면에
  // 딱 맞아야 해서 공용 헤더/푸터는 숨기고, 안내 링크는 홈의 2페이지(대시보드)
  // 안에서 직접 렌더링합니다 (onOpenInfo로 같은 모달을 재사용).
  const isHome = tab === 'home'

  return (
    <div className="app-shell">
      {!isHome && (
        <header className="app-header">
          <h1>{TAB_TITLES[tab]}</h1>
        </header>
      )}

      <main className="app-content">
        {tab === 'home' && (
          <HomeScreen key={homeResetKey} onNavigate={handleTabChange} onOpenInfo={setActiveInfo} />
        )}
        {tab === 'gait' && <GaitApp />}
        {tab === 'rom' && <RomApp />}
        {tab === 'xmsk' && <XmskApp />}
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
    </div>
  )
}

export default App
