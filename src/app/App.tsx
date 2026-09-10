import { useState } from 'react'
import './App.css'
import { HomeScreen } from '../features/home/HomeScreen'
import GaitApp from '../features/gait/GaitApp'
import RomApp from '../features/rom/RomApp'
import XmskApp from '../features/xmsk/XmskApp'
import { BottomNav, type AppTab } from '../navigation/BottomNav'

const TAB_TITLES: Record<AppTab, string> = {
  home: 'MyDoctor',
  gait: '보행 분석',
  rom: '스트레칭 가동범위 분석',
  xmsk: 'XMSK',
}

function App() {
  const [tab, setTab] = useState<AppTab>('home')

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

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

export default App
