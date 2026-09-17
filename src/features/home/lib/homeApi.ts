import { authHeaders, parseAuthAwareJson } from '../../../shared/lib/authApi'

export type HealthMetricType = 'bp_systolic' | 'bp_diastolic' | 'glucose_fasting' | 'weight'

export interface RecentActivityItem {
  type: string
  label: string
  clientName: string | null
  createdAt: string
}

export async function saveHealthMetric(token: string, metricType: HealthMetricType, value: number): Promise<void> {
  const res = await fetch('/api/home-summary/metrics', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ metricType, value }),
  })
  await parseAuthAwareJson(res)
}

export async function fetchRecentActivity(token: string): Promise<RecentActivityItem[]> {
  const res = await fetch('/api/home-summary/recent-activity', { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ items: RecentActivityItem[] }>(res)
  return data.items
}
