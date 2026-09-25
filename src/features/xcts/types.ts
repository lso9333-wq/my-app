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
 * 이 심박·HRV 데이터가 어떤 경로로 들어왔는지 — "추후 스마트워치 제조사/개발사와
 * 협업할 경우도 고려해 달라"는 요청에 따라 확장 가능한 유니온으로 설계했다. 실제로
 * 이 확장성이 그대로 쓰였다: 2026-09에 "삼성 헬스 CSV 업로드" 기능을 추가하면서 새
 * 값 `'samsung-health-export'`를 여기 하나 더하는 것만으로 세션 데이터 모델
 * (XctsSessionCreateRequest)과 화면(XctsResultsPanel/XctsSessionHistory)을 다시
 * 설계할 필요가 없었다 — 서버 쪽도 `deviceSource`를 특정 문자열로 검증하지 않고
 * "비어있지 않은 문자열인지"만 확인하므로 서버 코드도 그대로였다(server/routes/
 * xctsSessions.ts 참고). 나중에 특정 업체와 파트너십을 맺어 SDK/OAuth API로 데이터를
 * 받아오게 되면 같은 방식으로 새 값(예: 'partner-sdk')만 추가하면 된다.
 *
 * - `'ble-heart-rate'`: 표준 BLE 심박 서비스(Polar H10 등, Web Bluetooth로 직접 연결).
 *   실제 연결 코드는 src/shared/lib/heartRate/bleHeartRate.ts.
 * - `'samsung-health-export'`: 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수
 *   CSV 파일을 브라우저에서 직접 파싱(서버 전송 없이) — 파싱 코드는
 *   src/shared/lib/heartRate/samsungHealthImport.ts. RR간격을 제공하지 않는 파일이라
 *   HRV(RMSSD)는 계산하지 않는다(항상 null).
 */
export type XctsMeasurementSource = 'ble-heart-rate' | 'samsung-health-export'

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

// --- 최종당화산물지수(AGEs Index) 기록 (2026-09) ---
//
// 심박·HRV 세션(XctsSessionCreateRequest)과 저장소를 공유하지 않는다 — 심박 세션은
// "하나의 baseline/post 스냅샷"이 한 세션인 반면, 최종당화산물지수는 CSV 한 번
// 업로드에 여러 날짜의 기록이 함께 들어있고 그걸 시계열로 쌓아 보여주는 게 목적이라
// 근본적으로 다른 데이터 모양이다(agesIndexImport.ts 상단 주석 참고). XCTS 탭 안에서
// 심박 측정 UI 근처에 얹혀 있지만 서버 쪽은 별도 테이블/엔드포인트
// (server/routes/xctsAgesIndex.ts, /api/xcts-ages-index)를 쓴다 — hand_sessions/
// foot_sessions처럼 "기능별 테이블 하나"를 쓰는 이 프로젝트의 기존 관례를 그대로
// 따른 것.
export type { AgesIndexRecord } from '../../shared/lib/agesIndex/agesIndexImport'
import type { AgesIndexRecord } from '../../shared/lib/agesIndex/agesIndexImport'

export interface AgesIndexUploadRequest {
  clientName: string
  trainerName?: string
  deviceSource: XctsMeasurementSource
  /** parseAgesIndexCsv()가 만든 날짜별 기록 배열을 그대로 실어 보낸다 — 한 번의
   * 업로드가 여러 날짜의 기록을 한꺼번에 저장하는 벌크 삽입이다. */
  records: AgesIndexRecord[]
}

export interface AgesIndexUploadResponse {
  insertedCount: number
}

export interface AgesIndexRecordListItem {
  id: number
  createdAt: string
  clientName: string
  trainerName: string | null
  dayTimeRaw: string
  dayTimeLabel: string | null
  score: number
  grade: string
}
