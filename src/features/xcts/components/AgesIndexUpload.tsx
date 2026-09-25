import { useRef, useState, type ChangeEvent } from 'react'
import { AgesIndexImportError, parseAgesIndexCsv, type AgesIndexRecord } from '../../../shared/lib/agesIndex/agesIndexImport'
import { AuthError } from '../../../shared/lib/authApi'
import { uploadAgesIndexRecords } from '../lib/xctsApi'
import type { XctsMeasurementSource } from '../types'

interface Props {
  clientName: string
  trainerName: string
  token: string
  onAuthError: () => void
  onSaved: () => void
}

const DEVICE_SOURCE: XctsMeasurementSource = 'samsung-health-export'

/**
 * 최종당화산물지수(AGEs Index) 삼성 헬스 CSV 업로드 — HeartRateCaptureControl.tsx의
 * 삼성 헬스 CSV 업로드와 같은 성격(원본 CSV는 서버로 보내지 않고 브라우저에서만
 * 파싱)이지만, 심박수처럼 "①/② 두 시점 중 하나에 배정"하는 게 아니라 CSV 안의
 * 모든 날짜별 기록을 목록으로 그대로 저장한다는 점이 다르다(agesIndexImport.ts
 * 상단 주석 참고). 그래서 파싱 직후 바로 저장하지 않고, 몇 건을 찾았는지 미리보기로
 * 보여준 뒤 트레이너가 확인하고 "기록 저장"을 누르는 흐름을 그대로 유지했다 —
 * samsungHealthImport.ts CSV 업로드의 "잘못 파싱해 저장하는 것보다 확인 후 저장"
 * 원칙과 같다.
 */
export function AgesIndexUpload({ clientName, trainerName, token, onAuthError, onSaved }: Props) {
  const [parseError, setParseError] = useState<string | null>(null)
  const [pendingRecords, setPendingRecords] = useState<AgesIndexRecord[] | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleButtonClick = () => inputRef.current?.click()

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // 같은 파일을 다시 골라도 onChange가 또 발생하도록 입력값을 매번 비운다.
    e.target.value = ''
    if (!file) return

    setParseError(null)
    setPendingRecords(null)
    setSaveState('idle')
    setSaveError(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const records = parseAgesIndexCsv(text, file.name)
        setPendingRecords(records)
        setPendingFileName(file.name)
      } catch (err) {
        setParseError(
          err instanceof AgesIndexImportError
            ? err.message
            : '파일을 읽는 중 문제가 발생했습니다. CSV 파일이 맞는지 확인해주세요.',
        )
      }
    }
    reader.onerror = () => setParseError('파일을 읽지 못했습니다. 다시 시도해주세요.')
    reader.readAsText(file)
  }

  const canSave = pendingRecords !== null && clientName.trim() !== ''

  const handleSave = async () => {
    if (!canSave || !pendingRecords) return
    setSaveState('saving')
    try {
      const { insertedCount } = await uploadAgesIndexRecords(token, {
        clientName: clientName.trim(),
        trainerName: trainerName.trim() || undefined,
        deviceSource: DEVICE_SOURCE,
        records: pendingRecords,
      })
      setSaveState('saved')
      setSaveError(null)
      setSavedCount(insertedCount)
      setPendingRecords(null)
      setPendingFileName(null)
      onSaved()
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError()
        return
      }
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  const handleCancel = () => {
    setPendingRecords(null)
    setPendingFileName(null)
  }

  return (
    <div className="xmsk-section">
      <p className="app-subtitle">
        삼성 헬스 앱에서 내보낸 최종당화산물지수(AGEs Index) CSV 파일을 업로드하면 날짜별 지수와 등급을 기록으로
        저장할 수 있습니다. "raw"가 붙은 원본 데이터 파일이 아니라 지수 요약 파일을 선택해주세요.
      </p>

      <div className="eeg-connect-row">
        <button
          type="button"
          className="eeg-connect-button"
          onClick={handleButtonClick}
          disabled={saveState === 'saving'}
        >
          최종당화산물지수 CSV 업로드
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {parseError && (
        <div className="error-panel">
          <p style={{ margin: 0 }}>{parseError}</p>
        </div>
      )}

      {pendingRecords && (
        <div className="xmsk-section">
          <p className="app-subtitle" style={{ margin: 0 }}>
            "{pendingFileName}"에서 최종당화산물지수 기록 {pendingRecords.length}건을 찾았습니다(최신순).
          </p>
          <ul className="debug-stats-list">
            {pendingRecords.slice(0, 5).map((r, i) => (
              <li key={i}>
                {r.dayTimeLabel ?? r.dayTimeRaw} · {r.score} · {r.grade}
              </li>
            ))}
            {pendingRecords.length > 5 && <li>...외 {pendingRecords.length - 5}건</li>}
          </ul>
          {clientName.trim() === '' && <p className="rom-validation">저장하려면 회원 이름을 입력해야 합니다.</p>}
          <div className="eeg-capture-buttons">
            <button type="button" disabled={!canSave || saveState === 'saving'} onClick={handleSave}>
              {saveState === 'saving' ? '저장 중...' : `기록 저장 (${pendingRecords.length}건)`}
            </button>
            <button type="button" className="reset-button" onClick={handleCancel}>
              취소
            </button>
          </div>
        </div>
      )}

      <p className="rom-save-status">
        {saveState === 'saved' && `${savedCount ?? 0}건 저장되었습니다.`}
        {saveState === 'error' && `저장 실패: ${saveError}`}
      </p>
    </div>
  )
}
