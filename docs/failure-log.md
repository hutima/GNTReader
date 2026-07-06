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
