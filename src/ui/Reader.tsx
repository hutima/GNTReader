import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReadingChapter, ReadingToken } from '@/domain/schema';
import { bookInfo } from '@/io/books';
import { loadChapter, prefetchAdjacent } from '@/io/sources';
import { useAppStore } from '@/state/store';
import { VerseView } from './VerseView';
import { lexemeKey, parseKey } from './vocab';

/**
 * Continuous-scroll reading surface. Keeps a sliding WINDOW of chapters around
 * the reading position (the visible chapter ± WINDOW_RADIUS); IntersectionObserver
 * sentinels extend the range and chapters that fall outside the window are
 * dropped so a long session never grows unbounded. Every range change is made
 * invisible to the reader by anchoring the top-most visible chapter and
 * restoring its position in a layout effect before paint (Safari/iOS has no
 * native scroll anchoring).
 */
const WINDOW_RADIUS = 2;
const MAX_LOADED = WINDOW_RADIUS * 2 + 1; // visible chapter ± 2 → at most 5

export function Reader() {
  const { testament, bookNum, chapter, targetVerse, displayMode, selectedToken } = useAppStore();
  const selectToken = useAppStore((s) => s.selectToken);
  const clearTargetVerse = useAppStore((s) => s.clearTargetVerse);
  const syntaxHighlight = useAppStore((s) => s.syntaxHighlight);
  const vocabMode = useAppStore((s) => s.vocabMode);
  const vocabMarkLexeme = useAppStore((s) => s.vocabMarkLexeme);
  const knownLexemes = useAppStore((s) => s.knownLexemes);
  const knownParses = useAppStore((s) => s.knownParses);
  const markKnown = useAppStore((s) => s.markKnown);
  const unmarkKnown = useAppStore((s) => s.unmarkKnown);
  const selectedClauseId = selectedToken?.syntax?.clauseId ?? null;

  // Long-press toggles a word known — the whole lexeme or just this parse,
  // per the Settings preference (falls back to parse when there is no lemma).
  const toggleKnown = useCallback(
    (token: ReadingToken) => {
      const lk = vocabMarkLexeme ? lexemeKey(token) : null;
      if (lk) {
        if (knownLexemes.has(lk)) unmarkKnown('lexeme', lk);
        else markKnown('lexeme', lk);
        return;
      }
      const pk = parseKey(token);
      if (knownParses.has(pk)) unmarkKnown('parse', pk);
      else markKnown('parse', pk);
    },
    [vocabMarkLexeme, knownLexemes, knownParses, markKnown, unmarkKnown],
  );

  const [chapters, setChapters] = useState<ReadingChapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const busyRef = useRef(false);
  /** Chapter <article> elements by chapter number, for scroll-anchor math. */
  const articleRefs = useRef(new Map<number, HTMLElement>());
  /** Anchor captured before a range mutation; consumed by the layout effect. */
  const anchorRef = useRef<{ chapter: number; top: number } | null>(null);

  const book = bookInfo(testament, bookNum);
  const maxChapter = book?.chapters ?? 1;

  /** Record the top-most visible chapter and its offset so a prepend or a trim
   *  can keep it fixed on screen. Reads the currently-committed layout. */
  const captureAnchor = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const sTop = scroller.getBoundingClientRect().top;
    const entries = [...articleRefs.current.entries()].sort((a, b) => a[0] - b[0]);
    for (const [chapterNum, el] of entries) {
      const r = el.getBoundingClientRect();
      if (r.bottom > sTop + 1) {
        anchorRef.current = { chapter: chapterNum, top: r.top - sTop };
        return;
      }
    }
    anchorRef.current = null;
  }, []);

  // Anchor load: navigation resets the range to the selected chapter.
  useEffect(() => {
    const mySeq = ++seq.current;
    busyRef.current = false;
    anchorRef.current = null;
    setLoading(true);
    setError(null);
    loadChapter(testament, bookNum, chapter)
      .then((ch) => {
        if (seq.current !== mySeq) return;
        setChapters([ch]);
        setLoading(false);
        prefetchAdjacent(testament, bookNum, chapter);
      })
      .catch((e: unknown) => {
        if (seq.current !== mySeq) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [testament, bookNum, chapter]);

  const extend = useCallback(
    (direction: 'up' | 'down') => {
      if (busyRef.current) return;
      const mySeq = seq.current;
      setChapters((current) => {
        if (!current.length) return current;
        const next =
          direction === 'up' ? current[0]!.chapter - 1 : current[current.length - 1]!.chapter + 1;
        if (next < 1 || next > maxChapter) return current;
        busyRef.current = true;
        void loadChapter(testament, bookNum, next)
          .then((ch) => {
            if (seq.current !== mySeq) return;
            setChapters((cs) => {
              // The range may have been reset while we were loading.
              if (!cs.length) return cs;
              let out: ReadingChapter[];
              if (direction === 'up' && cs[0]!.chapter === next + 1) out = [ch, ...cs];
              else if (direction === 'down' && cs[cs.length - 1]!.chapter === next - 1)
                out = [...cs, ch];
              else return cs;
              // Drop chapters that fell outside the window, from the far end.
              if (out.length > MAX_LOADED) {
                out =
                  direction === 'up'
                    ? out.slice(0, MAX_LOADED)
                    : out.slice(out.length - MAX_LOADED);
              }
              // Read the pre-mutation layout so the effect can keep it still.
              captureAnchor();
              return out;
            });
            prefetchAdjacent(testament, bookNum, next);
          })
          .catch(() => {
            /* stay at the current range; a retry happens on next intersection */
          })
          .finally(() => {
            busyRef.current = false;
          });
        return current;
      });
    },
    [testament, bookNum, maxChapter, captureAnchor],
  );

  // Keep the anchored chapter visually fixed across prepends and trims.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const scroller = scrollerRef.current;
    if (anchor && scroller) {
      const el = articleRefs.current.get(anchor.chapter);
      if (el) {
        const newTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += newTop - anchor.top;
      }
      anchorRef.current = null;
    }
  }, [chapters]);

  // Sentinels: extend the range when the reader nears either end. Recreated
  // whenever the RENDERED range changes (not just its length — an anchor
  // navigation replaces [1] with [3]): a fresh observer reports sentinels
  // that are already intersecting, which a persisting observer never
  // re-fires for, so a newly opened chapter pulls in its neighbours
  // immediately.
  const anchorKey = `${testament}/${bookNum}/${chapter}`;
  const rangeKey = chapters.length
    ? `${anchorKey}:${chapters[0]!.chapter}-${chapters[chapters.length - 1]!.chapter}`
    : anchorKey;
  useEffect(() => {
    const scroller = scrollerRef.current;
    const top = topSentinelRef.current;
    const bottom = bottomSentinelRef.current;
    if (!scroller || !top || !bottom || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          extend(entry.target === top ? 'up' : 'down');
        }
      },
      { root: scroller, rootMargin: '600px 0px' },
    );
    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extend, rangeKey]);

  // Search/Strong's click-through: scroll the target verse into view.
  useEffect(() => {
    if (!chapters.length || targetVerse == null) return;
    const el = document.getElementById(`v-${chapter}-${targetVerse}`);
    if (el) el.scrollIntoView({ block: 'center' });
    clearTargetVerse();
  }, [chapters, chapter, targetVerse, clearTargetVerse]);

  // Plain chapter navigation: back to the top.
  useEffect(() => {
    if (targetVerse == null) scrollerRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // Selecting a word the detail sheet would cover (or that is off-screen):
  // bring it to the middle of the still-visible reader area. No-op if it is
  // already fully visible — e.g. the desktop side panel, which covers nothing.
  const selectedTokenId = selectedToken?.id ?? null;
  useEffect(() => {
    if (!selectedTokenId) return;
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>('.token.selected');
    if (!scroller || !el) return;
    const scrollerRect = scroller.getBoundingClientRect();
    // The mobile detail sheet is a fixed overlay; the visible reader area ends
    // at its top edge. The desktop side panel covers nothing.
    const sheet = document.querySelector<HTMLElement>('.detail.sheet');
    const visibleTop = scrollerRect.top;
    const visibleBottom = sheet
      ? Math.min(scrollerRect.bottom, sheet.getBoundingClientRect().top)
      : scrollerRect.bottom;
    const rect = el.getBoundingClientRect();
    if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return; // already visible
    const delta = (rect.top + rect.bottom) / 2 - (visibleTop + visibleBottom) / 2;
    scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }, [selectedTokenId]);

  return (
    <div className="reader" ref={scrollerRef}>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {loading && !chapters.length && <div className="notice">Loading…</div>}
      {chapters.length > 0 && (
        <>
          <div ref={topSentinelRef} className="sentinel" aria-hidden="true" />
          {chapters.map((data) => (
            <article
              key={data.chapter}
              id={`ch-${data.chapter}`}
              ref={(el) => {
                const m = articleRefs.current;
                if (el) m.set(data.chapter, el);
                else m.delete(data.chapter);
              }}
              className={`chapter ${data.language}-chapter`}
            >
              <h2 className="chapter-heading">
                {data.book} {data.chapter}
              </h2>
              <p
                className={`verses mode-${displayMode}`}
                lang={data.language === 'hbo' ? 'he' : 'el'}
              >
                {data.verses.map((v) => (
                  <VerseView
                    key={v.id}
                    verse={v}
                    mode={displayMode}
                    selectedId={selectedToken?.id ?? null}
                    selectedClauseId={selectedClauseId}
                    syntaxOn={syntaxHighlight}
                    vocabOn={vocabMode}
                    knownLexemes={knownLexemes}
                    knownParses={knownParses}
                    onMark={toggleKnown}
                    onSelect={selectToken}
                  />
                ))}
              </p>
            </article>
          ))}
          <div ref={bottomSentinelRef} className="sentinel" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
