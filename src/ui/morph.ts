import type { Morphology, PartOfSpeech, ReadingToken } from '@/domain/schema';
import { tidyGloss } from '@/domain/normalize';

/**
 * Compact morphology chips (abbreviation scheme adopted from the reference
 * app). Unknown values pass through verbatim — the vocabularies are open.
 */

const ABBR: Record<string, string> = {
  // case
  nominative: 'nom',
  genitive: 'gen',
  dative: 'dat',
  accusative: 'acc',
  vocative: 'voc',
  // number
  singular: 'sg',
  dual: 'du',
  plural: 'pl',
  // gender
  masculine: 'm',
  feminine: 'f',
  neuter: 'n',
  common: 'c',
  both: 'c',
  // tense
  present: 'pres',
  imperfect: 'impf',
  future: 'fut',
  aorist: 'aor',
  perfect: 'pf',
  pluperfect: 'plpf',
  // voice
  active: 'act',
  middle: 'mid',
  passive: 'pass',
  middlepassive: 'm/p',
  // mood
  indicative: 'ind',
  subjunctive: 'subj',
  optative: 'opt',
  imperative: 'impv',
  infinitive: 'inf',
  participle: 'ptcp',
  // person
  first: '1',
  second: '2',
  third: '3',
  // degree
  positive: 'pos',
  comparative: 'comp',
  superlative: 'superl',
  // Hebrew state
  absolute: 'abs',
  construct: 'cstr',
  determined: 'det',
};

const POS_LABEL: Record<PartOfSpeech, string> = {
  noun: 'noun',
  propernoun: 'proper noun',
  pronoun: 'pronoun',
  verb: 'verb',
  participle: 'participle',
  infinitive: 'infinitive',
  adjective: 'adjective',
  adverb: 'adverb',
  article: 'article',
  preposition: 'preposition',
  conjunction: 'conjunction',
  particle: 'particle',
  interjection: 'interjection',
  numeral: 'numeral',
  determiner: 'determiner',
  unknown: '—',
};

export function posLabel(pos: PartOfSpeech | undefined): string {
  return pos ? POS_LABEL[pos] : '—';
}

function abbr(v: string): string {
  return ABBR[v] ?? v;
}

/** Ordered compact chips for a token's parsing, e.g. ["impf","act","ind","3","sg"]. */
export function morphChips(token: ReadingToken): string[] {
  const m: Morphology | undefined = token.morphology;
  if (!m) return [];
  const chips: string[] = [];
  const verbal =
    token.pos === 'verb' || token.pos === 'participle' || token.pos === 'infinitive';

  if (verbal) {
    for (const v of [m.tense, m.voice, m.mood]) if (v) chips.push(abbr(v));
    // Hebrew verbal system: binyan + conjugation instead of tense/voice/mood.
    if (token.language === 'hbo') {
      if (m.extra?.stem) chips.push(m.extra.stem);
      if (m.extra?.type) chips.push(m.extra.type);
    }
    if (m.person) chips.push(abbr(m.person));
    if (m.gender) chips.push(abbr(m.gender));
    if (m.number) chips.push(abbr(m.number));
    if (m.case) chips.push(abbr(m.case)); // participles decline
  } else {
    if (m.case) chips.push(abbr(m.case));
    if (m.person) chips.push(abbr(m.person));
    if (m.gender) chips.push(abbr(m.gender));
    if (m.number) chips.push(abbr(m.number));
    if (m.state) chips.push(abbr(m.state));
    if (m.degree) chips.push(abbr(m.degree));
  }
  if (m.extra?.lang === 'A') chips.push('Aramaic');
  return chips;
}

/** Display gloss for a token ("he.created" → "he created"); '—' when absent. */
export function displayGloss(token: ReadingToken): string {
  const g = tidyGloss(token.gloss);
  return g || '—';
}
