import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection'
import type { HandFrame } from '../types/hand'

/**
 * ⚠️ 이 파일이 쓰는 `@tensorflow-models/hand-pose-detection` 패키지는 이 개발 샌드박스의
 * 막힌 네트워크 때문에(PdfExportButton 관련 CLAUDE.md 설명과 같은 제약 — npm 레지스트리에
 * 접근할 수 없어 `npm install`로 실제 설치해 타입을 검증해볼 방법이 없었다) 실제 설치·
 * 타입체크 없이 작성했다. API 형태(SupportedModels.MediaPipeHands, createDetector,
 * estimateHands, 21개 랜드마크 이름)는 이 패키지가 수년간 안정적으로 유지해온 공개
 * 인터페이스를 기준으로 작성했지만, 배포 시(`docker compose build`가 실제로
 * `npm ci && tsc -b`를 실행하는 시점) 타입이 조금이라도 다르면 빌드가 실패할 수 있다 —
 * 그때 오류 메시지를 알려주면 바로 고칠 수 있다(이 프로젝트에 이미 있었던
 * poseDetector-build-fix 사례와 같은 성격의 문제).
 */

let handDetectorPromise: Promise<handPoseDetection.HandDetector> | null = null

/**
 * 이 손 분석 파이프라인(모델·샘플링·관절 각도 공식)이 만들어내는 값의 버전 태그.
 * ANALYSIS_PIPELINE_VERSION(poseDetector.ts, 몸 전체 포즈용)과는 별도다 — 손 분석은
 * 완전히 다른 모델(MediaPipeHands)을 쓰므로 버전도 독립적으로 관리한다.
 */
export const HAND_ANALYSIS_PIPELINE_VERSION = '2026-09-13'

/**
 * MediaPipeHands(21랜드마크) 모델을 1회만 로드하는 싱글턴. `modelType: 'lite'`는
 * poseDetector.ts의 BlazePose와 같은 이유(저사양 모바일 GPU에서도 안정적으로 재검출)로
 * 선택했다. `maxHands: 2`로 양손을 동시에 인식한다.
 */
export function getHandDetector(): Promise<handPoseDetection.HandDetector> {
  handDetectorPromise ??= (async () => {
    await tf.setBackend('webgl')
    await tf.ready()
    return handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
      runtime: 'tfjs',
      modelType: 'lite',
      maxHands: 2,
    })
  })()
  return handDetectorPromise
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.02) {
      resolve()
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    const onSeeked = () => finish()
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
    window.setTimeout(finish, 1500)
  })
}

export interface HandExtractOptions {
  samplingFps: number
  minScore?: number
  startTimeSec?: number
  maxDurationSec?: number
  onProgress?: (ratio: number) => void
}

/** 손 프레임 추출 진단 통계 — poseDetector.ts의 ExtractDebugStats와 같은 목적. */
export interface HandExtractDebugStats {
  videoWidth: number
  videoHeight: number
  attemptedFrames: number
  /** 양손 다 인식되지 않은 프레임 수 */
  noHandFrames: number
  /** 인식은 됐지만 신뢰도가 낮아 제외된 손 수(프레임당 최대 2) */
  droppedHands: number
  /** 최종 채택된 손 프레임 수(좌우 합) */
  keptHandFrames: number
  avgScore: number
}

/**
 * 손 관절 분석은 트레이너가 지정한 짧은 구간(before/after) 동안 손을 쥐었다 펴는 등
 * 비교적 정적인 동작을 담는다는 전제라, poseDetector.ts의 재생 기반(rVFC) 정밀 추출
 * 엔진(다섯 단계의 실전 버그 수정을 거친 코드)을 그대로 재사용하지 않고 훨씬 단순한
 * seek 반복 방식만 쓴다 — 그 복잡한 엔진을 손 모델용으로 일반화하다가 이미 안정적으로
 * 동작 중인 보행/ROM 분석에 회귀를 낼 위험을 피하기 위한 의도적인 선택이다. 프레임
 * 정확도가 다소 떨어질 수 있지만(문제 1, poseDetector.ts 주석 참고) 정적 동작
 * 비교에서는 크게 문제되지 않는다는 전제.
 */
export async function extractHandFrames(
  video: HTMLVideoElement,
  opts: HandExtractOptions,
  debugStats?: HandExtractDebugStats,
): Promise<HandFrame[]> {
  const detector = await getHandDetector()
  const { samplingFps, minScore = 0.5, startTimeSec = 0, maxDurationSec, onProgress } = opts
  const end = maxDurationSec ? Math.min(video.duration, startTimeSec + maxDurationSec) : video.duration
  const step = 1 / samplingFps

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')

  const frames: HandFrame[] = []
  let attemptedFrames = 0
  let noHandFrames = 0
  let droppedHands = 0
  let sumScore = 0
  let scoredHands = 0

  for (let t = startTimeSec; t < end; t += step) {
    await seekTo(video, t)
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
    const source: HTMLVideoElement | HTMLCanvasElement = ctx ? canvas : video

    attemptedFrames++
    const hands = await detector.estimateHands(source, { flipHorizontal: false })
    if (hands.length === 0) {
      noHandFrames++
      onProgress?.(Math.min((t - startTimeSec) / (end - startTimeSec || 1), 1))
      continue
    }

    for (const hand of hands) {
      sumScore += hand.score
      scoredHands++
      if (hand.score < minScore) {
        droppedHands++
        continue
      }
      const byName = new Map(hand.keypoints.map((p) => [p.name, p]))
      const get = (name: string): { x: number; y: number; score: number } => {
        const p = byName.get(name)
        return { x: p?.x ?? 0, y: p?.y ?? 0, score: p?.score ?? hand.score }
      }
      // MediaPipe Hands 정식 랜드마크 이름(수년간 안정적으로 유지된 공개 규격).
      frames.push({
        time: t,
        side: hand.handedness === 'Left' ? 'left' : 'right',
        score: hand.score,
        wrist: get('wrist'),
        thumbCmc: get('thumb_cmc'),
        thumbMcp: get('thumb_mcp'),
        thumbIp: get('thumb_ip'),
        thumbTip: get('thumb_tip'),
        indexMcp: get('index_finger_mcp'),
        indexPip: get('index_finger_pip'),
        indexDip: get('index_finger_dip'),
        indexTip: get('index_finger_tip'),
        middleMcp: get('middle_finger_mcp'),
        middlePip: get('middle_finger_pip'),
        middleDip: get('middle_finger_dip'),
        middleTip: get('middle_finger_tip'),
        ringMcp: get('ring_finger_mcp'),
        ringPip: get('ring_finger_pip'),
        ringDip: get('ring_finger_dip'),
        ringTip: get('ring_finger_tip'),
        pinkyMcp: get('pinky_finger_mcp'),
        pinkyPip: get('pinky_finger_pip'),
        pinkyDip: get('pinky_finger_dip'),
        pinkyTip: get('pinky_finger_tip'),
      })
    }
    onProgress?.(Math.min((t - startTimeSec) / (end - startTimeSec || 1), 1))
  }
  onProgress?.(1)

  if (debugStats) {
    Object.assign(debugStats, {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      attemptedFrames,
      noHandFrames,
      droppedHands,
      keptHandFrames: frames.length,
      avgScore: scoredHands > 0 ? sumScore / scoredHands : 0,
    })
  }

  return frames
}

export function splitHandFramesBySide(frames: HandFrame[]): { left: HandFrame[]; right: HandFrame[] } {
  return {
    left: frames.filter((f) => f.side === 'left'),
    right: frames.filter((f) => f.side === 'right'),
  }
}
