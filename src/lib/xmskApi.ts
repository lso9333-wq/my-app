import type {
  XmskAuthResponse,
  XmskSessionCreateRequest,
  XmskSessionCreateResponse,
  XmskSessionDetail,
  XmskSessionListItem,
} from '../types/xmsk'

const BASE = '/api/xmsk'

export class XmskAuthError extends Error {}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new XmskAuthError('인증이 만료되었습니다. 다시 잠금 해제해 주세요.')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`)
  }
  return res.json() as Promise<T>
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function xmskAuth(password: string): Promise<XmskAuthResponse> {
  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) throw new Error('비밀번호가 올바르지 않습니다.')
  return parseOrThrow(res)
}

export async function createXmskSession(
  token: string,
  req: XmskSessionCreateRequest,
): Promise<XmskSessionCreateResponse> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseOrThrow(res)
}

export async function listXmskSessions(token: string, limit = 50): Promise<XmskSessionListItem[]> {
  const res = await fetch(`${BASE}/sessions?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseOrThrow<{ sessions: XmskSessionListItem[] }>(res)
  return data.sessions
}

export async function getXmskSession(token: string, id: number): Promise<XmskSessionDetail> {
  const res = await fetch(`${BASE}/sessions/${id}`, { headers: authHeaders(token) })
  return parseOrThrow(res)
}
