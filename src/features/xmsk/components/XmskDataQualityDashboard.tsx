import { useEffect, useState } from 'react'
import type { DataQualityFeatureSummary, DataQualitySummary } from '../types'
import { getDataQualitySummary, XmskAuthError } from '../lib/xmskApi'

interface Props {
  token: string
  onAuthError: () => void
}

function coveragePercent(withEstimate: number, withGroundTruth: number): number | null {
  if (withEstimate === 0) return null
  return Math.round((withGroundTruth / withEstimate) * 100)
}

function FeatureSection({
  title,
  summary,
  groundTruthLabel = '트레이너 실측값 있음',
  correctionLabel,
}: {
  title: string
  summary: DataQualityFeatureSummary
  /** ROM/보행은 "실측값" 이지만, 발가락 시뮬레이션은 "트레이너 확인/보정"이라 문구가
   * 다르다 — 계산 방식(withGroundTruth가 뜻하는 것)이 기능마다 다르므로 표시만 바꾼다. */
  groundTruthLabel?: string
  /** 지정하면(발가락 시뮬레이션) "평균 보정폭" 열을 추가로 보여준다 — 항목별
   * avgAbsCorrectionDeg가 있을 때만 의미가 있다. */
  correctionLabel?: string
}) {
  const hasCorrection = correctionLabel !== undefined
  return (
    <div className="rom-xmsk-region">
      <h5>{title}</h5>
      <p className="app-subtitle">
        전체 기록 {summary.totalRecords}건
        {summary.byCalcVersion.length > 0 && (
          <>
            {' '}
            (계산 버전별:{' '}
            {summary.byCalcVersion
              .map((v) => `${v.calcVersion ?? '버전 기록 없음'} ${v.count}건`)
              .join(' · ')}
            )
          </>
        )}
      </p>

      {summary.items.length === 0 ? (
        <p className="rom-history-empty">아직 집계할 데이터가 없습니다.</p>
      ) : (
        <table className="rom-table rom-xmsk-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>AI 추정 있음</th>
              <th>{groundTruthLabel}</th>
              <th>수집률</th>
              {hasCorrection && <th>{correctionLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {summary.items.map((item) => {
              const pct = coveragePercent(item.withEstimate, item.withGroundTruth)
              return (
                <tr key={item.id}>
                  <td>
                    {item.label}
                    {item.unit && <span className="rom-xmsk-unit"> ({item.unit})</span>}
                  </td>
                  <td>{item.withEstimate}건</td>
                  <td>{item.withGroundTruth}건</td>
                  <td>{pct === null ? '—' : `${pct}%`}</td>
                  {hasCorrection && (
                    <td>
                      {item.avgAbsCorrectionDeg === null || item.avgAbsCorrectionDeg === undefined
                        ? '—'
                        : `±${item.avgAbsCorrectionDeg.toFixed(2)}°`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function XmskDataQualityDashboard({ token, onAuthError }: Props) {
  const [summary, setSummary] = useState<DataQualitySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDataQualitySummary(token)
      .then(setSummary)
      .catch((err) => {
        if (err instanceof XmskAuthError) {
          onAuthError()
          return
        }
        setError(err instanceof Error ? err.message : '데이터 품질 정보를 불러오지 못했습니다.')
      })
  }, [token, onAuthError])

  if (error) return <p className="error-panel">{error}</p>
  if (!summary) return <p className="app-subtitle">불러오는 중…</p>

  return (
    <div className="rom-xmsk-estimates">
      <p className="app-subtitle">
        AI가 이미 추정치를 계산해둔 항목마다 트레이너 실측값이 얼마나 쌓였는지 보여줍니다 — 실제로
        계산 로직을 보정하는 학습에 쓰기 충분한 데이터가 모였는지 판단하는 참고용 화면입니다. "수집률"은
        AI 추정이 있었던 기록 중 트레이너 실측값까지 채워진 비율입니다.
      </p>
      <FeatureSection title="스트레칭 ROM (XMSK 추정 항목)" summary={summary.rom} />
      <FeatureSection title="보행 분석" summary={summary.gait} />
      <FeatureSection
        title="발가락 마디별 시뮬레이션 (발 분석)"
        summary={summary.foot}
        groundTruthLabel="트레이너 확인/보정"
        correctionLabel="평균 보정폭"
      />
      {summary.foot.items.length > 0 && (
        <p className="app-subtitle">
          "평균 보정폭"은 AI가 처음에 낸 시뮬레이션 값과 트레이너가 실제로 고쳐 쓴 값의 평균 절대 차이입니다 —
          이 값이 항목별로 꾸준히 크게 나오면 TOE_SEGMENT_SIM_PARAMS(발가락 마디별 결합계수)를 다시 맞출
          시점이라는 신호로 참고할 수 있습니다. 통계적으로 의미 있으려면 항목당 최소 수십 건은 필요합니다
          (docs/ai-training-plan.md 참고).
        </p>
      )}
      <FeatureSection title="손가락 관절 14개 (손 분석)" summary={summary.hand} groundTruthLabel="트레이너 확인/보정" />
      {summary.hand.items.length > 0 && (
        <p className="app-subtitle">
          손가락 관절은 발가락과 달리 이미 실제 랜드마크로 직접 계산한 값이라(시뮬레이션으로 배분한 값이 아님)
          "평균 보정폭"을 보여주지 않습니다 — 대신 수집률이 꾸준히 높게 나오는지를 보고, 나중에 포즈 인식
          파이프라인 자체의 관절별 정확도를 검증하는 데 씁니다(docs/ai-training-plan.md 참고).
        </p>
      )}
    </div>
  )
}
