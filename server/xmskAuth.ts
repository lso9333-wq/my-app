import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const SECRET = process.env.XMSK_SECRET ?? 'foreSTRETCH-xmsk-dev-secret'
const PASSWORD = process.env.XMSK_PASSWORD ?? 'forestretch1'
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function checkPassword(password: string): boolean {
  const given = Buffer.from(password)
  const expected = Buffer.from(PASSWORD)
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export function issueToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })
  const encoded = Buffer.from(payload).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return false
  if (sig !== sign(encoded)) return false
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { exp: number }
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

/**
 * 앱 전체(로그인 뒤 보행/ROM/손발/XMSK 4개 탭)가 공유하는 인증 미들웨어.
 *
 * 2026-09 보안 점검(사용자 질문 "지금까지 작업에 대한 보안은 철저하게 되는거야?")에서
 * 발견: 이 함수는 원래 routes/xmsk.ts 안에 로컬 함수로만 있어서 XMSK 라우터에만
 * 적용돼 있었다. 반면 보행(gait-diagnostics)/ROM(rom-sessions)/손발(hand-sessions,
 * foot-sessions) API는 인증이 전혀 없어서 누구나(비밀번호 없이) 회원 이름이 담긴
 * 기록을 만들고, 목록을 읽고, 지울 수 있는 상태였다 — 특히 HomeScreen.tsx가 홈
 * 화면(로그인 전에도 보이는 화면)에서 최근 ROM 기록 3건을 미리보기로 가져오면서
 * 서버가 clientName까지 포함해 그대로 응답해, 로그인하지 않은 누구나 개발자 도구의
 * 네트워크 탭으로 회원 이름을 볼 수 있는 실제 노출 경로까지 확인됐다(화면에는
 * videoName만 보이지만 응답 JSON 자체엔 clientName이 들어있었음).
 *
 * 그래서 이 미들웨어를 여기(xmskAuth.ts)로 옮겨 4개 라우터가 전부 가져다 쓰도록
 * 했다 — XMSK가 원래 쓰던 비밀번호/토큰 방식을 그대로 재사용하는 것이라 사용자
 * 입장에서는 로그인이 하나로 통합된다(비밀번호 한 번 입력하면 4개 탭 모두 풀림).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!verifyToken(token)) {
    res.status(401).json({ error: '인증이 필요합니다.' })
    return
  }
  next()
}

// --- 로그인 시도 속도 제한 (무차별 대입 비밀번호 추측 방어) ---
//
// 이전에는 로그인 엔드포인트(POST /api/xmsk/auth)에 시도 횟수 제한이 전혀 없어서,
// 스크립트로 비밀번호를 무한정 계속 추측해볼 수 있었다. 이 프로젝트는 "테스트
// 러너도 없이 의존성을 최소로 유지"하는 방침(CLAUDE.md)이라 express-rate-limit 같은
// 새 npm 패키지를 추가하는 대신, 메모리 안에서 IP별 실패 횟수만 간단히 세는 방식으로
// 직접 구현했다. 개인용 앱 규모(동시 접속자 소수)를 감안하면, 서버 재시작 시
// 초기화되거나 여러 서버 인스턴스 간에 공유되지 않는다는 한계는 감수할 만하다고
// 판단했다 — 목적은 완벽한 방어가 아니라 "초당 수백 번씩 비밀번호를 찔러보는" 가장
// 흔한 형태의 무차별 대입을 막는 것.
const LOGIN_ATTEMPT_LIMIT = 8
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000 // 10분 안에 8회 틀리면 잠시 차단
const loginAttempts = new Map<string, { count: number; windowStart: number }>()

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown'
}

export function isLoginRateLimited(req: Request): boolean {
  const entry = loginAttempts.get(clientIp(req))
  if (!entry) return false
  if (Date.now() - entry.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(clientIp(req))
    return false
  }
  return entry.count >= LOGIN_ATTEMPT_LIMIT
}

export function recordFailedLogin(req: Request): void {
  const ip = clientIp(req)
  const entry = loginAttempts.get(ip)
  const now = Date.now()
  if (!entry || now - entry.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now })
    return
  }
  entry.count += 1
}

export function clearLoginAttempts(req: Request): void {
  loginAttempts.delete(clientIp(req))
}
