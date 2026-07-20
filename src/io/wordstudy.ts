import { z } from 'zod';
import type { ReadingToken } from '@/domain/schema';
import { normalizeStrong } from './strongs';

/**
 * Word-study index (generated, `scripts/generate/wordstudy.ts`) — gloss
 * distribution + derivation for every Greek lexeme in the SBLGNT, keyed by
 * Strong's number (or, for the handful of tokens with no `@strong`, by
 * normalized lemma). Lazy-fetched like `src/io/strongs.ts`'s lexicon: a
 * relative fetch, an in-memory cache, and a zod boundary check on the raw
 * JSON (never precached — `vite.config.ts` globIgnores, `src/sw.ts`
 * CORPUS_CACHE runtime-caches it instead).
 *
 * Hebrew tokens have no data this PR (documented limitation) — callers
 * should treat `wordStudyForToken` returning `null` for a Hebrew token as
 * "not available yet", not an error.
 */

const GlossTupleSchema = z.tuple([z.string(), z.number().int().nonnegative()]);

export const WordStudyEntrySchema = z.object({
  /** Total occurrences of this lexeme in the SBLGNT, glossed or not. */
  t: z.number().int().nonnegative(),
  /** [display gloss, count] pairs, descending by count, deterministic order. */
  g: z.array(GlossTupleSchema),
  /** Strong's numbers this lexeme derives from (order preserved; Greek only —
   *  see scripts/generate/wordstudy.ts for the Hebrew-derivation caveat). */
  d: z.array(z.string()).optional(),
  /** Flattened derivation text from the Strong's dictionary entry. */
  dt: z.string().optional(),
  /** 'root' when the dictionary marks it primary/primitive with no `d`;
   *  'derived' when `d` is non-empty; omitted when neither is knowable. */
  r: z.enum(['root', 'derived']).optional(),
});
export type WordStudyEntry = z.infer<typeof WordStudyEntrySchema>;

export const WordStudySchema = z.object({
  meta: z.object({
    sources: z.array(
      z.object({ repo: z.string(), rev: z.string(), license: z.string() }),
    ),
    generated: z.string(),
    corpus: z.string(),
    glossSource: z.string(),
  }),
  /** Keyed by `normalizeStrong(strong)`. */
  strongs: z.record(z.string(), WordStudyEntrySchema),
  /** Keyed by NFC-normalized lemma, for the rare token with no `@strong`. */
  lemmas: z.record(z.string(), WordStudyEntrySchema),
});
export type WordStudyData = z.infer<typeof WordStudySchema>;

let cache: WordStudyData | null | undefined; // undefined = not yet attempted

function wordStudyBase(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}/wordstudy/`;
}

/**
 * Load (and process-cache) the word-study index. Resolves to `null` — never
 * throws — on any fetch/parse/validation failure (offline, missing file,
 * corrupt JSON): callers render the "not available" state rather than an
 * error for what is optional, supplementary data.
 */
export async function loadWordStudy(): Promise<WordStudyData | null> {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch(`${wordStudyBase()}gnt.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: unknown = await res.json();
    cache = WordStudySchema.parse(raw);
  } catch {
    cache = null;
  }
  return cache;
}

/**
 * Look up the word-study entry for a reading token. Hebrew tokens (no data
 * this PR) and tokens with neither a Strong's number nor a lemma always
 * resolve to `null`.
 */
export function wordStudyForToken(
  data: WordStudyData,
  token: Pick<ReadingToken, 'language' | 'strong' | 'lemma'>,
): WordStudyEntry | null {
  if (token.language !== 'grc') return null;
  if (token.strong) {
    return data.strongs[normalizeStrong(token.strong)] ?? null;
  }
  if (token.lemma) {
    return data.lemmas[token.lemma.normalize('NFC')] ?? null;
  }
  return null;
}

/** Test hook. */
export function clearWordStudyCache(): void {
  cache = undefined;
}
