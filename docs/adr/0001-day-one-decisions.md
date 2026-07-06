# ADR-0001 — Day-one decisions (GNT Reader)

Date: 2026-07-06
Status: Accepted

## Context

Build a reading-focused Greek New Testament / Hebrew Old Testament PWA. Two
repos serve as references only:

- `hutima/ScriptureDiagrammer` — source-data, lexical, morphology, PWA, and
  persistence ideas are reused; all diagramming is stripped.
- `hutima/R-learning` `.claude/skills` — project discipline (copied into this
  repo at `.claude/skills/`).

Reconnaissance was limited to the targeted file list in the task brief; the
findings are summarized in `docs/restart.md` (reuse/strip plan).

## Decisions

| Axis | Decision |
| --- | --- |
| Domain | Reading-focused GNT/OT PWA (no diagramming, no syntax editing) |
| Runtime | Node >= 20 (`.nvmrc`), browser ES2020+ |
| Stack | Vite 5 + React 18 + TypeScript 5, matching the reference app (proven combination for this exact deployment target) |
| Schemas | Zod for the reading-domain model and source-boundary validation |
| State | Zustand (single small store) |
| Persistence | `idb` (IndexedDB) for normalized chapter cache + reading position; `localStorage` for small UI prefs |
| Tests | Vitest + happy-dom; Testing Library for UI smoke |
| Test verb | `npm test` (Vitest run); `npm run typecheck`; `npm run lint` |
| Deploy target | GitHub Pages subpath — `base: './'` and relative paths everywhere |
| License (this repo) | MIT for app code; data provenance in `docs/data-sources-and-licenses.md` |

## Domain model (NOT ScriptureDiagrammer's KrDocument)

ScriptureDiagrammer's `KrDocument` is a syntax graph (nodes/relations/layout
hints) built for diagramming. It is rejected as this app's domain: too heavy,
and its value is in the syntax tree we do not display.

Instead: a flat reading model — `ReadingToken`, `ReadingVerse`,
`ReadingChapter` (see `src/domain/schema.ts`). Adapters walk the Lowfat XML
`<w>` leaves only, grouped by the per-word verse `ref` attribute, ordered by
fixed-width `xml:id`. The `<wg>` word-group hierarchy is ignored entirely.

What IS reused from ScriptureDiagrammer (by idea, reimplemented):

- Morphology vocabulary (case/gender/number/person/tense/voice/mood + `extra`
  bag for Hebrew `state`/`stem`/`type`) — `src/domain/schema/primitives.ts`.
- Lowfat "dialect" pattern: same walk, per-language leaf readers
  (`gnt-sblgnt.ts` + `lowfat.ts` Greek dialect, `macula-hebrew.ts` Hebrew).
- Book metadata tables (`GNT_BOOKS`, `OT_BOOKS` incl. macula-hebrew file-name
  quirks like Hosea's upper-case `HOS` code).
- Fetch strategy: bundled fixture → local `public/` path → upstream raw
  GitHub, first success wins; SW runtime-caches corpus responses cache-first.
- Strong's compact lexicon JSON (`{num: {l,t,g,k}}`) + ranked search
  (number/lemma/translit exact > prefix > gloss > KJV renderings).
- Accent-folding normalization for search (`foldAccents` idea).
- Hardened SW update flow (see below).

Explicitly rejected: KrDocument, SentenceConverter and the whole syntax graph,
layout/render engines, editor, discourse, sermon prep, contested registry,
guided mode, export (SVG/PDF/PNG), parallel English alignment (21 MB of data;
MVP uses token glosses instead), OpenText and Nestle1904 sources (SBLGNT only
for MVP; Nestle1904 is a possible follow-up).

## Data sources

- GNT: MACULA Greek SBLGNT Lowfat (Clear-Bible/macula-greek, CC BY 4.0;
  SBLGNT text © SBL, CC BY 4.0). One XML file per book; fetched on demand.
- OT: MACULA Hebrew WLC Lowfat (Clear-Bible/macula-hebrew, CC BY 4.0; WLC
  public domain). One XML file per chapter; fetched on demand.
- Strong's: compact JSON derived (via ScriptureDiagrammer) from the Open
  Scriptures machine-readable Strong's (CC BY-SA; Strong's 1890 public
  domain). Bundled (~1.2 MB), fetched on demand at runtime, never precached.
- Fixtures bundled for first-run/offline: John 1 (GNT), Genesis 1 (OT) —
  sliced from the sources above, provenance retained.
- English translation: none in MVP. If ever added: BSB or ASV only
  (copyright). Gloss mode uses token-level `gloss`/`english` attributes from
  MACULA data.
- Transliteration: Hebrew from source `transliteration` attribute; Greek has
  none in SBLGNT Lowfat → fall back to the token's Strong's entry translit;
  display "—" when unavailable. Never fabricate.

## PWA / service-worker policy

`vite-plugin-pwa` in `injectManifest` mode with a hand-written `src/sw.ts`,
registration hand-rolled in `src/pwa/pwa.ts` — the reference app's hardened
flow, adopted wholesale because it encodes a real production failure
(iOS standalone PWAs freezing on skipWaiting-at-install):

- Install precaches app shell and WAITS. **No `skipWaiting()` on install.**
- Update activates only from a user tap ("Refresh now" → `SKIP_WAITING`
  message), or a cold start. `clientsClaim()` on activate, never
  force-navigating.
- The page reloads only after a user-accepted update (`refreshAccepted` gate).
- Tradeoff recorded: users must tap to get updates — an update can be
  deferred indefinitely. Accepted: reader data is immutable corpus XML, so a
  stale shell is safe; freezing a reader mid-use is not.
- Runtime cache `corpus-v1`: cache-first for corpus XML + lexicon JSON only
  (immutable upstream data). Never precache the corpus.
- Cache/version discipline: bump the runtime cache name suffix in the same
  commit whenever the shape/URL scheme of cached data changes.

## Invariants (testable)

1. App shell loads offline after first visit (manual smoke, README checklist).
2. Build output contains no absolute-root (`/...`) asset URLs — GitHub Pages
   subpath must work (`vite.config.ts base: './'`; checked by test).
3. Manifest has name, short_name, icons (192+512), start_url, scope, display —
   checked by test.
4. Corpus XML and lexicon JSON are never in the precache manifest — checked by
   test on build output.
5. Loading a chapter never requires loading a whole testament into memory
   (per-book GNT / per-chapter OT fetch + IndexedDB normalized cache).
6. Fixture conversion stays stable: John 1:1 and Genesis 1:1 golden tests.

## Alternatives considered

- **generateSW (workbox) instead of injectManifest** — rejected: no control
  over the update flow that the reference app's failure log proves matters.
- **Porting KrDocument** — rejected (above).
- **Per-verse fetch granularity** — rejected: upstream ships per-book (GNT) /
  per-chapter (OT) files; anything finer means a proxy/preprocessing step.
- **Bundling whole John (12 MB) like the reference app** — rejected: task
  requires a tiny fixture; we slice John 1 only.
- **Preact/no framework** — rejected: React matches the reference patterns
  and team familiarity; bundle size is dominated by corpus data anyway.

## Consequences

- Any new corpus edition = new adapter dialect + source registry entry; the
  reading model does not change.
- Global (whole-testament) search must stream book-by-book/chapter-by-chapter
  with progress/cancel; MVP scopes search to selected book by default.
- The SBLGNT book XML is large (John ~12 MB); first open of a book on the
  network is slow. Mitigated by IndexedDB normalized-chapter cache and SW
  runtime cache; recorded as a known trap in `docs/restart.md`.
