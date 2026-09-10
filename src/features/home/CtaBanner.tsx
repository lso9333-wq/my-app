import './CtaBanner.css'

interface CtaBannerProps {
  onNext: () => void
}

function timeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return '늦은 시간이네요'
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후예요'
  return '편안한 저녁 되세요'
}

/**
 * Impakt류 앱의 하단 인사+CTA 배너를 참고한 섹션. 로그인 계정이 없어 이름 대신 시간대
 * 인사를 사용하며, 홈 화면 1페이지에서 2페이지(기능 대시보드)로 넘어가는 트리거 역할을 합니다.
 */
export function CtaBanner({ onNext }: CtaBannerProps) {
  return (
    <section className="cta-banner">
      <p className="cta-banner-greeting">{timeGreeting()}!</p>
      <p className="cta-banner-copy">보행 분석 · ROM 분석 · XMSK까지, MyDoctor의 기능을 살펴보세요.</p>
      <button type="button" className="cta-banner-button" onClick={onNext}>
        기능 둘러보기 →
      </button>
    </section>
  )
}
