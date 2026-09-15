import { Router, type Request, type Response } from 'express'
import { checkPassword, clearLoginAttempts, isLoginRateLimited, issueToken, recordFailedLogin } from '../xmskAuth.js'

export const authRouter = Router()

// 보행/ROM/손발/XMSK 4개 탭이 공용으로 쓰는 로그인 엔드포인트(2026-09 보안 점검으로
// 추가). 기존 POST /api/xmsk/auth는 하위 호환을 위해 그대로 남겨뒀고, 같은
// xmskAuth.ts 함수(checkPassword/issueToken)를 쓰므로 비밀번호도 토큰도 완전히
// 동일하다 — 어느 쪽으로 로그인해도 같은 토큰으로 4개 탭 모두 이용할 수 있다.
authRouter.post('/login', (req: Request, res: Response) => {
  if (isLoginRateLimited(req)) {
    res.status(429).json({ error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' })
    return
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!password || !checkPassword(password)) {
    recordFailedLogin(req)
    res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' })
    return
  }
  clearLoginAttempts(req)
  res.json({ token: issueToken() })
})
