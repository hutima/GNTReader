---
name: pwa-reference
description: Domain pack for Progressive Web Apps — installable, offline-capable static web apps. Load when creating or editing a manifest, service worker, or cache logic; when users see stale/old content after a deploy; when the app won't install, won't work offline, or breaks on GitHub Pages (404s under /repo-name/); or when testing offline behavior locally. Provides the SW lifecycle runbook, caching strategies, stale-SW trap, and verification checklists.
---

# PWA Reference

The domain pack for this kit's web apps: small, static-hosted, installable,
offline-capable. It exists because PWAs have one trap that reliably eats
sessions — a stale service worker serving old code — and a handful of
conventions that prevent it.

**Terms, defined once:** a **PWA** (Progressive Web App) is a web app that is
installable and works offline. The **manifest** is a JSON file describing the
app to the OS (name, icons, start URL). A **service worker (SW)** is a script
the browser runs separately from the page, intercepting network requests.
**Cache Storage** is the SW-controlled cache. The **app shell** is the minimal
set of files needed to render the app offline. **Scope** is the URL subtree a
SW controls. **Installability** is the browser's judgment that manifest + SW +
HTTPS requirements are met.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Generic debugging procedure | `project-debugging-playbook` (return here for SW specifics) |
| Local server / deploy mechanics beyond base paths | `project-run-and-operate` |
| Evidence policy for the checks below | `project-validation-and-qa` |
| CLI or analytics domain | `cli-reference` / `analytics-reference` |

## The manifest

Minimal valid example (verified 2026-07-03: parses, has the fields Chromium
requires for install):

```json
{
  "name": "Example App",
  "short_name": "Example",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- Save as `manifest.webmanifest`; link it:
  `<link rel="manifest" href="./manifest.webmanifest">`
- **Relative paths everywhere** (`./`) — this is what survives GitHub Pages
  (below).
- 192px and 512px icons are the baseline install requirement (as of
  2026-07-03; installability criteria drift — re-verify pointer in
  Provenance).
- Serving: correct MIME is `application/manifest+json`. `python3 -m
  http.server` already serves `.webmanifest` correctly
  (verified-by-execution); most static hosts do too.
- Validate after every edit: `jq -e '.name and .start_url and (.icons|length>=2)' manifest.webmanifest`

## Service worker lifecycle

Registration (in the page):

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
</script>
```

Lifecycle: **register → install → waiting → activate → fetch**. The subtlety
that causes most confusion: a new SW version installs but sits **waiting**
until every tab from the old version closes — users keep old code through
ordinary reloads.

Minimal SW (verified 2026-07-03: passes `node --check`; browser behavior is a
labeled-unverified-here browser step):

```js
const CACHE_VERSION = 'v1'; // bump on EVERY deploy that changes cached files
const CACHE_NAME = `app-shell-${CACHE_VERSION}`;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // cache-first for the app shell; network for everything else
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
```

**skipWaiting/clientsClaim tradeoff, plainly:** adding
`self.skipWaiting()` in `install` + `clients.claim()` in `activate` makes new
versions take over immediately — good for small apps (this kit's default);
risky when a page's in-flight state assumes the old asset versions (a
mid-session cache swap can mix old HTML with new JS). Choose per project and
record it in ADR-0001.

## Caching strategies

| Strategy | Serve from | Use for | Cost |
|---|---|---|---|
| cache-first | cache, fall back to network | app shell, versioned/immutable assets | staleness if you forget the version bump |
| network-first | network, fall back to cache | data that should be fresh but must survive offline | latency on every load |
| stale-while-revalidate | cache now, refresh cache in background | nice-to-be-fresh assets | one-load-behind freshness |

Iron rule regardless of strategy: **the SW file itself must never be
aggressively cached** — browsers check `sw.js` for byte changes to detect
updates (checked on navigation, capped at 24h as of 2026-07-03). Serve it with
`Cache-Control: no-cache` where you control headers; on hosts you don't
control (GitHub Pages), keep the SW tiny and accept the propagation delay.

## The stale-SW trap (the #1 time sink)

**Symptoms:** deploy done, but users (and you) still see old content; a fix
"doesn't work"; behavior differs between a normal tab and incognito.

**Mechanism:** the old SW serves the old cache; the new SW is installed but
waiting; nothing you do in the *page* changes what the *worker* serves.

**Update-safe deploy runbook:**

1. Bump `CACHE_VERSION` in `sw.js` in the same commit as any change to cached
   files. (An unchanged SW byte-stream = browser sees no update at all.)
2. Deploy, then verify activation in a fresh profile/incognito window:
   DevTools → Application → Service Workers should show the new version
   **activated**, not waiting.
3. To force takeover for all users, ship skipWaiting+claim (tradeoff above).

**While developing locally:** DevTools → Application → Service Workers →
check **Update on reload** (and use **Clear site data** when confused). Before
debugging *anything* in a SW app, rule the SW out first — unregister it or use
incognito — otherwise you may spend the session debugging code the browser
isn't running (`project-debugging-playbook`, trusting-caches trap).

## Local testing

SWs require a **secure context**: HTTPS or `localhost`.
`python3 -m http.server 8000` on localhost qualifies (verified serving; SW
registration itself is a browser step).

Offline smoke checklist (manual, browser):

1. Serve locally; load the app once (primes the cache).
2. DevTools → Application → Service Workers: status **activated**.
3. DevTools → Network → set **Offline**.
4. Reload: the app shell must render. Navigate the core flow.
5. Set back Online; confirm fresh data paths resume.

## GitHub Pages base paths

Project sites serve at `https://<user>.github.io/<repo>/` — the app lives
under a **subpath**, and absolute URLs are the classic breakage:

| Broken | Why | Fix |
|---|---|---|
| `"start_url": "/"` | resolves to the *user root*, not the repo | `"./"` |
| `<link href="/manifest.webmanifest">` | 404 under `/repo/` | `./manifest.webmanifest` |
| `navigator.serviceWorker.register('/sw.js')` | registers at wrong scope or 404s | `./sw.js` (scope defaults to the SW's directory) |
| absolute asset paths in APP_SHELL | precache 404s → install fails | relative paths in the SW list too |

Discipline: **relative paths everywhere**; test under a subpath before
blaming Pages: `mkdir -p /tmp/sub/repo && cp -R . /tmp/sub/repo/ && cd /tmp/sub && python3 -m http.server 8000` then browse
`http://localhost:8000/repo/`.

## Verification

- **Install check** (manual): browser shows an install affordance; installed
  app opens standalone with the right name/icon.
- **Offline smoke**: checklist above — this is the PWA's fresh-clone-gate
  equivalent and belongs in every deploy's evidence
  (`project-validation-and-qa`).
- **Lighthouse** (network-dependent; not run in the authoring sandbox):
  `npx lighthouse http://localhost:8000 --only-categories=pwa --view` —
  treat it as a diagnostic list, not a gate; the offline smoke is the gate.
- Deployed smoke: `smoke-http.sh` against the live URL
  (`project-diagnostics-and-tooling`).

## iOS / Safari caveats (volatile — as of 2026-07-03, verify before relying)

- Install is "Add to Home Screen" from the share sheet; no install prompt API.
- Storage for installed PWAs can be evicted under storage pressure; treat
  Cache Storage as a cache, never as the only copy of user data.
- Push/badging and some APIs lag Chromium.
Re-verify against current WebKit release notes when an iOS user matters.

## Instantiation

When this kit seeds a real PWA:

- Copy the manifest and SW examples in as starting files; set real names,
  colors, icons; keep `CACHE_VERSION` discipline from commit one.
- Record the skipWaiting decision in ADR-0001.
- Add the offline smoke to the project's verification checklist, and the
  stale-SW trap to its failure log as a pre-seeded entry (cite this skill).

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  manifest example (valid JSON, required fields, via `jq -e`), the SW example
  (`node --check` clean), `.webmanifest` served as
  `application/manifest+json` by `python3 -m http.server` (curl transcript).
  **Not verifiable here (no browser)**: actual SW registration/lifecycle,
  install affordance, offline behavior, Lighthouse, iOS behavior — labeled
  browser steps above; the lifecycle/update mechanics are verified-by-reading
  against web-platform behavior as of the authoring date.
- Re-verify manifest example: `jq -e '.name and .start_url' .claude/skills/pwa-reference/SKILL.md` will fail (it's markdown) — instead copy the JSON block to a file and run the jq line under "The manifest".
- Re-verify SW syntax: copy the JS block to `sw.js` and run `node --check sw.js`.
- Volatile facts to re-check on use: installability criteria, SW update-check
  24h cap, iOS caveats — against current MDN/WebKit notes.
