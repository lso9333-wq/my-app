// 표준 BLE 심박 센서(Polar H10/Verity Sense, Wahoo Tickr 등) 연결 — 블루투스 SIG가
// 표준화한 Heart Rate Service(0x180D)/Heart Rate Measurement 특성(0x2A37)을 브라우저의
// Web Bluetooth API로 직접 읽는다. Muse(museConnection.ts)와 달리 전용 npm 라이브러리가
// 필요 없다 — 이 서비스는 표준 GATT 프로필이라 파싱 규칙이 블루투스 SIG 명세에 그대로
// 공개돼 있고, 실제로 이 방식으로 Polar H10에서 심박·RR간격을 읽는 사례가 다수
// 확인됐다(2026-09 웨어러블 연동 검토, docs/wearable-biometric-integration-review.md 참고).
//
// 타입: TypeScript 표준 DOM lib에는 Web Bluetooth API 타입이 없고, 이 프로젝트는
// `@types/web-bluetooth`를 새 의존성으로 추가하지 않았다("의존성 최소화" 방침 —
// muse-js는 이 API를 자기 라이브러리 내부에서만 쓰고 이 프로젝트 코드는
// `'bluetooth' in navigator` 존재 확인만 해서 별도 타입이 필요 없었지만, 이 파일은
// GATT 서비스/특성을 직접 다뤄야 한다). 그래서 실제로 쓰는 최소한의 모양만 아래에
// 로컬로 선언해 쓴다 — 새 npm 패키지 없이 해결.
//
// 중요(Muse와 같은 제약): connectBleHeartRate()도 반드시 버튼 onClick 핸들러 안에서
// await 없이 동기적으로 첫 줄에서 시작해야 한다 — navigator.bluetooth.requestDevice()의
// 기기 선택 팝업은 "사용자 제스처로부터 직접 이어지는 호출 스택" 안에서만 뜬다
// (museConnection.ts 주석·CLAUDE.md의 PDF 인쇄 관련 설명과 같은 이유).
//
// 확장성(2026-09, "추후 스마트워치 제조사/개발사와 협업할 경우도 고려"): 지금은 이
// 파일이 유일한 데이터 소스(표준 BLE)지만, 나중에 특정 제조사와 파트너십을 맺어
// 그쪽 SDK/OAuth API로 심박·HRV를 받아오게 되더라도 이 파일과 같은 모양의
// "연결 콜백 → HeartRateSample 스트림" 인터페이스만 새로 구현하면 된다 — 상위
// 캡처 UI(HeartRateCaptureControl.tsx)와 요약 계산(heartRateInterpretation.ts)은
// HeartRateSample 형태에만 의존하고 "어떻게 연결했는지"는 모른다.

interface BluetoothRemoteGATTCharacteristicLike extends EventTarget {
  value: DataView | null
  startNotifications: () => Promise<unknown>
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristicLike>
}

interface BluetoothRemoteGATTServerLike {
  connect: () => Promise<BluetoothRemoteGATTServerLike>
  disconnect: () => void
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTServiceLike>
}

interface BluetoothDeviceLike extends EventTarget {
  name?: string
  gatt?: BluetoothRemoteGATTServerLike
}

interface NavigatorBluetoothLike {
  requestDevice: (options: { filters: { services: string[] }[] }) => Promise<BluetoothDeviceLike>
}

function getNavigatorBluetooth(): NavigatorBluetoothLike {
  return (navigator as unknown as { bluetooth: NavigatorBluetoothLike }).bluetooth
}

export interface HeartRateSample {
  heartRateBpm: number
  /** 기기가 RR간격(연속 심박 사이 시간, ms 단위)을 함께 보내주면 채워진다 — HRV(RMSSD)
   * 계산에 필요. Heart Rate Measurement 특성의 RR-Interval 필드는 1/1024초 단위라
   * 여기서 ms로 변환해둔다. 기기가 지원하지 않으면 빈 배열. */
  rrIntervalsMs: number[]
  timestamp: number
}

/** 이 브라우저/환경이 Web Bluetooth를 지원하는지 — museConnection.ts의
 * isWebBluetoothSupported()와 같은 검사이지만, EEG shared 모듈에 대한 불필요한
 * 의존을 피하려고 그대로 한 줄을 복제해둔다(기능끼리, 그리고 shared 하위 모듈끼리도
 * 서로 꼭 필요하지 않으면 의존하지 않는다는 이 프로젝트의 관례). iOS Safari, 카카오톡
 * 등 인앱 웹뷰에서는 항상 false. */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/**
 * Heart Rate Measurement 특성(0x2A37) 값을 블루투스 SIG 명세대로 파싱한다.
 * 플래그 바이트 구조: bit0=심박값 포맷(0=uint8, 1=uint16), bit1-2=센서 접촉 상태,
 * bit3=에너지 소비량 필드 존재 여부(uint16, 값 자체는 쓰지 않아 건너뜀만 함),
 * bit4=RR간격 필드 존재 여부(있으면 uint16 값이 남은 바이트만큼 반복, 각각 1/1024초 단위).
 */
export function parseHeartRateMeasurement(value: DataView): { heartRateBpm: number; rrIntervalsMs: number[] } {
  const flags = value.getUint8(0)
  const rate16Bits = (flags & 0x1) !== 0
  const energyExpendedPresent = (flags & 0x8) !== 0
  const rrIntervalPresent = (flags & 0x10) !== 0

  let offset = 1
  let heartRateBpm: number
  if (rate16Bits) {
    heartRateBpm = value.getUint16(offset, true)
    offset += 2
  } else {
    heartRateBpm = value.getUint8(offset)
    offset += 1
  }

  if (energyExpendedPresent) offset += 2

  const rrIntervalsMs: number[] = []
  if (rrIntervalPresent) {
    while (offset + 1 < value.byteLength) {
      const rr1024ths = value.getUint16(offset, true)
      rrIntervalsMs.push((rr1024ths / 1024) * 1000)
      offset += 2
    }
  }

  return { heartRateBpm, rrIntervalsMs }
}

export interface BleHeartRateCallbacks {
  onSample: (sample: HeartRateSample) => void
  onDisconnected: () => void
  onError: (message: string) => void
}

export interface BleHeartRateConnection {
  deviceName: string | null
  disconnect: () => void
}

/** 표준 심박 서비스를 노출하는 기기를 선택/연결하고 알림 구독을 시작한다. 반드시
 * 클릭 핸들러의 동기 첫 동작으로 호출할 것(위 파일 상단 설명 참고). */
export async function connectBleHeartRate(callbacks: BleHeartRateCallbacks): Promise<BleHeartRateConnection> {
  const device = await getNavigatorBluetooth().requestDevice({
    filters: [{ services: ['heart_rate'] }],
  })

  let characteristic: BluetoothRemoteGATTCharacteristicLike | undefined
  const handleValueChanged = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristicLike
    const value = target.value
    if (!value) return
    const { heartRateBpm, rrIntervalsMs } = parseHeartRateMeasurement(value)
    callbacks.onSample({ heartRateBpm, rrIntervalsMs, timestamp: Date.now() })
  }
  const handleDisconnected = () => callbacks.onDisconnected()

  try {
    device.addEventListener('gattserverdisconnected', handleDisconnected)
    if (!device.gatt) throw new Error('이 기기는 GATT를 지원하지 않습니다.')
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService('heart_rate')
    characteristic = await service.getCharacteristic('heart_rate_measurement')
    characteristic.addEventListener('characteristicvaluechanged', handleValueChanged)
    await characteristic.startNotifications()
  } catch (err) {
    device.removeEventListener('gattserverdisconnected', handleDisconnected)
    characteristic?.removeEventListener('characteristicvaluechanged', handleValueChanged)
    const message = err instanceof Error ? err.message : String(err)
    callbacks.onError(message)
    throw err
  }

  return {
    deviceName: device.name ?? null,
    disconnect: () => {
      characteristic?.removeEventListener('characteristicvaluechanged', handleValueChanged)
      device.removeEventListener('gattserverdisconnected', handleDisconnected)
      device.gatt?.disconnect()
    },
  }
}
