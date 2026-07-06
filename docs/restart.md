# restart.md — cold-session continuation

Last updated: 2026-07-06 (Phases 0–6 complete; MVP done, PR open)

## What this project is

A reading-focused GNT/OT PWA (Vite + React + TS, GitHub Pages). NOT a
diagramming app. Reference-only repos (cloned to /workspace in the original
session, NOT dependencies): `hutima/ScriptureDiagrammer`, `hutima/R-learning`
(skills copied to `.claude/skills/`).

Read `docs/adr/0001-day-one-decisions.md` first — architecture, reuse/strip
plan, SW policy. Then this file. Branch: `claude/gnt-ot-reading-pwa-yu5dnq`.

## Current state (all verified-by-execution 2026-07-06)

- MVP complete: reader (continuous scroll, token detail, gloss modes),
  book/chapter picker, morphology search, Strong's search, PWA offline.
- `npm ci && npm test && npm run typecheck && npm run lint && npm run build`
  all green (34 unit/integration tests). Fresh-clone gate passed.
- Real-Chromium smoke passed (9 checks): fixture load, detail panel, gloss
  mode, append/prepend scroll (0.3px drift), search click-through, Strong's
  occurrences, Hebrew RTL, offline reload. Script preserved at
  `docs/verification/browser-smoke.mjs` (run: build, copy a full book XML
  into `dist/gnt/` for hermetic scroll testing, then
  `node docs/verification/browser-smoke.mjs`; needs `npm i --no-save
  playwright-core` and a Chromium at /opt/pw-browsers/chromium or set
  CHROMIUM_PATH).

## Architecture map (src/)

- `domain/schema.ts` — ReadingToken/Verse/Chapter (Zod), flat, no syntax.
- `domain/normalize.ts` — foldAccents/foldGreekSearch/tidyGloss.
- `io/books.ts` — GNT_BOOKS (27, file names + chapter counts), OT_BOOKS
  (39, macula codes incl. `HOS`), `otChapterFile()`.
- `io/lowfat.ts` — Greek+Hebrew Lowfat XML → chapters (reads `<w>` leaves
  only, sorted by fixed-width xml:id, grouped by `ref="JHN 1:1!4"`).
- `io/sources.ts` — source registry, fixture→local→upstream fetch chain,
  in-memory + IndexedDB chapter cache, `prefetchAdjacent`.
- `io/strongs.ts` — compact lexicon loader, `normalizeStrong`, ranked
  `searchStrongs` (cap 40).
- `search/morphology.ts` — structured SearchQuery, `matchToken`,
  chapter-streaming `searchScope` (progress/cancel, cap 300).
- `persistence/db.ts` — idb `gnt-reader` v1, store `chapters`, zod-guarded.
- `state/store.ts` — zustand: position, displayMode, selection, panels;
  localStorage `gr:lastRef`/`gr:displayMode`.
- `ui/` — App shell, Reader (sentinels/compensation — see FL-004),
  VerseView/TokenSpan (`after` separator rules), DetailPanel (side panel /
  bottom sheet), BookPicker, SearchPanel, StrongsPanel, morph chips.
- `sw.ts` + `pwa/pwa.ts` — precache shell, runtime `corpus-v1` cache-first
  for XML+lexicon, wait-then-user-prompted update flow (FL-001).

## Verified commands

- `npm ci` · `npm test` · `npm run typecheck` · `npm run lint` ·
  `npm run build` · `npm run preview` · `npm run icons`
- Fresh-clone gate: `d=$(mktemp -d) && git clone . "$d/fresh" && cd
  "$d/fresh" && npm ci && npm test && npm run build`

## Key data facts (see git history of this file for the full recon notes)

- GNT: `https://raw.githubusercontent.com/Clear-Bible/macula-greek/main/SBLGNT/lowfat/NN-book.xml`
  (per BOOK, John ≈ 12 MB). OT: `…/macula-hebrew/main/WLC/lowfat/NN-Code-CCC-lowfat.xml`
  (per CHAPTER). Fixtures bundled: John 1, Genesis 1 (verbatim slices).
- `<w>` attrs — Greek: lemma/strong/gloss/english/case…mood/morph/after,
  ref="JHN 1:1!4", xml:id="n43001001002". Hebrew: morpheme-segmented
  (shared wordIndex), transliteration, strongnumberx (suffix "0871a"),
  state/stem/type, lang H|A, after (maqqef ־ joins).
- Strong's JSON: `{ "746": {l,t,g,k} }` in `public/lexicon/`.

## Open issues

- None blocking. Possible follow-ups: global (whole-testament) search UI,
  Nestle1904 as second GNT source, offline "download testament" button,
  BSB/ASV parallel text (ONLY those two — ADR-0001), verse-of-the-day.

## Next command

None — MVP shipped. For follow-ups: branch from this branch, keep the
verification suite green, follow `.claude/skills/project-change-control`.

## Known traps

- FL-001 stale SW: bump `corpus-v1` in src/sw.ts in the SAME commit as any
  cached-data shape/URL change; never skipWaiting on install.
- FL-002 Pages subpath: relative paths only; invariant tests enforce.
- FL-003 happy-dom XML: lower-case tag compares; xml:id via two paths.
- FL-004 scroll anchoring: `.reader{overflow-anchor:none}` + manual
  compensation; observers must be recreated per rendered range.
- Hebrew morphemes share verse wordIndex — never dedupe by ref; `after`
  absent = joined, `־` = joined with maqqef.
- GNT loads whole books (12 MB) — first open of a big book online is slow;
  IndexedDB makes reopen instant. Don't "optimize" by fetching per chapter
  upstream (no such files exist).
- Unicode: Hebrew comparisons in tests must NFC-normalize both sides.
