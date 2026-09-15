import type { Point, PoseFrame } from '../../../shared/types/pose'
import type { RomXmskEstimateResult, XmskEstimateEvidence } from '../types'
import { angleAtVertexDeg } from './jointAngles'
import { mean, movingAverage } from '../../../shared/lib/mathUtils'

const MIN_SCORE = 0.3
const MIN_SAMPLES = 3

/**
 * ROM(스트레칭 가동범위) 분석에서 이미 뽑아둔 포즈 프레임(before/after 두 구간)을 그대로
 * 재사용해서, XMSK 통증 레시피의 "0.5 상태체크"/"3. 마무리" 입력 항목 중 영상으로
 * 추정 가능한 것들을 계산한다. 기존 8개 관절(어깨·팔꿈치·엉덩이·무릎) ROM 표는 건드리지
 * 않고, 이 결과는 별도 표에 "추가"로 보여준다.
 *
 * === 무엇을, 왜 계산하는가 (근거 연구 요약 — 자세한 서지정보는 CLAUDE.md 참고) ===
 *
 * XMSK 8개 부위 레시피의 measurements를 모두 모으면 아래로 정리된다:
 *   목 회전/목 측굴/팔 올리기(굴곡·외전) · 앞으로 숙이기 · 골반-흉추 분리 · 쪼그려 앉기 ·
 *   무릎 굴곡 · 배측굴곡 · 고관절 굴곡 · 다리 벌리기 · 손목 신전·굴곡 저항 · 팔 뻗기 ·
 *   손목 굴곡·신전 각도 · 흉추 신전·회전.
 *
 * 이 중 "팔 올리기/팔 뻗기"(어깨), "고관절 굴곡", "무릎 굴곡"은 기존 8개 관절 ROM 표의
 * 어깨·엉덩이·무릎 항목이 이미 같은 개념(관절 각도 범위)을 다루므로 중복 계산하지 않는다.
 *
 * "손목 신전·굴곡 저항"(도수근력검사 — 검사자가 저항을 가해 평가)은 영상만으로는 힘/저항을
 * 잴 수 없어 계산하지 않는다. 원격재활 문헌(Alrwaily, "Delivering Musculoskeletal
 * Rehabilitation in the Digital Era," Healthcare 13(18):2286, 2025)도 이런 저항 검사는
 * 보호자가 대신 저항을 가하고 임상가가 화면으로 관찰·평가하는 방식으로 대체하고 있다고
 * 밝히며, 동시에 "대면으로 검증된 검사라 원격 시행 시 정확도가 달라질 수 있다"고 명시한다
 * — 즉 카메라 기반의 검증된 대체 측정법 자체가 존재하지 않는다는 뜻이다. 그래서 이 항목은
 * 계산이 아니라 "트레이너가 직접 관찰한 값을 입력"하는 수기 입력 칸으로 대신한다
 * (`XMSK_MANUAL_ITEMS`) — 없는 걸 억지로 지어내는 대신, 실제 임상 현장에서 쓰는 방식을
 * 그대로 앱에 반영한 것이다.
 *
 * "손목 굴곡·신전 각도"는 처음엔 손가락 관절이 없어 계산 불가로 분류했었지만, 다시 확인해
 * 보니 BlazePose 33개 랜드마크에는 손목 다음으로 검지·새끼손가락 첫마디(knuckle)와 엄지
 * 마디 좌표가 실제로 포함돼 있다(순서상 17~22번, `left_pinky`/`right_pinky`,
 * `left_index`/`right_index`, `left_thumb`/`right_thumb` — Bazarevsky et al., "BlazePose:
 * On-device Real-time Body Pose Tracking," arXiv:2006.10204, 2020의 키포인트 부록 참고).
 * 그래서 검지·새끼손가락 마디의 중점을 "손 방향" 기준점으로 삼아 팔꿈치-손목-손 각도로
 * 근사할 수 있다 — 완전히 제외하는 대신 `'experimental'` 근거 수준으로 계산에 포함한다.
 * 다만 이 손 관련 랜드마크 자체가 몸통 관절보다 신뢰도가 낮다는 지적이 있다(웹캠 기반 ROM
 * 평가 연구가 "손·발이 이미지에서 차지하는 비중이 작아 안정적으로 추적하기 어렵다"는 이유로
 * 손목 굴곡·신전 등을 아예 측정 대상에서 제외한 사례 — PLOS ONE, "A webcam-based machine
 * learning approach for three-dimensional range of motion evaluation," 2023).
 *
 * 나머지 항목들은 아래 함수들이 계산하며, 항목별 근거 수준(evidence)을 'approximate'
 * (유사한 측정을 다룬 발표 연구가 있음) 또는 'experimental'(기하학적으로는 타당하나 이
 * 방식 자체를 검증한 연구를 찾지 못함)으로 표시한다. 이 앱은 어떤 경우에도 의료 진단
 * 도구가 아니라 참고용 보조 지표라는 원칙(다른 기능들과 동일)을 그대로 따른다.
 *
 * - 다리 벌리기(고관절 외전), 배측굴곡(발목): MediaPipe/유사 포즈 추정 기반 각도가 IMU·
 *   3D 모션캡처 대비 평균오차 수 도(°) 수준이라는 2023~2026년 연구들이 있어 'approximate'.
 * - 쪼그려 앉기: 포즈 추정으로 스쿼트 동작을 FMS(Functional Movement Screen)식으로
 *   채점한 선행 연구가 있어 'approximate' — 단, 카메라 각도에 따른 투영 오차가 커질 수
 *   있다는 지적도 함께 있다.
 * - 목 회전, 목 측굴, 흉추 신전·회전, 골반-흉추 분리, 손목 굴곡·신전 각도: 목 회전처럼
 *   카메라 정면 축을 기준으로 한 "회전" 각도는 단안(monocular) 2D 영상만으로는 원리적으로
 *   부정확해지기 쉽고(깊이 정보 부재), 골반-흉추 분리는 골프 스윙 분석의 "X-Factor"
 *   (어깨-골반 회전 분리) 개념을 차용한 것으로 이 용도로 검증된 연구를 찾지 못했으며,
 *   손목 각도는 위에서 설명한 손 랜드마크 신뢰도 문제가 있어 모두 'experimental'.
 * - 앞으로 숙이기: 카메라 보정 없이는 실제 cm 거리를 알 수 없어, 다리 길이 대비 상대
 *   비율로 대신한다(걸음걸이 분석의 "다리 길이 상대 단위"와 같은 원리) — 이 정규화 방식
 *   자체를 검증한 연구는 찾지 못해 'experimental'.
 *
 * === 표시 구조: XMSK 8개 부위 레시피 아래에 그룹핑 ===
 * `groupEstimatesByRegion()`은 위에서 계산한 항목들을 XMSK_RECIPES(각 부위 레시피)가
 * 정의한 8개 부위 제목(목·어깨/허리/무릎/발목/고관절/팔꿈치/손목/등 통증) 아래로 묶어
 * 반환한다. XMSK 기능(`src/features/xmsk/`)의 데이터를 직접 import하지는 않는다 —
 * 대시보드(HomeScreen)가 rom을 참조하는 것 외에는 기능 간 교차 참조를 만들지 않는다는
 * 기존 구조 원칙(CLAUDE.md)을 지키기 위해, 부위별 제목과 "이 부위엔 어떤 측정 항목이
 * 있는지"를 이 파일에 최소한으로 다시 정리해둔다(서버/프론트가 타입을 의도적으로 중복
 * 정의하는 이 프로젝트의 기존 관례와 같은 방식). "골반-흉추 분리"처럼 XMSK 레시피에서
 * 두 부위(허리/등)에 공통으로 쓰이는 항목은 두 그룹 모두에 (같은 계산값으로) 나타난다.
 */

function kp(frame: PoseFrame, name: string): Point {
  const found = frame.keypoints.find((k) => k.name === name)
  return found ?? { x: 0, y: 0, score: 0 }
}

function usable(...pts: Point[]): boolean {
  return pts.every((p) => p.score >= MIN_SCORE)
}

function isNum(v: number | null): v is number {
  return v !== null
}

/** 시계열의 (부드럽게 한 뒤) 최댓값-최솟값 = 그 구간에서 관찰된 가동범위. */
function romFromSamples(samples: number[]): number | null {
  if (samples.length < MIN_SAMPLES) return null
  const smoothed = movingAverage(samples, 3)
  return Math.max(...smoothed) - Math.min(...smoothed)
}

/** 부호 있는 시계열에서 "좌(+)"/"우(-)" 방향 최고치를 각각 뽑는다(기준 0 = 정면/중립). */
function peakBySign(values: number[]): { left: number | null; right: number | null } {
  if (values.length < MIN_SAMPLES) return { left: null, right: null }
  const smoothed = movingAverage(values, 3)
  return {
    left: Math.max(0, ...smoothed),
    right: Math.max(0, ...smoothed.map((v) => -v)),
  }
}

function normalizeDeg180(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180
}

/** 목 회전(좌우 돌리기) 근사치: 귀 사이 거리가 어깨 폭 대비 얼마나 "줄어들었는지"
 * (원근 축소, foreshortening)를 이 구간에서 가장 정면을 본 순간 대비 비율로 보고,
 * arccos으로 각도화한다. 방향(좌/우)은 귀 중점이 어깨 중점 대비 어느 쪽으로 치우쳤는지로
 * 정한다. 실제 연구들은 이 단순 공식 대신 학습된 얼굴 방향 추정 모델을 쓰므로, 이 값은
 * 검증되지 않은 실험적 추정치다. */
function computeNeckRotation(frames: PoseFrame[]): { left: number | null; right: number | null } {
  // 1) 프레임마다 (귀 사이 거리 / 어깨 폭) 비율과 회전 방향 부호를 모은다.
  // 2) 이 구간에서 가장 정면을 본 순간(비율 최댓값)을 "0도" 기준으로 삼아 각도화한다.
  const raw: { ratio: number; sign: number }[] = []
  for (const f of frames) {
    const leftEar = kp(f, 'left_ear')
    const rightEar = kp(f, 'right_ear')
    if (!usable(leftEar, rightEar, f.leftShoulder, f.rightShoulder)) continue
    const shoulderDist = Math.hypot(f.leftShoulder.x - f.rightShoulder.x, f.leftShoulder.y - f.rightShoulder.y)
    if (shoulderDist < 1e-3) continue
    const earDist = Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y)
    const earMidX = (leftEar.x + rightEar.x) / 2
    const shoulderMidX = (f.leftShoulder.x + f.rightShoulder.x) / 2
    const sign = Math.sign(shoulderMidX - earMidX) || 1
    raw.push({ ratio: earDist / shoulderDist, sign })
  }
  if (raw.length < MIN_SAMPLES) return { left: null, right: null }
  const maxRatio = Math.max(...raw.map((r) => r.ratio))
  if (maxRatio < 1e-3) return { left: null, right: null }
  const signedAngles = raw.map(({ ratio, sign }) => {
    const clamped = Math.min(1, ratio / maxRatio)
    return Math.acos(clamped) * (180 / Math.PI) * sign
  })
  return peakBySign(signedAngles)
}

/** 목 측굴(좌우로 기울이기) 근사치: 귀-귀 선의 기울기를 어깨선 기울기 기준 상대각으로
 * 본다(카메라 자체가 살짝 기울어져 있어도 어깨선 대비로 보정됨). 정면 촬영을 전제한다. */
function computeNeckSideBend(frames: PoseFrame[]): { left: number | null; right: number | null } {
  const signed: number[] = []
  for (const f of frames) {
    const leftEar = kp(f, 'left_ear')
    const rightEar = kp(f, 'right_ear')
    if (!usable(leftEar, rightEar, f.leftShoulder, f.rightShoulder)) continue
    const earAngle = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x) * (180 / Math.PI)
    const shoulderAngle =
      Math.atan2(f.rightShoulder.y - f.leftShoulder.y, f.rightShoulder.x - f.leftShoulder.x) * (180 / Math.PI)
    signed.push(normalizeDeg180(earAngle - shoulderAngle))
  }
  return peakBySign(signed)
}

/** 다리 벌리기(고관절 외전) 근사치: 허벅지(엉덩이→무릎) 벡터가 수직 아래 방향과 이루는
 * 각도의 관찰 범위(ROM). 좌우 다리를 각각 따로 계산한다. */
function limbAngleFromVertical(hip: Point, knee: Point): number {
  const dx = knee.x - hip.x
  const dy = knee.y - hip.y
  return Math.atan2(Math.abs(dx), Math.abs(dy) || 1e-6) * (180 / Math.PI)
}

function computeLegAbduction(frames: PoseFrame[]): { left: number | null; right: number | null } {
  const leftSamples = frames
    .map((f) => (usable(f.leftHip, f.leftKnee) ? limbAngleFromVertical(f.leftHip, f.leftKnee) : null))
    .filter(isNum)
  const rightSamples = frames
    .map((f) => (usable(f.rightHip, f.rightKnee) ? limbAngleFromVertical(f.rightHip, f.rightKnee) : null))
    .filter(isNum)
  return { left: romFromSamples(leftSamples), right: romFromSamples(rightSamples) }
}

/** 발목 배측굴곡 근사치: 무릎-발목-발끝 각도(180도에서 얼마나 접히는지)의 관찰 범위.
 * 원래 XMSK 검사(벽 밀기 거리, cm)와는 다른 지표(각도)이므로 대체값으로만 참고한다. */
function computeDorsiflexion(frames: PoseFrame[]): { left: number | null; right: number | null } {
  const leftSamples = frames
    .map((f) =>
      usable(f.leftKnee, f.leftAnkle, f.leftFootIndex)
        ? angleAtVertexDeg(f.leftKnee, f.leftAnkle, f.leftFootIndex)
        : null,
    )
    .filter(isNum)
  const rightSamples = frames
    .map((f) =>
      usable(f.rightKnee, f.rightAnkle, f.rightFootIndex)
        ? angleAtVertexDeg(f.rightKnee, f.rightAnkle, f.rightFootIndex)
        : null,
    )
    .filter(isNum)
  return { left: romFromSamples(leftSamples), right: romFromSamples(rightSamples) }
}

/** 어깨선-골반선의 회전 차이(신호 있는 값). 골프 스윙 분석의 "X-Factor"와 같은 원리다. */
function shoulderHipRotationSeries(frames: PoseFrame[]): number[] {
  const signed: number[] = []
  for (const f of frames) {
    if (!usable(f.leftShoulder, f.rightShoulder, f.leftHip, f.rightHip)) continue
    const shoulderAngle =
      Math.atan2(f.rightShoulder.y - f.leftShoulder.y, f.rightShoulder.x - f.leftShoulder.x) * (180 / Math.PI)
    const hipAngle = Math.atan2(f.rightHip.y - f.leftHip.y, f.rightHip.x - f.leftHip.x) * (180 / Math.PI)
    signed.push(normalizeDeg180(shoulderAngle - hipAngle))
  }
  return signed
}

/** 흉추 신전·회전 근사치: 위 회전 차이 시계열의 좌/우 최고치(도). */
function computeThoracicExtRot(frames: PoseFrame[]): { left: number | null; right: number | null } {
  return peakBySign(shoulderHipRotationSeries(frames))
}

/** 골반-흉추 분리 근사치(0~10점): 위 회전 차이의 절대값 최고치를 0~10으로 환산.
 * 30도 이상 분리를 10점 만점으로 근사 매핑한다(임의 기준 — 절대 수치가 아니라 전/후
 * 비교 용도로만 의미가 있다). */
function pelvisThoracicSeparationScore(frames: PoseFrame[]): number | null {
  const signed = shoulderHipRotationSeries(frames)
  if (signed.length < MIN_SAMPLES) return null
  const smoothed = movingAverage(signed.map(Math.abs), 3)
  const peak = Math.max(...smoothed)
  return Math.max(0, Math.min(10, (peak / 30) * 10))
}

/** 쪼그려 앉기 깊이 근사치(0~10점): 좌우 무릎 각도(엉덩이-무릎-발목) 중 가장 많이 접힌
 * 값(최솟값)을 기준으로, 선 자세(약 170도)~완전히 쪼그림(약 70도) 구간을 0~10으로 환산. */
function squatDepthScore(frames: PoseFrame[]): number | null {
  const samples: number[] = []
  for (const f of frames) {
    if (usable(f.leftHip, f.leftKnee, f.leftAnkle)) samples.push(angleAtVertexDeg(f.leftHip, f.leftKnee, f.leftAnkle))
    if (usable(f.rightHip, f.rightKnee, f.rightAnkle))
      samples.push(angleAtVertexDeg(f.rightHip, f.rightKnee, f.rightAnkle))
  }
  if (samples.length < MIN_SAMPLES) return null
  const smoothed = movingAverage(samples, 3)
  const minAngle = Math.min(...smoothed)
  const score = ((170 - minAngle) / (170 - 70)) * 10
  return Math.max(0, Math.min(10, score))
}

/** 앞으로 숙이기(손끝-바닥 거리) 대체 지표: 실제 cm는 카메라 보정 없이 알 수 없으므로,
 * "손목이 발목 높이에 얼마나 가까워지는지"를 다리 길이(엉덩이~발목) 대비 비율로 나타낸다
 * (작을수록/음수에 가까울수록 많이 숙인 것). 걸음걸이 분석의 "다리 길이 상대 단위"와
 * 같은 방식이다. */
function forwardBendProxy(frames: PoseFrame[]): number | null {
  const ratios: number[] = []
  for (const f of frames) {
    const legLenL = usable(f.leftHip, f.leftAnkle)
      ? Math.hypot(f.leftHip.x - f.leftAnkle.x, f.leftHip.y - f.leftAnkle.y)
      : null
    const legLenR = usable(f.rightHip, f.rightAnkle)
      ? Math.hypot(f.rightHip.x - f.rightAnkle.x, f.rightHip.y - f.rightAnkle.y)
      : null
    const legLen = legLenL ?? legLenR
    if (!legLen || legLen < 1e-3) continue

    const wristYs = [f.leftWrist, f.rightWrist].filter((p) => p.score >= MIN_SCORE).map((p) => p.y)
    const ankleYs = [f.leftAnkle, f.rightAnkle].filter((p) => p.score >= MIN_SCORE).map((p) => p.y)
    if (wristYs.length === 0 || ankleYs.length === 0) continue

    const wristLowestY = Math.max(...wristYs) // 이미지 좌표: 아래로 갈수록 y가 커짐
    const ankleAvgY = mean(ankleYs)
    ratios.push((ankleAvgY - wristLowestY) / legLen)
  }
  if (ratios.length < MIN_SAMPLES) return null
  const smoothed = movingAverage(ratios, 3)
  return Math.min(...smoothed)
}

/** 검지·새끼손가락 첫마디(knuckle)의 중점 — "손이 향한 방향"의 대략적인 기준점. */
function handMidPoint(frame: PoseFrame, side: 'left' | 'right'): Point {
  const index = kp(frame, `${side}_index`)
  const pinky = kp(frame, `${side}_pinky`)
  if (index.score < MIN_SCORE || pinky.score < MIN_SCORE) return { x: 0, y: 0, score: 0 }
  return { x: (index.x + pinky.x) / 2, y: (index.y + pinky.y) / 2, score: Math.min(index.score, pinky.score) }
}

/** 손목 굴곡·신전 각도 근사치: 팔꿈치-손목-손(검지·새끼 중점) 각도의 관찰 범위. 손
 * 관련 랜드마크는 몸통 관절보다 신뢰도가 낮다고 알려져 있어(위 설명 참고) 다른 각도
 * 추정치보다도 오차가 클 수 있다. */
function computeWristFlexExt(frames: PoseFrame[]): { left: number | null; right: number | null } {
  const leftSamples = frames
    .map((f) => {
      const hand = handMidPoint(f, 'left')
      return usable(f.leftElbow, f.leftWrist, hand) ? angleAtVertexDeg(f.leftElbow, f.leftWrist, hand) : null
    })
    .filter(isNum)
  const rightSamples = frames
    .map((f) => {
      const hand = handMidPoint(f, 'right')
      return usable(f.rightElbow, f.rightWrist, hand) ? angleAtVertexDeg(f.rightElbow, f.rightWrist, hand) : null
    })
    .filter(isNum)
  return { left: romFromSamples(leftSamples), right: romFromSamples(rightSamples) }
}

function pushLr(
  results: RomXmskEstimateResult[],
  idBase: string,
  labelBase: string,
  unit: string,
  evidence: XmskEstimateEvidence,
  note: string,
  before: { left: number | null; right: number | null },
  after: { left: number | null; right: number | null },
): void {
  ;(['left', 'right'] as const).forEach((side) => {
    const b = before[side]
    const a = after[side]
    results.push({
      id: `${idBase}_${side}`,
      label: `${labelBase} (${side === 'left' ? '좌' : '우'})`,
      unit,
      beforeValue: b,
      afterValue: a,
      deltaValue: b !== null && a !== null ? a - b : null,
      evidence,
      note,
    })
  })
}

function pushSingle(
  results: RomXmskEstimateResult[],
  id: string,
  label: string,
  unit: string,
  evidence: XmskEstimateEvidence,
  note: string,
  before: number | null,
  after: number | null,
): void {
  results.push({
    id,
    label,
    unit,
    beforeValue: before,
    afterValue: after,
    deltaValue: before !== null && after !== null ? after - before : null,
    evidence,
    note,
  })
}

/** 계산이 아니라 수기 입력으로 대신하는 항목(현재는 손목 신전·굴곡 저항 하나뿐). */
export interface XmskManualItemDef {
  id: string
  label: string
  unit: string
}

export const XMSK_MANUAL_ITEMS: XmskManualItemDef[] = [
  { id: 'wristResist_left', label: '손목 신전·굴곡 저항 (좌)', unit: '점(0~10, 수기입력)' },
  { id: 'wristResist_right', label: '손목 신전·굴곡 저항 (우)', unit: '점(0~10, 수기입력)' },
]

export const XMSK_MANUAL_ITEM_NOTE =
  '손목 신전·굴곡 저항은 검사자가 직접 손목에 저항을 가해 평가하는 도수근력검사라 영상 분석만으로는 측정할 수 없습니다. 원격재활 관련 문헌에서도 이런 저항 검사는 보호자가 대신 저항을 가하거나 임상가가 화면으로 관찰·평가하는 방식으로 대체하고 있어(카메라만으로 검증된 대체 측정법은 없음), 이 앱에서도 트레이너가 직접 관찰한 값을 아래에 입력해 기록만 지원합니다.'

/** XMSK 연동 추정 항목 중 "이미 기존 8개 관절 표에 있어 중복 계산하지 않는" 항목. */
export const XMSK_COVERED_BY_EXISTING_8: Record<string, string> = {
  armRaise: '팔 올리기(굴곡·외전)는 위 8개 관절 ROM 표의 어깨 항목으로 확인할 수 있어 별도로 추가하지 않았습니다.',
  armReach: '팔 뻗기는 위 8개 관절 ROM 표의 어깨 항목으로 확인할 수 있어 별도로 추가하지 않았습니다.',
  hipFlexion: '고관절 굴곡은 위 8개 관절 ROM 표의 엉덩이 항목으로 확인할 수 있어 별도로 추가하지 않았습니다.',
  kneeFlexion: '무릎 굴곡은 위 8개 관절 ROM 표의 무릎 항목으로 확인할 수 있어 별도로 추가하지 않았습니다.',
}

const XMSK_MANUAL_ONLY: Record<string, string> = {
  wristResist: XMSK_MANUAL_ITEM_NOTE,
}

/** XMSK 8개 부위 레시피 제목과, 각 부위의 measurements id 목록 — XMSK 기능을 직접
 * import하지 않고 표시에 필요한 최소한만 이 파일 안에 다시 정리해둔 것(위 설명 참고). */
interface XmskRegionMeta {
  key: string
  title: string
  measurementIds: string[]
}

const XMSK_REGIONS: XmskRegionMeta[] = [
  { key: 'neckShoulder', title: '목·어깨 통증', measurementIds: ['neckRotation', 'neckSideBend', 'armRaise'] },
  { key: 'lowBack', title: '허리 통증', measurementIds: ['forwardBend', 'pelvisThoracicSeparation'] },
  { key: 'knee', title: '무릎 통증', measurementIds: ['squat', 'kneeFlexion'] },
  { key: 'ankle', title: '발목 통증', measurementIds: ['dorsiflexion'] },
  { key: 'hip', title: '고관절 통증', measurementIds: ['hipFlexion', 'legAbduction'] },
  { key: 'elbow', title: '팔꿈치 통증', measurementIds: ['wristResist', 'armReach'] },
  { key: 'wrist', title: '손목 통증', measurementIds: ['wristFlexExt'] },
  { key: 'upperBack', title: '등 통증', measurementIds: ['thoracicExtRot', 'pelvisThoracicSeparation'] },
]

export interface XmskRegionGroup {
  key: string
  title: string
  rows: RomXmskEstimateResult[]
  coveredNotes: string[]
  manualNote: string | null
  manualIds: string[]
}

/** 계산된 결과를 XMSK 8개 부위 제목 아래로 묶는다. RomResultsPanel이 이걸로 렌더링한다. */
export function groupEstimatesByRegion(estimates: RomXmskEstimateResult[]): XmskRegionGroup[] {
  return XMSK_REGIONS.map((region) => {
    const rows: RomXmskEstimateResult[] = []
    const coveredNotes: string[] = []
    const manualIds: string[] = []
    let manualNote: string | null = null

    for (const measurementId of region.measurementIds) {
      if (measurementId in XMSK_COVERED_BY_EXISTING_8) {
        coveredNotes.push(XMSK_COVERED_BY_EXISTING_8[measurementId])
        continue
      }
      if (measurementId in XMSK_MANUAL_ONLY) {
        manualNote = XMSK_MANUAL_ONLY[measurementId]
        manualIds.push(`${measurementId}_left`, `${measurementId}_right`)
        continue
      }
      rows.push(...estimates.filter((e) => e.id === measurementId || e.id.startsWith(`${measurementId}_`)))
    }

    return { key: region.key, title: region.title, rows, coveredNotes, manualNote, manualIds }
  })
}

export function computeXmskEstimates(beforeFrames: PoseFrame[], afterFrames: PoseFrame[]): RomXmskEstimateResult[] {
  const results: RomXmskEstimateResult[] = []

  pushLr(
    results,
    'neckRotation',
    '목 회전',
    '도(추정)',
    'experimental',
    '귀 사이 거리의 원근 축소 비율로 회전을 근사한 값입니다. 연구에서는 이런 단순 기하 공식 대신 학습된 얼굴 방향 추정 모델을 쓰며, 이 방식 자체가 검증된 바는 없습니다.',
    computeNeckRotation(beforeFrames),
    computeNeckRotation(afterFrames),
  )

  pushLr(
    results,
    'neckSideBend',
    '목 측굴',
    '도(추정)',
    'experimental',
    '귀-귀 선과 어깨선의 상대 기울기로 근사한 값입니다. 정면 촬영을 전제하며, 이 방식을 검증한 연구는 확인되지 않았습니다.',
    computeNeckSideBend(beforeFrames),
    computeNeckSideBend(afterFrames),
  )

  pushLr(
    results,
    'legAbduction',
    '다리 벌리기',
    '도',
    'approximate',
    '고관절 외전 각도 추정치입니다. 자세추정 기반 고관절 각도는 관련 연구에서 관성센서(IMU) 대비 평균 오차 수 도(°) 수준으로 보고되었습니다.',
    computeLegAbduction(beforeFrames),
    computeLegAbduction(afterFrames),
  )

  pushLr(
    results,
    'dorsiflexion',
    '배측굴곡',
    '도(추정)',
    'approximate',
    '발목 배측굴곡 각도 추정치입니다. 2D 영상 기반 각도 추정은 3D 모션캡처 대비 오차가 크지 않다는 연구가 있으나, 원래 XMSK 검사(벽 밀기 거리, cm)와는 다른 방식의 지표입니다.',
    computeDorsiflexion(beforeFrames),
    computeDorsiflexion(afterFrames),
  )

  pushLr(
    results,
    'thoracicExtRot',
    '흉추 신전·회전',
    '도(추정)',
    'experimental',
    '어깨선-골반선 회전 차이로 근사한 값입니다. 단안(2D) 카메라는 몸통 회전(트위스트) 측정에 근본적인 한계가 있어 참고용으로만 보세요.',
    computeThoracicExtRot(beforeFrames),
    computeThoracicExtRot(afterFrames),
  )

  pushSingle(
    results,
    'squat',
    '쪼그려 앉기',
    '점(0~10, 추정)',
    'approximate',
    '무릎 굽힘 깊이를 0~10점으로 환산한 추정 점수입니다. 자세추정으로 스쿼트 동작을 평가한 선행 연구가 있으나, 카메라 각도에 따라 오차가 커질 수 있습니다.',
    squatDepthScore(beforeFrames),
    squatDepthScore(afterFrames),
  )

  pushSingle(
    results,
    'pelvisThoracicSeparation',
    '골반-흉추 분리',
    '점(0~10, 추정)',
    'experimental',
    '골프 스윙 분석에 쓰이는 "X-Factor"(어깨-골반 회전 분리) 개념을 차용한 추정 점수입니다. 이 용도(임상 골반-흉추 분리 평가)로 검증된 연구는 확인되지 않았습니다.',
    pelvisThoracicSeparationScore(beforeFrames),
    pelvisThoracicSeparationScore(afterFrames),
  )

  pushLr(
    results,
    'wristFlexExt',
    '손목 굴곡·신전 각도',
    '도(추정)',
    'experimental',
    '검지·새끼손가락 첫마디(knuckle)의 중점을 "손 방향"으로 삼아 팔꿈치-손목-손 각도로 근사한 값입니다. BlazePose의 손 관련 랜드마크는 몸통 관절보다 신뢰도가 낮다고 보고돼, 다른 각도 추정치보다도 오차가 클 수 있습니다.',
    computeWristFlexExt(beforeFrames),
    computeWristFlexExt(afterFrames),
  )

  pushSingle(
    results,
    'forwardBend',
    '앞으로 숙이기',
    '상대비율(추정)',
    'experimental',
    '손목이 발목 높이에 얼마나 가까워지는지를 다리 길이 대비 비율로 나타낸 값(작을수록/음수일수록 많이 숙인 것)입니다. 실제 cm 거리가 아니며, 이 정규화 방식을 검증한 연구는 확인되지 않았습니다.',
    forwardBendProxy(beforeFrames),
    forwardBendProxy(afterFrames),
  )

  return results
}
