import { useState, type KeyboardEvent } from 'react'
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
 *
 * 2026-09: 사용자 요청으로 왼쪽 위 일러스트를 두 가지로 개선했다.
 * 1) "실제 인체가 움직이는 모습에 포인트가 나오게" — 얇은 뼈대선(stroke-width 2.5)만
 *    있던 걸 굵은 실루엣처럼 보이게 두껍게(9) 바꾸고, 몸통엔 은은한 채움
 *    (hero-body-fill)을 더해 진짜 몸처럼 보이게 했다. 관절 위치의 점(포인트)은
 *    원래도 있었지만, 은은한 펄스 애니메이션(heroJointPulse)을 줘서 실제 포즈
 *    인식이 지금 이 순간 관절을 찍고 있는 것처럼 보이게 했고, 전신에는 아주 미세한
 *    좌우 흔들림(heroFigureSway)을 줘서 "움직이는" 느낌을 계속 준다(둘 다
 *    prefers-reduced-motion이면 꺼짐 — HeroSection.css 참고).
 * 2) "클릭시 전과 후를 보이게" — 처음엔 오른팔만 따로 들어 올리는 걸로 구현했었지만,
 *    이후 사용자 요청으로 "클릭시 허리를 구부리는 모습"으로 바뀌었다. 이제 골반(hip)
 *    라인 위쪽 전체(머리·목·어깨·양팔·몸통 채움 — hero-bend-toggle 그룹)를 하나의
 *    강체로 묶어, 골반 중심(뷰박스 200x260 기준 100,140 → 50%, 53.85%)을 축으로
 *    회전시킨다. 다리(허벅지·정강이·엉덩이/무릎/발목 관절)는 그 축 아래에 그대로
 *    고정해 둬서 "발은 그대로 딛고 상체만 숙이는" 허리 굽히기(전굴) 자세처럼 보이게
 *    했다. 클릭 전(showAfter=false)엔 똑바로 선 자세, 클릭하면(showAfter=true)
 *    골반을 축으로 상체가 앞으로 굽는다 — 이 앱의 실제 ROM(가동범위) 기능이
 *    스트레칭 전/후 관절 각도 변화를 재는 것과 같은 개념을 일러스트로 보여준다.
 *    (참고: 회전축이 몸통 채움 폴리곤의 중심이라, 폴리곤 양 끝 모서리는 축에서
 *    떨어져 있어 회전 시 아래쪽 고정된 골반 관절과 아주 살짝 어긋나 보일 수 있다 —
 *    이 정도 각도(45deg)에서는 두꺼운 선/둥근 관절 점이 그 틈을 자연스럽게 가려줘
 *    장식용 일러스트 수준에서는 문제없다고 판단했다.) 손글씨 문구와 "가동범위 변화"
 *    칩 값도 같은 상태에 맞춰 같이 바뀐다.
 */
export function HeroSection({ onNavigate }: HeroSectionProps) {
  const [showAfter, setShowAfter] = useState(false)

  const toggleBeforeAfter = () => setShowAfter((prev) => !prev)

  const handleArtKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleBeforeAfter()
    }
  }

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
        <div
          className="hero-art"
          role="button"
          tabIndex={0}
          aria-pressed={showAfter}
          aria-label="스트레칭 전/후 허리 가동범위 비교 보기 — 탭하면 전환됩니다"
          onClick={toggleBeforeAfter}
          onKeyDown={handleArtKeyDown}
        >
          <div className="hero-art-glow" aria-hidden="true" />
          <span className="hero-handwritten" aria-hidden="true">
            {showAfter ? '짜잔, 허리가 쭉 굽혀졌어요!' : '탭하면 허리 굽히기!'}
          </span>
          <svg viewBox="0 0 200 260" className="hero-figure" aria-hidden="true">
            {/* 다리(허벅지·정강이)와 엉덩이/무릎/발목 관절 — 허리를 굽혀도 발은 그대로
                딛고 있어야 하므로 회전 그룹(hero-bend-toggle) 밖에 고정해 둔다. */}
            <g className="hero-figure-lines">
              <line x1="85" y1="140" x2="115" y2="140" />
              <line x1="85" y1="140" x2="70" y2="190" />
              <line x1="70" y1="190" x2="60" y2="240" />
              <line x1="115" y1="140" x2="130" y2="180" />
              <line x1="130" y1="180" x2="150" y2="230" />
            </g>
            <g className="joint joint-left">
              <circle cx="85" cy="140" r="5" />
              <circle cx="70" cy="190" r="5" />
              <circle cx="60" cy="240" r="5" />
            </g>
            <g className="joint joint-right">
              <circle cx="115" cy="140" r="5" />
              <circle cx="130" cy="180" r="5" />
              <circle cx="150" cy="230" r="5" />
            </g>
            {/* 골반 중심(100,140)을 축으로 상체 전체(머리·목·어깨·양팔·몸통 채움)를
                하나로 묶어 회전시킨다 — 클릭 상태(.after)에서 허리를 굽힌 자세가
                된다. 다리는 위 static 그룹에 남아 있어 발이 그대로 딛고 있는
                것처럼 보인다. */}
            <g className={`hero-bend-toggle${showAfter ? ' after' : ''}`}>
              {/* 은은한 몸통 채움 — 뼈대선만 있던 예전 일러스트보다 "실제 몸"처럼
                  보이게 하기 위한 실루엣. 팔다리는 두꺼운 선(아래 hero-figure-lines
                  CSS)으로 같은 효과를 낸다. */}
              <polygon className="hero-body-fill" points="80,60 120,60 115,140 85,140" />
              <g className="hero-figure-lines">
                <line x1="100" y1="42" x2="100" y2="60" />
                <line x1="80" y1="60" x2="120" y2="60" />
                <line x1="80" y1="60" x2="60" y2="90" />
                <line x1="60" y1="90" x2="70" y2="120" />
                <line x1="80" y1="60" x2="85" y2="140" />
                <line x1="120" y1="60" x2="115" y2="140" />
                <line x1="120" y1="60" x2="140" y2="90" />
                <line x1="140" y1="90" x2="130" y2="120" />
              </g>
              <circle className="joint" cx="100" cy="28" r="14" />
              <g className="joint joint-left">
                <circle cx="80" cy="60" r="5" />
                <circle cx="60" cy="90" r="5" />
                <circle cx="70" cy="120" r="5" />
              </g>
              <g className="joint joint-right">
                <circle cx="120" cy="60" r="5" />
                <circle cx="140" cy="90" r="5" />
                <circle cx="130" cy="120" r="5" />
              </g>
            </g>
          </svg>
          <div className="hero-chip hero-chip-1">
            <span className="hero-chip-label">케이던스</span>
            <span className="hero-chip-value">108 spm</span>
          </div>
          <div className="hero-chip hero-chip-2">
            <span className="hero-chip-label">가동범위 변화</span>
            <span className="hero-chip-value">{showAfter ? '+45°' : '0°'}</span>
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
