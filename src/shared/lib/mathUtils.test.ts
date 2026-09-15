import { describe, expect, it } from 'vitest'
import { mean, movingAverage, stddev } from './mathUtils'

describe('mean', () => {
  it('빈 배열이면 0을 반환한다', () => {
    expect(mean([])).toBe(0)
  })

  it('평균을 계산한다', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('stddev', () => {
  it('빈 배열이면 0을 반환한다', () => {
    expect(stddev([])).toBe(0)
  })

  it('모든 값이 같으면 0을 반환한다', () => {
    expect(stddev([5, 5, 5, 5])).toBe(0)
  })

  it('표준편차를 계산한다', () => {
    // 평균 5, 각 편차 [-2,-1,0,1,2] → 분산 = (4+1+0+1+4)/5 = 2 → sqrt(2)
    expect(stddev([3, 4, 5, 6, 7])).toBeCloseTo(Math.sqrt(2), 10)
  })
})

describe('movingAverage', () => {
  it('window가 1 이하면 원본을 그대로 복사해 반환한다', () => {
    const input = [1, 2, 3]
    const result = movingAverage(input, 1)
    expect(result).toEqual([1, 2, 3])
    expect(result).not.toBe(input) // 복사본이어야 함(원본 배열 참조가 아님)
  })

  it('가장자리는 절반짜리 창으로, 안쪽은 온전한 창으로 평균낸다', () => {
    // window=3(half=1): idx0은 [0,1] 평균, idx1은 [0,1,2] 평균, idx2는 [1,2,3] 평균...
    const input = [10, 20, 30, 40, 50]
    const result = movingAverage(input, 3)
    expect(result[0]).toBeCloseTo((10 + 20) / 2)
    expect(result[1]).toBeCloseTo((10 + 20 + 30) / 3)
    expect(result[2]).toBeCloseTo((20 + 30 + 40) / 3)
    expect(result[3]).toBeCloseTo((30 + 40 + 50) / 3)
    expect(result[4]).toBeCloseTo((40 + 50) / 2)
  })

  it('충분히 긴 평평한 구간의 값은 스무딩 후에도 그대로 유지된다', () => {
    // ROM 계산(romAnalysis.ts)이 "평평한 구간의 최솟값/최댓값은 스무딩으로 안 뭉개진다"는
    // 전제로 동작하므로, 그 전제 자체를 여기서 직접 검증해둔다.
    const input = [90, 90, 90, 120, 120, 120, 90, 90, 90]
    const result = movingAverage(input, 3)
    expect(Math.min(...result)).toBe(90)
    expect(Math.max(...result)).toBe(120)
  })
})
