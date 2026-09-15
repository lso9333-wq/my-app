import { Router, type Request, type Response } from 'express'
import { deleteXctsSession, getXctsSession, insertXctsSession, listXctsSessions } from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type { HeartRateWindowSummary, XctsSessionCreateRequest, XctsSessionRow } from '../types.js'

export const xctsSessionsRouter = Router()

// 다른 4개 트레이너 도구(보행/ROM/손발/XMSK)와 같은 이유로 앱 전체 로그인을 그대로
// 재사용한다 — CLAUDE.md "앱 전체 인증" 절 참고. XCTS만 별도 비밀번호를 새로 만들지 않는다.
xctsSessionsRouter.use(requireAuth)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// HeartRateWindowSummary는 shared/lib/heartRate/heartRateInterpretation.ts에서 계산한
// 값을 그대로 실어 보내는 것이라, hand/foot의 eegContext와 같은 방식으로 얕게만
// 검사한다(서버는 내용을 해석하지 않고 그대로 저장/반환만 함).
function isHeartRateWindowSummaryLike(v: unknown): v is HeartRateWindowSummary {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<HeartRateWindowSummary>
  return typeof s.capturedAt === 'string'
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<XctsSessionCreateRequest>

  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  // deviceSource는 지금은 'ble-heart-rate' 하나뿐이지만(XctsMeasurementSource), 추후
  // 스마트워치 제조사/개발사 협업으로 값이 늘어날 것을 고려해 서버는 특정 문자열
  // 하나만 허용하지 않고 비어있지 않은 문자열인지만 검사한다 — types.ts 상단 주석 참고.
  if (typeof b.deviceSource !== 'string' || b.deviceSource.trim() === '') return 'deviceSource가 필요합니다.'
  if (b.deviceName !== undefined && b.deviceName !== null && typeof b.deviceName !== 'string') {
    return 'deviceName이 올바르지 않습니다.'
  }
  if (b.baseline !== undefined && b.baseline !== null && !isHeartRateWindowSummaryLike(b.baseline)) {
    return 'baseline이 올바르지 않습니다.'
  }
  if (b.post !== undefined && b.post !== null && !isHeartRateWindowSummaryLike(b.post)) {
    return 'post가 올바르지 않습니다.'
  }
  if (b.baseline == null && b.post == null) return 'baseline 또는 post 중 하나는 있어야 합니다.'
  if (b.note !== undefined && typeof b.note !== 'string') return 'note가 올바르지 않습니다.'

  return null
}

/** 목록 화면에서 심박 변화를 한눈에 보여주기 위한 값 — baseline/post 둘 다 있고
 * 둘 다 평균 심박이 계산돼 있을 때만 구할 수 있다(둘 중 하나만 측정한 세션도
 * 허용하므로 null일 수 있음). */
function avgHeartRateDeltaBpm(
  baseline: HeartRateWindowSummary | null,
  post: HeartRateWindowSummary | null,
): number | null {
  if (!baseline || !post) return null
  if (!isFiniteNumber(baseline.avgHeartRateBpm) || !isFiniteNumber(post.avgHeartRateBpm)) return null
  return post.avgHeartRateBpm - baseline.avgHeartRateBpm
}

xctsSessionsRouter.post('/', (req: Request, res: Response) => {
  const error = validateCreateRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertXctsSession(req.body as XctsSessionCreateRequest)
  res.status(201).json({ id, createdAt })
})

xctsSessionsRouter.get('/', (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listXctsSessions(limit)
  const sessions = rows.map((row: XctsSessionRow) => {
    const baseline = row.baseline_json ? (JSON.parse(row.baseline_json) as HeartRateWindowSummary) : null
    const post = row.post_json ? (JSON.parse(row.post_json) as HeartRateWindowSummary) : null
    return {
      id: row.id,
      createdAt: row.created_at,
      clientName: row.client_name,
      trainerName: row.trainer_name,
      deviceSource: row.device_source,
      deviceName: row.device_name,
      avgHeartRateDeltaBpm: avgHeartRateDeltaBpm(baseline, post),
    }
  })
  res.json({ sessions })
})

xctsSessionsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getXctsSession(id) : undefined
  if (!row) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  const baseline = row.baseline_json ? (JSON.parse(row.baseline_json) as HeartRateWindowSummary) : null
  const post = row.post_json ? (JSON.parse(row.post_json) as HeartRateWindowSummary) : null
  res.json({
    id: row.id,
    createdAt: row.created_at,
    clientName: row.client_name,
    trainerName: row.trainer_name,
    deviceSource: row.device_source,
    deviceName: row.device_name,
    avgHeartRateDeltaBpm: avgHeartRateDeltaBpm(baseline, post),
    baseline,
    post,
    note: row.note,
  })
})

xctsSessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteXctsSession(id)) {
    res.status(404).json({ error: '기록을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
