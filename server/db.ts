import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { RomSessionCreateRequest, RomSessionRow } from './types.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const DB_PATH = path.join(DATA_DIR, 'rom.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS stretch_sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT NOT NULL,
    video_name        TEXT NOT NULL,
    before_start_sec  REAL NOT NULL,
    before_end_sec    REAL NOT NULL,
    after_start_sec   REAL NOT NULL,
    after_end_sec     REAL NOT NULL,
    results_json      TEXT NOT NULL
  )
`)

const insertStmt = db.prepare(`
  INSERT INTO stretch_sessions
    (created_at, video_name, before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const listStmt = db.prepare(`
  SELECT id, created_at, video_name, before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json
  FROM stretch_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getStmt = db.prepare(`
  SELECT id, created_at, video_name, before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json
  FROM stretch_sessions
  WHERE id = ?
`)

export function insertSession(req: RomSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertStmt.run(
    createdAt,
    req.videoName,
    req.beforeStartSec,
    req.beforeEndSec,
    req.afterStartSec,
    req.afterEndSec,
    JSON.stringify(req.results),
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listSessions(limit: number): RomSessionRow[] {
  return listStmt.all(limit) as unknown as RomSessionRow[]
}

export function getSession(id: number): RomSessionRow | undefined {
  return getStmt.get(id) as unknown as RomSessionRow | undefined
}
