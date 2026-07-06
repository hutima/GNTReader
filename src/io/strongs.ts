import { foldAccents } from '@/domain/normalize';
import type { ReadingLanguage } from '@/domain/schema';

/**
 * Strong's lexicon — whole Greek (~5.5k) and Hebrew (~8.7k) dictionaries as
 * compact JSON `{ "746": {l,t,g,k} }` (public/lexicon/, provenance in
 * docs/data-sources-and-licenses.md). Fetched on demand — never precached —
 * and cached here per session plus by the SW runtime cache for offline.
 */

export interface StrongsEntry {
  /** Strong's number, no G/H prefix; may carry a letter suffix ("0871a"). */
  strong: string;
  language: ReadingLanguage;
  lemma: string;
  translit?: string;
  /** Short display gloss (first sense of the Strong's definition). */
  gloss?: string;
  /** KJV renderings — searched, not shown. */
  kjv?: string;
}

interface RawEntry {
  l: string;
  t?: string;
  g?: string;
  k?: string;
}

const cache = new Map<ReadingLanguage, StrongsEntry[]>();
const byNumber = new Map<ReadingLanguage, Map<string, StrongsEntry>>();

function lexiconBase(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}/lexicon/`;
}

/** Load (and session-cache) the whole Greek or Hebrew Strong's lexicon. */
export async function loadStrongs(language: ReadingLanguage): Promise<StrongsEntry[]> {
  const hit = cache.get(language);
  if (hit) return hit;
  const file = language === 'hbo' ? 'strongs-hebrew.json' : 'strongs-greek.json';
  const res = await fetch(`${lexiconBase()}${file}`);
  if (!res.ok) {
    throw new Error(
      `Could not load the ${language === 'hbo' ? 'Hebrew' : 'Greek'} Strong's lexicon.`,
    );
  }
  const raw = (await res.json()) as Record<string, RawEntry>;
  const entries: StrongsEntry[] = Object.entries(raw).map(([strong, v]) => ({
    strong,
    language,
    lemma: v.l,
    translit: v.t,
    gloss: v.g,
    kjv: v.k,
  }));
  cache.set(language, entries);
  byNumber.set(language, new Map(entries.map((e) => [normalizeStrong(e.strong), e])));
  return entries;
}

/** "G746" / "746" / "0871a" → canonical key: strip prefix + leading zeros,
 *  keep any letter suffix ("871a"). */
export function normalizeStrong(strong: string): string {
  const m = strong.trim().replace(/^[GHgh]/, '').match(/^0*(\d+)([a-z]?)$/i);
  return m ? `${m[1]}${m[2]!.toLowerCase()}` : strong.trim();
}

/** Look up one entry by token Strong's number (lexicon must be loaded). */
export function strongsEntry(
  language: ReadingLanguage,
  strong: string,
): StrongsEntry | undefined {
  const index = byNumber.get(language);
  const key = normalizeStrong(strong);
  // Hebrew strongnumberx letter suffixes ("0871a") may not exist in the
  // plain lexicon — fall back to the bare number.
  return index?.get(key) ?? index?.get(key.replace(/[a-z]$/, ''));
}

export const STRONGS_RESULT_CAP = 40;

/**
 * Search by Strong's number, lemma, transliteration, or gloss / KJV term.
 * Pure, synchronous, ranked (reference ranking, ADR-0001): number or exact
 * lemma/translit > prefix > gloss word > KJV rendering > lemma substring.
 * Deterministic tie-break by number. Accent/point-insensitive.
 */
export function searchStrongs(
  entries: StrongsEntry[],
  query: string,
  cap = STRONGS_RESULT_CAP,
): StrongsEntry[] {
  const q = query.trim();
  if (!q) return [];
  const digits = q.replace(/^[gh]/i, '').replace(/^0+/, '');
  const numeric = /^\d+[a-z]?$/i.test(digits);
  const needle = foldAccents(q);
  const scored: { e: StrongsEntry; s: number }[] = [];

  for (const e of entries) {
    let s = 0;
    if (numeric) {
      const n = normalizeStrong(e.strong);
      if (n === digits.toLowerCase()) s = 100;
      else if (n.startsWith(digits.toLowerCase())) s = 60;
    } else {
      const lemma = foldAccents(e.lemma);
      const tr = e.translit ? foldAccents(e.translit) : '';
      const g = e.gloss ? foldAccents(e.gloss) : '';
      const k = e.kjv ? foldAccents(e.kjv) : '';
      if (lemma === needle || tr === needle) s = 100;
      else if (lemma.startsWith(needle) || tr.startsWith(needle)) s = 70;
      else if (g.includes(needle)) s = 50;
      else if (k.includes(needle)) s = 40;
      else if (lemma.includes(needle)) s = 20;
    }
    if (s > 0) scored.push({ e, s });
  }

  scored.sort(
    (a, b) =>
      b.s - a.s ||
      a.e.strong.length - b.e.strong.length ||
      Number(a.e.strong.replace(/\D/g, '')) - Number(b.e.strong.replace(/\D/g, '')) ||
      a.e.strong.localeCompare(b.e.strong),
  );
  return scored.slice(0, cap).map((x) => x.e);
}

/** Test hook. */
export function clearStrongsCache(): void {
  cache.clear();
  byNumber.clear();
}
