# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 지침

- 결과값(답변, 요약, 커밋 메시지 등 사용자에게 보여지는 텍스트)과 설명은 항상 한국어로 작성한다.
- 코드, 변수명, 파일명 등 코드 자체의 관례는 기존 방식(영어)을 따른다.

## Commands

- `npm run dev` — run Vite dev server + API server together (via `concurrently`)
- `npm run dev:client` — Vite dev server only (HMR)
- `npm run dev:server` — API server only, watch mode (`tsx watch server/index.ts`)
- `npm run build` — type-check the frontend (`tsc -b`, scoped to `src/`) then production build via `vite build`
- `npm run start` — run the API server against the built `dist/` (serves frontend + API from one process)
- `npm run typecheck:server` — type-check `server/` (separate `tsconfig.json`, not part of `npm run build`)
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build locally

There is no test runner configured in this project.

## Architecture

Vite + React 19 + TypeScript SPA with a minimal Express + SQLite backend. Three features share one shell:

1. **보행 분석 (gait analysis)** — analyzes a walking video entirely client-side.
2. **스트레칭 가동범위 분석 (stretch ROM analysis)** — analyzes one video where the user marks a "before" and "after" stretching segment, and computes joint range-of-motion change. Only the *computed numeric results* are sent to the backend for storage — raw video and per-frame pose data never leave the browser, in both features.
3. **XMSK** — a password-gated, trainer-only reference tool (pain-relief "recipes", a muscle dictionary, and a trainer skills evaluation form). Unrelated to the pose pipeline; entirely server-backed.

### Frontend

- `src/main.tsx` — entry point, mounts `App` into `#root`
- `src/App.tsx` — thin shell: header + tab switch between `GaitApp`, `RomApp`, and `XmskApp`
- `src/App.css` / `src/index.css` — styling (shared design tokens in `index.css` `:root`)

**Shared pose pipeline** (`src/lib/poseDetector.ts`): a singleton MoveNet SinglePose Thunder detector (webgl backend). `extractPoseFrames(video, opts)` seeks a `<video>` element frame-by-frame at `opts.samplingFps` starting at `opts.startTimeSec` (default 0) for up to `opts.maxDurationSec`, running pose estimation per frame (deterministic since it's not realtime playback — used by both features, with different time windows). Also exports `POSE_CONNECTIONS` (skeleton edge list) used by `SkeletonViewer`.

- `src/types/gait.ts` — `PoseFrame` (hip/knee/ankle/shoulder/elbow/wrist keypoints + raw `keypoints[]`), `StepEvent`, `GaitMetrics`, `AnalysisStage`.
- `src/lib/mathUtils.ts` — shared `mean`/`stddev`/`movingAverage`, used by both `gaitAnalysis.ts` and `romAnalysis.ts`.
- `src/shims/mediapipe-pose-shim.ts` — stub for `@mediapipe/pose`, which `@tensorflow-models/pose-detection` statically imports for its BlazePose runtime even though this app only uses MoveNet. Aliased in `vite.config.ts` so the real (non-ESM) package doesn't break the production build.

**보행 분석** (`src/GaitApp.tsx`):
- Owns the pipeline state machine (`AnalysisStage`: `idle → loading-model → processing → analyzing → done`/`error`). `SAMPLING_FPS` (12) and `MAX_ANALYSIS_SECONDS` (20) cap analysis cost.
- `src/lib/gaitAnalysis.ts` — pure `computeGaitMetrics(frames)`: normalizes ankle-y trajectories by an estimated leg-length scale, finds foot-strike peaks per side, derives cadence, step interval/length, left-right symmetry, and lateral sway. All distance metrics are leg-length-relative units, not meters, since camera distance/angle isn't controlled.
- `src/components/VideoUploader.tsx` — drag/drop + tap-to-pick file input (shared with `RomApp`).
- `src/components/SkeletonViewer.tsx` — scrubbable playback with the detected skeleton drawn on a `<canvas>` over the video.
- `src/components/GaitMetricsPanel.tsx` — numeric summary of `GaitMetrics`.
- `src/components/GaitCharts.tsx` — `StepIntervalChart` (time series) and `ComparisonBarChart` (generic left/right bar comparison, `leftLabel`/`rightLabel` optional — reused by ROM as "이전/이후").

**스트레칭 가동범위 분석** (`src/RomApp.tsx`):
- State machine (`RomAnalysisStage`: `idle → loading-model → marking-range → processing → analyzing → done`/`error`). After loading the video and pose model, the user marks a "before" and "after" time window on one timeline (`RangeSelector`), then `extractPoseFrames` runs once per window.
- `src/types/rom.ts` — `JointKey` (8 values: L/R shoulder/elbow/hip/knee), `RomJointResult`, `RomRange`, request/response types.
- `src/lib/jointAngles.ts` — `computeJointAngles(frame)`: per-frame angle-at-vertex (atan2-based) for each of the 8 joints, using only COCO-17 keypoints MoveNet provides (no spine/toe angles). Null if any involved keypoint's score is below threshold.
- `src/lib/romAnalysis.ts` — `computeRomSummary(beforeFrames, afterFrames)`: per joint, smooths the angle series (`movingAverage`) and takes min/max within each phase → `romDeg = max - min`; `deltaRomDeg = after - before`. Requires ≥3 valid samples per phase, else `null` ("데이터 부족").
- `src/lib/romApi.ts` — fetch wrappers for `/api/rom-sessions` (create/list/get).
- `src/components/RangeSelector.tsx` — dependency-free dual-range timeline (4 draggable handles via Pointer Events) for marking the before/after windows; syncs the preview video's `currentTime` while dragging.
- `src/components/RomResultsPanel.tsx` — per-joint before/after/delta table + reused `ComparisonBarChart`.
- `src/components/RomSessionHistory.tsx` — lists saved sessions from the backend, click to view detail.

**XMSK** (`src/XmskApp.tsx`):
- Not built on the shared pose pipeline — no video/pose involved at all. Gated by a password prompt (`XmskPasswordGate`); the resulting bearer token is cached in `localStorage` (`xmsk_token`) and attached to every API call, and any `401` response (via `XmskAuthError`, thrown from `src/lib/xmskApi.ts`) re-locks the app.
- Once unlocked, a second-level tab switch (`XmskModule`: `recipes` | `dictionary` | `evaluation`) picks the module:
  - **통증 레시피 (recipes)** — `XmskRegionPicker` picks one of 8 `XmskRegionKey`s (neck/shoulder, low back, knee, ankle, hip, elbow, wrist, upper back), then `XmskRecipeFlow` walks a fixed stage sequence (`XmskFlowStage`: `redflag → before → recipe → after → summary`) driven by static per-region content in `src/lib/xmskRecipes.ts` (`XMSK_RECIPE_MAP`) — Red Flag checklist, before/after manual measurement inputs, ordered steps, closing script. A header (visible across every stage, mirroring the evaluation form's name/evaluator fields) collects `clientName` (required) and `trainerName` (optional). On save it posts these plus before/after measurements to `/api/xmsk/sessions`; `XmskSessionHistory` lists past sessions (client name shown per row) and reuses `ComparisonBarChart`.
  - **근육 사전 (dictionary)** — `XmskMuscleDictionary` is a pure static reference browser over `src/lib/xmskMuscles.ts` (origin/insertion, action, stretch cue with common error responses, and manual release technique per muscle, grouped by region). No backend calls.
  - **평가표 (evaluation)** — `XmskEvaluationForm` scores a trainee against fixed sections/items defined in `src/lib/xmskEvaluation.ts` (`XMSK_EVAL_SECTIONS`: theory/practical/safety/CS, each with scored items and pass/fail required items) and computes a verdict client-side (`computeXmskEvalVerdict`: `hold` if any required item fails, else `approved` ≥70, `retry` 60–69, else `hold`) before posting to `/api/xmsk/evaluations`; `XmskEvaluationHistory` lists past evaluations. The scoring weights/thresholds are duplicated on the server (`server/xmskEvalDefs.ts`) since the server recomputes the verdict rather than trusting the client's.
- `src/types/xmsk.ts` — all XMSK request/response and domain types (`XmskRecipe`, `XmskMuscle`, `XmskEvalSection`, session/evaluation create+list+detail shapes, etc).
- `src/lib/xmskApi.ts` — fetch wrappers for `/api/xmsk/*`, attaching the bearer token and normalizing `401` into `XmskAuthError`.

### Backend (`server/`)

Minimal Express server, separate from the frontend's `tsconfig.app.json`/build (its own `server/tsconfig.json`, checked via `npm run typecheck:server`, not part of `npm run build`).

- `server/index.ts` — Express app; mounts `/api/rom-sessions` and `/api/xmsk`; also serves `dist/` static + SPA fallback (so `npm run build && npm run start` runs frontend + API from one process).
- `server/db.ts` — `node:sqlite`'s `DatabaseSync` opens `server/data/rom.db` (gitignored; directory kept via `server/data/.gitkeep`), creates the `stretch_sessions`, `xmsk_sessions`, and `xmsk_evaluations` tables on startup. No native dependency — relies on Node's built-in SQLite (requires a recent Node; confirmed working on v24).
- `server/routes/romSessions.ts` — `POST /api/rom-sessions`, `GET /api/rom-sessions?limit=`, `GET /api/rom-sessions/:id`, with hand-rolled request validation.
- `server/routes/xmsk.ts` — `POST /api/xmsk/auth` (password → bearer token); `POST/GET /api/xmsk/sessions`, `GET/DELETE /api/xmsk/sessions/:id`; `POST/GET /api/xmsk/evaluations`, `GET/DELETE /api/xmsk/evaluations/:id`. Every route but `/auth` runs through a `requireAuth` middleware that verifies the `Authorization: Bearer` token. Evaluation verdicts are recomputed server-side from `xmskEvalDefs.ts`, never trusted from the request body.
- `server/xmskAuth.ts` — single shared password (`XMSK_PASSWORD` env var, dev fallback `forestretch1`) checked with `timingSafeEqual`; issues a signed, self-contained token (`base64url(JSON{exp}).HMAC-SHA256`, 12h TTL, secret from `XMSK_SECRET` env var) — no session store, no per-user identity. Locally, `dev:server`/`start` load these from a root `.env` via tsx's `--env-file-if-exists` (see `.env.example`); **whatever platform this app is deployed to, `XMSK_PASSWORD` and `XMSK_SECRET` must be set there too** — the dev fallbacks are not safe for production.
- `server/xmskEvalDefs.ts` — server-side mirror of the evaluation scoring weights/thresholds and `computeXmskEvalVerdict`, kept in sync by hand with `src/lib/xmskEvaluation.ts`.
- `server/types.ts` — request/response shapes, intentionally duplicated (not imported) from `src/types/rom.ts` and `src/types/xmsk.ts` since the two `tsconfig`s use different `moduleResolution`.
- In dev, Vite proxies `/api/*` to `http://localhost:3001` (`vite.config.ts` `server.proxy`) so the two processes need no CORS setup.

TypeScript project references: root `tsconfig.json` → `tsconfig.app.json` (`src/`) + `tsconfig.node.json` (`vite.config.ts` only). `server/tsconfig.json` is standalone, not referenced from the root — `npm run build` never touches `server/`.

Linting is via Oxlint (`.oxlintrc.json`), not ESLint — rules currently enabled: `react/rules-of-hooks`, `react/only-export-components`. Oxlint also covers `server/`.

All three features are reference/aid tools only, not medical diagnostics — stated in each feature's UI, and should stay true of any feature added.

### Deployment

`Dockerfile` (multi-stage: `npm ci && npm run build` then a slim runtime image) + `docker-compose.yml` for running it. `docker-compose.yml` binds `./data` on the host to `/app/server/data` in the container (where `server/db.ts` puts `rom.db`) so the SQLite file survives container rebuilds/recreation and — since it's just a directory — can be copied wholesale to a different host (Google Cloud, AWS, another PC, …) when migrating; `.env.production` (gitignored, not committed) supplies `XMSK_PASSWORD`/`XMSK_SECRET`. Typical run: `docker compose up -d --build`. The `my-app` service listens on `PORT` (`ENV PORT=8080` in the Dockerfile, matching `EXPOSE 8080`) but is not published to the host directly (`expose`, not `ports`) — a `caddy` service (Caddy 2, config in `Caddyfile`) is the only container publishing ports (80/443) and reverse-proxies to `my-app:8080`, automatically obtaining/renewing a Let's Encrypt cert for whatever domain `Caddyfile` names. `Caddyfile`'s domain is a placeholder (`your-domain.example.com`) — must be edited to the real domain, which must have an A record pointing at the host's (ideally static) IP; the host firewall must allow 80 and 443 in (not 8080, since that's no longer host-exposed).
