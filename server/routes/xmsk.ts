import { Router, type NextFunction, type Request, type Response } from 'express'
import { checkPassword, issueToken, verifyToken } from '../xmskAuth.js'
import { getXmskSession, insertXmskSession, listXmskSessions } from '../db.js'
import type { XmskMeasurementValue, XmskSessionCreateRequest, XmskSessionRow } from '../types.js'

export const xmskRouter = Router()

const VALID_REGIONS = new Set([
  'neckShoulder',
  'lowBack',
  'knee',
  'ankle',
  'hip',
  'elbow',
  'wrist',
  'upperBack',
])

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isMeasurementValue(v: unknown): v is XmskMeasurementValue {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Partial<XmskMeasurementValue>
  if (typeof m.id !== 'string' || m.id.trim() === '') return false
  for (const key of ['value', 'left', 'right'] as const) {
    if (m[key] !== undefined && !isFiniteNumber(m[key])) return false
  }
  return true
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<XmskSessionCreateRequest>

  if (typeof b.region !== 'string' || !VALID_REGIONS.has(b.region)) return 'region이 올바르지 않습니다.'
  if (!Array.isArray(b.before) || b.before.some((v) => !isMeasurementValue(v))) {
    return 'before 측정값이 올바르지 않습니다.'
  }
  if (!Array.isArray(b.after) || b.after.some((v) => !isMeasurementValue(v))) {
    return 'after 측정값이 올바르지 않습니다.'
  }
  if (typeof b.redFlagsCleared !== 'boolean') return 'redFlagsCleared가 필요합니다.'
  if (b.note !== undefined && typeof b.note !== 'string') return 'note가 올바르지 않습니다.'

  return null
}

function avgAbsDelta(before: XmskMeasurementValue[], after: XmskMeasurementValue[]): number | null {
  const byId = new Map(after.map((v) => [v.id, v]))
  const deltas: number[] = []
  for (const b of before) {
    const a = byId.get(b.id)
    if (!a) continue
    if (isFiniteNumber(b.value) && isFiniteNumber(a.value)) deltas.push(Math.abs(a.value - b.value))
    if (isFiniteNumber(b.left) && isFiniteNumber(a.left)) deltas.push(Math.abs(a.left - b.left))
    if (isFiniteNumber(b.right) && isFiniteNumber(a.right)) deltas.push(Math.abs(a.right - b.right))
  }
  if (deltas.length === 0) return null
  return deltas.reduce((x, y) => x + y, 0) / deltas.length
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!verifyToken(token)) {
    res.status(401).json({ error: '인증이 필요합니다.' })
    return
  }
  next()
}

xmskRouter.post('/auth', (req: Request, res: Response) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!password || !checkPassword(password)) {
    res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' })
    return
  }
  res.json({ token: issueToken() })
})

xmskRouter.post('/sessions', requireAuth, (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertXmskSession(req.body as XmskSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

xmskRouter.get('/sessions', requireAuth, (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listXmskSessions(limit)
  const sessions = rows.map((row: XmskSessionRow) => {
    const before = JSON.parse(row.before_json) as XmskMeasurementValue[]
    const after = JSON.parse(row.after_json) as XmskMeasurementValue[]
    return {
      id: row.id,
      createdAt: row.created_at,
      region: row.region,
      note: row.note,
      avgAbsDelta: avgAbsDelta(before, after),
    }
  })
  res.json({ sessions })
})

xmskRouter.get('/sessions/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getXmskSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const before = JSON.parse(row.before_json) as XmskMeasurementValue[]
  const after = JSON.parse(row.after_json) as XmskMeasurementValue[]
  res.json({
    id: row.id,
    createdAt: row.created_at,
    region: row.region,
    note: row.note,
    redFlagsCleared: !!row.red_flags_cleared,
    before,
    after,
    avgAbsDelta: avgAbsDelta(before, after),
  })
})
