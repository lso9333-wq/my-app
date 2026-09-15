interface Props {
  title: string
  clientName?: string
  trainerName?: string | null
  /** 영상 파일명, 부위명 등 제목 아래에 덧붙일 한 줄(선택) */
  subtitle?: string
  /** 과거 기록을 볼 때의 저장 시각(ISO 문자열). 없으면 지금 시각을 쓴다(방금 분석한 결과). */
  date?: string
}

/**
 * 보행/ROM/XMSK 각 결과 화면 + PDF 내보내기 대상 상단에 공통으로 쓰는 헤더.
 * 화면에서도 그대로 보이고(회원/트레이너/날짜 확인용), PDF로 인쇄할 때도 같은
 * 내용이 그대로 포함되어 어떤 기록인지 알아볼 수 있게 한다.
 */
export function PrintReportHeader({ title, clientName, trainerName, subtitle, date }: Props) {
  const when = date ? new Date(date) : new Date()
  return (
    <div className="print-report-header">
      <h3>{title}</h3>
      {(clientName || trainerName) && (
        <p className="app-subtitle">
          {clientName && `회원: ${clientName}`}
          {clientName && trainerName && ' · '}
          {trainerName && `트레이너: ${trainerName}`}
        </p>
      )}
      {subtitle && <p className="app-subtitle">{subtitle}</p>}
      <p className="app-subtitle print-report-date">{when.toLocaleString('ko-KR')}</p>
    </div>
  )
}
