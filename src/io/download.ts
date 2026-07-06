import type { Testament } from '@/domain/schema';
import { booksOf, type BookInfo } from '@/io/books';
import { loadChapter } from '@/io/sources';

/**
 * "Download the whole corpus for offline" — warms the EXISTING loader
 * (src/io/sources.ts) for every chapter of both testaments so the data lands
 * in the app's caches (IndexedDB via src/persistence/db.ts, plus the raw XML
 * in the service-worker runtime cache). This module never fetches or parses
 * anything itself; it only calls `loadChapter`, which owns all of that.
 *
 * GNT is shipped one XML file per BOOK, so a single `loadChapter` call for
 * any chapter of a book parses & caches the whole book. The bundled fixture
 * for John (book 4) only covers chapter 1, and `loadChapter` only reaches
 * past that fixture to the full book file when a chapter OTHER than the
 * fixture's is requested — so we always request each GNT book's LAST
 * chapter, guaranteeing a full-book fetch (for a 1-chapter book that's still
 * chapter 1, which already fetches the whole file). One call per GNT book
 * therefore caches every chapter of it.
 *
 * OT is shipped one XML file per CHAPTER, so every chapter needs its own
 * `loadChapter` call.
 */

export interface DownloadProgress {
  done: number;
  total: number;
  label: string;
}

export interface DownloadFailure {
  testament: Testament;
  bookNum: number;
  bookName: string;
  chapter?: number;
}

export interface DownloadResult {
  total: number;
  completed: number;
  failed: DownloadFailure[];
  aborted: boolean;
}

/** One unit of work in the flat task list. */
interface DownloadTask {
  /** Chapter units this task advances `done` by on success. */
  weight: number;
  label: string;
  failure: DownloadFailure;
  run: () => Promise<void>;
}

function gntTask(book: BookInfo): DownloadTask {
  return {
    weight: book.chapters,
    label: book.name,
    failure: { testament: 'gnt', bookNum: book.num, bookName: book.name },
    run: async () => {
      await loadChapter('gnt', book.num, book.chapters);
    },
  };
}

function otTask(book: BookInfo, chapter: number): DownloadTask {
  return {
    weight: 1,
    label: `${book.name} ${chapter}`,
    failure: { testament: 'ot', bookNum: book.num, bookName: book.name, chapter },
    run: async () => {
      await loadChapter('ot', book.num, chapter);
    },
  };
}

function buildTasks(): { tasks: DownloadTask[]; total: number } {
  const tasks: DownloadTask[] = [];
  let total = 0;

  for (const book of booksOf('gnt')) {
    tasks.push(gntTask(book));
    total += book.chapters;
  }
  for (const book of booksOf('ot')) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      tasks.push(otTask(book, chapter));
    }
    total += book.chapters;
  }

  return { tasks, total };
}

/**
 * Warm every chapter of both testaments through `loadChapter` so the whole
 * corpus is available offline. Runs a fixed-size worker pool over a flat
 * task list; failures are recorded rather than thrown, so one bad chapter
 * never aborts the rest of the download.
 */
export async function downloadAllScripture(opts?: {
  signal?: AbortSignal;
  onProgress?: (p: DownloadProgress) => void;
  concurrency?: number;
}): Promise<DownloadResult> {
  const { tasks, total } = buildTasks();
  const signal = opts?.signal;
  const onProgress = opts?.onProgress;
  const concurrency = Math.max(1, opts?.concurrency ?? 4);

  let cursor = 0;
  let done = 0;
  let aborted = false;
  const failed: DownloadFailure[] = [];

  async function worker(): Promise<void> {
    for (;;) {
      if (signal?.aborted) {
        aborted = true;
        return;
      }
      const index = cursor++;
      const task = tasks[index];
      if (!task) return;

      try {
        await task.run();
        done += task.weight;
      } catch {
        failed.push(task.failure);
      }
      onProgress?.({ done, total, label: task.label });
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return { total, completed: done, failed, aborted };
}
