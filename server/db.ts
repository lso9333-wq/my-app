import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type {
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

function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

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
ensureColumn('stretch_sessions', 'client_name', `client_name TEXT NOT NULL DEFAULT ''`)
ensureColumn('stretch_sessions', 'trainer_name', `trainer_name TEXT`)
ensureColumn('stretch_sessions', 'xmsk_estimates_json', `xmsk_estimates_json TEXT NOT NULL DEFAULT '[]'`)
ensureColumn('stretch_sessions', 'xmsk_manual_inputs_json', `xmsk_manual_inputs_json TEXT NOT NULL DEFAULT '[]'`)
// AI 추정값 옆에 트레이너 실측값을 기록해 나중에 계산 로직 보정에 쓰기 위한 컬럼
// (docs/ai-training-plan.md 참고) — xmsk_manual_inputs_json과 같은 방식으로 추가.
ensureColumn('stretch_sessions', 'xmsk_ground_truth_json', `xmsk_ground_truth_json TEXT NOT NULL DEFAULT '[]'`)
// 이 세션의 결과가 어떤 계산 로직 버전으로 만들어졌는지 기록 (docs/ai-training-plan.md,
// ANALYSIS_PIPELINE_VERSION 참고) — ground truth와 비교할 때 버전이 섞이지 않도록 함.
ensureColumn('stretch_sessions', 'calc_version', `calc_version TEXT`)

const insertStmt = db.prepare(`
  INSERT INTO stretch_sessions
    (created_at, video_name, client_name, trainer_name,
     before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json, xmsk_estimates_json,
     xmsk_manual_inputs_json, xmsk_ground_truth_json, calc_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const listStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json, xmsk_estimates_json,
         xmsk_manual_inputs_json, xmsk_ground_truth_json, calc_version
  FROM stretch_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec, results_json, xmsk_estimates_json,
         xmsk_manual_inputs_json, xmsk_ground_truth_json, calc_version
  FROM stretch_sessions
  WHERE id = ?
`)

const deleteStmt = db.prepare(`DELETE FROM stretch_sessions WHERE id = ?`)

const updateManualInputsStmt = db.prepare(`
  UPDATE stretch_sessions SET xmsk_manual_inputs_json = ? WHERE id = ?
`)

const updateGroundTruthStmt = db.prepare(`
  UPDATE stretch_sessions SET xmsk_ground_truth_json = ? WHERE id = ?
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

export function deleteSession(id: number): boolean {
  return deleteStmt.run(id).changes > 0
}

/** 손목 저항 검사 등 수기 입력 항목만 갱신한다(분석 직후 자동 저장 이후에 값이 채워지므로). */
export function updateSessionManualInputs(id: number, xmskManualInputsJson: string): boolean {
  return updateManualInputsStmt.run(xmskManualInputsJson, id).changes > 0
}

/** 트레이너 실측값(ground truth)만 갱신한다 — 분석 당일이 아니라 나중에 관찰한 뒤
 * 기록을 다시 열어 입력하는 경우가 많아 manual inputs와 마찬가지로 별도 갱신 함수를 둔다. */
export function updateSessionGroundTruth(id: number, xmskGroundTruthJson: string): boolean {
  return updateGroundTruthStmt.run(xmskGroundTruthJson, id).changes > 0
}

const romDataQualityStmt = db.prepare(`
  SELECT xmsk_estimates_json, xmsk_ground_truth_json, calc_version FROM stretch_sessions
`)

/** 데이터 품질 대시보드(server/routes/xmsk.ts)용 — 전체 세션의 XMSK 추정치/실측값/버전만
 * 뽑아 집계에 쓴다. 목록 화면(listSessions)과 달리 개수 제한이 없다 — 이 프로젝트 규모의
 * 개인 앱 SQLite 데이터라 전체를 한 번에 읽어도 무리가 없다는 전제. */
export function listRomGroundTruthData(): {
  xmskEstimatesJson: string
  xmskGroundTruthJson: string
  calcVersion: string | null
}[] {
  const rows = romDataQualityStmt.all() as unknown as {
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
ensureColumn('xmsk_sessions', 'client_name', `client_name TEXT NOT NULL DEFAULT ''`)
ensureColumn('xmsk_sessions', 'trainer_name', `trainer_name TEXT`)

const insertXmskStmt = db.prepare(`
  INSERT INTO xmsk_sessions
    (created_at, region, client_name, trainer_name, red_flags_cleared, note, before_json, after_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const listXmskStmt = db.prepare(`
  SELECT id, created_at, region, client_name, trainer_name, red_flags_cleared, note, before_json, after_json
  FROM xmsk_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getXmskStmt = db.prepare(`
  SELECT id, created_at, region, client_name, trainer_name, red_flags_cleared, note, before_json, after_json
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

db.exec(`
  CREATE TABLE IF NOT EXISTS gait_diagnostics (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT NOT NULL,
    video_name            TEXT NOT NULL,
    device_info           TEXT NOT NULL,
    video_width           INTEGER NOT NULL,
    video_height          INTEGER NOT NULL,
    duration_sec          REAL NOT NULL,
    attempted_frames      INTEGER NOT NULL,
    no_pose_frames        INTEGER NOT NULL,
    dropped_frames        INTEGER NOT NULL,
    kept_frames           INTEGER NOT NULL,
    avg_hip_score         REAL NOT NULL,
    avg_left_ankle_score  REAL NOT NULL,
    avg_right_ankle_score REAL NOT NULL,
    avg_left_heel_score   REAL NOT NULL,
    avg_right_heel_score  REAL NOT NULL,
    total_steps           INTEGER NOT NULL,
    cadence_steps_per_min REAL NOT NULL,
    note                  TEXT
  )
`)
ensureColumn('gait_diagnostics', 'client_name', `client_name TEXT`)
ensureColumn('gait_diagnostics', 'trainer_name', `trainer_name TEXT`)
ensureColumn('gait_diagnostics', 'sampled_times_checksum', `sampled_times_checksum REAL NOT NULL DEFAULT 0`)
// 진단 기록 PDF의 "2페이지"에 방금 분석한 결과 화면과 같은 통계/그래프를 넣기 위해,
// 저장 시점의 프론트엔드 GaitMetrics 전체를 JSON으로 함께 보관한다(다른 *_json
// 컬럼과 같은 방식). 이 컬럼 추가 이전에 저장된 기존 기록은 NULL로 남는다 —
// RecordDetail은 이 값이 없으면 2페이지를 생략하고 안내 문구만 보여준다.
ensureColumn('gait_diagnostics', 'gait_metrics_json', `gait_metrics_json TEXT`)
// AI 추정 지표(케이던스·좌우 대칭성·전도 위험 점수) 옆에 트레이너 실측값을 기록해
// 나중에 계산 로직 보정에 쓰기 위한 컬럼 (docs/ai-training-plan.md 참고) —
// gait_metrics_json과 같은 방식으로 추가.
ensureColumn('gait_diagnostics', 'ground_truth_json', `ground_truth_json TEXT`)
// 이 기록의 결과가 어떤 계산 로직 버전으로 만들어졌는지 기록 (docs/ai-training-plan.md,
// ANALYSIS_PIPELINE_VERSION 참고) — stretch_sessions의 calc_version과 같은 목적.
ensureColumn('gait_diagnostics', 'calc_version', `calc_version TEXT`)

const GAIT_DIAGNOSTIC_COLUMNS = `
  id, created_at, video_name, device_info, client_name, trainer_name, video_width, video_height, duration_sec,
  attempted_frames, no_pose_frames, dropped_frames, kept_frames,
  avg_hip_score, avg_left_ankle_score, avg_right_ankle_score, avg_left_heel_score, avg_right_heel_score,
  sampled_times_checksum, total_steps, cadence_steps_per_min, note, gait_metrics_json, ground_truth_json,
  calc_version
`

const insertGaitDiagnosticStmt = db.prepare(`
  INSERT INTO gait_diagnostics
    (created_at, video_name, device_info, client_name, trainer_name, video_width, video_height, duration_sec,
     attempted_frames, no_pose_frames, dropped_frames, kept_frames,
     avg_hip_score, avg_left_ankle_score, avg_right_ankle_score, avg_left_heel_score, avg_right_heel_score,
     sampled_times_checksum, total_steps, cadence_steps_per_min, note, gait_metrics_json, ground_truth_json,
     calc_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const listGaitDiagnosticsStmt = db.prepare(`
  SELECT ${GAIT_DIAGNOSTIC_COLUMNS} FROM gait_diagnostics
  ORDER BY id DESC
  LIMIT ?
`)

const searchGaitDiagnosticsStmt = db.prepare(`
  SELECT ${GAIT_DIAGNOSTIC_COLUMNS} FROM gait_diagnostics
  WHERE video_name LIKE ? OR device_info LIKE ? OR note LIKE ? OR client_name LIKE ? OR trainer_name LIKE ?
  ORDER BY id DESC
  LIMIT ?
`)

const getGaitDiagnosticStmt = db.prepare(`
  SELECT ${GAIT_DIAGNOSTIC_COLUMNS} FROM gait_diagnostics WHERE id = ?
`)

const deleteGaitDiagnosticStmt = db.prepare(`DELETE FROM gait_diagnostics WHERE id = ?`)

const updateGaitDiagnosticGroundTruthStmt = db.prepare(`
  UPDATE gait_diagnostics SET ground_truth_json = ? WHERE id = ?
`)

export function insertGaitDiagnostic(req: GaitDiagnosticCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertGaitDiagnosticStmt.run(
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
  if (search && search.trim()) {
    const like = `%${search.trim()}%`
    return searchGaitDiagnosticsStmt.all(like, like, like, like, like, limit) as unknown as GaitDiagnosticRow[]
  }
  return listGaitDiagnosticsStmt.all(limit) as unknown as GaitDiagnosticRow[]
}

export function getGaitDiagnostic(id: number): GaitDiagnosticRow | undefined {
  return getGaitDiagnosticStmt.get(id) as unknown as GaitDiagnosticRow | undefined
}

export function deleteGaitDiagnostic(id: number): boolean {
  return deleteGaitDiagnosticStmt.run(id).changes > 0
}

/** 트레이너 실측값(ground truth)만 갱신한다 — gait_metrics와 달리 분석 당일이 아니라
 * 나중에 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많아 별도 갱신 함수를 둔다. */
export function updateGaitDiagnosticGroundTruth(id: number, groundTruthJson: string): boolean {
  return updateGaitDiagnosticGroundTruthStmt.run(groundTruthJson, id).changes > 0
}

db.exec(`
  CREATE TABLE IF NOT EXISTS hand_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at          TEXT NOT NULL,
    video_name          TEXT NOT NULL,
    client_name         TEXT NOT NULL,
    trainer_name        TEXT,
    before_start_sec    REAL NOT NULL,
    before_end_sec      REAL NOT NULL,
    after_start_sec     REAL NOT NULL,
    after_end_sec       REAL NOT NULL,
    left_results_json   TEXT NOT NULL,
    right_results_json  TEXT NOT NULL,
    calc_version        TEXT
  )
`)

// 2026-09: "동시 측정 뇌파 컨텍스트" — 기존 hand_sessions 행에는 이 컬럼이 없으므로
// ensureColumn으로 추가한다(다른 *_json 선택 필드 컬럼들과 같은 방식). 기존 행은 NULL.
ensureColumn('hand_sessions', 'eeg_context_json', `eeg_context_json TEXT`)

// 2026-09: 손가락 관절 14개(양손) "AI 계산 vs 트레이너 실측" 정답값 — foot_sessions의
// manual_toe_inputs_json과 달리 손은 이미 실제 랜드마크로 직접 계산한 값이라 별도
// ground-truth 컬럼(ROM의 xmsk_ground_truth_json과 같은 성격)을 둔다.
ensureColumn('hand_sessions', 'hand_ground_truth_json', `hand_ground_truth_json TEXT`)

const insertHandStmt = db.prepare(`
  INSERT INTO hand_sessions
    (created_at, video_name, client_name, trainer_name,
     before_start_sec, before_end_sec, after_start_sec, after_end_sec,
     left_results_json, right_results_json, calc_version, eeg_context_json, hand_ground_truth_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const listHandStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec,
         left_results_json, right_results_json, calc_version, eeg_context_json, hand_ground_truth_json
  FROM hand_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getHandStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec,
         left_results_json, right_results_json, calc_version, eeg_context_json, hand_ground_truth_json
  FROM hand_sessions
  WHERE id = ?
`)

const deleteHandStmt = db.prepare(`DELETE FROM hand_sessions WHERE id = ?`)

const updateHandEegContextStmt = db.prepare(`UPDATE hand_sessions SET eeg_context_json = ? WHERE id = ?`)

const updateHandGroundTruthStmt = db.prepare(`UPDATE hand_sessions SET hand_ground_truth_json = ? WHERE id = ?`)

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

export function deleteHandSession(id: number): boolean {
  return deleteHandStmt.run(id).changes > 0
}

/** 동시 측정 뇌파 컨텍스트만 갱신한다 — updateFootSessionEegContext와 같은 이유
 * (updateFootSessionManualToeInputs 아래 주석 참고: "활동" 캡처는 분석 직후 자동 저장
 * 이후에야 이뤄지는 경우가 많다). */
export function updateHandSessionEegContext(id: number, eegContextJson: string): boolean {
  return updateHandEegContextStmt.run(eegContextJson, id).changes > 0
}

/** 손가락 관절 트레이너 실측값(ground truth)만 갱신한다 — ROM의 updateSessionGroundTruth와
 * 같은 이유(분석 당일이 아니라 나중에 관찰한 뒤 기록을 다시 열어 입력하는 경우가 많음). */
export function updateHandSessionGroundTruth(id: number, handGroundTruthJson: string): boolean {
  return updateHandGroundTruthStmt.run(handGroundTruthJson, id).changes > 0
}

db.exec(`
  CREATE TABLE IF NOT EXISTS foot_sessions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at              TEXT NOT NULL,
    video_name              TEXT NOT NULL,
    client_name             TEXT NOT NULL,
    trainer_name            TEXT,
    before_start_sec        REAL NOT NULL,
    before_end_sec          REAL NOT NULL,
    after_start_sec         REAL NOT NULL,
    after_end_sec           REAL NOT NULL,
    toe_estimates_json      TEXT NOT NULL DEFAULT '[]',
    manual_toe_inputs_json  TEXT NOT NULL DEFAULT '[]',
    calc_version            TEXT
  )
`)

// 2026-09: hand_sessions와 같은 이유로 같은 컬럼을 추가한다.
ensureColumn('foot_sessions', 'eeg_context_json', `eeg_context_json TEXT`)

const insertFootStmt = db.prepare(`
  INSERT INTO foot_sessions
    (created_at, video_name, client_name, trainer_name,
     before_start_sec, before_end_sec, after_start_sec, after_end_sec,
     toe_estimates_json, manual_toe_inputs_json, calc_version, eeg_context_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const listFootStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec,
         toe_estimates_json, manual_toe_inputs_json, calc_version, eeg_context_json
  FROM foot_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getFootStmt = db.prepare(`
  SELECT id, created_at, video_name, client_name, trainer_name,
         before_start_sec, before_end_sec, after_start_sec, after_end_sec,
         toe_estimates_json, manual_toe_inputs_json, calc_version, eeg_context_json
  FROM foot_sessions
  WHERE id = ?
`)

const deleteFootStmt = db.prepare(`DELETE FROM foot_sessions WHERE id = ?`)

const updateFootManualToeStmt = db.prepare(`UPDATE foot_sessions SET manual_toe_inputs_json = ? WHERE id = ?`)

const updateFootEegContextStmt = db.prepare(`UPDATE foot_sessions SET eeg_context_json = ? WHERE id = ?`)

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

export function deleteFootSession(id: number): boolean {
  return deleteFootStmt.run(id).changes > 0
}

/** 발가락 10마디 수기 입력값만 갱신한다 — AI가 개별 발가락을 구분하지 못해 전부
 * 트레이너 입력이므로, ROM의 manual-inputs와 같은 이유로 별도 갱신 함수를 둔다. */
export function updateFootSessionManualToeInputs(id: number, manualToeInputsJson: string): boolean {
  return updateFootManualToeStmt.run(manualToeInputsJson, id).changes > 0
}

/** 동시 측정 뇌파 컨텍스트만 갱신한다 — "활동(분석 직후)" 캡처는 분석 직후 자동 저장
 * (POST)이 이미 끝난 뒤에야 이뤄지는 경우가 많아(트레이너가 결과를 보고 나서 캡처하는
 * 흐름) manual-toe-inputs와 같은 이유로 별도 갱신 함수를 둔다. */
export function updateFootSessionEegContext(id: number, eegContextJson: string): boolean {
  return updateFootEegContextStmt.run(eegContextJson, id).changes > 0
}

const gaitDataQualityStmt = db.prepare(`
  SELECT total_steps, ground_truth_json, calc_version FROM gait_diagnostics
`)

/** 데이터 품질 대시보드(server/routes/xmsk.ts)용 — ROM의 listRomGroundTruthData와 같은
 * 목적. total_steps는 GaitGroundTruthPanel이 실측값 입력을 보여주는 기준(2보 이상)과
 * 같은 컬럼이라, gait_metrics_json 전체를 파싱하지 않고도 "AI 추정이 있었는지"를 알 수
 * 있다. */
export function listGaitGroundTruthData(): {
  totalSteps: number
  groundTruthJson: string | null
  calcVersion: string | null
}[] {
  const rows = gaitDataQualityStmt.all() as unknown as {
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

const footToeSimCalibrationStmt = db.prepare(`
  SELECT manual_toe_inputs_json, calc_version FROM foot_sessions
`)

/**
 * 데이터 품질 대시보드용 — ROM/보행의 listXGroundTruthData와 같은 목적이지만, 발가락
 * 마디별 시뮬레이션은 "AI 추정 vs 트레이너 실측"을 별도 ground-truth 컬럼이 아니라
 * FootManualToeInput 안의 source/estimatedBeforeValue/estimatedAfterValue 필드로
 * 표현하므로(handfoot/types.ts 참고) manual_toe_inputs_json 하나만 읽으면 된다.
 * "실제로 계산 로직(TOE_SEGMENT_SIM_PARAMS)을 보정할 만큼 데이터가 쌓였는지" 판단하는
 * 것이 목적이라, 서버는 이 값의 내용을 해석하지 않고 그대로 넘기기만 한다 —
 * server/routes/xmsk.ts의 /data-quality 핸들러가 집계한다.
 */
export function listFootToeSimCalibrationData(): {
  manualToeInputsJson: string
  calcVersion: string | null
}[] {
  const rows = footToeSimCalibrationStmt.all() as unknown as {
    manual_toe_inputs_json: string
    calc_version: string | null
  }[]
  return rows.map((r) => ({
    manualToeInputsJson: r.manual_toe_inputs_json,
    calcVersion: r.calc_version,
  }))
}

const handDataQualityStmt = db.prepare(`
  SELECT left_results_json, right_results_json, hand_ground_truth_json, calc_version FROM hand_sessions
`)

/**
 * 데이터 품질 대시보드용 — ROM의 listRomGroundTruthData와 같은 목적. 손가락 관절은
 * 이미 실제 랜드마크로 직접 계산한 값(HandJointResult)이라 별도 ground-truth 컬럼
 * (hand_ground_truth_json)과 짝지어 비교한다 — 발가락 마디별 시뮬레이션과 달리 AI
 * 추정값 자체를 결과 안에 보존해둘 필요가 없으므로(원본 값이 left/right_results_json에
 * 그대로 남아있음) foot과는 다른 형태다.
 */
export function listHandGroundTruthData(): {
  leftResultsJson: string
  rightResultsJson: string
  handGroundTruthJson: string | null
  calcVersion: string | null
}[] {
  const rows = handDataQualityStmt.all() as unknown as {
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

// 2026-09: XCTS(심혈관/전신 컨디션 측정 도구 모음) — Muse 뇌파 연동에 이어 두 번째
// 외부 생체측정기기 연동이지만, hand_sessions/foot_sessions와 달리 "before/after 영상
// 분석"이 아니라 그 자체로 독립된 세션(사용자의 명시적 결정 — XMSK 데이터 품질
// 대시보드의 "AI 추정 vs 트레이너 실측" 보정 대상이 아니므로 ground-truth 컬럼도 없다).
// baseline_json/post_json은 다른 *_json 컬럼과 같은 방식으로 검사 없이 그대로 저장한다.
db.exec(`
  CREATE TABLE IF NOT EXISTS xcts_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT NOT NULL,
    client_name   TEXT NOT NULL,
    trainer_name  TEXT,
    device_source TEXT NOT NULL,
    device_name   TEXT,
    baseline_json TEXT,
    post_json     TEXT,
    note          TEXT
  )
`)

const insertXctsStmt = db.prepare(`
  INSERT INTO xcts_sessions
    (created_at, client_name, trainer_name, device_source, device_name, baseline_json, post_json, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const listXctsStmt = db.prepare(`
  SELECT id, created_at, client_name, trainer_name, device_source, device_name, baseline_json, post_json, note
  FROM xcts_sessions
  ORDER BY id DESC
  LIMIT ?
`)

const getXctsStmt = db.prepare(`
  SELECT id, created_at, client_name, trainer_name, device_source, device_name, baseline_json, post_json, note
  FROM xcts_sessions
  WHERE id = ?
`)

const deleteXctsStmt = db.prepare(`DELETE FROM xcts_sessions WHERE id = ?`)

export function insertXctsSession(req: XctsSessionCreateRequest): { id: number; createdAt: string } {
  const createdAt = new Date().toISOString()
  const result = insertXctsStmt.run(
    createdAt,
    req.clientName,
    req.trainerName ?? null,
    req.deviceSource,
    req.deviceName,
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

export function deleteXctsSession(id: number): boolean {
  return deleteXctsStmt.run(id).changes > 0
}
