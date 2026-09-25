// 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 최종당화산물지수(AGEs Index) CSV
// 파일(파일명 예: com.samsung.health.advanced_glycation_endproduct.xxx.csv)을
// 브라우저에서 직접 파싱한다. samsungHealthImport.ts(심박수)와 같은 원칙 —
// 원본 CSV 파일 내용 자체는 서버로 전송하거나 저장하지 않는다(개인정보 최소화).
// 여기서 뽑아낸 날짜별 지수(score)·등급만 XCTS 저장 API로 보낸다.
//
// **심박수 파서와의 핵심 차이**: 심박수는 캡처 구간(60초) 안의 여러 샘플을 평균
// 하나로 요약(HeartRateWindowSummary)해서 저장하지만, 최종당화산물지수는 보통
// 하루 한 번 정도만 측정되는 지표라 "여러 날짜의 값을 시계열로 쌓아 보여주는 것"
// 자체가 목적이다 — 그래서 이 파서는 단일 요약값이 아니라 CSV의 각 행을 그대로
// AgesIndexRecord 배열로 반환한다(날짜별 표시가 요구사항).
//
// **컬럼명은 사용자가 실제 삼성 헬스 CSV로 직접 확인해준 것을 그대로 썼다**(2026-09,
// samsungHealthImport.ts의 심박수 컬럼이 나중에야 실제 파일로 교정됐던 것과 달리,
// 이번엔 처음부터 실제 헤더 행을 받았다):
//   1행: 메타데이터 줄(실제 헤더 아님, 심박수 CSV와 같은 패턴)
//   2행: 진짜 헤더 — create_sh_ver,measurement_result,percent,modify_sh_ver,
//        update_time,create_time,score,deviceuuid,level_boundary,pkg_name,
//        datauuid,day_time
// 추출 대상은 `score`(지수 값)와 `day_time`(측정 일자)이다. 다른 버전/지역
// 내보내기에서 컬럼명이 달라질 가능성에 대비해 심박수 파서와 같은 방식(정확한
// 이름 우선, 키워드 폴백)을 그대로 적용했다.
//
// **원본(raw) 파일 제외**: 삼성 헬스는 같은 지표를 두 종류 파일로 내보낸다 —
// `com.samsung.health.advanced_glycation_endproduct.<id>.csv`(지수 요약, 이 파서가
// 다루는 파일)와 `com.samsung.health.advanced_glycation_endproduct.raw.<id>.csv`
// (원본 센서 데이터, 컬럼 구조가 다를 것으로 추정되며 실제 샘플을 확인하지 못했다).
// 파일 선택 단계에서 `accept=".csv"`만으로는 이 둘을 구분할 수 없으므로, 파일명
// 패턴으로 raw 파일을 먼저 걸러내 명확한 에러로 안내한다 — 잘못 파싱해 엉뚱한
// 값을 저장하는 것보다 안전하다.
//
// ⚠️ **등급 구간은 실기기 화면에서 관찰한 값**이라 삼성 헬스가 실제로 쓰는 개인화
// 기준(level_boundary 컬럼에 JSON으로 들어있을 것으로 추정되지만, 이 CSV 내보내기
// 형식에는 포함돼 있지 않아 직접 읽을 방법이 없다)과 정확히 일치하지 않을 수 있다 —
// computeAgesIndexGrade() 참고. 나중에 실제 level_boundary 값을 확인할 방법이
// 생기면 이 고정 구간을 대체해야 한다.

export class AgesIndexImportError extends Error {}

export interface AgesIndexRecord {
  /** day_time 컬럼의 원본 문자열 그대로 — 정확한 포맷(에폭 밀리초인지, 다른
   * 표기인지)을 실제 파일로 확인하지 못해 항상 보존해둔다. */
  dayTimeRaw: string
  /** dayTimeRaw를 사람이 읽기 쉬운 날짜(YYYY-MM-DD)로 변환 시도한 결과 — 실패하면
   * null이고, 이 경우 화면은 dayTimeRaw를 그대로 보여줘야 한다. */
  dayTimeLabel: string | null
  score: number
  /** computeAgesIndexGrade(score)의 결과를 미리 계산해 함께 담아둔다. */
  grade: string
}

const RAW_FILENAME_PATTERN = /advanced_glycation_endproduct\.raw\./i

const SCORE_EXACT_COLUMN = 'score'
const DAY_TIME_EXACT_COLUMN = 'day_time'

const SCORE_KEYWORDS = ['score']
// create_time/update_time과 헷갈리지 않도록 "day"와 "time"이 같이 있는 컬럼만 찾는다.
const DAY_TIME_KEYWORDS = ['day_time', 'daytime']

/** 파일 앞부분 이 줄 수 안에서만 헤더 행을 찾는다(samsungHealthImport.ts와 동일한
 * 이유 — 메타데이터 줄 1개 뒤에 헤더가 오는 게 보통이라 전체를 다 훑지 않는다). */
const HEADER_SEARCH_LIMIT = 10

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * RFC4180 계열 CSV를 문자 단위로 직접 파싱한다 — samsungHealthImport.ts의 parseCsv와
 * 완전히 같은 구현이다. 기능끼리(그리고 shared 하위 모듈끼리도) 서로 꼭 필요하지
 * 않으면 의존하지 않는다는 이 프로젝트의 관례에 따라 import 대신 작게 복제했다
 * (handAngles.ts/footToeEstimate.ts가 angleAtVertexDeg를 각각 복제해둔 것과 같은 패턴).
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
  const hasScore = cells.some((c) => SCORE_KEYWORDS.some((k) => c.includes(k)))
  const hasDayTime = cells.some((c) => DAY_TIME_KEYWORDS.some((k) => c.includes(k)))
  return hasScore && hasDayTime
}

/** samsungHealthImport.ts의 looksLikeMetadataLine과 같은 판별 로직. */
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

/** samsungHealthImport.ts의 findColumnIndex와 같은 로직(exactName 우선, 키워드 폴백). */
function findColumnIndex(header: string[], exactName: string, keywords: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase())
  const exactIdx = lower.indexOf(exactName.toLowerCase())
  if (exactIdx !== -1) return exactIdx
  return lower.findIndex((h) => keywords.some((k) => h.includes(k)))
}

/**
 * day_time 값을 사람이 읽을 수 있는 날짜(YYYY-MM-DD)로 변환 시도한다 — 정확한
 * 포맷을 실제 파일로 확인하지 못해 두 가지를 순서대로 시도하는 관대한 방식이다:
 * ① 순수 숫자 문자열이면 에폭 밀리초로 간주(삼성 헬스의 여러 시간류 컬럼에서 흔한
 * 표현 — 대략 1970~2100년대 범위의 자리수만 받아들인다), ② 그게 아니면
 * samsungHealthImport.ts의 parseSamsungHealthTimestamp와 같은 방식으로 Date.parse를
 * 시도한다. 둘 다 실패하면 null — 호출부는 dayTimeRaw를 그대로 보여주면 된다.
 */
function parseDayTimeLabel(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed)
    if (ms > 1e11 && ms < 1e13) {
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return formatDateLabel(d)
    }
  }

  const candidates = trimmed.includes('T') ? [trimmed] : [trimmed.replace(' ', 'T'), trimmed]
  for (const candidate of candidates) {
    const parsedMs = Date.parse(candidate)
    if (Number.isFinite(parsedMs)) return formatDateLabel(new Date(parsedMs))
  }

  return null
}

function formatDateLabel(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 최종당화산물지수 등급을 계산한다.
 *
 * ⚠️ 이 구간은 삼성 헬스 CSV 내보내기에 포함된 `level_boundary` 컬럼(JSON으로
 * 개인화된 경계값을 담고 있을 것으로 추정)을 직접 읽은 게 아니라, 실기기 화면에
 * 표시된 값을 관찰해서 역으로 추정한 고정 구간이다 — 실제 개인화 기준과 다를 수
 * 있다. 나중에 level_boundary의 실제 JSON 구조를 확인할 방법이 생기면 이 함수를
 * 그 값 기반으로 바꿔야 한다.
 */
export function computeAgesIndexGrade(score: number): string {
  if (score < 442) return '낮음'
  if (score < 482) return '적절'
  if (score < 704) return '주의'
  // 704~864 구간에서 관찰된 라벨이며, 864 초과 값에 대한 별도 구간은 관찰되지
  // 않아 같은 등급으로 처리한다.
  return '높음'
}

/**
 * 최종당화산물지수 CSV 텍스트를 파싱해 날짜별 기록 배열로 반환한다(최신 날짜
 * 먼저). raw 원본 파일이거나 형식이 예상과 다르면(헤더를 못 찾거나 유효한 값이
 * 하나도 없으면) AgesIndexImportError를 명확한 한글 메시지와 함께 던진다.
 */
export function parseAgesIndexCsv(csvText: string, fileName: string): AgesIndexRecord[] {
  if (RAW_FILENAME_PATTERN.test(fileName)) {
    throw new AgesIndexImportError(
      '원본(raw) 데이터 파일은 지원하지 않습니다. "advanced_glycation_endproduct."로 시작하고 뒤에 "raw."가 붙지 않은 지수 요약 파일을 선택해주세요.',
    )
  }

  const rows = parseCsv(stripBom(csvText)).filter((r) => r.some((c) => c.trim() !== ''))

  if (rows.length < 2) {
    throw new AgesIndexImportError(
      '파일에서 데이터를 찾을 수 없습니다. 삼성 헬스 앱의 "개인 데이터 다운로드"로 받은 최종당화산물지수 CSV 파일이 맞는지 확인해주세요.',
    )
  }

  const searchStart = looksLikeMetadataLine(rows[0], rows[1]) ? 1 : 0
  const headerIdx = findHeaderRowIndex(rows, searchStart)
  if (headerIdx === -1) {
    throw new AgesIndexImportError(
      'CSV에서 score·day_time 관련 컬럼명을 찾지 못했습니다. 최종당화산물지수 CSV 파일이 맞는지, 파일이 손상되지 않았는지 확인해주세요.',
    )
  }

  const header = rows[headerIdx]
  const scoreColIdx = findColumnIndex(header, SCORE_EXACT_COLUMN, SCORE_KEYWORDS)
  if (scoreColIdx === -1) {
    throw new AgesIndexImportError('score(지수) 컬럼을 찾지 못했습니다. 파일 형식을 확인해주세요.')
  }
  const dayTimeColIdx = findColumnIndex(header, DAY_TIME_EXACT_COLUMN, DAY_TIME_KEYWORDS)
  if (dayTimeColIdx === -1) {
    throw new AgesIndexImportError('day_time(측정 일자) 컬럼을 찾지 못했습니다. 파일 형식을 확인해주세요.')
  }

  const records: AgesIndexRecord[] = []
  for (const dataRow of rows.slice(headerIdx + 1)) {
    const scoreRaw = dataRow[scoreColIdx]?.trim()
    const dayTimeRaw = dataRow[dayTimeColIdx]?.trim()
    if (!scoreRaw || !dayTimeRaw) continue
    const score = Number(scoreRaw)
    if (!Number.isFinite(score)) continue

    records.push({
      dayTimeRaw,
      dayTimeLabel: parseDayTimeLabel(dayTimeRaw),
      score,
      grade: computeAgesIndexGrade(score),
    })
  }

  if (records.length === 0) {
    throw new AgesIndexImportError(
      '유효한 최종당화산물지수 값을 하나도 찾지 못했습니다. 파일 형식이 예상과 다른 것 같습니다.',
    )
  }

  // 최신 날짜가 먼저 오도록 정렬 — CSV 안의 행 순서를 신뢰하지 않는다. dayTimeRaw가
  // 숫자(에폭 밀리초 등)면 숫자로, 아니면 문자열로 비교한다.
  records.sort((a, b) => {
    const na = Number(a.dayTimeRaw)
    const nb = Number(b.dayTimeRaw)
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
    return b.dayTimeRaw.localeCompare(a.dayTimeRaw)
  })

  return records
}
