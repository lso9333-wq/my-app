import { useRef, useState } from 'react'
// 2026-09: 손·발 분석에도 "동시 측정 뇌파 컨텍스트" 기능이 추가되면서, Muse 연결/버퍼/
// 에러 문구 코드가 이 기능 하나만 쓰는 게 아니게 됐다. 기능끼리 서로의 lib을 import하지
// 않는 이 프로젝트의 관례(예외는 HomeScreen→rom 하나) 때문에, 몸 전체 포즈 파이프라인
// (shared/lib/poseDetector.ts)이 여러 기능에서 재사용되는 것과 같은 이유로 이 코드를
// shared/lib/eeg/로 옮겼다 — EegApp 자체의 동작은 전혀 바뀌지 않았다.
import { EegBuffers } from '../../shared/lib/eeg/eegBuffer'
import { connectMuse, isWebBluetoothSupported, type MuseConnection } from '../../shared/lib/eeg/museConnection'
import { translateMuseError } from '../../shared/lib/eeg/errorMessages'
import { EegWaveformChart } from './components/EegWaveformChart'
import { EegBandPowerBars } from './components/EegBandPowerBars'
import { EegSessionHistory } from './components/EegSessionHistory'
import { createEegSession } from './lib/eegApi'
import { AuthError } from '../../shared/lib/authApi'
import type { EegBandPowers, EegConnectionState } from '../../shared/lib/eeg/types'

interface Props {
  token: string
  onAuthError: () => void
}

/**
 * 뇌파(EEG) 실시간 표시 — 사용자가 "소비자용 EEG 헤드밴드 착용 시 측정 결과를 앱에
 * 실시간으로 나타낼 수 있도록" 요청해 추가된 기능. 다른 6개 기능(보행/ROM/손발/XMSK)과
 * 결정적으로 다른 점이 있어 CLAUDE.md에 상세히 적어뒀다:
 *
 * 1) 실시간 파형·버퍼 자체는 여전히 서버로 보내지 않는다 — 연결을 끊거나 새로고침하면
 *    화면에 보이던 값은 그대로 사라진다. 2026-09에 XCTS와 같은 방식으로 "회원별 기록을
 *    남기고 싶다"는 요청이 들어와, "기록 저장" 버튼을 눌렀을 때의 대역 파워 스냅샷
 *    하나만 회원 이름과 함께 서버에 저장하도록 바뀌었다(eegApi.ts, EegSessionHistory
 *    참고) — 그 전까지는 100% 클라이언트 전용이었다. 회원 이름이 담긴 기록을 서버에
 *    저장하게 됐으므로 XCTS와 같은 이유로 앱 전체 로그인이 필요한 탭으로 옮겨졌다
 *    (App.tsx GATED_TABS 참고).
 * 2) 지원 헤드밴드가 Muse(2세대/S 등) 한 종류뿐이다 — 사용자가 두 차례의 확인 질문
 *    끝에 Muse를 선택했고(다른 후보였던 Emotiv 계열은 전용 네이티브 앱 설치가 필요해
 *    제외), Muse는 Web Bluetooth로 브라우저에서 바로 연결되는 muse-js 라이브러리가
 *    실제로 npm에 공개돼 있어 이 앱의 "설치 없이 바로 쓰는 웹앱" 성격과 맞았다.
 */
export function EegApp({ token, onAuthError }: Props) {
  const [connectionState, setConnectionState] = useState<EegConnectionState>('disconnected')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  // 화면엔 항상 한글 안내문(korean)이 먼저/크게 나오고, 원문(raw, 영어일 수 있음)은
  // 참고용으로 작게 같이 보여준다 — errorMessages.ts 참고(2026-09, 사용자 요청).
  const [errorMessage, setErrorMessage] = useState<{ korean: string; raw: string } | null>(null)
  const [latestPowers, setLatestPowers] = useState<EegBandPowers | null>(null)
  const [clientName, setClientName] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  const buffersRef = useRef<EegBuffers | null>(null)
  const connectionRef = useRef<MuseConnection | null>(null)

  const supported = isWebBluetoothSupported()

  // 중요: 이 핸들러 자체가 클릭에 대한 응답으로 동기적으로 시작해야 한다(async
  // 함수여도 첫 줄이 곧바로 connectMuse 호출이면 됨). museConnection.ts 주석 참고 —
  // 중간에 다른 await를 먼저 거치면 Web Bluetooth 기기 선택 팝업이 뜨지 않는다.
  const handleConnect = async () => {
    setErrorMessage(null)
    setConnectionState('connecting')
    buffersRef.current = new EegBuffers()
    try {
      const connection = await connectMuse({
        onEegSample: (electrodeIndex, samples) => {
          const buffers = buffersRef.current
          if (!buffers) return
          for (const value of samples) buffers.pushSample(electrodeIndex, value)
        },
        onBatteryLevel: (level) => setBatteryLevel(level),
        onDisconnected: () => {
          setConnectionState('disconnected')
          connectionRef.current = null
        },
        onError: (message) => {
          setErrorMessage(translateMuseError(message))
          setConnectionState('error')
        },
      })
      connectionRef.current = connection
      setDeviceName(connection.deviceName)
      setConnectionState('connected')
    } catch (err) {
      setConnectionState('error')
      const raw = err instanceof Error ? err.message : String(err)
      setErrorMessage(translateMuseError(raw))
    }
  }

  const handleDisconnect = () => {
    connectionRef.current?.disconnect()
    connectionRef.current = null
    setConnectionState('disconnected')
    setDeviceName(null)
    setBatteryLevel(null)
    setLatestPowers(null)
  }

  const canSave = clientName.trim() !== '' && latestPowers !== null

  const handleSave = async () => {
    if (!canSave || !latestPowers) return
    setSaveState('saving')
    try {
      await createEegSession(token, {
        clientName: clientName.trim(),
        trainerName: trainerName.trim() || undefined,
        deviceName,
        bandPowers: latestPowers,
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

  const running = connectionState === 'connected'

  return (
    <div className="eeg-app">
      <p className="disclaimer">
        ⚠️ 참고용 도구입니다. 의료적 진단이나 전문가의 평가를 대체할 수 없습니다. 실시간 파형은 이
        화면을 여는 동안에만 보이며 서버에 저장되지 않습니다(새로고침·연결 해제 시 사라짐). "기록 저장"
        버튼을 누르면 그 순간의 대역 파워 값만 회원 이름과 함께 저장됩니다.
      </p>

      {!supported && (
        <div className="error-panel">
          이 브라우저는 Web Bluetooth를 지원하지 않아 뇌파 헤드밴드에 연결할 수 없습니다. 안드로이드
          또는 PC의 <strong>Chrome/Edge</strong> 브라우저에서 열어주세요. iOS(아이폰) Safari와 카카오톡
          등 인앱 브라우저에서는 이 기능을 쓸 수 없습니다(애플이 iOS Safari에 Web Bluetooth 기능
          자체를 넣지 않았습니다).
        </div>
      )}

      {supported && (
        <>
          <div className="eeg-connect-row">
            {connectionState !== 'connected' ? (
              <button
                type="button"
                className="eeg-connect-button"
                onClick={handleConnect}
                disabled={connectionState === 'connecting'}
              >
                {connectionState === 'connecting' ? '연결 중...' : 'Muse 헤드밴드 연결'}
              </button>
            ) : (
              <button type="button" className="eeg-connect-button eeg-disconnect-button" onClick={handleDisconnect}>
                연결 해제
              </button>
            )}
            {connectionState === 'connected' && (
              <span className="eeg-device-info">
                {deviceName ?? 'Muse'}
                {batteryLevel !== null && ` · 배터리 ${batteryLevel.toFixed(0)}%`}
              </span>
            )}
          </div>

          {errorMessage && (
            <div className="error-panel">
              <p style={{ margin: 0 }}>{errorMessage.korean}</p>
              {errorMessage.raw && (
                <p className="app-subtitle" style={{ margin: '4px 0 0', fontSize: '11px' }}>
                  (참고용 원본 메시지: {errorMessage.raw})
                </p>
              )}
            </div>
          )}

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

          {connectionState === 'connected' && (
            <>
              <EegWaveformChart buffersRef={buffersRef} running={running} />
              <EegBandPowerBars buffersRef={buffersRef} running={running} onPowersUpdate={setLatestPowers} />

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
              </div>
            </>
          )}

          {connectionState === 'disconnected' && !errorMessage && (
            <p className="app-subtitle">
              Muse 헤드밴드를 착용한 뒤 위 버튼을 눌러 블루투스로 연결하세요. 연결 창이 뜨면 목록에서
              헤드밴드를 선택하면 됩니다.
            </p>
          )}
        </>
      )}

      <EegSessionHistory refreshKey={historyKey} token={token} onAuthError={onAuthError} />
    </div>
  )
}

export default EegApp
