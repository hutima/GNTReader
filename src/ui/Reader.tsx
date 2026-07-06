import { useEffect, useRef, useState } from 'react';
import type { ReadingChapter } from '@/domain/schema';
import { loadChapter } from '@/io/sources';
import { useAppStore } from '@/state/store';
import { VerseView } from './VerseView';

/**
 * The reading surface. Phase 3 renders the selected chapter; Phase 5 extends
 * this into a continuous range with sentinel-driven prefetch.
 */
export function Reader() {
  const { testament, bookNum, chapter, targetVerse, displayMode, selectedToken } = useAppStore();
  const selectToken = useAppStore((s) => s.selectToken);
  const clearTargetVerse = useAppStore((s) => s.clearTargetVerse);

  const [data, setData] = useState<ReadingChapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mySeq = ++seq.current;
    setLoading(true);
    setError(null);
    loadChapter(testament, bookNum, chapter)
      .then((ch) => {
        if (seq.current !== mySeq) return; // a newer navigation superseded us
        setData(ch);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (seq.current !== mySeq) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [testament, bookNum, chapter]);

  // Search/Strong's click-through: scroll the target verse into view.
  useEffect(() => {
    if (!data || targetVerse == null) return;
    const el = document.getElementById(`v-${data.chapter}-${targetVerse}`);
    if (el) el.scrollIntoView({ block: 'center' });
    clearTargetVerse();
  }, [data, targetVerse, clearTargetVerse]);

  // New chapter (without a target verse): back to the top.
  useEffect(() => {
    if (data && targetVerse == null) scrollerRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.sourceId, data?.bookNum, data?.chapter]);

  return (
    <div className="reader" ref={scrollerRef}>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {loading && !data && <div className="notice">Loading…</div>}
      {data && (
        <article className={`chapter ${data.language}-chapter`}>
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
      )}
    </div>
  );
}
