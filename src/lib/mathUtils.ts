export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function stddev(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return values.slice()
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(values.length, i + half + 1)
    let sum = 0
    for (let j = start; j < end; j++) sum += values[j]
    return sum / (end - start)
  })
}
