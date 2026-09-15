import { useRef, useState } from 'react'
import { EegBuffers } from '../../../shared/lib/eeg/eegBuffer'
import { connectMuse, isWebBluetoothSupported, type MuseConnection } from '../../../shared/lib/eeg/museConnection'
import { translateMuseError } from '../../../shared/lib/eeg/errorMessages'
import { summarizeEegWindow } from '../../../shared/lib/eeg/eegInterpretation'
import type { EegHandFootContext } from '../types'

interface Props {
  eegContext: EegHandFootContext
  onContextChange: (context: EegHandFootContext) => void
}

/** 캡처 전 잠깐 대기하는 시간 — 연결 직후나 손·발을 다시 편한 자세로 두고 나서 곧바로
 * 누르는 경우가 많을 것으로 보고, 순간값이 아니라 최근 1초 이상 안정적으로 쌓인 구간을
 * 요약하도록(summarizeEegWindow가 FFT_WINDOW_SAMPLES=256개, 즉 최근 1초를 본다) 버튼을
 * 누른 시점부터 살짝 여유를 둔다. */
const CAPTURE_DELAY_MS = 2500

/**
 * 손·발 분석 화면에 얹는 "동시 측정 뇌파 컨텍스트" 캡처 UI — src/features/eeg/EegApp.tsx의
 * Muse 연결 코드(이제 shared/lib/eeg/에 있음)를 재사용하되, 실시간 파형/대역파워를 계속
 * 보여주는 대신 두 번의 스냅샷("① 안정" / "② 활동")만 캡처해 부모(HandAnalysisPanel/
 * FootAnalysisPanel)에 올려보낸다.
 *
 * 중요한 전제: 이 캡처는 업로드된 영상의 특정 프레임과 동기화돼 있지 않다 — 영상은
 * 미리 촬영해 업로드하는 것이라 촬영 당시의 뇌파를 나중에 재구성할 수 없기 때문이다.
 * 대신 "이 방문(세션) 동안" 트레이너가 실제로 Muse를 씌운 채 ① 분석 시작 전(안정 상태)과
 * ② 영상을 촬영/분석한 직후(활동 상태)에 각각 버튼을 눌러 얻는 스냅샷 두 개를 비교한다 —
 * shared/lib/eeg/eegInterpretation.ts 상단 주석에 이 지표들의 연구 근거와 한계가 정리돼
 * 있다.
 */
export function EegCaptureControl({ eegContext, onContextChange }: Props) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  )
  const [errorMessage, setErrorMessage] = useState<{ korean: string; raw: string } | null>(null)
  const [capturing, setCapturing] = useState<'baseline' | 'during' | null>(null)

  const buffersRef = useRef<EegBuffers | null>(null)
  const connectionRef = useRef<MuseConnection | null>(null)

  const supported = isWebBluetoothSupported()

  // EegApp.handleConnect와 같은 이유로 클릭에 대한 동기적 응답으로 시작해야 한다 —
  // museConnection.ts 주석 참고.
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
        onBatteryLevel: () => {},
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
      setConnectionState('connected')
      onContextChange({ ...eegContext, deviceName: connection.deviceName })
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
  }

  const handleCapture = (phase: 'baseline' | 'during') => {
    setCapturing(phase)
    window.setTimeout(() => {
      const buffers = buffersRef.current
      setCapturing(null)
      if (!buffers) return
      const summary = summarizeEegWindow(buffers)
      onContextChange({
        deviceName: connectionRef.current?.deviceName ?? eegContext.deviceName,
        baseline: phase === 'baseline' ? summary : eegContext.baseline,
        during: phase === 'during' ? summary : eegContext.during,
      })
    }, CAPTURE_DELAY_MS)
  }

  if (!supported) {
    // EegApp의 안내 문구와 같은 이유 — 다만 손·발 분석 자체는 이 헤드밴드 없이도 그대로
    // 쓸 수 있는 선택 기능이므로 error-panel이 아니라 옅은 안내문 하나로만 보여준다.
    return (
      <p className="app-subtitle">
        (선택) 이 브라우저는 Web Bluetooth를 지원하지 않아 뇌파 헤드밴드 동시 측정을 쓸 수 없습니다 — 손·발 분석
        자체에는 영향이 없습니다.
      </p>
    )
  }

  return (
    <div className="xmsk-section">
      <p className="app-subtitle">
        (선택) Muse 뇌파 헤드밴드를 연결하면, 분석 전/후 두 시점의 이완도·정서 관련 참고 지표를 결과와 함께 기록할
        수 있습니다. 손·발 관절 각도 계산 자체와는 무관한 부가 정보입니다.
      </p>

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
        {connectionState === 'connected' && <span className="eeg-device-info">{eegContext.deviceName ?? 'Muse'}</span>}
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

      {connectionState === 'connected' && (
        <div className="eeg-capture-buttons">
          <button type="button" disabled={capturing !== null} onClick={() => handleCapture('baseline')}>
            {capturing === 'baseline' ? '측정 중...' : `① 안정 상태 측정${eegContext.baseline ? ' (다시 측정)' : ''}`}
          </button>
          <button type="button" disabled={capturing !== null} onClick={() => handleCapture('during')}>
            {capturing === 'during' ? '측정 중...' : `② 활동 상태 측정${eegContext.during ? ' (다시 측정)' : ''}`}
          </button>
        </div>
      )}
      {capturing !== null && (
        <p className="app-subtitle">머리띠를 그대로 착용한 채 잠시(약 {CAPTURE_DELAY_MS / 1000}초) 기다려 주세요...</p>
      )}
      {(eegContext.baseline || eegContext.during) && (
        <p className="app-subtitle">
          기록됨: {eegContext.baseline ? '① 안정' : ''}
          {eegContext.baseline && eegContext.during ? ' · ' : ''}
          {eegContext.during ? '② 활동' : ''}
        </p>
      )}
    </div>
  )
}
