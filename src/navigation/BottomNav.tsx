import './BottomNav.css'

export type AppTab = 'home' | 'gait' | 'rom' | 'handfoot' | 'xmsk' | 'eeg' | 'xcts'

interface NavItem {
  key: AppTab
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'gait', label: '보행', icon: '🚶' },
  { key: 'rom', label: 'ROM', icon: '🤸' },
  { key: 'handfoot', label: '손·발', icon: '✋' },
  { key: 'xmsk', label: 'XMSK', icon: '🩺' },
  { key: 'eeg', label: '뇌파', icon: '🧠' },
  { key: 'xcts', label: 'XCTS', icon: '❤️' },
]

interface BottomNavProps {
  active: AppTab
  onChange: (tab: AppTab) => void
}

/** Impakt류 앱의 하단 탭바 방식을 참고한 전역 네비게이션. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="주요 화면 전환">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={active === item.key ? 'bottom-nav-item active' : 'bottom-nav-item'}
          onClick={() => onChange(item.key)}
          aria-current={active === item.key ? 'page' : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
