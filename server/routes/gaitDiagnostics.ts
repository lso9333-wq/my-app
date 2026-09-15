import { Router, type Request, type Response } from 'express'
import {
  deleteGaitDiagnostic,
  getGaitDiagnostic,
  insertGaitDiagnostic,
  listGaitDiagnostics,
  updateGaitDiagnosticGroundTruth,
} from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type { GaitDiagnosticCreateRequest, GaitDiagnosticRow, GaitGroundTruthUpdateRequest } from '../types.js'

export const gaitDiagnosticsRouter = Router()

// 2026-09 보안 점검으로 추가 — romSessionsRouter와 같은 이유(자세한 배경은
// xmskAuth.ts의 requireAuth 주석 참고).
gaitDiagnosticsRouter.use(requireAuth)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

const NUMBER_FIELDS = [
  'videoWidth',
  'videoHeight',
  'durationSec',
  'attemptedFrames',
  'noPoseFrames',
  'droppedFrames',
  'keptFrames',
  'avgHipScore',
  'avgLeftAnkleScore',
  'avgRightAnkleScore',
  'avgLeftHeelScore',
  'avgRightHeelScore',
  'sampledTimesChecksum',
  'totalSteps',
  'cadenceStepsPerMin',
] as const

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<GaitDiagnosticCreateRequest>

  if (typeof b.videoName !== 'string' || b.videoName.trim() === '') return 'videoName이 필요합니다.'
  if (typeof b.deviceInfo !== 'string') return 'deviceInfo가 필요합니다.'
  if (b.clientName !== undefined && typeof b.clientName !== 'string') return 'clientName이 올바르지 않습니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  for (const field of NUMBER_FIELDS) {
    if (!isFiniteNumber(b[field])) return `${field}이(가) 올바르지 않습니다.`
  }
  if (b.note !== undefined && typeof b.note !== 'string') return 'note는 문자열이어야 합니다.'
  if (b.gaitMetrics !== undefined && (typeof b.gaitMetrics !== 'object' || b.gaitMetrics === null)) {
    return 'gaitMetrics가 올바르지 않습니다.'
  }
  if (b.groundTruth !== undefined && !Array.isArray(b.groundTruth)) {
    return 'groundTruth는 배열이어야 합니다.'
  }
  if (b.calcVersion !== undefined && typeof b.calcVersion !== 'string') {
    return 'calcVersion은 문자열이어야 합니다.'
  }

  return null
}

function isGroundTruthItem(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const g = v as { id?: unknown; verifiedValue?: unknown }
  if (typeof g.id !== 'string' || g.id.trim() === '') return false
  if (g.verifiedValue !== null && !isFiniteNumber(g.verifiedValue)) return false
  return true
}

function validateGroundTruthUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<GaitGroundTruthUpdateRequest>
  if (!Array.isArray(b.groundTruth) || !b.groundTruth.every(isGroundTruthItem)) {
    return 'groundTruth가 올바르지 않습니다.'
  }
  return null
}

function toResponse(row: GaitDiagnosticRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    videoName: row.video_name,
    deviceInfo: row.device_info,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    videoWidth: row.video_width,
    videoHeight: row.video_height,
    durationSec: row.duration_sec,
    attemptedFrames: row.attempted_frames,
    noPoseFrames: row.no_pose_frames,
    droppedFrames: row.dropped_frames,
    keptFrames: row.kept_frames,
    avgHipScore: row.avg_hip_score,
    avgLeftAnkleScore: row.avg_left_ankle_score,
    avgRightAnkleScore: row.avg_right_ankle_score,
    avgLeftHeelScore: row.avg_left_heel_score,
    avgRightHeelScore: row.avg_right_heel_score,
    sampledTimesChecksum: row.sampled_times_checksum,
    totalSteps: row.total_steps,
    cadenceStepsPerMin: row.cadence_steps_per_min,
    note: row.note,
    gaitMetrics: row.gait_metrics_json ? JSON.parse(row.gait_metrics_json) : null,
    groundTruth: row.ground_truth_json ? JSON.parse(row.ground_truth_json) : null,
    calcVersion: row.calc_version,
  }
}

gaitDiagnosticsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertGaitDiagnostic(req.body as GaitDiagnosticCreateRequest)
  res.status(201).json({ id, createdAt })
})

gaitDiagnosticsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50
  const search = typeof req.query.search === 'string' ? req.query.search : undefined

  const rows = listGaitDiagnostics(limit, search)
  res.json({ records: rows.map(toResponse) })
})

// 케이던스·좌우 대칭성·전도 위험 점수 등 AI 추정 지표 옆에 트레이너가 실측한 값도,
// 분석 당일이 아니라 나중에 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많으므로
// ROM 세션의 ground-truth 엔드포인트와 같은 방식으로 별도 갱신 엔드포인트를 둔다.
gaitDiagnosticsRouter.put('/:id/ground-truth', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getGaitDiagnostic(id)) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  const error = validateGroundTruthUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { groundTruth } = req.body as GaitGroundTruthUpdateRequest
  updateGaitDiagnosticGroundTruth(id, JSON.stringify(groundTruth))
  res.status(204).end()
})

gaitDiagnosticsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteGaitDiagnostic(id)) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
