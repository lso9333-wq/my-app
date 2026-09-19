export type JointKey =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'

export interface RomJointResult {
  joint: JointKey
  label: string
  beforeMinDeg: number | null
  beforeMaxDeg: number | null
  beforeRomDeg: number | null
  afterMinDeg: number | null
  afterMaxDeg: number | null
  afterRomDeg: number | null
  deltaRomDeg: number | null
}

export type XmskEstimateEvidence = 'approximate' | 'experimental'

/** ROM 영상 분석에서 추가로 추정하는, XMSK 통증 레시피 "0.5 상태체크"/"3. 마무리"
 * 입력 항목에 대응하는 값. 자세한 내용은 src/features/rom/lib/xmskEstimates.ts 참고
 * (프론트/서버 타입을 의도적으로 중복 정의하는 기존 관례를 따름). */
export interface RomXmskEstimateResult {
  id: string
  label: string
  unit: string
  beforeValue: number | null
  afterValue: number | null
  deltaValue: number | null
  evidence: XmskEstimateEvidence
  note: string
}

/**
 * 손목 신전·굴곡 저항처럼 영상으로는 잴 수 없어 트레이너가 직접 관찰한 값을 입력하는
 * 항목. id는 프론트엔드의 XmskManualItemDef.id(예: 'wristResist_left')와 같은 값을 쓴다.
 * 자세한 내용은 src/features/rom/lib/xmskEstimates.ts 참고(프론트/서버 타입 중복 관례).
 */
export interface RomXmskManualInput {
  id: string
  beforeValue: number | null
  afterValue: number | null
}

/**
 * AI 추정치(RomXmskEstimateResult)가 이미 있는 항목에 대해, 트레이너가 실제로
 * 관찰·측정한 값을 나란히 기록해두는 "정답값". estimateId는
 * RomXmskEstimateResult.id(예: 'legAbduction_left')와 같다. 서버는 내용을 계산에
 * 쓰지 않고 그대로 저장/반환만 한다 — 자세한 배경은
 * src/features/rom/types.ts와 docs/ai-training-plan.md 참고(프론트/서버 타입 중복 관례).
 */
export interface RomXmskGroundTruth {
  estimateId: string
  verifiedValue: number | null
}

export interface RomSessionCreateRequest {
  videoName: string
  clientName: string
  trainerName?: string
  beforeStartSec: number
  beforeEndSec: number
  afterStartSec: number
  afterEndSec: number
  results: RomJointResult[]
  xmskEstimates?: RomXmskEstimateResult[]
  xmskManualInputs?: RomXmskManualInput[]
  xmskGroundTruth?: RomXmskGroundTruth[]
  /** 프론트엔드 ANALYSIS_PIPELINE_VERSION(shared/lib/poseDetector.ts)을 그대로 저장한다
   * — 서버는 내용을 검사하지 않고 문자열인지만 확인해 그대로 저장/반환한다. */
  calcVersion?: string
}

export interface RomManualInputsUpdateRequest {
  xmskManualInputs: RomXmskManualInput[]
}

export interface RomGroundTruthUpdateRequest {
  xmskGroundTruth: RomXmskGroundTruth[]
}

export interface RomSessionRow {
  id: number
  created_at: string
  video_name: string
  client_name: string
  trainer_name: string | null
  before_start_sec: number
  before_end_sec: number
  after_start_sec: number
  after_end_sec: number
  results_json: string
  xmsk_estimates_json: string
  xmsk_manual_inputs_json: string
  xmsk_ground_truth_json: string
  calc_version: string | null
}

export type XmskRegionKey =
  | 'neckShoulder'
  | 'lowBack'
  | 'knee'
  | 'ankle'
  | 'hip'
  | 'elbow'
  | 'wrist'
  | 'upperBack'

export interface XmskMeasurementValue {
  id: string
  value?: number
  left?: number
  right?: number
}

export interface XmskSessionCreateRequest {
  region: XmskRegionKey
  clientName: string
  trainerName?: string
  redFlagsCleared: boolean
  note?: string
  before: XmskMeasurementValue[]
  after: XmskMeasurementValue[]
}

export interface XmskSessionRow {
  id: number
  created_at: string
  region: string
  client_name: string
  trainer_name: string | null
  red_flags_cleared: number
  note: string | null
  before_json: string
  after_json: string
}

export interface XmskEvaluationCreateRequest {
  traineeName: string
  evaluatorName?: string
  evaluationDate: string
  scores: Record<string, number>
  requiredPass: Record<string, boolean>
  comment?: string
}

export interface XmskEvaluationRow {
  id: number
  created_at: string
  trainee_name: string
  evaluator_name: string | null
  evaluation_date: string
  scores_json: string
  required_pass_json: string
  comment: string | null
}

/**
 * 보행분석에서 걸음이 잘 감지되지 않을 때 원인 파악을 위해 남기는 진단 기록.
 * 기기/브라우저별로 포즈 인식이 왜 실패하는지 비교할 수 있도록 저장한다.
 */
export interface GaitDiagnosticCreateRequest {
  videoName: string
  deviceInfo: string
  clientName?: string
  trainerName?: string
  videoWidth: number
  videoHeight: number
  durationSec: number
  attemptedFrames: number
  noPoseFrames: number
  droppedFrames: number
  keptFrames: number
  avgHipScore: number
  avgLeftAnkleScore: number
  avgRightAnkleScore: number
  avgLeftHeelScore: number
  avgRightHeelScore: number
  sampledTimesChecksum: number
  totalSteps: number
  cadenceStepsPerMin: number
  note?: string
  /**
   * 프론트엔드 `GaitMetrics`(src/features/gait/types.ts) 전체를 그대로 저장한다 —
   * 진단 기록 상세 PDF에 방금 분석한 결과 화면과 같은 통계/그래프를 "2페이지"로
   * 함께 넣기 위해, 이 진단 기록을 남긴 시점의 전체 지표(좌우 걸음 간격, 대칭성,
   * 걸음 간격 시계열, 전도 위험 등)를 함께 보관해둔다. 서버는 내용을 검사하지 않고
   * 그대로 JSON으로 저장/반환만 한다(다른 *_json 컬럼과 같은 방식).
   */
  gaitMetrics?: Record<string, unknown>
  /**
   * 케이던스·좌우 대칭성·전도 위험 점수처럼 AI가 이미 계산한 지표 옆에 트레이너가
   * 실제 관찰한 값을 적어두는 "정답값" — 서버는 내용을 검사하지 않고 배열인지만
   * 확인해 그대로 저장/반환한다(다른 *_json 컬럼과 같은 방식). 자세한 내용은
   * src/features/gait/types.ts의 GaitGroundTruth, docs/ai-training-plan.md 참고.
   */
  groundTruth?: unknown[]
  /** 프론트엔드 ANALYSIS_PIPELINE_VERSION(shared/lib/poseDetector.ts)을 그대로 저장한다. */
  calcVersion?: string
}

export interface GaitGroundTruthUpdateRequest {
  groundTruth: unknown[]
}

/**
 * 손 분석(MediaPipeHands 21랜드마크, shared/lib/handDetector.ts)에서 계산하는 손가락
 * 관절 각도 14개 — 네 손가락(검지·중지·약지·소지) 각 3관절(MCP·PIP·DIP) + 엄지
 * 2관절(MCP·IP). 자세한 내용은 src/features/handfoot/types.ts 참고(프론트/서버 타입
 * 중복 관례).
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
 * "동시 측정 뇌파 컨텍스트" — 손·발 분석 결과를 해석하는 최신 연구자료를 검색·적용해
 * 달라는 요청으로 추가됐다. 자세한 연구 근거·설계 이유는
 * src/shared/lib/eeg/eegInterpretation.ts 상단 주석 참고. 서버는 이 값의 내용을
 * 검사하지 않고(다른 *_json 컬럼과 같은 방식) 그대로 저장/반환만 하지만, 타입은 여기서
 * 프론트엔드와 별개로 중복 정의한다(server/types.ts의 기존 관례 — moduleResolution이
 * 서로 달라 import할 수 없음).
 */
export type EegChannelName = 'TP9' | 'AF7' | 'AF8' | 'TP10' | 'AUX'

export interface EegBandPowers {
  delta: number
  theta: number
  alpha: number
  beta: number
  gamma: number
}

export interface EegWindowSummary {
  capturedAt: string
  channelBandPowers: Partial<Record<EegChannelName, EegBandPowers>>
  averageBandPowers: EegBandPowers | null
  frontalAlphaAsymmetry: number | null
}

export interface EegHandFootContext {
  deviceName: string | null
  baseline: EegWindowSummary | null
  during: EegWindowSummary | null
}

export interface EegContextUpdateRequest {
  eegContext: EegHandFootContext
}

/**
 * 뇌파(EEG) 실시간 표시 기록 저장 — 2026-09 추가. 원래 이 기능은 서버에 아무것도
 * 저장하지 않는 100% 클라이언트 전용이었으나(src/features/eeg/types.ts 옛 주석 참고),
 * XCTS와 같은 식으로 "회원별 기록"을 남기고 싶다는 요청에 따라 XctsSessionCreateRequest와
 * 같은 패턴으로 추가한다. 손·발의 EegHandFootContext(baseline/during 비교, 채널별
 * 세부 breakdown)보다 가벼운 형태로 둔다 — 여기서는 화면에 실시간으로 보여주는 것과
 * 같은 4채널 평균 대역 파워(EegBandPowers) 스냅샷 하나만 저장한다.
 */
export interface EegSessionCreateRequest {
  clientName: string
  trainerName?: string
  deviceName: string | null
  bandPowers: EegBandPowers
  note?: string
}

export interface EegSessionRow {
  id: number
  created_at: string
  client_name: string
  trainer_name: string | null
  device_name: string | null
  band_powers_json: string
  note: string | null
}

/**
 * 손가락 관절(HandJointResult)은 이미 실제 랜드마크로 직접 계산한 값이라, 발가락
 * 마디별 시뮬레이션(FootManualToeInput)과 달리 ROM의 RomXmskGroundTruth와 같은
 * 성격의 "AI 계산 vs 트레이너 실측" 정답값을 붙인다. id는 `${side}_${joint}`
 * 형식(예: 'left_indexMcp') — 자세한 내용은 src/features/handfoot/types.ts 참고
 * (프론트/서버 타입 중복 관례).
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
  /** 프론트엔드 HAND_ANALYSIS_PIPELINE_VERSION(shared/lib/handDetector.ts)을 그대로
   * 저장한다 — 서버는 문자열인지만 확인해 그대로 저장/반환한다. */
  calcVersion?: string
  /** (선택) 동시 측정 뇌파 컨텍스트. */
  eegContext?: EegHandFootContext
  /** (선택) 트레이너 실측값 — 서버는 배열인지만 검사하고 내용은 그대로 저장/반환한다. */
  handGroundTruth?: HandJointGroundTruth[]
}

export interface HandGroundTruthUpdateRequest {
  handGroundTruth: HandJointGroundTruth[]
}

export interface HandSessionRow {
  id: number
  created_at: string
  video_name: string
  client_name: string
  trainer_name: string | null
  before_start_sec: number
  before_end_sec: number
  after_start_sec: number
  after_end_sec: number
  left_results_json: string
  right_results_json: string
  calc_version: string | null
  eeg_context_json: string | null
  hand_ground_truth_json: string | null
}

/**
 * 발 분석에서 개별 발가락 관절을 카메라로 구분해 인식할 수 있는 검증된 모델이 없어
 * (src/features/handfoot/lib/footToeEstimate.ts 참고), AI 추정은 항상 'experimental'
 * 하나뿐이다.
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

/** 발가락 10마디(발 한쪽 기준) 항목. 2026-09부터 AI 시뮬레이션 초기값(source:
 * 'estimated')이 자동으로 채워지고, 트레이너가 확인/수정하면 'trainer'로 바뀐다 —
 * 서버는 값을 검사 없이 그대로 저장/반환만 한다(다른 *_json 컬럼과 같은 방식). id는
 * src/features/handfoot/lib/handfootManualItems.ts의 FOOT_MANUAL_TOE_ITEMS[].id와 같다. */
export interface FootManualToeInput {
  id: string
  beforeValue: number | null
  afterValue: number | null
  source?: 'estimated' | 'trainer'
  /** AI 시뮬레이션 초기값을 영구 보존한 값 — src/features/handfoot/types.ts의 같은
   * 필드 주석 참고. 서버는 검사 없이 그대로 저장/반환만 한다. */
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
  /** 발 분석은 두 계산 단계를 합쳐 기록한다: 몸 전체 포즈 파이프라인
   * (ANALYSIS_PIPELINE_VERSION, shared/lib/poseDetector.ts)과 발가락 마디별 시뮬레이션
   * 배분식(FOOT_TOE_SIM_VERSION, src/features/handfoot/lib/footToeEstimate.ts) —
   * `${ANALYSIS_PIPELINE_VERSION}+toeSim:${FOOT_TOE_SIM_VERSION}` 형태의 문자열.
   * 서버는 문자열인지만 검사하고 내용은 그대로 저장/반환한다. */
  calcVersion?: string
  /** (선택) 동시 측정 뇌파 컨텍스트 — HandSessionCreateRequest와 같은 필드. */
  eegContext?: EegHandFootContext
}

export interface FootManualToeUpdateRequest {
  manualToeInputs: FootManualToeInput[]
}

export interface FootSessionRow {
  id: number
  created_at: string
  video_name: string
  client_name: string
  trainer_name: string | null
  before_start_sec: number
  before_end_sec: number
  after_start_sec: number
  after_end_sec: number
  toe_estimates_json: string
  manual_toe_inputs_json: string
  calc_version: string | null
  eeg_context_json: string | null
}

/**
 * 데이터 품질 대시보드(XMSK "데이터 품질" 모듈, server/routes/xmsk.ts의
 * GET /api/xmsk/data-quality)의 응답 형태. ROM/보행 각각에 대해, AI가 이미 추정치를
 * 계산해둔 항목마다 트레이너 실측값이 얼마나 쌓였는지 집계해 보여준다 — 실제 보정
 * 학습을 시작할 만큼 데이터가 모였는지 판단하기 위한 참고용 화면이다. 자세한 배경은
 * docs/ai-training-plan.md 참고.
 */
export interface DataQualityItemStat {
  id: string
  label: string
  unit: string
  /** 이 항목에 AI 추정값이 실제로 계산된(즉 null이 아닌) 기록 수. */
  withEstimate: number
  /** 그중 트레이너 실측값(ground truth)까지 입력된 기록 수. */
  withGroundTruth: number
  /**
   * (선택) 발가락 마디별 시뮬레이션처럼 AI 추정값 자체가 남아있어 "트레이너가 실제로
   * 고쳐 쓴 값과 AI 추정값의 평균 절대 차이(°)"를 계산할 수 있는 항목에만 채워진다.
   * ROM/보행처럼 별도 ground-truth 필드로 실측값을 저장하는 경우엔 원본 AI 추정값이
   * 남아있지 않아 undefined다. 이 값이 클수록 TOE_SEGMENT_SIM_PARAMS(결합계수)의
   * 보정이 시급하다는 신호로 읽을 수 있다(docs/ai-training-plan.md 참고).
   */
  avgAbsCorrectionDeg?: number | null
}

export interface DataQualityVersionCount {
  calcVersion: string | null
  count: number
}

export interface DataQualityFeatureSummary {
  totalRecords: number
  byCalcVersion: DataQualityVersionCount[]
  items: DataQualityItemStat[]
}

export interface DataQualitySummary {
  rom: DataQualityFeatureSummary
  gait: DataQualityFeatureSummary
  /** 2026-09 추가 — 발가락 마디별 시뮬레이션(TOE_SEGMENT_SIM_PARAMS) 보정 현황. */
  foot: DataQualityFeatureSummary
  /** 2026-09 추가 — 손가락 관절 14개(양손) AI 계산 vs 트레이너 실측 수집 현황. */
  hand: DataQualityFeatureSummary
}

/**
 * XCTS(심혈관/전신 컨디션 측정 도구 모음, 2026-09) — Muse 뇌파 연동에 이어 두 번째
 * 외부 생체측정기기 연동. XMSK와 달리 "AI 추정 vs 트레이너 실측"을 다루는 게
 * 아니라 센서 원본 측정값을 그대로 기록하는 성격이라, XMSK 안에 두지 않고 별도
 * 최상위 탭·별도 세션 저장소로 분리했다(사용자의 명시적 결정). 자세한 내용은
 * src/features/xcts/types.ts 참고(프론트/서버 타입 중복 관례).
 */
export type XctsMeasurementSource = 'ble-heart-rate' | 'samsung-health-export'

export interface HeartRateWindowSummary {
  capturedAt: string
  avgHeartRateBpm: number | null
  rmssdMs: number | null
  sampleCount: number
  rrIntervalCount: number
}

export interface XctsSessionCreateRequest {
  clientName: string
  trainerName?: string
  deviceSource: XctsMeasurementSource
  deviceName: string | null
  baseline: HeartRateWindowSummary | null
  post: HeartRateWindowSummary | null
  note?: string
}

export interface XctsSessionRow {
  id: number
  created_at: string
  client_name: string
  trainer_name: string | null
  device_source: string
  device_name: string | null
  baseline_json: string | null
  post_json: string | null
  note: string | null
}

export interface GaitDiagnosticRow {
  id: number
  created_at: string
  video_name: string
  device_info: string
  client_name: string | null
  trainer_name: string | null
  video_width: number
  video_height: number
  duration_sec: number
  attempted_frames: number
  no_pose_frames: number
  dropped_frames: number
  kept_frames: number
  avg_hip_score: number
  avg_left_ankle_score: number
  avg_right_ankle_score: number
  avg_left_heel_score: number
  avg_right_heel_score: number
  sampled_times_checksum: number
  total_steps: number
  cadence_steps_per_min: number
  note: string | null
  gait_metrics_json: string | null
  ground_truth_json: string | null
  calc_version: string | null
}
