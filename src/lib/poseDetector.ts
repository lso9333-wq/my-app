import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import type { PoseFrame } from '../types/gait'

let detectorPromise: Promise<poseDetection.PoseDetector> | null = null

/** MoveNet SinglePose Thunder 모델을 1회만 로드하는 싱글턴 */
export function getPoseDetector(): Promise<poseDetection.PoseDetector> {
  detectorPromise ??= (async () => {
    await tf.setBackend('webgl')
    await tf.ready()
    return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    })
  })()
  return detectorPromise
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

const KEYPOINT_INDEX: Record<string, number> = {}
;['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
].forEach((name, i) => (KEYPOINT_INDEX[name] = i))

export interface ExtractOptions {
  /** 초당 분석 프레임 수 */
  samplingFps: number
  minScore?: number
  /** 분석할 최대 길이(초). 영상이 더 길면 앞부분만 분석한다. */
  maxDurationSec?: number
  onProgress?: (ratio: number) => void
}

/**
 * 영상을 samplingFps 간격으로 탐색(seek)하며 각 시점의 포즈를 추정한다.
 * 파일 업로드된 영상은 실시간 재생 없이 정지 상태로 프레임을 순회하므로
 * 기기 성능과 무관하게 결정적인 프레임 간격으로 분석할 수 있다.
 */
export async function extractPoseFrames(
  video: HTMLVideoElement,
  opts: ExtractOptions,
): Promise<PoseFrame[]> {
  const detector = await getPoseDetector()
  const { samplingFps, minScore = 0.3, maxDurationSec, onProgress } = opts
  const duration = maxDurationSec ? Math.min(video.duration, maxDurationSec) : video.duration
  const step = 1 / samplingFps
  const frames: PoseFrame[] = []

  for (let t = 0; t < duration; t += step) {
    await seekTo(video, t)
    const poses = await detector.estimatePoses(video, { flipHorizontal: false })
    const kp = poses[0]?.keypoints
    if (kp) {
      const get = (name: string): { x: number; y: number; score: number } => {
        const p = kp[KEYPOINT_INDEX[name]]
        return { x: p?.x ?? 0, y: p?.y ?? 0, score: p?.score ?? 0 }
      }
      const leftHip = get('left_hip')
      const rightHip = get('right_hip')
      const leftKnee = get('left_knee')
      const rightKnee = get('right_knee')
      const leftAnkle = get('left_ankle')
      const rightAnkle = get('right_ankle')
      const leftShoulder = get('left_shoulder')
      const rightShoulder = get('right_shoulder')

      const usable = [leftHip, rightHip, leftAnkle, rightAnkle].every((p) => p.score >= minScore)
      if (usable) {
        frames.push({
          time: t,
          leftHip,
          rightHip,
          leftKnee,
          rightKnee,
          leftAnkle,
          rightAnkle,
          leftShoulder,
          rightShoulder,
          keypoints: kp.map((p) => ({ name: p.name ?? '', x: p.x, y: p.y, score: p.score ?? 0 })),
        })
      }
    }
    onProgress?.(Math.min(t / duration, 1))
  }

  onProgress?.(1)
  return frames
}

export const POSE_CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
]
