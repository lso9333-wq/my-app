---
description: git 커밋 히스토리를 바탕으로 CHANGELOG.md를 작성/갱신합니다
argument-hint: "[버전] (예: v0.2.0, 생략 시 Unreleased)"
allowed-tools: Bash(git log:*), Bash(git tag:*), Bash(git diff:*), Read, Write, Edit
---

## 컨텍스트

- 최신 태그: !`git describe --tags --abbrev=0 2>/dev/null || echo "(태그 없음)"`
- 최신 태그 이후 커밋 목록: !`git log $(git describe --tags --abbrev=0 2>/dev/null)..HEAD --pretty=format:"- %s (%h)" 2>/dev/null || git log --pretty=format:"- %s (%h)"`
- 현재 CHANGELOG.md: @CHANGELOG.md

## 작업

위 커밋 목록을 바탕으로 `CHANGELOG.md`를 작성하거나 갱신하라.

1. `CHANGELOG.md`가 없으면 [Keep a Changelog](https://keepachangelog.com) 형식으로 새로 만든다.
2. 커밋 메시지를 의미 단위로 묶어 `### Added` / `### Changed` / `### Fixed` / `### Removed` 섹션으로 분류한다. Conventional Commits 접두사(`feat:`, `fix:`, `chore:` 등)가 있으면 그에 맞춰 분류하고, 없으면 커밋 내용을 보고 판단한다. 의미 없는 커밋(오타 수정, 머지 커밋 등)은 제외한다.
3. 버전 헤딩은 `## [$ARGUMENTS] - YYYY-MM-DD` 형식으로 쓴다. `$ARGUMENTS`가 비어 있으면 `## [Unreleased]`로 쓴다. 날짜는 오늘 날짜를 쓴다.
4. 새 버전 섹션은 파일 맨 위(기존 `## [Unreleased]` 섹션이 있다면 그 아래, 이전 버전들 위)에 추가한다.
5. 내용은 한국어로, 간결하게 한 줄씩 작성한다.
6. 작성 후 변경된 `CHANGELOG.md` 내용을 요약해서 보고한다. 커밋은 직접 하지 않는다 (사용자가 확인 후 요청 시 커밋).
