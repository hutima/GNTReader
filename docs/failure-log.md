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
