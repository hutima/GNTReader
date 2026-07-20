import {
  ProgressIndexSchema,
  ProgressManifestSchema,
  ProgressShardSchema,
  type ProgressBook,
} from '@/ui/progress';

/**
 * Fetch + validate the generated vocabulary-progress index
 * (`public/progress/{gnt,ot}.json`, built by `scripts/generate/progress.ts`).
 * Mirrors `src/io/strongs.ts`'s pattern: relative fetch off `BASE_URL` (never
 * absolute-root — FL-002), session in-memory cache, zod validation. Never
 * precached by the service worker (`src/sw.ts` `isCorpusRequest`), but IS
 * runtime-cached there like other corpus data.
 *
 * `gnt.json`/`ot.json` are normally the full `{meta, books}` index. If OT
 * grew past the 400 KB gzip budget the generator instead writes `ot.json` as
 * a small manifest — `{meta, shards: ["ot-1.json", ...]}` — so this loader
 * always starts from one fetch regardless of sharding, then fetches and
 * merges the shard files.
 */

export type Testament = 'gnt' | 'ot';

const cache = new Map<Testament, Promise<ProgressBook[]>>();

function progressBase(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}/progress/`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load vocabulary progress data (${url}): HTTP ${res.status}`);
  }
  return res.json();
}

/** Load (and session-cache) one testament's per-book progress index. */
export async function loadProgressBooks(testament: Testament): Promise<ProgressBook[]> {
  const hit = cache.get(testament);
  if (hit) return hit;

  const promise = (async () => {
    const base = progressBase();
    const json = await fetchJson(`${base}${testament}.json`);

    const manifest = ProgressManifestSchema.safeParse(json);
    if (manifest.success) {
      const shardBooks = await Promise.all(
        manifest.data.shards.map(async (name) => {
          const shardJson = await fetchJson(`${base}${name}`);
          return ProgressShardSchema.parse(shardJson).books;
        }),
      );
      return shardBooks.flat();
    }

    return ProgressIndexSchema.parse(json).books;
  })();

  // Don't let a failed fetch permanently poison the cache — a later retry
  // (e.g. reopening the modal after the network recovers) should try again.
  promise.catch(() => cache.delete(testament));

  cache.set(testament, promise);
  return promise;
}

/** Clear the in-memory cache (tests only). */
export function resetProgressCache(): void {
  cache.clear();
}
