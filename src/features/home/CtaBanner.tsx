import './CtaBanner.css'
import type { AppTab } from '../../navigation/BottomNav'

interface CtaBannerProps {
  onNavigate: (tab: AppTab) => void
}

function timeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return '늦은 시간이네요'
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후예요'
  return '편안한 저녁 되세요'
}

/** Impakt류 앱의 하단 인사+CTA 배너를 참고한 섹션. 로그인 계정이 없어 이름 대신 시간대 인사를 사용합니다. */
export function CtaBanner({ onNavigate }: CtaBannerProps) {
  return (
    <section className="cta-banner">
      <p className="cta-banner-greeting">{timeGreeting()}!</p>
      <p className="cta-banner-copy">지금 바로 걷는 영상을 올려서 보행을 분석해보세요.</p>
      <button type="button" className="cta-banner-button" onClick={() => onNavigate('gait')}>
        보행 분석 시작하기 →
      </button>
    </section>
  )
}
