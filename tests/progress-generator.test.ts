import { describe, expect, it } from 'vitest';
import { GNT_BOOKS, OT_BOOKS } from '@/io/books';
import { greekXmlToChapters, hebrewXmlToChapters } from '@/io/lowfat';
import { lexemeKey, parseKey } from '@/ui/vocab';
import { ProgressBookSchema } from '@/ui/progress';
import type { ReadingToken } from '@/domain/schema';
import { buildBookBlock } from '../scripts/generate/progress';
import { fixtureXml } from './fixtures';

/**
 * Offline tests for the vocabulary-progress generator's pure fold
 * (scripts/generate/progress.ts `buildBookBlock`), run against the bundled
 * John 1 + Genesis 1 fixtures already used by tests/gnt-adapter.test.ts and
 * tests/ot-adapter.test.ts. No network — the full 27-book / 929-chapter
 * download is exercised only by `npm run generate:progress` itself.
 */

const john = GNT_BOOKS.find((b) => b.name === 'John')!;
const johnChapters = greekXmlToChapters(fixtureXml('gnt/john-1.xml'), {
  sourceId: 'macula-greek-sblgnt-lowfat',
  book: john,
});
const johnTokens: ReadingToken[] = johnChapters.flatMap((c) => c.verses.flatMap((v) => v.tokens));

const genesis = OT_BOOKS.find((b) => b.name === 'Genesis')!;
const genesisChapters = hebrewXmlToChapters(fixtureXml('ot/01-Gen-001-lowfat.xml'), {
  sourceId: 'macula-hebrew-wlc-lowfat',
  book: genesis,
});
const genesisTokens: ReadingToken[] = genesisChapters.flatMap((c) => c.verses.flatMap((v) => v.tokens));

describe.each([
  ['John 1 (Greek)', john, johnTokens] as const,
  ['Genesis 1 (Hebrew)', genesis, genesisTokens] as const,
])('buildBookBlock — %s', (_label, book, tokens) => {
  const block = buildBookBlock(book.num, book.name, tokens);

  it('validates against the zod schema', () => {
    expect(() => ProgressBookSchema.parse(block)).not.toThrow();
  });

  it('emits L/P keys EXACTLY equal to vocab.ts lexemeKey/parseKey over the same tokens', () => {
    const expectedLexemes = new Set(
      tokens.map((t) => lexemeKey(t)).filter((k): k is string => k !== null),
    );
    const expectedParses = new Set(tokens.map((t) => parseKey(t)));
    expect(new Set(block.L)).toEqual(expectedLexemes);
    expect(new Set(block.P)).toEqual(expectedParses);
  });

  it('every token maps to one of the emitted (li,pi) pairs, and pair counts sum to the token total', () => {
    for (const token of tokens) {
      const pi = block.P.indexOf(parseKey(token));
      expect(pi).toBeGreaterThanOrEqual(0);
      const lk = lexemeKey(token);
      const li = lk === null ? -1 : block.L.indexOf(lk);
      if (lk !== null) expect(li).toBeGreaterThanOrEqual(0);
      expect(block.c.some(([rowLi, rowPi]) => rowLi === li && rowPi === pi)).toBe(true);
    }
    const sum = block.c.reduce((acc, [, , count]) => acc + count, 0);
    expect(sum).toBe(tokens.length);
  });

  it('c rows are unique (li,pi) pairs (no duplicate pair rows)', () => {
    const seen = new Set(block.c.map(([li, pi]) => `${li}|${pi}`));
    expect(seen.size).toBe(block.c.length);
  });

  it('is deterministic: two runs over the same tokens produce identical JSON', () => {
    const again = buildBookBlock(book.num, book.name, tokens);
    expect(JSON.stringify(again)).toBe(JSON.stringify(block));
  });

  it('L and P are sorted', () => {
    expect(block.L).toEqual([...block.L].sort());
    expect(block.P).toEqual([...block.P].sort());
  });

  it('c rows are sorted by (li, pi)', () => {
    const sorted = [...block.c].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(block.c).toEqual(sorted);
  });
});
