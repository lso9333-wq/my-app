import express from 'express'
import path from 'node:path'
import { romSessionsRouter } from './routes/romSessions.js'
import { xmskRouter } from './routes/xmsk.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist')

const app = express()
app.use(express.json())
app.use('/api/rom-sessions', romSessionsRouter)
app.use('/api/xmsk', xmskRouter)

app.use(express.static(DIST_DIR))
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).end()
  })
})

app.listen(PORT, () => {
  console.log(`ROM API listening on :${PORT}`)
})
