import { Router, type Request, type Response } from 'express'
import { deleteEegSession, getEegSession, insertEegSession, listEegSessions } from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type { EegBandPowers, EegSessionCreateRequest, EegSessionRow } from '../types.js'

export const eegSessionsRouter = Router()

// XCTS와 같은 이유로 앱 전체 로그인을 재사용한다 — CLAUDE.md "앱 전체 인증" 절 참고.
eegSessionsRouter.use(requireAuth)

const BAND_KEYS = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const

function isEegBandPowersLike(v: unknown): v is EegBandPowers {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Partial<EegBandPowers>
  return BAND_KEYS.every((k) => typeof b[k] === 'number' && Number.isFinite(b[k]))
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<EegSessionCreateRequest>

  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  if (b.deviceName !== undefined && b.deviceName !== null && typeof b.deviceName !== 'string') {
    return 'deviceName이 올바르지 않습니다.'
  }
  if (!isEegBandPowersLike(b.bandPowers)) return 'bandPowers가 필요합니다.'
  if (b.note !== undefined && typeof b.note !== 'string') return 'note가 올바르지 않습니다.'

  return null
}

eegSessionsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertEegSession(req.body as EegSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

eegSessionsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listEegSessions(limit)
  const sessions = rows.map((row: EegSessionRow) => ({
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    deviceName: row.device_name,
    bandPowers: JSON.parse(row.band_powers_json) as EegBandPowers,
  }))
  res.json({ sessions })
})

eegSessionsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getEegSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  res.json({
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    deviceName: row.device_name,
    bandPowers: JSON.parse(row.band_powers_json) as EegBandPowers,
    note: row.note,
  })
})

eegSessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteEegSession(id)) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
