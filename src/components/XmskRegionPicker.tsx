import { XMSK_RECIPES } from '../lib/xmskRecipes'
import type { XmskRegionKey } from '../types/xmsk'

interface Props {
  onSelect: (region: XmskRegionKey) => void
}

export function XmskRegionPicker({ onSelect }: Props) {
  return (
    <div className="xmsk-region-grid">
      {XMSK_RECIPES.map((r) => (
        <button key={r.key} type="button" className="xmsk-region-card" onClick={() => onSelect(r.key)}>
          <strong>{r.title}</strong>
          <span>{r.subtitle}</span>
        </button>
      ))}
    </div>
  )
}
