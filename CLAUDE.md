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

This is a minimal Vite + React 19 + TypeScript single-page app — currently a calculator UI.

- `src/main.tsx` — entry point, mounts `App` into `#root`
- `src/App.tsx` — contains the entire calculator: state (`display`, `previousValue`, `operator`, `waitingForOperand`) and all button handlers live in one component; `calculate()` is the pure arithmetic function for `+ - × ÷`
- `src/App.css` / `src/index.css` — styling
- TypeScript project is split into `tsconfig.app.json` (src) and `tsconfig.node.json` (Vite config), referenced from the root `tsconfig.json`

Linting is via Oxlint (`.oxlintrc.json`), not ESLint — rules currently enabled: `react/rules-of-hooks`, `react/only-export-components`.

Not a git repository yet.
