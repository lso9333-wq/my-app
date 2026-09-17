import { Router, type Request, type Response } from 'express'
import {
  getLatestMetric,
  getRecentMetrics,
  getLatestCoachMessage,
  insertHealthMetric,
  listSessions,
  listXctsSessions,
  listGaitDiagnostics,
  listHandSessions,
  listFootSessions,
  listEegSessions,
} from '../db.js'
import { requireAuth } from '../xmskAuth.js'

export const homeSummaryRouter = Router()

homeSummaryRouter.get('/', (_req: Request, res: Response) => {
  const bpSystolic = getLatestMetric('bp_systolic')
  const bpDiastolic = getLatestMetric('bp_diastolic')
  const glucoseFasting = getLatestMetric('glucose_fasting')
  const weight = getLatestMetric('weight')

  const trendRows = getRecentMetrics('bp_systolic', 7).reverse()
  const trendPoints =
    trendRows.length > 0 ? trendRows.map((r) => r.value) : [120, 120, 120, 120, 120, 120, 120]

  const coach = getLatestCoachMessage()
  const coachMessage = coach ? coach.message : '오늘도 좋은 하루 보내세요.'

  res.json({
    userName: '회원',
    priorityMetric: {
      label: '혈압',
      value: bpSystolic && bpDiastolic ? `${bpSystolic.value}/${bpDiastolic.value}` : '기록 없음',
      unit: 'mmHg',
      trendPoints,
      coachComment: coachMessage,
    },
    secondaryMetrics: [
      {
        label: '공복혈당',
        value: glucoseFasting ? String(glucoseFasting.value) : '기록 없음',
        unit: 'mg/dL',
      },
      {
        label: '체중',
        value: weight ? String(weight.value) : '기록 없음',
        unit: 'kg',
      },
    ],
    coachName: '닥터메이트',
    coachMessage,
  })
})

const METRIC_TYPES = ['bp_systolic', 'bp_diastolic', 'glucose_fasting', 'weight'] as const
type MetricType = (typeof METRIC_TYPES)[number]

function isMetricType(v: unknown): v is MetricType {
  return typeof v === 'string' && (METRIC_TYPES as readonly string[]).includes(v)
}

/**
 * 홈 화면에서 본인이 혈압/혈당/체중을 직접 입력하는 엔드포인트. 2026-09 추가 —
 * 그전까지는 홈 화면이 health_metrics를 읽기만 했지 입력할 방법이 없었다. 회원
 * 이름이 담긴 세션 기록은 아니지만 그래도 개인 건강정보라, XCTS/EEG와 같은
 * 이유로 requireAuth를 건다.
 */
homeSummaryRouter.post('/metrics', requireAuth, (req: Request, res: Response) => {
  const { metricType, value } = req.body as { metricType?: unknown; value?: unknown }
  if (!isMetricType(metricType)) {
    res.status(400).json({ error: 'metricType이 올바르지 않습니다.' })
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    res.status(400).json({ error: 'value가 올바르지 않습니다.' })
    return
  }
  insertHealthMetric(metricType, value, 'manual')
  res.status(201).json({ ok: true })
})

/**
 * 홈 화면의 "최근 기록" 목록 — 보행/ROM/손발/XCTS/뇌파 세션에서 최근 항목을 모아
 * 보여준다. 회원 이름(clientName)이 그대로 들어가므로 반드시 requireAuth로 보호
 * 한다 — 2026-09 보안 점검에서 확인됐던 "로그인 없는 홈 화면에서 회원 이름이
 * 새는" 문제(xmskAuth.ts 주석 참고)를 다시 만들지 않기 위함.
 */
homeSummaryRouter.get('/recent-activity', requireAuth, (_req: Request, res: Response) => {
  const items: { type: string; label: string; clientName: string | null; createdAt: string }[] = []

  for (const row of listSessions(3)) {
    items.push({ type: 'rom', label: 'ROM', clientName: row.client_name || null, createdAt: row.created_at })
  }
  for (const row of listXctsSessions(3)) {
    items.push({ type: 'xcts', label: 'XCTS', clientName: row.client_name, createdAt: row.created_at })
  }
  for (const row of listGaitDiagnostics(3)) {
    items.push({ type: 'gait', label: '보행', clientName: row.client_name, createdAt: row.created_at })
  }
  for (const row of listHandSessions(3)) {
    items.push({ type: 'hand', label: '손', clientName: row.client_name, createdAt: row.created_at })
  }
  for (const row of listFootSessions(3)) {
    items.push({ type: 'foot', label: '발', clientName: row.client_name, createdAt: row.created_at })
  }
  for (const row of listEegSessions(3)) {
    items.push({ type: 'eeg', label: '뇌파', clientName: row.client_name, createdAt: row.created_at })
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  res.json({ items: items.slice(0, 8) })
})
