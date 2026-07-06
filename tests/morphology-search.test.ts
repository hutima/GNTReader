import { describe, expect, it } from 'vitest';
import { greekXmlToChapters, hebrewXmlToChapters } from '@/io/lowfat';
import { GNT_BOOKS, OT_BOOKS } from '@/io/books';
import { contextLine, matchToken, type SearchQuery } from '@/search/morphology';
import { fixtureXml } from './fixtures';

const john1 = greekXmlToChapters(fixtureXml('gnt/john-1.xml'), {
  sourceId: 'macula-greek-sblgnt-lowfat',
  book: GNT_BOOKS.find((b) => b.name === 'John')!,
})[0]!;
const gen1 = hebrewXmlToChapters(fixtureXml('ot/01-Gen-001-lowfat.xml'), {
  sourceId: 'macula-hebrew-wlc-lowfat',
  book: OT_BOOKS.find((b) => b.name === 'Genesis')!,
})[0]!;

function hits(chapter: typeof john1, q: SearchQuery) {
  return chapter.verses.flatMap((v) => v.tokens.filter((t) => matchToken(t, q)));
}

describe('morphology search on fixtures', () => {
  it('lemma search finds λόγος in John 1 (accent-insensitive, final-sigma-safe)', () => {
    const r = hits(john1, { text: 'λογος', field: 'lemma' });
    expect(r.length).toBeGreaterThanOrEqual(4); // 1:1 ×3 + 1:14
    expect(r.every((t) => t.lemma === 'λόγος')).toBe(true);
    // Verse 1 has three of them.
    expect(r.filter((t) => t.verse === 1)).toHaveLength(3);
  });

  it('gloss search works', () => {
    const r = hits(john1, { text: 'beginning', field: 'gloss' });
    expect(r.length).toBeGreaterThanOrEqual(2); // 1:1, 1:2 ἀρχή
    expect(r.every((t) => t.lemma === 'ἀρχή')).toBe(true);
  });

  it('tense + mood filters: imperfect indicatives of εἰμί in John 1:1', () => {
    const r = hits(john1, { text: 'ειμι', field: 'lemma', tense: 'imperfect', mood: 'indicative' });
    expect(r.length).toBeGreaterThanOrEqual(3); // ἦν ×3 in verse 1 alone
    expect(r.every((t) => t.morphology?.tense === 'imperfect')).toBe(true);
  });

  it('case filter: datives matching surface αρχη are found, nominatives are not', () => {
    const dat = hits(john1, { text: 'αρχ', field: 'surface', case: 'dative' });
    expect(dat.length).toBeGreaterThan(0);
    expect(dat.every((t) => t.morphology?.case === 'dative')).toBe(true);
    const voc = hits(john1, { text: 'αρχ', field: 'surface', case: 'vocative' });
    expect(voc).toHaveLength(0);
  });

  it('Strong’s occurrence search works on Greek and Hebrew fixtures', () => {
    const logos = hits(john1, { strong: 'G3056' });
    expect(logos.length).toBeGreaterThanOrEqual(4);
    expect(logos.every((t) => t.strong === '3056')).toBe(true);

    const elohim = hits(gen1, { strong: 'H430' });
    expect(elohim.length).toBeGreaterThanOrEqual(30); // אלהים ~32× in Gen 1
    expect(elohim.every((t) => t.lemma?.normalize('NFC') === 'אֱלֹהִים'.normalize('NFC'))).toBe(
      true,
    );
  });

  it('Hebrew morphology filter: qal qatal verbs in Genesis 1 include ברא', () => {
    const r = hits(gen1, { pos: 'verb', person: 'third', gender: 'masculine', number: 'singular' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((t) => t.lemma?.normalize('NFC') === 'בָּרָא'.normalize('NFC'))).toBe(true);
  });

  it('context line centers on the hit and truncates with ellipses', () => {
    const v1 = john1.verses[0]!;
    const logos = v1.tokens[4]!; // first λόγος
    const ctx = contextLine(v1, logos);
    expect(ctx).toContain('λόγος');
    expect(ctx.endsWith('…')).toBe(true);
  });
});
