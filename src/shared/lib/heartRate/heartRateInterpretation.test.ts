import { describe, expect, it } from 'vitest'
import type { HeartRateSample } from './bleHeartRate'
import { computeHeartRateInterpretation, computeRmssd, summarizeHeartRateWindow } from './heartRateInterpretation'

describe('computeRmssd', () => {
  it('RR간격이 2개 미만이면 null을 반환한다', () => {
    expect(computeRmssd([])).toBeNull()
    expect(computeRmssd([800])).toBeNull()
  })

  it('연속 RR간격 차이의 제곱평균제곱근을 계산한다', () => {
    // diffs = [20, -10] → 제곱합 = 400 + 100 = 500 → /(3-1) = 250 → sqrt(250)
    expect(computeRmssd([500, 520, 510])).toBeCloseTo(Math.sqrt(250), 10)
  })

  it('모든 RR간격이 같으면 0을 반환한다(변이가 없음)', () => {
    expect(computeRmssd([800, 800, 800])).toBe(0)
  })
})

function sample(heartRateBpm: number, rrIntervalsMs: number[] = []): HeartRateSample {
  return { heartRateBpm, rrIntervalsMs, timestamp: 0 }
}

describe('summarizeHeartRateWindow', () => {
  it('샘플이 하나도 없으면 평균/RMSSD 모두 null, 개수는 0이다', () => {
    const summary = summarizeHeartRateWindow([])
    expect(summary.avgHeartRateBpm).toBeNull()
    expect(summary.rmssdMs).toBeNull()
    expect(summary.sampleCount).toBe(0)
    expect(summary.rrIntervalCount).toBe(0)
  })

  it('여러 샘플의 심박수 평균과, 모든 RR간격을 합친 RMSSD를 계산한다', () => {
    const samples = [sample(60, [800, 820]), sample(70, [810])]
    const summary = summarizeHeartRateWindow(samples)
    expect(summary.avgHeartRateBpm).toBe(65)
    expect(summary.sampleCount).toBe(2)
    expect(summary.rrIntervalCount).toBe(3)
    // 합쳐진 RR간격 [800, 820, 810]의 RMSSD와 같아야 한다.
    expect(summary.rmssdMs).toBeCloseTo(computeRmssd([800, 820, 810])!, 10)
  })
})

describe('computeHeartRateInterpretation', () => {
  it('baseline/post가 둘 다 없으면 모든 행의 값과 방향이 null이다', () => {
    const rows = computeHeartRateInterpretation(null, null)
    for (const row of rows) {
      expect(row.baselineValue).toBeNull()
      expect(row.postValue).toBeNull()
      expect(row.deltaValue).toBeNull()
      expect(row.direction).toBeNull()
    }
  })

  it('심박수 변화가 임계값(2bpm) 미만이면 flat으로 분류한다', () => {
    const baseline = summarizeHeartRateWindow([sample(60)])
    const post = summarizeHeartRateWindow([sample(61)])
    const rows = computeHeartRateInterpretation(baseline, post)
    const hrRow = rows.find((r) => r.key === 'heartRate')!
    expect(hrRow.deltaValue).toBeCloseTo(1)
    expect(hrRow.direction).toBe('flat')
  })

  it('심박수가 임계값 이상 오르면 up으로 분류한다', () => {
    const baseline = summarizeHeartRateWindow([sample(60)])
    const post = summarizeHeartRateWindow([sample(90)])
    const rows = computeHeartRateInterpretation(baseline, post)
    const hrRow = rows.find((r) => r.key === 'heartRate')!
    expect(hrRow.direction).toBe('up')
  })

  it('HRV(RMSSD)가 임계값(3ms) 이상 떨어지면 down으로 분류한다', () => {
    const baseline = summarizeHeartRateWindow([sample(60, [800, 850, 800])]) // 변이 큼
    const post = summarizeHeartRateWindow([sample(60, [800, 800, 800])]) // 변이 없음(RMSSD 0)
    const rows = computeHeartRateInterpretation(baseline, post)
    const hrvRow = rows.find((r) => r.key === 'hrv')!
    expect(hrvRow.postValue).toBe(0)
    expect(hrvRow.direction).toBe('down')
  })
})
