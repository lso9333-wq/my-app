import type {
  AgesIndexRecordListItem,
  AgesIndexUploadRequest,
  AgesIndexUploadResponse,
  XctsSessionCreateRequest,
  XctsSessionCreateResponse,
  XctsSessionDetail,
  XctsSessionListItem,
} from '../types'
import { authHeaders, expectNoContentAuthAware, parseAuthAwareJson } from '../../../shared/lib/authApi'

const BASE = '/api/xcts-sessions'
const AGES_INDEX_BASE = '/api/xcts-ages-index'

// 다른 4개 트레이너 도구(보행/ROM/손발/XMSK)와 같은 앱 전체 로그인을 그대로 쓴다
// (App.tsx의 GATED_TABS, server/xmskAuth.ts의 requireAuth 참고) — XCTS만 별도
// 비밀번호를 새로 만들지 않는다. CLAUDE.md "앱 전체 인증" 절의 이유(트레이너 도구마다
// 다른 비밀번호를 두는 건 불편하고 코드도 늘어남)가 XCTS에도 그대로 적용된다.

export async function createXctsSession(
  token: string,
  req: XctsSessionCreateRequest,
): Promise<XctsSessionCreateResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listXctsSessions(token: string, limit = 50): Promise<XctsSessionListItem[]> {
  const res = await fetch(`${BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ sessions: XctsSessionListItem[] }>(res)
  return data.sessions
}

export async function getXctsSession(token: string, id: number): Promise<XctsSessionDetail> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders(token) })
  return parseAuthAwareJson(res)
}

export async function deleteXctsSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}

// --- 최종당화산물지수(AGEs Index) — xcts_sessions와 별도 저장소(types.ts 참고). ---

export async function uploadAgesIndexRecords(
  token: string,
  req: AgesIndexUploadRequest,
): Promise<AgesIndexUploadResponse> {
  const res = await fetch(AGES_INDEX_BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listAgesIndexRecords(token: string, limit = 100): Promise<AgesIndexRecordListItem[]> {
  const res = await fetch(`${AGES_INDEX_BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ records: AgesIndexRecordListItem[] }>(res)
  return data.records
}

export async function deleteAgesIndexRecord(token: string, id: number): Promise<void> {
  const res = await fetch(`${AGES_INDEX_BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}
