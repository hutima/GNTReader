# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Entries are written
at PR time, never reconstructed; cite FL-NNN / ADR-NNNN where relevant.

## [Unreleased]

### Changed

- Strong's display glosses modernized (105 entries across the Greek and Hebrew
  lexicons, `public/lexicon/`). Archaic pronouns and forms are gone (`thou/thee/
  thine` → `you/yours`, `ye are` → `you are`, `verily` → `truly`, `lo!` →
  `look!`, `hither/thither` → `here/there`, `betwixt` → `between`, `whilst` →
  `while`); Canadian spelling throughout (`colour`, `honour`, `labour`,
  `splendour`, `vigour`, `armour`, `neighbour`, `centre`, `plough`, …); and
  glosses whose meaning had drifted or were truncation artifacts were corrected
  (`the quick` → `living flesh`, `vile conversation` → `obscene speech`,
  `imagine` → `to suppose`, `holy Writ` → `Scripture`, and several `"hence"`
  stubs restored to their real sense, e.g. H505 → `a thousand`, H502 →
  `to learn`). Only the displayed `g` field changed; the searched KJV-rendering
  (`k`) field is untouched so English-term search still resolves KJV vocabulary.
  Verified: only `g` fields differ, no entries lost, JSON round-trips
  byte-stably, and the built app serves the new glosses with no console errors.

### Fixed

- Word-detail sheet (mobile) is capped at ~45% of the screen and scrolls
  internally, with a non-dimming, click-through backdrop so the reader (and its
  clause highlight) stays visible and scrollable underneath — a scroll no longer
  closes it. The grabber is pinned to the top of every sheet (sticky) so it
  never scrolls out of reach, and sheet scrolling no longer chains into the
  reader behind a blocking panel (`overscroll-behavior: contain`). Verified with
  real-browser drags and scrolls.

- Bottom-sheet swipe-to-dismiss actually works now (Settings and the others):
  `useSheetDrag` binds its move/up listeners synchronously on the captured
  grabber instead of via an effect that raced the drag, and the grabber is now
  a tall full-width hit target (small visual pill) so it is easy to grab. A tiny
  twitch no longer counts as a dismiss flick. Verified with a real-browser drag;
  regression unit test added (`tests/sheet-drag.test.tsx`). Added a CLAUDE.md
  rule: interactive gestures must be verified in a real browser, not just unit
  tests.

### Added

- Vocabulary refinements: long-press a word (Gloss/Both mode) to toggle it
  known; a Settings option chooses whether long-press marks the whole lexeme or
  just this parse (long-press in Original mode still reveals the gloss). A
  "Known words" modal lists marked lexemes and forms alphabetically, each
  removable with an ✕. In Both mode a known word keeps its row slot (surface
  aligned with the glossed words) and a row only collapses when every word in
  it is known.

- Vocabulary mode (Settings toggle, default off): in Both mode, mark a word
  known from its detail panel — either the whole lexeme or just this parse —
  and its gloss drops away, so only the words still being learned keep a gloss.
  Known words persist (localStorage) with a Reset button in Settings.

- Syntax view (ADR-0001 amendment): the adapter now reads a light slice of the
  MACULA `<wg>` tree — each token's grammatical role and its innermost clause.
  Tapping a word tints its clause by role (subject/verb/object/complement/
  adverbial), colour-matched to a new Syntax section in the detail panel that
  shows the role + clause structure. Default-on Settings toggle. `DB_VERSION`
  bumped to 2 (cached chapters re-parse).
- Swipe-down-on-handle now dismisses every bottom sheet (Strong's, search,
  word detail — previously only the book picker).

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
- Branding: new app logo — an open book (Α … Ω) on a phone in brand crimson
  (#b90e31); vector `favicon.svg` is the single source, PNG icons rasterised
  from it (`scripts/generate-icons.mjs`, Chromium). Theme colour set to
  #b90e31 (manifest + meta + accent).
- Typography: self-hosted webfonts (offline-first, no CDN) — Gentium Book
  Plus for scripture (Greek), Source Sans 3 (Source Sans Pro) for UI;
  vendored woff2 subsets in `src/fonts/` under SIL OFL 1.1.
- Settings sheet (header ⚙️, replacing the Strong's book icon): light/dark/
  system theme override (`data-theme`), reading font-size control (CSS var
  `--reading-scale`, iOS-safe — not viewport zoom), one-tap download of the
  whole GNT+OT corpus for offline use, app update/cache utilities, and the
  Strong's lexicon entry point.
- Mandatory PWA update modal (`UpdateModal`) — a click-through "Update
  available" overlay wired to the hardened SW update flow.
- Reader: tap-hold a word to reveal its English gloss; windowed continuous
  scroll (keeps the visible chapter ±2, drops far chapters via scroll-anchor
  compensation).
- Search: whole-testament scope (all NT / all OT), streaming book-by-book.
- Detail panel: part-of-speech and morph-code values carry a dotted
  underline, help cursor, and explanatory tooltip.
- Book picker: swipe-down-on-grabber to dismiss the sheet (`useSheetDrag`);
  testament toggle reordered to Hebrew OT then Greek NT.
