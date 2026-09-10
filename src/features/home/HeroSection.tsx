import './HeroSection.css'
import type { AppTab } from '../../navigation/BottomNav'

interface HeroSectionProps {
  onNavigate: (tab: AppTab) => void
}

const FEATURES = [
  { icon: '🤖', title: '실시간 포즈 분석', desc: '촬영한 영상에서 프레임마다 관절 위치를 추출해요.' },
  { icon: '🚶', title: '보행 케이던스 · 대칭성', desc: '걸음 리듬과 좌우 균형을 수치로 보여줘요.' },
  { icon: '🤸', title: 'ROM(가동범위) 추적', desc: '스트레칭 전/후 관절 각도 변화를 계산해요.' },
  { icon: '🩺', title: 'XMSK 트레이너 도구', desc: '통증 레시피 · 근육 사전 · 평가표를 제공해요.' },
]

/**
 * 홈 화면 상단 히어로. 브랜드 로고 + 일러스트 + 헤드라인/기능 리스트/CTA로 구성된
 * 2단 레이아웃(Impakt류 앱의 랜딩 스타일을 참고)이지만, 실제로 이 앱이 하는 일
 * (촬영 영상의 포즈 스켈레톤 분석)을 그대로 보여주는 오리지널 일러스트를 사용합니다.
 */
export function HeroSection({ onNavigate }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-topbar">
        <span className="hero-signal" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="hero-signal-icon">
            <circle cx="5" cy="19" r="3" fill="currentColor" />
            <path d="M5 13a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M5 8a14 14 0 0 1 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path
              d="M5 3a19 19 0 0 1 19 19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />
          </svg>
        </span>
        <span className="hero-logo">MyDoctor(내AI주치의)</span>
      </div>

      <div className="hero-grid">
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-glow" />
          <span className="hero-handwritten">찍기만 해도 분석 끝!</span>
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
          <ul className="hero-feature-list">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="hero-feature-item">
                <span className="hero-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <span className="hero-feature-body">
                  <span className="hero-feature-title">{feature.title}</span>
                  <span className="hero-feature-desc">{feature.desc}</span>
                </span>
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
