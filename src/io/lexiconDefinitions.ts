import type { ReadingLanguage } from '@/domain/schema';
import { normalizeStrong } from './strongs';

/**
 * Supplemental lexical definitions for the token detail panel.
 *
 * These sources are deliberately separate from the bundled Strong's lexicon:
 * - Greek: Jeffrey Dodson's Greek Lexicon (public domain / CC0), keyed directly
 *   by Strong's number.
 * - Hebrew: Brown-Driver-Briggs (public-domain text) via the Open Scriptures
 *   Hebrew Lexicon's Strong's -> BDB crosswalk (machine-readable work CC BY 4.0).
 *
 * Upstream files are pinned to immutable commits and fetched only on demand.
 * The service worker runtime-caches them after the first successful request.
 */

export type SupplementalDefinitionSource = 'Dodson' | 'BDB / Open Scriptures';

export interface SupplementalDefinition {
  source: SupplementalDefinitionSource;
  text: string;
}

export interface DodsonEntry {
  brief: string;
  longer: string;
}

export const DODSON_REV = '74f70358d4acfaf2f980bf2feb58ab7115cbbcbc';
export const HEBREW_LEXICON_REV = '21c9add13bc727d3a951361778e97e3ff7afd1ce';

export const DODSON_URL =
  `https://raw.githubusercontent.com/biblicalhumanities/Dodson-Greek-Lexicon/${DODSON_REV}/dodson.csv`;
export const HEBREW_LEXICAL_INDEX_URL =
  `https://raw.githubusercontent.com/openscriptures/HebrewLexicon/${HEBREW_LEXICON_REV}/LexicalIndex.xml`;
export const BDB_URL =
  `https://raw.githubusercontent.com/openscriptures/HebrewLexicon/${HEBREW_LEXICON_REV}/BrownDriverBriggs.xml`;

const BDB_SENSE_CAP = 12;

let dodsonPromise: Promise<Map<string, DodsonEntry>> | undefined;
let bdbPromise: Promise<Map<string, string>> | undefined;

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Parse one quoted TSV row, including doubled-quote escapes. */
function parseTsvRow(row: string): string[] {
  const out: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    if (ch === '"') {
      if (quoted && row[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === '\t' && !quoted) {
      out.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

/** Dodson's five-column TSV -> Strong's-number definition index. */
export function parseDodsonTsv(text: string): Map<string, DodsonEntry> {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const out = new Map<string, DodsonEntry>();

  for (const row of rows.slice(1)) {
    if (!row.trim()) continue;
    const cols = parseTsvRow(row);
    if (cols.length < 5) continue;
    const strong = normalizeStrong(cols[0] ?? '');
    if (!/^\d+[a-z]?$/i.test(strong)) continue;
    const brief = normalizeSpace(cols[3] ?? '');
    const longer = normalizeSpace(cols[4] ?? '');
    if (brief || longer) out.set(strong, { brief, longer });
  }
  return out;
}

function parseXml(text: string, label: string): XMLDocument {
  const dom = new DOMParser().parseFromString(text, 'application/xml');
  const error = Array.from(dom.getElementsByTagName('*')).find(
    (el) => el.localName.toLowerCase() === 'parsererror',
  );
  if (error) throw new Error(`Malformed ${label} XML.`);
  return dom;
}

function descendants(el: ParentNode, localName: string): Element[] {
  return Array.from((el as Document | Element).getElementsByTagName('*')).filter(
    (node) => node.localName.toLowerCase() === localName,
  );
}

/**
 * Build a Strong's-number -> concise BDB senses index.
 *
 * LexicalIndex.xml supplies the reliable Strong's -> BDB entry id mapping.
 * BrownDriverBriggs.xml supplies the public-domain definition text. We retain
 * the distinct <def> labels (rather than scripture citations / bibliography)
 * so the detail panel gets a useful compact lexical summary.
 */
export function parseBdbDefinitions(
  lexicalIndexXml: string,
  bdbXml: string,
): Map<string, string> {
  const lexical = parseXml(lexicalIndexXml, 'Hebrew lexical-index');
  const bdb = parseXml(bdbXml, 'BDB');

  const strongToBdb = new Map<string, string>();
  const augmentedByBase = new Map<string, Array<[string, string]>>();

  for (const entry of descendants(lexical, 'entry')) {
    for (const xref of descendants(entry, 'xref')) {
      const rawStrong = xref.getAttribute('strong');
      const bdbId = xref.getAttribute('bdb');
      if (!rawStrong || !bdbId) continue;
      const base = normalizeStrong(rawStrong);
      const aug = (xref.getAttribute('aug') ?? '').toLowerCase();
      const key = `${base}${aug}`;
      strongToBdb.set(key, bdbId);
      if (aug) {
        const group = augmentedByBase.get(base) ?? [];
        group.push([key, bdbId]);
        augmentedByBase.set(base, group);
      }
    }
  }

  // If an upstream entry is augmented but has only one possible reading,
  // permit a bare-number token to resolve to it. Ambiguous homographs remain
  // exact-suffix-only rather than silently showing the wrong BDB article.
  for (const [base, candidates] of augmentedByBase) {
    if (!strongToBdb.has(base) && candidates.length === 1) {
      strongToBdb.set(base, candidates[0]![1]);
    }
  }

  const definitionByBdb = new Map<string, string>();
  for (const entry of descendants(bdb, 'entry')) {
    const id = entry.getAttribute('id');
    if (!id) continue;
    const seen = new Set<string>();
    const definitions: string[] = [];
    for (const def of descendants(entry, 'def')) {
      const text = normalizeSpace(def.textContent ?? '');
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      definitions.push(text);
    }
    if (!definitions.length) continue;
    const shown = definitions.slice(0, BDB_SENSE_CAP);
    definitionByBdb.set(
      id,
      `${shown.join('; ')}${definitions.length > BDB_SENSE_CAP ? '; …' : ''}`,
    );
  }

  const out = new Map<string, string>();
  for (const [strong, bdbId] of strongToBdb) {
    const definition = definitionByBdb.get(bdbId);
    if (definition) out.set(strong, definition);
  }
  return out;
}

async function fetchText(url: string, label: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${label}.`);
  return res.text();
}

async function loadDodson(): Promise<Map<string, DodsonEntry>> {
  dodsonPromise ??= fetchText(DODSON_URL, 'Dodson Greek Lexicon').then(parseDodsonTsv);
  return dodsonPromise;
}

async function loadBdb(): Promise<Map<string, string>> {
  bdbPromise ??= Promise.all([
    fetchText(HEBREW_LEXICAL_INDEX_URL, 'Hebrew lexical index'),
    fetchText(BDB_URL, 'Brown-Driver-Briggs lexicon'),
  ]).then(([lexical, bdb]) => parseBdbDefinitions(lexical, bdb));
  return bdbPromise;
}

/** Look up the richer supplemental definition for one token Strong's number. */
export async function loadSupplementalDefinition(
  language: ReadingLanguage,
  strong: string,
): Promise<SupplementalDefinition | null> {
  const key = normalizeStrong(strong);
  if (language === 'grc') {
    const entry = (await loadDodson()).get(key);
    if (!entry) return null;
    return { source: 'Dodson', text: entry.longer || entry.brief };
  }

  const definition = (await loadBdb()).get(key);
  return definition ? { source: 'BDB / Open Scriptures', text: definition } : null;
}

/** Test hook. */
export function clearSupplementalDefinitionCache(): void {
  dodsonPromise = undefined;
  bdbPromise = undefined;
}
