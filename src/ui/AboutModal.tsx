/**
 * Dismissible centered "About the author" modal, opened from the bottom of
 * the Settings sheet. Mirrors KnownWordsModal's backdrop/dialog/close
 * conventions (see src/ui/KnownWordsModal.tsx).
 */
export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal about"
        role="dialog"
        aria-modal="true"
        aria-label="About the author"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">About the author</h2>
        <p className="settings-note">
          GNT Reader is maintained by Timothy Hutama, an MTS student at Wycliffe College. The
          author makes no guarantees about the content but has made a best attempt to make sure
          everything is accurate.
        </p>
        <p className="settings-note">
          Timothy blogs at{' '}
          <a href="https://definedfaith.wordpress.com/" target="_blank" rel="noopener noreferrer">
            definedfaith.wordpress.com
          </a>
          .
        </p>
        <p className="settings-note">
          If you have comments or issues, please reach out on{' '}
          <a href="https://www.linkedin.com/in/timothyhutama/" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          .
        </p>
        <div className="settings-note">
          <span>Other projects by Timothy:</span>
          <ul className="about-links">
            <li>
              <a
                href="https://hutima.github.io/Lectio-Memorization/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bible &amp; catechism memorization
              </a>
            </li>
            <li>
              <a
                href="https://hutima.github.io/ScriptureDiagrammer/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Scripture Diagrammer
              </a>
            </li>
            <li>
              <a
                href="https://hutima.github.io/PCA_Ordination_Study/"
                target="_blank"
                rel="noopener noreferrer"
              >
                PCA ordination study
              </a>
            </li>
          </ul>
        </div>
        <p className="settings-note">
          If you&apos;d like to buy me a coffee as thanks, you can send a gift via e-transfer to{' '}
          <a href="mailto:t.hutama@queensu.ca">t.hutama@queensu.ca</a> or Venmo at{' '}
          <strong>@hutima</strong>.
        </p>
        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <button type="button" className="mini" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
