import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bookInfo } from '@/io/books';
import { greekXmlToChapters } from '@/io/lowfat';
import { useAppStore } from '@/state/store';
import { isKnown, lexemeKey, parseKey } from '@/ui/vocab';

/**
 * Known-vocabulary marking: a reader marks a whole lexeme or a single parse
 * known; the choice persists and drives gloss hiding in Both mode.
 */
const xml = readFileSync(join(__dirname, '..', 'public', 'fixtures', 'gnt', 'john-1.xml'), 'utf8');
const tokens = greekXmlToChapters(xml, { sourceId: 'test', book: bookInfo('gnt', 4)! }).flatMap(
  (c) => c.verses.flatMap((v) => v.tokens),
);
const token = tokens.find((t) => t.lemma)!;

afterEach(() => {
  useAppStore.getState().resetKnown();
  localStorage.clear();
});

describe('vocabulary', () => {
  it('keys a lexeme and a parse distinctly', () => {
    expect(lexemeKey(token)).toBe(`grc|${token.lemma}`);
    expect(parseKey(token).startsWith(`grc|${token.lemma}|`)).toBe(true);
    expect(parseKey(token)).not.toBe(lexemeKey(token));
  });

  it('marking the lexeme known covers every inflection', () => {
    const s0 = useAppStore.getState();
    expect(isKnown(token, s0.knownLexemes, s0.knownParses)).toBe(false);
    s0.markKnown('lexeme', lexemeKey(token)!);
    const s1 = useAppStore.getState();
    expect(isKnown(token, s1.knownLexemes, s1.knownParses)).toBe(true);
    const sameLemma = tokens.find((x) => x.lemma === token.lemma && x.id !== token.id);
    if (sameLemma) expect(isKnown(sameLemma, s1.knownLexemes, s1.knownParses)).toBe(true);
    // persisted
    expect(localStorage.getItem('gr:knownLexemes')).toContain(token.lemma!);
  });

  it('marking a single parse known does not touch the lexeme set', () => {
    useAppStore.getState().markKnown('parse', parseKey(token));
    const s1 = useAppStore.getState();
    expect(isKnown(token, s1.knownLexemes, s1.knownParses)).toBe(true);
    expect(s1.knownLexemes.size).toBe(0);
    expect(s1.knownParses.size).toBe(1);
  });

  it('reset clears all known words', () => {
    const s0 = useAppStore.getState();
    s0.markKnown('lexeme', lexemeKey(token)!);
    s0.markKnown('parse', parseKey(token));
    s0.resetKnown();
    const s1 = useAppStore.getState();
    expect(s1.knownLexemes.size).toBe(0);
    expect(s1.knownParses.size).toBe(0);
    expect(isKnown(token, s1.knownLexemes, s1.knownParses)).toBe(false);
  });
});
