import { useRef } from 'react'
import type { RomRange } from '../types/rom'

interface Props {
  duration: number
  before: RomRange
  after: RomRange
  onChange: (before: RomRange, after: RomRange) => void
  onScrub: (time: number) => void
}

type HandleId = 'before-start' | 'before-end' | 'after-start' | 'after-end'

const MIN_GAP = 0.3
const NUDGE = 0.1
const NUDGE_LARGE = 1

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export function RangeSelector({ duration, before, after, onChange, onScrub }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<HandleId | null>(null)

  const setTime = (handle: HandleId, t: number) => {
    const next = { before: { ...before }, after: { ...after } }
    switch (handle) {
      case 'before-start':
        next.before.start = clamp(t, 0, before.end - MIN_GAP)
        break
      case 'before-end':
        next.before.end = clamp(t, before.start + MIN_GAP, duration)
        break
      case 'after-start':
        next.after.start = clamp(t, 0, after.end - MIN_GAP)
        break
      case 'after-end':
        next.after.end = clamp(t, after.start + MIN_GAP, duration)
        break
    }
    onChange(next.before, next.after)
    onScrub(t)
  }

  const timeFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration)
  }

  const startDrag = (handle: HandleId) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = handle
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const handle = draggingRef.current
    if (!handle) return
    setTime(handle, timeFromClientX(e.clientX))
  }

  const endDrag = () => {
    draggingRef.current = null
  }

  const onKeyDown = (handle: HandleId, current: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? NUDGE_LARGE : NUDGE
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setTime(handle, current - step)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setTime(handle, current + step)
    }
  }

  const pct = (t: number) => `${duration > 0 ? (t / duration) * 100 : 0}%`

  const handles: { id: HandleId; time: number; label: string }[] = [
    { id: 'before-start', time: before.start, label: '이전 구간 시작' },
    { id: 'before-end', time: before.end, label: '이전 구간 끝' },
    { id: 'after-start', time: after.start, label: '이후 구간 시작' },
    { id: 'after-end', time: after.end, label: '이후 구간 끝' },
  ]

  return (
    <div className="range-selector">
      <div
        ref={trackRef}
        className="range-track"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="range-band range-band-before"
          style={{ left: pct(before.start), width: pct(before.end - before.start) }}
        />
        <div
          className="range-band range-band-after"
          style={{ left: pct(after.start), width: pct(after.end - after.start) }}
        />
        {handles.map((h) => (
          <div
            key={h.id}
            role="slider"
            tabIndex={0}
            aria-label={h.label}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={h.time}
            className={`range-handle range-handle-${h.id}`}
            style={{ left: pct(h.time) }}
            onPointerDown={startDrag(h.id)}
            onKeyDown={onKeyDown(h.id, h.time)}
          />
        ))}
      </div>
      <div className="range-readout">
        <span className="range-readout-before">
          이전: {before.start.toFixed(2)}s – {before.end.toFixed(2)}s
        </span>
        <span className="range-readout-after">
          이후: {after.start.toFixed(2)}s – {after.end.toFixed(2)}s
        </span>
      </div>
    </div>
  )
}
