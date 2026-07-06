# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Entries are written
at PR time, never reconstructed; cite FL-NNN / ADR-NNNN where relevant.

## [Unreleased]

### Added

- Phase 0: reconnaissance of reference repos, ADR-0001 day-one decisions,
  docs of record, R-learning skills library.
- Phase 1: Vite + React + TS PWA shell — GitHub Pages-safe relative base,
  hand-written service worker with hardened update flow (ADR-0001, FL-001),
  manifest + generated icons, Vitest/eslint/typecheck pipeline, PWA
  invariant tests.
- Phase 2: flat reading-domain model (ReadingToken/Verse/Chapter, Zod);
  MACULA Lowfat adapters for SBLGNT Greek and WLC Hebrew (word leaves only);
  bundled John 1 + Genesis 1 fixtures; Strong's compact lexicon; chapter
  loader with fixture→local→upstream fallback.
- Phase 3: reader UI — continuous verse flow with tappable tokens, Hebrew
  RTL, book/chapter picker, token detail panel (desktop side panel / mobile
  bottom sheet), Original/Gloss/Both display modes, iOS HIG styling
  (safe areas, 44pt targets, segmented controls, dark mode).
- Phase 4: morphology search (text/lemma/gloss/Strong's/POS + case, gender,
  number, person, tense, voice, mood; chapter or book scope; streaming with
  progress/cancel; click-through to verse) and Strong's lexicon search
  (number/lemma/transliteration/gloss/KJV, language filter, occurrence
  hand-off).
- Phase 5: continuous scroll with IntersectionObserver sentinels, scroll
  preservation on prepend (FL-004), adjacent-chapter prefetch, IndexedDB
  normalized-chapter cache; real-browser verification suite
  (docs/verification/browser-smoke.mjs).
