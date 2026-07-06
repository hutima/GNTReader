import { useEffect, useMemo, useState } from 'react';
import type { ReadingLanguage } from '@/domain/schema';
import { loadStrongs, searchStrongs, type StrongsEntry } from '@/io/strongs';
import { useAppStore } from '@/state/store';
import { useSheetDrag } from './useSheetDrag';

/**
 * Strong's lexicon search: by number, lemma, transliteration, gloss, or KJV
 * rendering, with a Greek/Hebrew language filter. "Occurrences" hands the
 * entry to the morphology search scoped to the current book.
 */
export function StrongsPanel() {
  const testament = useAppStore((s) => s.testament);
  const initialQuery = useAppStore((s) => s.strongsQuery);
  const openPanel = useAppStore((s) => s.openPanel);
  const openSearch = useAppStore((s) => s.openSearch);
  const { grabberProps, sheetStyle } = useSheetDrag(() => openPanel('none'));

  const [language, setLanguage] = useState<ReadingLanguage>(() => {
    // A G/H-prefixed prefill picks its own language; else follow the text.
    if (/^h/i.test(initialQuery.trim())) return 'hbo';
    if (/^g/i.test(initialQuery.trim())) return 'grc';
    return testament === 'ot' ? 'hbo' : 'grc';
  });
  const [query, setQuery] = useState(initialQuery);
  const [entries, setEntries] = useState<StrongsEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    loadStrongs(language)
      .then((e) => {
        if (!cancelled) setEntries(e);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const results = useMemo(
    () => (entries ? searchStrongs(entries, query) : []),
    [entries, query],
  );

  function findOccurrences(entry: StrongsEntry) {
    openSearch({ strong: entry.strong });
  }

  return (
    <div className="sheet-backdrop" onClick={() => openPanel('none')}>
      <section
        className="panel-sheet"
        role="dialog"
        aria-label="Strong’s lexicon"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grabber" {...grabberProps} />
        <div className="field-row">
          <label className="field grow">
            <span>Strong’s search</span>
            <input
              type="search"
              value={query}
              placeholder="number (746 / G746), lemma, transliteration, gloss…"
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>
          <div className="segmented" role="tablist" aria-label="Lexicon language">
            <button
              type="button"
              role="tab"
              aria-selected={language === 'grc'}
              className={language === 'grc' ? 'on' : ''}
              onClick={() => setLanguage('grc')}
            >
              Greek
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={language === 'hbo'}
              className={language === 'hbo' ? 'on' : ''}
              onClick={() => setLanguage('hbo')}
            >
              Hebrew
            </button>
          </div>
        </div>

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {!entries && !error && <div className="notice">Loading lexicon…</div>}

        {entries && (
          <ul className="hit-list">
            {results.map((e) => (
              <li key={`${e.language}${e.strong}`}>
                <div className="hit strongs-hit">
                  <span className="hit-ref">
                    {e.language === 'hbo' ? 'H' : 'G'}
                    {e.strong}
                  </span>
                  <span className={`hit-surface ${e.language}`}>{e.lemma}</span>
                  <span className="hit-meta">
                    {e.translit ?? '—'}
                    {e.gloss ? ` · ${e.gloss}` : ''}
                  </span>
                  {/* Occurrence search runs over the CURRENT book — only
                      offered when the entry's language matches it, so a
                      Hebrew number is never counted against Greek tokens. */}
                  {((e.language === 'grc') === (testament === 'gnt')) && (
                    <button type="button" className="link" onClick={() => findOccurrences(e)}>
                      Occurrences ›
                    </button>
                  )}
                </div>
              </li>
            ))}
            {query.trim() && results.length === 0 && (
              <li className="notice">No matches.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
