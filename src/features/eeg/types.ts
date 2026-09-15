// 뇌파(EEG) 실시간 표시 기능의 타입 정의.
//
// 이 기능은 이 앱의 다른 6개 기능(보행/ROM/손발/XMSK 등)과 달리 서버에 아무것도
// 저장하지 않는다 — 100% 클라이언트(브라우저) 안에서만 동작한다. 이유는 CLAUDE.md의
// "뇌파(EEG) 실시간 표시" 절 참고. 그래서 여기엔 서버 API 타입이 없다.

/** muse-js가 실제로 내보내는 채널 이름과 같은 순서 — TP9/AF7/AF8/TP10은 뇌파 전극,
 * AUX는 사용자가 추가로 연결할 수 있는 보조 전극(Muse 2/S 기본 구성엔 없음). */
export const EEG_CHANNEL_NAMES = ['TP9', 'AF7', 'AF8', 'TP10', 'AUX'] as const
export type EegChannelName = (typeof EEG_CHANNEL_NAMES)[number]

/** Muse는 AUX 전극 없이 파는 경우가 대부분이라, 화면엔 앞의 4채널만 기본 표시한다. */
export const DISPLAYED_CHANNEL_COUNT = 4

export const EEG_SAMPLE_RATE_HZ = 256

/** 표준 뇌파 주파수 대역 — CLAUDE.md에 인용된 일반적인 정의를 그대로 따른다. */
export interface EegBand {
  key: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'
  label: string
  minHz: number
  maxHz: number
}

export const EEG_BANDS: EegBand[] = [
  { key: 'delta', label: '델타 (0.5–4Hz, 깊은 수면)', minHz: 0.5, maxHz: 4 },
  { key: 'theta', label: '세타 (4–8Hz, 졸림·명상)', minHz: 4, maxHz: 8 },
  { key: 'alpha', label: '알파 (8–13Hz, 편안한 각성)', minHz: 8, maxHz: 13 },
  { key: 'beta', label: '베타 (13–30Hz, 집중·각성)', minHz: 13, maxHz: 30 },
  { key: 'gamma', label: '감마 (30–45Hz, 고차 인지)', minHz: 30, maxHz: 45 },
]

/** 채널별 최근 대역 파워(㎼ 상대값 아님 — µV² 단위의 상대적 크기, 절대 비교용이 아니라
 * 화면 안에서의 상대적 변화 확인용이라는 점을 UI에 명시한다). */
export type EegBandPowers = Record<EegBand['key'], number>

export interface EegConnectionInfo {
  deviceName: string | null
  batteryLevel: number | null
}

export type EegConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'
