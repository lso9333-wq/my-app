import express from 'express'
import path from 'node:path'
import { authRouter } from './routes/auth.js'
import { eegSessionsRouter } from './routes/eegSessions.js'
import { footSessionsRouter } from './routes/footSessions.js'
import { gaitDiagnosticsRouter } from './routes/gaitDiagnostics.js'
import { handSessionsRouter } from './routes/handSessions.js'
import { homeSummaryRouter } from './routes/homeSummary.js'
import { romSessionsRouter } from './routes/romSessions.js'
import { xctsAgesIndexRouter } from './routes/xctsAgesIndex.js'
import { xctsSessionsRouter } from './routes/xctsSessions.js'
import { xmskRouter } from './routes/xmsk.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist')

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/rom-sessions', romSessionsRouter)
app.use('/api/xmsk', xmskRouter)
app.use('/api/gait-diagnostics', gaitDiagnosticsRouter)
app.use('/api/hand-sessions', handSessionsRouter)
app.use('/api/foot-sessions', footSessionsRouter)
app.use('/api/xcts-sessions', xctsSessionsRouter)
app.use('/api/xcts-ages-index', xctsAgesIndexRouter)
app.use('/api/eeg-sessions', eegSessionsRouter)
app.use('/api/home-summary', homeSummaryRouter)

app.use(express.static(DIST_DIR))
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).end()
  })
})

app.listen(PORT, () => {
  console.log(`ROM API listening on :${PORT}`)
})
