import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static checks for ADR-0001 invariants 2-4. The dist/ checks run only when a
// build exists (fresh clones run `npm test` before `npm run build`); the
// config/source checks always run.

const root = join(__dirname, '..');
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
const swSource = readFileSync(join(root, 'src', 'sw.ts'), 'utf8');

describe('PWA config invariants', () => {
  it('uses a relative base (GitHub Pages subpath, invariant 2)', () => {
    expect(viteConfig).toMatch(/base:\s*'\.\/'/);
  });

  it('manifest has required fields (invariant 3)', () => {
    for (const field of ['name:', 'short_name:', 'start_url:', 'scope:', 'display:']) {
      expect(viteConfig).toContain(field);
    }
    expect(viteConfig).toContain("start_url: './'");
    expect(viteConfig).toContain("scope: './'");
    expect(viteConfig).toContain("sizes: '192x192'");
    expect(viteConfig).toContain("sizes: '512x512'");
  });

  it('never precaches corpus or lexicon data (invariant 4)', () => {
    expect(viteConfig).toMatch(/globIgnores:.*fixtures.*lexicon|globIgnores:.*lexicon.*fixtures/s);
  });

  it('runtime corpus cache name is versioned (docs/config.md)', () => {
    expect(swSource).toMatch(/CORPUS_CACHE = 'corpus-v\d+'/);
  });

  it('service worker never skipWaiting()s outside the message handler (FL-001)', () => {
    // The only skipWaiting call must be inside the SKIP_WAITING message branch.
    const calls = swSource.match(/self\.skipWaiting\(\)/g) ?? [];
    expect(calls.length).toBe(1);
    const messageHandler = swSource.slice(swSource.indexOf("addEventListener('message'"));
    expect(messageHandler).toContain('self.skipWaiting()');
  });
});

describe('build output invariants (skipped when dist/ absent)', () => {
  const dist = join(root, 'dist');
  const built = existsSync(join(dist, 'index.html'));

  it.skipIf(!built)('index.html has no absolute-root asset URLs (invariant 2)', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
  });

  it.skipIf(!built)('precache manifest contains no corpus XML or lexicon JSON (invariant 4)', () => {
    const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
    // Workbox injects the manifest as a JSON array of {revision,url} entries.
    const m = sw.match(/\[\{"revision":.*?\}\]/s);
    expect(m, 'injected precache manifest not found in dist/sw.js').toBeTruthy();
    const entries = JSON.parse(m![0]) as Array<{ url: string }>;
    expect(entries.length).toBeGreaterThan(0);
    for (const { url } of entries) {
      expect(url).not.toMatch(/^fixtures\//);
      expect(url).not.toMatch(/^lexicon\//);
      expect(url).not.toMatch(/\.xml$/);
      expect(url).not.toMatch(/^\//); // absolute-root would break Pages subpath
    }
  });

  it.skipIf(!built)('icons are present in the build', () => {
    const icons = readdirSync(join(dist, 'icons'));
    expect(icons).toContain('icon-192.png');
    expect(icons).toContain('icon-512.png');
    expect(icons).toContain('icon-512-maskable.png');
  });
});
