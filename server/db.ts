import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type {
  RomSessionCreateRequest,
  RomSessionRow,
  XmskEvaluationCreateRequest,
  XmskEvaluationRow,
  XmskSessionCreateRequest,
  XmskSessionRow,
} from './types.js'

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

db.exec(`
  CREATE TABLE IF NOT EXISTS xmsk_sessions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT NOT NULL,
    region            TEXT NOT NULL,
    red_flags_cleared INTEGER NOT NULL,
    note              TEXT,
    before_json       TEXT NOT NULL,
    after_json        TEXT NOT NULL
  )
`)

const insertXmskStmt = db.prepare(`
  INSERT INTO xmsk_sessions
    (created_at, region, red_flags_cleared, note, before_json, after_json)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const listXmskStmt = db.prepare(`
  SELECT id, created_at, region, red_flags_cleared, note, before_json, after_json
  FROM xmsk_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getXmskStmt = db.prepare(`
  SELECT id, created_at, region, red_flags_cleared, note, before_json, after_json
  FROM xmsk_sessions
  WHERE id = ?
`)

export function insertXmskSession(req: XmskSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertXmskStmt.run(
    createdAt,
    req.region,
    req.redFlagsCleared ? 1 : 0,
    req.note ?? null,
    JSON.stringify(req.before),
    JSON.stringify(req.after),
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listXmskSessions(limit: number): XmskSessionRow[] {
  return listXmskStmt.all(limit) as unknown as XmskSessionRow[]
}

export function getXmskSession(id: number): XmskSessionRow | undefined {
  return getXmskStmt.get(id) as unknown as XmskSessionRow | undefined
}

const deleteXmskStmt = db.prepare(`DELETE FROM xmsk_sessions WHERE id = ?`)

export function deleteXmskSession(id: number): boolean {
  return deleteXmskStmt.run(id).changes > 0
}

db.exec(`
  CREATE TABLE IF NOT EXISTS xmsk_evaluations (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at          TEXT NOT NULL,
    trainee_name        TEXT NOT NULL,
    evaluator_name      TEXT,
    evaluation_date     TEXT NOT NULL,
    scores_json         TEXT NOT NULL,
    required_pass_json  TEXT NOT NULL,
    comment             TEXT
  )
`)

const insertXmskEvalStmt = db.prepare(`
  INSERT INTO xmsk_evaluations
    (created_at, trainee_name, evaluator_name, evaluation_date, scores_json, required_pass_json, comment)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const listXmskEvalStmt = db.prepare(`
  SELECT id, created_at, trainee_name, evaluator_name, evaluation_date, scores_json, required_pass_json, comment
  FROM xmsk_evaluations
  ORDER BY id DESC
  LIMIT ?
`)

const getXmskEvalStmt = db.prepare(`
  SELECT id, created_at, trainee_name, evaluator_name, evaluation_date, scores_json, required_pass_json, comment
  FROM xmsk_evaluations
  WHERE id = ?
`)

export function insertXmskEvaluation(req: XmskEvaluationCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertXmskEvalStmt.run(
    createdAt,
    req.traineeName,
    req.evaluatorName ?? null,
    req.evaluationDate,
    JSON.stringify(req.scores),
    JSON.stringify(req.requiredPass),
    req.comment ?? null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listXmskEvaluations(limit: number): XmskEvaluationRow[] {
  return listXmskEvalStmt.all(limit) as unknown as XmskEvaluationRow[]
}

export function getXmskEvaluation(id: number): XmskEvaluationRow | undefined {
  return getXmskEvalStmt.get(id) as unknown as XmskEvaluationRow | undefined
}

const deleteXmskEvalStmt = db.prepare(`DELETE FROM xmsk_evaluations WHERE id = ?`)

export function deleteXmskEvaluation(id: number): boolean {
  return deleteXmskEvalStmt.run(id).changes > 0
}
