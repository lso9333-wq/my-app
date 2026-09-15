import { useEffect, useState, type KeyboardEvent } from 'react'
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
 * 2026-09: 사용자 요청으로 왼쪽 위 일러스트를 여러 차례 개선했다.
 * 1) "실제 인체가 움직이는 모습에 포인트가 나오게" — 얇은 뼈대선(stroke-width 2.5)만
 *    있던 걸 굵은 실루엣처럼 보이게 두껍게(9) 바꾸고, 몸통엔 은은한 채움
 *    (hero-body-fill)을 더해 진짜 몸처럼 보이게 했다. 관절 위치의 점(포인트)은
 *    원래도 있었지만, 은은한 펄스 애니메이션(heroJointPulse)을 줘서 실제 포즈
 *    인식이 지금 이 순간 관절을 찍고 있는 것처럼 보이게 했고, 전신에는 아주 미세한
 *    좌우 흔들림(heroFigureSway)을 줘서 "움직이는" 느낌을 계속 준다(둘 다
 *    prefers-reduced-motion이면 꺼짐 — HeroSection.css 참고).
 * 2) "클릭시 전과 후를 보이게" → "허리를 구부리는 모습" → "오른쪽으로도" — 골반(hip)
 *    라인 위쪽 전체(머리·목·어깨·양팔·몸통 채움 — hero-bend-toggle 그룹)를 하나의
 *    강체로 묶어, 골반 중심(뷰박스 200x260 기준 100,140 → 50%, 53.85%)을 축으로
 *    회전시킨다. 다리는 그 축 아래에 고정해 "발은 그대로 딛고 상체만 숙이는" 자세를
 *    만든다. 정면 → 왼쪽 굽히기(-45deg) → 오른쪽 굽히기(+45deg)로 순환한다(같은
 *    회전을 부호만 반대로 — 골반 축 기준 좌우 대칭이라 각도 크기는 같다).
 *    (참고: 회전축이 몸통 채움 폴리곤의 중심이라, 폴리곤 양 끝 모서리는 축에서
 *    떨어져 있어 회전 시 아래쪽 고정된 골반 관절과 아주 살짝 어긋나 보일 수 있다 —
 *    이 정도 각도에서는 두꺼운 선/둥근 관절 점이 그 틈을 자연스럽게 가려줘 장식용
 *    일러스트 수준에서는 문제없다고 판단했다.)
 * 3) "클릭 없이도 자동 반복 + 표정" — figurePose가 바뀔 때마다(마운트 시 최초 1회
 *    포함) 1초 뒤 다음 자세로 넘어가는 setTimeout을 다시 건다(매번 새로 걸기 때문에
 *    사용자가 직접 클릭해도 그 시점부터 다시 1초가 시작되어 자연스럽다).
 *    prefers-reduced-motion이면 자동 전환 자체를 걸지 않는다(클릭으로 넘기는 건
 *    계속 가능). 표정은 머리 원 위에 눈 2개 + 입 곡선(+직립일 때만 찌푸린 눈썹)을
 *    얹어서, 직립(정면)일 땐 찡그린("⌢" 입) 얼굴, 그 외 자세는 웃는("⌣" 입) 얼굴이
 *    되게 했다. 색은 머리 원 채움(--text)과 반대색인 --surface를 써서 라이트/다크
 *    모드 둘 다에서 항상 대비가 나오게 했다.
 * 4) "런지 동작을 4가지로 구분해서 추가" — 정면/좌/우 3가지 허리 굽히기 자세 뒤에
 *    런지 4단계(lungeStart→lungeDown→lungeWeight→lungeUp)를 이어 붙여 총 7단계를
 *    순환한다. 다리 모양 자체가 좌우 대칭이 아니라 상체 회전만으로는 표현할 수
 *    없어서, 다리를 legPose라는 별도 데이터(LEG_POSES)로 분리해 자세마다 다른
 *    허벅지·정강이·발 좌표를 쓰도록 리팩터링했다(엉덩이 관절 위치는 네 자세 모두
 *    (85,140)/(115,140)으로 고정 — 실제로는 스쿼트성 동작에서 골반도 약간
 *    내려가지만, 장식용 아이콘 수준에서 상체를 다시 옮기지 않고 다리 각도만
 *    바꿔도 충분히 "런지"로 읽힌다고 판단해 골반은 고정했다). 왼쪽 다리를 항상
 *    앞발로 뒀다:
 *      - lungeStart(시작 자세): 양발을 벌리고 선 상태에서 앞발을 크게 내딛고
 *        뒷발 뒤꿈치를 든 자세 — 무릎은 아직 크게 굽히지 않는다.
 *      - lungeDown(내려가기): 앞무릎은 허벅지가 수평·정강이가 수직이 되도록,
 *        뒷무릎도 거의 90도로 굽혀 두 무릎 모두 직각에 가깝게 내려간다. 앞무릎
 *        x좌표가 앞꿈치 x좌표를 넘지 않게 잡아서 "무릎이 발끝을 넘지 않는다"는
 *        조건도 좌표로 반영했다.
 *      - lungeWeight(체중 중심): 다리 좌표는 lungeDown과 똑같이 두고(실제로
 *        체중 이동은 눈에 보이는 큰 자세 변화가 아니라 무게 중심 얘기라, 자세를
 *        또 바꾸기보다) 앞발 뒤꿈치 위치에 강조 점(hero-weight-marker, --accent
 *        색 + 확대·페이드 펄스)을 띄워 "체중은 여기"라는 걸 보여준다.
 *      - lungeUp(올라오기): "처음 자세로 돌아옵니다"라는 설명 그대로 lungeStart와
 *        같은 좌표를 그대로 재사용한다(손글씨 문구·칩 값·aria-label만 다르다).
 *    런지 구간에서는 hero-bend-toggle에 left/right 클래스를 주지 않아 상체가
 *    항상 똑바로 선 상태를 유지한다("허리를 곧게 펴고"). "가동범위 변화" 칩은
 *    런지 구간에서 "무릎 각도"로 라벨이 바뀌고 값도 160°(편 상태)/90°(굽힌 상태)로
 *    바뀐다.
 */
type FigurePose = 'straight' | 'left' | 'right' | 'lungeStart' | 'lungeDown' | 'lungeWeight' | 'lungeUp'

type LegPoseKey = 'stand' | 'lungeStand' | 'lungeDown'

interface LegSide {
  knee: readonly [number, number]
  ankle: readonly [number, number]
  toe?: readonly [number, number]
}

interface LegPose {
  hipLeft: readonly [number, number]
  hipRight: readonly [number, number]
  left: LegSide
  right: LegSide
}

// 다리 좌표 모음 — 엉덩이는 항상 (85,140)/(115,140)로 고정. 왼쪽=앞발(파란
// joint-left), 오른쪽=뒷발(주황 joint-right)로 일관되게 잡았다.
const LEG_POSES: Record<LegPoseKey, LegPose> = {
  // 원래 서 있는 자세(허리 굽히기 데모용) — 기존 좌표 그대로, 발 선 없음.
  stand: {
    hipLeft: [85, 140],
    hipRight: [115, 140],
    left: { knee: [70, 190], ankle: [60, 240] },
    right: { knee: [130, 180], ankle: [150, 230] },
  },
  // 런지 시작/올라오기 — 앞발을 크게 내딛고, 뒷발은 거의 편 채 뒤꿈치만 든다.
  lungeStand: {
    hipLeft: [85, 140],
    hipRight: [115, 140],
    left: { knee: [65, 180], ankle: [50, 222], toe: [30, 226] },
    right: { knee: [138, 172], ankle: [155, 210], toe: [172, 230] },
  },
  // 런지 내려가기/체중 중심 — 앞무릎(허벅지 수평+정강이 수직=90도), 뒷무릎도
  // 거의 90도로 굽어 바닥 가까이 내려간다(뒷꿈치는 계속 들려 있다).
  lungeDown: {
    hipLeft: [85, 140],
    hipRight: [115, 140],
    left: { knee: [55, 140], ankle: [55, 192], toe: [35, 196] },
    right: { knee: [130, 178], ankle: [162, 172], toe: [180, 186] },
  },
}

const LEG_POSE_FOR_FIGURE_POSE: Record<FigurePose, LegPoseKey> = {
  straight: 'stand',
  left: 'stand',
  right: 'stand',
  lungeStart: 'lungeStand',
  lungeDown: 'lungeDown',
  lungeWeight: 'lungeDown',
  lungeUp: 'lungeStand',
}

const NEXT_FIGURE_POSE: Record<FigurePose, FigurePose> = {
  straight: 'left',
  left: 'right',
  right: 'lungeStart',
  lungeStart: 'lungeDown',
  lungeDown: 'lungeWeight',
  lungeWeight: 'lungeUp',
  lungeUp: 'straight',
}

const FIGURE_POSE_LABEL: Record<FigurePose, string> = {
  straight: '탭하면 허리 굽히기!',
  left: '짜잔, 왼쪽으로 허리가 굽혀졌어요!',
  right: '이번엔 오른쪽으로 굽혀볼게요!',
  lungeStart: '이번엔 런지! 한쪽 다리를 크게 내딛어요',
  lungeDown: '무릎이 90도가 될 때까지 내려가요',
  lungeWeight: '체중은 앞발 뒤꿈치에 실어요!',
  lungeUp: '앞꿈치로 밀어내며 올라와요',
}

const FIGURE_POSE_CHIP2_LABEL: Record<FigurePose, string> = {
  straight: '가동범위 변화',
  left: '가동범위 변화',
  right: '가동범위 변화',
  lungeStart: '무릎 각도',
  lungeDown: '무릎 각도',
  lungeWeight: '무릎 각도',
  lungeUp: '무릎 각도',
}

const FIGURE_POSE_CHIP2_VALUE: Record<FigurePose, string> = {
  straight: '0°',
  left: '+45°',
  right: '-45°',
  lungeStart: '160°',
  lungeDown: '90°',
  lungeWeight: '90°',
  lungeUp: '160°',
}

const FIGURE_POSE_ARIA_LABEL: Record<FigurePose, string> = {
  straight: '스트레칭 동작 비교 — 현재 정면 자세. 탭하면 다음 동작을 보여줍니다',
  left: '스트레칭 동작 비교 — 현재 왼쪽으로 굽힌 자세. 탭하면 다음 동작을 보여줍니다',
  right: '스트레칭 동작 비교 — 현재 오른쪽으로 굽힌 자세. 탭하면 런지 시작 자세를 보여줍니다',
  lungeStart: '런지 동작 — 현재 시작 자세(다리를 앞으로 내딛고 뒤꿈치를 든 자세). 탭하면 내려가는 자세를 보여줍니다',
  lungeDown: '런지 동작 — 현재 무릎을 90도로 굽혀 내려간 자세. 탭하면 체중 중심 자세를 보여줍니다',
  lungeWeight: '런지 동작 — 앞발 뒤꿈치에 체중을 싣는 자세. 탭하면 올라오는 자세를 보여줍니다',
  lungeUp: '런지 동작 — 현재 올라오는 자세. 탭하면 정면 자세로 돌아갑니다',
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  const [figurePose, setFigurePose] = useState<FigurePose>('straight')
  const isSmiling = figurePose !== 'straight'
  const legPose = LEG_POSES[LEG_POSE_FOR_FIGURE_POSE[figurePose]]

  const cycleFigurePose = () => setFigurePose((prev) => NEXT_FIGURE_POSE[prev])

  const handleArtKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cycleFigurePose()
    }
  }

  // 정면 1초 · 왼쪽 1초 · 오른쪽 1초 · 런지 4단계 1초씩 자동 반복. figurePose가
  // 바뀔 때마다 다음 자세로 넘어갈 1초짜리 타이머를 새로 건다 — 사용자가 중간에
  // 클릭해도 그 시점부터 다시 1초가 시작되도록. prefers-reduced-motion에서는
  // 자동 전환을 걸지 않는다(클릭으로 직접 넘기는 건 계속 가능).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const timerId = window.setTimeout(() => {
      setFigurePose((prev) => NEXT_FIGURE_POSE[prev])
    }, 1000)
    return () => window.clearTimeout(timerId)
  }, [figurePose])

  return (
    <section className="hero">
      {/* 2026-09: 로고 아이콘 — 원래는 신호(와이파이형) 아이콘이었는데, "그록봇과
          비슷하게" 바꿔 달라는 요청이 있었다. 실제 그록(Grok)의 로고/마스코트를
          그대로 따라 그리는 건 상표를 베끼는 것이라 하지 않고, 대신 그록을 포함해
          여러 AI 서비스 로고들이 흔히 쓰는 "스파크/소용돌이" 스타일(둥근 날개
          3개가 중심에서 뻗어나가는 추상적인 모양)만 참고해 완전히 새로 그린
          오리지널 아이콘이다. 날개마다 불투명도를 다르게 줘(1 → 0.7 → 0.45)
          기존 신호 아이콘의 "겹겹이 번지는" 느낌을 이어간다. */}
      <div className="hero-topbar">
        <span className="hero-signal" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="hero-signal-icon">
            <g transform="translate(12,12)">
              <path
                d="M0,0 C-1.1,-3.6 -0.6,-7.4 1.8,-9.4 C3.7,-11 6.2,-10.3 6.4,-8.1 C6.6,-5.6 4.2,-2.4 0,0 Z"
                fill="currentColor"
              />
              <path
                d="M0,0 C-1.1,-3.6 -0.6,-7.4 1.8,-9.4 C3.7,-11 6.2,-10.3 6.4,-8.1 C6.6,-5.6 4.2,-2.4 0,0 Z"
                fill="currentColor"
                opacity="0.7"
                transform="rotate(120)"
              />
              <path
                d="M0,0 C-1.1,-3.6 -0.6,-7.4 1.8,-9.4 C3.7,-11 6.2,-10.3 6.4,-8.1 C6.6,-5.6 4.2,-2.4 0,0 Z"
                fill="currentColor"
                opacity="0.45"
                transform="rotate(240)"
              />
              <circle cx="0" cy="0" r="1.6" fill="currentColor" />
            </g>
          </svg>
        </span>
        <span className="hero-logo">MyDoctor(내AI주치의)</span>
      </div>

      <div className="hero-grid">
        <div
          className="hero-art"
          role="button"
          tabIndex={0}
          aria-label={FIGURE_POSE_ARIA_LABEL[figurePose]}
          onClick={cycleFigurePose}
          onKeyDown={handleArtKeyDown}
        >
          <div className="hero-art-glow" aria-hidden="true" />
          <span className="hero-handwritten" aria-hidden="true">
            {FIGURE_POSE_LABEL[figurePose]}
          </span>
          <svg viewBox="0 0 200 260" className="hero-figure" aria-hidden="true">
            {/* 다리 — 허리 굽히기 자세에서는 발이 그대로 딛고 있어야 하므로 회전
                그룹(hero-bend-toggle) 밖에 고정해 둔다. 자세(figurePose)에 따라
                legPose(LEG_POSES)에서 다른 좌표를 가져와 그린다 — 엉덩이 좌표는
                항상 고정, 무릎/발목/발끝만 자세마다 다르다. */}
            <g className="hero-figure-lines">
              <line x1={legPose.hipLeft[0]} y1={legPose.hipLeft[1]} x2={legPose.hipRight[0]} y2={legPose.hipRight[1]} />
              <line x1={legPose.hipLeft[0]} y1={legPose.hipLeft[1]} x2={legPose.left.knee[0]} y2={legPose.left.knee[1]} />
              <line x1={legPose.left.knee[0]} y1={legPose.left.knee[1]} x2={legPose.left.ankle[0]} y2={legPose.left.ankle[1]} />
              {legPose.left.toe && (
                <line
                  x1={legPose.left.ankle[0]}
                  y1={legPose.left.ankle[1]}
                  x2={legPose.left.toe[0]}
                  y2={legPose.left.toe[1]}
                />
              )}
              <line x1={legPose.hipRight[0]} y1={legPose.hipRight[1]} x2={legPose.right.knee[0]} y2={legPose.right.knee[1]} />
              <line
                x1={legPose.right.knee[0]}
                y1={legPose.right.knee[1]}
                x2={legPose.right.ankle[0]}
                y2={legPose.right.ankle[1]}
              />
              {legPose.right.toe && (
                <line
                  x1={legPose.right.ankle[0]}
                  y1={legPose.right.ankle[1]}
                  x2={legPose.right.toe[0]}
                  y2={legPose.right.toe[1]}
                />
              )}
            </g>
            <g className="joint joint-left">
              <circle cx={legPose.hipLeft[0]} cy={legPose.hipLeft[1]} r="5" />
              <circle cx={legPose.left.knee[0]} cy={legPose.left.knee[1]} r="5" />
              <circle cx={legPose.left.ankle[0]} cy={legPose.left.ankle[1]} r="5" />
            </g>
            <g className="joint joint-right">
              <circle cx={legPose.hipRight[0]} cy={legPose.hipRight[1]} r="5" />
              <circle cx={legPose.right.knee[0]} cy={legPose.right.knee[1]} r="5" />
              <circle cx={legPose.right.ankle[0]} cy={legPose.right.ankle[1]} r="5" />
            </g>
            {/* 런지 "체중 중심" 단계에서만 앞발 뒤꿈치 위치에 강조 점을 띄운다 —
                이 단계는 lungeDown과 다리 자세 자체는 같고(실제로 체중 이동은
                큰 자세 변화가 아니라 무게 중심 얘기라) 강조 점으로만 구분한다. */}
            {figurePose === 'lungeWeight' && (
              <circle
                className="hero-weight-marker"
                cx={legPose.left.ankle[0]}
                cy={legPose.left.ankle[1]}
                r="9"
                aria-hidden="true"
              />
            )}
            {/* 골반 중심(100,140)을 축으로 상체 전체(머리·목·어깨·양팔·몸통 채움)를
                하나로 묶어 회전시킨다 — figurePose가 left/right일 때만 회전 클래스가
                붙어 좌우로 허리를 굽힌 자세가 되고, 런지 단계에서는 클래스가 붙지
                않아 상체가 항상 똑바로 선 상태(허리를 곧게 편 자세)를 유지한다. */}
            <g className={`hero-bend-toggle${figurePose === 'left' || figurePose === 'right' ? ` ${figurePose}` : ''}`}>
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
              {/* 표정 — 직립일 땐 찡그린(찌푸린 눈썹 + "⌢" 입) 얼굴, 그 외 자세(좌/우
                  굽히기·런지 전체)는 웃는("⌣" 입) 얼굴. 머리 채움(--text)과 반대색인
                  --surface를 써서 라이트/다크 모드 어디서나 대비가 보이게 했다. */}
              <g className="hero-face" aria-hidden="true">
                {!isSmiling && (
                  <g className="hero-face-brows">
                    <line x1="90" y1="19" x2="97" y2="22" />
                    <line x1="110" y1="19" x2="103" y2="22" />
                  </g>
                )}
                <circle className="hero-face-eye" cx="94" cy="25" r="1.8" />
                <circle className="hero-face-eye" cx="106" cy="25" r="1.8" />
                {isSmiling ? (
                  <path className="hero-face-mouth" d="M92,31 Q100,37 108,31" />
                ) : (
                  <path className="hero-face-mouth" d="M92,38 Q100,32 108,38" />
                )}
              </g>
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
            <span className="hero-chip-label">{FIGURE_POSE_CHIP2_LABEL[figurePose]}</span>
            <span className="hero-chip-value">{FIGURE_POSE_CHIP2_VALUE[figurePose]}</span>
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
