// Web Bluetooth/muse-js가 던지는 에러는 전부 영어 원문 그대로라(예: "User cancelled
// the requestDevice() chooser.", "GATT Server is disconnected.") 그대로 화면에
// 보여주면 한국어 사용자에게는 무슨 뜻인지 알 수 없다. 자주 나오는 패턴만 한글
// 안내문으로 바꾸고, 알 수 없는 나머지는 일반적인 한글 안내 + 원문(작게, 참고용)을
// 같이 보여준다 — 화면에는 항상 한글이 먼저 나오게 한다는 원칙(2026-09 사용자 요청).

export interface TranslatedError {
  /** 사용자에게 보여줄 한글 안내문 — 항상 이게 먼저/크게 나온다. */
  korean: string
  /** 원본 에러 메시지(영어일 수 있음) — 참고용으로 작게 같이 보여준다(버그 재현/문의 시 도움됨). */
  raw: string
}

export function translateMuseError(raw: string): TranslatedError {
  const lower = raw.toLowerCase()

  if (lower.includes('user cancelled') || lower.includes('user gesture')) {
    return {
      korean: '기기 선택 창에서 취소하셨거나, 버튼을 누른 즉시 선택하지 않아 연결이 취소됐습니다. 연결 버튼을 다시 눌러주세요.',
      raw,
    }
  }
  if (lower.includes('bluetooth adapter') || lower.includes('bluetooth is not available') || lower.includes('bluetooth is off')) {
    return {
      korean: '이 기기의 블루투스가 꺼져 있거나 사용할 수 없습니다. 블루투스를 켠 뒤 다시 시도해주세요.',
      raw,
    }
  }
  if (lower.includes('gatt server is disconnected') || lower.includes('gatt operation')) {
    return {
      korean: '블루투스 연결이 도중에 끊겼습니다. 헤드밴드 전원과 배터리를 확인한 뒤 다시 연결해주세요.',
      raw,
    }
  }
  if (lower.includes('requestdevice') && lower.includes('must be triggered')) {
    return {
      korean: '브라우저 보안 정책 때문에 연결 버튼을 누른 직후 바로 진행되지 않았습니다. 연결 버튼을 다시 한 번 눌러주세요.',
      raw,
    }
  }

  return {
    korean: '헤드밴드 연결 중 문제가 발생했습니다. 헤드밴드 전원을 확인하고 다시 시도해주세요.',
    raw,
  }
}
