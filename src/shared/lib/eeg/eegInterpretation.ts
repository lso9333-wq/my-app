// 손·발 분석 결과와 "동시 측정 뇌파 지표"를 나란히 보여주기 위한 계산.
//
// 요청 배경: 사용자가 "뇌파(EEG) 데이터를 분석해서 손발분석결과를 해석하는 최신
// 연구자료를 검색하고 적용해 달라"고 명시적으로 요청했다. 실제로 최신 연구를
// 찾아본 결과, 다음과 같은 근본적인 하드웨어 제약이 드러났고, 그 조사 결과가 이
// 파일이 "무엇을 하고 무엇을 하지 않는지"를 그대로 결정했다.
//
// 1) "어느 손/발이 더 잘 움직였는가"(운동 관련 좌우 비대칭)를 EEG로 구분하려면
//    전운동/보조운동 영역 전극(FC5/FC6)이 필요하다는 것이 연구로 확인됐다 —
//    "Using Mobile EEG to Investigate Alpha and Beta Asymmetries During Hand and Foot
//    Use" (Frontiers in Neuroscience, 2020, doi:10.3389/fnins.2020.00109)는 FC5/FC6가
//    FP1/FP2 같은 전두극 부위보다 훨씬 우월하다고 보고했고, 2026년 후속 대규모 연구
//    (Mundorf et al., "Effects of motor activity versus cognitive demand on asymmetries
//    in EEG frequency bands and their relation to handedness," Frontiers in Human
//    Neuroscience, 2026)도 전두엽만으로는 운동 실행과 인지 처리를 구분하기 어렵다고
//    확인했다. Muse 헤드밴드의 실제 전극 위치(TP9·AF7·AF8·TP10 — 전두극 + 측두두정)는
//    이 자리를 전혀 포함하지 않는다. 즉 "이 손이 더 잘 움직였다"류의 EEG 기반 판정은
//    이 하드웨어로는 과학적으로 뒷받침되지 않는다 — 카메라로 Fastball EEG 치매 검사를
//    흉내낼 수 없다고 결론 낸 것(CLAUDE.md 참고)과 같은 종류의 원리적 한계다. 그래서
//    이 파일은 그런 판정을 절대 만들지 않는다.
// 2) Muse를 인지 부하(cognitive workload) 지표로 쓰는 것도 별도 검증 연구에서
//    한계가 뚜렷했다 — "Reliability of MUSE 2 and Tobii Pro Nano at capturing mobile
//    application users' real-time cognitive workload changes" (Frontiers in
//    Neuroscience, 2022, doi:10.3389/fnins.2022.1011475)는 12개 측정값 중 단 2개만
//    유의미한 차이를 보였다고 결론 냈다.
// 3) 다만 Muse의 AF7/AF8(전두엽) 채널로 "전두엽 알파 비대칭"(FAA, Frontal Alpha
//    Asymmetry)을 재는 것은 별도 검증 연구에서 동일 기준전극(귀 뒤 유양돌기 —
//    Muse의 TP9/TP10과 같은 자리) 조건일 때 연구용 장비와 r=.67의 상관을 보였다
//    ("Validating the wearable MUSE headset for EEG spectral analysis and Frontal
//    Alpha Asymmetry," bioRxiv, 2021, doi:10.1101/2021.11.02.466989). FAA는 접근/회피
//    동기·정서가(valence)의 지표로 오래 연구돼 왔다(Davidson의 접근-회피 모델 계열) —
//    이건 "어느 팔다리가 움직였나"가 아니라 "이 순간 신체적·정서적으로 얼마나
//    편안/긴장했는가"에 가까운 신호다.
// 4) 신체적 긴장·불안이 미세운동 정밀도(손 떨림 등)에 영향을 준다는 연구도 있다
//    ("Neural underpinnings of fine motor skills under stress and anxiety: A review,"
//    Neuropsychologia 계열; 불안·시험 스트레스와 손 떨림 관련 연구들). 즉 "측정
//    시점에 얼마나 긴장/이완돼 있었는가"는 손·발 가동범위 결과를 해석할 때 참고할
//    만한 맥락이 될 수 있다는 방향은 있지만, 이 계산이 그 인과관계를 증명하는 것은
//    전혀 아니다.
//
// 결론 — 그래서 이 파일은: 분석 직전("안정") 스냅샷과 영상 촬영 직후("활동")
// 스냅샷, 두 시점의 EEG를 각각 요약해 그 사이의 (a) 전두엽 알파 비대칭(FAA) 변화와
// (b) 이완도(알파/(알파+베타)) 변화를 "동시 측정 참고 지표"로 계산한다. 손·발
// 관절 각도 계산 자체에는 전혀 관여하지 않고, 그 결과를 읽는 트레이너에게 "이
// 세션에서 이 사람이 얼마나 편안했는지"를 참고 정보로 곁들이는 것뿐이다. ROM의
// xmskEstimates.ts와 같은 관례로 evidence: 'experimental' 태그와 근거 note를 달아
// UI에 그대로 노출한다 — 진단이나 성과 판정이 아니라는 점을 항상 함께 보여준다.

import type { EegBuffers } from './eegBuffer'
import { FFT_WINDOW_SAMPLES } from './eegBuffer'
import { computeBandPowers } from './fft'
import { DISPLAYED_CHANNEL_COUNT, EEG_BANDS, EEG_CHANNEL_NAMES, EEG_SAMPLE_RATE_HZ } from './types'
import type { EegBandPowers, EegChannelName } from './types'

const EPSILON = 1e-6

function summarizeChannelSamples(samples: number[]): EegBandPowers | null {
  if (samples.length < FFT_WINDOW_SAMPLES) return null
  const bandRanges = EEG_BANDS.map((b) => ({ key: b.key, minHz: b.minHz, maxHz: b.maxHz }))
  const powers = computeBandPowers(samples, EEG_SAMPLE_RATE_HZ, bandRanges)
  return powers as EegBandPowers
}

export interface EegWindowSummary {
  capturedAt: string
  /** 채널별(TP9/AF7/AF8/TP10) 최근 1초 대역 파워 — 아직 1초치가 안 쌓인 채널은 빠진다. */
  channelBandPowers: Partial<Record<EegChannelName, EegBandPowers>>
  /** 데이터가 있는 채널들의 평균 대역 파워 — EegBandPowerBars가 화면에 보여주는 것과 같은 계산. */
  averageBandPowers: EegBandPowers | null
  /** 전두엽 알파 비대칭 = ln(AF8 알파 파워) − ln(AF7 알파 파워). AF7=좌측, AF8=우측
   * 전두엽. 두 채널 모두 확보됐을 때만 계산된다(위 근거 3번 참고). */
  frontalAlphaAsymmetry: number | null
}

/** 지금 이 순간 buffers에 쌓인 최근 1초 구간을 스냅샷으로 요약한다 — 실시간 표시
 * 화면(EegBandPowerBars)이 0.5초마다 반복하는 것과 같은 계산을 한 번만 수행한 것.
 * "안정" 캡처와 "활동" 캡처 양쪽에서 그대로 재사용한다. */
export function summarizeEegWindow(buffers: EegBuffers): EegWindowSummary {
  const channelBandPowers: Partial<Record<EegChannelName, EegBandPowers>> = {}
  for (let i = 0; i < DISPLAYED_CHANNEL_COUNT; i++) {
    const samples = buffers.channels[i].snapshot(FFT_WINDOW_SAMPLES)
    const powers = summarizeChannelSamples(samples)
    if (powers) channelBandPowers[EEG_CHANNEL_NAMES[i]] = powers
  }

  const channelsWithData = Object.values(channelBandPowers).filter((v): v is EegBandPowers => v !== undefined)
  let averageBandPowers: EegBandPowers | null = null
  if (channelsWithData.length > 0) {
    const averaged = {} as Record<string, number>
    for (const band of EEG_BANDS) {
      let sum = 0
      for (const p of channelsWithData) sum += p[band.key]
      averaged[band.key] = sum / channelsWithData.length
    }
    averageBandPowers = averaged as EegBandPowers
  }

  const af7 = channelBandPowers.AF7
  const af8 = channelBandPowers.AF8
  const frontalAlphaAsymmetry =
    af7 && af8 ? Math.log(Math.max(af8.alpha, EPSILON)) - Math.log(Math.max(af7.alpha, EPSILON)) : null

  return {
    capturedAt: new Date().toISOString(),
    channelBandPowers,
    averageBandPowers,
    frontalAlphaAsymmetry,
  }
}

/** 손·발 분석 세션 하나에 함께 기록되는 뇌파 컨텍스트 — 두 캡처(안정/활동) 모두
 * 선택 사항이라, 트레이너가 Muse를 아예 연결하지 않으면 둘 다 null로 남는다. */
export interface EegHandFootContext {
  deviceName: string | null
  baseline: EegWindowSummary | null
  during: EegWindowSummary | null
}

export type EegInterpretationDirection = 'up' | 'down' | 'flat'

export interface EegInterpretationRow {
  key: 'faa' | 'relaxation'
  label: string
  unit: string
  baselineValue: number | null
  duringValue: number | null
  deltaValue: number | null
  direction: EegInterpretationDirection | null
  /** 표시상 편의를 위한 임계값일 뿐 연구에서 가져온 절단점이 아니다 — 이 이하 변화는
   * "뚜렷한 변화 없음"(flat)으로 표시한다. */
  evidence: 'experimental'
  note: string
}

const FAA_FLAT_THRESHOLD = 0.05
const RELAXATION_FLAT_THRESHOLD = 0.03

function alphaBetaRatio(powers: EegBandPowers | null): number | null {
  if (!powers) return null
  const denom = powers.alpha + powers.beta
  if (denom <= EPSILON) return null
  return powers.alpha / denom
}

function directionOf(delta: number | null, flatThreshold: number): EegInterpretationDirection | null {
  if (delta === null) return null
  if (Math.abs(delta) < flatThreshold) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

/** baseline→during 두 스냅샷에서 FAA·이완도(알파/(알파+베타)) 변화를 계산한다.
 * 위 파일 상단 설명대로, 이 두 지표는 "손/발 움직임 자체를 해석"하지 않는다 —
 * 측정 시점의 정서적 각성 상태를 함께 기록해두는 참고 지표다. 둘 중 하나만
 * 캡처됐어도(예: 안정만 측정하고 활동은 건너뜀) 해당 값은 표시하고 delta만 null로
 * 남긴다. */
export function computeEegInterpretation(context: EegHandFootContext): EegInterpretationRow[] {
  const baseFaa = context.baseline?.frontalAlphaAsymmetry ?? null
  const duringFaa = context.during?.frontalAlphaAsymmetry ?? null
  const faaDelta = baseFaa !== null && duringFaa !== null ? duringFaa - baseFaa : null

  const baseRelax = alphaBetaRatio(context.baseline?.averageBandPowers ?? null)
  const duringRelax = alphaBetaRatio(context.during?.averageBandPowers ?? null)
  const relaxDelta = baseRelax !== null && duringRelax !== null ? duringRelax - baseRelax : null

  return [
    {
      key: 'faa',
      label: '전두엽 알파 비대칭(FAA) 변화',
      unit: 'ln(㎌²) 차이',
      baselineValue: baseFaa,
      duringValue: duringFaa,
      deltaValue: faaDelta,
      direction: directionOf(faaDelta, FAA_FLAT_THRESHOLD),
      evidence: 'experimental',
      note:
        '접근/회피 동기·정서가(valence)의 오래된 지표(Davidson의 접근-회피 모델 계열)로, 값이 커질수록(우측 대비 좌측 전두엽 상대활성 ↑) 접근·긍정 정서 방향, 작아질수록 회피·긴장 방향과 관련된다고 보고돼 왔다. Muse의 AF7/AF8로 이 지표를 재는 것 자체는 동일 기준전극 조건에서 연구용 장비와 r=.67의 상관을 보인 검증 연구가 있다(bioRxiv, 2021). 다만 이 지표는 "어느 손/발이 움직였는가"를 알려주지 않는다 — 그건 전운동/보조운동 영역 전극(FC5/FC6)이 있어야 구분 가능하다는 것이 최근 연구로 확인됐고(Frontiers in Neuroscience 2020; Frontiers in Human Neuroscience 2026), Muse에는 그 자리에 전극이 없다.',
    },
    {
      key: 'relaxation',
      label: '이완도(알파/(알파+베타)) 변화',
      unit: '비율(0~1) 차이',
      baselineValue: baseRelax,
      duringValue: duringRelax,
      deltaValue: relaxDelta,
      direction: directionOf(relaxDelta, RELAXATION_FLAT_THRESHOLD),
      evidence: 'experimental',
      note:
        '알파파는 편안한 각성 상태에서, 베타파는 긴장·집중 상태에서 상대적으로 커진다는 것이 Muse 제조사 자체의 명상 피드백 기능의 설계 근거이기도 하다. 신체적 긴장이 손 떨림 등 미세운동 정밀도에 영향을 준다는 연구도 있어(Neuropsychologia 계열 리뷰), 이 값의 변화를 손·발 분석 결과를 읽을 때 "이 사람이 측정 중 얼마나 편안했는지"의 참고 맥락으로 곁들인다. 다만 Muse를 인지 부하 지표로 쓰는 것 자체는 별도 검증 연구에서 신뢰도가 낮다는 결론도 있어(Frontiers in Neuroscience 2022), 절대적 기준값이 아니라 이 세션 안에서의 상대적 변화 참고용이라는 점을 분명히 한다.',
    },
  ]
}
