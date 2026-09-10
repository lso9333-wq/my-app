import './HeroSection.css'
import type { AppTab } from '../../navigation/BottomNav'

interface HeroSectionProps {
  onNavigate: (tab: AppTab) => void
}

const CHECKLIST = [
  '실시간 포즈 분석',
  '보행 케이던스 · 좌우 대칭성',
  '스트레칭 가동범위(ROM) 추적',
  '트레이너 전용 XMSK 도구',
]

/**
 * 홈 화면 상단 히어로. 브랜드 로고 + 일러스트 + 헤드라인/체크리스트/CTA로 구성된
 * 2단 레이아웃(Impakt류 앱의 랜딩 스타일을 참고)이지만, 실제로 이 앱이 하는 일
 * (촬영 영상의 포즈 스켈레톤 분석)을 그대로 보여주는 오리지널 일러스트를 사용합니다.
 */
export function HeroSection({ onNavigate }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-topbar">
        <span className="hero-logo">MyDoctor(내AI주치의)</span>
      </div>

      <div className="hero-grid">
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-glow" />
          <svg viewBox="0 0 200 260" className="hero-figure">
            <g className="hero-figure-lines">
              <line x1="100" y1="42" x2="100" y2="60" />
              <line x1="80" y1="60" x2="120" y2="60" />
              <line x1="80" y1="60" x2="60" y2="90" />
              <line x1="60" y1="90" x2="70" y2="120" />
              <line x1="120" y1="60" x2="140" y2="85" />
              <line x1="140" y1="85" x2="155" y2="60" />
              <line x1="80" y1="60" x2="85" y2="140" />
              <line x1="120" y1="60" x2="115" y2="140" />
              <line x1="85" y1="140" x2="115" y2="140" />
              <line x1="85" y1="140" x2="70" y2="190" />
              <line x1="70" y1="190" x2="60" y2="240" />
              <line x1="115" y1="140" x2="130" y2="180" />
              <line x1="130" y1="180" x2="150" y2="230" />
            </g>
            <circle className="joint" cx="100" cy="28" r="14" />
            <g className="joint joint-left">
              <circle cx="80" cy="60" r="5" />
              <circle cx="60" cy="90" r="5" />
              <circle cx="70" cy="120" r="5" />
              <circle cx="85" cy="140" r="5" />
              <circle cx="70" cy="190" r="5" />
              <circle cx="60" cy="240" r="5" />
            </g>
            <g className="joint joint-right">
              <circle cx="120" cy="60" r="5" />
              <circle cx="140" cy="85" r="5" />
              <circle cx="155" cy="60" r="5" />
              <circle cx="115" cy="140" r="5" />
              <circle cx="130" cy="180" r="5" />
              <circle cx="150" cy="230" r="5" />
            </g>
          </svg>
          <div className="hero-chip hero-chip-1">
            <span className="hero-chip-label">케이던스</span>
            <span className="hero-chip-value">108 spm</span>
          </div>
          <div className="hero-chip hero-chip-2">
            <span className="hero-chip-label">가동범위 변화</span>
            <span className="hero-chip-value">+14°</span>
          </div>
        </div>

        <div className="hero-copy">
          <h2 className="hero-title">
            더 건강해지고,
            <br />
            회복은 더 빨라지세요.
          </h2>
          <ul className="hero-checklist">
            {CHECKLIST.map((item) => (
              <li key={item}>
                <svg viewBox="0 0 20 20" className="hero-check-icon" aria-hidden="true">
                  <circle cx="10" cy="10" r="10" />
                  <path d="M6 10.5l2.5 2.5L14 7" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <button type="button" className="hero-cta" onClick={() => onNavigate('gait')}>
            지금 분석 시작하기 →
          </button>
        </div>
      </div>

      <p className="hero-trust">🔒 영상은 서버로 전송되지 않고 브라우저 안에서만 분석됩니다.</p>
    </section>
  )
}
