import { Router, type Request, type Response } from 'express'
import {
  deleteSession,
  getSession,
  insertSession,
  listSessions,
  updateSessionGroundTruth,
  updateSessionManualInputs,
} from '../db.js'
import { requireAuth } from '../xmskAuth.js'
import type {
  RomGroundTruthUpdateRequest,
  RomJointResult,
  RomManualInputsUpdateRequest,
  RomSessionCreateRequest,
  RomSessionRow,
  RomXmskGroundTruth,
  RomXmskManualInput,
} from '../types.js'

export const romSessionsRouter = Router()

// 2026-09 보안 점검: 예전에는 이 라우터에 인증이 전혀 없어서(HomeScreen.tsx의 최근
// 기록 미리보기 fetch가 실제로 여기 GET /을 로그인 없이 호출하고 있었다) 누구나
// 회원 이름이 담긴 세션을 만들고/읽고/지울 수 있었다. XMSK가 이미 쓰던
// 비밀번호/토큰을 그대로 재사용해 이 라우터 전체를 잠근다(자세한 배경은
// xmskAuth.ts의 requireAuth 주석 참고).
romSessionsRouter.use(requireAuth)

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function validateCreateRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<RomSessionCreateRequest>

  if (typeof b.videoName !== 'string' || b.videoName.trim() === '') return 'videoName이 필요합니다.'
  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
  for (const field of ['beforeStartSec', 'beforeEndSec', 'afterStartSec', 'afterEndSec'] as const) {
    if (!isFiniteNumber(b[field])) return `${field}이(가) 올바르지 않습니다.`
  }
  if (b.beforeStartSec! >= b.beforeEndSec!) return 'beforeStartSec은 beforeEndSec보다 작아야 합니다.'
  if (b.afterStartSec! >= b.afterEndSec!) return 'afterStartSec은 afterEndSec보다 작아야 합니다.'
  if (!Array.isArray(b.results) || b.results.length !== 8) return 'results는 8개의 관절 결과여야 합니다.'
  if (b.xmskEstimates !== undefined && !Array.isArray(b.xmskEstimates)) {
    return 'xmskEstimates는 배열이어야 합니다.'
  }
  if (b.xmskManualInputs !== undefined && !Array.isArray(b.xmskManualInputs)) {
    return 'xmskManualInputs는 배열이어야 합니다.'
  }
  if (b.xmskGroundTruth !== undefined && !Array.isArray(b.xmskGroundTruth)) {
    return 'xmskGroundTruth는 배열이어야 합니다.'
  }
  if (b.calcVersion !== undefined && typeof b.calcVersion !== 'string') {
    return 'calcVersion은 문자열이어야 합니다.'
  }

  return null
}

function isManualInput(v: unknown): v is RomXmskManualInput {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Partial<RomXmskManualInput>
  if (typeof m.id !== 'string' || m.id.trim() === '') return false
  if (m.beforeValue !== null && !isFiniteNumber(m.beforeValue)) return false
  if (m.afterValue !== null && !isFiniteNumber(m.afterValue)) return false
  return true
}

function validateManualInputsUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<RomManualInputsUpdateRequest>
  if (!Array.isArray(b.xmskManualInputs) || !b.xmskManualInputs.every(isManualInput)) {
    return 'xmskManualInputs가 올바르지 않습니다.'
  }
  return null
}

function isGroundTruth(v: unknown): v is RomXmskGroundTruth {
  if (typeof v !== 'object' || v === null) return false
  const g = v as Partial<RomXmskGroundTruth>
  if (typeof g.estimateId !== 'string' || g.estimateId.trim() === '') return false
  if (g.verifiedValue !== null && !isFiniteNumber(g.verifiedValue)) return false
  return true
}

function validateGroundTruthUpdate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<RomGroundTruthUpdateRequest>
  if (!Array.isArray(b.xmskGroundTruth) || !b.xmskGroundTruth.every(isGroundTruth)) {
    return 'xmskGroundTruth가 올바르지 않습니다.'
  }
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
      clientName: row.client_name,
      trainerName: row.trainer_name,
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
  const xmskEstimates = row.xmsk_estimates_json ? JSON.parse(row.xmsk_estimates_json) : []
  const xmskManualInputs = row.xmsk_manual_inputs_json ? JSON.parse(row.xmsk_manual_inputs_json) : []
  const xmskGroundTruth = row.xmsk_ground_truth_json ? JSON.parse(row.xmsk_ground_truth_json) : []
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
    avgDeltaRomDeg: avgDeltaRomDeg(results),
    results,
    xmskEstimates,
    xmskManualInputs,
    xmskGroundTruth,
    calcVersion: row.calc_version,
  })
})

// 손목 저항 검사 등 수기 입력 항목은 분석 직후 자동 저장(POST)이 끝난 뒤에야 트레이너가
// 값을 입력하므로, 이미 저장된 세션에 별도로 갱신할 수 있는 엔드포인트를 둔다.
romSessionsRouter.put('/:id/manual-inputs', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateManualInputsUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { xmskManualInputs } = req.body as RomManualInputsUpdateRequest
  updateSessionManualInputs(id, JSON.stringify(xmskManualInputs))
  res.status(204).end()
})

// AI 추정값 옆에 트레이너가 실측한 값(ground truth)도, 분석 당일이 아니라 나중에
// 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많으므로 별도 갱신 엔드포인트를 둔다.
romSessionsRouter.put('/:id/ground-truth', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !getSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  const error = validateGroundTruthUpdate(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { xmskGroundTruth } = req.body as RomGroundTruthUpdateRequest
  updateSessionGroundTruth(id, JSON.stringify(xmskGroundTruth))
  res.status(204).end()
})

romSessionsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})
