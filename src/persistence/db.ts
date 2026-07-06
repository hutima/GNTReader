import { openDB, type IDBPDatabase } from 'idb';
import { ReadingChapterSchema, type ReadingChapter } from '@/domain/schema';

/**
 * IndexedDB cache of NORMALIZED chapters, so a 12 MB GNT book parses at most
 * once per device rather than once per session (the raw XML additionally
 * sits in the SW runtime cache). Zod-validated on read: an entry written by
 * an older schema simply misses and gets re-fetched — bump DB_VERSION only
 * for keyPath/index changes (docs/config.md).
 *
 * Everything degrades to a no-op where IndexedDB is unavailable (tests,
 * private browsing) — reads miss, writes vanish, the loader still works.
 */

export const DB_NAME = 'gnt-reader';
// v2: the token model gained `syntax` (role + clause); drop stale normalized
// chapters on upgrade so they re-parse (the raw XML is still SW-cached, so this
// is offline-safe). Bump for any keyPath/shape change (docs/config.md).
export const DB_VERSION = 2;
const CHAPTERS = 'chapters';

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion, _newVersion, tx) {
        if (!d.objectStoreNames.contains(CHAPTERS)) {
          d.createObjectStore(CHAPTERS);
        } else if (oldVersion < 2) {
          // Token shape changed (added syntax) — clear so entries re-parse.
          void tx.objectStore(CHAPTERS).clear();
        }
      },
    });
  }
  return dbPromise;
}

export function chapterCacheKey(sourceId: string, bookNum: number, chapter: number): string {
  return `${sourceId}/${bookNum}/${chapter}`;
}

export async function getCachedChapter(key: string): Promise<ReadingChapter | undefined> {
  if (!hasIndexedDb()) return undefined;
  try {
    const raw: unknown = await (await db()).get(CHAPTERS, key);
    if (raw == null) return undefined;
    const parsed = ReadingChapterSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // cache read failure must never break reading
  }
}

export async function putCachedChapters(chapters: ReadingChapter[]): Promise<void> {
  if (!hasIndexedDb() || chapters.length === 0) return;
  try {
    const d = await db();
    const tx = d.transaction(CHAPTERS, 'readwrite');
    await Promise.all([
      ...chapters.map((ch) =>
        tx.store.put(ch, chapterCacheKey(ch.sourceId, ch.bookNum, ch.chapter)),
      ),
      tx.done,
    ]);
  } catch {
    /* quota/private mode — persistence is best-effort */
  }
}

/** Wipe the normalized-chapter cache (dev/debug affordance). */
export async function clearChapterCache(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await (await db()).clear(CHAPTERS);
  } catch {
    /* best-effort */
  }
}
