import type {
  RomSessionCreateRequest,
  RomSessionCreateResponse,
  RomSessionDetail,
  RomSessionListItem,
} from '../types/rom'

const BASE = '/api/rom-sessions'

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function createRomSession(
  req: RomSessionCreateRequest,
): Promise<RomSessionCreateResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return parseOrThrow(res)
}

export async function listRomSessions(limit = 50): Promise<RomSessionListItem[]> {
  const res = await fetch(`${BASE}?limit=${limit}`)
  const data = await parseOrThrow<{ sessions: RomSessionListItem[] }>(res)
  return data.sessions
}

export async function getRomSession(id: number): Promise<RomSessionDetail> {
  const res = await fetch(`${BASE}/${id}`)
  return parseOrThrow(res)
}
