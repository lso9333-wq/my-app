// Muse EEG 헤드밴드 연결 — muse-js(v3.3.0, npm 공개 배포 확인됨)를 감싸는 얇은 래퍼.
//
// muse-js를 쓰기로 한 이유와 실제 검증한 API 상세는 CLAUDE.md "뇌파(EEG) 실시간 표시"
// 절 참고. 요약: registry.npmjs.org에서 muse-js는 공개 배포가 확인됐고(web-muse는
// 404로 미배포 확인), unpkg.com에서 dist/muse.d.ts·muse.js·muse-interfaces.d.ts·
// muse-parse.js 원본을 직접 읽어 API 형태와 내부 단위 변환 공식까지 확인한 뒤
// 채택했다 — 이전 @tensorflow-models/hand-pose-detection 추가 때 겪은 두 번의 실제
// 배포 실패(CLAUDE.md 참고) 이후 도입한 "쓰기 전에 실제 배포 파일을 직접 읽어 검증"
// 방식이다.
//
// 중요: connectMuse()는 반드시 버튼 onClick 핸들러 안에서, await 없이 동기적으로
// 첫 줄에서 호출되어야 한다(더 정확히는 MuseClient.connect() 내부의
// navigator.bluetooth.requestDevice() 호출이 그렇다). Web Bluetooth의 기기 선택
// 팝업은 "사용자 제스처(예: 클릭)로부터 직접 이어지는 호출 스택" 안에서만 뜨는데,
// 이건 이 프로젝트가 이미 window.print()에서 겪은 것과 같은 종류의 제약이다
// (CLAUDE.md의 PDF 내보내기 관련 설명 참고) — 중간에 다른 await를 거치면 브라우저가
// "사용자가 직접 요청한 게 아니다"라고 판단해 팝업을 막는다.

import { MuseClient } from 'muse-js'
import type { EegConnectionInfo } from './types'

/** 이 브라우저/환경이 Web Bluetooth를 지원하는지 확인. iOS Safari, 카카오톡 등
 * 인앱 웹뷰에서는 항상 false — 안내 문구를 보여줘야 한다. */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export interface MuseConnectCallbacks {
  /** 채널별로 12개 샘플씩(muse-js EEG_SAMPLES_PER_READING) 도착할 때마다 호출. */
  onEegSample: (electrodeIndex: number, samples: number[], timestamp: number) => void
  onBatteryLevel: (level: number) => void
  onDisconnected: () => void
  onError: (message: string) => void
}

export interface MuseConnection {
  client: MuseClient
  deviceName: string | null
  disconnect: () => void
}

/** 새 MuseClient를 만들어 연결하고 스트림을 시작한다. 반드시 클릭 핸들러의 동기
 * 첫 동작으로 호출할 것(위 설명 참고).
 *
 * 버그 수정(2026-09): 처음 버전은 `new MuseClient()` 직후, `connect()`를 부르기도
 * 전에 `client.eegReadings.subscribe(...)`/`client.telemetryData.subscribe(...)`를
 * 호출해서 실제 기기로 "Cannot read properties of undefined (reading 'subscribe')"
 * 에러가 났다. unpkg.com의 muse-js 실제 배포 소스(`dist/muse.js`)를 다시 읽어 확인해보니
 * `connectionStatus`만 생성자에서 바로 만들어지고(`new BehaviorSubject(false)`),
 * `eegReadings`/`telemetryData`/`gyroscopeData`/`accelerometerData`/`ppgReadings`/
 * `rawControlData`/`controlResponses`/`eventMarkers`는 전부 `connect()` 안에서야
 * 실제 rxjs 객체로 채워진다 — 그 전엔 전부 `undefined`다. 그래서 이 값들에 대한
 * 구독은 반드시 `await client.connect()`가 끝난 뒤에 걸어야 한다. */
export async function connectMuse(callbacks: MuseConnectCallbacks): Promise<MuseConnection> {
  const client = new MuseClient()
  // AUX(보조 전극)는 대부분의 Muse 2/S 기본 구성엔 물리적으로 연결돼 있지 않아
  // 기본값(false)을 그대로 둔다 — 사용자가 켜봤자 잡음만 나올 가능성이 높다.
  client.enablePpg = false

  let eegSub: { unsubscribe(): void } | undefined
  let telemetrySub: { unsubscribe(): void } | undefined
  let connectionSub: { unsubscribe(): void } | undefined

  try {
    await client.connect()

    // 여기서부터는 connect()가 끝나서 eegReadings 등이 실제 rxjs 객체로 채워진 뒤다.
    eegSub = client.eegReadings.subscribe((reading) => {
      callbacks.onEegSample(reading.electrode, reading.samples, reading.timestamp)
    })
    telemetrySub = client.telemetryData.subscribe((t) => {
      callbacks.onBatteryLevel(t.batteryLevel)
    })
    connectionSub = client.connectionStatus.subscribe((connected) => {
      if (!connected) {
        callbacks.onDisconnected()
      }
    })

    await client.start()
  } catch (err) {
    eegSub?.unsubscribe()
    telemetrySub?.unsubscribe()
    connectionSub?.unsubscribe()
    const message = err instanceof Error ? err.message : String(err)
    callbacks.onError(message)
    throw err
  }

  return {
    client,
    deviceName: client.deviceName,
    disconnect: () => {
      eegSub?.unsubscribe()
      telemetrySub?.unsubscribe()
      connectionSub?.unsubscribe()
      client.disconnect()
    },
  }
}

export function toConnectionInfo(client: MuseClient, batteryLevel: number | null): EegConnectionInfo {
  return {
    deviceName: client.deviceName,
    batteryLevel,
  }
}
