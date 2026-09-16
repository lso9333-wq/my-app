import type {
  EegSessionCreateRequest,
  EegSessionCreateResponse,
  EegSessionDetail,
  EegSessionListItem,
} from '../../../shared/lib/eeg/types'
import { authHeaders, expectNoContentAuthAware, parseAuthAwareJson } from '../../../shared/lib/authApi'

const BASE = '/api/eeg-sessions'

// XCTS와 같은 이유로 앱 전체 로그인을 그대로 쓴다(App.tsx의 GATED_TABS, server/xmskAuth.ts의
// requireAuth 참고) — 2026-09, EEG에 회원별 기록 저장 기능이 추가되며 XCTS와 같은 이유로
// 로그인 필요 탭으로 옮겨졌다.

export async function createEegSession(
  token: string,
  req: EegSessionCreateRequest,
): Promise<EegSessionCreateResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listEegSessions(token: string, limit = 50): Promise<EegSessionListItem[]> {
  const res = await fetch(`${BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ sessions: EegSessionListItem[] }>(res)
  return data.sessions
}

export async function getEegSession(token: string, id: number): Promise<EegSessionDetail> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders(token) })
  return parseAuthAwareJson(res)
}

export async function deleteEegSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}
