import type { XmskEvalSection, XmskEvalVerdict } from '../types'

export const XMSK_EVAL_SECTIONS: XmskEvalSection[] = [
  {
    key: 'theory',
    title: '영역 1 · 이론 (필기)',
    maxTotal: 30,
    items: [
      { id: 'originInsertion', label: '기시·정지·작용', hint: 'WHY 4권 범위 — 근육의 붙는 곳과 작용을 정확히 아는가', max: 18 },
      { id: 'recipeLogic', label: '레시피 기본 로직', hint: '증상별 A~D 순서 · 위·아래를 보는 관점', max: 12 },
    ],
    requiredItems: [{ id: 'safetyKnowledge', label: '안전 지식', hint: 'Red Flag · 부위별 금지 동작을 아는가' }],
  },
  {
    key: 'practical',
    title: '영역 2 · 실기 (실연)',
    maxTotal: 30,
    items: [
      { id: 'targetStimulus', label: '타겟 자극 유도', hint: '근육의 기시~정지 전체에 자극이 가는가', max: 10 },
      { id: 'releaseTechnique', label: '근막이완 기술', hint: '도구·각도·힘점받침·트랙션이 맞는가', max: 8 },
      { id: 'positionGrip', label: '포지션·파지·고정', hint: '자세와 잡는 위치가 정확한가', max: 7 },
      { id: 'movementCombo', label: '움직임 결합', hint: '수축→이완 방향으로 움직여 푸는가', max: 5 },
    ],
    requiredItems: [{ id: 'dangerAvoidance', label: '위험 동작 회피', hint: '강압·금지 부위 동작이 나오지 않는가' }],
  },
  {
    key: 'safety',
    title: '영역 3 · 안전 (구술) — 전 항목 필수',
    maxTotal: null,
    items: [],
    requiredItems: [
      { id: 'redFlag', label: 'Red Flag', hint: '즉시 의뢰할 응급 신호를 아는가' },
      { id: 'intensityControl', label: '강도 조절', hint: '처치 前(낮게·순환) / 後(불균형 원인) 대응을 아는가' },
      { id: 'dangerStructures', label: '위험 구조물', hint: '경동맥·좌골신경·복부 등 강압 금지를 아는가' },
    ],
  },
  {
    key: 'cs',
    title: '영역 4 · CS·핸들링',
    maxTotal: 40,
    items: [
      { id: 'handlingFeel', label: '핸들링 느낌', hint: '급격한 방향전환 없음·손떨림 없음·손바닥부터 접지·동작 간 연결성', max: 10 },
      { id: 'intensityCommunication', label: '강도 소통', hint: "'강도 어떠세요?' 확인, 표정·반응 살피며 조절", max: 8 },
      { id: 'firstImpression', label: '첫인상·응대', hint: '밝은 인사, 이름 확인, 오늘 컨디션 묻기', max: 5 },
      { id: 'movementGuide', label: '동선 안내', hint: "자세 전환을 미리 안내 ('이제 엎드려 주실게요')", max: 5 },
      { id: 'privacyCare', label: '배려·프라이버시', hint: '노출 최소화, 춥지 않은지, 불편한 곳 확인', max: 5 },
      { id: 'explanation', label: '설명·안내', hint: '무엇을 왜 하는지 눈높이 설명, 셀프 과제 안내', max: 4 },
      { id: 'closingCare', label: '마무리 케어', hint: '요약, 다음 안내, 따뜻한 배웅', max: 3 },
    ],
    requiredItems: [],
  },
]

export const XMSK_EVAL_MAX_TOTAL = 100

export const XMSK_EVAL_VERDICT_LABEL: Record<XmskEvalVerdict, string> = {
  approved: '투입 승인',
  retry: '재평가 (60~69점)',
  hold: '투입 보류',
}

export function computeXmskEvalVerdict(totalScore: number, allRequiredPassed: boolean): XmskEvalVerdict {
  if (!allRequiredPassed) return 'hold'
  if (totalScore >= 70) return 'approved'
  if (totalScore >= 60) return 'retry'
  return 'hold'
}
