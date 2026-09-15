import { useEffect, useState } from 'react'
import './HomeScreen.css'
import { HeroSection } from './HeroSection'
import { CtaBanner } from './CtaBanner'
import { listRomSessions } from '../rom/lib/romApi'
import type { RomSessionListItem } from '../rom/types'
import type { AppTab } from '../../navigation/BottomNav'
import { getStoredToken } from '../../shared/lib/authApi'
import { FOOTER_LINKS, type InfoKey } from '../../app/legalContent'

type HomeStage = 'intro' | 'dashboard'

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

// 2026-09: "폰에도 Muse 헤드밴드 연결 버튼을 넣어 달라" → "1페이지로 옮겨 달라" —
// 원래 하단 탭바의 '뇌파' 탭에 이미 연결 버튼(EegApp.tsx의 eeg-connect-button)이
// 있었지만, 홈 화면에서 바로 갈 수 있는 바로가기가 없었다. 처음엔 2페이지
// FEATURE_CARDS에 넣었는데, 사용자가 실제로 1페이지(히어로 화면)를 보고 있다가
// "안 보인다"고 해서 — 2페이지로 넘어가야만 보이는 위치라 눈에 안 띄었다 —
// 1페이지 히어로 바로 아래로 옮겼다(2페이지 목록에서는 제거). 다른 카드들과 같은
// .home-card 스타일을 그대로 재사용해 클릭하면 onNavigate('eeg')로 '뇌파' 탭까지
// 바로 이동시킨다 — 실제 블루투스 연결 로직은 EegApp.tsx 한 곳에만 있고 홈
// 화면은 그대로 이동만 시키므로, 연결 상태를 여러 화면에 걸쳐 따로 관리해야
// 하는 복잡함 없이 기존 코드를 그대로 재사용한다.
const EEG_SHORTCUT: FeatureCard = {
  tab: 'eeg',
  icon: '🧠',
  title: '뇌파(EEG) 실시간 표시',
  description: 'Muse 헤드밴드를 블루투스로 연결해 뇌파 파워를 실시간으로 봐요.',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
  onOpenInfo: (key: InfoKey) => void
}

/**
 * Impakt류 앱의 홈 대시보드를 참고한 랜딩 화면. 한 화면에 다 담기엔 내용이 많아
 * 1페이지(히어로 + 안내 배너)와 2페이지(기능 카드 + 최근 기록)로 나누고,
 * 1페이지의 CTA 배너를 눌러 2페이지로 넘어가는 구조로 구성했습니다.
 */
export function HomeScreen({ onNavigate, onOpenInfo }: HomeScreenProps) {
  const [stage, setStage] = useState<HomeStage>('intro')
  const [recent, setRecent] = useState<RomSessionListItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)

  // 2026-09 보안 점검: ROM 기록 API가 이제 인증을 요구하는데(App.tsx의 GATED_TABS
  // 주석 참고), 홈 화면은 로그인 없이 누구나 보는 화면이다. 예전엔 여기서 토큰 없이
  // listRomSessions(3)을 그냥 호출했는데, 그때도 응답 JSON에 회원 이름(clientName)이
  // 포함돼 있어서 — 화면엔 videoName만 보이지만 — 로그인하지 않은 누구나 브라우저
  // 개발자 도구의 네트워크 탭으로 회원 이름을 볼 수 있는 실제 노출 경로였다. 지금은
  // 서버가 401로 막아주지만, 애초에 로그인 안 한 사람에게는 이 미리보기를 아예
  // 요청하지 않는 게 맞아서 저장된 토큰이 있을 때만 불러온다(트레이너가 이미 로그인해
  // 다른 탭을 쓰고 있었다면 홈에서도 최근 기록이 자연스럽게 보인다).
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setLoggedOut(true)
      return
    }
    let cancelled = false
    listRomSessions(token, 3)
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
      <div className="home-page-dots" role="tablist" aria-label="홈 화면 페이지">
        <button
          type="button"
          role="tab"
          aria-selected={stage === 'intro'}
          aria-label="1페이지"
          className={`home-page-dot${stage === 'intro' ? ' active' : ''}`}
          onClick={() => setStage('intro')}
        />
        <button
          type="button"
          role="tab"
          aria-selected={stage === 'dashboard'}
          aria-label="2페이지"
          className={`home-page-dot${stage === 'dashboard' ? ' active' : ''}`}
          onClick={() => setStage('dashboard')}
        />
      </div>

      {stage === 'intro' && (
        <>
          <HeroSection onNavigate={onNavigate} />
          <section className="home-cards" aria-label="바로가기">
            <button type="button" className="home-card" onClick={() => onNavigate(EEG_SHORTCUT.tab)}>
              <span className="home-card-icon" aria-hidden="true">
                {EEG_SHORTCUT.icon}
              </span>
              <span className="home-card-body">
                <span className="home-card-title">{EEG_SHORTCUT.title}</span>
                <span className="home-card-desc">{EEG_SHORTCUT.description}</span>
              </span>
              <span className="home-card-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </section>
          <CtaBanner onNext={() => setStage('dashboard')} />
        </>
      )}

      {stage === 'dashboard' && (
        <>
          <button type="button" className="home-back-link" onClick={() => setStage('intro')}>
            ← 처음 화면
          </button>

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

            {loggedOut && (
              <p className="home-recent-empty">로그인하면 최근 기록을 볼 수 있어요. (ROM 탭에서 비밀번호 입력)</p>
            )}
            {!loggedOut && loadError && <p className="home-recent-empty">기록을 불러오지 못했습니다.</p>}
            {!loggedOut && !loadError && recent === null && <p className="home-recent-empty">불러오는 중...</p>}
            {!loggedOut && !loadError && recent !== null && recent.length === 0 && (
              <p className="home-recent-empty">아직 저장된 ROM 분석 기록이 없어요.</p>
            )}
            {!loggedOut && !loadError && recent !== null && recent.length > 0 && (
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

          <p className="disclaimer">⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>

          <div className="app-footer home-page-footer">
            <nav className="app-footer-links" aria-label="사이트 정보">
              {FOOTER_LINKS.map((link) => (
                <button key={link.key} type="button" onClick={() => onOpenInfo(link.key)}>
                  {link.label}
                </button>
              ))}
            </nav>
            <p className="app-footer-copyright">Copyright © 2026 MyDoctor. All Rights Reserved.</p>
          </div>
        </>
      )}
    </div>
  )
}
