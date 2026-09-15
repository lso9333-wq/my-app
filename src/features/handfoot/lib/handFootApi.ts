import type {
  EegHandFootContext,
  FootManualToeInput,
  FootSessionCreateRequest,
  FootSessionCreateResponse,
  FootSessionDetail,
  FootSessionListItem,
  HandJointGroundTruth,
  HandSessionCreateRequest,
  HandSessionCreateResponse,
  HandSessionDetail,
  HandSessionListItem,
} from '../types'
import { authHeaders, expectNoContentAuthAware, parseAuthAwareJson } from '../../../shared/lib/authApi'

const HAND_BASE = '/api/hand-sessions'
const FOOT_BASE = '/api/foot-sessions'

// 2026-09 보안 점검 이후 이 API 전체(손·발 둘 다)가 인증을 요구한다
// (server/xmskAuth.ts의 requireAuth 주석 참고).

export async function createHandSession(
  token: string,
  req: HandSessionCreateRequest,
): Promise<HandSessionCreateResponse> {
  const res = await fetch(HAND_BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listHandSessions(token: string, limit = 50): Promise<HandSessionListItem[]> {
  const res = await fetch(`${HAND_BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ sessions: HandSessionListItem[] }>(res)
  return data.sessions
}

export async function getHandSession(token: string, id: number): Promise<HandSessionDetail> {
  const res = await fetch(`${HAND_BASE}/${id}`, { headers: authHeaders(token) })
  return parseAuthAwareJson(res)
}

export async function deleteHandSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${HAND_BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}

/** 동시 측정 뇌파 컨텍스트를 갱신한다 — "활동(분석 직후)" 캡처는 분석 직후 자동
 * 저장(POST)이 이미 끝난 뒤에야 이뤄지는 경우가 많으므로(트레이너가 분석 결과를 보고
 * 나서 캡처하는 흐름), ROM/발 수기 입력과 같은 이유로 별도 PUT으로 이미 저장된
 * 세션을 갱신한다. */
export async function updateHandSessionEegContext(
  token: string,
  id: number,
  eegContext: EegHandFootContext,
): Promise<void> {
  const res = await fetch(`${HAND_BASE}/${id}/eeg-context`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ eegContext }),
  })
  return expectNoContentAuthAware(res)
}

/**
 * 손가락 관절 14개(양손)에 대해 트레이너가 실제로 관찰·측정한 값(HandJointGroundTruth)을
 * 갱신한다. ROM의 updateRomSessionGroundTruth와 같은 이유·같은 방식 — 분석 직후뿐
 * 아니라 나중에 저장된 기록을 다시 열어서도 입력할 수 있도록 기록 상세 화면에서도
 * 호출한다.
 */
export async function updateHandSessionGroundTruth(
  token: string,
  id: number,
  handGroundTruth: HandJointGroundTruth[],
): Promise<void> {
  const res = await fetch(`${HAND_BASE}/${id}/ground-truth`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ handGroundTruth }),
  })
  return expectNoContentAuthAware(res)
}

export async function createFootSession(
  token: string,
  req: FootSessionCreateRequest,
): Promise<FootSessionCreateResponse> {
  const res = await fetch(FOOT_BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  })
  return parseAuthAwareJson(res)
}

export async function listFootSessions(token: string, limit = 50): Promise<FootSessionListItem[]> {
  const res = await fetch(`${FOOT_BASE}?limit=${limit}`, { headers: authHeaders(token) })
  const data = await parseAuthAwareJson<{ sessions: FootSessionListItem[] }>(res)
  return data.sessions
}

export async function getFootSession(token: string, id: number): Promise<FootSessionDetail> {
  const res = await fetch(`${FOOT_BASE}/${id}`, { headers: authHeaders(token) })
  return parseAuthAwareJson(res)
}

/** 발가락 10마디(양발 20개) 수기 입력값을 갱신한다 — AI가 개별 발가락을 구분하지
 * 못해 전부 트레이너 입력이므로, ROM의 manual-inputs 엔드포인트와 같은 이유로 분석
 * 직후 자동 저장(POST) 이후 별도 PUT으로 갱신한다. */
export async function updateFootSessionManualToeInputs(
  token: string,
  id: number,
  manualToeInputs: FootManualToeInput[],
): Promise<void> {
  const res = await fetch(`${FOOT_BASE}/${id}/manual-toe-inputs`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ manualToeInputs }),
  })
  return expectNoContentAuthAware(res)
}

export async function deleteFootSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${FOOT_BASE}/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  return expectNoContentAuthAware(res)
}

/** 동시 측정 뇌파 컨텍스트 갱신 — updateHandSessionEegContext와 같은 이유. */
export async function updateFootSessionEegContext(
  token: string,
  id: number,
  eegContext: EegHandFootContext,
): Promise<void> {
  const res = await fetch(`${FOOT_BASE}/${id}/eeg-context`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ eegContext }),
  })
  return expectNoContentAuthAware(res)
}
