import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookInfo } from '@/io/books';
import { greekXmlToChapters } from '@/io/lowfat';

/**
 * The adapter reads a light slice of the MACULA `<wg>` tree: each token gets a
 * grammatical role and its innermost clause id (ADR-0001 amendment).
 */
const xml = readFileSync(join(__dirname, '..', 'public', 'fixtures', 'gnt', 'john-1.xml'), 'utf8');
const chapters = greekXmlToChapters(xml, { sourceId: 'test', book: bookInfo('gnt', 4)! });
const tokens = chapters.flatMap((c) => c.verses.flatMap((v) => v.tokens));

describe('lowfat syntax read', () => {
  it('annotates tokens with grammatical role and clause', () => {
    const roled = tokens.filter((t) => t.syntax?.role);
    expect(roled.length).toBeGreaterThan(0);
    const roles = new Set(roled.map((t) => t.syntax!.role));
    // John 1:1 alone carries subject, verb and predicate roles.
    expect(roles.has('v')).toBe(true);
    expect(roles.has('s')).toBe(true);
    expect(tokens.some((t) => t.syntax?.clauseId)).toBe(true);
    expect(tokens.some((t) => t.syntax?.clauseRule)).toBe(true);
  });

  it('gives clause-mates the same clause id', () => {
    const counts = new Map<string, number>();
    for (const t of tokens) {
      const id = t.syntax?.clauseId;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // At least one clause groups multiple words.
    expect([...counts.values()].some((n) => n > 1)).toBe(true);
  });
});
