import { Router, type Request, type Response } from 'express'
import {
  deleteFootSession,
  getFootSession,
  insertFootSession,
  listFootSessions,
  updateFootSessionEegContext,
  updateFootSessionManualToeInputs,
} from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type {
  EegContextUpdateRequest,
  FootManualToeInput,
  FootManualToeUpdateRequest,
  FootSessionCreateRequest,
  FootSessionRow,
  FootToeEstimateResult,
} from '../types.js'

export const footSessionsRouter = Router()

// 2026-09 보안 점검으로 추가 — romSessionsRouter와 같은 이유(자세한 배경은
// xmskAuth.ts의 requireAuth 주석 참고).
footSessionsRouter.use(requireAuth)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isToeEstimate(v: unknown): v is FootToeEstimateResult {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Partial<FootToeEstimateResult>
  return (e.side === 'left' || e.side === 'right') && typeof e.label === 'string'
}

function isManualToeInput(v: unknown): v is FootManualToeInput {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Partial<FootManualToeInput>
  if (typeof m.id !== 'string' || m.id.trim() === '') return false
  if (m.beforeValue !== null && !isFiniteNumber(m.beforeValue)) return false
  if (m.afterValue !== null && !isFiniteNumber(m.afterValue)) return false
  if (m.source !== undefined && m.source !== 'estimated' && m.source !== 'trainer') return false
  // estimatedBeforeValue/estimatedAfterValue — AI 시뮬레이션 초기값을 영구 보존하는
  // 필드(handfoot/types.ts 참고). 옛 기록에는 아예 없을 수 있어 undefined도 허용한다.
  if (m.estimatedBeforeValue !== undefined && m.estimatedBeforeValue !== null && !isFiniteNumber(m.estimatedBeforeValue)) {
    return false
  }
  if (m.estimatedAfterValue !== undefined && m.estimatedAfterValue !== null && !isFiniteNumber(m.estimatedAfterValue)) {
    return false
  }
  return true
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<FootSessionCreateRequest>

  if (typeof b.videoName !== 'string' || b.videoName.trim() === '') return 'videoName이 필요합니다.'
  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  for (const field of ['beforeStartSec', 'beforeEndSec', 'afterStartSec', 'afterEndSec'] as const) {
    if (!isFiniteNumber(b[field])) return `${field}이(가) 올바르지 않습니다.`
  }
  if (b.beforeStartSec! >= b.beforeEndSec!) return 'beforeStartSec은 beforeEndSec보다 작아야 합니다.'
  if (b.afterStartSec! >= b.afterEndSec!) return 'afterStartSec은 afterEndSec보다 작아야 합니다.'
  if (b.toeEstimates !== undefined && (!Array.isArray(b.toeEstimates) || !b.toeEstimates.every(isToeEstimate))) {
    return 'toeEstimates가 올바르지 않습니다.'
  }
  if (
    b.manualToeInputs !== undefined &&
    (!Array.isArray(b.manualToeInputs) || !b.manualToeInputs.every(isManualToeInput))
  ) {
    return 'manualToeInputs가 올바르지 않습니다.'
  }
  if (b.calcVersion !== undefined && typeof b.calcVersion !== 'string') return 'calcVersion은 문자열이어야 합니다.'
  // handSessions.ts와 같은 이유 — 얕은 검사만.
  if (b.eegContext !== undefined && (typeof b.eegContext !== 'object' || b.eegContext === null)) {
    return 'eegContext가 올바르지 않습니다.'
  }

  return null
}

function validateManualToeUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<FootManualToeUpdateRequest>
  if (!Array.isArray(b.manualToeInputs) || !b.manualToeInputs.every(isManualToeInput)) {
    return 'manualToeInputs가 올바르지 않습니다.'
  }
  return null
}

function validateEegContextUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<EegContextUpdateRequest>
  if (typeof b.eegContext !== 'object' || b.eegContext === null) return 'eegContext가 올바르지 않습니다.'
  return null
}

function avgAbsDelta(estimates: FootToeEstimateResult[]): number | null {
  const deltas = estimates
    .map((e) => e.deltaValue)
    .filter((v): v is number => v !== null)
    .map(Math.abs)
  if (deltas.length === 0) return null
  return deltas.reduce((a, b) => a + b, 0) / deltas.length
}

footSessionsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertFootSession(req.body as FootSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

footSessionsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listFootSessions(limit)
  const sessions = rows.map((row: FootSessionRow) => {
    const toeEstimates = JSON.parse(row.toe_estimates_json) as FootToeEstimateResult[]
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
      avgAbsDelta: avgAbsDelta(toeEstimates),
    }
  })
  res.json({ sessions })
})

footSessionsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getFootSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const toeEstimates = JSON.parse(row.toe_estimates_json) as FootToeEstimateResult[]
  const manualToeInputs = JSON.parse(row.manual_toe_inputs_json) as FootManualToeInput[]
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
    avgAbsDelta: avgAbsDelta(toeEstimates),
    toeEstimates,
    manualToeInputs,
    calcVersion: row.calc_version,
    eegContext: row.eeg_context_json ? JSON.parse(row.eeg_context_json) : null,
  })
})

// 발가락 10마디는 AI가 인식하지 못해 전부 트레이너 수기 입력이라(footToeEstimate.ts
// 참고), ROM의 manual-inputs 엔드포인트와 같은 이유로 분석 직후 자동 저장(POST) 이후
// 별도 PUT으로 이미 저장된 세션에 갱신한다.
footSessionsRouter.put('/:id/manual-toe-inputs', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getFootSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateManualToeUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { manualToeInputs } = req.body as FootManualToeUpdateRequest
  updateFootSessionManualToeInputs(id, JSON.stringify(manualToeInputs))
  res.status(204).end()
})

// 동시 측정 뇌파 컨텍스트만 갱신 — handSessions.ts의 같은 엔드포인트와 동일한 이유.
footSessionsRouter.put('/:id/eeg-context', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getFootSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateEegContextUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { eegContext } = req.body as EegContextUpdateRequest
  updateFootSessionEegContext(id, JSON.stringify(eegContext))
  res.status(204).end()
})

footSessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteFootSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
