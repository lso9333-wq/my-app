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
    const csv = csvWithMetadataLine(['1,1,1,1,1700000000000,1700000000000,464,uuid,{},pkg,data,1700000000000'])
    expect(() => parseAgesIndexCsv(csv, 'com.samsung.health.advanced_glycation_endproduct.raw.1234.csv')).toThrow(
      AgesIndexImportError,
    )
  })

  it('메타데이터 줄을 건너뛰고 score/day_time을 정확히 뽑아 등급까지 계산한다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,1700000000000,1700000000000,464,uuid,{},pkg,data,1700000000000',
      ]),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records).toHaveLength(1)
    expect(records[0].score).toBe(464)
    expect(records[0].grade).toBe('적절')
    expect(records[0].dayTimeRaw).toBe('1700000000000')
    // 에폭 밀리초로 인식돼 YYYY-MM-DD 형태로 변환됐어야 한다.
    expect(records[0].dayTimeLabel).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('여러 날짜의 기록을 최신순으로 정렬해 반환한다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,0,0,400,uuid,{},pkg,data,1700000000000',
        '1,1,1,1,0,0,900,uuid,{},pkg,data,1700200000000',
        '1,1,1,1,0,0,600,uuid,{},pkg,data,1700100000000',
      ]),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records.map((r) => r.dayTimeRaw)).toEqual(['1700200000000', '1700100000000', '1700000000000'])
    expect(records.map((r) => r.grade)).toEqual(['높음', '주의', '낮음'])
  })

  it('day_time이 숫자가 아니어도(Date.parse 가능한 문자열) 최선을 다해 라벨을 만든다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine(['1,1,1,1,0,0,464,uuid,{},pkg,data,2026-09-20 10:00:00.000']),
      'com.samsung.health.advanced_glycation_endproduct.1234.csv',
    )
    expect(records[0].dayTimeLabel).toBe('2026-09-20')
  })

  it('score/day_time 값이 비어있는 행은 건너뛴다', () => {
    const records = parseAgesIndexCsv(
      csvWithMetadataLine([
        '1,1,1,1,0,0,,uuid,{},pkg,data,1700000000000',
        '1,1,1,1,0,0,464,uuid,{},pkg,data,',
        '1,1,1,1,0,0,464,uuid,{},pkg,data,1700000000000',
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
      parseAgesIndexCsv(csvWithMetadataLine(['1,1,1,1,0,0,,uuid,{},pkg,data,']), 'x.advanced_glycation_endproduct.1234.csv'),
    ).toThrow(AgesIndexImportError)
  })
})
