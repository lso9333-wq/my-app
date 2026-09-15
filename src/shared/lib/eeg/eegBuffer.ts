// 실시간 EEG 데이터를 위한 채널별 링 버퍼.
//
// 왜 React state가 아니라 링 버퍼(+ 아래 컴포넌트들의 requestAnimationFrame 루프)를
// 쓰는가: Muse는 채널당 초당 약 256개 샘플을 보낸다(12개씩 묶여서 도착 —
// EEG_SAMPLES_PER_READING). 이걸 매 샘플마다 setState로 반영하면 초당 수백~천 번
// React 리렌더가 발생해 감당이 안 된다. 대신 이 프로젝트가 poseDetector.ts에서 이미
// 쓰고 있는 "producer/consumer 분리" 철학을 그대로 따른다 — BLE 콜백(producer)은
// 그냥 배열에 값을 채워 넣기만 하고, 화면 갱신(consumer)은 그와 독립적인
// requestAnimationFrame 루프가 매 프레임마다 버퍼의 최신 스냅샷을 읽어 그린다. 이러면
// BLE 패킷이 불규칙하게 도착해도(무선 특성상 흔함) 화면은 항상 일정한 프레임레이트로
// 부드럽게 갱신된다.

import { DISPLAYED_CHANNEL_COUNT, EEG_SAMPLE_RATE_HZ } from './types'

/** 파형 차트에 보여줄 구간 길이(초). 너무 길면 화면이 답답하고 너무 짧으면 파형의
 * 리듬(예: 알파파의 8~13Hz 진동)을 눈으로 알아보기 어려워 4초로 정함. */
export const WAVEFORM_WINDOW_SECONDS = 4
export const WAVEFORM_CAPACITY = EEG_SAMPLE_RATE_HZ * WAVEFORM_WINDOW_SECONDS

/** 대역 파워(FFT) 계산에 쓸 구간 — 정확히 256샘플(=1초, =256Hz)이어야 1Hz/bin
 * 해상도가 나온다(fft.ts 주석 참고). */
export const FFT_WINDOW_SAMPLES = 256

class ChannelRingBuffer {
  private data: Float64Array
  private writeIndex = 0
  private filledCount = 0

  constructor(capacity: number) {
    this.data = new Float64Array(capacity)
  }

  push(value: number): void {
    this.data[this.writeIndex] = value
    this.writeIndex = (this.writeIndex + 1) % this.data.length
    if (this.filledCount < this.data.length) this.filledCount++
  }

  /** 가장 최근 n개 샘플을 오래된 순서로 반환(n 생략 시 전체 용량). 아직 n개만큼
   * 쌓이지 않았다면 쌓인 만큼만 반환(0으로 채우지 않음 — 초반 FFT/그리기 쪽에서
   * 길이를 직접 확인해서 처리). */
  snapshot(n?: number): number[] {
    const count = Math.min(n ?? this.data.length, this.filledCount)
    if (count === 0) return []
    const result = new Array<number>(count)
    // writeIndex는 "다음에 쓸 위치" = 가장 오래된 값이 있는 위치(버퍼가 가득 찬 뒤부터).
    const capacity = this.data.length
    const start = this.filledCount < capacity ? 0 : this.writeIndex
    for (let i = 0; i < count; i++) {
      const srcIdx = (start + (this.filledCount - count) + i) % capacity
      result[i] = this.data[srcIdx]
    }
    return result
  }

  get filled(): number {
    return this.filledCount
  }
}

/** 화면에 보여줄 채널(TP9/AF7/AF8/TP10) 각각에 대한 링 버퍼 묶음. EegApp이 하나
 * 만들어서 ref에 담아두고, museConnection의 onEegSample 콜백에서 직접
 * push()하며(React state 아님), 차트/대역파워 컴포넌트가 각자의 rAF 루프에서
 * snapshot()으로 읽는다. */
export class EegBuffers {
  readonly channels: ChannelRingBuffer[]

  constructor() {
    this.channels = Array.from({ length: DISPLAYED_CHANNEL_COUNT }, () => new ChannelRingBuffer(WAVEFORM_CAPACITY))
  }

  pushSample(electrodeIndex: number, value: number): void {
    if (electrodeIndex < 0 || electrodeIndex >= this.channels.length) return // AUX(4번) 등 화면에 안 쓰는 채널은 버림
    this.channels[electrodeIndex].push(value)
  }
}
