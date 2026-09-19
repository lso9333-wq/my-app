import { useRef, useState, type ChangeEvent } from 'react'
import {
  connectBleHeartRate,
  isWebBluetoothSupported,
  type BleHeartRateConnection,
  type HeartRateSample,
} from '../../../shared/lib/heartRate/bleHeartRate'
import { translateHeartRateError, type TranslatedError } from '../../../shared/lib/heartRate/errorMessages'
import { summarizeHeartRateWindow, type HeartRateWindowSummary } from '../../../shared/lib/heartRate/heartRateInterpretation'
import {
  parseSamsungHealthHeartRateCsv,
  SamsungHealthImportError,
  SAMSUNG_HEALTH_HRV_NOTE,
} from '../../../shared/lib/heartRate/samsungHealthImport'
import type { XctsMeasurementSource } from '../types'

/** HRV(RMSSD) 계산이 참고할 만하려면 어느 정도 길이의 구간이 필요하다 — 표준 HRV
 * 프로토콜은 보통 1~5분을 권장하지만, 트레이너가 현장에서 바로 쓸 수 있어야 하므로
 * 60초로 절충했다(heartRateInterpretation.ts의 evidence 표기 참고). */
const CAPTURE_WINDOW_MS = 60_000

interface Props {
  baseline: HeartRateWindowSummary | null
  post: HeartRateWindowSummary | null
  deviceName: string | null
  onCaptured: (phase: 'baseline' | 'post', summary: HeartRateWindowSummary, source: XctsMeasurementSource) => void
  onDeviceNameChange: (deviceName: string | null) => void
}

/**
 * XCTS의 "심박·HRV 측정" 도구 — EegCaptureControl.tsx와 같은 성격(연결 → ①/②
 * 스냅샷 캡처)이지만, EEG는 버튼을 누른 순간 최근 1초를 요약하는 반면 이건 60초
 * 동안 실시간으로 들어오는 심박 샘플을 모아서 그 구간을 요약한다 — RMSSD는 순간값이
 * 아니라 일정 구간의 RR간격이 있어야 계산되기 때문이다.
 *
 * 2026-09에 두 번째 데이터 소스(삼성 헬스 CSV 업로드)가 추가됐다 — BLE 실시간 연결과
 * 달리 헤드리스로 즉시 하나의 요약값이 나오므로, 파싱에 성공하면 그 값을 ①/② 중
 * 어디에 쓸지 사용자가 고르게 한 뒤 BLE 캡처와 같은 onCaptured 콜백으로 전달한다.
 * CSV 업로드는 Web Bluetooth 지원 여부와 무관하므로(파일 입력일 뿐 블루투스가
 * 필요 없음) `supported`가 false여도(iOS Safari 등) 항상 사용할 수 있다.
 */
export function HeartRateCaptureControl({ baseline, post, deviceName, onCaptured, onDeviceNameChange }: Props) {
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  )
  const [errorMessage, setErrorMessage] = useState<TranslatedError | null>(null)
  const [capturing, setCapturing] = useState<'baseline' | 'post' | null>(null)
  const [remainingSec, setRemainingSec] = useState(0)

  const [csvError, setCsvError] = useState<string | null>(null)
  const [pendingCsv, setPendingCsv] = useState<{ summary: HeartRateWindowSummary; fileName: string } | null>(null)

  const connectionRef = useRef<BleHeartRateConnection | null>(null)
  const samplesRef = useRef<HeartRateSample[]>([])
  const captureTimerRef = useRef<number | null>(null)
  const tickTimerRef = useRef<number | null>(null)
  // capturing state는 클로저 안 onSample 콜백에서 최신 값을 봐야 해서 ref로도 겹쳐 둔다.
  const capturingRef = useRef<'baseline' | 'post' | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const supported = isWebBluetoothSupported()

  // bleHeartRate.ts 상단 설명과 같은 이유로 클릭에 대한 동기적 응답으로 시작해야 한다.
  const handleConnect = async () => {
    setErrorMessage(null)
    setConnectionState('connecting')
    try {
      const connection = await connectBleHeartRate({
        onSample: (sample) => {
          if (capturingRef.current) samplesRef.current.push(sample)
        },
        onDisconnected: () => {
          setConnectionState('disconnected')
          connectionRef.current = null
        },
        onError: (message) => {
          setErrorMessage(translateHeartRateError(message))
          setConnectionState('error')
        },
      })
      connectionRef.current = connection
      setConnectionState('connected')
      onDeviceNameChange(connection.deviceName)
    } catch (err) {
      setConnectionState('error')
      const raw = err instanceof Error ? err.message : String(err)
      setErrorMessage(translateHeartRateError(raw))
    }
  }

  const handleDisconnect = () => {
    connectionRef.current?.disconnect()
    connectionRef.current = null
    setConnectionState('disconnected')
  }

  const handleCapture = (phase: 'baseline' | 'post') => {
    samplesRef.current = []
    capturingRef.current = phase
    setCapturing(phase)
    setRemainingSec(CAPTURE_WINDOW_MS / 1000)

    tickTimerRef.current = window.setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1))
    }, 1000)

    captureTimerRef.current = window.setTimeout(() => {
      if (tickTimerRef.current !== null) window.clearInterval(tickTimerRef.current)
      capturingRef.current = null
      setCapturing(null)
      const summary = summarizeHeartRateWindow(samplesRef.current)
      onCaptured(phase, summary, 'ble-heart-rate')
    }, CAPTURE_WINDOW_MS)
  }

  const handleCsvButtonClick = () => {
    csvInputRef.current?.click()
  }

  const handleCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 같은 파일을 다시 골라도 onChange가 또 발생하도록 입력값을 매번 비운다.
    e.target.value = ''
    if (!file) return

    setCsvError(null)
    setPendingCsv(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const summary = parseSamsungHealthHeartRateCsv(text)
        setPendingCsv({ summary, fileName: file.name })
      } catch (err) {
        setCsvError(
          err instanceof SamsungHealthImportError
            ? err.message
            : '파일을 읽는 중 문제가 발생했습니다. CSV 파일이 맞는지 확인해주세요.',
        )
      }
    }
    reader.onerror = () => {
      setCsvError('파일을 읽지 못했습니다. 다시 시도해주세요.')
    }
    reader.readAsText(file)
  }

  const handleUsePendingCsv = (phase: 'baseline' | 'post') => {
    if (!pendingCsv) return
    onCaptured(phase, pendingCsv.summary, 'samsung-health-export')
    onDeviceNameChange(`삼성 헬스 CSV (${pendingCsv.fileName})`)
    setPendingCsv(null)
  }

  return (
    <div className="xmsk-section">
      <p className="app-subtitle">
        Polar H10/Verity Sense 같은 표준 BLE 심박 센서(가슴띠형)를 연결하면, 분석/활동 전후 각 60초씩 평균
        심박수·HRV(RMSSD)를 측정해 비교할 수 있습니다. 일반 스마트워치(애플워치·갤럭시워치 등)는 대부분 이 방식으로
        연결되지 않습니다 — 표준 심박 서비스를 지원하는 가슴띠형 센서가 필요합니다. 센서가 없다면 삼성 헬스 앱에서
        내보낸 심박수 CSV 파일을 대신 업로드할 수 있습니다.
      </p>

      <div className="eeg-connect-row">
        {supported &&
          (connectionState !== 'connected' ? (
            <button
              type="button"
              className="eeg-connect-button"
              onClick={handleConnect}
              disabled={connectionState === 'connecting'}
            >
              {connectionState === 'connecting' ? '연결 중...' : '심박 센서 연결'}
            </button>
          ) : (
            <button type="button" className="eeg-connect-button eeg-disconnect-button" onClick={handleDisconnect}>
              연결 해제
            </button>
          ))}
        {supported && connectionState === 'connected' && (
          <span className="eeg-device-info">{deviceName ?? '심박 센서'}</span>
        )}

        <button type="button" className="eeg-connect-button" onClick={handleCsvButtonClick} disabled={capturing !== null}>
          삼성 헬스 CSV 업로드
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCsvFileChange}
        />
      </div>

      {!supported && (
        <p className="app-subtitle">
          이 브라우저는 Web Bluetooth를 지원하지 않아 심박 센서 직접 연결은 쓸 수 없습니다(Chrome/Edge 안드로이드·PC만
          지원 — iOS 사파리, 카카오톡 등 인앱 브라우저는 지원되지 않습니다). 삼성 헬스 CSV 업로드는 이 브라우저에서도
          그대로 사용할 수 있습니다.
        </p>
      )}

      {errorMessage && supported && (
        <div className="error-panel">
          <p style={{ margin: 0 }}>{errorMessage.korean}</p>
          {errorMessage.raw && (
            <p className="app-subtitle" style={{ margin: '4px 0 0', fontSize: '11px' }}>
              (참고용 원본 메시지: {errorMessage.raw})
            </p>
          )}
        </div>
      )}

      {csvError && (
        <div className="error-panel">
          <p style={{ margin: 0 }}>{csvError}</p>
        </div>
      )}

      {pendingCsv && (
        <div className="xmsk-section">
          <p className="app-subtitle" style={{ margin: 0 }}>
            "{pendingCsv.fileName}"에서 평균 심박수 {pendingCsv.summary.avgHeartRateBpm?.toFixed(1)}bpm을 찾았습니다
            (샘플 {pendingCsv.summary.sampleCount}개). {SAMSUNG_HEALTH_HRV_NOTE}
          </p>
          <div className="eeg-capture-buttons">
            <button type="button" onClick={() => handleUsePendingCsv('baseline')}>
              ① 안정 상태 값으로 저장
            </button>
            <button type="button" onClick={() => handleUsePendingCsv('post')}>
              ② 활동 직후 값으로 저장
            </button>
            <button type="button" className="reset-button" onClick={() => setPendingCsv(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {supported && connectionState === 'connected' && (
        <div className="eeg-capture-buttons">
          <button type="button" disabled={capturing !== null} onClick={() => handleCapture('baseline')}>
            {capturing === 'baseline' ? `측정 중... (${remainingSec}초)` : `① 안정 상태 측정 (60초)${baseline ? ' — 다시 측정' : ''}`}
          </button>
          <button type="button" disabled={capturing !== null} onClick={() => handleCapture('post')}>
            {capturing === 'post' ? `측정 중... (${remainingSec}초)` : `② 활동 직후 측정 (60초)${post ? ' — 다시 측정' : ''}`}
          </button>
        </div>
      )}
      {capturing !== null && (
        <p className="app-subtitle">센서를 그대로 착용한 채 60초간 가만히 있어주세요 — 움직이면 측정 정확도가 떨어집니다.</p>
      )}
      {(baseline || post) && (
        <p className="app-subtitle">
          기록됨: {baseline ? '① 안정' : ''}
          {baseline && post ? ' · ' : ''}
          {post ? '② 활동' : ''}
        </p>
      )}
    </div>
  )
}
