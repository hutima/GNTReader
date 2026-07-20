import { useState } from 'react';
import type { Testament } from '@/domain/schema';
import { bookInfo, booksOf } from '@/io/books';
import { useAppStore } from '@/state/store';
import { useSheetDrag } from './useSheetDrag';

/**
 * Book/chapter selector — a modal sheet with a testament segmented control,
 * book grid, then chapter grid. Two taps from anywhere to any chapter.
 */
export function BookPicker() {
  const currentTestament = useAppStore((s) => s.testament);
  const currentBookNum = useAppStore((s) => s.bookNum);
  // The chapter actually scrolled to, not just last-navigated (FL-008) — so
  // the highlight below follows continuous-scroll reading, not just taps.
  const currentVisibleChapter = useAppStore((s) => s.visibleChapter);
  const navigate = useAppStore((s) => s.navigate);
  const openPanel = useAppStore((s) => s.openPanel);

  const [testament, setTestament] = useState<Testament>(currentTestament);
  const [bookNum, setBookNum] = useState<number | null>(null);

  const { grabberProps, sheetStyle } = useSheetDrag(() => openPanel('none'));

  const book = bookNum != null ? bookInfo(testament, bookNum) : undefined;

  return (
    <div className="sheet-backdrop" onClick={() => openPanel('none')}>
      <section
        className="panel-sheet"
        role="dialog"
        aria-label="Choose book and chapter"
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
      >
        <div className="grabber" {...grabberProps} />
        <div className="segmented" role="tablist" aria-label="Testament">
          <button
            type="button"
            role="tab"
            aria-selected={testament === 'ot'}
            className={testament === 'ot' ? 'on' : ''}
            onClick={() => {
              setTestament('ot');
              setBookNum(null);
            }}
          >
            Hebrew OT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={testament === 'gnt'}
            className={testament === 'gnt' ? 'on' : ''}
            onClick={() => {
              setTestament('gnt');
              setBookNum(null);
            }}
          >
            Greek NT
          </button>
        </div>

        {!book ? (
          <div className="grid books">
            {booksOf(testament).map((b) => {
              const isCurrent = testament === currentTestament && b.num === currentBookNum;
              return (
                <button
                  key={b.num}
                  type="button"
                  className={isCurrent ? 'cell current' : 'cell'}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    if (b.chapters === 1) {
                      navigate(testament, b.num, 1);
                    } else {
                      setBookNum(b.num);
                    }
                  }}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="picker-bar">
              <button type="button" className="link" onClick={() => setBookNum(null)}>
                ‹ Books
              </button>
              <strong>{book.name}</strong>
            </div>
            <div className="grid chapters">
              {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => {
                const isCurrent =
                  testament === currentTestament &&
                  book.num === currentBookNum &&
                  c === currentVisibleChapter;
                return (
                  <button
                    key={c}
                    type="button"
                    className={isCurrent ? 'cell num current' : 'cell num'}
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={() => navigate(testament, book.num, c)}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
