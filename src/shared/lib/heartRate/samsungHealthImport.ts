// 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수 CSV 파일(파일명 예:
// com.samsung.shealth.tracker.heart_rate.xxx.csv)을 브라우저에서 직접 파싱한다.
// 원본 CSV 파일 내용 자체는 서버로 전송하거나 저장하지 않는다(개인정보 최소화 원칙)
// — 여기서 계산한 평균 심박수 등 요약값(HeartRateWindowSummary)만 기존 XCTS 저장
// API(POST /api/xcts-sessions)에 실어 보낸다. bleHeartRate.ts(표준 BLE 심박 서비스)와
// 같은 "연결/가져오기 → HeartRateWindowSummary" 인터페이스를 따르는 두 번째
// 데이터 소스로, XctsMeasurementSource에 'samsung-health-export'로 등록돼 있다
// (src/features/xcts/types.ts 참고).
//
// 왜 컬럼명을 하드코딩하지 않고 유연하게 찾는가: 삼성 헬스의 내보내기 CSV는 버전/
// 기기/지역에 따라 정확한 컬럼명(예: `heart_rate`, `create_time`, `time`,
// `start_time` 등)이 달라질 수 있고, 이 프로젝트는 실제 파일 샘플을 확보하지 못한
// 채(이 개발 샌드박스는 삼성 헬스 앱에 접근할 수 없음) 구현했다 — 그래서 특정
// 컬럼명을 하드코딩해 단정하지 않고, 헤더 행에서 "heart_rate"와 "time"이 포함된
// 컬럼을 각각 찾아 그 컬럼만 읽는다. 형식이 예상과 다르면(그런 컬럼을 못 찾거나
// 숫자 값이 하나도 없으면) 계산을 강행하지 않고 명확한 한글 에러를 던진다 —
// 잘못된 컬럼을 심박수로 착각해 엉뚱한 평균값을 저장하는 것보다는, 실패를 사용자에게
// 알리고 다시 확인하게 하는 편이 안전하다.

import type { HeartRateWindowSummary } from './heartRateInterpretation'

export class SamsungHealthImportError extends Error {}

/** 삼성 헬스 CSV는 RR간격(연속 심박 사이 간격)을 제공하지 않아 HRV(RMSSD)를 계산할
 * 수 없다 — HeartRateCaptureControl/XctsResultsPanel이 이 문구를 그대로 보여준다. */
export const SAMSUNG_HEALTH_HRV_NOTE =
  '삼성 헬스 데이터는 평균 심박수만 제공되며 HRV(RMSSD)는 계산되지 않습니다.'

const HEART_RATE_KEYWORDS = ['heart_rate', 'heartrate']
const TIME_KEYWORDS = ['time']
/** heart_rate 컬럼이 여러 개일 때(예: 순간값 하나 + 구간 최솟값/최댓값) 평균 계산에
 * 적합하지 않은 집계 컬럼은 되도록 피한다 — 못 찾으면 avoid 조건 없이 다시 찾는다. */
const AGGREGATE_AVOID_KEYWORDS = ['min', 'max']
/** 파일 앞부분 이 줄 수 안에서만 헤더 행을 찾는다 — 큰 CSV 전체를 매번 다 훑지
 * 않기 위함이며, 삼성 헬스 CSV는 보통 안내/메타 줄 1~2개 뒤에 헤더가 온다. */
const HEADER_SEARCH_LIMIT = 10

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * RFC4180 계열 CSV를 문자 단위로 직접 파싱한다(새 npm 패키지 추가 없이 — muse-js의
 * 자체 FFT 구현과 같은 "의존성 최소화" 방침). 큰따옴표로 감싼 필드 안의 쉼표·줄바꿈·
 * ""(이스케이프된 큰따옴표)를 전부 올바르게 처리한다 — 삼성 헬스 CSV는 `binning_data`
 * 같은 컬럼에 JSON을 그대로 담아 쉼표를 포함하는 경우가 흔해서, 줄 단위로 나눠
 * split(',')만 하면 컬럼이 밀릴 수 있다.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      endField()
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    field += ch
    i++
  }
  if (field !== '' || row.length > 0) endRow()

  return rows
}

function findHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SEARCH_LIMIT)
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase())
    const hasHeartRate = cells.some((c) => HEART_RATE_KEYWORDS.some((k) => c.includes(k)))
    const hasTime = cells.some((c) => TIME_KEYWORDS.some((k) => c.includes(k)))
    if (hasHeartRate && hasTime) return i
  }
  return -1
}

/** 헤더 행에서 keywords 중 하나라도 포함하는 첫 컬럼을 찾는다. avoidKeywords가 있으면
 * 그 단어를 포함하는 컬럼은 먼저 건너뛰고, 그래도 못 찾으면 avoid 조건 없이 다시 찾는다. */
function findColumnIndex(header: string[], keywords: string[], avoidKeywords: string[] = []): number {
  const lower = header.map((h) => h.trim().toLowerCase())
  const matches = (h: string) => keywords.some((k) => h.includes(k))

  if (avoidKeywords.length > 0) {
    const idx = lower.findIndex((h) => matches(h) && !avoidKeywords.some((a) => h.includes(a)))
    if (idx !== -1) return idx
  }
  return lower.findIndex((h) => matches(h))
}

/**
 * 삼성 헬스 심박수 CSV 텍스트를 파싱해 기존 HeartRateWindowSummary 형태로 반환한다.
 * 형식이 예상과 다르면(헤더를 못 찾거나 유효한 숫자 값이 없으면) SamsungHealthImportError를
 * 명확한 한글 메시지와 함께 던진다 — 호출부는 이 메시지를 그대로 화면에 보여주면 된다.
 */
export function parseSamsungHealthHeartRateCsv(csvText: string): HeartRateWindowSummary {
  const rows = parseCsv(stripBom(csvText)).filter((r) => r.some((c) => c.trim() !== ''))

  if (rows.length < 2) {
    throw new SamsungHealthImportError(
      '파일에서 데이터를 찾을 수 없습니다. 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수 CSV 파일이 맞는지 확인해주세요.',
    )
  }

  const headerIdx = findHeaderRowIndex(rows)
  if (headerIdx === -1) {
    throw new SamsungHealthImportError(
      'CSV에서 심박수(heart_rate)·시간(time) 관련 컬럼명을 찾지 못했습니다. 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수 CSV 파일이 맞는지, 파일이 손상되지 않았는지 확인해주세요.',
    )
  }

  const header = rows[headerIdx]
  const heartRateColIdx = findColumnIndex(header, HEART_RATE_KEYWORDS, AGGREGATE_AVOID_KEYWORDS)
  if (heartRateColIdx === -1) {
    throw new SamsungHealthImportError('심박수(heart_rate) 컬럼을 찾지 못했습니다. 파일 형식을 확인해주세요.')
  }

  const values: number[] = []
  for (const dataRow of rows.slice(headerIdx + 1)) {
    const raw = dataRow[heartRateColIdx]?.trim()
    if (!raw) continue
    const num = Number(raw)
    if (Number.isFinite(num) && num > 0) values.push(num)
  }

  if (values.length === 0) {
    throw new SamsungHealthImportError(
      `"${header[heartRateColIdx].trim()}" 컬럼에서 유효한 심박수 숫자 값을 하나도 찾지 못했습니다. 파일 형식이 예상과 다른 것 같습니다.`,
    )
  }

  const avgHeartRateBpm = values.reduce((sum, v) => sum + v, 0) / values.length

  return {
    capturedAt: new Date().toISOString(),
    avgHeartRateBpm,
    // 요구사항: 삼성 헬스 CSV 내보내기는 RR간격을 제공하지 않으므로 HRV는 항상 계산하지 않는다.
    rmssdMs: null,
    sampleCount: values.length,
    rrIntervalCount: 0,
  }
}
