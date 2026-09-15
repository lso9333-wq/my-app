interface Props {
  totalCount: number
  selectedCount: number
  onToggleAll: () => void
  onDeleteSelected: () => void
  deleting?: boolean
}

/**
 * 저장 기록 목록(ROM/보행진단/XMSK 마사지·평가/손·발) 6곳이 전부 같은 "목록+상세+개별
 * 삭제" 패턴을 쓰고 있어(CLAUDE.md 참고), 거기에 얹는 "여러 개 선택 삭제" UI도 순수
 * 화면 요소일 뿐 특정 기능의 도메인 타입에 의존하지 않으므로 shared/components에
 * 하나만 두고 공유한다 — ComparisonBarChart/VideoUploader와 같은 성격의 공유(기존
 * 관례상 금지된 것은 feature 간 "도메인 로직/타입" 참조이지, 이런 범용 UI 조각의 공유가
 * 아니다). 선택 상태(Set<number>)와 실제 삭제 호출은 각 히스토리 컴포넌트가 스스로
 * 관리하고, 이 컴포넌트는 그 상태를 보여주고 버튼 클릭을 전달만 한다.
 */
export function BulkSelectionBar({ totalCount, selectedCount, onToggleAll, onDeleteSelected, deleting }: Props) {
  if (totalCount === 0) return null

  return (
    <div className="rom-history-bulk-bar">
      <label className="rom-history-select-all">
        <input
          type="checkbox"
          checked={selectedCount > 0 && selectedCount === totalCount}
          ref={(el) => {
            if (el) el.indeterminate = selectedCount > 0 && selectedCount < totalCount
          }}
          onChange={onToggleAll}
        />
        전체 선택 ({selectedCount}/{totalCount})
      </label>
      <button
        type="button"
        className="rom-history-bulk-delete"
        disabled={selectedCount === 0 || deleting}
        onClick={onDeleteSelected}
      >
        {deleting ? '삭제 중...' : `선택 삭제 (${selectedCount})`}
      </button>
    </div>
  )
}
