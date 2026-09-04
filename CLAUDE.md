# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 지침

- 결과값(답변, 요약, 커밋 메시지 등 사용자에게 보여지는 텍스트)과 설명은 항상 한국어로 작성한다.
- 코드, 변수명, 파일명 등 코드 자체의 관례는 기존 방식(영어)을 따른다.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check via `tsc -b` then production build via `vite build`
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build locally

There is no test runner configured in this project.

## Architecture

Vite + React 19 + TypeScript single-page app that analyzes gait (걸음걸이) from an uploaded side-view walking video, entirely in the browser — no backend, no video ever leaves the client.

**Pipeline:** `VideoUploader` → `poseDetector.extractPoseFrames` (TensorFlow.js MoveNet, seek-and-estimate per frame) → `gaitAnalysis.computeGaitMetrics` (peak-detection over ankle trajectories) → `SkeletonViewer` / `GaitMetricsPanel` / `GaitCharts` render the results.

- `src/main.tsx` — entry point, mounts `App` into `#root`
- `src/App.tsx` — owns the pipeline state machine (`AnalysisStage`: `idle → loading-model → processing → analyzing → done`/`error`) and wires the upload → detect → analyze → render flow. `SAMPLING_FPS` (12) and `MAX_ANALYSIS_SECONDS` (20) cap analysis cost.
- `src/lib/poseDetector.ts` — loads a singleton MoveNet SinglePose Thunder detector (webgl backend) and `extractPoseFrames()`, which seeks the hidden `<video>` element frame-by-frame at `samplingFps` and runs pose estimation on each frame (deterministic since it's not realtime playback). Also exports `POSE_CONNECTIONS` (skeleton edge list) used by `SkeletonViewer`.
- `src/lib/gaitAnalysis.ts` — pure function `computeGaitMetrics(frames)`: normalizes ankle-y trajectories by an estimated leg-length scale, finds foot-strike peaks per side, derives cadence, step interval/length, left-right symmetry, and lateral sway. All distance metrics are in leg-length-relative units, not meters, since camera distance/angle isn't controlled.
- `src/types/gait.ts` — shared types: `PoseFrame`, `StepEvent`, `GaitMetrics`, `AnalysisStage`.
- `src/components/VideoUploader.tsx` — drag/drop + tap-to-pick file input, idle-stage UI.
- `src/components/SkeletonViewer.tsx` — scrubbable playback of the source video with the detected skeleton drawn over it on a `<canvas>`.
- `src/components/GaitMetricsPanel.tsx` — numeric summary of the computed `GaitMetrics`.
- `src/components/GaitCharts.tsx` — `StepIntervalChart` (step interval over time) and `ComparisonBarChart` (left vs. right bar comparisons).
- `src/shims/mediapipe-pose-shim.ts` — stub for `@mediapipe/pose`, which `@tensorflow-models/pose-detection` statically imports for its BlazePose runtime even though this app only uses MoveNet. Aliased in `vite.config.ts` so the real (non-ESM) package doesn't break the production build.
- `src/App.css` / `src/index.css` — styling.
- TypeScript project is split into `tsconfig.app.json` (src) and `tsconfig.node.json` (Vite config), referenced from the root `tsconfig.json`.

Linting is via Oxlint (`.oxlintrc.json`), not ESLint — rules currently enabled: `react/rules-of-hooks`, `react/only-export-components`.

The app is a reference/aid tool only, not a medical diagnostic — this is stated in the UI itself and should stay true of any feature added.
