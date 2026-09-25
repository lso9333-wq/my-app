import { describe, expect, it } from 'vitest'
import { AgesIndexImportError, computeAgesIndexGrade, parseAgesIndexCsv } from './agesIndexImport'

describe('computeAgesIndexGrade', () => {
  it('442 미만이면 낮음', () => {
    expect(computeAgesIndexGrade(441)).toBe('낮음')
  })

  it('442~481은 적절 (경계값 포함)', () => {
    expect(computeAgesIndexGrade(442)).toBe('적절')
    expect(computeAgesIndexGrade(481)).toBe('적절')
  })

  it('482~703은 주의 (경계값 포함)', () => {
    expect(computeAgesIndexGrade(482)).toBe('주의')
    expect(computeAgesIndexGrade(703)).toBe('주의')
  })

  it('704 이상은 높음 (864 초과도 동일 처리)', () => {
    expect(computeAgesIndexGrade(704)).toBe('높음')
    expect(computeAgesIndexGrade(864)).toBe('높음')
    expect(computeAgesIndexGrade(900)).toBe('높음')
  })
})

const HEADER =
  'create_sh_ver,measurement_result,percent,modify_sh_ver,update_time,create_time,score,deviceuuid,level_boundary,pkg_name,datauuid,day_time'

function csvWithMetadataLine(rows: string[]): string {
  // 실제 삼성 헬스 CSV의 1행(메타데이터 줄) 패턴을 흉내낸다 — 헤더보다 컬럼 수가
  // 훨씬 적어 looksLikeMetadataLine()이 건너뛰도록 만든다.
  return ['com.samsung.health.advanced_glycation_endproduct,1,3', HEADER, ...rows].join('\n')
}

describe('parseAgesIndexCsv', () => {
  it('raw 파일명은 내용과 무관하게 거부한다', () => {
    const csv = csvWithMetadataLine([
      '1,1,1,1,2026-09-24 07:00:00.000,2026-09-24 07:00:00.000,464,uuid,{},pkg,data,2026-09-24 07:00:00.000',
    ])
    expect(() => parseAgesIndexCsv(csv, 'com.samsung.health.advanced_glycation_endproduct.raw.1234.csv')).toThrow(
      AgesIndexImportError,
    )
  })

  it('메타데이터 줄을 건너뛰고 score/day_time을 정확히 뽑아 등급까지 계산한다 (실제 확인된 문자열 포맷)', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,2026-09-24 07:00:00.000,2026-09-24 07:00:00.000,464,uuid,{},pkg,data,2026-09-24 07:00:00.000',
      ]),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records).toHaveLength(1)
    expect(records[0].score).toBe(464)
    expect(records[0].grade).toBe('적절')
    expect(records[0].dayTimeRaw).toBe('2026-09-24 07:00:00.000')
    expect(records[0].dayTimeLabel).toBe('2026-09-24')
  })

  it('여러 날짜의 기록을 최신순으로 정렬해 반환한다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,x,x,400,uuid,{},pkg,data,2026-09-20 07:00:00.000',
        '1,1,1,1,x,x,900,uuid,{},pkg,data,2026-09-23 07:00:00.000',
        '1,1,1,1,x,x,600,uuid,{},pkg,data,2026-09-21 07:00:00.000',
      ]),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records.map((r) => r.dayTimeLabel)).toEqual(['2026-09-23', '2026-09-21', '2026-09-20'])
    expect(records.map((r) => r.grade)).toEqual(['높음', '주의', '낮음'])
  })

  it('day_time이 순수 숫자 문자열이면(확인되지 않은 다른 내보내기 대비 폴백) 에폭 밀리초로 시도한다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine(['1,1,1,1,x,x,464,uuid,{},pkg,data,1700000000000']),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records[0].dayTimeRaw).toBe('1700000000000')
    expect(records[0].dayTimeLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('day_time을 어느 방식으로도 해석할 수 없으면 dayTimeLabel이 null이고 dayTimeRaw는 보존된다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine(['1,1,1,1,x,x,464,uuid,{},pkg,data,알수없는형식']),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records[0].dayTimeRaw).toBe('알수없는형식')
    expect(records[0].dayTimeLabel).toBeNull()
  })

  it('score/day_time 값이 비어있는 행은 건너뛴다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,x,x,,uuid,{},pkg,data,2026-09-24 07:00:00.000',
        '1,1,1,1,x,x,464,uuid,{},pkg,data,',
        '1,1,1,1,x,x,464,uuid,{},pkg,data,2026-09-24 07:00:00.000',
      ]),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records).toHaveLength(1)
  })

  it('헤더를 찾을 수 없으면 명확한 에러를 던진다', () => {
    expect(() =>
      parseAgesIndexCsv('foo,bar\n1,2\n', 'com.samsung.health.advanced_glycation_endproduct.1234.csv'),
    ).toThrow(AgesIndexImportError)
  })

  it('유효한 값이 하나도 없으면 에러를 던진다', () => {
    expect(() =>
      parseAgesIndexCsv(csvWithMetadataLine(['1,1,1,1,x,x,,uuid,{},pkg,data,']), 'x.advanced_glycation_endproduct.1234.csv'),
    ).toThrow(AgesIndexImportError)
  })
})
