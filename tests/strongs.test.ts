import { describe, expect, it } from 'vitest';
import { normalizeStrong, searchStrongs, STRONGS_RESULT_CAP, type StrongsEntry } from '@/io/strongs';

const entries: StrongsEntry[] = [
  { strong: '746', language: 'grc', lemma: 'ἀρχή', translit: 'archḗ', gloss: 'beginning', kjv: 'beginning, magistrate, power' },
  { strong: '7460', language: 'grc', lemma: 'ψευδο', translit: 'pseudo', gloss: 'fake' },
  { strong: '3056', language: 'grc', lemma: 'λόγος', translit: 'lógos', gloss: 'word', kjv: 'word, saying, account' },
  { strong: '3057', language: 'grc', lemma: 'λόγχη', translit: 'lónchē', gloss: 'a lance', kjv: 'spear' },
  { strong: '26', language: 'grc', lemma: 'ἀγάπη', translit: 'agápē', gloss: 'love', kjv: 'love, charity' },
];

describe('Strong’s search', () => {
  it('numeric search: exact beats prefix, G-prefix and leading zeros accepted', () => {
    expect(searchStrongs(entries, '746').map((e) => e.strong)).toEqual(['746', '7460']);
    expect(searchStrongs(entries, 'G746')[0]!.strong).toBe('746');
    expect(searchStrongs(entries, '0746')[0]!.strong).toBe('746');
  });

  it('lemma search is accent-insensitive; exact/prefix beats substring', () => {
    const r = searchStrongs(entries, 'λογος');
    expect(r[0]!.strong).toBe('3056');
    expect(searchStrongs(entries, 'αγαπη')[0]!.lemma).toBe('ἀγάπη');
  });

  it('transliteration and gloss and KJV renderings are searched', () => {
    expect(searchStrongs(entries, 'logos')[0]!.strong).toBe('3056');
    expect(searchStrongs(entries, 'beginning')[0]!.strong).toBe('746');
    expect(searchStrongs(entries, 'charity')[0]!.strong).toBe('26');
  });

  it('ranking is deterministic and results are capped', () => {
    const a = searchStrongs(entries, 'lo');
    const b = searchStrongs(entries, 'lo');
    expect(a).toEqual(b);
    const many: StrongsEntry[] = Array.from({ length: 100 }, (_, i) => ({
      strong: String(9000 + i),
      language: 'grc',
      lemma: `λεξις${i}`,
      gloss: 'common gloss',
    }));
    expect(searchStrongs(many, 'common gloss')).toHaveLength(STRONGS_RESULT_CAP);
  });

  it('normalizeStrong handles prefixes, zeros, and letter suffixes', () => {
    expect(normalizeStrong('G3056')).toBe('3056');
    expect(normalizeStrong('0871a')).toBe('871a');
    expect(normalizeStrong('H0430')).toBe('430');
  });
});
