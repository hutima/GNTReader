/**
 * Vocabulary-progress index generator (`npm run generate:progress`).
 *
 * Downloads every GNT book (27 files, macula-greek) and every OT chapter (39
 * books × chapters = 929 files, macula-hebrew) at the pinned revisions in
 * `revisions.json`, converts them with the app's OWN Lowfat converters
 * (`src/io/lowfat.ts`) under the harness's DOM shim, and folds every token
 * into a deduplicated per-book index keyed by `src/ui/vocab.ts`'s
 * `lexemeKey`/`parseKey` — never re-derived here. Output feeds
 * `src/ui/progress.ts` (`bookCoverage`/`aggregate`) at runtime via
 * `src/io/progress.ts`.
 *
 * Output shape (per testament file):
 *   { meta: { sources: [{repo,rev,license}], keySemantics }, books: [
 *     { bookNum, name, L: [lexemeKey...], P: [parseKey...],
 *       c: [[li, pi, count], ...] } // li=-1 when the token has no lexeme
 *   ] }
 * `L`/`P` are deduplicated per book and sorted; `c` rows are the unique
 * (li, pi) pairs with their token count, sorted by (li, pi) — deterministic
 * across runs (see tests/progress-generator.test.ts).
 *
 * OT is written as `public/progress/ot.json` when it fits under 400 KB
 * gzipped; otherwise as a small manifest at that same path (`{meta, shards:
 * [...]}`) pointing at balanced `ot-N.json` shard files (`{books: [...]}`),
 * so the runtime loader (`src/io/progress.ts`) always starts from one fetch
 * regardless of sharding.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GNT_BOOKS, OT_BOOKS, otChapterFile } from '../../src/io/books';
import { greekXmlToChapters, hebrewXmlToChapters } from '../../src/io/lowfat';
import type { ReadingChapter, ReadingToken } from '../../src/domain/schema';
import { lexemeKey, parseKey } from '../../src/ui/vocab';
import {
  CACHE_ROOT,
  REPO_ROOT,
  REVISIONS,
  closeDomShim,
  fetchPinned,
  gzipSize,
  installFreshDomShim,
  maybeGc,
  sizeReport,
} from './harness';

const OT_GZIP_BUDGET_BYTES = 400 * 1024;
const OT_CHAPTER_CONCURRENCY = 8;

export interface ProgressBookBlock {
  bookNum: number;
  name: string;
  L: string[];
  P: string[];
  c: [number, number, number][];
}

export interface ProgressMeta {
  sources: { repo: string; rev: string; license: string }[];
  keySemantics: string;
}

export interface ProgressIndexFile {
  meta: ProgressMeta;
  books: ProgressBookBlock[];
}

/**
 * Pure fold: every token of one book → a deduplicated, deterministic block.
 * Exercised directly (no network) by tests/progress-generator.test.ts.
 */
export function buildBookBlock(bookNum: number, name: string, tokens: ReadingToken[]): ProgressBookBlock {
  const lIndex = new Map<string, number>();
  const pIndex = new Map<string, number>();
  const counts = new Map<string, number>(); // `${li}|${pi}` -> count, li may be -1

  for (const token of tokens) {
    const pk = parseKey(token);
    let pi = pIndex.get(pk);
    if (pi === undefined) {
      pi = pIndex.size;
      pIndex.set(pk, pi);
    }

    const lk = lexemeKey(token);
    let li = -1;
    if (lk !== null) {
      const existing = lIndex.get(lk);
      li = existing ?? lIndex.size;
      if (existing === undefined) lIndex.set(lk, li);
    }

    const rowKey = `${li}|${pi}`;
    counts.set(rowKey, (counts.get(rowKey) ?? 0) + 1);
  }

  // Sort L/P alphabetically and remap every index so output is deterministic
  // regardless of first-seen order.
  const sortedL = [...lIndex.keys()].sort();
  const lRemap = new Map(sortedL.map((k, i) => [lIndex.get(k)!, i]));
  const sortedP = [...pIndex.keys()].sort();
  const pRemap = new Map(sortedP.map((k, i) => [pIndex.get(k)!, i]));

  const rows: [number, number, number][] = [];
  for (const [rowKey, count] of counts) {
    const sep = rowKey.indexOf('|');
    const oldLi = Number(rowKey.slice(0, sep));
    const oldPi = Number(rowKey.slice(sep + 1));
    const li = oldLi === -1 ? -1 : lRemap.get(oldLi)!;
    const pi = pRemap.get(oldPi)!;
    rows.push([li, pi, count]);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  return { bookNum, name, L: sortedL, P: sortedP, c: rows };
}

function tokensOfChapters(chapters: ReadingChapter[]): ReadingToken[] {
  const out: ReadingToken[] = [];
  for (const chapter of chapters) {
    for (const verse of chapter.verses) out.push(...verse.tokens);
  }
  return out;
}

/** Simple fixed-size worker pool over a flat item list (mirrors src/io/download.ts). */
async function runPool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) return;
      await work(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function buildGntBooks(): Promise<ProgressBookBlock[]> {
  const blocks: ProgressBookBlock[] = [];
  for (const book of GNT_BOOKS) {
    const path = await fetchPinned('macula-greek', `SBLGNT/lowfat/${book.file}`);
    const xml = readFileSync(path, 'utf8');
    // Fresh happy-dom Window per book, closed right after parsing — a single
    // shared Window across all 27 books leaks memory without bound (see
    // installFreshDomShim's doc comment; this OOM'd an 8.6 GB heap partway
    // through the corpus before the fix).
    const win = installFreshDomShim();
    const chapters = greekXmlToChapters(xml, { sourceId: 'macula-greek-sblgnt-lowfat', book });
    blocks.push(buildBookBlock(book.num, book.name, tokensOfChapters(chapters)));
    await closeDomShim(win);
    maybeGc();
    console.log(`  GNT ${book.name} — ok`);
  }
  return blocks;
}

async function buildOtBooks(): Promise<ProgressBookBlock[]> {
  const blocks: ProgressBookBlock[] = [];
  for (const book of OT_BOOKS) {
    const tokens: ReadingToken[] = [];
    const chapterNums = Array.from({ length: book.chapters }, (_, i) => i + 1);
    await runPool(chapterNums, OT_CHAPTER_CONCURRENCY, async (chapter) => {
      const file = otChapterFile(book, chapter);
      const path = await fetchPinned('macula-hebrew', `WLC/lowfat/${file}`);
      const xml = readFileSync(path, 'utf8');
      // Fresh Window per chapter file (929 files total) — same leak as GNT,
      // at finer grain since OT is fetched chapter-by-chapter. The
      // install-parse pair below is synchronous (no `await` between them),
      // so concurrent pool workers (up to OT_CHAPTER_CONCURRENCY) never
      // observe each other's globalThis.DOMParser mid-parse.
      const win = installFreshDomShim();
      const chapters = hebrewXmlToChapters(xml, { sourceId: 'macula-hebrew-wlc-lowfat', book });
      tokens.push(...tokensOfChapters(chapters));
      await closeDomShim(win);
    });
    maybeGc();
    blocks.push(buildBookBlock(book.num, book.name, tokens));
    console.log(`  OT ${book.name} — ok (${book.chapters} chapters, ${tokens.length} tokens)`);
  }
  return blocks;
}

function metaFor(sourceKey: keyof typeof REVISIONS): ProgressMeta {
  return { sources: [REVISIONS[sourceKey]], keySemantics: 'src/ui/vocab.ts lexemeKey/parseKey' };
}

/** Greedy bin-packing by serialized weight — keeps shards size-balanced, not just count-balanced. */
function splitIntoBalancedShards(books: ProgressBookBlock[], numShards: number): ProgressBookBlock[][] {
  const weights = books.map((b) => JSON.stringify(b).length);
  const order = books.map((_, i) => i).sort((a, b) => weights[b]! - weights[a]!);
  const shards: ProgressBookBlock[][] = Array.from({ length: numShards }, () => []);
  const shardWeights = new Array(numShards).fill(0) as number[];
  for (const i of order) {
    let min = 0;
    for (let s = 1; s < numShards; s++) if (shardWeights[s]! < shardWeights[min]!) min = s;
    shards[min]!.push(books[i]!);
    shardWeights[min] += weights[i]!;
  }
  for (const shard of shards) shard.sort((a, b) => a.bookNum - b.bookNum);
  return shards;
}

function clearOtShardFiles(outDir: string): void {
  for (const name of readdirSync(outDir)) {
    if (/^ot-\d+\.json$/.test(name)) unlinkSync(join(outDir, name));
  }
}

async function main(): Promise<void> {
  console.log('Building GNT progress index (27 books)...');
  const gntBooks = await buildGntBooks();

  console.log('Building OT progress index (39 books, 929 chapter files, concurrency <=8 — several minutes)...');
  const otBooks = await buildOtBooks();

  const outDir = join(REPO_ROOT, 'public', 'progress');
  mkdirSync(outDir, { recursive: true });
  clearOtShardFiles(outDir);

  const gntPath = join(outDir, 'gnt.json');
  writeFileSync(gntPath, JSON.stringify({ meta: metaFor('macula-greek'), books: gntBooks } satisfies ProgressIndexFile));

  const otPath = join(outDir, 'ot.json');
  const otFull: ProgressIndexFile = { meta: metaFor('macula-hebrew'), books: otBooks };
  writeFileSync(otPath, JSON.stringify(otFull));
  const fullGzip = gzipSize(otPath);

  const reportPaths = [gntPath];
  if (fullGzip <= OT_GZIP_BUDGET_BYTES) {
    console.log(`OT index fits unsharded (gzip ${(fullGzip / 1024).toFixed(1)} KB <= 400 KB budget).`);
    reportPaths.push(otPath);
  } else {
    console.log(`OT index gzip ${(fullGzip / 1024).toFixed(1)} KB exceeds the 400 KB budget — sharding.`);
    let shards: ProgressBookBlock[][] = [otBooks];
    for (let n = 2; n <= 12; n++) {
      const candidate = splitIntoBalancedShards(otBooks, n);
      const candidateGzips = candidate.map((shard) => {
        const tmp = join(outDir, `.probe-${n}.json`);
        writeFileSync(tmp, JSON.stringify({ books: shard }));
        const gz = gzipSize(tmp);
        unlinkSync(tmp);
        return gz;
      });
      if (candidateGzips.every((g) => g <= OT_GZIP_BUDGET_BYTES)) {
        shards = candidate;
        console.log(
          `Sharded into ${n} files: ${candidate
            .map((s, i) => `ot-${i + 1}.json [${s[0]!.bookNum}-${s[s.length - 1]!.bookNum}] ${(candidateGzips[i]! / 1024).toFixed(1)} KB gzip`)
            .join('; ')}`,
        );
        break;
      }
      if (n === 12) {
        shards = candidate;
        console.warn(`Could not fit every shard under budget even at ${n} shards; keeping ${n} anyway.`);
      }
    }
    unlinkSync(otPath); // replace the unsharded file with the manifest
    const shardNames = shards.map((_, i) => `ot-${i + 1}.json`);
    for (const [i, shard] of shards.entries()) {
      const shardPath = join(outDir, shardNames[i]!);
      writeFileSync(shardPath, JSON.stringify({ books: shard }));
      reportPaths.push(shardPath);
    }
    const manifest = { meta: metaFor('macula-hebrew'), shards: shardNames };
    writeFileSync(otPath, JSON.stringify(manifest));
    reportPaths.push(otPath);
  }

  console.log('\nOutput sizes:');
  console.log(sizeReport(reportPaths));

  console.log(`\nDeleting the download cache (${CACHE_ROOT}) — disk quota.`);
  rmSync(CACHE_ROOT, { recursive: true, force: true });
}

// Only run when invoked directly (`tsx scripts/generate/progress.ts`) — not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
