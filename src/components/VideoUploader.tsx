import { useRef, type ChangeEvent, type DragEvent } from 'react'

interface Props {
  onSelect: (file: File) => void
  disabled?: boolean
}

export function VideoUploader({ onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file && file.type.startsWith('video/')) onSelect(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`uploader ${disabled ? 'disabled' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
      <div className="uploader-icon" aria-hidden>
        🚶
      </div>
      <p className="uploader-title">걷는 모습을 촬영한 동영상을 업로드하세요</p>
      <p className="uploader-hint">탭하거나 파일을 끌어다 놓기 · 옆에서 촬영한 영상이 가장 정확합니다</p>
    </div>
  )
}
