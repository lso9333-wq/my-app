// 심박 센서로 잰 "분석/세션 전후" 심박수·HRV 변화를 참고 지표로 요약하는 계산 —
// eegInterpretation.ts와 같은 성격(진단이 아니라 참고용 맥락)의 파일이다.
//
// 근거(2026-09 웨어러블 연동 검토, docs/wearable-biometric-integration-review.md 참고):
// 운동/활동 직후 심박수 회복(Heart Rate Recovery)과 단기 HRV 변화는 부교감신경
// 재활성화를 반영하는, 임상에서도 실제로 쓰이는 지표라는 근거가 있다(리뷰: Sensors,
// MDPI, 2026, doi 정보는 검토 문서 참고; Frontiers in Physiology, 2026). 다만 이
// 파일이 계산하는 건 통제된 운동 프로토콜의 정식 HRR(예: 회복 1분 후 심박 감소폭)이
// 아니라 "캡처 시작~60초"라는 짧은 창(window) 안의 평균 심박·RMSSD다 — 표준 HRV
// 프로토콜(보통 1~5분 권장)보다 짧아 절대값의 정밀도는 떨어진다는 것을 evidence로
// 명시한다. 또한 이 계산은 표준 BLE 심박 서비스(가슴띠형 센서 전제)로 얻은 RR간격을
// 쓴다는 전제다 — 손목형 PPG 센서는 움직임에 취약해 신뢰도가 크게 낮아진다는 것이
// 검토 문서의 결론이었으므로, 이 앱은 애초에 가슴띠형 표준 BLE 센서만 지원한다
// (bleHeartRate.ts 참고).

import type { HeartRateSample } from './bleHeartRate'

export interface HeartRateWindowSummary {
  capturedAt: string
  /** 캡처 구간 동안 수신한 심박수 샘플의 평균(bpm). 샘플이 하나도 없으면 null. */
  avgHeartRateBpm: number | null
  /** RMSSD(연속 RR간격 차이의 제곱평균제곱근, ms) — 단기 HRV의 대표적 지표. RR간격이
   * 2개 미만이면(기기가 RR간격을 안 주거나 신호가 끊긴 경우) null. */
  rmssdMs: number | null
  /** 캡처 구간 동안 수신한 심박수 샘플 개수 — 값이 너무 적으면(예: 연결이 불안정했던
   * 경우) 아래 수치의 신뢰도가 낮다는 신호로 UI에 함께 보여준다. */
  sampleCount: number
  /** RMSSD 계산에 실제로 쓰인 RR간격 개수. */
  rrIntervalCount: number
}

/** RMSSD = sqrt(mean((RR[i] - RR[i-1])^2)) — 연속 RR간격 차이의 제곱평균제곱근(ms).
 * 단기 부교감신경 활성도를 반영하는 HRV 지표로 널리 쓰인다. */
export function computeRmssd(rrIntervalsMs: number[]): number | null {
  if (rrIntervalsMs.length < 2) return null
  let sumSquaredDiffs = 0
  for (let i = 1; i < rrIntervalsMs.length; i++) {
    const diff = rrIntervalsMs[i] - rrIntervalsMs[i - 1]
    sumSquaredDiffs += diff * diff
  }
  return Math.sqrt(sumSquaredDiffs / (rrIntervalsMs.length - 1))
}

/** 캡처 구간 동안 모인 심박 샘플들을 하나의 요약으로 만든다 — "안정"/"활동" 양쪽
 * 캡처에서 그대로 재사용한다(HeartRateCaptureControl.tsx 참고). */
export function summarizeHeartRateWindow(samples: HeartRateSample[]): HeartRateWindowSummary {
  const allRrIntervals = samples.flatMap((s) => s.rrIntervalsMs)
  const avgHeartRateBpm =
    samples.length > 0 ? samples.reduce((sum, s) => sum + s.heartRateBpm, 0) / samples.length : null

  return {
    capturedAt: new Date().toISOString(),
    avgHeartRateBpm,
    rmssdMs: computeRmssd(allRrIntervals),
    sampleCount: samples.length,
    rrIntervalCount: allRrIntervals.length,
  }
}

export type HeartRateInterpretationDirection = 'up' | 'down' | 'flat'

export interface HeartRateInterpretationRow {
  key: 'heartRate' | 'hrv'
  label: string
  unit: string
  baselineValue: number | null
  postValue: number | null
  deltaValue: number | null
  direction: HeartRateInterpretationDirection | null
  /** ROM의 xmskEstimates.ts와 같은 두 단계 근거 표기 — 'approximate'는 관련 연구가
   * 있는 근사치, 'experimental'은 기하학적/통계적으로는 타당하지만 이 앱의 짧은 캡처
   * 방식 자체를 검증한 연구는 없는 추정치. */
  evidence: 'approximate' | 'experimental'
  note: string
}

const HEART_RATE_FLAT_THRESHOLD_BPM = 2
const RMSSD_FLAT_THRESHOLD_MS = 3

function directionOf(delta: number | null, flatThreshold: number): HeartRateInterpretationDirection | null {
  if (delta === null) return null
  if (Math.abs(delta) < flatThreshold) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

/** baseline(①안정)→post(②활동 직후) 두 캡처에서 평균 심박수·RMSSD 변화를 계산한다.
 * 둘 중 하나만 캡처됐어도 해당 값은 표시하고 delta만 null로 남긴다. */
export function computeHeartRateInterpretation(
  baseline: HeartRateWindowSummary | null,
  post: HeartRateWindowSummary | null,
): HeartRateInterpretationRow[] {
  const baseHr = baseline?.avgHeartRateBpm ?? null
  const postHr = post?.avgHeartRateBpm ?? null
  const hrDelta = baseHr !== null && postHr !== null ? postHr - baseHr : null

  const baseRmssd = baseline?.rmssdMs ?? null
  const postRmssd = post?.rmssdMs ?? null
  const rmssdDelta = baseRmssd !== null && postRmssd !== null ? postRmssd - baseRmssd : null

  return [
    {
      key: 'heartRate',
      label: '평균 심박수 변화',
      unit: 'bpm',
      baselineValue: baseHr,
      postValue: postHr,
      deltaValue: hrDelta,
      direction: directionOf(hrDelta, HEART_RATE_FLAT_THRESHOLD_BPM),
      evidence: 'approximate',
      note:
        '활동 직후 안정시 대비 심박수가 얼마나 빨리/많이 낮아지는지(심박수 회복, Heart Rate Recovery)는 부교감신경 재활성화를 반영하는, 임상에서도 실제로 참고하는 지표라는 근거가 있다(Sensors 리뷰, MDPI, 2026; Frontiers in Physiology, 2026). 다만 이 값은 정식 운동부하 프로토콜의 HRR이 아니라 60초 캡처 구간의 평균값 비교이므로, 절대적인 회복 속도 판정이 아니라 이 세션 안에서의 상대적 참고치로만 해석해야 한다.',
    },
    {
      key: 'hrv',
      label: 'HRV(RMSSD) 변화',
      unit: 'ms',
      baselineValue: baseRmssd,
      postValue: postRmssd,
      deltaValue: rmssdDelta,
      direction: directionOf(rmssdDelta, RMSSD_FLAT_THRESHOLD_MS),
      evidence: 'experimental',
      note:
        'RMSSD는 단기 부교감신경 활성도를 반영하는 대표적 HRV 지표다. 다만 표준 HRV 측정 프로토콜은 보통 1~5분 이상의 안정된 구간을 권장하는데, 이 앱은 트레이너가 현장에서 바로 쓸 수 있도록 60초로 캡처 구간을 줄였다 — 절대값의 정밀도는 표준 프로토콜보다 낮으므로 "experimental"로 표기한다. 또한 손목형 PPG 센서는 움직임에 취약해 이 지표의 신뢰도를 크게 떨어뜨린다는 것이 확인돼(2026-09 웨어러블 연동 검토), 이 계산은 가슴띠형 표준 BLE 센서로 얻은 RR간격 전제로만 의미가 있다 — rrIntervalCount가 너무 적으면(예: 10개 미만) 참고하지 않는 것이 좋다.',
    },
  ]
}
