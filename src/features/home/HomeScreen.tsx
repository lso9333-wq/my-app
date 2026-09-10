import { useEffect, useState } from 'react'
import './HomeScreen.css'
import { HeroSection } from './HeroSection'
import { CtaBanner } from './CtaBanner'
import { listRomSessions } from '../rom/lib/romApi'
import type { RomSessionListItem } from '../rom/types'
import type { AppTab } from '../../navigation/BottomNav'

interface FeatureCard {
  tab: AppTab
  icon: string
  title: string
  description: string
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    tab: 'gait',
    icon: '🚶',
    title: '보행 분석',
    description: '옆에서 촬영한 걷는 영상으로 케이던스·보폭·좌우 대칭성을 분석해요.',
  },
  {
    tab: 'rom',
    icon: '🤸',
    title: '스트레칭 ROM 분석',
    description: '스트레칭 전/후 구간을 지정하면 관절 가동범위 변화를 계산해요.',
  },
  {
    tab: 'xmsk',
    icon: '🩺',
    title: 'XMSK',
    description: '트레이너 전용 통증 레시피·근육 사전·현장투입 평가표.',
  },
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
}

/** Impakt류 앱의 홈 대시보드(오늘의 코칭 카드 + 최근 기록)를 참고한 랜딩 화면. */
export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [recent, setRecent] = useState<RomSessionListItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    listRomSessions(3)
      .then((sessions) => {
        if (!cancelled) setRecent(sessions)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="home-screen">
      <HeroSection onNavigate={onNavigate} />

      <section className="home-cards" aria-label="분석 시작하기">
        {FEATURE_CARDS.map((card) => (
          <button
            key={card.tab}
            type="button"
            className="home-card"
            onClick={() => onNavigate(card.tab)}
          >
            <span className="home-card-icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="home-card-body">
              <span className="home-card-title">{card.title}</span>
              <span className="home-card-desc">{card.description}</span>
            </span>
            <span className="home-card-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </section>

      <section className="home-recent">
        <div className="home-recent-head">
          <h3>최근 ROM 기록</h3>
          <button type="button" className="home-recent-link" onClick={() => onNavigate('rom')}>
            전체 보기
          </button>
        </div>

        {loadError && <p className="home-recent-empty">기록을 불러오지 못했습니다.</p>}
        {!loadError && recent === null && <p className="home-recent-empty">불러오는 중...</p>}
        {!loadError && recent !== null && recent.length === 0 && (
          <p className="home-recent-empty">아직 저장된 ROM 분석 기록이 없어요.</p>
        )}
        {!loadError && recent !== null && recent.length > 0 && (
          <ul className="home-recent-list">
            {recent.map((session) => (
              <li key={session.id} className="home-recent-row">
                <span className="home-recent-date">{formatDate(session.createdAt)}</span>
                <span className="home-recent-name">{session.videoName}</span>
                <span className="home-recent-delta">
                  {session.avgDeltaRomDeg !== null
                    ? `평균 변화 ${session.avgDeltaRomDeg > 0 ? '+' : ''}${session.avgDeltaRomDeg.toFixed(1)}°`
                    : '데이터 부족'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CtaBanner onNavigate={onNavigate} />

      <p className="disclaimer">⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>
    </div>
  )
}
