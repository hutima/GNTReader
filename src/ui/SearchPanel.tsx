import { useEffect, useRef, useState } from 'react';
import { bookInfo } from '@/io/books';
import {
  searchScope,
  type SearchHit,
  type SearchProgress,
  type SearchQuery,
  type SearchResult,
} from '@/search/morphology';
import { useAppStore } from '@/state/store';
import { displayGloss, morphChips } from './morph';

/**
 * Morphology/concordance search over the current book (or chapter). Streams
 * chapter-by-chapter with progress + Stop; results click through to the
 * verse and open the token detail panel.
 */

const CASES = ['nominative', 'genitive', 'dative', 'accusative', 'vocative'];
const GENDERS = ['masculine', 'feminine', 'neuter', 'common', 'both'];
const NUMBERS = ['singular', 'dual', 'plural'];
const PERSONS = ['first', 'second', 'third'];
const TENSES = ['present', 'imperfect', 'future', 'aorist', 'perfect', 'pluperfect'];
const VOICES = ['active', 'middle', 'passive', 'middlepassive'];
const MOODS = ['indicative', 'subjunctive', 'optative', 'imperative', 'infinitive', 'participle'];
const POS = [
  'noun',
  'propernoun',
  'pronoun',
  'verb',
  'participle',
  'infinitive',
  'adjective',
  'adverb',
  'article',
  'preposition',
  'conjunction',
  'particle',
  'interjection',
  'numeral',
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange(v: string): void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchPanel() {
  const testament = useAppStore((s) => s.testament);
  const bookNum = useAppStore((s) => s.bookNum);
  const chapter = useAppStore((s) => s.chapter);
  const prefill = useAppStore((s) => s.searchPrefill);
  const consumeSearchPrefill = useAppStore((s) => s.consumeSearchPrefill);
  const openPanel = useAppStore((s) => s.openPanel);
  const navigate = useAppStore((s) => s.navigate);
  const selectToken = useAppStore((s) => s.selectToken);

  const [q, setQ] = useState<SearchQuery>({ field: 'any' });
  const [scope, setScope] = useState<'chapter' | 'book'>('chapter');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const book = bookInfo(testament, bookNum);

  useEffect(() => {
    if (prefill) {
      setQ({ field: 'any', ...prefill });
      setScope('book');
      consumeSearchPrefill();
    }
  }, [prefill, consumeSearchPrefill]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (p: Partial<SearchQuery>) => setQ((prev) => ({ ...prev, ...p }));

  async function run() {
    if (!book || running) return;
    abortRef.current = new AbortController();
    setRunning(true);
    setResult(null);
    setProgress(null);
    try {
      const r = await searchScope(
        {
          testament,
          bookNum,
          startChapter: scope === 'chapter' ? chapter : 1,
          endChapter: scope === 'chapter' ? chapter : book.chapters,
        },
        q,
        { signal: abortRef.current.signal, onProgress: setProgress },
      );
      setResult(r);
    } finally {
      setRunning(false);
    }
  }

  function openHit(hit: SearchHit) {
    selectToken(hit.token);
    navigate(testament, hit.token.bookNum, hit.token.chapter, hit.token.verse);
  }

  return (
    <div className="sheet-backdrop" onClick={() => openPanel('none')}>
      <section
        className="panel-sheet"
        role="dialog"
        aria-label="Morphology search"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grabber" aria-hidden="true" />
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="field-row">
            <label className="field grow">
              <span>Text</span>
              <input
                type="search"
                value={q.text ?? ''}
                placeholder={testament === 'gnt' ? 'λογος, λέγω, word…' : 'ברא, אלהים, God…'}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </label>
            <label className="field">
              <span>In</span>
              <select
                value={q.field ?? 'any'}
                onChange={(e) => patch({ field: e.target.value as SearchQuery['field'] })}
              >
                <option value="any">any</option>
                <option value="surface">surface</option>
                <option value="lemma">lemma</option>
                <option value="gloss">gloss</option>
              </select>
            </label>
            <label className="field">
              <span>Strong’s</span>
              <input
                type="search"
                className="narrow"
                value={q.strong ?? ''}
                placeholder={testament === 'gnt' ? 'G3056' : 'H430'}
                onChange={(e) => patch({ strong: e.target.value })}
              />
            </label>
          </div>

          <div className="field-row">
            <Select label="POS" value={q.pos ?? ''} options={POS} onChange={(v) => patch({ pos: v || undefined })} />
            {testament === 'gnt' && (
              <>
                <Select label="Case" value={q.case ?? ''} options={CASES} onChange={(v) => patch({ case: v || undefined })} />
                <Select label="Tense" value={q.tense ?? ''} options={TENSES} onChange={(v) => patch({ tense: v || undefined })} />
                <Select label="Voice" value={q.voice ?? ''} options={VOICES} onChange={(v) => patch({ voice: v || undefined })} />
                <Select label="Mood" value={q.mood ?? ''} options={MOODS} onChange={(v) => patch({ mood: v || undefined })} />
              </>
            )}
            <Select label="Gender" value={q.gender ?? ''} options={GENDERS} onChange={(v) => patch({ gender: v || undefined })} />
            <Select label="Number" value={q.number ?? ''} options={NUMBERS} onChange={(v) => patch({ number: v || undefined })} />
            <Select label="Person" value={q.person ?? ''} options={PERSONS} onChange={(v) => patch({ person: v || undefined })} />
          </div>

          <div className="field-row">
            <div className="segmented" role="tablist" aria-label="Scope">
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'chapter'}
                className={scope === 'chapter' ? 'on' : ''}
                onClick={() => setScope('chapter')}
              >
                {book?.name} {chapter}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'book'}
                className={scope === 'book' ? 'on' : ''}
                onClick={() => setScope('book')}
              >
                All of {book?.name}
              </button>
            </div>
            <div className="grow" />
            {running ? (
              <button type="button" className="button" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" className="button primary">
                Search
              </button>
            )}
          </div>
        </form>

        {running && progress && (
          <div className="progress" role="status">
            <progress value={progress.chaptersDone} max={progress.chaptersTotal} />{' '}
            {progress.chaptersDone}/{progress.chaptersTotal} chapters
          </div>
        )}

        {result && (
          <div className="results">
            <p className="results-count" role="status">
              {result.hits.length}
              {result.capped ? '+' : ''} result{result.hits.length === 1 ? '' : 's'}
              {result.failedChapters.length > 0 &&
                ` · ${result.failedChapters.length} chapter(s) unavailable`}
            </p>
            <ul className="hit-list">
              {result.hits.map((hit) => (
                <li key={hit.token.id}>
                  <button type="button" className="hit" onClick={() => openHit(hit)}>
                    <span className="hit-ref">{hit.ref}</span>
                    <span className={`hit-surface ${hit.token.language}`}>{hit.token.surface}</span>
                    <span className="hit-meta">
                      <span className={hit.token.language}>{hit.token.lemma}</span>
                      {' · '}
                      {displayGloss(hit.token)}
                    </span>
                    <span className="chips">
                      {morphChips(hit.token).map((c, i) => (
                        <span key={i} className="chip">
                          {c}
                        </span>
                      ))}
                    </span>
                    <span className={`hit-context ${hit.token.language}`}>{hit.context}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
