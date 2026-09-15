import { useState } from 'react'
import { HandAnalysisPanel } from './HandAnalysisPanel'
import { FootAnalysisPanel } from './FootAnalysisPanel'
import type { HandFootModule } from './types'

const MODULE_DESCRIPTIONS: Record<HandFootModule, string> = {
  hand: '영상 속 "이전"/"이후" 구간을 지정하면 손가락 관절 각도 14개(양손)의 가동범위 변화를 계산합니다.',
  foot: '영상 속 "이전"/"이후" 구간을 지정하면 발 전체 실험적 추정치를 계산하고, 발가락 10마디는 트레이너가 직접 입력합니다.',
}

/**
 * 손·발 분석 — docs/ai-training-plan.md 로드맵 밖에서 새로 추가된 기능. 보행/ROM과
 * 달리 손과 발은 서로 다른 인식 모델을 쓴다(손: MediaPipeHands 21랜드마크 —
 * shared/lib/handDetector.ts, 발: 기존 BlazePose 몸 전체 포즈 — shared/lib/poseDetector.ts
 * 재사용). 두 하위 모듈로 나눈 것은 XMSK 도구의 모듈 탭 전환 방식(recipes/dictionary/
 * evaluation/dataQuality)과 같은 패턴이다.
 *
 * 왜 손·발 움직임을 따로 측정하나 — 최신 연구 근거(자세한 내용은 CLAUDE.md의 "손·발
 * 분석" 절 참고):
 * - 손: 악력(grip strength)은 노년의학에서 전신 건강·사망률의 "활력징후(vital sign)"로
 *   제안될 만큼 폭넓게 검증된 지표다(Bohannon 계열 내러티브 리뷰, J Health Popul Nutr
 *   2024; Leong et al., PURE 코호트, Lancet 2015 계열 후속 연구들). 다만 악력은 쥐는
 *   힘이지 손가락 개별 관절의 움직임(가동범위)은 아니다 — 이 기능이 측정하는 것은
 *   "관절이 얼마나 움직이는가"이지 "얼마나 세게 쥐는가"가 아니라는 차이를 분명히 해둔다.
 *   한편 손가락 세밀 운동 자체를 영상으로 정량화하는 연구(파킨슨병 손가락 두드리기
 *   검사의 컴퓨터 비전 기반 정량화 — npj Parkinson's Disease 2026 계열 연구들)는 이
 *   기능과 훨씬 가까운 선례로, 관절 각도·속도 시계열을 영상만으로 뽑아내는 것이
 *   가능함을 보여준다.
 * - 발: 발가락 굽힘근(toe flexor) 근력이 노인의 균형·낙상 위험과 관련 있다는 연구가
 *   다수 있다(Mickle et al., "ISB Clinical Biomechanics Award 2009", Clin Biomech 2009;
 *   토 flexor 강화와 균형의 체계적 문헌고찰, Gait & Posture 2021 계열). 다만 이 연구들은
 *   "근력(힘)"을 다루지 "가동범위/굽힘 정도"를 다루지 않고, 측정도 압력판·동력계로
 *   하지 카메라 영상으로 하지 않는다 — 이 기능의 실험적 추정치(발 전체 굽힘 각도)는
 *   이 연구가 다루는 개념과 방향은 같지만(발가락을 쓰는 능력과 하체 안정성의 연관),
 *   같은 것을 측정하지는 않는다는 점을 사용자에게 분명히 알려야 한다.
 */
interface Props {
  token: string
  onAuthError: () => void
}

function HandFootApp({ token, onAuthError }: Props) {
  const [module, setModule] = useState<HandFootModule>('hand')

  return (
    <div className="xmsk-app">
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다. 발가락 개별 관절은 카메라로
        인식할 수 있는 검증된 모델이 없어 트레이너 수기 입력으로 보완합니다.
      </p>

      <nav className="app-tabs xmsk-module-tabs">
        <button
          type="button"
          className={module === 'hand' ? 'app-tab active' : 'app-tab'}
          onClick={() => setModule('hand')}
        >
          손 분석
        </button>
        <button
          type="button"
          className={module === 'foot' ? 'app-tab active' : 'app-tab'}
          onClick={() => setModule('foot')}
        >
          발 분석
        </button>
      </nav>
      <p className="app-subtitle xmsk-module-desc">{MODULE_DESCRIPTIONS[module]}</p>

      {module === 'hand' && <HandAnalysisPanel token={token} onAuthError={onAuthError} />}
      {module === 'foot' && <FootAnalysisPanel token={token} onAuthError={onAuthError} />}
    </div>
  )
}

export default HandFootApp
