# Changelog

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased] - 2026-09-07

### Added

- 보행 분석 앱 구현: 걷는 영상을 업로드하면 브라우저에서 MoveNet으로 포즈를 추정하고, 케이던스·좌우 대칭성·보폭·좌우 흔들림 등 보행 지표를 계산해 스켈레톤 뷰어·지표 패널·차트로 결과를 표시
- 스트레칭 전/후 관절 가동범위(ROM) 분석 기능 추가: 한 영상에서 스트레칭 전/후 구간을 지정하면 관절별 각도 변화를 계산해 표시
- Cloud Run 배포를 위한 Dockerfile 추가
- XMSK 탭 추가: 비밀번호로 보호된 FORéSTRETCH 트레이너 전용 도구
  - 통증 레시피 가이드(부위별 Red Flag → Before/After 비교 → 셀프케어)
  - 근육 32개 WHY·STRETCH·RELEASE 기술 사전
  - LEVEL1 현장투입 평가표(자동 채점·판정)
  - 저장된 세션·평가 기록 조회 및 삭제
- Cloud Run 지속적 배포(Cloud Build 트리거) 설정: master 브랜치 push 시 자동 빌드·배포

### Changed

- 계산기 앱을 보행 분석 앱으로 전면 교체
- README.md, CLAUDE.md를 보행 분석 앱 구조에 맞게 갱신
- 앱 이름을 "MyDoctor"로 변경
- Vite dev 서버를 LAN에서도 접속 가능하도록 설정
- ROM 분석 영상 업로드 안내 문구를 스트레칭 전후 촬영에 맞게 수정
- README.md를 MyDoctor(보행 분석 + ROM 분석, 백엔드 포함) 구조에 맞게 갱신

### Removed

- Linear 스타일 다크 테마의 3D 입체감 계산기 앱
