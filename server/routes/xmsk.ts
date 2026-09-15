import { Router, type Request, type Response } from 'express'
import {
  checkPassword,
  clearLoginAttempts,
  isLoginRateLimited,
  issueToken,
  recordFailedLogin,
  requireAuth,
} from '../xmskAuth.js'
import {
  deleteXmskEvaluation,
  deleteXmskSession,
  getXmskEvaluation,
  getXmskSession,
  insertXmskEvaluation,
  insertXmskSession,
  listFootToeSimCalibrationData,
  listGaitGroundTruthData,
  listHandGroundTruthData,
  listRomGroundTruthData,
  listXmskEvaluations,
  listXmskSessions,
} from '../db.js'
import { computeXmskEvalVerdict, XMSK_EVAL_REQUIRED_IDS, XMSK_EVAL_SCORE_MAX } from '../xmskEvalDefs.js'
import type {
  DataQualityFeatureSummary,
  DataQualityItemStat,
  DataQualitySummary,
  DataQualityVersionCount,
  XmskEvaluationCreateRequest,
  XmskEvaluationRow,
  XmskMeasurementValue,
  XmskSessionCreateRequest,
  XmskSessionRow,
} from '../types.js'

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
  if (typeof b.clientName !== 'string' || b.clientName.trim() === '') return 'clientName이 필요합니다.'
  if (b.trainerName !== undefined && typeof b.trainerName !== 'string') return 'trainerName이 올바르지 않습니다.'
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

// requireAuth는 이제 xmskAuth.ts에서 가져다 쓴다 — 보행/ROM/손발 라우터도 같은
// 함수를 공유해야 해서 2026-09 보안 점검 때 그쪽으로 옮겼다(자세한 이유는
// xmskAuth.ts의 requireAuth 주석 참고).

// 하위 호환용으로 남겨둔 예전 로그인 엔드포인트. 새 공용 엔드포인트는
// POST /api/auth/login(routes/auth.ts)이고 같은 checkPassword/issueToken을 쓰므로
// 결과(토큰)는 완전히 같다 — 로그인 시도 속도 제한도 새 엔드포인트와 동일하게 적용한다.
xmskRouter.post('/auth', (req: Request, res: Response) => {
  if (isLoginRateLimited(req)) {
    res.status(429).json({ error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' })
    return
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!password || !checkPassword(password)) {
    recordFailedLogin(req)
    res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' })
    return
  }
  clearLoginAttempts(req)
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
      clientName: row.client_name,
      trainerName: row.trainer_name,
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
    clientName: row.client_name,
    trainerName: row.trainer_name,
    note: row.note,
    redFlagsCleared: !!row.red_flags_cleared,
    before,
    after,
    avgAbsDelta: avgAbsDelta(before, after),
  })
})

xmskRouter.delete('/sessions/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteXmskSession(id)) {
    res.status(404).json({ error: '세션을 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})

function validateEvaluationRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return '요청 본문이 올바르지 않습니다.'
  const b = body as Partial<XmskEvaluationCreateRequest>

  if (typeof b.traineeName !== 'string' || b.traineeName.trim() === '') return 'traineeName이 필요합니다.'
  if (typeof b.evaluationDate !== 'string' || b.evaluationDate.trim() === '') return 'evaluationDate가 필요합니다.'
  if (b.evaluatorName !== undefined && typeof b.evaluatorName !== 'string') return 'evaluatorName이 올바르지 않습니다.'
  if (b.comment !== undefined && typeof b.comment !== 'string') return 'comment가 올바르지 않습니다.'

  if (typeof b.scores !== 'object' || b.scores === null) return 'scores가 필요합니다.'
  for (const [id, max] of Object.entries(XMSK_EVAL_SCORE_MAX)) {
    const v = (b.scores as Record<string, unknown>)[id]
    if (!isFiniteNumber(v) || v < 0 || v > max) return `scores.${id}는 0~${max} 사이여야 합니다.`
  }

  if (typeof b.requiredPass !== 'object' || b.requiredPass === null) return 'requiredPass가 필요합니다.'
  for (const id of XMSK_EVAL_REQUIRED_IDS) {
    const v = (b.requiredPass as Record<string, unknown>)[id]
    if (typeof v !== 'boolean') return `requiredPass.${id}는 boolean이어야 합니다.`
  }

  return null
}

function evalTotalScore(scores: Record<string, number>): number {
  return Object.keys(XMSK_EVAL_SCORE_MAX).reduce((sum, id) => sum + (scores[id] ?? 0), 0)
}

function evalAllRequiredPassed(requiredPass: Record<string, boolean>): boolean {
  return XMSK_EVAL_REQUIRED_IDS.every((id) => requiredPass[id] === true)
}

xmskRouter.post('/evaluations', requireAuth, (req: Request, res: Response) => {
  const error = validateEvaluationRequest(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  const { id, createdAt } = insertXmskEvaluation(req.body as XmskEvaluationCreateRequest)
  res.status(201).json({ id, createdAt })
})

xmskRouter.get('/evaluations', requireAuth, (req: Request, res: Response) => {
  const limitParam = Number(req.query.limit)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const rows = listXmskEvaluations(limit)
  const evaluations = rows.map((row: XmskEvaluationRow) => {
    const scores = JSON.parse(row.scores_json) as Record<string, number>
    const requiredPass = JSON.parse(row.required_pass_json) as Record<string, boolean>
    const totalScore = evalTotalScore(scores)
    return {
      id: row.id,
      createdAt: row.created_at,
      traineeName: row.trainee_name,
      evaluatorName: row.evaluator_name,
      evaluationDate: row.evaluation_date,
      totalScore,
      verdict: computeXmskEvalVerdict(totalScore, evalAllRequiredPassed(requiredPass)),
    }
  })
  res.json({ evaluations })
})

xmskRouter.get('/evaluations/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const row = Number.isFinite(id) ? getXmskEvaluation(id) : undefined
  if (!row) {
    res.status(404).json({ error: '평가를 찾을 수 없습니다' })
    return
  }
  const scores = JSON.parse(row.scores_json) as Record<string, number>
  const requiredPass = JSON.parse(row.required_pass_json) as Record<string, boolean>
  const totalScore = evalTotalScore(scores)
  res.json({
    id: row.id,
    createdAt: row.created_at,
    traineeName: row.trainee_name,
    evaluatorName: row.evaluator_name,
    evaluationDate: row.evaluation_date,
    totalScore,
    verdict: computeXmskEvalVerdict(totalScore, evalAllRequiredPassed(requiredPass)),
    scores,
    requiredPass,
    comment: row.comment,
  })
})

xmskRouter.delete('/evaluations/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || !deleteXmskEvaluation(id)) {
    res.status(404).json({ error: '평가를 찾을 수 없습니다' })
    return
  }
  res.status(204).end()
})

// 보행 ground truth(GaitGroundTruth.id)는 estimateId가 아니라 id 필드를 쓰지만, 서버는
// ground_truth_json을 검사 없이 그대로 저장/반환만 하므로(다른 *_json과 같은 방식) 라벨/
// 단위 정보가 없다 — 프론트엔드 src/features/gait/lib/gaitGroundTruth.ts의
// GAIT_VERIFIABLE_ITEMS를 표시용으로만 그대로 복제한다(기존 프론트/서버 타입 중복 관례).
const GAIT_ITEM_LABELS: { id: string; label: string; unit: string }[] = [
  { id: 'cadence', label: '케이던스(분당 걸음 수)', unit: '걸음/분' },
  { id: 'temporalSymmetry', label: '좌우 걸음 간격 대칭성', unit: '%' },
  { id: 'stepLengthSymmetry', label: '좌우 보폭 대칭성', unit: '%' },
  { id: 'fallRiskScore', label: '전도(낙상) 위험 점수', unit: '점(0~100)' },
]

interface RomEstimateJsonEntry {
  id?: unknown
  label?: unknown
  unit?: unknown
  beforeValue?: unknown
  afterValue?: unknown
}

interface RomGroundTruthJsonEntry {
  estimateId?: unknown
  verifiedValue?: unknown
}

interface GaitGroundTruthJsonEntry {
  id?: unknown
  verifiedValue?: unknown
}

interface FootManualToeJsonEntry {
  id?: unknown
  beforeValue?: unknown
  afterValue?: unknown
  source?: unknown
  estimatedBeforeValue?: unknown
  estimatedAfterValue?: unknown
}

interface HandJointResultJsonEntry {
  joint?: unknown
  label?: unknown
  beforeRomDeg?: unknown
  afterRomDeg?: unknown
}

interface HandGroundTruthJsonEntry {
  id?: unknown
  verifiedValue?: unknown
}

// 손가락 관절 항목 라벨은 ROM(romItemStats)과 같은 방식으로 결과 안의 label을 그대로
// 쓴다(정적 목록을 따로 두지 않는다) — HandJointResult가 이미 label을 담고 있어
// FOOT_ITEM_LABELS처럼 프론트 생성 규칙을 복제할 필요가 없다. 다만 같은 관절 키가
// 왼손/오른손 모두에 쓰이므로(handfoot/types.ts의 HandJointGroundTruth 주석 참고) id
// 앞에 side를 붙이고 라벨도 "왼손/오른손"을 붙여 구분한다.
const HAND_SIDE_LABELS: { key: 'left' | 'right'; label: string }[] = [
  { key: 'left', label: '왼손' },
  { key: 'right', label: '오른손' },
]

// 발가락 마디별 시뮬레이션(TOE_SEGMENT_SIM_PARAMS) 보정 현황용 — GAIT_ITEM_LABELS와
// 같은 이유로 src/features/handfoot/lib/handfootManualItems.ts의 FOOT_MANUAL_TOE_ITEMS
// 생성 규칙을 그대로 복제한다(프론트/서버 타입 중복 관례. id 형식이 어긋나면 안 되므로
// toeKey_segmentKey_side 순서와 라벨 문구를 정확히 맞춰야 한다).
const FOOT_TOES = [
  { key: 'bigToe', label: '엄지발가락' },
  { key: 'toe2', label: '둘째발가락' },
  { key: 'toe3', label: '셋째발가락' },
  { key: 'toe4', label: '넷째발가락' },
  { key: 'toe5', label: '새끼발가락' },
] as const
const FOOT_SEGMENTS = [
  { key: 'mtp', label: '중족지관절(MTP)' },
  { key: 'ip', label: '지절간관절(IP, 통합)' },
] as const
const FOOT_SIDES = [
  { key: 'left', label: '왼발' },
  { key: 'right', label: '오른발' },
] as const
const FOOT_ITEM_LABELS: { id: string; label: string; unit: string }[] = FOOT_SIDES.flatMap((side) =>
  FOOT_TOES.flatMap((toe) =>
    FOOT_SEGMENTS.map((seg) => ({
      id: `${toe.key}_${seg.key}_${side.key}`,
      label: `${side.label} ${toe.label} ${seg.label}`,
      unit: '도(추정, AI 시뮬레이션 또는 수기측정)',
    })),
  ),
)

function safeParseArray<T>(json: string | null): T[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function buildVersionCounts(versions: (string | null)[]): DataQualityVersionCount[] {
  const counts = new Map<string | null, number>()
  for (const v of versions) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .map(([calcVersion, count]) => ({ calcVersion, count }))
    .sort((a, b) => b.count - a.count)
}

// 실제로 계산에 쓰이는 곳은 없다 — AI 추정치가 이미 있는 항목마다 트레이너 실측값이
// 얼마나 쌓였는지 보여줘, 나중에 계산 로직 보정을 시작할 만큼 데이터가 모였는지
// 판단하는 데만 쓰는 참고 지표다(docs/ai-training-plan.md 참고).
xmskRouter.get('/data-quality', requireAuth, (_req: Request, res: Response) => {
  const romItemStats = new Map<string, { label: string; unit: string; withEstimate: number; withGroundTruth: number }>()
  const romRows = listRomGroundTruthData()
  for (const row of romRows) {
    const estimates = safeParseArray<RomEstimateJsonEntry>(row.xmskEstimatesJson)
    const groundTruth = safeParseArray<RomGroundTruthJsonEntry>(row.xmskGroundTruthJson)
    const gtById = new Map(groundTruth.map((g) => [g.estimateId, g.verifiedValue]))
    for (const e of estimates) {
      if (typeof e.id !== 'string') continue
      if (!romItemStats.has(e.id)) {
        romItemStats.set(e.id, {
          label: typeof e.label === 'string' ? e.label : e.id,
          unit: typeof e.unit === 'string' ? e.unit : '',
          withEstimate: 0,
          withGroundTruth: 0,
        })
      }
      const stat = romItemStats.get(e.id)!
      if (e.beforeValue !== null || e.afterValue !== null) stat.withEstimate += 1
      const gtValue = gtById.get(e.id)
      if (gtValue !== undefined && gtValue !== null) stat.withGroundTruth += 1
    }
  }
  const romItems: DataQualityItemStat[] = [...romItemStats.entries()]
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.withEstimate - a.withEstimate)

  const gaitItemStats = new Map(
    GAIT_ITEM_LABELS.map((d) => [d.id, { label: d.label, unit: d.unit, withEstimate: 0, withGroundTruth: 0 }]),
  )
  const gaitRows = listGaitGroundTruthData()
  for (const row of gaitRows) {
    // GaitGroundTruthPanel은 걸음이 2보 이상 감지됐을 때만 렌더링되므로(4개 항목 모두
    // 한 번에 계산됨), 그 기준(totalSteps)을 그대로 "AI 추정 있음" 판정에 쓴다 — 개별
    // 지표마다 gait_metrics_json을 파싱할 필요가 없다.
    const hasEstimate = row.totalSteps >= 2
    const groundTruth = safeParseArray<GaitGroundTruthJsonEntry>(row.groundTruthJson)
    const gtById = new Map(groundTruth.map((g) => [g.id, g.verifiedValue]))
    for (const def of GAIT_ITEM_LABELS) {
      const stat = gaitItemStats.get(def.id)!
      if (hasEstimate) stat.withEstimate += 1
      const gtValue = gtById.get(def.id)
      if (gtValue !== undefined && gtValue !== null) stat.withGroundTruth += 1
    }
  }
  const gaitItems: DataQualityItemStat[] = [...gaitItemStats.entries()].map(([id, s]) => ({ id, ...s }))

  // 발가락 마디별 시뮬레이션 보정 현황 — ROM/보행과 달리 별도 ground-truth 컬럼이
  // 없고, FootManualToeInput 안의 estimatedBeforeValue/estimatedAfterValue(AI가 처음에
  // 낸 시뮬레이션 값, 영구 보존)와 현재 beforeValue/afterValue(트레이너가 고쳤으면 그
  // 값)를 비교해서 "얼마나 벗어났는지" 자체를 이 자리에서 직접 계산한다(handfoot/types.ts
  // 참고). withGroundTruth는 여기서는 "트레이너가 실제로 확인/수정한 기록 수"를 뜻한다.
  const footItemStats = new Map(
    FOOT_ITEM_LABELS.map((d) => [
      d.id,
      { label: d.label, unit: d.unit, withEstimate: 0, withGroundTruth: 0, absDiffs: [] as number[] },
    ]),
  )
  const footRows = listFootToeSimCalibrationData()
  for (const row of footRows) {
    const entries = safeParseArray<FootManualToeJsonEntry>(row.manualToeInputsJson)
    for (const e of entries) {
      if (typeof e.id !== 'string') continue
      const stat = footItemStats.get(e.id)
      if (!stat) continue

      const estBefore = typeof e.estimatedBeforeValue === 'number' ? e.estimatedBeforeValue : null
      const estAfter = typeof e.estimatedAfterValue === 'number' ? e.estimatedAfterValue : null
      if (estBefore !== null || estAfter !== null) stat.withEstimate += 1

      if (e.source === 'trainer') {
        stat.withGroundTruth += 1
        const curBefore = typeof e.beforeValue === 'number' ? e.beforeValue : null
        const curAfter = typeof e.afterValue === 'number' ? e.afterValue : null
        if (curBefore !== null && estBefore !== null) stat.absDiffs.push(Math.abs(curBefore - estBefore))
        if (curAfter !== null && estAfter !== null) stat.absDiffs.push(Math.abs(curAfter - estAfter))
      }
    }
  }
  const footItems: DataQualityItemStat[] = [...footItemStats.entries()]
    .map(([id, s]) => ({
      id,
      label: s.label,
      unit: s.unit,
      withEstimate: s.withEstimate,
      withGroundTruth: s.withGroundTruth,
      avgAbsCorrectionDeg:
        s.absDiffs.length > 0 ? Number((s.absDiffs.reduce((a, b) => a + b, 0) / s.absDiffs.length).toFixed(2)) : null,
    }))
    .sort((a, b) => b.withEstimate - a.withEstimate)

  const rom: DataQualityFeatureSummary = {
    totalRecords: romRows.length,
    byCalcVersion: buildVersionCounts(romRows.map((r) => r.calcVersion)),
    items: romItems,
  }
  const gait: DataQualityFeatureSummary = {
    totalRecords: gaitRows.length,
    byCalcVersion: buildVersionCounts(gaitRows.map((r) => r.calcVersion)),
    items: gaitItems,
  }
  const foot: DataQualityFeatureSummary = {
    totalRecords: footRows.length,
    byCalcVersion: buildVersionCounts(footRows.map((r) => r.calcVersion)),
    items: footItems,
  }

  // 손가락 관절 14개(양손) AI 계산 vs 트레이너 실측 수집 현황 — ROM과 같은 방식
  // (별도 ground-truth 컬럼과 짝지어 집계)이지만, 관절 키가 왼손/오른손에 공통이라
  // id 앞에 side를 붙여 구분한다(HandJointGroundTruth 주석 참고).
  const handItemStats = new Map<string, { label: string; unit: string; withEstimate: number; withGroundTruth: number }>()
  const handRows = listHandGroundTruthData()
  for (const row of handRows) {
    const groundTruth = safeParseArray<HandGroundTruthJsonEntry>(row.handGroundTruthJson)
    const gtById = new Map(groundTruth.map((g) => [g.id, g.verifiedValue]))
    for (const side of HAND_SIDE_LABELS) {
      const results = safeParseArray<HandJointResultJsonEntry>(
        side.key === 'left' ? row.leftResultsJson : row.rightResultsJson,
      )
      for (const r of results) {
        if (typeof r.joint !== 'string') continue
        const id = `${side.key}_${r.joint}`
        if (!handItemStats.has(id)) {
          handItemStats.set(id, {
            label: `${side.label} ${typeof r.label === 'string' ? r.label : r.joint}`,
            unit: '도',
            withEstimate: 0,
            withGroundTruth: 0,
          })
        }
        const stat = handItemStats.get(id)!
        if (r.beforeRomDeg !== null || r.afterRomDeg !== null) stat.withEstimate += 1
        const gtValue = gtById.get(id)
        if (gtValue !== undefined && gtValue !== null) stat.withGroundTruth += 1
      }
    }
  }
  const handItems: DataQualityItemStat[] = [...handItemStats.entries()]
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.withEstimate - a.withEstimate)
  const hand: DataQualityFeatureSummary = {
    totalRecords: handRows.length,
    byCalcVersion: buildVersionCounts(handRows.map((r) => r.calcVersion)),
    items: handItems,
  }

  const summary: DataQualitySummary = { rom, gait, foot, hand }
  res.json(summary)
})
