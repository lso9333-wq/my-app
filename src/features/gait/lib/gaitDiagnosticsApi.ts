import type { GaitDiagnosticCreateRequest, GaitDiagnosticRecord, GaitGroundTruth } from '../types'
import { authHeaders, expectNoContentAuthAware, parseAuthAwareJson } from '../../../shared/lib/authApi'

const BASE = '/api/gait-diagnostics'

// 2026-09 보안 점검 이후 이 API 전체가 인증을 요구한다(server/xmskAuth.ts의
// requireAuth 주석 참고) — 모든 함수가 token을 받아 Authorization 헤더로 보내고,
// 401 응답은 AuthError로 통일해서 던진다(GaitApp.tsx/GaitDiagnosticsHistory.tsx가
// 이를 잡아 다시 잠금 화면으로 돌려보낸다).

export async function saveGaitDiagnostic(
  token: string,
  req: GaitDiagnosticCreateRequest,
): Promise<{ id: number; createdAt: string }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listGaitDiagnostics(
  token: string,
  search?: string,
  limit = 50,
): Promise<GaitDiagnosticRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (search && search.trim()) params.set('search', search.trim())
  const res = await fetch(`${BASE}?${params.toString()}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ records: GaitDiagnosticRecord[] }>(res)
  return data.records
}

/**
 * AI 추정 지표(케이던스, 좌우 대칭성, 전도 위험 점수) 옆에 트레이너가 실측한 값을
 * 갱신한다. ROM의 updateRomSessionGroundTruth와 같은 목적 — 분석 당일이 아니라 나중에
 * 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많으므로 별도 갱신 엔드포인트를 쓴다.
 */
export async function updateGaitDiagnosticGroundTruth(
  token: string,
  id: number,
  groundTruth: GaitGroundTruth[],
): Promise<void> {
  const res = await fetch(`${BASE}/${id}/ground-truth`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ groundTruth }),
  })
  return expectNoContentAuthAware(res)
}

export async function deleteGaitDiagnostic(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}
