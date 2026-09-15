import { Router, type Request, type Response } from 'express'
import {
  getLatestMetric,
  getRecentMetrics,
  getLatestCoachMessage,
} from '../db.js'

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
