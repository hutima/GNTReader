import { foldAccents, foldGreekSearch, tidyGloss } from '@/domain/normalize';
import type { ReadingToken, ReadingVerse, Testament } from '@/domain/schema';
import { loadChapter } from '@/io/sources';
import { normalizeStrong } from '@/io/strongs';

/**
 * Morphology/concordance search. Structured fields, no query DSL (reference
 * app convention). Scoped streaming: chapters load one at a time through the
 * normal loader caches, so a whole-book sweep never holds more than the
 * loader's own cache and can be cancelled between chapters.
 */

export interface SearchQuery {
  /** Matched (accent/point-insensitive, substring) per `field`. */
  text?: string;
  field?: 'any' | 'surface' | 'lemma' | 'gloss';
  /** Strong's number ("746", "G746", "0871a"). Exact, prefix-normalized. */
  strong?: string;
  pos?: string;
  case?: string;
  gender?: string;
  number?: string;
  person?: string;
  tense?: string;
  voice?: string;
  mood?: string;
}

export function isEmptyQuery(q: SearchQuery): boolean {
  return !(
    q.text?.trim() ||
    q.strong?.trim() ||
    q.pos ||
    q.case ||
    q.gender ||
    q.number ||
    q.person ||
    q.tense ||
    q.voice ||
    q.mood
  );
}

export function matchToken(token: ReadingToken, q: SearchQuery): boolean {
  const text = q.text?.trim();
  if (text) {
    const needle = foldGreekSearch(text);
    const field = q.field ?? 'any';
    const surface = () => foldGreekSearch(token.surface).includes(needle);
    const lemma = () => !!token.lemma && foldGreekSearch(token.lemma).includes(needle);
    const gloss = () => !!token.gloss && foldAccents(tidyGloss(token.gloss)).includes(needle);
    const ok =
      field === 'surface'
        ? surface()
        : field === 'lemma'
          ? lemma()
          : field === 'gloss'
            ? gloss()
            : surface() || lemma() || gloss();
    if (!ok) return false;
  }
  if (q.strong?.trim()) {
    if (!token.strong) return false;
    if (normalizeStrong(token.strong) !== normalizeStrong(q.strong)) return false;
  }
  if (q.pos && token.pos !== q.pos) return false;
  const m = token.morphology;
  for (const k of ['case', 'gender', 'number', 'person', 'tense', 'voice', 'mood'] as const) {
    if (q[k] && m?.[k] !== q[k]) return false;
  }
  return true;
}

export interface SearchHit {
  token: ReadingToken;
  /** Display reference, e.g. "John 1:1". */
  ref: string;
  /** Short original-language context line around the hit. */
  context: string;
}

export const SEARCH_RESULT_CAP = 300;

/** Running text of a verse trimmed to ~9 words centered on the hit. */
export function contextLine(verse: ReadingVerse, hit: ReadingToken): string {
  const i = verse.tokens.findIndex((t) => t.id === hit.id);
  const from = Math.max(0, i - 4);
  const to = Math.min(verse.tokens.length, i + 5);
  const slice = verse.tokens.slice(from, to);
  // Same separator rule as TokenSpan: punctuation attaches, then a space
  // unless the separator is absent (Hebrew prefix) or maqqef (joins).
  const text = slice
    .map(
      (t) =>
        t.surface +
        (t.after && t.after !== ' ' ? t.after : '') +
        (t.after && t.after !== '־' ? ' ' : ''),
    )
    .join('')
    .trim();
  return `${from > 0 ? '… ' : ''}${text}${to < verse.tokens.length ? ' …' : ''}`;
}

export interface SearchScope {
  testament: Testament;
  bookNum: number;
  startChapter: number;
  endChapter: number;
}

export interface SearchProgress {
  chaptersDone: number;
  chaptersTotal: number;
}

export interface SearchResult {
  hits: SearchHit[];
  capped: boolean;
  /** Chapters that could not be loaded (offline, missing upstream). */
  failedChapters: number[];
}

/**
 * Stream the scope chapter-by-chapter. Cancellable between chapters via
 * `signal`; per-chapter progress via `onProgress`. A chapter that fails to
 * load is recorded and skipped rather than sinking the whole search.
 */
export async function searchScope(
  scope: SearchScope,
  query: SearchQuery,
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: SearchProgress) => void;
    cap?: number;
  } = {},
): Promise<SearchResult> {
  const cap = opts.cap ?? SEARCH_RESULT_CAP;
  const hits: SearchHit[] = [];
  const failedChapters: number[] = [];
  const total = scope.endChapter - scope.startChapter + 1;
  let done = 0;
  let capped = false;

  if (isEmptyQuery(query)) return { hits, capped, failedChapters };

  outer: for (let c = scope.startChapter; c <= scope.endChapter; c++) {
    if (opts.signal?.aborted) break;
    try {
      const chapter = await loadChapter(scope.testament, scope.bookNum, c);
      for (const verse of chapter.verses) {
        for (const token of verse.tokens) {
          if (!matchToken(token, query)) continue;
          if (hits.length >= cap) {
            capped = true;
            break outer;
          }
          hits.push({ token, ref: verse.ref, context: contextLine(verse, token) });
        }
      }
    } catch {
      failedChapters.push(c);
    }
    done++;
    opts.onProgress?.({ chaptersDone: done, chaptersTotal: total });
  }
  return { hits, capped, failedChapters };
}
