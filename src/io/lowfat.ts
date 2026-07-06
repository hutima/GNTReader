import type {
  Morphology,
  PartOfSpeech,
  ReadingChapter,
  ReadingToken,
  Testament,
} from '@/domain/schema';
import type { BookInfo } from './books';

/**
 * MACULA Lowfat XML → reading model. Reads the `<w>` leaves plus a LIGHT slice
 * of the `<wg>` tree: each word's grammatical role and its innermost clause
 * (ADR-0001 amendment, 2026-07-06 — enough for role labels + clause
 * highlighting, still no syntax graph/diagram).
 *
 * Shared mechanics: every `<w>` carries a canonical per-word reference
 * (`ref="JHN 1:1!4"` / `ref="GEN 1:1!2"`) and a fixed-width sortable
 * `xml:id`; surface order is restored by sorting on that id (Lowfat trees
 * can be discontinuous, so document order is not trustworthy). Per-language
 * differences (attribute spellings) live in the two dialect objects below.
 */

export function parseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Lowfat conversion requires a DOMParser (browser or happy-dom).');
  }
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** `xml:id` — read via both paths (happy-dom vs browser namespace handling, FL-003). */
function xmlIdOf(el: Element): string | null {
  return (
    el.getAttribute('xml:id') ||
    el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') ||
    null
  );
}

const REF_RE = /^(\S+)\s+(\d+):(\d+)!(\d+)$/;

interface ParsedRef {
  chapter: number;
  verse: number;
  wordIndex: number;
}

function parseRef(ref: string | null): ParsedRef | null {
  const m = ref?.match(REF_RE);
  if (!m) return null;
  return { chapter: Number(m[2]), verse: Number(m[3]), wordIndex: Number(m[4]) };
}

// --- Greek (SBLGNT Lowfat) ----------------------------------------------------

const GRC_POS: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  conj: 'conjunction',
  det: 'article',
  num: 'numeral',
  prep: 'preposition',
  pron: 'pronoun',
  ptcl: 'particle',
  intj: 'interjection',
};

function grcPosOf(w: Element): PartOfSpeech {
  const cls = w.getAttribute('class') ?? '';
  const mood = w.getAttribute('mood');
  if (cls === 'verb' && mood === 'participle') return 'participle';
  if (cls === 'verb' && mood === 'infinitive') return 'infinitive';
  if (cls === 'noun' && w.getAttribute('type') === 'proper') return 'propernoun';
  return GRC_POS[cls] ?? 'unknown';
}

const GRC_MORPH_KEYS = ['case', 'gender', 'number', 'person', 'tense', 'voice', 'mood', 'degree'] as const;

function grcMorphOf(w: Element): Morphology | undefined {
  const m: Record<string, unknown> = {};
  let any = false;
  for (const k of GRC_MORPH_KEYS) {
    const v = w.getAttribute(k);
    if (v) {
      m[k] = v;
      any = true;
    }
  }
  const extra: Record<string, string> = {};
  const morph = w.getAttribute('morph');
  if (morph) extra.morph = morph;
  if (Object.keys(extra).length) {
    m.extra = extra;
    any = true;
  }
  return any ? (m as Morphology) : undefined;
}

// --- Hebrew (macula-hebrew WLC Lowfat) -----------------------------------------

const HBO_POS: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  cj: 'conjunction',
  conj: 'conjunction',
  art: 'article',
  num: 'numeral',
  prep: 'preposition',
  pron: 'pronoun',
  ptcl: 'particle',
  om: 'particle', // direct-object marker אֵת
  rel: 'particle', // relative אֲשֶׁר
  ij: 'interjection',
  intj: 'interjection',
  suffix: 'pronoun', // pronominal suffix
};

function hboPosOf(w: Element): PartOfSpeech {
  const cls = w.getAttribute('class') ?? '';
  const type = w.getAttribute('type') ?? '';
  if (cls === 'verb' && /participle/i.test(type)) return 'participle';
  if (cls === 'verb' && /infinitive/i.test(type)) return 'infinitive';
  if (cls === 'noun' && type === 'proper') return 'propernoun';
  return HBO_POS[cls] ?? 'unknown';
}

/** Hebrew has no grammatical case; state is first-class in our schema. */
const HBO_MORPH_KEYS = ['gender', 'number', 'person', 'state'] as const;

function hboMorphOf(w: Element): Morphology | undefined {
  const m: Record<string, unknown> = {};
  let any = false;
  for (const k of HBO_MORPH_KEYS) {
    const v = w.getAttribute(k);
    if (v) {
      m[k] = v;
      any = true;
    }
  }
  const extra: Record<string, string> = {};
  for (const [attr, key] of [
    ['stem', 'stem'], // binyan (qal, piel, hiphil…)
    ['type', 'type'], // conjugation (qatal, wayyiqtol…) or noun type
    ['morph', 'morph'],
    ['lang', 'lang'], // "H" Hebrew · "A" Aramaic
  ] as const) {
    const v = w.getAttribute(attr);
    if (v) extra[key] = v;
  }
  if (Object.keys(extra).length) {
    m.extra = extra;
    any = true;
  }
  return any ? (m as Morphology) : undefined;
}

// --- Syntax (light <wg> read) --------------------------------------------------

interface TokenSyntax {
  role?: string;
  clauseId?: string;
  clauseRule?: string;
}

function isWg(el: Element): boolean {
  return el.tagName.toLowerCase() === 'wg';
}

function hasClass(el: Element, name: string): boolean {
  return (el.getAttribute('class') ?? '').split(/\s+/).includes(name);
}

/** A usable role code, or undefined for absent / MACULA "err__…" diagnostics. */
function cleanRole(raw: string | null): string | undefined {
  const t = raw?.trim();
  if (!t || t.startsWith('err')) return undefined;
  return t;
}

function firstWordXmlId(el: Element): string | undefined {
  for (const c of Array.from(el.getElementsByTagName('*'))) {
    if (c.tagName.toLowerCase() === 'w') {
      const id = xmlIdOf(c);
      if (id) return id;
    }
  }
  return undefined;
}

/**
 * Walk a word's ancestors for its role (its own `role`, else the nearest
 * role-bearing `<wg>`) and its innermost clause (`<wg class="cl">`). `clauseIds`
 * caches a stable id per clause element so clause-mates share it.
 */
function syntaxOf(w: Element, clauseIds: Map<Element, string>): TokenSyntax | undefined {
  let role = cleanRole(w.getAttribute('role'));
  let clauseEl: Element | null = null;
  for (let el = w.parentElement; el; el = el.parentElement) {
    if (!isWg(el)) continue;
    if (!role) role = cleanRole(el.getAttribute('role'));
    if (hasClass(el, 'cl')) {
      clauseEl = el;
      break; // innermost clause; the role lives on a phrase within it
    }
  }

  let clauseId: string | undefined;
  let clauseRule: string | undefined;
  if (clauseEl) {
    clauseId = clauseIds.get(clauseEl);
    if (!clauseId) {
      clauseId = xmlIdOf(clauseEl) ?? firstWordXmlId(clauseEl);
      if (clauseId) clauseIds.set(clauseEl, clauseId);
    }
    clauseRule = clauseEl.getAttribute('rule') ?? undefined;
  }

  if (!role && !clauseId && !clauseRule) return undefined;
  return {
    ...(role ? { role } : {}),
    ...(clauseId ? { clauseId } : {}),
    ...(clauseRule ? { clauseRule } : {}),
  };
}

// --- Conversion ----------------------------------------------------------------

interface LowfatReadOptions {
  sourceId: string;
  book: BookInfo;
}

interface WordReader {
  testament: Testament;
  language: 'grc' | 'hbo';
  posOf(w: Element): PartOfSpeech;
  morphOf(w: Element): Morphology | undefined;
  strongOf(w: Element): string | undefined;
  translitOf(w: Element): string | undefined;
}

const greekReader: WordReader = {
  testament: 'gnt',
  language: 'grc',
  posOf: grcPosOf,
  morphOf: grcMorphOf,
  strongOf: (w) => w.getAttribute('strong') ?? undefined,
  // SBLGNT Lowfat carries no transliteration; the UI falls back to the
  // token's Strong's entry (ADR-0001) — never generated here.
  translitOf: () => undefined,
};

const hebrewReader: WordReader = {
  testament: 'ot',
  language: 'hbo',
  posOf: hboPosOf,
  morphOf: hboMorphOf,
  strongOf: (w) => w.getAttribute('strongnumberx') ?? undefined,
  translitOf: (w) => w.getAttribute('transliteration') ?? undefined,
};

function readChapters(xml: string, reader: WordReader, opts: LowfatReadOptions): ReadingChapter[] {
  const dom = parseXml(xml);
  const parseError = dom.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Malformed ${opts.book.name} XML: ${parseError.textContent?.slice(0, 200)}`);
  }

  // All <w> leaves, deduped by xml:id (discontinuous groups can repeat a
  // word), then sorted by the fixed-width id to restore surface order.
  const seen = new Map<string, Element>();
  for (const w of Array.from(dom.getElementsByTagName('*')).filter(
    (el) => el.tagName.toLowerCase() === 'w',
  )) {
    const id = xmlIdOf(w);
    if (id && !seen.has(id)) seen.set(id, w);
  }
  const words = Array.from(seen.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const chapters = new Map<number, Map<number, ReadingToken[]>>();
  const subCounter = new Map<string, number>();
  const clauseIds = new Map<Element, string>();

  for (const [id, w] of words) {
    const ref = w.getAttribute('ref');
    const parsed = parseRef(ref);
    if (!parsed) continue; // an unplaceable word cannot be read in verse flow
    const surface = (w.textContent ?? '').trim();
    if (!surface) continue;

    const subKey = `${parsed.chapter}:${parsed.verse}!${parsed.wordIndex}`;
    const subIndex = subCounter.get(subKey) ?? 0;
    subCounter.set(subKey, subIndex + 1);

    const token: ReadingToken = {
      id,
      sourceId: opts.sourceId,
      testament: reader.testament,
      language: reader.language,
      book: opts.book.name,
      bookNum: opts.book.num,
      chapter: parsed.chapter,
      verse: parsed.verse,
      wordIndex: parsed.wordIndex,
      subIndex,
      surface,
      after: w.getAttribute('after') ?? undefined,
      lemma: w.getAttribute('lemma') ?? undefined,
      transliteration: reader.translitOf(w),
      gloss: w.getAttribute('gloss') ?? w.getAttribute('english') ?? undefined,
      strong: reader.strongOf(w),
      pos: reader.posOf(w),
      morphology: reader.morphOf(w),
      syntax: syntaxOf(w, clauseIds),
      sourceRef: ref ?? undefined,
      provenance: 'given',
    };

    let verses = chapters.get(parsed.chapter);
    if (!verses) {
      verses = new Map();
      chapters.set(parsed.chapter, verses);
    }
    const tokens = verses.get(parsed.verse);
    if (tokens) tokens.push(token);
    else verses.set(parsed.verse, [token]);
  }

  return Array.from(chapters.entries())
    .sort(([a], [b]) => a - b)
    .map(([chapterNum, verses]) => ({
      sourceId: opts.sourceId,
      testament: reader.testament,
      language: reader.language,
      book: opts.book.name,
      bookNum: opts.book.num,
      chapter: chapterNum,
      verses: Array.from(verses.entries())
        .sort(([a], [b]) => a - b)
        .map(([verseNum, tokens]) => ({
          id: `${opts.sourceId}:${opts.book.name} ${chapterNum}:${verseNum}`,
          ref: `${opts.book.name} ${chapterNum}:${verseNum}`,
          testament: reader.testament,
          language: reader.language,
          book: opts.book.name,
          bookNum: opts.book.num,
          chapter: chapterNum,
          verse: verseNum,
          tokens,
        })),
    }));
}

/** SBLGNT Lowfat book XML → chapters (whole book; slice as needed). */
export function greekXmlToChapters(xml: string, opts: LowfatReadOptions): ReadingChapter[] {
  return readChapters(xml, greekReader, opts);
}

/** macula-hebrew WLC Lowfat chapter XML → chapters (normally length 1). */
export function hebrewXmlToChapters(xml: string, opts: LowfatReadOptions): ReadingChapter[] {
  return readChapters(xml, hebrewReader, opts);
}
