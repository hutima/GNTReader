import { useAppStore } from '@/state/store';

interface KnownItem {
  key: string;
  lang: string;
  lemma: string;
  sig?: string;
}

function byLemma(a: KnownItem, b: KnownItem): number {
  return a.lemma.localeCompare(b.lemma) || (a.sig ?? '').localeCompare(b.sig ?? '');
}

/**
 * Reviewable list of known vocabulary. Lexemes and single forms are listed
 * separately, alphabetically, each removable with an ✕.
 */
export function KnownWordsModal({ onClose }: { onClose: () => void }) {
  const knownLexemes = useAppStore((s) => s.knownLexemes);
  const knownParses = useAppStore((s) => s.knownParses);
  const unmarkKnown = useAppStore((s) => s.unmarkKnown);

  const lexemes: KnownItem[] = [...knownLexemes]
    .map((key) => {
      const [lang, lemma] = key.split('|');
      return { key, lang: lang ?? 'grc', lemma: lemma ?? key };
    })
    .sort(byLemma);

  const parses: KnownItem[] = [...knownParses]
    .map((key) => {
      const parts = key.split('|');
      return { key, lang: parts[0] ?? 'grc', lemma: parts[1] ?? '', sig: parts.slice(2).join('|') };
    })
    .sort(byLemma);

  const empty = lexemes.length === 0 && parses.length === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Known words"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">Known words</h2>
        {empty ? (
          <p className="hint">No words marked known yet.</p>
        ) : (
          <>
            {lexemes.length > 0 && (
              <>
                <h3 className="known-group">Words ({lexemes.length})</h3>
                <ul className="known-list">
                  {lexemes.map((it) => (
                    <li key={it.key}>
                      <span className={`known-lemma ${it.lang}`}>{it.lemma}</span>
                      <span className="grow" />
                      <button
                        type="button"
                        className="known-x"
                        aria-label={`Remove ${it.lemma}`}
                        onClick={() => unmarkKnown('lexeme', it.key)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {parses.length > 0 && (
              <>
                <h3 className="known-group">Forms ({parses.length})</h3>
                <ul className="known-list">
                  {parses.map((it) => (
                    <li key={it.key}>
                      <span className={`known-lemma ${it.lang}`}>{it.lemma}</span>
                      {it.sig && <span className="known-sig">{it.sig}</span>}
                      <span className="grow" />
                      <button
                        type="button"
                        className="known-x"
                        aria-label={`Remove ${it.lemma} ${it.sig ?? ''}`.trim()}
                        onClick={() => unmarkKnown('parse', it.key)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <button type="button" className="mini" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
