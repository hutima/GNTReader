import { describe, expect, it } from 'vitest';
import { hebrewXmlToChapters } from '@/io/lowfat';
import { OT_BOOKS } from '@/io/books';
import { ReadingChapterSchema } from '@/domain/schema';
import { fixtureXml } from './fixtures';

const genesis = OT_BOOKS.find((b) => b.name === 'Genesis')!;
const chapters = hebrewXmlToChapters(fixtureXml('ot/01-Gen-001-lowfat.xml'), {
  sourceId: 'macula-hebrew-wlc-lowfat',
  book: genesis,
});

describe('OT fixture conversion (Genesis 1)', () => {
  it('yields chapter 1 with 31 verses and validates', () => {
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.verses).toHaveLength(31);
    expect(() => ReadingChapterSchema.parse(chapters[0])).not.toThrow();
  });

  it('Genesis 1:1 morpheme order is sane (RTL is a display concern only)', () => {
    const v1 = chapters[0]!.verses[0]!;
    expect(v1.ref).toBe('Genesis 1:1');
    // Morphemes in logical (reading) order: בְּ רֵאשִׁית בָּרָא אֱלֹהִים …
    // Compare NFC-normalized: the source's combining-mark order differs
    // from this file's literals while being canonically equivalent.
    const nfc = (s: string | undefined) => s?.normalize('NFC');
    expect(nfc(v1.tokens[0]!.surface)).toBe('בְּ'.normalize('NFC'));
    expect(nfc(v1.tokens[1]!.lemma)).toBe('רֵאשִׁית'.normalize('NFC'));
    expect(nfc(v1.tokens[2]!.lemma)).toBe('בָּרָא'.normalize('NFC'));
    expect(nfc(v1.tokens[3]!.lemma)).toBe('אֱלֹהִים'.normalize('NFC'));
    expect(v1.tokens.every((t) => t.language === 'hbo' && t.testament === 'ot')).toBe(true);
  });

  it('morphemes of one written word share wordIndex, ordered by subIndex', () => {
    const v1 = chapters[0]!.verses[0]!;
    const word1 = v1.tokens.filter((t) => t.wordIndex === 1); // בְּ + רֵאשִׁית
    expect(word1).toHaveLength(2);
    expect(word1.map((t) => t.subIndex)).toEqual([0, 1]);
    // The prefix has no `after` — it joins its host with no space.
    expect(word1[0]!.after ?? '').not.toContain(' ');
  });

  it('Hebrew morphology fields are preserved', () => {
    const v1 = chapters[0]!.verses[0]!;
    const bara = v1.tokens[2]!; // בָּרָא
    expect(bara.pos).toBe('verb');
    expect(bara.morphology).toMatchObject({
      gender: 'masculine',
      number: 'singular',
      person: 'third',
    });
    expect(bara.morphology?.extra?.stem).toBe('qal');
    expect(bara.morphology?.extra?.type).toBe('qatal');
    const reshit = v1.tokens[1]!;
    expect(reshit.morphology?.state).toBe('absolute');
  });

  it('Hebrew tokens carry source transliteration and Strong’s', () => {
    const v1 = chapters[0]!.verses[0]!;
    expect(v1.tokens[1]!.transliteration).toBe('rēʾšiyṯ');
    expect(v1.tokens[1]!.strong).toBe('7225');
    expect(v1.tokens[2]!.transliteration).toBe('bārāʾ');
    expect(v1.tokens[2]!.gloss).toBe('he.created');
  });
});
