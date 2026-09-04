import { Router, type Request, type Response } from 'express'
import { getSession, insertSession, listSessions } from '../db.js'
import type { RomJointResult, RomSessionCreateRequest, RomSessionRow } from '../types.js'

export const romSessionsRouter = Router()

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<RomSessionCreateRequest>

  if (typeof b.videoName !== 'string' || b.videoName.trim() === '') return 'videoName이 필요합니다.'
  for (const field of ['beforeStartSec', 'beforeEndSec', 'afterStartSec', 'afterEndSec'] as const) {
    if (!isFiniteNumber(b[field])) return `${field}이(가) 올바르지 않습니다.`
  }
  if (b.beforeStartSec! >= b.beforeEndSec!) return 'beforeStartSec은 beforeEndSec보다 작아야 합니다.'
  if (b.afterStartSec! >= b.afterEndSec!) return 'afterStartSec은 afterEndSec보다 작아야 합니다.'
  if (!Array.isArray(b.results) || b.results.length !== 8) return 'results는 8개의 관절 결과여야 합니다.'

  return null
}

function avgDeltaRomDeg(results: RomJointResult[]): number | null {
  const deltas = results.map((r) => r.deltaRomDeg).filter((v): v is number => v !== null)
  if (deltas.length === 0) return null
  return deltas.reduce((a, b) => a + b, 0) / deltas.length
}

romSessionsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertSession(req.body as RomSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

romSessionsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listSessions(limit)
  const sessions = rows.map((row: RomSessionRow) => {
    const results = JSON.parse(row.results_json) as RomJointResult[]
    return {
      id: row.id,
      createdAt: row.created_at,
      videoName: row.video_name,
      beforeStartSec: row.before_start_sec,
      beforeEndSec: row.before_end_sec,
      afterStartSec: row.after_start_sec,
      afterEndSec: row.after_end_sec,
      avgDeltaRomDeg: avgDeltaRomDeg(results),
    }
  })
  res.json({ sessions })
})

romSessionsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const results = JSON.parse(row.results_json) as RomJointResult[]
  res.json({
    id: row.id,
    createdAt: row.created_at,
    videoName: row.video_name,
    beforeStartSec: row.before_start_sec,
    beforeEndSec: row.before_end_sec,
    afterStartSec: row.after_start_sec,
    afterEndSec: row.after_end_sec,
    avgDeltaRomDeg: avgDeltaRomDeg(results),
    results,
  })
})
