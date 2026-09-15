// 보행/ROM/손발/XMSK 4개 탭이 공용으로 쓰는 인증 클라이언트.
//
// 2026-09 보안 점검에서 보행/ROM/손발 API에 인증이 전혀 없다는 게 확인돼(server/xmskAuth.ts
// 주석 참고), XMSK가 이미 쓰고 있던 비밀번호/토큰 방식(xmsk/lib/xmskApi.ts)을 그대로
// 재사용하되, 4개 기능이 다 같이 가져다 쓸 수 있게 shared 아래로 일반화해 새로 뺐다.
// 이 프로젝트는 기능(feature)끼리 서로의 lib/components를 import하지 않는 관례가
// 있어서(예외는 HomeScreen→rom 하나뿐 — CLAUDE.md 참고) xmsk/lib/xmskApi.ts를 gait/rom/
// handfoot이 그대로 가져다 쓰는 대신 이렇게 별도로 둔다.
//
// 토큰 저장 키('xmsk_token')는 이름은 예전 그대로지만 하위 호환을 위해 유지한다 — 이미
// XMSK에 로그인해서 이 키로 토큰이 저장돼 있는 사용자가 업데이트 후 앱을 열자마자 다시
// 로그인하지 않아도 되게 하기 위해서다(어차피 서버의 같은 비밀번호/시크릿으로 발급된
// 같은 형식의 토큰이라 그대로 재사용해도 안전하다).
const TOKEN_STORAGE_KEY = 'xmsk_token'

export class AuthError extends Error {}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // 시크릿 모드 등 localStorage를 쓸 수 없는 환경이면 이번 화면을 새로고침할 때
    // 다시 로그인해야 하는 정도의 불편일 뿐이라 조용히 무시한다.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // 위와 같은 이유로 무시.
  }
}

export function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/** 비밀번호로 로그인해 토큰을 발급받는다. 서버의 POST /api/auth/login(신규, 로그인
 * 시도 속도 제한 적용)을 쓴다 — 기존 POST /api/xmsk/auth는 하위 호환을 위해 남아있지만
 * 새 코드는 전부 이 함수를 쓴다. */
export async function login(password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) throw new Error('비밀번호가 올바르지 않습니다.')
  if (res.status === 429) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `로그인에 실패했습니다 (${res.status})`)
  }
  const data = (await res.json()) as { token: string }
  return data.token
}

/** 401 응답을 AuthError로 통일해서 던진다 — gaitDiagnosticsApi/romApi/handFootApi가
 * 공통으로 쓰며, 각 기능의 History 컴포넌트는 AuthError를 잡아 다시 잠금 화면으로
 * 돌려보낸다(xmsk의 onAuthError 패턴과 동일). */
export async function parseAuthAwareJson<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new AuthError('인증이 만료되었습니다. 다시 잠금 해제해 주세요.')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function expectNoContentAuthAware(res: Response): Promise<void> {
  if (res.status === 401) throw new AuthError('인증이 만료되었습니다. 다시 잠금 해제해 주세요.')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `요청이 실패했습니다 (${res.status})`)
  }
}
