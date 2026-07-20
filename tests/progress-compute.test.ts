import { describe, expect, it } from 'vitest';
import { aggregate, bookCoverage, fractionLabel, percentLabel, type ProgressBook } from '@/ui/progress';

/**
 * Unit tests for src/ui/progress.ts — the pure runtime compute layer over
 * the generated index. No fetch, no DOM.
 */

// A tiny synthetic book: L=[grc|λόγος, grc|θεός], P=[parse-a, parse-b, parse-c].
// Rows: (0,0,3) lexeme λόγος/parse-a x3, (1,1,2) lexeme θεός/parse-b x2,
// (-1,2,5) lexeme-less token/parse-c x5. Total = 10 tokens.
const book: ProgressBook = {
  bookNum: 4,
  name: 'John',
  L: ['grc|λόγος', 'grc|θεός'],
  P: ['grc|λόγος|parse-a', 'grc|θεός|parse-b', 'grc||parse-c'],
  c: [
    [0, 0, 3],
    [1, 1, 2],
    [-1, 2, 5],
  ],
};

describe('bookCoverage', () => {
  it('counts nothing known when both sets are empty', () => {
    expect(bookCoverage(book, new Set(), new Set())).toEqual({ known: 0, total: 10 });
  });

  it('lexeme-known coverage: marking a lexeme known counts every row referencing it', () => {
    const { known, total } = bookCoverage(book, new Set(['grc|λόγος']), new Set());
    expect(total).toBe(10);
    expect(known).toBe(3);
  });

  it('parse-known coverage: marking an exact parse known counts just that row', () => {
    const { known } = bookCoverage(book, new Set(), new Set(['grc|θεός|parse-b']));
    expect(known).toBe(2);
  });

  it('a token known BOTH ways (lexeme AND parse) is counted once, not twice', () => {
    const { known, total } = bookCoverage(
      book,
      new Set(['grc|λόγος']),
      new Set(['grc|λόγος|parse-a']),
    );
    expect(total).toBe(10);
    expect(known).toBe(3); // not 6
  });

  it('repeated tokens (a pair with count > 1) count repeatedly, not once', () => {
    const { known } = bookCoverage(book, new Set(), new Set(['grc||parse-c']));
    expect(known).toBe(5);
  });

  it('a lexeme-less row (li = -1) can only be known via its parse key', () => {
    // Marking a lexeme key that happens to equal the row's language prefix
    // must not accidentally match; only explicit parse-known counts it.
    const { known } = bookCoverage(book, new Set(['grc|']), new Set());
    expect(known).toBe(0);
  });

  it('marking everything known yields known === total', () => {
    const { known, total } = bookCoverage(
      book,
      new Set(['grc|λόγος', 'grc|θεός']),
      new Set(['grc||parse-c']),
    );
    expect(known).toBe(total);
  });

  it('zero-denominator: an empty book (no rows) is {known: 0, total: 0}', () => {
    const empty: ProgressBook = { bookNum: 1, name: 'Empty', L: [], P: [], c: [] };
    expect(bookCoverage(empty, new Set(), new Set())).toEqual({ known: 0, total: 0 });
  });
});

describe('aggregate', () => {
  it('sums known/total across multiple book coverages (testament + overall totals)', () => {
    const a = { known: 3, total: 10 };
    const b = { known: 20, total: 40 };
    expect(aggregate([a, b])).toEqual({ known: 23, total: 50 });
    expect(aggregate([a, b, { known: 0, total: 0 }])).toEqual({ known: 23, total: 50 });
  });

  it('aggregate of an empty list is zero/zero', () => {
    expect(aggregate([])).toEqual({ known: 0, total: 0 });
  });
});

describe('live recalculation', () => {
  it('recomputes fresh numbers when the known sets change (no stale caching)', () => {
    const knownLexemes = new Set<string>();
    const knownParses = new Set<string>();
    expect(bookCoverage(book, knownLexemes, knownParses).known).toBe(0);

    knownLexemes.add('grc|λόγος');
    expect(bookCoverage(book, knownLexemes, knownParses).known).toBe(3);

    knownParses.add('grc|θεός|parse-b');
    expect(bookCoverage(book, knownLexemes, knownParses).known).toBe(5);
  });
});

describe('percentLabel', () => {
  it('0/0 renders without NaN (em dash)', () => {
    expect(percentLabel(0, 0)).toBe('—');
  });

  it('0 known of a nonzero total renders 0%', () => {
    expect(percentLabel(0, 10)).toBe('0%');
  });

  it('never shows 100% unless known === total > 0', () => {
    expect(percentLabel(999, 1000)).not.toBe('100%');
    expect(percentLabel(1000, 1000)).toBe('100%');
  });

  it('rounds a partial fraction', () => {
    expect(percentLabel(62, 100)).toBe('62%');
  });
});

describe('fractionLabel', () => {
  it('formats known / total with thousands separators', () => {
    expect(fractionLabel(4120, 6650)).toBe('4,120 / 6,650 tokens');
  });

  it('never NaN at zero', () => {
    expect(fractionLabel(0, 0)).toBe('0 / 0 tokens');
  });
});
