# ADR-0002 — Generated lexical indexes (word study)

Date: 2026-07-20
Status: Accepted

## Context

The detail panel (ADR-0001) shows a token's immediate parse: lemma, gloss,
Strong's number, part of speech, syntax role, morphology chips. A Logos-like
"word study" adds, for the token's lexeme: how many times it occurs across
the whole Greek NT, the distribution of glosses it takes across those
occurrences, and what it derives from in the Strong's dictionary.

None of this is knowable from a single chapter's XML — it requires scanning
all 27 GNT books. Doing that at runtime, in the browser, on every token tap
is not viable (see Alternatives below), so the data is precomputed at build
time by `scripts/generate/wordstudy.ts` (using the shared harness from the
groundwork PR) and shipped as a static JSON file, fetched lazily like the
existing Strong's lexicon (`src/io/strongs.ts`).

## Decisions

| Axis | Decision |
| --- | --- |
| Where computed | Build time, `scripts/generate/wordstudy.ts` (`npm run generate:wordstudy`); output committed to `public/wordstudy/gnt.json` |
| Corpus | All 27 GNT books (SBLGNT Lowfat), via the pinned `macula-greek` revision |
| Gloss source | RAW `@gloss` attribute only (Berean Interlinear, public domain) — **never** `@english` (Cherith, CC BY 4.0) and never the runtime UI's `gloss ?? english` fallback. The generator's token walk is deliberately separate from `src/io/lowfat.ts`'s `greekXmlToChapters` for exactly this reason: that function's `gloss` field already does the `@english` fallback, which would make the statistics depend on which lexemes happen to be missing a Berean gloss |
| Identity | `normalizeStrong(strong)` (existing helper, keeps homograph letter suffixes: "871a" stays "871a"); tokens with no `@strong` fall back to a separate map keyed by NFC-normalized `@lemma`, so a lemma-fallback entry can never collide with (or be silently merged into) a Strong's-keyed one |
| Gloss normalization | Unicode NFC → trim → collapse internal whitespace → typographic→ASCII punctuation (curly quotes, en/em dash) → strip **trailing** `.,;:` only (never internal/leading). Grouping is case-insensitive; the displayed form is the most-frequent original casing (ties broken by first-seen order in a fixed, sorted book/token walk, so output is deterministic run to run) |
| Missing gloss | Counted in the lexeme's total occurrence count `t`; excluded from the gloss-distribution array `g`. 99.4% of GNT tokens have a non-empty `@gloss` (measured 2026-07-20) |
| Derivation source | `morphgnt/strongs-dictionary-xml` (CC0 waiver) — **not** `openscriptures/strongs`, whose derivation data is the same in substance but the repo is GPL-3.0 and therefore MIT-incompatible for a generated, committed artifact. `d` = ordered list of Greek Strong's numbers the entry's `<strongs_derivation>` references; `dt` = the derivation text flattened to a readable string; `r` = `'root'` when the text matches `/\bprimary\b\|\bprimitive\b/i` and there are no refs, `'derived'` when refs exist, omitted otherwise. A handful of entries (~320 of 5624) additionally reference a *Hebrew*-language `<strongsref>` (transliterated proper nouns, e.g. Ἀαρών); those numbers are kept in `dt`'s flattened text but excluded from `d`, because the UI's derivation link is Greek-only (`openStrongs('G' + num)`) and would otherwise point at the wrong lexicon |
| Output shape | One file, `public/wordstudy/gnt.json`: `{meta, strongs: {<normStrong>: {t, g, d?, dt?, r?}}, lemmas: {...}}`. Measured 2026-07-20: 925 KB raw / **220 KB gzip**, 5,440 Strong's-keyed lexemes (well under the ~400 KB gzip stop-and-flag threshold) |
| Fetch strategy | Lazy runtime `fetch`, in-memory cache, zod boundary validation — same pattern as `src/io/strongs.ts`'s lexicon, **not** a Vite static import (see Alternatives) |
| Service worker | `src/sw.ts`'s `isCorpusRequest` matches `/wordstudy/*.json`; `vite.config.ts`'s `injectManifest.globIgnores` excludes `wordstudy/**` from the precache manifest — the file is runtime-cached (cache-first, offline after first fetch), never precached, exactly like the lexicon and corpus XML. `CORPUS_CACHE` bumped `corpus-v1` → `corpus-v2` in the same commit as the `isCorpusRequest` change (FL-001: a cache-scheme change without a version bump serves stale/wrong entries to already-installed clients) |
| Hebrew scope | **Out of scope this PR.** `wordStudyForToken` returns `null` for any non-`grc` token, and the UI shows a truthful "Word-study data isn't available for this word yet." rather than silently substituting the Cherith gloss (which is not Berean/BSB) or fabricating derivation data. A future PR could add Hebrew occurrence/derivation (STEPBible TBESH, CC BY 4.0) but gloss distribution would still need a public-domain gloss source, which Cherith is not |

## Alternatives considered

- **Runtime corpus parsing (fetch all 27 books and aggregate client-side on
  first word-study open)** — rejected: the GNT Lowfat XML is large (Matthew
  alone is multiple MB; the full corpus is well over 100 MB combined), so
  this would mean either a very slow first use or pre-fetching the whole
  corpus in the background, neither acceptable for a supplementary feature.
  The existing per-book/per-chapter fetch strategy (ADR-0001) is deliberately
  granular for reading; word study needs the opposite (whole-corpus
  aggregate), so it belongs in a separate, precomputed artifact.
- **Vite static import (`import wordstudy from '...gnt.json'`) instead of a
  runtime fetch** — rejected: a bundled import gets a content hash and rides
  into the main JS bundle's precache entry, coupling the SW's precache
  invariant (ADR-0001 invariant 4: never precache corpus-scale data) to this
  file's size and defeating the whole point of runtime-caching it lazily.
  Fetching it exactly like the Strong's lexicon keeps one fetch/cache
  pattern for all "big supplementary JSON" data instead of two.
- **Merging the generated index into the existing bundled Strong's lexicon
  (`public/lexicon/strongs-greek.json`)** — rejected: different provenance
  (bundled lexicon = Open Scriptures edition of Strong's, CC BY-SA;
  generated index's derivation = morphgnt's CC0 edition), different update
  cadence (lexicon is hand-curated/static, word study regenerates from a
  pinned corpus revision), and different consumers (lexicon search vs. one
  detail-panel section). Keeping them separate avoids reconciling two
  editions of "the same" data under time pressure.

## Consequences

- `docs/data-sources-and-licenses.md` gained two new provenance rows (Berean
  `@gloss`, morphgnt CC0 dictionary) and the "Generated data" section is no
  longer speculative.
- Regenerating the index (`npm run generate:wordstudy`) requires network
  access to GitHub raw content and several hundred MB of scratch disk during
  the run (deleted after — `.generate-cache/` is gitignored); it is not part
  of `npm run build` or CI, so a contributor without network access can still
  build and test the app using the already-committed `gnt.json`.
- Any future generator (e.g. the vocabulary-progress index) can reuse the
  same harness and the same "runtime fetch, never precache, bump
  `CORPUS_CACHE`" pattern rather than inventing a third one.
