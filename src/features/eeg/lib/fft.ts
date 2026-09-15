// 뇌파 대역 파워 계산용 FFT — 새 npm 의존성을 추가하지 않고 직접 구현한다.
//
// 왜 라이브러리를 안 쓰고 직접 짰나: 이 프로젝트는 낯선 3rd-party 패키지를 정확한
// 검증 없이 추가했다가 실제 배포 실패를 두 번 겪은 적이 있다(@tensorflow-models/
// hand-pose-detection — CLAUDE.md 참고). FFT는 라디오-2 Cooley-Tukey 알고리즘으로
// 널리 알려져 있고 입출력이 단순한 숫자 배열이라, 직접 구현해서 정확성을 스스로
// 추론/검증할 수 있는 반면, 낯선 라이브러리는 정확한 동작을 CDN에서 소스를 읽어보지
// 않는 한 확신할 수 없다.
//
// 왜 256 샘플/윈도우인가: Muse의 EEG_FREQUENCY가 정확히 256Hz이므로(muse-js
// dist/muse.d.ts에서 확인), 256 샘플 = 정확히 1초 분량이고, 256포인트 FFT는
// 1Hz/bin 해상도를 준다. 즉 FFT 결과의 k번째 bin이 정확히 kHz에 대응해서,
// "대역(4~8Hz 등)의 파워 = 그 범위 bin들의 파워 합"으로 대역-매핑이 아주 단순해진다.

export interface Complex {
  re: number
  im: number
}

/** N이 2의 거듭제곱이어야 하는 in-place 라디오-2 Cooley-Tukey FFT.
 * 입력 배열을 직접 변경하지 않고 새 배열을 반환한다(호출부에서 원본 샘플 버퍼를
 * 다른 용도로도 계속 쓰기 때문). */
export function fft(input: number[]): Complex[] {
  const n = input.length
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error(`fft(): 입력 길이는 2의 거듭제곱이어야 합니다 (받은 값: ${n})`)
  }

  // 비트 반전(bit-reversal) 순서로 재배열: re[i] = input[bit-reversed(i)].
  // (허수부는 입력이 실수뿐이므로 전부 0에서 시작 — Float64Array 기본값 그대로 둔다.)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    re[i] = input[j]
    let bit = n >> 1
    while (bit > 0 && (j & bit) !== 0) {
      j &= ~bit
      bit >>= 1
    }
    j |= bit
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const angleStep = (-2 * Math.PI) / len
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k
        const wRe = Math.cos(angle)
        const wIm = Math.sin(angle)
        const evenIdx = start + k
        const oddIdx = start + k + half
        const oddRe = re[oddIdx] * wRe - im[oddIdx] * wIm
        const oddIm = re[oddIdx] * wIm + im[oddIdx] * wRe
        const evenRe = re[evenIdx]
        const evenIm = im[evenIdx]
        re[evenIdx] = evenRe + oddRe
        im[evenIdx] = evenIm + oddIm
        re[oddIdx] = evenRe - oddRe
        im[oddIdx] = evenIm - oddIm
      }
    }
  }

  const result: Complex[] = new Array(n)
  for (let i = 0; i < n; i++) result[i] = { re: re[i], im: im[i] }
  return result
}

/** Hann 윈도우 — 프레임 경계에서 신호가 뚝 끊기며 생기는 스펙트럴 누설(spectral
 * leakage)을 줄이기 위해 FFT 전에 곱해준다. 표준적인 선택이라 별도 근거 조사 없이
 * 채택. */
export function applyHannWindow(samples: number[]): number[] {
  const n = samples.length
  const windowed = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    windowed[i] = samples[i] * w
  }
  return windowed
}

/** FFT 결과에서 [minHz, maxHz) 구간 bin들의 파워(진폭 제곱) 합을 구한다.
 * sampleRateHz/n이 1Hz/bin이 되는 조합(256Hz, 256샘플)을 쓰는 한 bin 인덱스와
 * 주파수(Hz)가 그대로 같다. */
function bandPower(spectrum: Complex[], sampleRateHz: number, minHz: number, maxHz: number): number {
  const n = spectrum.length
  const hzPerBin = sampleRateHz / n
  const startBin = Math.max(1, Math.round(minHz / hzPerBin)) // 0번 bin(DC 성분)은 항상 제외
  const endBin = Math.min(Math.floor(n / 2), Math.round(maxHz / hzPerBin))
  let sum = 0
  for (let k = startBin; k < endBin; k++) {
    const c = spectrum[k]
    sum += c.re * c.re + c.im * c.im
  }
  return sum
}

export interface BandRange {
  key: string
  minHz: number
  maxHz: number
}

/** 채널 하나의 최근 1초(256샘플) 원시 EEG(µV) 버퍼로부터 대역별 파워를 계산한다. */
export function computeBandPowers(samples: number[], sampleRateHz: number, bands: BandRange[]): Record<string, number> {
  const windowed = applyHannWindow(samples)
  const spectrum = fft(windowed)
  const result: Record<string, number> = {}
  for (const band of bands) {
    result[band.key] = bandPower(spectrum, sampleRateHz, band.minHz, band.maxHz)
  }
  return result
}
