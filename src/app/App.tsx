import { useState } from 'react'
import './App.css'
import { HomeScreen } from '../features/home/HomeScreen'
import GaitApp from '../features/gait/GaitApp'
import RomApp from '../features/rom/RomApp'
import XmskApp from '../features/xmsk/XmskApp'
import { BottomNav, type AppTab } from '../navigation/BottomNav'
import { InfoModal } from '../shared/components/InfoModal'
import { INFO_PAGES, type InfoKey } from './legalContent'

const TAB_TITLES: Record<AppTab, string> = {
  home: 'MyDoctor',
  gait: '보행 분석',
  rom: '스트레칭 가동범위 분석',
  xmsk: 'XMSK',
}

const FOOTER_LINKS: { key: InfoKey; label: string }[] = [
  { key: 'terms', label: '이용약관' },
  { key: 'privacy', label: '개인정보처리방침' },
  { key: 'about', label: '소개' },
  { key: 'contact', label: '문의하기' },
  { key: 'faq', label: '자주 묻는 질문' },
]

function App() {
  const [tab, setTab] = useState<AppTab>('home')
  const [activeInfo, setActiveInfo] = useState<InfoKey | null>(null)

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{TAB_TITLES[tab]}</h1>
      </header>

      <main className="app-content">
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'gait' && <GaitApp />}
        {tab === 'rom' && <RomApp />}
        {tab === 'xmsk' && <XmskApp />}
      </main>

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

      <BottomNav active={tab} onChange={setTab} />

      {activeInfo && <InfoModal page={INFO_PAGES[activeInfo]} onClose={() => setActiveInfo(null)} />}
    </div>
  )
}

export default App
