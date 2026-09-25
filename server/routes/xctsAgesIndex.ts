import { Router, type Request, type Response } from 'express'
import { deleteAgesIndexRecord, insertAgesIndexRecords, listAgesIndexRecords } from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type { AgesIndexRecordInput, AgesIndexRecordRow, AgesIndexUploadRequest } from '../types.js'

export const xctsAgesIndexRouter = Router()

// 다른 XCTS 라우트와 같은 이유로 앱 전체 로그인을 재사용한다 — xctsSessions.ts 참고.
xctsAgesIndexRouter.use(requireAuth)

const MAX_RECORDS_PER_UPLOAD = 5000

function isAgesIndexRecordInputLike(v: unknown): v is AgesIndexRecordInput {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Partial<AgesIndexRecordInput>
  return (
    typeof r.dayTimeRaw === 'string' &&
    r.dayTimeRaw.trim() !== '' &&
    (r.dayTimeLabel === null || typeof r.dayTimeLabel === 'string') &&
    typeof r.score === 'number' &&
    Number.isFinite(r.score) &&
    typeof r.grade === 'string' &&
    r.grade.trim() !== ''
  )
}

function validateUploadRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<AgesIndexUploadRequest>

  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  // deviceSource는 XCTS의 다른 라우트와 같은 이유로 특정 문자열을 강제하지 않는다
  // (xctsSessions.ts 참고) — 비어있지 않은 문자열인지만 확인한다.
  if (typeof b.deviceSource !== 'string' || b.deviceSource.trim() === '') return 'deviceSource가 필요합니다.'
  if (!Array.isArray(b.records) || b.records.length === 0) return 'records가 비어있지 않은 배열이어야 합니다.'
  if (b.records.length > MAX_RECORDS_PER_UPLOAD) {
    return `한 번에 저장할 수 있는 기록은 ${MAX_RECORDS_PER_UPLOAD}건까지입니다.`
  }
  if (!b.records.every(isAgesIndexRecordInputLike)) return 'records 안에 올바르지 않은 항목이 있습니다.'

  return null
}

xctsAgesIndexRouter.post('/', (req: Request, res: Response) => {
  const error = validateUploadRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { insertedCount } = insertAgesIndexRecords(req.body as AgesIndexUploadRequest)
  res.status(201).json({ insertedCount })
})

xctsAgesIndexRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100

  const rows = listAgesIndexRecords(limit)
  const records = rows.map((row: AgesIndexRecordRow) => ({
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    dayTimeRaw: row.day_time_raw,
    dayTimeLabel: row.day_time_label,
    score: row.score,
    grade: row.grade,
  }))
  res.json({ records })
})

xctsAgesIndexRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteAgesIndexRecord(id)) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
