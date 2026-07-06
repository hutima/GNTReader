import type { ReadingChapter, Testament } from '@/domain/schema';
import { bookInfo, otChapterFile, type BookInfo } from './books';
import { greekXmlToChapters, hebrewXmlToChapters } from './lowfat';

/**
 * Corpus sources and the chapter loader. Ids are explicit and edition-aware
 * (never a vague "greek") so cached data can never silently cross editions.
 *
 * Fetch fallback chain per file: bundled fixture (John 1 / Genesis 1 only)
 * → local `public/` copy (none committed, but a deployment may add some)
 * → upstream raw GitHub. The service worker runtime-caches every corpus
 * response cache-first (src/sw.ts), so anything opened once works offline.
 */

export type SourceId = 'macula-greek-sblgnt-lowfat' | 'macula-hebrew-wlc-lowfat';

export interface SourceInfo {
  id: SourceId;
  label: string;
  testament: Testament;
  edition: string;
}

export const SOURCES: SourceInfo[] = [
  {
    id: 'macula-greek-sblgnt-lowfat',
    label: 'SBLGNT (MACULA Lowfat)',
    testament: 'gnt',
    edition: 'sblgnt',
  },
  {
    id: 'macula-hebrew-wlc-lowfat',
    label: 'WLC (MACULA Lowfat)',
    testament: 'ot',
    edition: 'wlc',
  },
];

export function sourceFor(testament: Testament): SourceInfo {
  return SOURCES.find((s) => s.testament === testament)!;
}

const GNT_UPSTREAM = 'https://raw.githubusercontent.com/Clear-Bible/macula-greek/main/SBLGNT/lowfat/';
const OT_UPSTREAM = 'https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/main/WLC/lowfat/';

function base(): string {
  const b = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
}

/** Candidate URLs for a GNT BOOK file, most-preferred first. */
export function gntBookUrls(book: BookInfo): string[] {
  const urls: string[] = [];
  if (book.num === 4) urls.push(`${base()}fixtures/gnt/john-1.xml`); // partial: ch 1 only
  urls.push(`${base()}gnt/${book.file}`, `${GNT_UPSTREAM}${book.file}`);
  return urls;
}

/** Candidate URLs for an OT CHAPTER file, most-preferred first. */
export function otChapterUrls(book: BookInfo, chapter: number): string[] {
  const file = otChapterFile(book, chapter);
  const urls: string[] = [];
  if (book.num === 1 && chapter === 1) urls.push(`${base()}fixtures/ot/${file}`);
  urls.push(`${base()}ot/${file}`, `${OT_UPSTREAM}${file}`);
  return urls;
}

async function fetchFirst(urls: string[], what: string): Promise<string> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`Could not load ${what}. Check your connection and try again.`);
}

/**
 * In-memory chapter cache for the session. GNT books parse whole (upstream
 * ships one file per book, John ≈ 12 MB) — cache every chapter of a parsed
 * book so each book parses at most once. The IndexedDB layer
 * (src/persistence/db.ts) fronts this for cross-session reuse.
 */
const memory = new Map<string, ReadingChapter>();
const inflight = new Map<string, Promise<void>>();

export function chapterKey(testament: Testament, bookNum: number, chapter: number): string {
  return `${sourceFor(testament).id}/${bookNum}/${chapter}`;
}

function remember(chapters: ReadingChapter[]): void {
  for (const ch of chapters) {
    memory.set(chapterKey(ch.testament, ch.bookNum, ch.chapter), ch);
  }
}

/**
 * The GNT fixture holds John 1 only. When a fixture-served book later needs
 * another chapter, refetch past the fixture (index 1+ of the URL chain).
 */
async function loadGntBook(book: BookInfo, opts: { skipFixture?: boolean } = {}): Promise<void> {
  const urls = gntBookUrls(book);
  const xml = await fetchFirst(opts.skipFixture ? urls.slice(1) : urls, book.name);
  remember(greekXmlToChapters(xml, { sourceId: 'macula-greek-sblgnt-lowfat', book }));
}

async function loadOtChapterFile(book: BookInfo, chapter: number): Promise<void> {
  const xml = await fetchFirst(otChapterUrls(book, chapter), `${book.name} ${chapter}`);
  remember(hebrewXmlToChapters(xml, { sourceId: 'macula-hebrew-wlc-lowfat', book }));
}

/** Load one chapter (memory-cached; fetches/parses on miss). */
export async function loadChapter(
  testament: Testament,
  bookNum: number,
  chapter: number,
): Promise<ReadingChapter> {
  const key = chapterKey(testament, bookNum, chapter);
  const hit = memory.get(key);
  if (hit) return hit;

  const book = bookInfo(testament, bookNum);
  if (!book) throw new Error(`Unknown ${testament} book ${bookNum}`);
  if (chapter < 1 || chapter > book.chapters) {
    throw new Error(`${book.name} has ${book.chapters} chapters (asked for ${chapter}).`);
  }

  // Deduplicate concurrent loads of the same file (a GNT book load serves
  // many chapter requests at once).
  const loadKey = testament === 'gnt' ? `gnt/${bookNum}` : key;
  const track = (p: Promise<void>): Promise<void> => {
    inflight.set(loadKey, p);
    // Cleanup must not spawn a floating rejected promise — swallow first.
    void p.catch(() => {}).finally(() => {
      if (inflight.get(loadKey) === p) inflight.delete(loadKey);
    });
    return p;
  };
  await (inflight.get(loadKey) ??
    track(testament === 'gnt' ? loadGntBook(book) : loadOtChapterFile(book, chapter)));

  let loaded = memory.get(key);
  if (!loaded && testament === 'gnt') {
    // Book was served by the partial fixture; fetch the real book file.
    await track(loadGntBook(book, { skipFixture: true }));
    loaded = memory.get(key);
  }
  if (!loaded) {
    throw new Error(`${book.name} ${chapter} is not present in the source data.`);
  }
  return loaded;
}

/** Synchronous cache peek (used by search over already-loaded scope). */
export function peekChapter(
  testament: Testament,
  bookNum: number,
  chapter: number,
): ReadingChapter | undefined {
  return memory.get(chapterKey(testament, bookNum, chapter));
}

/** Test hook: clear the in-memory cache. */
export function clearMemoryCache(): void {
  memory.clear();
  inflight.clear();
}
