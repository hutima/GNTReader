# Failure log

Format: `## FL-NNN — <verbatim symptom> (YYYY-MM-DD)` · Status · Symptom ·
Root cause · Evidence · Fix/decision · Links. IDs are sequential, never
reused; supersede rather than edit destructively. Every investigation over
~30 minutes gets an entry; every bug fix's regression test cites its FL-NNN.

## FL-001 — Users see stale app after deploy; new features "missing" (2026-07-06)

- Status: settled (class-level seed; adopted from pwa-reference + the
  reference app's production history)
- Symptom: after a deploy, returning users still run the old version;
  sometimes an update mid-use freezes an installed iOS PWA (page renders,
  taps dead, needs force-quit).
- Root cause: service-worker lifecycle. A new SW sits `waiting` until every
  old tab closes; `skipWaiting()` on install fires `controllerchange` while
  the page is mid-launch (iOS freeze); an unchanged cache name serves stale
  precache forever.
- Fix/decision (ADR-0001): hand-written SW; install waits; activation only
  via user-tap SKIP_WAITING or cold start; page reloads only behind the
  `refreshAccepted` gate; bump the runtime cache version in the same commit
  as any change to the shape/URLs of cached data; offline smoke checklist in
  README before any deploy claim.
- Links: ADR-0001 "PWA / service-worker policy"; `.claude/skills/pwa-reference`.

## FL-002 — App 404s/blank under GitHub Pages subpath (2026-07-06)

- Status: settled (class-level seed)
- Symptom: works at localhost root, breaks at `https://user.github.io/repo/`
  (assets 404, SW registration fails).
- Root cause: absolute-root paths (`/assets/…`, `/sw.js`, `/manifest…`) in
  build output, manifest, or SW registration.
- Fix/decision: `base: './'` in vite config; register SW with
  `import.meta.env.BASE_URL`; relative `start_url`/`scope`/icon paths in the
  manifest; invariant test greps build output for absolute-root URLs.
- Links: ADR-0001 invariant 2.

## FL-003 — XML parsing behaves differently in tests than in the browser (2026-07-06)

- Status: settled (class-level seed, from reference-repo experience)
- Symptom: adapter works in browser, tests see empty tags/upper-case names.
- Root cause: happy-dom upper-cases XML tag names and differs on namespace
  handling (`xml:id` needs `getAttribute('xml:id')` OR `getAttributeNS`).
- Fix/decision: compare `el.tagName.toLowerCase()`; read `xml:id` via both
  paths; fixture-conversion tests run under the same DOM the app ships with.
- Links: `docs/restart.md` known traps.

## FL-004 — Continuous scroll jumps ~a chapter's height when prepending (2026-07-06)

- Status: fixed (regression guard: browser smoke step 5, drift < 6px)
- Symptom: scrolling up to load the previous chapter threw the view far
  downward (tracked verse drifted by exactly the prepended chapter's
  height); in a second variant the previous chapter never loaded at all
  after navigating to a chapter.
- Root cause: two independent issues. (1) Chrome's native scroll anchoring
  (`overflow-anchor: auto`, default) already compensates scrollTop when
  content is inserted above the viewport, and the Reader's own layout-effect
  compensation added the same delta again — double compensation. Safari/iOS
  has no scroll anchoring, so the manual compensation must stay. (2) An
  IntersectionObserver never re-reports a sentinel that REMAINS
  intersecting, so after replacing the rendered range (navigation) the
  already-visible top sentinel fired nothing.
- Evidence: Playwright timeline — set scrollTop=200, prepend height 1444 →
  scrollTop 3089 (= 200 + 2×1444) before the fix; 1644 (= 200 + 1444) after;
  full smoke drift 0.3px.
- Fix/decision: `.reader { overflow-anchor: none }` + keep manual
  compensation (deterministic across engines); recreate the observer keyed
  on the rendered range endpoints so a fresh observer reports initial
  intersections.
- Links: src/ui/Reader.tsx, src/styles.css, scratchpad browser-smoke.

## FL-005 — GitHub Pages serves a blank page (2026-07-06)

- Status: fixed (regression guard: build workflow publishes dist/; blank
  page returns only if Pages source is reverted to a branch).
- Symptom: the site at https://hutima.github.io/GNTReader/ rendered blank.
- Root cause: GitHub Pages was in the default "Deploy from a branch" mode
  (workflow `dynamic/pages/pages-build-deployment`), which publishes the raw
  repository files. The repo-root index.html's entry point is
  `./src/main.tsx` (TypeScript/JSX the browser cannot execute) and `dist/`
  is gitignored, so no built app was ever published — the browser loaded
  index.html, failed to run main.tsx, and showed nothing. Pages was never
  running `npm run build`.
- Evidence: `actions_list` showed one workflow, `dynamic/pages/
  pages-build-deployment` (branch mode); repo had no `.github/workflows/`;
  committed `index.html:16` references `./src/main.tsx`; `.gitignore` lists
  `dist/`.
- Fix/decision: add `.github/workflows/deploy.yml` — checkout, `npm ci`,
  `npm run build`, `upload-pages-artifact ./dist`, `deploy-pages`. Requires
  a one-time repo setting: Settings → Pages → Source = "GitHub Actions".
  Build output verified subpath-safe: relative assets, `register("./sw.js")`
  resolves to `/GNTReader/sw.js`, manifest start_url/scope/icons relative.
- Links: .github/workflows/deploy.yml, vite.config.ts (base './'), FL-002.

## FL-006 — iPad panel-reflow jump; header/picker didn't follow scroll (2026-07-20)

- Status: fixed (regression guard: browser smoke steps 10a-10d, drift < 6px
  at 768×1024/834×1112, 5-cycle net drift, rotation, and visible-chapter
  tracking).
- Symptom: on 768-834px-wide viewports (iPad mini/Air/Pro portrait), tapping
  a word to open the desktop side panel flex-shrank the reader column
  (768→448px), rewrapping every line and jumping the read position by
  thousands of px (scrollTop +2785px observed at 768×1024). The header
  title, book/chapter picker, and persisted `gr:lastRef` also only ever
  reflected the last *navigated* chapter, never the chapter the reader had
  actually scrolled to during a long continuous-scroll session.
- Root cause: two independent, previously-conflated concerns. (1) No
  compensation existed for a WIDTH-triggered reflow — only FL-004's
  height/prepend anchor existed, which doesn't fire on a pure width change.
  A `.verse`'s own `getBoundingClientRect()` also under-reports its visual
  extent in "Both" mode (a token can overflow its ancestor's reported
  fragment box), so a naive re-anchor on the verse's own rect was wrong;
  the real extent had to be reconstructed from its tokens' rects. (2)
  `store.chapter` conflated "last navigated" (must gate the Reader's
  chapter-window load effect) and "currently visible" (drives header/
  picker/persisted position) — writing the visible chapter into the same
  field as navigation would reset the loaded chapter window on every
  scroll tick.
- Evidence (real Chromium, `docs/verification/browser-smoke.mjs` steps
  10a-10d, 2026-07-20): 768×1024, 5 open/close cycles — max per-cycle
  drift 0.4px, net drift 0.0px after 5 cycles; selecting a 2nd token while
  the panel stays open — 0.4px drift, chapter window unchanged (3 mounted
  chapters, same ids before/after); 834×1112 one cycle — 0.0px; rotation
  768×1024→1024×768 with the panel open — 0.3px; visible-chapter tracking —
  header switched "John 1"→"John 2" mid-scroll, `gr:lastRef.chapter`
  followed to 2 (after its 500ms debounce), `#ch-1` stayed mounted (no
  range reset), scrollTop never jumped back toward the top.
- Fix/decision: `src/ui/anchor.ts` (new, pure/DOM-free) — width-gated ratio
  anchor (`captureWidthAnchor`/`widthRestoreDelta`/`widthChanged`) plus
  `pickVisibleChapter` (viewport-midpoint containment, greatest-intersection
  fallback). Reader.tsx: a `ResizeObserver` gated strictly on rounded-width
  change (not just any resize) re-seats the midpoint verse's captured ratio
  point via `scrollTop +=`, instant, entirely separate ref from FL-004's
  `anchorRef` (no shared state, no double-fire); an rAF-throttled scroll
  listener recomputes both the width anchor and the visible chapter
  continuously. Store gains `visibleChapter` + `setVisibleChapter` (writes
  ONLY that field; appears in NO data-loading dependency array), a
  500ms-debounced `gr:lastRef` write (`LAST_REF_DEBOUNCE_MS`, docs/config.md)
  with a `pagehide` flush so closing the tab never loses the last moment of
  reading position. `navigate()`/`restorePosition()` set `visibleChapter`
  synchronously and cancel any pending debounced write. Consumers switched
  to `visibleChapter`: header title (App.tsx), book/chapter picker's
  current-book/-chapter highlight (BookPicker.tsx), `backup.ts` lastRef.
  `chapter` (navigation) is untouched: Reader's load effect, anchorKey/
  rangeKey, SearchPanel scope, targetVerse click-through.
- Links: src/ui/anchor.ts, src/ui/Reader.tsx, src/state/store.ts,
  src/ui/BookPicker.tsx, tests/reader-anchor.test.ts,
  tests/visible-chapter.test.tsx, docs/verification/browser-smoke.mjs
  (steps 10a-10d), FL-004 (distinct height/prepend anchor, cross-linked).
