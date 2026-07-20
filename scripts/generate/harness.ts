/**
 * Shared foundation for future data generators (word-study index,
 * vocabulary-progress index, ...). Each generator: downloads pinned upstream
 * files (never un-pinned refs), parses MACULA Lowfat XML with the APP'S OWN
 * `src/io/lowfat.ts` under a DOM shim so runtime and generator produce
 * byte-identical tokens/keys, and reports output sizes.
 *
 * No feature emitters live here (see PR notes) — this file is the harness
 * only: `fetchPinned`, `installDomShim`, `gzipSize`/`sizeReport`.
 */

import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Window } from 'happy-dom';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Repo root, resolved from this file's location (robust to invocation cwd). */
export const REPO_ROOT = join(HERE, '..', '..');

/** Gitignored local cache root — never committed (see `.gitignore`). */
export const CACHE_ROOT = join(REPO_ROOT, '.generate-cache');

export interface PinnedSource {
  /** "owner/repo" on GitHub. */
  repo: string;
  /** Pinned commit SHA — the only ref this harness ever fetches. */
  rev: string;
  license: string;
}

export type Revisions = Record<string, PinnedSource>;

function loadRevisions(): Revisions {
  const raw = readFileSync(join(HERE, 'revisions.json'), 'utf8');
  return JSON.parse(raw) as Revisions;
}

/** `scripts/generate/revisions.json` — pinned upstream repo+rev+license per source. */
export const REVISIONS: Revisions = loadRevisions();

function sourceOf(sourceKey: string): PinnedSource {
  const source = REVISIONS[sourceKey];
  if (!source) {
    throw new Error(`Unknown source key "${sourceKey}" — add it to revisions.json first.`);
  }
  return source;
}

/**
 * Local cache path for a pinned source file: `.generate-cache/<sourceKey>/<rev>/<path>`.
 * Pure — does no I/O, so it's cheap to unit-test.
 */
export function cachePath(sourceKey: string, path: string): string {
  const source = sourceOf(sourceKey);
  return join(CACHE_ROOT, sourceKey, source.rev, path);
}

/**
 * Downloads `https://raw.githubusercontent.com/<repo>/<rev>/<path>` into the
 * gitignored cache if not already present, and returns the local path.
 * Deterministic: the URL is fully pinned by `revisions.json`, so the same
 * (sourceKey, path) always resolves to the same bytes — this function never
 * fetches an un-pinned ref (no branch names, no "latest").
 */
export async function fetchPinned(sourceKey: string, path: string): Promise<string> {
  const source = sourceOf(sourceKey);
  const dest = cachePath(sourceKey, path);
  if (existsSync(dest)) return dest;

  const url = `https://raw.githubusercontent.com/${source.repo}/${source.rev}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchPinned: GET ${url} -> HTTP ${res.status}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
  return dest;
}

/**
 * Installs `DOMParser` (and the constructors `src/io/lowfat.ts` touches) on
 * `globalThis` using happy-dom — the same DOM implementation Vitest gives the
 * app's own tests (`vite.config.ts` `test.environment: 'happy-dom'`) — so a
 * plain Node script parses MACULA Lowfat XML byte-identically to the app.
 * happy-dom's XML quirks (upper-cased tag names, `xml:id` namespace
 * handling) are already worked around inside `lowfat.ts` itself (FL-003);
 * this shim only needs to make the constructors reachable as globals.
 */
export function installDomShim(): void {
  const win = new Window();
  const g = globalThis as unknown as Record<string, unknown>;
  g.DOMParser = win.DOMParser;
  g.Node = win.Node;
  g.Element = win.Element;
  g.Document = win.Document;
}

/** Raw + gzip(-9) byte size of one file on disk. */
export interface SizeRow {
  path: string;
  bytes: number;
  gzipBytes: number;
}

export function gzipSize(path: string): number {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

export function sizeRows(paths: string[]): SizeRow[] {
  return paths.map((path) => ({
    path,
    bytes: statSync(path).size,
    gzipBytes: gzipSize(path),
  }));
}

function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/** A printable raw/gzip size table for the given files. */
export function sizeReport(paths: string[]): string {
  const rows = sizeRows(paths);
  const pathWidth = Math.max('path'.length, ...rows.map((r) => r.path.length));
  const lines = [
    `${'path'.padEnd(pathWidth)}  ${'raw'.padStart(9)}  ${'gzip'.padStart(9)}`,
    ...rows.map(
      (r) => `${r.path.padEnd(pathWidth)}  ${fmtBytes(r.bytes).padStart(9)}  ${fmtBytes(r.gzipBytes).padStart(9)}`,
    ),
  ];
  return lines.join('\n');
}
