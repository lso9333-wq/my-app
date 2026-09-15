export type FootToeKey = 'bigToe' | 'toe2' | 'toe3' | 'toe4' | 'toe5'
export type FootSegmentKey = 'mtp' | 'ip'

export interface FootManualToeItemDef {
  id: string
  label: string
  unit: string
  toeKey: FootToeKey
  segmentKey: FootSegmentKey
  side: 'left' | 'right'
}

const TOES: { key: FootToeKey; label: string }[] = [
  { key: 'bigToe', label: '엄지발가락' },
  { key: 'toe2', label: '둘째발가락' },
  { key: 'toe3', label: '셋째발가락' },
  { key: 'toe4', label: '넷째발가락' },
  { key: 'toe5', label: '새끼발가락' },
]

const SEGMENTS: { key: FootSegmentKey; label: string }[] = [
  { key: 'mtp', label: '중족지관절(MTP)' },
  { key: 'ip', label: '지절간관절(IP, 통합)' },
]

const SIDES: { key: 'left' | 'right'; label: string }[] = [
  { key: 'left', label: '왼발' },
  { key: 'right', label: '오른발' },
]

/**
 * "발가락 10마디"(발가락 5개 × 관절 2개: MTP+IP, 발 한쪽 기준)를 양발 합쳐 20개 항목으로
 * 정의한다. 예전에는 AI가 개별 발가락을 전혀 구분하지 못해 전부 순수 트레이너 수기
 * 입력이었지만(2026-09), 이후 lib/footToeEstimate.ts의 `computeFootToeSegmentEstimates()`가
 * 연구 기반 결합계수로 각 항목의 "시뮬레이션 초기값"을 자동 채워준다 — 그래도 이 값이
 * 실제 관절 측정을 대체하지 않는다는 성격 자체는 그대로다(FootManualToeInput.source로
 * "AI 시뮬레이션" vs "트레이너 확인/수정"을 구분해서 계속 추적한다).
 * toeKey/segmentKey/side를 구조적으로 노출해 id 문자열을 파싱하지 않고도
 * footToeEstimate.ts가 항목별 결합계수를 조회할 수 있게 한다.
 */
export const FOOT_MANUAL_TOE_ITEMS: FootManualToeItemDef[] = SIDES.flatMap((side) =>
  TOES.flatMap((toe) =>
    SEGMENTS.map((seg) => ({
      id: `${toe.key}_${seg.key}_${side.key}`,
      label: `${side.label} ${toe.label} ${seg.label}`,
      unit: '도(추정, AI 시뮬레이션 또는 수기측정)',
      toeKey: toe.key,
      segmentKey: seg.key,
      side: side.key,
    })),
  ),
)
