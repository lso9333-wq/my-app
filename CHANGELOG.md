# Changelog

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased] - 2026-09-04

### Added

- 보행 분석 앱 구현: 걷는 영상을 업로드하면 브라우저에서 MoveNet으로 포즈를 추정하고, 케이던스·좌우 대칭성·보폭·좌우 흔들림 등 보행 지표를 계산해 스켈레톤 뷰어·지표 패널·차트로 결과를 표시

### Changed

- 계산기 앱을 보행 분석 앱으로 전면 교체
- README.md, CLAUDE.md를 보행 분석 앱 구조에 맞게 갱신

### Removed

- Linear 스타일 다크 테마의 3D 입체감 계산기 앱
