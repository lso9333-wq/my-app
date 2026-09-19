// 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수 CSV 파일(파일명 예:
// com.samsung.shealth.tracker.heart_rate.xxx.csv)을 브라우저에서 직접 파싱한다.
// 원본 CSV 파일 내용 자체는 서버로 전송하거나 저장하지 않는다(개인정보 최소화 원칙)
// — 여기서 계산한 평균 심박수 등 요약값(HeartRateWindowSummary)만 기존 XCTS 저장
// API(POST /api/xcts-sessions)에 실어 보낸다. bleHeartRate.ts(표준 BLE 심박 서비스)와
// 같은 "연결/가져오기 → HeartRateWindowSummary" 인터페이스를 따르는 두 번째
// 데이터 소스로, XctsMeasurementSource에 'samsung-health-export'로 등록돼 있다
// (src/features/xcts/types.ts 참고).
//
// 왜 컬럼명을 하드코딩하지 않고 유연하게 찾는가: 처음 구현할 때는 이 개발 샌드박스가
// 삼성 헬스 앱에 접근할 수 없어 실제 파일 샘플 없이 만들었다 — 그래서 헤더 행에서
// "heart_rate"·"time"이 포함된 컬럼을 유연하게 찾는 방식으로 시작했다. 이후 사용자가
// 실제 삼성 헬스 "개인 데이터 다운로드" CSV로 테스트해 확인해준 실제 구조는 다음과
// 같았다(2026-09):
//   1행: 메타데이터 줄 — 예 `com.samsung.shealth.tracker.heart_rate,7006011,3`
//        (실제 헤더가 아니라 데이터 타입 식별자·버전 정보. 컬럼 수도 실제 헤더보다 훨씬 적다)
//   2행: 진짜 헤더 — 심박수 값 컬럼은 정확히 `com.samsung.health.heart_rate.heart_rate`
//        (min/max 컬럼이 아님), 측정 시각 컬럼은 `com.samsung.health.heart_rate.start_time`
// 이 정확한 컬럼명을 최우선으로 찾되(대소문자 무시 완전일치), 다른 버전/지역의 내보내기
// 파일에서 컬럼명이 달라질 가능성에 대비해 "heart_rate"·"time" 포함 여부를 보는 기존의
// 유연한 탐색을 폴백으로 유지한다. 1행이 메타데이터 줄처럼 보이면(아래
// `looksLikeMetadataLine` — 알려진 컬럼명이 하나도 없거나, 다음 줄보다 컬럼 수가 적으면)
// 자동으로 건너뛰고 그 다음 줄부터 헤더를 찾는다. 형식이 예상과 다르면(컬럼을 못 찾거나
// 숫자 값이 하나도 없으면) 계산을 강행하지 않고 명확한 한글 에러를 던진다 — 잘못된
// 컬럼을 심박수로 착각해 엉뚱한 평균값을 저장하는 것보다는, 실패를 사용자에게 알리고
// 다시 확인하게 하는 편이 안전하다.

import type { HeartRateWindowSummary } from './heartRateInterpretation'

export class SamsungHealthImportError extends Error {}

/** 삼성 헬스 CSV는 RR간격(연속 심박 사이 간격)을 제공하지 않아 HRV(RMSSD)를 계산할
 * 수 없다 — HeartRateCaptureControl/XctsResultsPanel이 이 문구를 그대로 보여준다. */
export const SAMSUNG_HEALTH_HRV_NOTE =
  '삼성 헬스 데이터는 평균 심박수만 제공되며 HRV(RMSSD)는 계산되지 않습니다.'

/** 실제 삼성 헬스 CSV로 확인된 정확한 컬럼명(2026-09) — 최우선으로 이 이름과 완전
 * 일치하는 컬럼을 찾는다. 못 찾으면(다른 버전/지역의 파일 등) 아래 키워드 기반
 * 유연한 탐색으로 폴백한다. */
const HEART_RATE_EXACT_COLUMN = 'com.samsung.health.heart_rate.heart_rate'
const TIME_EXACT_COLUMN = 'com.samsung.health.heart_rate.start_time'

const HEART_RATE_KEYWORDS = ['heart_rate', 'heartrate']
const TIME_KEYWORDS = ['time']
/** heart_rate 컬럼이 여러 개일 때(예: 순간값 하나 + 구간 최솟값/최댓값) 평균 계산에
 * 적합하지 않은 집계 컬럼은 되도록 피한다 — 못 찾으면 avoid 조건 없이 다시 찾는다.
 * (정확한 컬럼명이 매칭되면 이 avoid 로직 자체를 거치지 않는다.) */
const AGGREGATE_AVOID_KEYWORDS = ['min', 'max']
/** 파일 앞부분 이 줄 수 안에서만 헤더 행을 찾는다 — 큰 CSV 전체를 매번 다 훑지
 * 않기 위함이며, 삼성 헬스 CSV는 보통 메타데이터 줄 1개 뒤에 헤더가 온다. */
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

function hasKnownColumnName(row: string[]): boolean {
  const cells = row.map((c) => c.trim().toLowerCase())
  const hasHeartRate = cells.some((c) => HEART_RATE_KEYWORDS.some((k) => c.includes(k)))
  const hasTime = cells.some((c) => TIME_KEYWORDS.some((k) => c.includes(k)))
  return hasHeartRate && hasTime
}

/**
 * 1행이 실제 헤더가 아니라 메타데이터 줄(예: `com.samsung.shealth.tracker.heart_rate,
 * 7006011,3`)처럼 보이는지 판별한다 — 다음 두 신호 중 하나라도 있으면 메타데이터
 * 줄로 간주한다: ① heart_rate·time 계열의 알려진 컬럼명이 하나도 없다(메타데이터 줄은
 * 식별자/버전 숫자만 담고 있어 "time"이 포함된 셀이 없는 게 보통이다), ② 다음 줄(실제
 * 헤더로 추정)보다 컬럼 수가 뚜렷이 적다(메타데이터 줄은 보통 2~3개 필드뿐이지만
 * 헤더는 수십 개 컬럼인 경우가 흔하다).
 */
function looksLikeMetadataLine(firstRow: string[], nextRow: string[] | undefined): boolean {
  if (!hasKnownColumnName(firstRow)) return true
  if (nextRow && firstRow.length < nextRow.length) return true
  return false
}

function findHeaderRowIndex(rows: string[][], startIndex: number): number {
  const limit = Math.min(rows.length, startIndex + HEADER_SEARCH_LIMIT)
  for (let i = startIndex; i < limit; i++) {
    if (hasKnownColumnName(rows[i])) return i
  }
  return -1
}

/** 헤더 행에서 컬럼을 찾는다 — exactName과 완전 일치(대소문자 무시)하는 컬럼을
 * 최우선으로 쓰고, 없으면 keywords 중 하나라도 포함하는 컬럼으로 폴백한다.
 * avoidKeywords가 있으면 그 단어를 포함하는 컬럼은 먼저 건너뛰고, 그래도 못 찾으면
 * avoid 조건 없이 다시 찾는다(exactName 매칭에는 avoid를 적용하지 않는다 — 정확히
 * 확인된 컬럼명이므로 휴리스틱으로 걸러낼 이유가 없다). */
function findColumnIndex(header: string[], exactName: string, keywords: string[], avoidKeywords: string[] = []): number {
  const lower = header.map((h) => h.trim().toLowerCase())

  const exactIdx = lower.indexOf(exactName.toLowerCase())
  if (exactIdx !== -1) return exactIdx

  const matches = (h: string) => keywords.some((k) => h.includes(k))
  if (avoidKeywords.length > 0) {
    const idx = lower.findIndex((h) => matches(h) && !avoidKeywords.some((a) => h.includes(a)))
    if (idx !== -1) return idx
  }
  return lower.findIndex((h) => matches(h))
}

/** 삼성 헬스 시각 문자열을 파싱한다 — 정확한 포맷(예: "2026-09-01 08:23:00.000" 같은
 * 공백 구분 표기)을 확신할 수 없어 관대하게 시도하고, 실패하면 null을 반환한다(측정
 * 시각 계산은 참고용이라 실패해도 전체 파싱을 중단시키지 않는다 — 아래 호출부 참고). */
function parseSamsungHealthTimestamp(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const candidates = trimmed.includes('T') ? [trimmed] : [trimmed.replace(' ', 'T'), trimmed]
  for (const candidate of candidates) {
    const ms = Date.parse(candidate)
    if (Number.isFinite(ms)) return ms
  }
  return null
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

  // 1행이 메타데이터 줄(실제 헤더 아님)처럼 보이면 건너뛰고 2행부터 헤더를 찾는다.
  const searchStart = looksLikeMetadataLine(rows[0], rows[1]) ? 1 : 0

  const headerIdx = findHeaderRowIndex(rows, searchStart)
  if (headerIdx === -1) {
    throw new SamsungHealthImportError(
      'CSV에서 심박수(heart_rate)·시간(time) 관련 컬럼명을 찾지 못했습니다. 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 심박수 CSV 파일이 맞는지, 파일이 손상되지 않았는지 확인해주세요.',
    )
  }

  const header = rows[headerIdx]
  const heartRateColIdx = findColumnIndex(header, HEART_RATE_EXACT_COLUMN, HEART_RATE_KEYWORDS, AGGREGATE_AVOID_KEYWORDS)
  if (heartRateColIdx === -1) {
    throw new SamsungHealthImportError('심박수(heart_rate) 컬럼을 찾지 못했습니다. 파일 형식을 확인해주세요.')
  }
  const timeColIdx = findColumnIndex(header, TIME_EXACT_COLUMN, TIME_KEYWORDS)

  const values: number[] = []
  let latestTimestampMs: number | null = null
  for (const dataRow of rows.slice(headerIdx + 1)) {
    const raw = dataRow[heartRateColIdx]?.trim()
    if (raw) {
      const num = Number(raw)
      if (Number.isFinite(num) && num > 0) values.push(num)
    }
    if (timeColIdx !== -1) {
      const rawTime = dataRow[timeColIdx]?.trim()
      if (rawTime) {
        const ts = parseSamsungHealthTimestamp(rawTime)
        if (ts !== null && (latestTimestampMs === null || ts > latestTimestampMs)) latestTimestampMs = ts
      }
    }
  }

  if (values.length === 0) {
    throw new SamsungHealthImportError(
      `"${header[heartRateColIdx].trim()}" 컬럼에서 유효한 심박수 숫자 값을 하나도 찾지 못했습니다. 파일 형식이 예상과 다른 것 같습니다.`,
    )
  }

  const avgHeartRateBpm = values.reduce((sum, v) => sum + v, 0) / values.length

  return {
    // 시각 컬럼(start_time)에서 파싱된 값 중 가장 최근 값을 실제 측정 시각으로 쓰고,
    // 시각 컬럼이 없거나 하나도 파싱되지 않으면(포맷을 확신할 수 없어 관대하게 시도하는
    // 값이라 실패 가능) 가져온 시각(지금)으로 대체한다 — 참고용 값이라 파싱 실패로
    // 전체 가져오기를 막지 않는다.
    capturedAt: latestTimestampMs !== null ? new Date(latestTimestampMs).toISOString() : new Date().toISOString(),
    avgHeartRateBpm,
    // 요구사항: 삼성 헬스 CSV 내보내기는 RR간격을 제공하지 않으므로 HRV는 항상 계산하지 않는다.
    rmssdMs: null,
    sampleCount: values.length,
    rrIntervalCount: 0,
  }
}
