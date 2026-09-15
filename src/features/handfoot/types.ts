// 2026-09: "뇌파(EEG) 데이터를 분석해서 손발분석결과를 해석하는 최신 연구자료를
// 검색하고 적용해 달라"는 요청으로 추가된 "동시 측정 뇌파 컨텍스트" 기능의 타입.
// 실제 계산/조사 근거는 shared/lib/eeg/eegInterpretation.ts 상단 주석 참고 — 요약하면
// Muse의 전극 위치로는 "어느 손/발이 움직였는가"를 해석할 수 없다는 게 확인돼, 대신
// 분석 전(안정)/직후(활동) 두 시점의 전두엽 알파 비대칭·이완도 변화를 참고 지표로만
// 함께 기록한다. 이 타입은 shared에 정의돼 있으므로 여기서는 재수출만 한다(다른
// 기능의 lib을 직접 import하지 않는 관례는 shared는 예외 — poseDetector.ts와 같음).
export type { EegHandFootContext, EegWindowSummary } from '../../shared/lib/eeg/eegInterpretation'
import type { EegHandFootContext } from '../../shared/lib/eeg/eegInterpretation'

export interface HandFootRange {
  start: number
  end: number
}

export type HandFootAnalysisStage =
  | 'idle'
  | 'loading-model'
  | 'marking-range'
  | 'processing'
  | 'analyzing'
  | 'done'
  | 'error'

/**
 * MediaPipeHands 21랜드마크로 계산 가능한 손가락 관절 각도 14개 —
 * 네 손가락(검지·중지·약지·소지) 각 3관절(MCP·PIP·DIP) + 엄지 2관절(MCP·IP).
 * 자세한 근거는 src/shared/lib/handDetector.ts, docs/ai-training-plan.md 참고.
 */
export type HandJointKey =
  | 'thumbMcp'
  | 'thumbIp'
  | 'indexMcp'
  | 'indexPip'
  | 'indexDip'
  | 'middleMcp'
  | 'middlePip'
  | 'middleDip'
  | 'ringMcp'
  | 'ringPip'
  | 'ringDip'
  | 'pinkyMcp'
  | 'pinkyPip'
  | 'pinkyDip'

export interface HandJointResult {
  joint: HandJointKey
  label: string
  beforeMinDeg: number | null
  beforeMaxDeg: number | null
  beforeRomDeg: number | null
  afterMinDeg: number | null
  afterMaxDeg: number | null
  afterRomDeg: number | null
  deltaRomDeg: number | null
}

/**
 * 2026-09: "손가락마디별 시뮬레이션도 나오게 해달라"는 요청에 대해, 발가락과 달리
 * 손가락 14관절은 이미 MediaPipeHands 21랜드마크로 실제 랜드마크를 잡아 직접
 * 계산한 값이라(FootManualToeInput처럼 신호 하나를 결합계수로 배분해 "시뮬레이션"할
 * 이유가 없음) 대신 ROM의 RomXmskGroundTruth와 같은 성격의 "AI 계산 vs 트레이너
 * 실측" 정답값 수집 기능을 붙이기로 했다 — 나중에 데이터가 쌓이면 포즈 인식
 * 파이프라인 자체의 관절별 정확도를 검증/보정하는 데 쓴다(docs/ai-training-plan.md
 * 참고). id는 `${side}_${joint}` 형식이다 — HandJointKey는 왼손/오른손 양쪽에
 * 똑같이 쓰이는 관절 이름이라(leftResults/rightResults로 배열 자체가 나뉘어 있음)
 * ROM(JointKey에 이미 leftShoulder처럼 좌우가 포함됨)과 달리 구분자가 필요하다.
 * ROM의 xmskEstimates·보행 지표처럼 이 값도 before/after 구분 없이 항목당 하나의
 * verifiedValue만 기록한다(기존 관례를 그대로 따름 — 트레이너가 가장 대표적이라고
 * 판단한 값 하나를 적어두는 용도).
 */
export interface HandJointGroundTruth {
  id: string
  verifiedValue: number | null
}

export interface HandSessionCreateRequest {
  videoName: string
  clientName: string
  trainerName?: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  leftResults: HandJointResult[]
  rightResults: HandJointResult[]
  /** 손 분석 파이프라인 버전 (HAND_ANALYSIS_PIPELINE_VERSION, shared/lib/handDetector.ts). */
  calcVersion?: string
  /** (선택) 동시 측정 뇌파 컨텍스트 — Muse를 연결하지 않았거나 캡처하지 않았으면 생략. */
  eegContext?: EegHandFootContext
  /** (선택) 분석 직후에는 보통 비어 있고, 트레이너가 결과를 보고 나서 채운다 —
   * 대부분 별도 PUT(updateHandSessionGroundTruth)으로 갱신된다. */
  handGroundTruth?: HandJointGroundTruth[]
}

export interface HandSessionCreateResponse {
  id: number
  createdAt: string
}

export interface HandSessionListItem {
  id: number
  createdAt: string
  videoName: string
  clientName: string
  trainerName: string | null
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  avgDeltaRomDeg: number | null
}

export interface HandSessionDetail extends HandSessionListItem {
  leftResults: HandJointResult[]
  rightResults: HandJointResult[]
  calcVersion: string | null
  eegContext: EegHandFootContext | null
  handGroundTruth: HandJointGroundTruth[]
}

/** hand ground-truth PUT 엔드포인트 요청 본문 — eeg-context/manual-toe-inputs와 같은
 * 이유(분석 직후 자동 저장 이후, 트레이너가 나중에 관찰해 채우는 값을 별도로 갱신)로 뗀다. */
export interface HandGroundTruthUpdateRequest {
  handGroundTruth: HandJointGroundTruth[]
}

/** eeg-context PUT 엔드포인트 요청 본문 — manual-toe-inputs와 같은 이유(분석 직후
 * 자동 저장 이후, "활동" 캡처처럼 나중에 값이 채워지는 필드를 별도로 갱신)로 뗀다. */
export interface EegContextUpdateRequest {
  eegContext: EegHandFootContext
}

/**
 * 카메라로는 발가락 하나하나의 관절을 구분해 인식할 수 있는 검증된 모델이 없어(개별
 * 발가락 랜드마크 모델 부재), AI는 발 전체를 대표하는 실험적 근사치 하나만 낸다 —
 * 자세한 배경은 lib/footToeEstimate.ts, docs/ai-training-plan.md 참고.
 */
export type FootEvidence = 'experimental'

export interface FootToeEstimateResult {
  side: 'left' | 'right'
  label: string
  unit: string
  beforeValue: number | null
  afterValue: number | null
  deltaValue: number | null
  evidence: FootEvidence
  note: string
}

/**
 * AI가 카메라만으로 발가락 하나하나의 관절을 직접 인식하지는 못하므로, "발가락
 * 10마디"(발가락 5개 × 관절 2개: 중족지관절 MTP + 지절간관절 IP 통합)는 기본적으로
 * 트레이너가 직접 관찰·측정해 확정하는 항목이다 — ROM의 wristResist(손목 저항 검사)와
 * 같은 성격. 다만 2026-09 업데이트로 lib/footToeEstimate.ts의
 * `computeFootToeSegmentEstimates()`가 발 전체 실험적 신호(FootToeEstimateResult)에
 * 연구 기반 결합계수를 곱해 20개 항목 각각의 "시뮬레이션 초기값"을 미리 채워준다 —
 * `source`가 이 값이 아직 AI 시뮬레이션 상태인지, 트레이너가 직접 확인/수정했는지를
 * 구분한다(트레이너가 값을 편집하는 순간 'trainer'로 바뀐다). 값이 없던 예전 기록은
 * `source`가 없을 수 있다(레거시 — 순수 수기 입력으로 취급). id는
 * lib/handfootManualItems.ts의 FOOT_MANUAL_TOE_ITEMS[].id와 같다.
 */
export interface FootManualToeInput {
  id: string
  beforeValue: number | null
  afterValue: number | null
  source?: 'estimated' | 'trainer'
  /**
   * 2026-09: "나중에 실측값이 충분히 쌓이면 발가락 마디별 시뮬레이션 결합계수
   * (TOE_SEGMENT_SIM_PARAMS)를 보정/파인튜닝해볼 수 있지 않을까"라는 방향에 대한
   * 구체적인 첫 단계 — computeFootToeSegmentEstimates()가 이 항목의 "AI 시뮬레이션
   * 초기값"을 처음 채울 때의 beforeValue/afterValue를 여기 그대로 복사해 영구
   * 보존한다. 트레이너가 나중에 beforeValue/afterValue를 직접 고쳐써도(source가
   * 'trainer'로 바뀌어도) 이 두 필드는 절대 덮어쓰지 않는다 — 그래야 "AI가 처음에
   * 뭐라고 추정했는지"와 "트레이너가 실제로 확인한 값"을 나중에 짝지어 비교할 수 있다
   * (docs/ai-training-plan.md의 "옵션 B: 경량 보정 모델" 참고). 값이 없던 예전 기록
   * 이나, AI가 애초에 이 발의 신호를 못 구해 시뮬레이션하지 못한 경우엔 undefined/null로
   * 남는다.
   */
  estimatedBeforeValue?: number | null
  estimatedAfterValue?: number | null
}

export interface FootSessionCreateRequest {
  videoName: string
  clientName: string
  trainerName?: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  toeEstimates?: FootToeEstimateResult[]
  manualToeInputs?: FootManualToeInput[]
  /** 발 분석은 기존 몸 전체 포즈 파이프라인을 그대로 쓰므로 ANALYSIS_PIPELINE_VERSION
   * (shared/lib/poseDetector.ts)을 그대로 저장한다. */
  calcVersion?: string
  /** (선택) 동시 측정 뇌파 컨텍스트 — HandSessionCreateRequest와 같은 필드. */
  eegContext?: EegHandFootContext
}

export interface FootManualToeUpdateRequest {
  manualToeInputs: FootManualToeInput[]
}

export interface FootSessionCreateResponse {
  id: number
  createdAt: string
}

export interface FootSessionListItem {
  id: number
  createdAt: string
  videoName: string
  clientName: string
  trainerName: string | null
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  avgAbsDelta: number | null
}

export interface FootSessionDetail extends FootSessionListItem {
  toeEstimates: FootToeEstimateResult[]
  manualToeInputs: FootManualToeInput[]
  calcVersion: string | null
  eegContext: EegHandFootContext | null
}

export type HandFootModule = 'hand' | 'foot'
