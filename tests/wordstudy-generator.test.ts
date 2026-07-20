import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WordStudySchema } from '@/io/wordstudy';
import {
  buildDerivations,
  buildWordStudy,
  fixSelfClosingXml,
  normalizeGloss,
  walkGreekTokensRaw,
  type RawToken,
} from '../scripts/generate/wordstudy';

/**
 * Unit tests for the word-study generator (scripts/generate/wordstudy.ts).
 * No network: the bundled John 1 fixture plus tiny inline XML snippets only.
 */

const fixturePath = join(__dirname, '..', 'public', 'fixtures', 'gnt', 'john-1.xml');

function wrapWords(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<book lang="el" id="JHN">${inner}</book>`;
}

function w(attrs: Record<string, string>, id: string): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<w ref="JHN 1:1!1" xml:id="${id}" ${attrStr}>x</w>`;
}

describe('walkGreekTokensRaw', () => {
  it('parses the bundled John 1 fixture and reads only raw @gloss (never @english)', () => {
    const xml = readFileSync(fixturePath, 'utf8');
    const tokens = walkGreekTokensRaw(xml);
    expect(tokens.length).toBeGreaterThan(0);
    const first = tokens[0]!;
    expect(first.strong).toBe('1722');
    expect(first.lemma).toBe('ἐν');
    expect(first.gloss).toBe('In [the]'); // fixture's @gloss, not @english="in"
  });

  it('reads the RAW @gloss attribute only — @english is inert even when @gloss differs', () => {
    const xml = wrapWords(w({ strong: '3004', lemma: 'λέγω', gloss: 'Y', english: 'X' }, 'a001'));
    const tokens = walkGreekTokensRaw(xml);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.gloss).toBe('Y');
  });

  it('leaves gloss undefined when @gloss is absent, even if @english is present', () => {
    const xml = wrapWords(w({ strong: '3004', lemma: 'λέγω', english: 'X' }, 'a001'));
    const tokens = walkGreekTokensRaw(xml);
    expect(tokens[0]!.gloss).toBeUndefined();
  });

  it('dedups repeated xml:id (discontinuous groups) and restores order by id', () => {
    const xml = wrapWords(
      w({ strong: '2', lemma: 'b', gloss: 'B' }, 'a002') +
        w({ strong: '1', lemma: 'a', gloss: 'A' }, 'a001') +
        w({ strong: '2', lemma: 'b', gloss: 'B-dup' }, 'a002'),
    );
    const tokens = walkGreekTokensRaw(xml);
    expect(tokens).toHaveLength(2);
    expect(tokens.map((t) => t.lemma)).toEqual(['a', 'b']);
  });
});

describe('normalizeGloss', () => {
  it('NFC-normalizes, trims, and collapses internal whitespace', () => {
    expect(normalizeGloss('  the   word  ')).toBe('the word');
  });

  it('converts curly quotes and en/em dashes to ASCII', () => {
    expect(normalizeGloss('‘word’ “phrase”')).toBe(`'word' "phrase"`);
    expect(normalizeGloss('go–between')).toBe('go-between');
    expect(normalizeGloss('go—between')).toBe('go-between');
  });

  it('strips only TRAILING .,;: — not internal or leading punctuation', () => {
    expect(normalizeGloss('word.')).toBe('word');
    expect(normalizeGloss('word,;:')).toBe('word');
    expect(normalizeGloss('Mr. Word')).toBe('Mr. Word');
    expect(normalizeGloss('word!')).toBe('word!');
  });
});

describe('buildWordStudy — identity + counts', () => {
  it('groups by normalizeStrong(strong), preserving homograph letter suffixes', () => {
    const tokens: RawToken[] = [
      { strong: 'G0746', lemma: 'x', gloss: 'begin' },
      { strong: '0746', lemma: 'x', gloss: 'beginning' },
      { strong: '746a', lemma: 'y', gloss: 'other' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['746']!.t).toBe(2);
    expect(data.strongs['746a']!.t).toBe(1);
  });

  it('groups tokens with no @strong under NFC-normalized lemma in a separate map', () => {
    const tokens: RawToken[] = [{ lemma: 'לוֹגוֹס'.normalize('NFC'), gloss: 'word' }];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(Object.keys(data.strongs)).toHaveLength(0);
    expect(data.lemmas[tokens[0]!.lemma!]!.t).toBe(1);
  });

  it('skips tokens with neither @strong nor @lemma', () => {
    const data = buildWordStudy([{ gloss: 'orphan' }], new Map(), metaFixture());
    expect(Object.keys(data.strongs)).toHaveLength(0);
    expect(Object.keys(data.lemmas)).toHaveLength(0);
  });

  it('counts every token in t, glossed or not, but excludes empty/missing gloss from g', () => {
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'word' },
      { strong: '1', gloss: '' },
      { strong: '1' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['1']!.t).toBe(3);
    expect(data.strongs['1']!.g).toEqual([['word', 1]]);
  });

  it('computes descending count order with a deterministic tie-break (alphabetical)', () => {
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'zeta' },
      { strong: '1', gloss: 'alpha' },
      { strong: '1', gloss: 'alpha' },
      { strong: '1', gloss: 'beta' },
      { strong: '1', gloss: 'beta' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['1']!.g).toEqual([
      ['alpha', 2],
      ['beta', 2],
      ['zeta', 1],
    ]);
  });
});

describe('buildWordStudy — case grouping', () => {
  it('groups glosses case-insensitively; display form is the most frequent original casing', () => {
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'Word' },
      { strong: '1', gloss: 'word' },
      { strong: '1', gloss: 'word' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['1']!.g).toEqual([['word', 3]]);
  });

  it('breaks a casing tie by first-seen order', () => {
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'Word' },
      { strong: '1', gloss: 'word' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['1']!.g).toEqual([['Word', 2]]);
  });

  it('applies normalizeGloss before grouping (trailing punctuation folds together)', () => {
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'word.' },
      { strong: '1', gloss: 'word' },
    ];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(data.strongs['1']!.g).toEqual([['word', 2]]);
  });
});

describe('buildDerivations', () => {
  it('happy-dom self-closing <tag/> corrupts sibling order without fixSelfClosingXml (FL-007)', () => {
    const broken = `<lexicon><entry strongs="1"><greek unicode="a"/><strongs_derivation>from b</strongs_derivation></entry></lexicon>`;
    // Without the fix, <strongs_derivation> ends up nested inside <greek>,
    // so it is no longer a direct child found by the "entry -> derivation" walk.
    const fixed = fixSelfClosingXml(broken);
    expect(fixed).toContain('<greek unicode="a"></greek>');
    const derivations = buildDerivations(fixed);
    expect(derivations.get('1')?.dt).toBe('from b');
  });

  it('marks an entry with no <strongsref> and a "primary"/"primitive" derivation text as root', () => {
    const xml = `<lexicon><entry strongs="1"><strongs_derivation>a primary word</strongs_derivation></entry></lexicon>`;
    const derivations = buildDerivations(fixSelfClosingXml(xml));
    expect(derivations.get('1')).toEqual({ r: 'root', dt: 'a primary word' });
  });

  it('single derivation: extracts the Strong\'s ref number and marks derived', () => {
    const xml =
      '<lexicon><entry strongs="10"><greek unicode="λείμμα"/></entry>' +
      '<entry strongs="2"><strongs_derivation>from <strongsref strongs="10">G10</strongsref></strongs_derivation></entry></lexicon>';
    const derivations = buildDerivations(fixSelfClosingXml(xml));
    const info = derivations.get('2')!;
    expect(info.r).toBe('derived');
    expect(info.d).toEqual(['10']);
    expect(info.dt).toBe('from G10 (λείμμα)');
  });

  it('compound derivation: keeps multiple Strong\'s refs, in order', () => {
    const xml = `<lexicon><entry strongs="3"><strongs_derivation>from <strongsref strongs="1">G1</strongsref> and <strongsref strongs="2">G2</strongsref></strongs_derivation></entry></lexicon>`;
    const derivations = buildDerivations(fixSelfClosingXml(xml));
    expect(derivations.get('3')!.d).toEqual(['1', '2']);
    expect(derivations.get('3')!.r).toBe('derived');
  });

  it('excludes Hebrew-language strongsref numbers from d but keeps them in dt', () => {
    const xml = `<lexicon><entry strongs="4"><strongs_derivation>of Hebrew origin <strongsref strongs="175" language="HEBREW">H175</strongsref></strongs_derivation></entry></lexicon>`;
    const derivations = buildDerivations(fixSelfClosingXml(xml));
    const info = derivations.get('4')!;
    expect(info.d).toBeUndefined();
    expect(info.dt).toContain('H175');
  });

  it('entry with no <strongs_derivation> is omitted from the map', () => {
    const xml = `<lexicon><entry strongs="5"><greek unicode="a"/></entry></lexicon>`;
    const derivations = buildDerivations(fixSelfClosingXml(xml));
    expect(derivations.has('5')).toBe(false);
  });
});

describe('buildWordStudy — derivation wiring (strongs map only)', () => {
  it('attaches d/dt/r to strongs entries but never to lemma entries', () => {
    const derivations = new Map([['1', { d: ['2'], dt: 'from G2', r: 'derived' as const }]]);
    const tokens: RawToken[] = [
      { strong: '1', gloss: 'a' },
      { lemma: 'x', gloss: 'b' },
    ];
    const data = buildWordStudy(tokens, derivations, metaFixture());
    expect(data.strongs['1']).toMatchObject({ d: ['2'], dt: 'from G2', r: 'derived' });
    expect(data.lemmas['x']).not.toHaveProperty('d');
  });
});

describe('WordStudySchema', () => {
  it('validates a well-formed document built by buildWordStudy', () => {
    const tokens: RawToken[] = [{ strong: '1', lemma: 'a', gloss: 'A' }];
    const data = buildWordStudy(tokens, new Map(), metaFixture());
    expect(() => WordStudySchema.parse(data)).not.toThrow();
  });

  it('rejects a document with a malformed gloss tuple', () => {
    const bad = {
      meta: metaFixture(),
      strongs: { '1': { t: 1, g: [['word', -1]] } },
      lemmas: {},
    };
    expect(() => WordStudySchema.parse(bad)).toThrow();
  });
});

function metaFixture() {
  return {
    sources: [{ repo: 'x/y', rev: 'abc', license: 'CC0' }],
    generated: 'test',
    corpus: 'SBLGNT',
    glossSource: 'Berean Interlinear Bible (@gloss)',
  };
}
