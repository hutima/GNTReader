import { z } from 'zod';

/**
 * Vocabulary-progress compute — pure, no fetch/DOM. Reads the generated
 * per-testament index (`public/progress/{gnt,ot}.json`, built by
 * `scripts/generate/progress.ts`) and the store's live known-word sets
 * (`src/state/store.ts` `knownLexemes`/`knownParses`, keyed exactly as
 * `src/ui/vocab.ts` `lexemeKey`/`parseKey`) to compute token coverage.
 *
 * Coverage definition: token coverage over ALL markable tokens (every word
 * token counts once per occurrence — repeated tokens count repeatedly). A
 * token is "known" if its lexeme is known OR its exact parse is known; each
 * `c` row is counted at most once (no double counting by construction, since
 * a row is a single unique (lexeme, parse) pair).
 */

const ProgressMetaSchema = z.object({
  sources: z.array(z.object({ repo: z.string(), rev: z.string(), license: z.string() })),
  keySemantics: z.string(),
});

export const ProgressBookSchema = z.object({
  bookNum: z.number().int().positive(),
  name: z.string(),
  L: z.array(z.string()),
  P: z.array(z.string()),
  /** [lexemeIndex (-1 = none), parseIndex, tokenCount] per unique pair. */
  c: z.array(z.tuple([z.number().int(), z.number().int().nonnegative(), z.number().int().positive()])),
});
export type ProgressBook = z.infer<typeof ProgressBookSchema>;

export const ProgressIndexSchema = z.object({
  meta: ProgressMetaSchema,
  books: z.array(ProgressBookSchema),
});
export type ProgressIndex = z.infer<typeof ProgressIndexSchema>;

/** The unsharded-OT manifest form: `{meta, shards: ["ot-1.json", ...]}`. */
export const ProgressManifestSchema = z.object({
  meta: ProgressMetaSchema,
  shards: z.array(z.string()),
});
export type ProgressManifest = z.infer<typeof ProgressManifestSchema>;

/** One shard file's shape: `{books: [...]}` (no meta — the manifest carries it). */
export const ProgressShardSchema = z.object({
  books: z.array(ProgressBookSchema),
});

export interface Coverage {
  known: number;
  total: number;
}

/** Coverage for one book against the current known-word sets. */
export function bookCoverage(
  book: ProgressBook,
  knownLexemes: ReadonlySet<string>,
  knownParses: ReadonlySet<string>,
): Coverage {
  let known = 0;
  let total = 0;
  for (const [li, pi, count] of book.c) {
    total += count;
    const lexemeKnown = li >= 0 && knownLexemes.has(book.L[li]!);
    const parseKnown = knownParses.has(book.P[pi]!);
    if (lexemeKnown || parseKnown) known += count;
  }
  return { known, total };
}

/** Sum coverage across any set of books (one testament, or gnt+ot combined). */
export function aggregate(coverages: Coverage[]): Coverage {
  return coverages.reduce(
    (acc, c) => ({ known: acc.known + c.known, total: acc.total + c.total }),
    { known: 0, total: 0 },
  );
}

/**
 * "62%" style label — never NaN (0/0 renders as the em dash), and never
 * shows 100% unless every token is known.
 */
export function percentLabel(known: number, total: number): string {
  if (total <= 0) return '—';
  if (known >= total) return '100%';
  return `${Math.min(99, Math.round((known / total) * 100))}%`;
}

/** "4,120 / 6,650 tokens" style label. */
export function fractionLabel(known: number, total: number): string {
  return `${known.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} tokens`;
}
