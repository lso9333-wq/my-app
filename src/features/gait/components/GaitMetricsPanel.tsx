import type { FallRiskAssessment, GaitMetrics } from '../types'
import type { ExtractDebugStats } from '../../../shared/lib/poseDetector'

interface Props {
  metrics: GaitMetrics
  /** 걸음이 거의 감지되지 않았을 때 원인을 화면에서 바로 짐작할 수 있게 해주는 진단 정보 (선택) */
  debugStats?: ExtractDebugStats | null
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function symmetryNote(percent: number): string {
  if (percent < 5) return '매우 대칭적'
  if (percent < 10) return '대체로 대칭적'
  if (percent < 20) return '경미한 비대칭'
  return '뚜렷한 비대칭'
}

const FALL_RISK_LABEL: Record<FallRiskAssessment['level'], string> = {
  low: '낮음',
  moderate: '보통',
  high: '높음',
  'insufficient-data': '데이터 부족',
}

function FallRiskPanel({ fallRisk }: { fallRisk: FallRiskAssessment }) {
  if (fallRisk.level === 'insufficient-data') {
    return (
      <div className="fall-risk-panel">
        <div className="fall-risk-head">
          <h3>전도(낙상) 위험 참고 지표</h3>
        </div>
        <p className="fall-risk-empty">
          걸음 수가 적어 전도 위험 참고 점수를 계산하지 못했습니다. 좀 더 긴 구간을 걷는 영상으로 다시
          시도해 보세요.
        </p>
      </div>
    )
  }

  return (
    <div className={`fall-risk-panel fall-risk-${fallRisk.level}`}>
      <div className="fall-risk-head">
        <h3>전도(낙상) 위험 참고 지표</h3>
        <span className="fall-risk-badge">
          {FALL_RISK_LABEL[fallRisk.level]}
        </span>
      </div>
      <div className="fall-risk-score-row">
        <div className="fall-risk-score-bar">
          <div className="fall-risk-score-fill" style={{ width: `${fallRisk.score}%` }} />
        </div>
        <span className="fall-risk-score-value">{fallRisk.score}/100</span>
      </div>
      <ul className="fall-risk-factor-list">
        {fallRisk.factors.map((f) => (
          <li key={f.key} className="fall-risk-factor">
            <span className="fall-risk-factor-label">{f.label}</span>
            <span className="fall-risk-factor-note">{f.note}</span>
          </li>
        ))}
      </ul>
      <p className="fall-risk-disclaimer">
        ⚠️ 걸음 리듬·좌우 대칭성·흔들림 등을 종합한 참고용 점수이며, 검증된 임상 낙상 확률이 아닙니다.
        낙상 위험이 걱정된다면 반드시 의료진의 보행 평가를 받으세요.
      </p>
    </div>
  )
}

function DebugStatsPanel({ stats }: { stats: ExtractDebugStats }) {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`
  return (
    <div className="debug-stats-panel">
      <p className="debug-stats-title">진단 정보 (문의 시 이 내용을 함께 알려주세요)</p>
      <ul className="debug-stats-list">
        <li>
          영상 해상도: {stats.videoWidth}×{stats.videoHeight}
        </li>
        <li>
          시도한 프레임: {stats.attemptedFrames}개 · 사람 미검출: {stats.noPoseFrames}개 · 신뢰도 부족으로
          제외: {stats.droppedFrames}개 · 최종 채택: {stats.keptFrames}개
        </li>
        <li>
          평균 신뢰도 — 골반 {pct(stats.avgHipScore)} · 왼쪽 발목 {pct(stats.avgLeftAnkleScore)} · 오른쪽
          발목 {pct(stats.avgRightAnkleScore)} · 왼쪽 뒤꿈치 {pct(stats.avgLeftHeelScore)} · 오른쪽 뒤꿈치{' '}
          {pct(stats.avgRightHeelScore)}
        </li>
        <li>샘플링 시간 체크섬: {stats.sampledTimesChecksum}</li>
      </ul>
    </div>
  )
}

export function GaitMetricsPanel({ metrics, debugStats }: Props) {
  const {
    totalSteps,
    durationSec,
    cadenceStepsPerMin,
    stepIntervalCV,
    leftMeanStepIntervalSec,
    rightMeanStepIntervalSec,
    temporalSymmetryPercent,
    stepLengthSymmetryPercent,
    fallRisk,
  } = metrics

  if (totalSteps < 2) {
    return (
      <div className="metrics-empty-wrap">
        <div className="metrics-empty">
          걸음을 충분히 감지하지 못했습니다. 인물이 화면에 온전히, 옆에서 걷는 모습으로 나오는
          영상으로 다시 시도해 보세요.
        </div>
        {debugStats && <DebugStatsPanel stats={debugStats} />}
      </div>
    )
  }

  return (
    <div className="gait-metrics">
      <div className="stat-grid">
        <StatTile
          label="케이던스"
          value={`${cadenceStepsPerMin.toFixed(0)} 걸음/분`}
          sub={`총 ${totalSteps}걸음 · ${durationSec.toFixed(1)}초`}
        />
        <StatTile
          label="평균 걸음 간격"
          value={`${(metrics.meanStepIntervalSec * 1000).toFixed(0)}ms`}
          sub={`변동성(CV) ${stepIntervalCV.toFixed(1)}%`}
        />
        <StatTile
          label="좌우 시간 대칭성"
          value={`${temporalSymmetryPercent.toFixed(1)}%`}
          sub={`${symmetryNote(temporalSymmetryPercent)} · 좌 ${(leftMeanStepIntervalSec * 1000).toFixed(0)}ms / 우 ${(rightMeanStepIntervalSec * 1000).toFixed(0)}ms`}
        />
        <StatTile
          label="좌우 보폭 대칭성"
          value={`${stepLengthSymmetryPercent.toFixed(1)}%`}
          sub={symmetryNote(stepLengthSymmetryPercent)}
        />
      </div>
      <FallRiskPanel fallRisk={fallRisk} />
    </div>
  )
}
