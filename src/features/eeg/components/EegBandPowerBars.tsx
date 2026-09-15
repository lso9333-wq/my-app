import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { EegBuffers } from '../../../shared/lib/eeg/eegBuffer'
import { FFT_WINDOW_SAMPLES } from '../../../shared/lib/eeg/eegBuffer'
import { computeBandPowers } from '../../../shared/lib/eeg/fft'
import { EEG_BANDS, EEG_SAMPLE_RATE_HZ } from '../../../shared/lib/eeg/types'
import type { EegBandPowers } from '../../../shared/lib/eeg/types'

interface Props {
  buffersRef: RefObject<EegBuffers | null>
  running: boolean
}

const UPDATE_INTERVAL_MS = 500

/** 채널별 최근 1초(256샘플) 구간에 FFT를 돌려 대역 파워를 구하고, 화면에 보이는
 * 4채널 평균을 막대로 보여준다. 매 프레임(rAF)이 아니라 setInterval로 0.5초마다만
 * 다시 계산한다 — FFT는 파형 그리기보다 계산량이 있고, 대역 파워는 눈으로 볼 때
 * 60fps로 갱신될 필요가 없기 때문(파형 자체의 부드러운 스크롤과는 다른 요구사항). */
export function EegBandPowerBars({ buffersRef, running }: Props) {
  const [powers, setPowers] = useState<EegBandPowers | null>(null)

  useEffect(() => {
    if (!running) {
      setPowers(null)
      return
    }
    const timer = window.setInterval(() => {
      const buffers = buffersRef.current
      if (!buffers) return
      const bandRanges = EEG_BANDS.map((b) => ({ key: b.key, minHz: b.minHz, maxHz: b.maxHz }))
      const perChannel: Record<string, number>[] = []
      for (const channel of buffers.channels) {
        const samples = channel.snapshot(FFT_WINDOW_SAMPLES)
        if (samples.length < FFT_WINDOW_SAMPLES) continue // 아직 1초치가 안 모임
        perChannel.push(computeBandPowers(samples, EEG_SAMPLE_RATE_HZ, bandRanges))
      }
      if (perChannel.length === 0) return
      const averaged = {} as EegBandPowers
      for (const band of EEG_BANDS) {
        let sum = 0
        for (const p of perChannel) sum += p[band.key]
        averaged[band.key] = sum / perChannel.length
      }
      setPowers(averaged)
    }, UPDATE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [running, buffersRef])

  if (!powers) {
    return <p className="app-subtitle">대역 파워 계산 중 — 연결 후 1초 이상 기다려 주세요.</p>
  }

  const maxPower = Math.max(...EEG_BANDS.map((b) => powers[b.key]), 1e-9)

  return (
    <div className="eeg-band-powers">
      <p className="app-subtitle">
        4채널(TP9·AF7·AF8·TP10) 평균 대역 파워 — 절대적인 의학적 기준값이 아니라, 지금 이 화면 안에서의
        상대적 변화를 보기 위한 참고용입니다.
      </p>
      {EEG_BANDS.map((band) => {
        const value = powers[band.key]
        const pct = Math.min(100, (value / maxPower) * 100)
        return (
          <div key={band.key} className="eeg-band-row">
            <span className="eeg-band-label">{band.label}</span>
            <div className="eeg-band-bar-track">
              <div className="eeg-band-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="eeg-band-value">{value.toFixed(0)}</span>
          </div>
        )
      })}
    </div>
  )
}
