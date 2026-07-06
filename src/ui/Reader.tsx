import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReadingChapter } from '@/domain/schema';
import { bookInfo } from '@/io/books';
import { loadChapter, prefetchAdjacent } from '@/io/sources';
import { useAppStore } from '@/state/store';
import { VerseView } from './VerseView';

/**
 * Continuous-scroll reading surface. Renders a contiguous chapter range of
 * the current book; IntersectionObserver sentinels extend the range, the
 * loader prefetches adjacent chapters, and prepends preserve the scroll
 * position (scrollTop compensated in a layout effect before paint).
 */
export function Reader() {
  const { testament, bookNum, chapter, targetVerse, displayMode, selectedToken } = useAppStore();
  const selectToken = useAppStore((s) => s.selectToken);
  const clearTargetVerse = useAppStore((s) => s.clearTargetVerse);

  const [chapters, setChapters] = useState<ReadingChapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const busyRef = useRef(false);
  /** Set before a prepend; consumed by the layout effect to keep the view still. */
  const prependHeightRef = useRef<number | null>(null);

  const book = bookInfo(testament, bookNum);
  const maxChapter = book?.chapters ?? 1;

  // Anchor load: navigation resets the range to the selected chapter.
  useEffect(() => {
    const mySeq = ++seq.current;
    busyRef.current = false;
    prependHeightRef.current = null;
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
            if (direction === 'up') {
              prependHeightRef.current = scrollerRef.current?.scrollHeight ?? null;
            }
            setChapters((cs) => {
              // The range may have been reset while we were loading.
              if (!cs.length) return cs;
              if (direction === 'up' && cs[0]!.chapter === next + 1) return [ch, ...cs];
              if (direction === 'down' && cs[cs.length - 1]!.chapter === next - 1)
                return [...cs, ch];
              return cs;
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
    [testament, bookNum, maxChapter],
  );

  // Keep the viewport still when content is prepended above it.
  useLayoutEffect(() => {
    const prevHeight = prependHeightRef.current;
    const scroller = scrollerRef.current;
    if (prevHeight != null && scroller) {
      scroller.scrollTop += scroller.scrollHeight - prevHeight;
      prependHeightRef.current = null;
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
            <article key={data.chapter} className={`chapter ${data.language}-chapter`}>
              <h2 className="chapter-heading">
                {data.book} {data.chapter}
              </h2>
              <p className="verses" lang={data.language === 'hbo' ? 'he' : 'el'}>
                {data.verses.map((v) => (
                  <VerseView
                    key={v.id}
                    verse={v}
                    mode={displayMode}
                    selectedId={selectedToken?.id ?? null}
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
