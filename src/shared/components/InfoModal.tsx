import './InfoModal.css'
import type { InfoPage } from '../../app/legalContent'

interface InfoModalProps {
  page: InfoPage
  onClose: () => void
}

export function InfoModal({ page, onClose }: InfoModalProps) {
  return (
    <div className="info-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-label={page.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-modal-head">
          <h2>{page.title}</h2>
          <button type="button" className="info-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="info-modal-body">
          {page.sections.map((section) => (
            <section key={section.title} className="info-modal-section">
              <h3>{section.title}</h3>
              {section.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
