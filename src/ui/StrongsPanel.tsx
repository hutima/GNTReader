import { useEffect, useMemo, useState } from 'react';
import { foldAccents } from '@/domain/normalize';
import type { ReadingLanguage } from '@/domain/schema';
import { loadStrongs, searchStrongs, type StrongsEntry } from '@/io/strongs';
import { useAppStore } from '@/state/store';
import { useSheetDrag } from './useSheetDrag';

const GREEK_ALPHABET = [
  { key: 'α', symbol: 'Α', name: 'Alpha' },
  { key: 'β', symbol: 'Β', name: 'Beta' },
  { key: 'γ', symbol: 'Γ', name: 'Gamma' },
  { key: 'δ', symbol: 'Δ', name: 'Delta' },
  { key: 'ε', symbol: 'Ε', name: 'Epsilon' },
  { key: 'ζ', symbol: 'Ζ', name: 'Zeta' },
  { key: 'η', symbol: 'Η', name: 'Eta' },
  { key: 'θ', symbol: 'Θ', name: 'Theta' },
  { key: 'ι', symbol: 'Ι', name: 'Iota' },
  { key: 'κ', symbol: 'Κ', name: 'Kappa' },
  { key: 'λ', symbol: 'Λ', name: 'Lambda' },
  { key: 'μ', symbol: 'Μ', name: 'Mu' },
  { key: 'ν', symbol: 'Ν', name: 'Nu' },
  { key: 'ξ', symbol: 'Ξ', name: 'Xi' },
  { key: 'ο', symbol: 'Ο', name: 'Omicron' },
  { key: 'π', symbol: 'Π', name: 'Pi' },
  { key: 'ρ', symbol: 'Ρ', name: 'Rho' },
  { key: 'σ', symbol: 'Σ', name: 'Sigma' },
  { key: 'τ', symbol: 'Τ', name: 'Tau' },
  { key: 'υ', symbol: 'Υ', name: 'Upsilon' },
  { key: 'φ', symbol: 'Φ', name: 'Phi' },
  { key: 'χ', symbol: 'Χ', name: 'Chi' },
  { key: 'ψ', symbol: 'Ψ', name: 'Psi' },
  { key: 'ω', symbol: 'Ω', name: 'Omega' },
] as const;

function compareStrongNumber(a: StrongsEntry, b: StrongsEntry): number {
  const pa = a.strong.match(/^0*(\d+)([a-z]*)$/i);
  const pb = b.strong.match(/^0*(\d+)([a-z]*)$/i);
  if (!pa || !pb) return a.strong.localeCompare(b.strong, undefined, { numeric: true });
  return Number(pa[1]) - Number(pb[1]) || pa[2]!.localeCompare(pb[2]!);
}

function entryId(language: ReadingLanguage, strong: string): string {
  return `strongs-${language}-${strong.replace(/[^a-z0-9_-]/gi, '-')}`;
}

/**
 * Strong's lexicon browser/search: blank search browses the entire lexicon in
 * Strong's-number order; a query searches by number, lemma, transliteration,
 * gloss, or KJV rendering. Greek browse mode adds an alpha-to-omega jump rail.
 * "Occurrences" hands the entry to the morphology search scoped to the current
 * book.
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

  const browsing = query.trim().length === 0;

  const browseEntries = useMemo(
    () => (entries ? [...entries].sort(compareStrongNumber) : []),
    [entries],
  );

  const results = useMemo(
    () => (entries ? (browsing ? browseEntries : searchStrongs(entries, query)) : []),
    [browseEntries, browsing, entries, query],
  );

  const greekLetterStarts = useMemo(() => {
    const starts = new Map<string, string>();
    if (language !== 'grc') return starts;
    for (const entry of browseEntries) {
      const first = foldAccents(entry.lemma).charAt(0);
      if (!starts.has(first)) starts.set(first, entry.strong);
    }
    return starts;
  }, [browseEntries, language]);

  function findOccurrences(entry: StrongsEntry) {
    openSearch({ strong: entry.strong });
  }

  function jumpToGreekLetter(letter: string) {
    const strong = greekLetterStarts.get(letter);
    if (!strong) return;
    document.getElementById(entryId('grc', strong))?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
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
        {/* Keep the hardened grabber as the sheet's own sticky drag target.
            The lexicon scrolls underneath it; do not move pointer handlers
            onto the list or alphabet rail. */}
        <div className="grabber" {...grabberProps} />
        <div className="panel-desktop-actions">
          <button
            type="button"
            className="close"
            aria-label="Close Strong’s lexicon"
            onClick={() => openPanel('none')}
          >
            ✕
          </button>
        </div>
        <div className="field-row">
          <label className="field grow">
            <span>Strong’s search</span>
            <input
              type="search"
              value={query}
              placeholder="number (746 / G746), lemma, transliteration, gloss…"
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={Boolean(initialQuery.trim())}
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
          <>
            <div className="results-count" aria-live="polite">
              {browsing
                ? `${results.length.toLocaleString()} entries · Strong’s number order`
                : `${results.length} search ${results.length === 1 ? 'match' : 'matches'}`}
            </div>

            {browsing && language === 'grc' && (
              <nav className="strongs-alpha-nav" aria-label="Greek alphabet">
                {GREEK_ALPHABET.map(({ key, symbol, name }) => {
                  const available = greekLetterStarts.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="strongs-alpha-button"
                      aria-label={`Jump to ${name}`}
                      title={name}
                      disabled={!available}
                      onClick={() => jumpToGreekLetter(key)}
                    >
                      {symbol}
                    </button>
                  );
                })}
              </nav>
            )}

            <ul className="hit-list strongs-browse-list">
              {results.map((e) => (
                <li
                  id={entryId(e.language, e.strong)}
                  className="strongs-entry-anchor"
                  key={`${e.language}${e.strong}`}
                >
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
              {!browsing && results.length === 0 && (
                <li className="notice">No matches.</li>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
