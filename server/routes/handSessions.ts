import { Router, type Request, type Response } from 'express'
import {
  deleteHandSession,
  getHandSession,
  insertHandSession,
  listHandSessions,
  updateHandSessionEegContext,
  updateHandSessionGroundTruth,
} from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type {
  EegContextUpdateRequest,
  HandGroundTruthUpdateRequest,
  HandJointGroundTruth,
  HandJointResult,
  HandSessionCreateRequest,
  HandSessionRow,
} from '../types.js'

export const handSessionsRouter = Router()

// 2026-09 보안 점검으로 추가 — romSessionsRouter와 같은 이유(자세한 배경은
// xmskAuth.ts의 requireAuth 주석 참고).
handSessionsRouter.use(requireAuth)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isHandJointResult(v: unknown): v is HandJointResult {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Partial<HandJointResult>
  return typeof r.joint === 'string' && typeof r.label === 'string'
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<HandSessionCreateRequest>

  if (typeof b.videoName !== 'string' || b.videoName.trim() === '') return 'videoName이 필요합니다.'
  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  for (const field of ['beforeStartSec', 'beforeEndSec', 'afterStartSec', 'afterEndSec'] as const) {
    if (!isFiniteNumber(b[field])) return `${field}이(가) 올바르지 않습니다.`
  }
  if (b.beforeStartSec! >= b.beforeEndSec!) return 'beforeStartSec은 beforeEndSec보다 작아야 합니다.'
  if (b.afterStartSec! >= b.afterEndSec!) return 'afterStartSec은 afterEndSec보다 작아야 합니다.'
  if (!Array.isArray(b.leftResults) || !b.leftResults.every(isHandJointResult)) return 'leftResults가 올바르지 않습니다.'
  if (!Array.isArray(b.rightResults) || !b.rightResults.every(isHandJointResult)) {
    return 'rightResults가 올바르지 않습니다.'
  }
  if (b.calcVersion !== undefined && typeof b.calcVersion !== 'string') return 'calcVersion은 문자열이어야 합니다.'
  // eegContext는 gaitDiagnostics.ts의 gaitMetrics와 같은 방식으로 얕게만 검사한다 — 서버는
  // 내용을 해석하지 않고 그대로 저장/반환만 하므로, 객체인지만 확인하면 충분하다.
  if (b.eegContext !== undefined && (typeof b.eegContext !== 'object' || b.eegContext === null)) {
    return 'eegContext가 올바르지 않습니다.'
  }
  if (b.handGroundTruth !== undefined && !Array.isArray(b.handGroundTruth)) {
    return 'handGroundTruth는 배열이어야 합니다.'
  }

  return null
}

function validateEegContextUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<EegContextUpdateRequest>
  if (typeof b.eegContext !== 'object' || b.eegContext === null) return 'eegContext가 올바르지 않습니다.'
  return null
}

function isHandGroundTruthItem(v: unknown): v is HandJointGroundTruth {
  if (typeof v !== 'object' || v === null) return false
  const g = v as Partial<HandJointGroundTruth>
  if (typeof g.id !== 'string' || g.id.trim() === '') return false
  if (g.verifiedValue !== null && !isFiniteNumber(g.verifiedValue)) return false
  return true
}

function validateGroundTruthUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<HandGroundTruthUpdateRequest>
  if (!Array.isArray(b.handGroundTruth) || !b.handGroundTruth.every(isHandGroundTruthItem)) {
    return 'handGroundTruth가 올바르지 않습니다.'
  }
  return null
}

function avgDeltaRomDeg(results: HandJointResult[]): number | null {
  const deltas = results.map((r) => r.deltaRomDeg).filter((v): v is number => v !== null)
  if (deltas.length === 0) return null
  return deltas.reduce((a, b) => a + b, 0) / deltas.length
}

handSessionsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertHandSession(req.body as HandSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

handSessionsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listHandSessions(limit)
  const sessions = rows.map((row: HandSessionRow) => {
    const left = JSON.parse(row.left_results_json) as HandJointResult[]
    const right = JSON.parse(row.right_results_json) as HandJointResult[]
    return {
      id: row.id,
      createdAt: row.created_at,
      videoName: row.video_name,
      clientName: row.client_name,
      trainerName: row.trainer_name,
      beforeStartSec: row.before_start_sec,
      beforeEndSec: row.before_end_sec,
      afterStartSec: row.after_start_sec,
      afterEndSec: row.after_end_sec,
      avgDeltaRomDeg: avgDeltaRomDeg([...left, ...right]),
    }
  })
  res.json({ sessions })
})

handSessionsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getHandSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const leftResults = JSON.parse(row.left_results_json) as HandJointResult[]
  const rightResults = JSON.parse(row.right_results_json) as HandJointResult[]
  res.json({
    id: row.id,
    createdAt: row.created_at,
    videoName: row.video_name,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    beforeStartSec: row.before_start_sec,
    beforeEndSec: row.before_end_sec,
    afterStartSec: row.after_start_sec,
    afterEndSec: row.after_end_sec,
    avgDeltaRomDeg: avgDeltaRomDeg([...leftResults, ...rightResults]),
    leftResults,
    rightResults,
    calcVersion: row.calc_version,
    eegContext: row.eeg_context_json ? JSON.parse(row.eeg_context_json) : null,
    handGroundTruth: row.hand_ground_truth_json ? JSON.parse(row.hand_ground_truth_json) : [],
  })
})

// 동시 측정 뇌파 컨텍스트만 갱신 — "활동(분석 직후)" 캡처가 분석 직후 자동 저장(POST)
// 이후에야 이뤄지는 경우가 많아, ROM의 manual-inputs/ground-truth 엔드포인트와 같은
// 이유로 별도 PUT을 둔다(handFootApi.ts의 updateHandSessionEegContext 참고).
handSessionsRouter.put('/:id/eeg-context', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getHandSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateEegContextUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { eegContext } = req.body as EegContextUpdateRequest
  updateHandSessionEegContext(id, JSON.stringify(eegContext))
  res.status(204).end()
})

// 손가락 관절 트레이너 실측값만 갱신 — ROM의 ground-truth 엔드포인트와 같은 이유
// (분석 당일이 아니라 나중에 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많음).
handSessionsRouter.put('/:id/ground-truth', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getHandSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateGroundTruthUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { handGroundTruth } = req.body as HandGroundTruthUpdateRequest
  updateHandSessionGroundTruth(id, JSON.stringify(handGroundTruth))
  res.status(204).end()
})

handSessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteHandSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
