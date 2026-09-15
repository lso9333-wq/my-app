import { defineConfig } from 'vitest/config'

// 2026-09: 이 프로젝트는 원래 테스트 러너가 없었다(CLAUDE.md 참고). 인프라 개선
// 요청에 따라 처음 도입하면서, 순수 계산 함수(RMSSD, ROM 관절 각도, 공용 수학
// 유틸 등)부터 우선 테스트를 붙이기로 했다 — 캔버스/카메라/Web Bluetooth 같은
// 브라우저 API에 의존하는 컴포넌트·캡처 로직은 jsdom으로 어설프게 흉내내기보다는
// 이번 범위 밖으로 남겨둔다(값 검증이 명확한 순수 함수부터 커버하는 게 이 프로젝트
// 규모에 비용 대비 효과적이라는 판단).
//
// vite.config.ts(React 플러그인, @mediapipe/* 별칭)를 건드리지 않고 완전히 별개의
// 설정 파일로 둔 이유: 테스트 대상 함수들은 React나 mediapipe 셔밈을 전혀 import하지
// 않는 순수 TypeScript라 그 플러그인/별칭이 필요 없고, 기존 빌드 설정에 손대지 않는
// 편이 더 안전하다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
