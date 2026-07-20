# ADR-0003 — Generated vocabulary-progress index

Date: 2026-07-20
Status: Accepted

(Numbered 0003, not 0002, to avoid colliding with a sibling PR's ADR for a
different generated lexical index landing around the same time. If that PR's
ADR-0002 is present when this branch is rebased onto main, cross-reference it
here; if absent, this ADR stands alone.)

## Context

Readers want to see how much of the Greek NT / Hebrew OT vocabulary they
already "know" (per the existing known-lexeme/known-parse marking, `src/ui/
vocab.ts`, `src/state/store.ts`) — a token-coverage percentage per book, per
testament, and overall. Computing this at runtime would require fetching and
parsing the entire corpus (tens of MB of Lowfat XML) just to count tokens,
which is wasteful when the corpus itself never changes.

## Decision

Precompute a compact per-book vocabulary index at **build time**, using the
generator harness already established for this purpose
(`scripts/generate/harness.ts`, `docs/data-sources-and-licenses.md` §
"Generated data"):

- `scripts/generate/progress.ts` (`npm run generate:progress`) downloads
  every GNT book (27 files, pinned `macula-greek` revision) and every OT
  chapter (39 books × chapters = 929 files, pinned `macula-hebrew` revision),
  converts them with the app's OWN Lowfat converters (`src/io/lowfat.ts`)
  under the harness's DOM shim, and computes `lexemeKey`/`parseKey`
  (`src/ui/vocab.ts` — the single source of key truth, never re-derived) for
  every token.
- Output is deduplicated per book: unique lexeme keys (`L`), unique parse
  keys (`P`), and unique `(lexemeIndex, parseIndex, tokenCount)` rows (`c`).
  This is small — most of a book's bulk is repeated inflections of a modest
  vocabulary — and requires no XML parsing at runtime.
- Committed as `public/progress/gnt.json` and `public/progress/ot.json` (OT
  sharded into balanced `ot-N.json` files behind a manifest if it would
  exceed 400 KB gzipped — see docs/config.md for the actual shard boundary).
- Runtime compute (`src/ui/progress.ts`, pure) turns one book's `{L,P,c}` plus
  the store's live known-word sets into `{known, total}` token counts; the
  UI (`src/ui/ProgressModal.tsx`) never re-derives key semantics — it only
  sums counts against a set membership test.

## Consequences

- Adding a new markable-word feature or changing key semantics requires
  regenerating this index (`npm run generate:progress`) and committing the
  result — the same "pinned revision + commit generated output" pattern as
  any other generator output in this repo.
- The index is corpus-derived (lemmas/parses are copied from MACULA), so it
  carries the same CC BY 4.0 provenance as the source XML even though no
  scripture text is shipped in it (`docs/data-sources-and-licenses.md`).
- Like the Strong's lexicon, the progress index is fetched on demand and
  cached by the service worker's runtime corpus cache — never precached
  (`src/sw.ts` `isCorpusRequest`, `vite.config.ts` `globIgnores`) — and its
  cache-shape bump (`CORPUS_CACHE`) lands in the same commit as this feature
  (FL-001).
