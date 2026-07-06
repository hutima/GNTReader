import { describe, expect, it } from 'vitest';
import { greekXmlToChapters } from '@/io/lowfat';
import { GNT_BOOKS } from '@/io/books';
import { ReadingChapterSchema } from '@/domain/schema';
import { fixtureXml } from './fixtures';

const john = GNT_BOOKS.find((b) => b.name === 'John')!;
const chapters = greekXmlToChapters(fixtureXml('gnt/john-1.xml'), {
  sourceId: 'macula-greek-sblgnt-lowfat',
  book: john,
});

describe('GNT fixture conversion (John 1)', () => {
  it('yields exactly chapter 1 with all 51 verses', () => {
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.chapter).toBe(1);
    expect(chapters[0]!.verses.map((v) => v.verse)).toEqual(
      Array.from({ length: 51 }, (_, i) => i + 1),
    );
  });

  it('validates against the ReadingChapter schema', () => {
    expect(() => ReadingChapterSchema.parse(chapters[0])).not.toThrow();
  });

  it('John 1:1 has the exact SBLGNT surface text in order', () => {
    const v1 = chapters[0]!.verses[0]!;
    expect(v1.ref).toBe('John 1:1');
    expect(v1.tokens.map((t) => t.surface)).toEqual([
      'Ἐν',
      'ἀρχῇ',
      'ἦν',
      'ὁ',
      'λόγος',
      'καὶ',
      'ὁ',
      'λόγος',
      'ἦν',
      'πρὸς',
      'τὸν',
      'θεόν',
      'καὶ',
      'θεὸς',
      'ἦν',
      'ὁ',
      'λόγος',
    ]);
  });

  it('tokens carry lemma, gloss, morphology, and Strong’s', () => {
    const v1 = chapters[0]!.verses[0]!;
    const arche = v1.tokens[1]!;
    expect(arche.lemma).toBe('ἀρχή');
    expect(arche.gloss).toBe('beginning');
    expect(arche.strong).toBe('746');
    expect(arche.pos).toBe('noun');
    expect(arche.morphology).toMatchObject({
      case: 'dative',
      gender: 'feminine',
      number: 'singular',
    });
    expect(arche.morphology?.extra?.morph).toBe('N-DSF');

    const en = v1.tokens[2]!; // ἦν
    expect(en.pos).toBe('verb');
    expect(en.morphology).toMatchObject({
      tense: 'imperfect',
      voice: 'active',
      mood: 'indicative',
      person: 'third',
      number: 'singular',
    });
  });

  it('verse references and word indices are correct', () => {
    const v14 = chapters[0]!.verses.find((v) => v.verse === 14)!;
    expect(v14.ref).toBe('John 1:14');
    for (const t of v14.tokens) {
      expect(t.book).toBe('John');
      expect(t.chapter).toBe(1);
      expect(t.verse).toBe(14);
      expect(t.testament).toBe('gnt');
      expect(t.language).toBe('grc');
    }
    expect(v14.tokens.map((t) => t.wordIndex)).toEqual(
      Array.from({ length: v14.tokens.length }, (_, i) => i + 1),
    );
  });

  it('Greek tokens have no fabricated transliteration', () => {
    const withTranslit = chapters[0]!.verses.flatMap((v) => v.tokens).filter((t) => t.transliteration);
    expect(withTranslit).toHaveLength(0);
  });
});
