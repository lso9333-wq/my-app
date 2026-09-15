// XCTS(심혈관/전신 컨디션 측정 도구 모음, 2026-09) — Muse 뇌파 헤드밴드에 이어 두
// 번째 외부 생체측정기기 연동. 요청 배경: "Muse 헤드밴드처럼 뇌파 측정기기 뿐만
// 아니라 스마트워치같은 외부연결기기를 검색해서 다양한 생체데이터분석 기능을
// 추가하는 것을 검토해 달라"는 요청 → 조사 결과(docs/wearable-biometric-integration-review.md)
// "일반 스마트워치는 대부분 표준 방식으로 연결 안 됨, 표준 BLE 가슴띠형 심박 센서만
// Muse와 같은 방식(Web Bluetooth 직접 연결)으로 가능"이라는 결론 → "XMSK 안에 두지
// 말고 XCTS를 새로 만들어서" 진행하라는 결정.
//
// XMSK와 달리 "AI 추정치를 트레이너가 검증"하는 구조가 아니라 센서 원본 측정값을
// 그대로 기록하는 것이므로, XMSK의 데이터 품질 대시보드(AI 추정 vs 트레이너 실측
// 보정 파이프라인)에는 포함하지 않는다 — 여기엔 보정할 AI 추정치 자체가 없다.
export type XctsModule = 'heartRate'
// 추후: 심혈관/전신 컨디션 측정 도구 모음이라는 이름에 맞게 다른 측정 도구(예: 수면,
// 체성분 등)를 추가할 때 여기에 새 값을 더하고 XctsApp.tsx에 탭을 하나 늘린다 —
// 지금은 도구가 하나뿐이라 탭 전환 UI는 없지만 이 타입 자체는 확장을 염두에 두고 둔다.

/**
 * 이 심박·HRV 데이터가 어떤 경로로 들어왔는지 — 지금은 표준 BLE 심박 서비스
 * (Polar H10 등, Web Bluetooth로 직접 연결) 하나뿐이다. "추후 스마트워치
 * 제조사/개발사와 협업할 경우도 고려해 달라"는 요청에 따라, 나중에 특정 업체와
 * 파트너십을 맺어 그쪽 SDK/OAuth API로 데이터를 받아오게 되면 여기에 새 값(예:
 * 'partner-sdk')을 추가하고 세션에 어떤 경로로 들어온 데이터인지 구분해 저장한다 —
 * 세션 데이터 모델(XctsSessionCreateRequest)과 화면(XctsResultsPanel/
 * XctsSessionHistory)은 source 종류에 무관하게 그대로 동작하도록 설계했다(실제
 * BLE 연결 코드만 src/shared/lib/heartRate/bleHeartRate.ts에 격리돼 있어, 새 소스를
 * 추가할 때 그 파일과 같은 모양의 새 연결 모듈만 만들면 된다).
 */
export type XctsMeasurementSource = 'ble-heart-rate'

export type { HeartRateWindowSummary } from '../../shared/lib/heartRate/heartRateInterpretation'
import type { HeartRateWindowSummary } from '../../shared/lib/heartRate/heartRateInterpretation'

export interface XctsSessionCreateRequest {
  clientName: string
  trainerName?: string
  deviceSource: XctsMeasurementSource
  deviceName: string | null
  /** ① 분석/활동 시작 전(안정 상태) 60초 캡처. */
  baseline: HeartRateWindowSummary | null
  /** ② 분석/활동 직후 60초 캡처. */
  post: HeartRateWindowSummary | null
  note?: string
}

export interface XctsSessionCreateResponse {
  id: number
  createdAt: string
}

export interface XctsSessionListItem {
  id: number
  createdAt: string
  clientName: string
  trainerName: string | null
  deviceSource: XctsMeasurementSource
  deviceName: string | null
  avgHeartRateDeltaBpm: number | null
}

export interface XctsSessionDetail extends XctsSessionListItem {
  baseline: HeartRateWindowSummary | null
  post: HeartRateWindowSummary | null
  note: string | null
}
