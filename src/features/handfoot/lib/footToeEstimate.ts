import type { Point, PoseFrame } from '../../../shared/types/pose'
import { movingAverage } from '../../../shared/lib/mathUtils'
import type { FootManualToeInput, FootToeEstimateResult } from '../types'
import { FOOT_MANUAL_TOE_ITEMS, type FootSegmentKey, type FootToeKey } from './handfootManualItems'

const MIN_SCORE = 0.3
const MIN_SAMPLES = 3

/** src/features/rom/lib/jointAngles.ts의 angleAtVertexDeg와 동일한 공식 — 교차 기능
 * 참조를 피하는 기존 관례(CLAUDE.md 참고)에 따라 작은 순수 함수만 복제했다. */
function angleAtVertexDeg(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const cross = v1x * v2y - v1y * v2x
  const dot = v1x * v2x + v1y * v2y
  return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI)
}

const SIDE_LABEL: Record<'left' | 'right', string> = { left: '왼발', right: '오른발' }

/**
 * 발가락 개별 관절 시뮬레이션 모델 버전 — 이 파일의 결합계수/참고 ROM 수치나
 * curlFraction 계산식이 바뀌면 사람이 직접 올린다(ANALYSIS_PIPELINE_VERSION/
 * HAND_ANALYSIS_PIPELINE_VERSION과 같은 관례). FootAnalysisPanel은 이 값을
 * `${ANALYSIS_PIPELINE_VERSION}+toeSim:${FOOT_TOE_SIM_VERSION}` 형태로 합성해
 * calcVersion에 저장한다 — 발 분석은 몸 전체 포즈 파이프라인(추출)과 이 파일의
 * 발가락 시뮬레이션(후처리)이라는 두 개의 독립적으로 바뀌는 계산 단계를 갖기 때문에,
 * 단일 버전 문자열보다 두 버전을 합쳐 기록하는 쪽이 나중에 실측값을 정확히 짝지을 수
 * 있다.
 */
export const FOOT_TOE_SIM_VERSION = '2026-09-13'

/**
 * 발목(ankle)-발끝(foot_index)-뒤꿈치(heel), 정점을 발끝으로 잡은 각도. 발가락을
 * 안으로 굽힐수록(또는 영상에 잡히는 발끝 랜드마크가 뒤꿈치 쪽으로 접힐수록) 이 각이
 * 작아지는 경향이 있다는 기하학적 가정에 기반한, 발 전체를 대표하는 실험적 근사치다.
 * BlazePose에는 발가락 하나하나의 랜드마크가 없어(heel·foot_index 두 점뿐) 5개
 * 발가락을 구분하지 못한다 — 그래서 이 값 하나를 "발 전체"의 참고 지표로만 쓴다.
 */
function toeCurlAngle(frame: PoseFrame, side: 'left' | 'right'): number | null {
  const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle
  const heel = side === 'left' ? frame.leftHeel : frame.rightHeel
  const footIndex = side === 'left' ? frame.leftFootIndex : frame.rightFootIndex
  if (ankle.score < MIN_SCORE || heel.score < MIN_SCORE || footIndex.score < MIN_SCORE) return null
  return angleAtVertexDeg(ankle, footIndex, heel)
}

function phaseValue(frames: PoseFrame[], side: 'left' | 'right'): number | null {
  const samples = frames.map((f) => toeCurlAngle(f, side)).filter((v): v is number => v !== null)
  if (samples.length < MIN_SAMPLES) return null
  const smoothed = movingAverage(samples, 3)
  // ROM(관절 각도)처럼 구간 내 범위가 아니라, "그 구간에서 가장 많이 접힌 순간"을
  // 대표값으로 쓴다 — 굽힘 검사는 순간적인 최대 굽힘 정도가 핵심 정보이기 때문.
  return Math.max(...smoothed)
}

interface WholeFootPhaseValues {
  before: number | null
  after: number | null
}

/** 좌/우 각각의 "발 전체 굽힘" 원시 신호(전/후) — computeFootToeEstimates(실험적
 * 요약표)와 computeFootToeSegmentEstimates(발가락 마디별 시뮬레이션)가 같은 원시
 * 신호를 공유하도록 한 곳에서만 계산한다. */
function computeWholeFootPhaseValues(beforeFrames: PoseFrame[], afterFrames: PoseFrame[]): Record<'left' | 'right', WholeFootPhaseValues> {
  const result = {} as Record<'left' | 'right', WholeFootPhaseValues>
  for (const side of ['left', 'right'] as const) {
    result[side] = {
      before: phaseValue(beforeFrames, side),
      after: phaseValue(afterFrames, side),
    }
  }
  return result
}

/** 좌/우 발 각각 전/후 구간의 "발가락 굽힘 추정(전체)" 실험적 근사치를 계산한다.
 * 개별 발가락 값은 이 값으로 대체할 수 없다 — 마디별 시뮬레이션(아래
 * computeFootToeSegmentEstimates)과 트레이너 수기 확인으로 보완한다. */
export function computeFootToeEstimates(beforeFrames: PoseFrame[], afterFrames: PoseFrame[]): FootToeEstimateResult[] {
  const wholeFoot = computeWholeFootPhaseValues(beforeFrames, afterFrames)
  return (['left', 'right'] as const).map((side) => {
    const { before: beforeValue, after: afterValue } = wholeFoot[side]
    const deltaValue = beforeValue !== null && afterValue !== null ? afterValue - beforeValue : null
    return {
      side,
      label: `${SIDE_LABEL[side]} 발가락 굽힘 추정(전체)`,
      unit: '도(추정)',
      beforeValue,
      afterValue,
      deltaValue,
      evidence: 'experimental' as const,
      note:
        '카메라만으로 발가락 하나하나의 관절을 구분해 인식하는 검증된 모델이 현재 없어(개별 발가락 랜드마크 모델 부재), ' +
        '발목-발끝(foot_index)-뒤꿈치 각도로 발 전체의 "발가락 굽힘 정도"를 근사한 참고값입니다. 5개 발가락 각각의 실제 ' +
        '움직임을 구분하지 못하므로, 발가락별 상세 수치는 아래 마디별 시뮬레이션/수기 입력 항목을 활용하세요.',
    }
  })
}

/**
 * 발가락 마디별 시뮬레이션 결합계수 — "손가락 14마디"처럼 실제 랜드마크로 각 관절을
 * 독립 추적하는 것이 아니라, 발 전체 실험적 신호 하나를 부위별 연구 근거로 배분하는
 * 방식이다. 두 계수를 부위마다 둔다:
 *
 * - `referenceMaxDeg` — 그 관절이 보일 수 있는 대략적인 최대 가동범위(°). 문헌에서
 *   직접 가져온 그 사람만의 정밀 측정치가 아니라, 이 시뮬레이션의 상한선을 비합리적인
 *   범위로 벗어나지 않게 잡아주는 "참고 천장"이다.
 *     · 엄지 MTP: 80° — 정상 보행에 필요한 기능적 신전 45–60°, 수동 신전은
 *       40–100°까지 보고된다(1st MTP Joint ROM, QUT Podiatry Anatomy App;
 *       Hallux Rigidus, Physiopedia).
 *     · 엄지 IP: 30° — 엄지 MTP보다 훨씬 작은 가동범위를 갖는 관절로 통상 다뤄진다.
 *     · 2~5번 발가락 MTP: 40° — 엄지보다 뚜렷이 제한된 가동범위를 보이는 것으로
 *       보고된다("Limited range of motion of the lesser MTP joints — a cause of
 *       metatarsalgia", Foot Ankle Surg 2004).
 *     · 2~5번 발가락 IP: 20° — 위와 같은 이유로 가장 작게 잡았다(직접 인용 가능한
 *       정량 문헌을 찾지 못해, 방향성만 반영한 보수적 추정치임을 밝혀둔다).
 *
 * - `coupling` — 발 전체 신호(발목-발끝-뒤꿈치 각도)가 실제로 변할 때 이 관절이 얼마나
 *   "같이" 움직이는 경향이 있는지의 비율(0~1). 엄지 MTP를 1.0(가장 강함)으로 둔 것은
 *   "엄지의 힘 생성은 발목 각도에 가장 크게 좌우되지만, 나머지 발가락은 덜 그렇다"는
 *   연구 결과(Kurihara et al., "Force Generation on the Hallux Is More Affected by the
 *   Ankle Joint Angle than the Lesser Toes: An In Vivo Human Study," Biology 10(1):48,
 *   2021)를 방향성 근거로 삼은 것이다 — 이 연구는 "힘(force)"을 다루지 이 기능이
 *   시뮬레이션하는 "굽힘 각도"를 다루지 않으므로, 숫자 자체가 아니라 "엄지가 발목과
 *   가장 강하게 연동된다"는 방향만 가져왔다. 2~5번 발가락은 서로 묶여 움직이는
 *   경향과 더 제한된 가동범위(위 metatarsalgia 문헌)를 근거로 더 낮은 결합계수를
 *   준다. IP 관절은 해당 발가락의 MTP보다 항상 결합계수를 낮췄다 — 말단 관절일수록
 *   발 전체 신호와는 더 멀어진다는 일반적 기대를 반영한 것이며, 특히 엄지는 MTP
 *   가동범위가 제한되면 IP가 과신전으로 "보상"하는 역상관 패턴도 보고돼 있어
 *   (Hallux Rigidus, Physiopedia) 실제로는 이 단순 비례식보다 더 복잡할 수 있다는
 *   점을 참고용으로 남겨둔다.
 *
 * ⚠️ 이 표의 숫자들은 "각 연구에서 그대로 옮겨 적은 실측 통계"가 아니라, 여러 연구가
 * 공통으로 가리키는 방향(엄지가 가장 크게 움직이고 발목과 가장 강하게 연동된다 / 2~5번은
 * 더 작고 서로 묶여 움직인다)을 하나의 비례 배분 모델로 옮긴 것이다 — 손가락 14마디처럼
 * 랜드마크로 직접 잰 값이 아니라 "시뮬레이션(추정)"이라는 점을 UI/데이터에 항상
 * 명시한다.
 */
const TOE_SEGMENT_SIM_PARAMS: Record<FootToeKey, Record<FootSegmentKey, { referenceMaxDeg: number; coupling: number }>> = {
  bigToe: { mtp: { referenceMaxDeg: 80, coupling: 1.0 }, ip: { referenceMaxDeg: 30, coupling: 0.55 } },
  toe2: { mtp: { referenceMaxDeg: 40, coupling: 0.65 }, ip: { referenceMaxDeg: 20, coupling: 0.35 } },
  toe3: { mtp: { referenceMaxDeg: 40, coupling: 0.65 }, ip: { referenceMaxDeg: 20, coupling: 0.35 } },
  toe4: { mtp: { referenceMaxDeg: 40, coupling: 0.65 }, ip: { referenceMaxDeg: 20, coupling: 0.35 } },
  toe5: { mtp: { referenceMaxDeg: 40, coupling: 0.65 }, ip: { referenceMaxDeg: 20, coupling: 0.35 } },
}

/** 이 값보다 전/후 발 전체 신호 차이가 작으면 "구분할 수 없을 정도로 정적"이라고 보고
 * curlFraction을 중간값(0.5)으로 둔다(0 또는 1로 억지로 극단화하지 않기 위함). */
const WHOLE_FOOT_RANGE_EPSILON_DEG = 0.5

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * phaseValue(발목-발끝-뒤꿈치 각도, 클수록 폄 상태·작을수록 굽힘 상태)를 "이 세션에서
 * 관찰된 전/후 두 값 사이에서 상대적으로 얼마나 굽혀진 상태인가"(0=가장 덜 굽힘,
 * 1=가장 많이 굽힘)로 정규화한다. 보편적인 절대 기준각(예: "180도가 편 상태") 같은
 * 검증되지 않은 상수를 새로 만들지 않기 위해, 이 세션 자체의 전/후 값만으로 자기
 * 상대적으로 계산한다 — 그래서 이 값 자체는 "그 세션 안에서" 전/후 중 어느 쪽이 더
 * 굽혀졌는지만 의미 있게 말해줄 뿐, 다른 세션과 절대 비교할 수 있는 값은 아니다.
 */
function curlFraction(value: number, wholeMin: number, wholeMax: number): number {
  const range = wholeMax - wholeMin
  if (range < WHOLE_FOOT_RANGE_EPSILON_DEG) return 0.5
  return clamp01((wholeMax - value) / range)
}

/**
 * 발가락 20개 항목(양발 × 5개 발가락 × 2관절) 각각에 대해 "발 전체 실험적 신호 ×
 * 부위별 연구기반 결합계수 × 참고 최대 가동범위"로 시뮬레이션 초기값을 만든다.
 * 실제 관절 하나하나를 인식한 값이 아니라 발 전체 신호 하나를 배분한 값이므로,
 * 반드시 `source: 'estimated'`로 표시해 트레이너가 확인/수정하기 전까지는 "AI
 * 시뮬레이션 값"임을 UI에서 구분할 수 있게 한다. 발목/뒤꿈치/발끝 랜드마크 신뢰도가
 * 낮아 발 전체 신호 자체를 못 구한 경우(phaseValue가 null)에는 해당 발의 20개 항목
 * 전부 null로 남겨 트레이너가 순수 수기로 입력해야 한다.
 */
export function computeFootToeSegmentEstimates(beforeFrames: PoseFrame[], afterFrames: PoseFrame[]): FootManualToeInput[] {
  const wholeFoot = computeWholeFootPhaseValues(beforeFrames, afterFrames)

  return FOOT_MANUAL_TOE_ITEMS.map((item) => {
    const { before, after } = wholeFoot[item.side]
    const params = TOE_SEGMENT_SIM_PARAMS[item.toeKey][item.segmentKey]

    if (before === null || after === null) {
      return {
        id: item.id,
        beforeValue: null,
        afterValue: null,
        source: 'estimated' as const,
        estimatedBeforeValue: null,
        estimatedAfterValue: null,
      }
    }

    const wholeMin = Math.min(before, after)
    const wholeMax = Math.max(before, after)
    const beforeFraction = curlFraction(before, wholeMin, wholeMax)
    const afterFraction = curlFraction(after, wholeMin, wholeMax)

    const ceilingDeg = params.referenceMaxDeg * params.coupling
    const beforeValue = Number((ceilingDeg * beforeFraction).toFixed(1))
    const afterValue = Number((ceilingDeg * afterFraction).toFixed(1))
    // estimatedBeforeValue/estimatedAfterValue는 이 시점의 beforeValue/afterValue를
    // 그대로 복사해 영구 보존한다 — 트레이너가 나중에 beforeValue/afterValue를 고쳐써도
    // (source가 'trainer'로 바뀌어도) 이 두 필드는 handleManualToeInputChange가 항상
    // `{ ...m, ... }`로 기존 항목을 스프레드해서 갱신하므로 그대로 남는다(FootAnalysisPanel.tsx/
    // FootSessionHistory.tsx 참고). "AI가 처음에 뭐라고 추정했는지"를 잃지 않기 위한
    // 필드라 여기서만 값을 설정한다.
    return {
      id: item.id,
      beforeValue,
      afterValue,
      source: 'estimated' as const,
      estimatedBeforeValue: beforeValue,
      estimatedAfterValue: afterValue,
    }
  })
}
