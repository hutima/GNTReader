/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Hand-written service worker (injectManifest). The page side lives in
// src/pwa/pwa.ts. The update invariants are adopted from a hardened
// production PWA and recorded in ADR-0001 — do not "simplify" them back to
// skipWaiting-on-install (FL-001).

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

// INVARIANT 1: install precaches the app shell and then WAITS — no
// skipWaiting() here. Activating mid-launch froze installed iOS PWAs.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * Runtime cache for on-demand, immutable data: corpus XML (MACULA Greek /
 * Hebrew, bundled fixtures), the Strong's lexicon JSON, and the generated
 * vocabulary-progress + word-study index JSON (`public/progress/`,
 * `public/wordstudy/`). Cache-first — a chapter (or either generated index)
 * fetched once stays readable offline. NEVER precached (a testament is tens
 * of MB). Bump this name in the same commit as any change to the URL scheme
 * or shape of the cached data (docs/config.md).
 */
export const CORPUS_CACHE = 'corpus-v3';

function isCorpusRequest(url: URL): boolean {
  const p = url.pathname;
  return (
    (p.endsWith('.xml') &&
      (p.includes('/fixtures/') ||
        p.includes('/gnt/') ||
        p.includes('/ot/') ||
        p.includes('macula-greek') ||
        p.includes('macula-hebrew'))) ||
    (p.includes('/lexicon/') && p.endsWith('.json')) ||
    (p.includes('/progress/') && p.endsWith('.json')) ||
    (p.includes('/wordstudy/') && p.endsWith('.json'))
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!isCorpusRequest(url)) return;
  event.respondWith(
    caches.open(CORPUS_CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    }),
  );
});

// INVARIANT 3: the SKIP_WAITING message is the ONLY on-demand activation
// path, and the page sends it only from inside a user tap ("Refresh now").
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// INVARIANT 4: activate claims clients but never force-navigates them; the
// page's controllerchange listener owns reloading (user-accepted only).
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
