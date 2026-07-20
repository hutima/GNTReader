import { useEffect, useState } from 'react';
import { loadProgressBooks } from '@/io/progress';
import { useAppStore } from '@/state/store';
import { aggregate, bookCoverage, fractionLabel, percentLabel, type ProgressBook } from './progress';

/**
 * Vocabulary-progress modal — mirrors KnownWordsModal's backdrop/dialog/close
 * conventions (src/ui/KnownWordsModal.tsx), plus Escape-to-close. Shows token
 * coverage (lexeme-or-parse known, out of every markable token) per book for
 * both testaments, lazily fetched on open via src/io/progress.ts and
 * recomputed live from the store's known-word sets (src/ui/progress.ts).
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; books: ProgressBook[] };

function useTestamentProgress(testament: 'gnt' | 'ot'): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadProgressBooks(testament).then(
      (books) => {
        if (!cancelled) setState({ status: 'ready', books });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Vocabulary progress is unavailable.',
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [testament]);

  return state;
}

function BookRow({
  book,
  knownLexemes,
  knownParses,
}: {
  book: ProgressBook;
  knownLexemes: ReadonlySet<string>;
  knownParses: ReadonlySet<string>;
}) {
  const { known, total } = bookCoverage(book, knownLexemes, knownParses);
  const max = total || 1;
  return (
    <div className="progress-book-row">
      <div className="progress-book-name">{book.name}</div>
      <progress
        className="progress-book-bar"
        value={known}
        max={max}
        aria-label={`${book.name} vocabulary progress`}
        aria-valuenow={known}
        aria-valuemin={0}
        aria-valuemax={max}
      />
      <div className="progress-book-stats">
        {percentLabel(known, total)} · {fractionLabel(known, total)}
      </div>
    </div>
  );
}

/** Aggregate coverage for a loaded testament, or null while loading/errored. */
function coverageOf(
  state: LoadState,
  knownLexemes: ReadonlySet<string>,
  knownParses: ReadonlySet<string>,
): { known: number; total: number } | null {
  if (state.status !== 'ready') return null;
  return aggregate(state.books.map((b) => bookCoverage(b, knownLexemes, knownParses)));
}

function TestamentGroup({
  title,
  state,
  knownLexemes,
  knownParses,
}: {
  title: string;
  state: LoadState;
  knownLexemes: ReadonlySet<string>;
  knownParses: ReadonlySet<string>;
}) {
  if (state.status === 'loading') {
    return (
      <section className="progress-group">
        <h3>{title}</h3>
        <p className="hint">Loading…</p>
      </section>
    );
  }
  if (state.status === 'error') {
    return (
      <section className="progress-group">
        <h3>{title}</h3>
        <p className="settings-note error">{state.message}</p>
      </section>
    );
  }

  const subtotal = coverageOf(state, knownLexemes, knownParses)!;

  return (
    <section className="progress-group">
      <h3>{title}</h3>
      {state.books.map((book) => (
        <BookRow key={book.bookNum} book={book} knownLexemes={knownLexemes} knownParses={knownParses} />
      ))}
      <div className="progress-subtotal">
        <span>{title} total</span>
        <span>
          {percentLabel(subtotal.known, subtotal.total)} · {fractionLabel(subtotal.known, subtotal.total)}
        </span>
      </div>
    </section>
  );
}

export function ProgressModal({ onClose }: { onClose: () => void }) {
  const knownLexemes = useAppStore((s) => s.knownLexemes);
  const knownParses = useAppStore((s) => s.knownParses);
  const gnt = useTestamentProgress('gnt');
  const ot = useTestamentProgress('ot');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const gntTotal = coverageOf(gnt, knownLexemes, knownParses);
  const otTotal = coverageOf(ot, knownLexemes, knownParses);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal progress-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Vocabulary progress"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">Vocabulary progress</h2>
        <TestamentGroup
          title="Greek New Testament"
          state={gnt}
          knownLexemes={knownLexemes}
          knownParses={knownParses}
        />
        <TestamentGroup
          title="Hebrew Old Testament"
          state={ot}
          knownLexemes={knownLexemes}
          knownParses={knownParses}
        />
        {gntTotal && otTotal && (
          <div className="progress-overall">
            <span>Overall</span>
            <span>
              {percentLabel(gntTotal.known + otTotal.known, gntTotal.total + otTotal.total)} ·{' '}
              {fractionLabel(gntTotal.known + otTotal.known, gntTotal.total + otTotal.total)}
            </span>
          </div>
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
