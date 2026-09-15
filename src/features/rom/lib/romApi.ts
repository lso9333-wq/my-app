import type {
  RomSessionCreateRequest,
  RomSessionCreateResponse,
  RomSessionDetail,
  RomSessionListItem,
  RomXmskGroundTruth,
  RomXmskManualInput,
} from '../types'
import { authHeaders, expectNoContentAuthAware, parseAuthAwareJson } from '../../../shared/lib/authApi'

const BASE = '/api/rom-sessions'

// 2026-09 보안 점검 이후 이 API 전체가 인증을 요구한다(server/xmskAuth.ts의
// requireAuth 주석 참고). HomeScreen.tsx의 최근 기록 미리보기는 로그인 전에도 보이는
// 화면이라 listRomSessions를 아예 호출하지 않도록 별도로 고쳤다(HomeScreen.tsx 참고).

export async function createRomSession(
  token: string,
  req: RomSessionCreateRequest,
): Promise<RomSessionCreateResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listRomSessions(token: string, limit = 50): Promise<RomSessionListItem[]> {
  const res = await fetch(`${BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ sessions: RomSessionListItem[] }>(res)
  return data.sessions
}

export async function getRomSession(token: string, id: number): Promise<RomSessionDetail> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders(token) })
  return parseAuthAwareJson(res)
}

/**
 * 손목 저항 검사처럼 트레이너가 직접 입력하는 항목은 분석 직후 자동 저장(POST)이
 * 끝난 다음에야 값이 채워지므로, 별도의 PUT으로 이미 저장된 세션에 갱신한다.
 */
export async function updateRomSessionManualInputs(
  token: string,
  id: number,
  xmskManualInputs: RomXmskManualInput[],
): Promise<void> {
  const res = await fetch(`${BASE}/${id}/manual-inputs`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ xmskManualInputs }),
  })
  return expectNoContentAuthAware(res)
}

/**
 * AI 추정값 옆에 트레이너가 실측한 값(RomXmskGroundTruth)을 갱신한다. 손목 저항
 * 검사 같은 수기 입력(updateRomSessionManualInputs)과는 별개의 엔드포인트다 — 이건
 * "AI 추정이 있는 항목"에 대한 검증값이고, 분석 직후뿐 아니라 나중에 저장된 기록을
 * 다시 열어서도 입력할 수 있도록(트레이너가 실제로 관찰할 시간이 필요하므로) 기록
 * 상세 화면에서도 호출한다.
 */
export async function updateRomSessionGroundTruth(
  token: string,
  id: number,
  xmskGroundTruth: RomXmskGroundTruth[],
): Promise<void> {
  const res = await fetch(`${BASE}/${id}/ground-truth`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ xmskGroundTruth }),
  })
  return expectNoContentAuthAware(res)
}

export async function deleteRomSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}
