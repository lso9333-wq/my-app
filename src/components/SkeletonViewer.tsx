import { useEffect, useRef, useState } from 'react'
import type { PoseFrame } from '../types/gait'
import { POSE_CONNECTIONS } from '../lib/poseDetector'

interface Props {
  videoUrl: string
  frames: PoseFrame[]
}

export function SkeletonViewer({ videoUrl, frames }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const frame = frames[index]

  const draw = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !frame || !video.videoWidth) return

    const rect = video.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scaleX = rect.width / video.videoWidth
    const scaleY = rect.height / video.videoHeight
    const byName = new Map(frame.keypoints.map((k) => [k.name, k]))

    ctx.strokeStyle = 'rgba(94, 106, 210, 0.9)'
    ctx.lineWidth = 3
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = byName.get(a)
      const pb = byName.get(b)
      if (!pa || !pb || pa.score < 0.3 || pb.score < 0.3) continue
      ctx.beginPath()
      ctx.moveTo(pa.x * scaleX, pa.y * scaleY)
      ctx.lineTo(pb.x * scaleX, pb.y * scaleY)
      ctx.stroke()
    }

    ctx.fillStyle = '#8a93f0'
    for (const kp of frame.keypoints) {
      if (kp.score < 0.3) continue
      ctx.beginPath()
      ctx.arc(kp.x * scaleX, kp.y * scaleY, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => {
      if (frames[0]) video.currentTime = frames[0].time
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !frame) return
    video.currentTime = frame.time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    if (!playing) return
    if (index >= frames.length - 1) {
      setPlaying(false)
      return
    }
    const dt = Math.max((frames[index + 1].time - frames[index].time) * 1000, 30)
    const timer = window.setTimeout(() => setIndex((i) => Math.min(i + 1, frames.length - 1)), dt)
    return () => window.clearTimeout(timer)
  }, [playing, index, frames])

  return (
    <div className="skeleton-viewer">
      <div className="video-wrap">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} src={videoUrl} muted playsInline onSeeked={draw} />
        <canvas ref={canvasRef} />
      </div>
      <div className="scrubber">
        <button
          type="button"
          className="scrubber-play"
          onClick={() => setPlaying((p) => !p)}
          disabled={frames.length === 0}
        >
          {playing ? '일시정지' : '재생'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={index}
          onChange={(e) => {
            setPlaying(false)
            setIndex(Number(e.target.value))
          }}
        />
        <span className="scrubber-time">
          {frame ? `${frame.time.toFixed(2)}s` : '0.00s'} · {frames.length ? index + 1 : 0}/{frames.length}
        </span>
      </div>
    </div>
  )
}
