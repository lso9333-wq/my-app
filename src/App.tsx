import { useState } from 'react'
import './App.css'
import GaitApp from './GaitApp'
import RomApp from './RomApp'
import XmskApp from './XmskApp'

type Tab = 'gait' | 'rom' | 'xmsk'

function App() {
  const [tab, setTab] = useState<Tab>('gait')

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>MyDoctor</h1>
        <nav className="app-tabs">
          <button
            type="button"
            className={tab === 'gait' ? 'app-tab active' : 'app-tab'}
            onClick={() => setTab('gait')}
          >
            보행 분석
          </button>
          <button
            type="button"
            className={tab === 'rom' ? 'app-tab active' : 'app-tab'}
            onClick={() => setTab('rom')}
          >
            스트레칭 가동범위 분석
          </button>
          <button
            type="button"
            className={tab === 'xmsk' ? 'app-tab active' : 'app-tab'}
            onClick={() => setTab('xmsk')}
          >
            XMSK
          </button>
        </nav>
      </header>

      {tab === 'gait' && <GaitApp />}
      {tab === 'rom' && <RomApp />}
      {tab === 'xmsk' && <XmskApp />}
    </div>
  )
}

export default App
