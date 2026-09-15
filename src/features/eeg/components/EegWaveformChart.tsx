import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { EegBuffers } from '../../../shared/lib/eeg/eegBuffer'
import { WAVEFORM_CAPACITY } from '../../../shared/lib/eeg/eegBuffer'
import { EEG_CHANNEL_NAMES } from '../../../shared/lib/eeg/types'

interface Props {
  buffersRef: RefObject<EegBuffers | null>
  running: boolean
}

const CHANNEL_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d']

/** 채널별로 화면을 위아래로 나눠 스크롤 파형을 그린다. gait 기능의 SkeletonViewer.tsx와
 * 같은 canvas + useRef 방식을 따르되, 그쪽은 프레임 인덱스 상태가 바뀔 때만
 * 다시 그리는 반면 여기는 데이터가 계속 흘러 들어오므로 requestAnimationFrame으로
 * 계속 다시 그린다(eegBuffer.ts의 producer/consumer 분리 설명 참고). */
export function EegWaveformChart({ buffersRef, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return

    const draw = () => {
      const canvas = canvasRef.current
      const buffers = buffersRef.current
      if (canvas && buffers) {
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        const width = Math.max(1, Math.round(rect.width * dpr))
        const height = Math.max(1, Math.round(rect.height * dpr))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
          const channelCount = buffers.channels.length
          const rowHeight = height / channelCount

          for (let ch = 0; ch < channelCount; ch++) {
            const samples = buffers.channels[ch].snapshot()
            const rowTop = ch * rowHeight
            const rowMid = rowTop + rowHeight / 2

            // 채널 구분선 + 라벨
            ctx.strokeStyle = 'rgba(128,128,128,0.2)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, rowTop)
            ctx.lineTo(width, rowTop)
            ctx.stroke()

            ctx.fillStyle = '#6b7280'
            ctx.font = `${12 * dpr}px sans-serif`
            ctx.fillText(EEG_CHANNEL_NAMES[ch], 6 * dpr, rowTop + 14 * dpr)

            if (samples.length < 2) continue

            // µV 값을 이 채널 행 높이에 맞게 스케일 — 매 프레임 현재 창의 최대
            // 진폭 기준으로 자동 스케일한다(±값 범위가 사람/상태마다 크게 달라
            // 고정 스케일은 너무 작거나 너무 크게 보일 수 있어서).
            let maxAbs = 1
            for (const v of samples) maxAbs = Math.max(maxAbs, Math.abs(v))
            const scale = (rowHeight / 2) * 0.85 / maxAbs

            ctx.strokeStyle = CHANNEL_COLORS[ch % CHANNEL_COLORS.length]
            ctx.lineWidth = 1.5 * dpr
            ctx.beginPath()
            const xStep = width / (WAVEFORM_CAPACITY - 1)
            const offset = WAVEFORM_CAPACITY - samples.length
            for (let i = 0; i < samples.length; i++) {
              const x = (offset + i) * xStep
              const y = rowMid - samples[i] * scale
              if (i === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [running, buffersRef])

  return <canvas ref={canvasRef} className="eeg-waveform-canvas" aria-label="실시간 뇌파 파형" />
}
