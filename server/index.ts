import express from 'express'
import path from 'node:path'
import { gaitDiagnosticsRouter } from './routes/gaitDiagnostics.js'
import { romSessionsRouter } from './routes/romSessions.js'
import { handSessionsRouter } from './routes/handSessions.js'
import { footSessionsRouter } from './routes/footSessions.js'
import { xmskRouter } from './routes/xmsk.js'
import { authRouter } from './routes/auth.js'
import { xctsSessionsRouter } from './routes/xctsSessions.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist')

const app = express()
// Caddy(Caddyfile)가 리버스 프록시로 앞단에 있어서, 로그인 속도 제한(xmskAuth.ts의
// isLoginRateLimited)이 IP별로 정확히 동작하려면 Caddy가 붙여주는
// X-Forwarded-For 헤더를 express가 실제 클라이언트 IP로 신뢰해야 한다(신뢰하는 홉을
// 1개로 제한 — Caddy 딱 한 겹만 앞에 있으므로).
app.set('trust proxy', 1)
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/rom-sessions', romSessionsRouter)
app.use('/api/hand-sessions', handSessionsRouter)
app.use('/api/foot-sessions', footSessionsRouter)
app.use('/api/xmsk', xmskRouter)
app.use('/api/gait-diagnostics', gaitDiagnosticsRouter)
app.use('/api/xcts-sessions', xctsSessionsRouter)

app.use(express.static(DIST_DIR))
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).end()
  })
})

app.listen(PORT, () => {
  console.log(`ROM API listening on :${PORT}`)
})
