import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReadingChapter, ReadingToken } from '@/domain/schema';
import { bookInfo } from '@/io/books';
import { loadChapter, prefetchAdjacent } from '@/io/sources';
import { useAppStore } from '@/state/store';
import {
  atCompensatedScroll,
  captureWidthAnchor,
  clamp01,
  pickVisibleChapter,
  widthChanged,
  widthRestoreDelta,
} from './anchor';
import type { WidthAnchor } from './anchor';
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

/**
 * A `.verse`'s own getBoundingClientRect() under-reports its true vertical
 * extent: in "Both" mode each `.token` is an inline-flex column (surface
 * over gloss) with `vertical-align: top`, and a token taller than its line's
 * normal metrics can visually overflow below the line box without that
 * overflow being reflected in the ANCESTOR span's reported fragment rects
 * (verified in a real Chromium: a verse's bbox ended 20px above a directly
 * nested token's own bbox). Reconstruct the real extent as the union of its
 * tokens' rects instead, so the width-anchor ratio (FL-008) is computed
 * against what's actually on screen.
 */
function verseVisualRect(verseEl: HTMLElement): { top: number; bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  verseEl.querySelectorAll<HTMLElement>('.token, .verse-num').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.top < top) top = r.top;
    if (r.bottom > bottom) bottom = r.bottom;
  });
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
    const r = verseEl.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  }
  return { top, bottom };
}

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
  /** Width-reflow ratio anchor (FL-008) — orthogonal to `anchorRef` above:
   *  that one tracks height changes from prepend/trim, this one tracks width
   *  changes from the desktop side panel opening/closing. */
  const widthAnchorRef = useRef<WidthAnchor | null>(null);
  /** Last content-box width seen by the ResizeObserver, to gate strictly on
   *  width changes (ordinary scrolling/height changes must never trigger a
   *  width compensation). */
  const lastWidthRef = useRef<number | null>(null);
  /** The scrollTop value the app itself last WROTE while compensating a layout
   *  mutation (a width reflow's RO restore, or an FL-004 prepend/trim). While
   *  the scroller still sits exactly there — i.e. no user scroll has moved it
   *  since — the width anchor must NOT be re-captured (FL-008): consecutive
   *  `.verse` spans share the line where one ends and the next begins, so their
   *  token-union rects overlap by ~a line and `elementFromPoint` at the midpoint
   *  can re-pick the ADJACENT verse. Re-capturing then flips the anchor's
   *  identity with no real movement, and the inverse reflow (panel close) lands
   *  one line off. A genuine user scroll changes scrollTop away from this value
   *  and re-enables capture. */
  const compensatedScrollTopRef = useRef<number | null>(null);

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

  /**
   * Recompute both FL-008 mechanisms from the currently-committed layout:
   * the width-reflow ratio anchor (the `.verse` at the viewport midpoint,
   * and how far through its height that midpoint falls) and the visible
   * chapter (for the header title, picker highlight, and persisted position
   * — never for navigation). Reads only refs and the store's transient
   * `getState()`, so it is stable across renders and safe to call from a
   * scroll listener, a layout effect, or a ResizeObserver callback bound
   * once at mount.
   */
  const captureAll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    // A resize "in flight": the browser can auto-clamp scrollTop the instant
    // scrollHeight shrinks (closing the side panel back to a wider, shorter
    // layout), which fires an ordinary 'scroll' event for the listener below
    // BEFORE the ResizeObserver callback runs its own compensation (measured
    // in real Chromium — the scroll event's own capture ran first and
    // silently swapped the tracked verse for an unrelated one several
    // chapters away, using pre-compensation geometry). `lastWidthRef` is
    // updated ONLY inside the RO callback, so while it still disagrees with
    // the scroller's actual current width, capturing now would stomp the
    // anchor the RO is about to restore against — skip; the RO's own tail
    // call re-captures once compensation has landed and the width matches.
    if (lastWidthRef.current != null && widthChanged(lastWidthRef.current, scrollerRect.width)) {
      return;
    }
    const viewTop = scrollerRect.top;
    const viewBottom = scrollerRect.bottom;
    const midX = (scrollerRect.left + scrollerRect.right) / 2;
    const midY = viewTop + scroller.clientHeight / 2;

    // Don't re-capture the width anchor while the scroller still sits exactly
    // where the app last programmatically compensated a layout mutation and no
    // user scroll has moved it since (FL-008). The reflow's own tail capture
    // and the 'scroll' event its scrollTop write fires would otherwise re-pick
    // a DIFFERENT verse in the shared-line overlap zone (adjacent `.verse`
    // spans' token-union rects overlap by ~a line, so `elementFromPoint` at the
    // midpoint can hit the neighbour), flipping the anchor identity with no real
    // movement so the inverse reflow (panel close) restores the wrong verse and
    // lands one line off. Visible-chapter tracking below still updates. A real
    // user scroll changes scrollTop, clearing the guard and resuming capture.
    if (!atCompensatedScroll(scroller.scrollTop, compensatedScrollTopRef.current)) {
      // `.verse` is an INLINE span that can wrap several lines, so its
      // getBoundingClientRect() is a union box that routinely overlaps its
      // neighbours' (a verse ending mid-line and the next starting on that same
      // line share y-range) — a plain top/bottom containment scan over those
      // union boxes can therefore miss the verse that's actually rendered at
      // the midpoint and fall back to one several verses away. Ask the DOM what
      // is really there first; only fall back to the pure rect scan (still
      // exercised directly by tests/reader-anchor.test.ts) if that misses, e.g.
      // the exact pixel lands on inter-line padding that hit-tests to the
      // `.verses` container rather than a token.
      const direct = document.elementFromPoint(midX, midY)?.closest<HTMLElement>('.verse');
      if (direct && scroller.contains(direct)) {
        const rect = verseVisualRect(direct);
        const height = rect.bottom - rect.top;
        widthAnchorRef.current = {
          id: direct.id,
          ratio: height > 0 ? clamp01((midY - rect.top) / height) : 0,
        };
      } else {
        const verses: { id: string; top: number; bottom: number }[] = [];
        scroller.querySelectorAll<HTMLElement>('.verse').forEach((el) => {
          const r = el.getBoundingClientRect();
          verses.push({ id: el.id, top: r.top, bottom: r.bottom });
        });
        widthAnchorRef.current = captureWidthAnchor(verses, midY, viewTop, viewBottom);
      }
    }

    const articles = [...articleRefs.current.entries()].map(([chapterNum, el]) => {
      const r = el.getBoundingClientRect();
      return { chapter: chapterNum, top: r.top, bottom: r.bottom };
    });
    const visible = pickVisibleChapter(articles, midY, viewTop, viewBottom);
    if (visible != null && visible !== useAppStore.getState().visibleChapter) {
      useAppStore.getState().setVisibleChapter(visible);
    }
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
        // Same-content compensation (FL-004 prepend/trim): keep the width anchor
        // stable across it, don't let the tail capture re-pick a neighbour verse
        // (FL-008). A later user scroll clears this guard.
        compensatedScrollTopRef.current = scroller.scrollTop;
      }
      anchorRef.current = null;
    }
    captureAll();
  }, [chapters, captureAll]);

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

  // rAF-throttled scroll tracking (FL-008): recompute the width anchor and
  // the visible chapter as the reader scrolls. Bound once per scroller mount
  // — `captureAll` is stable (reads refs/getState only), so this never needs
  // to rebind across range changes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        captureAll();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [captureAll]);

  // Width-gated reflow compensation (FL-008): opening/closing the desktop
  // side panel at 768–834px flex-shrinks the reader column, rewrapping every
  // line and shifting scrollHeight by 130-151% — a plain height change (new
  // chapter loaded) must NOT trigger this, only an actual width change.
  // Bound once per scroller mount; reads only refs, so it survives range
  // changes untouched.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    lastWidthRef.current = scroller.getBoundingClientRect().width;
    // Re-measure via getBoundingClientRect() (border-box) rather than the
    // observer entry's contentRect (content-box, excluding padding) — using
    // the SAME basis as the initial seed above and as captureAll()'s own
    // reads keeps `lastWidthRef` numerically comparable everywhere it's
    // checked (a border-box vs. content-box mismatch would otherwise look
    // like a spurious width change at mount, or make captureAll()'s in-flight
    // guard above never agree with the RO once it's actually settled).
    const ro = new ResizeObserver(() => {
      const newWidth = scroller.getBoundingClientRect().width;
      const prevWidth = lastWidthRef.current;
      lastWidthRef.current = newWidth;
      if (prevWidth == null || !widthChanged(prevWidth, newWidth)) return; // height-only change
      const anchor = widthAnchorRef.current;
      if (anchor) {
        const el = document.getElementById(anchor.id);
        if (el) {
          const rect = verseVisualRect(el);
          const scrollerRect = scroller.getBoundingClientRect();
          const delta = widthRestoreDelta(rect, anchor.ratio, scrollerRect.top, scroller.clientHeight);
          scroller.scrollTop += delta;
          // Mark this as an app-driven position so the tail capture below (and
          // the 'scroll' event this write fires) don't flip the anchor to an
          // adjacent verse in the shared-line overlap zone (FL-008).
          compensatedScrollTopRef.current = scroller.scrollTop;
        }
      }
      captureAll();
    });
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [captureAll]);

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
  //
  // Deferred TWO frames: on desktop, selecting a token can ALSO mount the
  // side panel in the same commit, which flex-shrinks the reader and
  // triggers the width-anchor's own ResizeObserver-driven scrollTop
  // compensation (FL-008, above). A React passive effect is not guaranteed
  // to run after that RO callback — measured in real Chromium, a single
  // requestAnimationFrame deferral still ran BEFORE the RO's notification
  // for the very same resize (RO fired ~0.1ms after that rAF, i.e. later in
  // the same turn of the event loop), so this effect saw the token's STALE
  // pre-compensation position (thousands of px off after a 130-151%
  // reflow) and fired its OWN competing scrollBy, fighting the width-anchor
  // restore. A SECOND rAF (scheduled from inside the first) reliably lands
  // on the frame after the RO has already settled, so this really is the
  // no-op the "already visible" guard intends on desktop.
  const selectedTokenId = selectedToken?.id ?? null;
  useEffect(() => {
    if (!selectedTokenId) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });
    function run() {
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
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
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
