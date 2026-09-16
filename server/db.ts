import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type {
  EegSessionCreateRequest,
  EegSessionRow,
  FootSessionCreateRequest,
  FootSessionRow,
  GaitDiagnosticCreateRequest,
  GaitDiagnosticRow,
  HandSessionCreateRequest,
  HandSessionRow,
  RomSessionCreateRequest,
  RomSessionRow,
  XctsSessionCreateRequest,
  XctsSessionRow,
  XmskEvaluationCreateRequest,
  XmskEvaluationRow,
  XmskSessionCreateRequest,
  XmskSessionRow,
} from './types.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const DB_PATH = path.join(DATA_DIR, 'rom.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)

// ============================================================
// ROM 세션 (stretch_sessions)
// ============================================================

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

// clientName/trainerName, xmsk 추정치·수기입력·실측값, calcVersion — romSessions.ts가
// 2026-09 보안 점검 이후로 요구하는 컬럼들. 예전에 ground_truth_json/manual_inputs_json
// 이름으로 잘못 추가된 컬럼이 남아있을 수 있으나 더 이상 쓰지 않는다(무해하게 방치).
function addColumnIfMissing(table: string, columnDef: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`)
  } catch {
    // 컬럼이 이미 있으면 무시
  }
}

addColumnIfMissing('stretch_sessions', `client_name TEXT NOT NULL DEFAULT ''`)
addColumnIfMissing('stretch_sessions', `trainer_name TEXT`)
addColumnIfMissing('stretch_sessions', `xmsk_estimates_json TEXT NOT NULL DEFAULT '[]'`)
addColumnIfMissing('stretch_sessions', `xmsk_manual_inputs_json TEXT NOT NULL DEFAULT '[]'`)
addColumnIfMissing('stretch_sessions', `xmsk_ground_truth_json TEXT NOT NULL DEFAULT '[]'`)
addColumnIfMissing('stretch_sessions', `calc_version TEXT`)

const insertStmt = db.prepare(`
  INSERT INTO stretch_sessions
    (created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
     after_start_sec, after_end_sec, results_json, xmsk_estimates_json, xmsk_manual_inputs_json,
     xmsk_ground_truth_json, calc_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const ROM_SELECT_COLUMNS = `
  id, created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
  after_start_sec, after_end_sec, results_json, xmsk_estimates_json, xmsk_manual_inputs_json,
  xmsk_ground_truth_json, calc_version
`

const listStmt = db.prepare(`
  SELECT ${ROM_SELECT_COLUMNS}
  FROM stretch_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getStmt = db.prepare(`
  SELECT ${ROM_SELECT_COLUMNS}
  FROM stretch_sessions
  WHERE id = ?
`)

export function insertSession(req: RomSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertStmt.run(
    createdAt,
    req.videoName,
    req.clientName,
    req.trainerName ?? null,
    req.beforeStartSec,
    req.beforeEndSec,
    req.afterStartSec,
    req.afterEndSec,
    JSON.stringify(req.results),
    JSON.stringify(req.xmskEstimates ?? []),
    JSON.stringify(req.xmskManualInputs ?? []),
    JSON.stringify(req.xmskGroundTruth ?? []),
    req.calcVersion ?? null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listSessions(limit: number): RomSessionRow[] {
  return listStmt.all(limit) as unknown as RomSessionRow[]
}

export function getSession(id: number): RomSessionRow | undefined {
  return getStmt.get(id) as unknown as RomSessionRow | undefined
}

const deleteSessionStmt = db.prepare(`DELETE FROM stretch_sessions WHERE id = ?`)
const updateGroundTruthStmt = db.prepare(`UPDATE stretch_sessions SET xmsk_ground_truth_json = ? WHERE id = ?`)
const updateManualInputsStmt = db.prepare(`UPDATE stretch_sessions SET xmsk_manual_inputs_json = ? WHERE id = ?`)

export function deleteSession(id: number): boolean {
  return Number(deleteSessionStmt.run(id).changes) > 0
}

export function updateSessionGroundTruth(id: number, groundTruthJson: string): void {
  updateGroundTruthStmt.run(groundTruthJson, id)
}

export function updateSessionManualInputs(id: number, manualInputsJson: string): void {
  updateManualInputsStmt.run(manualInputsJson, id)
}

// ============================================================
// XMSK 세션 (xmsk_sessions)
// ============================================================

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

addColumnIfMissing('xmsk_sessions', `client_name TEXT NOT NULL DEFAULT ''`)
addColumnIfMissing('xmsk_sessions', `trainer_name TEXT`)

const insertXmskStmt = db.prepare(`
  INSERT INTO xmsk_sessions
    (created_at, region, client_name, trainer_name, red_flags_cleared, note, before_json, after_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const XMSK_SELECT_COLUMNS = `
  id, created_at, region, client_name, trainer_name, red_flags_cleared, note, before_json, after_json
`

const listXmskStmt = db.prepare(`
  SELECT ${XMSK_SELECT_COLUMNS}
  FROM xmsk_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getXmskStmt = db.prepare(`
  SELECT ${XMSK_SELECT_COLUMNS}
  FROM xmsk_sessions
  WHERE id = ?
`)

export function insertXmskSession(req: XmskSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertXmskStmt.run(
    createdAt,
    req.region,
    req.clientName,
    req.trainerName ?? null,
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

// ============================================================
// XMSK 평가 (xmsk_evaluations)
// ============================================================

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

// ============================================================
// 보행 진단 기록 (gait_diagnostics)
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS gait_diagnostics (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at              TEXT NOT NULL,
    video_name              TEXT NOT NULL,
    device_info             TEXT NOT NULL,
    client_name             TEXT,
    trainer_name            TEXT,
    video_width             REAL NOT NULL,
    video_height            REAL NOT NULL,
    duration_sec            REAL NOT NULL,
    attempted_frames        REAL NOT NULL,
    no_pose_frames          REAL NOT NULL,
    dropped_frames          REAL NOT NULL,
    kept_frames             REAL NOT NULL,
    avg_hip_score           REAL NOT NULL,
    avg_left_ankle_score    REAL NOT NULL,
    avg_right_ankle_score   REAL NOT NULL,
    avg_left_heel_score     REAL NOT NULL,
    avg_right_heel_score    REAL NOT NULL,
    sampled_times_checksum  REAL NOT NULL,
    total_steps             REAL NOT NULL,
    cadence_steps_per_min   REAL NOT NULL,
    note                    TEXT,
    gait_metrics_json       TEXT,
    ground_truth_json       TEXT,
    calc_version            TEXT
  )
`)

const insertGaitStmt = db.prepare(`
  INSERT INTO gait_diagnostics
    (created_at, video_name, device_info, client_name, trainer_name, video_width, video_height,
     duration_sec, attempted_frames, no_pose_frames, dropped_frames, kept_frames, avg_hip_score,
     avg_left_ankle_score, avg_right_ankle_score, avg_left_heel_score, avg_right_heel_score,
     sampled_times_checksum, total_steps, cadence_steps_per_min, note, gait_metrics_json,
     ground_truth_json, calc_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const GAIT_SELECT_COLUMNS = `
  id, created_at, video_name, device_info, client_name, trainer_name, video_width, video_height,
  duration_sec, attempted_frames, no_pose_frames, dropped_frames, kept_frames, avg_hip_score,
  avg_left_ankle_score, avg_right_ankle_score, avg_left_heel_score, avg_right_heel_score,
  sampled_times_checksum, total_steps, cadence_steps_per_min, note, gait_metrics_json,
  ground_truth_json, calc_version
`

const listGaitStmt = db.prepare(`
  SELECT ${GAIT_SELECT_COLUMNS}
  FROM gait_diagnostics
  ORDER BY id DESC
  LIMIT ?
`)

const listGaitSearchStmt = db.prepare(`
  SELECT ${GAIT_SELECT_COLUMNS}
  FROM gait_diagnostics
  WHERE video_name LIKE ? OR client_name LIKE ? OR trainer_name LIKE ? OR device_info LIKE ?
  ORDER BY id DESC
  LIMIT ?
`)

const getGaitStmt = db.prepare(`
  SELECT ${GAIT_SELECT_COLUMNS}
  FROM gait_diagnostics
  WHERE id = ?
`)

export function insertGaitDiagnostic(req: GaitDiagnosticCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertGaitStmt.run(
    createdAt,
    req.videoName,
    req.deviceInfo,
    req.clientName ?? null,
    req.trainerName ?? null,
    req.videoWidth,
    req.videoHeight,
    req.durationSec,
    req.attemptedFrames,
    req.noPoseFrames,
    req.droppedFrames,
    req.keptFrames,
    req.avgHipScore,
    req.avgLeftAnkleScore,
    req.avgRightAnkleScore,
    req.avgLeftHeelScore,
    req.avgRightHeelScore,
    req.sampledTimesChecksum,
    req.totalSteps,
    req.cadenceStepsPerMin,
    req.note ?? null,
    req.gaitMetrics ? JSON.stringify(req.gaitMetrics) : null,
    req.groundTruth ? JSON.stringify(req.groundTruth) : null,
    req.calcVersion ?? null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listGaitDiagnostics(limit: number, search?: string): GaitDiagnosticRow[] {
  if (search && search.trim() !== '') {
    const like = `%${search.trim()}%`
    return listGaitSearchStmt.all(like, like, like, like, limit) as unknown as GaitDiagnosticRow[]
  }
  return listGaitStmt.all(limit) as unknown as GaitDiagnosticRow[]
}

export function getGaitDiagnostic(id: number): GaitDiagnosticRow | undefined {
  return getGaitStmt.get(id) as unknown as GaitDiagnosticRow | undefined
}

const deleteGaitStmt = db.prepare(`DELETE FROM gait_diagnostics WHERE id = ?`)
const updateGaitGroundTruthStmt = db.prepare(`UPDATE gait_diagnostics SET ground_truth_json = ? WHERE id = ?`)

export function deleteGaitDiagnostic(id: number): boolean {
  return Number(deleteGaitStmt.run(id).changes) > 0
}

export function updateGaitDiagnosticGroundTruth(id: number, groundTruthJson: string): void {
  updateGaitGroundTruthStmt.run(groundTruthJson, id)
}

// ============================================================
// 손 세션 (hand_sessions)
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS hand_sessions (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at             TEXT NOT NULL,
    video_name             TEXT NOT NULL,
    client_name            TEXT NOT NULL,
    trainer_name           TEXT,
    before_start_sec       REAL NOT NULL,
    before_end_sec         REAL NOT NULL,
    after_start_sec        REAL NOT NULL,
    after_end_sec          REAL NOT NULL,
    left_results_json      TEXT NOT NULL,
    right_results_json     TEXT NOT NULL,
    calc_version           TEXT,
    eeg_context_json       TEXT,
    hand_ground_truth_json TEXT
  )
`)

const insertHandStmt = db.prepare(`
  INSERT INTO hand_sessions
    (created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
     after_start_sec, after_end_sec, left_results_json, right_results_json, calc_version,
     eeg_context_json, hand_ground_truth_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const HAND_SELECT_COLUMNS = `
  id, created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
  after_start_sec, after_end_sec, left_results_json, right_results_json, calc_version,
  eeg_context_json, hand_ground_truth_json
`

const listHandStmt = db.prepare(`
  SELECT ${HAND_SELECT_COLUMNS}
  FROM hand_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getHandStmt = db.prepare(`
  SELECT ${HAND_SELECT_COLUMNS}
  FROM hand_sessions
  WHERE id = ?
`)

export function insertHandSession(req: HandSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertHandStmt.run(
    createdAt,
    req.videoName,
    req.clientName,
    req.trainerName ?? null,
    req.beforeStartSec,
    req.beforeEndSec,
    req.afterStartSec,
    req.afterEndSec,
    JSON.stringify(req.leftResults),
    JSON.stringify(req.rightResults),
    req.calcVersion ?? null,
    req.eegContext ? JSON.stringify(req.eegContext) : null,
    JSON.stringify(req.handGroundTruth ?? []),
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listHandSessions(limit: number): HandSessionRow[] {
  return listHandStmt.all(limit) as unknown as HandSessionRow[]
}

export function getHandSession(id: number): HandSessionRow | undefined {
  return getHandStmt.get(id) as unknown as HandSessionRow | undefined
}

const deleteHandStmt = db.prepare(`DELETE FROM hand_sessions WHERE id = ?`)
const updateHandEegContextStmt = db.prepare(`UPDATE hand_sessions SET eeg_context_json = ? WHERE id = ?`)
const updateHandGroundTruthStmt = db.prepare(`UPDATE hand_sessions SET hand_ground_truth_json = ? WHERE id = ?`)

export function deleteHandSession(id: number): boolean {
  return Number(deleteHandStmt.run(id).changes) > 0
}

export function updateHandSessionEegContext(id: number, eegContextJson: string): void {
  updateHandEegContextStmt.run(eegContextJson, id)
}

export function updateHandSessionGroundTruth(id: number, handGroundTruthJson: string): void {
  updateHandGroundTruthStmt.run(handGroundTruthJson, id)
}

// ============================================================
// 발 세션 (foot_sessions)
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS foot_sessions (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at             TEXT NOT NULL,
    video_name             TEXT NOT NULL,
    client_name            TEXT NOT NULL,
    trainer_name           TEXT,
    before_start_sec       REAL NOT NULL,
    before_end_sec         REAL NOT NULL,
    after_start_sec        REAL NOT NULL,
    after_end_sec          REAL NOT NULL,
    toe_estimates_json     TEXT NOT NULL,
    manual_toe_inputs_json TEXT NOT NULL,
    calc_version           TEXT,
    eeg_context_json       TEXT
  )
`)

const insertFootStmt = db.prepare(`
  INSERT INTO foot_sessions
    (created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
     after_start_sec, after_end_sec, toe_estimates_json, manual_toe_inputs_json, calc_version,
     eeg_context_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const FOOT_SELECT_COLUMNS = `
  id, created_at, video_name, client_name, trainer_name, before_start_sec, before_end_sec,
  after_start_sec, after_end_sec, toe_estimates_json, manual_toe_inputs_json, calc_version,
  eeg_context_json
`

const listFootStmt = db.prepare(`
  SELECT ${FOOT_SELECT_COLUMNS}
  FROM foot_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getFootStmt = db.prepare(`
  SELECT ${FOOT_SELECT_COLUMNS}
  FROM foot_sessions
  WHERE id = ?
`)

export function insertFootSession(req: FootSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertFootStmt.run(
    createdAt,
    req.videoName,
    req.clientName,
    req.trainerName ?? null,
    req.beforeStartSec,
    req.beforeEndSec,
    req.afterStartSec,
    req.afterEndSec,
    JSON.stringify(req.toeEstimates ?? []),
    JSON.stringify(req.manualToeInputs ?? []),
    req.calcVersion ?? null,
    req.eegContext ? JSON.stringify(req.eegContext) : null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listFootSessions(limit: number): FootSessionRow[] {
  return listFootStmt.all(limit) as unknown as FootSessionRow[]
}

export function getFootSession(id: number): FootSessionRow | undefined {
  return getFootStmt.get(id) as unknown as FootSessionRow | undefined
}

const deleteFootStmt = db.prepare(`DELETE FROM foot_sessions WHERE id = ?`)
const updateFootEegContextStmt = db.prepare(`UPDATE foot_sessions SET eeg_context_json = ? WHERE id = ?`)
const updateFootManualToeInputsStmt = db.prepare(`UPDATE foot_sessions SET manual_toe_inputs_json = ? WHERE id = ?`)

export function deleteFootSession(id: number): boolean {
  return Number(deleteFootStmt.run(id).changes) > 0
}

export function updateFootSessionEegContext(id: number, eegContextJson: string): void {
  updateFootEegContextStmt.run(eegContextJson, id)
}

export function updateFootSessionManualToeInputs(id: number, manualToeInputsJson: string): void {
  updateFootManualToeInputsStmt.run(manualToeInputsJson, id)
}

// ============================================================
// XCTS 세션 (xcts_sessions)
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS xcts_sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL,
    client_name    TEXT NOT NULL,
    trainer_name   TEXT,
    device_source  TEXT NOT NULL,
    device_name    TEXT,
    baseline_json  TEXT,
    post_json      TEXT,
    note           TEXT
  )
`)

const insertXctsStmt = db.prepare(`
  INSERT INTO xcts_sessions
    (created_at, client_name, trainer_name, device_source, device_name, baseline_json, post_json, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const XCTS_SELECT_COLUMNS = `
  id, created_at, client_name, trainer_name, device_source, device_name, baseline_json, post_json, note
`

const listXctsStmt = db.prepare(`
  SELECT ${XCTS_SELECT_COLUMNS}
  FROM xcts_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getXctsStmt = db.prepare(`
  SELECT ${XCTS_SELECT_COLUMNS}
  FROM xcts_sessions
  WHERE id = ?
`)

export function insertXctsSession(req: XctsSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertXctsStmt.run(
    createdAt,
    req.clientName,
    req.trainerName ?? null,
    req.deviceSource,
    req.deviceName ?? null,
    req.baseline ? JSON.stringify(req.baseline) : null,
    req.post ? JSON.stringify(req.post) : null,
    req.note ?? null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listXctsSessions(limit: number): XctsSessionRow[] {
  return listXctsStmt.all(limit) as unknown as XctsSessionRow[]
}

export function getXctsSession(id: number): XctsSessionRow | undefined {
  return getXctsStmt.get(id) as unknown as XctsSessionRow | undefined
}

const deleteXctsStmt = db.prepare(`DELETE FROM xcts_sessions WHERE id = ?`)

export function deleteXctsSession(id: number): boolean {
  return Number(deleteXctsStmt.run(id).changes) > 0
}

// ============================================================
// 뇌파(EEG) 세션 (eeg_sessions)
// ============================================================
// 2026-09 추가 — 원래 EEG는 서버 저장이 전혀 없는 100% 클라이언트 전용 기능이었으나,
// XCTS와 같은 방식으로 회원별 기록을 남기고 싶다는 요청에 따라 추가한다. XCTS와 같은
// 이유로 requireAuth로 보호한다(routes/eegSessions.ts 참고, App.tsx GATED_TABS에도 추가됨).

db.exec(`
  CREATE TABLE IF NOT EXISTS eeg_sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at       TEXT NOT NULL,
    client_name      TEXT NOT NULL,
    trainer_name     TEXT,
    device_name      TEXT,
    band_powers_json TEXT NOT NULL,
    note             TEXT
  )
`)

const insertEegStmt = db.prepare(`
  INSERT INTO eeg_sessions
    (created_at, client_name, trainer_name, device_name, band_powers_json, note)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const EEG_SELECT_COLUMNS = `
  id, created_at, client_name, trainer_name, device_name, band_powers_json, note
`

const listEegStmt = db.prepare(`
  SELECT ${EEG_SELECT_COLUMNS}
  FROM eeg_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getEegStmt = db.prepare(`
  SELECT ${EEG_SELECT_COLUMNS}
  FROM eeg_sessions
  WHERE id = ?
`)

export function insertEegSession(req: EegSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertEegStmt.run(
    createdAt,
    req.clientName,
    req.trainerName ?? null,
    req.deviceName ?? null,
    JSON.stringify(req.bandPowers),
    req.note ?? null,
  )
  return { id: Number(result.lastInsertRowid), createdAt }
}

export function listEegSessions(limit: number): EegSessionRow[] {
  return listEegStmt.all(limit) as unknown as EegSessionRow[]
}

export function getEegSession(id: number): EegSessionRow | undefined {
  return getEegStmt.get(id) as unknown as EegSessionRow | undefined
}

const deleteEegStmt = db.prepare(`DELETE FROM eeg_sessions WHERE id = ?`)

export function deleteEegSession(id: number): boolean {
  return Number(deleteEegStmt.run(id).changes) > 0
}

// ============================================================
// 데이터 품질 대시보드용 집계 조회 (GET /api/xmsk/data-quality)
// ============================================================

export interface RomGroundTruthDataRow {
  xmskEstimatesJson: string
  xmskGroundTruthJson: string
  calcVersion: string | null
}

export interface GaitGroundTruthDataRow {
  totalSteps: number
  groundTruthJson: string | null
  calcVersion: string | null
}

export interface FootToeSimCalibrationDataRow {
  manualToeInputsJson: string
  calcVersion: string | null
}

export interface HandGroundTruthDataRow {
  leftResultsJson: string
  rightResultsJson: string
  handGroundTruthJson: string | null
  calcVersion: string | null
}

const romGroundTruthStmt = db.prepare(`
  SELECT xmsk_estimates_json, xmsk_ground_truth_json, calc_version FROM stretch_sessions
`)
const gaitGroundTruthStmt = db.prepare(`
  SELECT total_steps, ground_truth_json, calc_version FROM gait_diagnostics
`)
const footToeSimStmt = db.prepare(`
  SELECT manual_toe_inputs_json, calc_version FROM foot_sessions
`)
const handGroundTruthStmt = db.prepare(`
  SELECT left_results_json, right_results_json, hand_ground_truth_json, calc_version FROM hand_sessions
`)

export function listRomGroundTruthData(): RomGroundTruthDataRow[] {
  const rows = romGroundTruthStmt.all() as unknown as {
    xmsk_estimates_json: string
    xmsk_ground_truth_json: string
    calc_version: string | null
  }[]
  return rows.map((r) => ({
    xmskEstimatesJson: r.xmsk_estimates_json,
    xmskGroundTruthJson: r.xmsk_ground_truth_json,
    calcVersion: r.calc_version,
  }))
}

export function listGaitGroundTruthData(): GaitGroundTruthDataRow[] {
  const rows = gaitGroundTruthStmt.all() as unknown as {
    total_steps: number
    ground_truth_json: string | null
    calc_version: string | null
  }[]
  return rows.map((r) => ({
    totalSteps: r.total_steps,
    groundTruthJson: r.ground_truth_json,
    calcVersion: r.calc_version,
  }))
}

export function listFootToeSimCalibrationData(): FootToeSimCalibrationDataRow[] {
  const rows = footToeSimStmt.all() as unknown as { manual_toe_inputs_json: string; calc_version: string | null }[]
  return rows.map((r) => ({
    manualToeInputsJson: r.manual_toe_inputs_json,
    calcVersion: r.calc_version,
  }))
}

export function listHandGroundTruthData(): HandGroundTruthDataRow[] {
  const rows = handGroundTruthStmt.all() as unknown as {
    left_results_json: string
    right_results_json: string
    hand_ground_truth_json: string | null
    calc_version: string | null
  }[]
  return rows.map((r) => ({
    leftResultsJson: r.left_results_json,
    rightResultsJson: r.right_results_json,
    handGroundTruthJson: r.hand_ground_truth_json,
    calcVersion: r.calc_version,
  }))
}

// ============================================================
// 건강 홈 요약 기능
// ============================================================

export interface HealthMetricRow {
  id: number
  recordedAt: string
  metricType: string
  value: number
  source: string
}

export interface CoachMessageRow {
  id: number
  sentAt: string
  triggerType: string
  message: string
}

db.exec(`
  CREATE TABLE IF NOT EXISTS health_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual'
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS coach_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    message TEXT NOT NULL
  )
`)

const insertHealthMetricStmt = db.prepare(`
  INSERT INTO health_metrics (recorded_at, metric_type, value, source)
  VALUES (?, ?, ?, ?)
`)

const latestMetricByTypeStmt = db.prepare(`
  SELECT id, recorded_at, metric_type, value, source
  FROM health_metrics
  WHERE metric_type = ?
  ORDER BY recorded_at DESC
  LIMIT 1
`)

const recentMetricsByTypeStmt = db.prepare(`
  SELECT id, recorded_at, metric_type, value, source
  FROM health_metrics
  WHERE metric_type = ?
  ORDER BY recorded_at DESC
  LIMIT ?
`)

const insertCoachMessageStmt = db.prepare(`
  INSERT INTO coach_messages (sent_at, trigger_type, message)
  VALUES (?, ?, ?)
`)

const latestCoachMessageStmt = db.prepare(`
  SELECT id, sent_at, trigger_type, message
  FROM coach_messages
  ORDER BY sent_at DESC
  LIMIT 1
`)

export function insertHealthMetric(metricType: string, value: number, source: 'manual' | 'device' = 'manual'): void {
  insertHealthMetricStmt.run(new Date().toISOString(), metricType, value, source)
}

export function getLatestMetric(metricType: string): HealthMetricRow | undefined {
  return latestMetricByTypeStmt.get(metricType) as unknown as HealthMetricRow | undefined
}

export function getRecentMetrics(metricType: string, limit: number): HealthMetricRow[] {
  return recentMetricsByTypeStmt.all(metricType, limit) as unknown as HealthMetricRow[]
}

export function insertCoachMessage(triggerType: string, message: string): void {
  insertCoachMessageStmt.run(new Date().toISOString(), triggerType, message)
}

export function getLatestCoachMessage(): CoachMessageRow | undefined {
  return latestCoachMessageStmt.get() as unknown as CoachMessageRow | undefined
}
