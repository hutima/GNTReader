import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { ProgressModal } from '@/ui/ProgressModal';
import { resetProgressCache } from '@/io/progress';
import { useAppStore } from '@/state/store';
import type { ProgressBook } from '@/ui/progress';

/**
 * ProgressModal: Settings wiring, open/close/Escape, computed percentages
 * from a mocked index, live recalculation on known-word changes, a11y roles,
 * and the zero-data-book NaN guard.
 */

const johnBook: ProgressBook = {
  bookNum: 4,
  name: 'John',
  L: ['grc|λόγος'],
  P: ['grc|λόγος|parse-a', 'grc|θεός|parse-b'],
  c: [
    [0, 0, 4], // λόγος, 4 occurrences
    [-1, 1, 6], // some other word, 6 occurrences, no lexeme key
  ],
};
const emptyBook: ProgressBook = { bookNum: 1, name: 'Genesis', L: [], P: [], c: [] };

function stubProgressFetch() {
  const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost/');
    if (url.pathname.endsWith('/progress/gnt.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          meta: { sources: [], keySemantics: 'src/ui/vocab.ts lexemeKey/parseKey' },
          books: [johnBook],
        }),
      } as unknown as Response;
    }
    if (url.pathname.endsWith('/progress/ot.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          meta: { sources: [], keySemantics: 'src/ui/vocab.ts lexemeKey/parseKey' },
          books: [emptyBook],
        }),
      } as unknown as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

/** The book-row stats element's text, e.g. "40% · 4 / 10 tokens" (three sibling text nodes). */
function statsTextFor(container: HTMLElement, bookName: string): string {
  const row = within(container)
    .getByText(bookName)
    .closest('.progress-book-row')!;
  return row.querySelector('.progress-book-stats')!.textContent ?? '';
}

beforeEach(() => {
  resetProgressCache();
});

afterEach(() => {
  useAppStore.getState().resetKnown();
  useAppStore.getState().openPanel('none');
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Settings wiring', () => {
  it('shows a "Vocabulary progress" button next to "Known words"', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const buttons = within(dialog).getAllByRole('button');
    const names = buttons.map((b) => b.textContent ?? '');
    const knownIdx = names.findIndex((n) => n.startsWith('Known words'));
    const progressIdx = names.findIndex((n) => n === 'Vocabulary progress');
    expect(knownIdx).toBeGreaterThanOrEqual(0);
    expect(progressIdx).toBe(knownIdx + 1);
  });
});

describe('ProgressModal', () => {
  it('opens, renders computed percentages, and closes on Escape', async () => {
    stubProgressFetch();
    useAppStore.getState().markKnown('lexeme', 'grc|λόγος'); // known=4, total=10 -> 40%
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<ProgressModal onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Vocabulary progress' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await screen.findByText('John');
    await waitFor(() => expect(statsTextFor(container, 'John')).toBe('40% · 4 / 10 tokens'));

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Close button click and on backdrop click', async () => {
    stubProgressFetch();
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<ProgressModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).toBeTruthy();
    await user.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('marking a lexeme known updates the shown percentage without a refetch', async () => {
    const mockFetch = stubProgressFetch();
    useAppStore.getState().markKnown('lexeme', 'grc|λόγος'); // known=4, total=10 -> 40%
    const { container } = render(<ProgressModal onClose={() => {}} />);

    await screen.findByText('John');
    await waitFor(() => expect(statsTextFor(container, 'John')).toBe('40% · 4 / 10 tokens'));

    const callsBefore = mockFetch.mock.calls.length;

    // Mark the lexeme-less word's exact parse known too (parse-b, 6 occurrences) -> 10/10.
    useAppStore.getState().markKnown('parse', 'grc|θεός|parse-b');

    await waitFor(() => expect(statsTextFor(container, 'John')).toBe('100% · 10 / 10 tokens'));
    // No additional fetch — the cached index was reused, only the store changed.
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
  });

  it('has accessible progress bars with valuenow/min/max', async () => {
    stubProgressFetch();
    useAppStore.getState().markKnown('lexeme', 'grc|λόγος'); // known=4, total=10
    render(<ProgressModal onClose={() => {}} />);

    await screen.findByText('John');
    const johnBar = await screen.findByRole('progressbar', { name: 'John vocabulary progress' });
    await waitFor(() => expect(johnBar).toHaveAttribute('aria-valuenow', '4'));
    expect(johnBar).toHaveAttribute('aria-valuemin', '0');
    expect(johnBar).toHaveAttribute('aria-valuemax', '10');
  });

  it('a zero-data book shows 0%/— rather than NaN', async () => {
    stubProgressFetch();
    const { container } = render(<ProgressModal onClose={() => {}} />);

    await screen.findByText('Genesis');
    const dialog = screen.getByRole('dialog', { name: 'Vocabulary progress' });
    expect(dialog.textContent).not.toMatch(/NaN/);
    await waitFor(() => expect(statsTextFor(container, 'Genesis')).toBe('— · 0 / 0 tokens'));
  });
});
