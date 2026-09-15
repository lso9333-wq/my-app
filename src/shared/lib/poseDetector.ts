import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import type { PoseFrame } from '../types/pose'
import { smoothPoseFrames } from './oneEuroFilter'

let detectorPromise: Promise<poseDetection.PoseDetector> | null = null

/**
 * 지금 이 코드가 만들어내는 추정치가 "어떤 계산 로직 버전"으로 계산됐는지 기록해두는
 * 태그. 포즈 모델 자체(BlazePose lite), 샘플링 방식(고정 그리드), 스무딩(One Euro
 * Filter 파라미터), 또는 gait/rom의 추정 공식(gaitAnalysis.ts, xmskEstimates.ts)
 * 중 하나라도 바뀌면 이 값을 올려야 한다 — 그래야 나중에 트레이너 실측값(ground
 * truth)과 AI 추정치를 비교해 계산 로직을 보정할 때, 서로 다른 버전으로 계산된
 * 값들이 뒤섞여 통계를 왜곡하는 일을 막을 수 있다(자세한 배경은
 * docs/ai-training-plan.md 참고). gait/rom 양쪽이 이 파이프라인(포즈 검출+스무딩)을
 * 공유하므로 버전도 여기 하나로 공유한다 — 두 기능의 추정 공식 자체가 바뀔 때도
 * (포즈 파이프라인이 그대로여도) 이 값을 같이 올린다.
 *
 * 값 자체에 특별한 의미는 없다(날짜는 그냥 "언제 이 버전이 생겼는지" 참고용) —
 * 오직 "같은 문자열 = 같은 계산 로직으로 만들어진 값"이라는 것만 보장하면 된다.
 */
export const ANALYSIS_PIPELINE_VERSION = '2026-09-13'

/**
 * BlazePose(33랜드마크, tfjs 런타임) 모델을 1회만 로드하는 싱글턴.
 *
 * 기존 MoveNet(COCO-17)에는 발뒤꿈치·발끝 키포인트가 없어 보행 분석에서
 * 발목 y좌표를 "발이 땅에 닿는 시점"의 근사치로만 쓸 수 있었다. BlazePose는
 * heel/foot_index를 포함한 33개 랜드마크를 제공해 실제 입각기(heel-strike)에
 * 더 가까운 기준점을 쓸 수 있다 (2024 스마트폰 보행분석 연구에서도 동일하게
 * shoulder/hip/knee/ankle/heel/toe 랜드마크를 사용). `runtime: 'tfjs'`는
 * 순수 TFJS 연산만 사용하므로 `@mediapipe/pose`(mediapipe 런타임 전용,
 * shim으로 대체됨)가 필요 없다. `modelType: 'lite'`는 'full'/'heavy'보다
 * 가벼워 모바일 GPU(webgl)에서도 안정적으로 프레임마다 사람을 다시 감지할 수
 * 있다 — 'full' 모델은 저사양 안드로이드 기기에서 사람 검출 자체를 자주
 * 놓쳐(특히 보행 영상처럼 다리가 서로 겹치는 프레임에서) 유효 프레임이
 * 급감하는 문제가 있었다.
 */
export function getPoseDetector(): Promise<poseDetection.PoseDetector> {
  detectorPromise ??= (async () => {
    await tf.setBackend('webgl')
    await tf.ready()
    return poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: 'tfjs',
      modelType: 'lite',
    })
  })()
  return detectorPromise
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    // 이미 목표 시각 근처면 seek 자체가 발생하지 않아 일부 브라우저에서
    // 'seeked' 이벤트가 아예 안 오는 경우가 있다 — 그러면 즉시 resolve.
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
    // 'seeked'가 끝내 발생하지 않는 기기/브라우저 조합에 대비한 안전장치.
    // (이게 없으면 seekTo가 영원히 대기해 분석 전체가 멈춘 것처럼 보인다.)
    window.setTimeout(finish, 1500)
  })
}

export interface ExtractOptions {
  /** 초당 분석 프레임 수 (목표치 — 실제 기기 성능에 따라 이보다 적게 샘플링될 수 있음) */
  samplingFps: number
  minScore?: number
  /** 분석을 시작할 시점(초). 기본값 0. */
  startTimeSec?: number
  /** startTimeSec부터 분석할 최대 길이(초). 구간이 더 길면 앞부분만 분석한다. */
  maxDurationSec?: number
  onProgress?: (ratio: number) => void
}

/**
 * extractPoseFrames 실행 결과를 진단하기 위한 통계. 걸음이 거의 감지되지
 * 않을 때 "애초에 프레임을 거의 못 뽑았는지" vs "프레임은 충분한데 신뢰도가
 * 낮았는지"를 화면에서 바로 구분할 수 있도록 UI에 노출한다.
 */
export interface ExtractDebugStats {
  videoWidth: number
  videoHeight: number
  /** 실제로 포즈 추정을 시도한 총 프레임 수 */
  attemptedFrames: number
  /** 사람이 아예 감지되지 않은(포즈 자체가 반환되지 않은) 프레임 수 */
  noPoseFrames: number
  /** 골반 신뢰도 부족 등으로 채택되지 않은 프레임 수 */
  droppedFrames: number
  /** 최종 채택된 프레임 수 (frames.length와 동일) */
  keptFrames: number
  avgHipScore: number
  avgLeftAnkleScore: number
  avgRightAnkleScore: number
  avgLeftHeelScore: number
  avgRightHeelScore: number
  /**
   * 이번 실행에서 실제로 시도한 프레임들의 재생 시각(mediaTime)을 모두 더한
   * 값(밀리초, 반올림). 같은 영상을 같은 기기에서 여러 번 분석했을 때 이
   * 값이 매번 같다면 "어떤 프레임을 뽑았는지"는 안정적이라는 뜻이고, 그런데도
   * 걸음 수 등 최종 결과가 달라진다면 프레임 선택이 아니라 그 이후 단계(포즈
   * 추정 자체의 미세한 비결정성, 또는 분석 로직)가 원인이라는 걸 구분할 수
   * 있다. 저장된 진단 기록끼리 이 값을 비교하는 용도로만 쓰는 디버그 지표다.
   */
  sampledTimesChecksum: number
}

interface StatsAccumulator {
  attemptedFrames: number
  noPoseFrames: number
  droppedFrames: number
  sumHip: number
  sumLeftAnkle: number
  sumRightAnkle: number
  sumLeftHeel: number
  sumRightHeel: number
  sumAttemptedTimeMs: number
}

function newStatsAccumulator(): StatsAccumulator {
  return {
    attemptedFrames: 0,
    noPoseFrames: 0,
    droppedFrames: 0,
    sumHip: 0,
    sumLeftAnkle: 0,
    sumRightAnkle: 0,
    sumLeftHeel: 0,
    sumRightHeel: 0,
    sumAttemptedTimeMs: 0,
  }
}

function finalizeStats(video: HTMLVideoElement, acc: StatsAccumulator, keptFrames: number): ExtractDebugStats {
  const scored = acc.attemptedFrames - acc.noPoseFrames || 1
  return {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    attemptedFrames: acc.attemptedFrames,
    noPoseFrames: acc.noPoseFrames,
    droppedFrames: acc.droppedFrames,
    keptFrames,
    avgHipScore: acc.sumHip / scored,
    avgLeftAnkleScore: acc.sumLeftAnkle / scored,
    avgRightAnkleScore: acc.sumRightAnkle / scored,
    avgLeftHeelScore: acc.sumLeftHeel / scored,
    avgRightHeelScore: acc.sumRightHeel / scored,
    sampledTimesChecksum: Math.round(acc.sumAttemptedTimeMs),
  }
}

/** 한 프레임(비디오 또는 캔버스)에 대해 포즈를 추정하고, 채택되면 frames에 push한다. */
async function processFrame(
  time: number,
  source: HTMLVideoElement | HTMLCanvasElement,
  detector: poseDetection.PoseDetector,
  minScore: number,
  frames: PoseFrame[],
  acc: StatsAccumulator,
): Promise<void> {
  acc.attemptedFrames++
  acc.sumAttemptedTimeMs += time * 1000
  const poses = await detector.estimatePoses(source, { flipHorizontal: false })
  const kp = poses[0]?.keypoints
  if (!kp) {
    acc.noPoseFrames++
    return
  }

  // 모델마다 키포인트 개수·순서가 다르므로(MoveNet 17개 vs BlazePose 33개),
  // 고정 인덱스 대신 각 키포인트의 name 필드로 조회한다.
  const byName = new Map(kp.map((p) => [p.name, p]))
  const get = (name: string): { x: number; y: number; score: number } => {
    const p = byName.get(name)
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
  const leftElbow = get('left_elbow')
  const rightElbow = get('right_elbow')
  const leftWrist = get('left_wrist')
  const rightWrist = get('right_wrist')
  const leftHeel = get('left_heel')
  const rightHeel = get('right_heel')
  const leftFootIndex = get('left_foot_index')
  const rightFootIndex = get('right_foot_index')

  acc.sumHip += (leftHip.score + rightHip.score) / 2
  acc.sumLeftAnkle += leftAnkle.score
  acc.sumRightAnkle += rightAnkle.score
  acc.sumLeftHeel += leftHeel.score
  acc.sumRightHeel += rightHeel.score

  // 골반(hip)만 필수로 요구한다. 옆에서 찍은 보행 영상은 걸음마다 한쪽
  // 발목이 반대쪽 다리에 가려 순간적으로 신뢰도가 떨어지는 경우가 많은데,
  // 발목까지 모두 필수로 두면 그런 프레임이 통째로 버려져 유효 프레임이
  // 거의 남지 않는 문제가 있었다. 낮은 신뢰도의 발/발목 좌표는
  // gaitAnalysis.ts에서 직전 값으로 대체해 튀는 값을 걸러낸다.
  const usable = [leftHip, rightHip].every((p) => p.score >= minScore)
  if (!usable) {
    acc.droppedFrames++
    return
  }

  frames.push({
    time,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHeel,
    rightHeel,
    leftFootIndex,
    rightFootIndex,
    keypoints: kp.map((p) => ({ name: p.name ?? '', x: p.x, y: p.y, score: p.score ?? 0 })),
  })
}

/** 비디오를 캔버스에 그려서 반환한다(캔버스 준비가 안 되면 video를 그대로 반환). */
function drawToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | null,
): HTMLVideoElement | HTMLCanvasElement {
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return video
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

type RVFCMetadata = { mediaTime: number }

interface RVFCMethods {
  requestVideoFrameCallback?: (callback: (now: number, metadata: RVFCMetadata) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/**
 * `requestVideoFrameCallback`/`cancelVideoFrameCallback`은 TypeScript가 번들하는
 * DOM 타입 버전에 따라 `HTMLVideoElement`에 이미 필수(non-optional) 멤버로
 * 선언되어 있을 수도, 아예 선언되어 있지 않을 수도 있다. `interface X extends
 * HTMLVideoElement`로 재선언하면 둘 중 어느 경우든 TS2430/TS2345 타입 충돌이
 * 날 수 있어(실제로 빌드 환경에서 발생했다), `HTMLVideoElement`와 무관한 별도
 * 타입으로 두고 `as unknown as`로만 접근해 이 문제를 원천적으로 피한다.
 */
function asRVFC(video: HTMLVideoElement): RVFCMethods {
  return video as unknown as RVFCMethods
}

interface CapturedFrame {
  time: number
  canvas: HTMLCanvasElement
}

/** 캡처 큐에 한 번에 쌓아둘 수 있는 최대 프레임 수(뒤처짐 완충용, 메모리 상한). */
const MAX_CAPTURE_QUEUE = 6

/**
 * 실제 재생(play)을 통해 프레임을 얻는다. 지금의 구조에 이르기까지 두 번의
 * 실패를 거쳤고, 각각 다른 문제를 드러냈다.
 *
 * [문제 1 — 프레임 정확도] 일부 기기/코덱 조합(특히 HEVC로 촬영된 안드로이드
 * 영상)은 `currentTime`으로 임의 지점에 반복적으로 seek하면 실제로는 가장
 * 가까운 키프레임 근처로만 이동해, 서로 다른 시각을 요청해도 같은(또는 거의
 * 같은) 픽셀이 반복 추출되는 경우가 있다 — 사람은 계속 인식되지만("프레임
 * 채택률"은 높게 나옴) 관절의 실제 움직임 신호가 거의 없어져 걸음이 몇
 * 개밖에 안 잡히는 것처럼 보인다. seek 대신 이어서(forward) 재생하며
 * `requestVideoFrameCallback`의 `mediaTime`으로 프레임을 얻으면 이 문제를
 * 피할 수 있다.
 *
 * [문제 2 — 실행마다 결과가 달라짐] 처음에는 seek 없이 영상을 계속
 * 재생하면서(`video.play()`를 한 번만 호출) 목표 간격(1/samplingFps)마다
 * 프레임을 하나씩 골라 포즈 추정을 실행했다. 영상은 실제 배속(1x)으로
 * 계속 흘러가는데 포즈 추정(ML 추론)에 걸리는 시간은 기기 발열·다른 앱
 * 점유 등에 따라 실행할 때마다 들쭉날쭉해서, 추론이 느린 실행에서는 그
 * 동안 영상이 더 많이 흘러가버려 다른 실제 프레임이 선택되었다 — 같은
 * 영상을 같은 폰에서 여러 번 분석해도 매번 다른 결과가 나온 원인.
 *
 * [문제 2의 첫 번째 수정, 그리고 그것이 낳은 문제 3] 문제 2를 고치려고
 * "목표 시각까지 재생 → 그 프레임에서 일시정지 → 포즈 추정(영상 멈춤) →
 * 다음 목표까지 다시 재생"을 반복하는 방식을 썼다. 그런데 브라우저가 아직
 * 처리 중인 `play()` 요청에 대해 `pause()`를 호출하면 그 `play()` 요청이
 * "중단됨(interrupted)"으로 처리되며 재생 파이프라인이 불안정해질 수 있다.
 * 빠른 기기(PC)일수록 목표 프레임이 `play()` 요청 자체가 채 처리되기도
 * 전에 도착해 이 경쟁 상태에 훨씬 자주 걸렸고, 이것이 PC에서 유효 프레임이
 * 거의 뽑히지 않던 것(ROM "데이터 부족", 보행 결과 재생 버튼 비활성화)과
 * 무관하지 않아 보인다. 폰은 상대적으로 느려 이 경쟁에 덜 자주 걸렸을
 * 뿐이고, 걸릴 때마다 그 실행의 표본이 달라져 여전히 결과가 들쭉날쭉했다.
 *
 * [최종 구조] `video.play()`는 전체 구간에 걸쳐 딱 한 번만 호출하고
 * (재생 중 절대 일시정지하지 않음), `requestVideoFrameCallback`이 들어올
 * 때마다 — 목표 간격 이상 지났으면 — 그 순간 즉시(동기적으로) 캔버스에
 * 그려서(`ctx.drawImage`, 픽셀을 그 자리에서 확정) 큐에 쌓기만 한다
 * ("생산자"). 느릴 수 있는 포즈 추정(ML 추론)은 별도의 루프("소비자")가
 * 큐에서 하나씩 꺼내 순서대로 처리한다. 이렇게 캡처(어떤 프레임을 쓸지, 그
 * 프레임의 픽셀이 무엇인지)가 추론 속도와 완전히 분리되므로: 어떤 프레임이
 * 선택되는지는 오직 실제 재생 진행(영상 자체의 재생 흐름)으로만 정해져
 * 추론 속도(기기 부하)와 무관하게 항상 동일하고(문제 2 해결), 재생 중
 * 일시정지를 전혀 하지 않으므로 문제 3의 경쟁 상태 자체가 발생하지 않는다.
 * 큐 길이는 `MAX_CAPTURE_QUEUE`로 제한해, 추론이 캡처 속도를 지속적으로
 * 못 따라가는 극단적인 저사양 기기에서도 메모리가 무한정 늘어나지 않도록
 * 한다(그 경우 초과분은 캡처 자체를 건너뛴다 — 프레임이 바뀌는 것이
 * 아니라 일부가 누락될 뿐이라 문제 2 같은 왜곡은 생기지 않는다).
 *
 * [문제 4 — "지원됨"인데 실제로는 안 불리는 rVFC, 그리고 무한 대기] 이
 * 구조로 바꾼 뒤 PC 일부 환경에서 "재생 자체가 안 되고 분석이 끝나지도
 * 않는" 증상이 나왔다. `requestVideoFrameCallback`이 함수로 존재한다고
 * (`typeof === 'function'`) 해서 실제로 매 프레임 호출된다는 보장은 없다
 * — 특정 브라우저/그래픽 드라이버 조합에서는 등록은 되지만 콜백이 한
 * 번도 안 불릴 수 있다. 이러면 (a) 프레임을 하나도 못 채우니 결과가
 * "데이터 부족"이거나 재생 버튼이 비활성 상태로 남고, (b) 구간 종료
 * 조건(`mediaTime >= end`)도 rVFC 콜백 안에서만 검사하므로 이 콜백이
 * 아예 안 오면 영상이 끝까지(구간이 아니라 영상 전체 길이만큼) 재생될
 * 때까지 `ended` 이벤트도 못 만나 사실상 멈춘 것처럼 보인다. 이를 막기
 * 위해 두 가지 안전장치를 둔다: ① 재생 시작 후 `RVFC_STARTUP_GRACE_MS`
 * 안에 rVFC 콜백이 단 한 번도 안 왔으면 이 실행을 포기하고(`null` 반환)
 * 호출부가 예전 seek 기반 방식(`extractViaSeek`)으로 다시 시도하게 한다.
 * ② 그 관문을 통과해 정상 진행 중이더라도, 예상 밖의 사유로 종료 조건에
 * 끝내 도달하지 못하는 경우에 대비해 구간 길이에 비례한 전체 시간 제한
 * (`watchdogMs`)을 두고, 넘기면 그때까지 모은 프레임만으로 강제 종료한다
 * ("먹통"보다는 "데이터 부족"이 낫다는 원칙). onFrame 콜백 내부에서
 * 예외가 나도(예: 캔버스 관련 오류) 조용히 전체가 멈추지 않도록
 * try/catch로 감싸 즉시 종료 처리한다.
 */
const RVFC_STARTUP_GRACE_MS = 1500

async function extractViaPlayback(
  video: HTMLVideoElement,
  detector: poseDetection.PoseDetector,
  params: { samplingFps: number; minScore: number; startTimeSec: number; end: number; onProgress?: (r: number) => void },
): Promise<{ frames: PoseFrame[]; stats: ExtractDebugStats } | null> {
  const { samplingFps, minScore, startTimeSec, end, onProgress } = params
  const frames: PoseFrame[] = []
  const acc = newStatsAccumulator()
  const interval = 1 / samplingFps
  const rvfc = asRVFC(video)
  const watchdogMs = Math.max(15000, (end - startTimeSec) * 2000 + 10000)

  await seekTo(video, startTimeSec)

  const queue: CapturedFrame[] = []
  let capturing = true
  // 고정된 절대 시각 그리드(startTimeSec, +interval, +interval, ...)를 목표로 삼는다.
  // "마지막 캡처 시각 대비 interval 이상 지났는지"로 판단하면(예전 방식) 기기마다 실제
  // 디코딩 프레임 속도가 달라 그리드 자체가 기기별로 미세하게 어긋나며 누적된다 — PC와
  // 폰이 같은 영상을 분석해도 서로 다른 시각의 프레임을 뽑게 되는 원인 중 하나다. 목표
  // 시각을 고정된 절대 그리드로 두면(다음 목표 지점에 도달한 "현재" 프레임을 채택하고,
  // 지나친 목표 지점은 한 번에 건너뜀) 기기가 달라도 같은 시각을 노려 샘플링하므로 이
  // 어긋남이 누적되지 않는다. 다만 이렇게 해도 그 시각의 실제 픽셀 자체가 기기별
  // 하드웨어 비디오 디코더에 따라 미세하게 다를 수 있는 문제까지 없애주지는 못한다
  // (자세한 내용은 CLAUDE.md 참고).
  let nextTarget = startTimeSec
  let rvfcHandle: number | null = null
  let onFrameFireCount = 0

  const stop = () => {
    capturing = false
  }

  const onEnded = () => stop()

  const onFrame = (_now: number, metadata: RVFCMetadata) => {
    onFrameFireCount++
    if (!capturing) return
    try {
      if (metadata.mediaTime >= end) {
        stop()
        return
      }
      if (metadata.mediaTime >= nextTarget && queue.length < MAX_CAPTURE_QUEUE) {
        while (nextTarget <= metadata.mediaTime) nextTarget += interval
        const frameCanvas = document.createElement('canvas')
        frameCanvas.width = video.videoWidth
        frameCanvas.height = video.videoHeight
        const frameCtx = frameCanvas.getContext('2d')
        if (frameCtx) frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height)
        queue.push({ time: metadata.mediaTime, canvas: frameCanvas })
      }
    } catch (err) {
      console.error('[poseDetector] 프레임 캡처 중 오류가 발생해 이번 구간 추출을 중단합니다.', err)
      stop()
      return
    }
    if (rvfc.requestVideoFrameCallback) {
      rvfcHandle = rvfc.requestVideoFrameCallback(onFrame)
    }
  }

  video.addEventListener('ended', onEnded, { once: true })
  if (rvfc.requestVideoFrameCallback) {
    rvfcHandle = rvfc.requestVideoFrameCallback(onFrame)
  }
  const playPromise = video.play().catch((err) => {
    console.warn('[poseDetector] video.play()가 거부되었습니다.', err)
    stop()
  })

  const startedAt = Date.now()
  let gaveUpOnRvfc = false

  // 소비자: capturing이 꺼진 뒤에도 큐에 남은 항목은 끝까지 처리한다.
  while (capturing || queue.length > 0) {
    const elapsed = Date.now() - startedAt
    if (!gaveUpOnRvfc && onFrameFireCount === 0 && elapsed >= RVFC_STARTUP_GRACE_MS) {
      console.warn('[poseDetector] requestVideoFrameCallback이 응답하지 않아 seek 기반 방식으로 넘어갑니다.')
      gaveUpOnRvfc = true
      stop()
      break
    }
    if (elapsed >= watchdogMs) {
      console.warn('[poseDetector] 재생 기반 추출이 시간 초과되어 지금까지 모은 프레임만으로 종료합니다.')
      stop()
      break
    }
    const item = queue.shift()
    if (!item) {
      await new Promise((r) => setTimeout(r, 30))
      continue
    }
    await processFrame(item.time, item.canvas, detector, minScore, frames, acc)
    onProgress?.(Math.min((item.time - startTimeSec) / (end - startTimeSec || 1), 1))
  }

  video.removeEventListener('ended', onEnded)
  if (rvfcHandle !== null) rvfc.cancelVideoFrameCallback?.(rvfcHandle)
  video.pause()
  await playPromise
  onProgress?.(1)

  if (gaveUpOnRvfc) return null
  return { frames, stats: finalizeStats(video, acc, frames.length) }
}

/** 구형 브라우저 등 requestVideoFrameCallback이 없을 때 쓰는 폴백(예전 seek 기반 방식). */
async function extractViaSeek(
  video: HTMLVideoElement,
  detector: poseDetection.PoseDetector,
  params: { samplingFps: number; minScore: number; startTimeSec: number; end: number; onProgress?: (r: number) => void },
): Promise<{ frames: PoseFrame[]; stats: ExtractDebugStats }> {
  const { samplingFps, minScore, startTimeSec, end, onProgress } = params
  const frames: PoseFrame[] = []
  const acc = newStatsAccumulator()
  const step = 1 / samplingFps

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')

  for (let t = startTimeSec; t < end; t += step) {
    await seekTo(video, t)
    const source = drawToCanvas(video, canvas, ctx)
    await processFrame(t, source, detector, minScore, frames, acc)
    onProgress?.(Math.min((t - startTimeSec) / (end - startTimeSec || 1), 1))
  }

  onProgress?.(1)
  return { frames, stats: finalizeStats(video, acc, frames.length) }
}

/**
 * 영상에서 samplingFps 목표치로 프레임을 샘플링하며 각 시점의 포즈를 추정한다.
 * `requestVideoFrameCallback`을 지원하는 브라우저(대부분의 최신 Chrome 계열,
 * 안드로이드 포함)에서는 실제 재생을 통해 정확한 프레임을 얻고, 지원하지
 * 않으면 예전 방식(seek 반복)으로 폴백한다.
 *
 * `debugStats`를 넘기면 추출 과정의 통계를 그 객체에 채워 넣는다(문제
 * 진단용, 선택 사항).
 */
export async function extractPoseFrames(
  video: HTMLVideoElement,
  opts: ExtractOptions,
  debugStats?: ExtractDebugStats,
): Promise<PoseFrame[]> {
  const detector = await getPoseDetector()
  const { samplingFps, minScore = 0.3, startTimeSec = 0, maxDurationSec, onProgress } = opts
  const end = maxDurationSec ? Math.min(video.duration, startTimeSec + maxDurationSec) : video.duration

  const params = { samplingFps, minScore, startTimeSec, end, onProgress }
  let result: { frames: PoseFrame[]; stats: ExtractDebugStats } | null = null

  if (typeof asRVFC(video).requestVideoFrameCallback === 'function') {
    result = await extractViaPlayback(video, detector, params)
  }
  // result가 null이면: rVFC가 없거나(구형 브라우저), "지원됨"인데도 실제로는
  // 콜백이 안 온 경우 — 두 경우 모두 예전 seek 반복 방식으로 안전하게 완료한다.
  if (result === null) {
    result = await extractViaSeek(video, detector, params)
  }

  if (debugStats) Object.assign(debugStats, result.stats)
  // PC/폰 등 기기마다 GPU 연산 정밀도·비디오 디코더가 달라 좌표에 미세한 잡음이 섞이는
  // 문제를 줄이기 위해, 최종적으로 One Euro Filter로 좌표 시계열을 스무딩한다(자세한
  // 이유는 oneEuroFilter.ts 주석 참고). 어떤 프레임을 뽑았는지(sampledTimesChecksum
  // 등 debugStats)는 스무딩 이전 원본 기준으로 이미 계산돼 있으므로 영향받지 않는다.
  return smoothPoseFrames(result.frames)
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
  // 발 부분(뒤꿈치·발끝) — BlazePose 업그레이드로 새로 추가된 랜드마크
  ['left_ankle', 'left_heel'],
  ['left_heel', 'left_foot_index'],
  ['left_ankle', 'left_foot_index'],
  ['right_ankle', 'right_heel'],
  ['right_heel', 'right_foot_index'],
  ['right_ankle', 'right_foot_index'],
]
