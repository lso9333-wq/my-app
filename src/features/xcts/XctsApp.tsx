import { useState } from 'react'
import { HeartRateCaptureControl } from './components/HeartRateCaptureControl'
import { XctsResultsPanel } from './components/XctsResultsPanel'
import { XctsSessionHistory } from './components/XctsSessionHistory'
import { createXctsSession } from './lib/xctsApi'
import { AuthError } from '../../shared/lib/authApi'
import type { HeartRateWindowSummary, XctsModule } from './types'

const MODULE_DESCRIPTIONS: Record<XctsModule, string> = {
  heartRate: '표준 BLE 심박 센서를 연결해 활동 전/후 심박수·HRV 변화를 측정합니다.',
}

interface Props {
  token: string
  onAuthError: () => void
}

/**
 * XCTS(심혈관/전신 컨디션 측정 도구 모음, 2026-09) — Muse 뇌파 연동에 이어 두 번째
 * 외부 생체측정기기 연동. XMSK 안에 두지 않고 별도 최상위 탭으로 분리했다(사용자의
 * 명시적 결정) — XMSK는 "AI 추정 vs 트레이너 실측"을 다루는 통증 재활 도구인 반면,
 * XCTS는 센서 원본 측정값을 그대로 기록하는 성격이 달라서다.
 *
 * XmskApp.tsx처럼 모듈 탭 구조를 갖추되(MODULE_DESCRIPTIONS), 지금은 도구가
 * "심박·HRV 측정" 하나뿐이라 탭 전환 UI는 아직 없다 — 이름 그대로 "도구 모음"으로
 * 자라날 것을 염두에 두고 타입(XctsModule)만 미리 확장 가능한 형태로 둔 것.
 */
function XctsApp({ token, onAuthError }: Props) {
  const [xctsModule] = useState<XctsModule>('heartRate')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<HeartRateWindowSummary | null>(null)
  const [post, setPost] = useState<HeartRateWindowSummary | null>(null)
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  const handleCaptured = (phase: 'baseline' | 'post', summary: HeartRateWindowSummary) => {
    if (phase === 'baseline') setBaseline(summary)
    else setPost(summary)
  }

  const canSave = clientName.trim() !== '' && (baseline !== null || post !== null)

  const handleSave = async () => {
    if (!canSave) return
    setSaveState('saving')
    try {
      await createXctsSession(token, {
        clientName: clientName.trim(),
        trainerName: trainerName.trim() || undefined,
        deviceSource: 'ble-heart-rate',
        deviceName,
        baseline,
        post,
      })
      setSaveState('saved')
      setHistoryKey((k) => k + 1)
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : '기록 저장에 실패했습니다.')
    }
  }

  const handleReset = () => {
    setBaseline(null)
    setPost(null)
    setClientName('')
    setTrainerName('')
    setSaveState('idle')
    setSaveError(null)
  }

  return (
    <div className="rom-app">
      <p className="app-subtitle">
        심혈관/전신 컨디션을 측정하는 도구 모음입니다. Muse 뇌파 헤드밴드와 마찬가지로 외부 기기를 연결해 손·발/ROM
        분석과는 별개로 자체 기록을 남깁니다.
      </p>
      <p className="disclaimer">⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다.</p>
      <p className="app-subtitle xmsk-module-desc">{MODULE_DESCRIPTIONS[xctsModule]}</p>

      {xctsModule === 'heartRate' && (
        <>
          <div className="xmsk-section">
            <div className="xmsk-eval-header-grid">
              <label>
                회원 이름
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="회원 이름"
                />
              </label>
              <label>
                담당 트레이너
                <input
                  type="text"
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  placeholder="담당 트레이너 이름 (선택)"
                />
              </label>
            </div>
          </div>

          <HeartRateCaptureControl
            baseline={baseline}
            post={post}
            deviceName={deviceName}
            onCaptured={handleCaptured}
            onDeviceNameChange={setDeviceName}
          />

          <XctsResultsPanel baseline={baseline} post={post} deviceName={deviceName} />

          {(baseline || post) && (
            <div className="results">
              {!canSave && clientName.trim() === '' && (
                <p className="rom-validation">저장하려면 회원 이름을 입력해야 합니다.</p>
              )}
              <button type="button" disabled={!canSave || saveState === 'saving'} onClick={handleSave}>
                {saveState === 'saving' ? '저장 중...' : '기록 저장'}
              </button>
              <p className="rom-save-status">
                {saveState === 'saved' && '기록이 저장되었습니다.'}
                {saveState === 'error' && `저장 실패: ${saveError}`}
              </p>
              <button type="button" className="reset-button" onClick={handleReset}>
                새로 측정하기
              </button>
            </div>
          )}
        </>
      )}

      <XctsSessionHistory refreshKey={historyKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}

export default XctsApp
