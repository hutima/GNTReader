# Orchestration handoff (temporary — delete when all three PRs are complete)

Last updated: 2026-07-20. Lead: Fable orchestration session.
Branch: `claude/ipad-reader-stability-nrdpvf` (currently even with `origin/main`
except this file). A cold session must be able to resume from here in <5 min.

## Mission

Three independently mergeable changes (owner brief, 2026-07-20):

1. **PR 1 `fix/reader-viewport-state`** — iPad panel-reflow jump fix +
   visible-chapter tracking (header/picker/lastRef follow scrolling without
   resetting the chapter window).
2. **PR 2 `feat/lexeme-word-study`** — Logos-like word-study section in the
   detail panel (Berean gloss distribution, Strong's derivation, generated
   lazy index).
3. **PR 3 `feat/vocabulary-progress`** — vocabulary progress analytics modal
   (token-coverage % per book, generated per-testament index).
   A small shared **groundwork PR** (generator harness) precedes 2 and 3.

Do not merge any PR — owner merges. Follow `.claude/skills/project-change-control`.

## Reconnaissance results (all verified 2026-07-20)

### Scout A — iPad jump REPRODUCED (real Chromium, verified-by-execution)

- Jump on 768–834px-wide viewports only: `.detail.side` (320px flex child)
  mounts on token select, reader content width 768→448px, `.verses
  {max-width:44rem}` rewraps, scrollHeight +130–151%. No compensation exists.
- 1024px+ iPads: remaining 704px still fits 44rem column → no jump.
  Phones (<768px, bottom sheet): no width change, no jump.
- Anchor-token drift ~20–23px per open; ~restores on close; not cumulative.
  scrollTop surged +2785px on open at 768×1024 (partly the select-scroll
  effect, Reader.tsx:214).
- Scripts + full report: session scratchpad `scoutA/` (not committed).

### Scout B — state map (verified-by-reading)

- `store.chapter` conflates navigation anchor and visible chapter.
- Consumers meaning "visible": header title (App.tsx:38), BookPicker current
  highlight, `gr:lastRef` persistence. Meaning "navigation": Reader load
  effect (Reader.tsx:86, deps `[testament,bookNum,chapter]` — any write
  resets the 5-chapter window), SearchPanel scope, navigate targets.
- NO existing tests cover IntersectionObserver/scroll-anchor logic.

### Scout C — lexical sources (verified-by-execution/-reading)

- MACULA Greek LICENSE.md: `@gloss` = **Berean Interlinear** (public domain
  since 2023-04-30); `@english` = **Cherith** (CC BY 4.0). Never use
  `english` (or the UI's `gloss ?? english` fallback) for BSB/Berean stats.
- macula-greek pinned SHA: `8423afe47b9e8f24b7772e808af45c7159a6fe7e`.
- openscriptures/strongs has machine-parseable `<strongs_derivation>` +
  `<strongsref>` but is **GPL 3.0** → MIT-incompatible.
- Bundled `public/lexicon/strongs-greek.json` has no derivation data; its
  documented "CC BY-SA" provenance may be a mislabel — **flag to owner**.

### Scout D — progress-index sizing (verified-by-execution on 4 real books)

- vocab.ts keys: lexemeKey `${language}|${lemma}`; parseKey
  `${language}|${lemma??''}|${signature}` (signature prefers `morph` attr).
- GNT extrapolation: nested per-token Shape 1 ≈ 1.44 MB raw / 249 KB gzip;
  ~30k unique (lexeme,parse) pairs GNT-wide. OT (morpheme tokens) ~508k
  tokens / ~147k pairs, assumed ~1.5–2 MB gzip.

### Opus decision doc — data architecture (PRs 2+3), accepted by lead

1. **Derivation source: morphgnt/strongs-dictionary-xml (CC0)** — quoted CC0
   waiver verified. NOT openscriptures (GPL). Hebrew derivation (if pursued):
   STEPBible TBESH (CC BY 4.0, attributed). Label "Derived from" when
   `<strongsref>` refs exist; "Root"/primary only when Strong's text says so.
2. **Lexical identity**: `${language}|${normalizeStrong(strong)}` (existing
   normalizeStrong keeps homograph letter suffixes); lemma fallback
   documented. Gloss normalization (generator, raw `@gloss` only): NFC, trim,
   collapse whitespace, typographic→ASCII punctuation, strip trailing
   `.,;:`; case-fold for grouping but display most-frequent original casing.
   Missing-gloss tokens counted in total, omitted from distribution
   (documented).
3. **Word-study index**: single `public/wordstudy/gnt.json`
   `{strong: {t, g:[[gloss,n]…], d:[refs], dt, r}}`, est ≈250 KB gzip.
   Runtime fetch (like lexicon), NOT Vite import. Add `/wordstudy/` to
   `isCorpusRequest` in sw.ts + globIgnores; **bump CORPUS_CACHE
   corpus-v1→v2 in the same commit** (FL-001).
4. **Progress index**: Shape 3 per book — string tables `L`,`P` + unique-pair
   counts `c:[[li,pi,n]…]`; shards `public/progress/gnt.json` + `ot.json`
   (OT lazy; measure — split per-book if a shard >400 KB gzip). Coverage:
   token known iff pair's lexKey∈knownLexemes OR parseKey∈knownParses; sums
   over `n` → no double counting by construction. Generator imports
   lowfat.ts + vocab.ts under a DOM shim (like vitest/happy-dom) — one key
   implementation.
5. **Groundwork PR first**: `scripts/generate/` fetch→.cache→parse harness,
   `revisions.json` pinned SHAs, size report. No speculative abstraction.
6. **Hebrew scope**: word study — occurrences + Strong's + derivation
   (STEPBible) only; gloss distribution = truthful unavailable state (Cherith
   must not be shown as Berean/BSB). Progress analytics — both testaments.

## In flight

- Opus PR 1 design (reflow compensation architecture + visible-chapter
  state) — running; decision doc pending.

## Next literal command

If resuming cold: read this file, then check whether the PR 1 design doc
arrived (session task output) and whether `fix/reader-viewport-state` work
has started. If nothing else exists, re-run reconnaissance is NOT needed —
all evidence above stands. Start with PR 1 implementation per the design doc.

## Verified commands

`npm ci` / `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`
all green at branch tip (build verified this session; suite last verified on
main per docs/restart.md).

## Failure-log entries relevant

FL-001 (cache bump discipline — PR 2/3 touch sw.ts), FL-004 (scroll
anchoring/observer recreation — PR 1 must not re-fight), FL-002 (relative
URLs — generated data fetched relatively).

## Open questions for the owner

- Existing `public/lexicon/*.json` provenance says "Open Scriptures … CC
  BY-SA" but openscriptures/strongs is GPL 3.0. Pre-existing possible
  mislabel; needs owner decision (separate from these PRs — new derivation
  data uses CC0 morphgnt instead).

## Beware

- Any write to `store.chapter` from scroll observers resets the reader
  window (Reader.tsx:86). Visible chapter must be a separate field.
- happy-dom cannot simulate reflow/gestures — real-browser verification
  mandatory (CLAUDE.md standing rule).
- tsconfig.app.tsbuildinfo is tracked and churns on build — do not commit
  artifact-only changes.
