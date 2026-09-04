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

Vite + React 19 + TypeScript SPA with a minimal Express + SQLite backend. Two independent features share one shell:

1. **보행 분석 (gait analysis)** — analyzes a walking video entirely client-side.
2. **스트레칭 가동범위 분석 (stretch ROM analysis)** — analyzes one video where the user marks a "before" and "after" stretching segment, and computes joint range-of-motion change. Only the *computed numeric results* are sent to the backend for storage — raw video and per-frame pose data never leave the browser, in both features.

### Frontend

- `src/main.tsx` — entry point, mounts `App` into `#root`
- `src/App.tsx` — thin shell: header + tab switch between `GaitApp` and `RomApp`
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

### Backend (`server/`)

Minimal Express server, separate from the frontend's `tsconfig.app.json`/build (its own `server/tsconfig.json`, checked via `npm run typecheck:server`, not part of `npm run build`).

- `server/index.ts` — Express app; mounts `/api/rom-sessions`; also serves `dist/` static + SPA fallback (so `npm run build && npm run start` runs frontend + API from one process).
- `server/db.ts` — `node:sqlite`'s `DatabaseSync` opens `server/data/rom.db` (gitignored; directory kept via `server/data/.gitkeep`), creates the `stretch_sessions` table on startup. No native dependency — relies on Node's built-in SQLite (requires a recent Node; confirmed working on v24).
- `server/routes/romSessions.ts` — `POST /api/rom-sessions`, `GET /api/rom-sessions?limit=`, `GET /api/rom-sessions/:id`, with hand-rolled request validation.
- `server/types.ts` — request/response shapes, intentionally duplicated (not imported) from `src/types/rom.ts` since the two `tsconfig`s use different `moduleResolution`.
- In dev, Vite proxies `/api/*` to `http://localhost:3001` (`vite.config.ts` `server.proxy`) so the two processes need no CORS setup.

TypeScript project references: root `tsconfig.json` → `tsconfig.app.json` (`src/`) + `tsconfig.node.json` (`vite.config.ts` only). `server/tsconfig.json` is standalone, not referenced from the root — `npm run build` never touches `server/`.

Linting is via Oxlint (`.oxlintrc.json`), not ESLint — rules currently enabled: `react/rules-of-hooks`, `react/only-export-components`. Oxlint also covers `server/`.

Both features are reference/aid tools only, not medical diagnostics — stated in each feature's UI, and should stay true of any feature added.
