/**
 * Pure geometry helpers behind two independent scroll-position mechanisms:
 *
 * 1. Width-gated ratio anchor (FL-007): when the reader's own width changes
 *    (opening/closing the desktop side panel at 768–834px flex-shrinks the
 *    column, rewrapping every line), re-seat the verse under the viewport's
 *    midpoint at the same fractional offset it had before the rewrap. This is
 *    orthogonal to the FL-004 height/prepend anchor in Reader.tsx (different
 *    ref, different trigger — a width change vs. a content-height change).
 * 2. Visible-chapter tracking (FL-007): which chapter's heading the reader is
 *    actually looking at right now, independent of the last *navigated*
 *    chapter (`chapter` in the store) — used for the header title, the
 *    picker's current-chapter highlight, and the persisted last-read
 *    position, WITHOUT ever feeding back into navigation.
 *
 * Every function here takes plain rects/numbers, not DOM nodes, so it is
 * testable without a browser (see tests/reader-anchor.test.ts).
 */

export interface Rect {
  top: number;
  bottom: number;
}

export interface ChapterRect extends Rect {
  chapter: number;
}

export interface VerseRect extends Rect {
  id: string;
}

export interface WidthAnchor {
  id: string;
  ratio: number;
}

/** Clamp to [0, 1]. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Pick the rect containing `midY` (top ≤ midY < bottom); if none contains it,
 * fall back to the rect with the greatest overlap with [viewTop, viewBottom].
 * Returns null only when `rects` is empty or nothing overlaps the viewport at
 * all (an overlap of 0 or less never wins the fallback).
 */
export function pickByMidpoint<T extends Rect>(
  rects: readonly T[],
  midY: number,
  viewTop: number,
  viewBottom: number,
): T | null {
  for (const r of rects) {
    if (r.top <= midY && midY < r.bottom) return r;
  }
  let best: T | null = null;
  let bestOverlap = 0;
  for (const r of rects) {
    const overlap = Math.min(r.bottom, viewBottom) - Math.max(r.top, viewTop);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = r;
    }
  }
  return best;
}

/**
 * Which chapter <article> the reader is currently "at": the one containing
 * the viewport midpoint, or (gap between articles / short trailing chapter)
 * whichever has the greatest visible intersection. Null when there are no
 * rendered chapters yet.
 */
export function pickVisibleChapter(
  articles: readonly ChapterRect[],
  midY: number,
  viewTop: number,
  viewBottom: number,
): number | null {
  const picked = pickByMidpoint(articles, midY, viewTop, viewBottom);
  return picked ? picked.chapter : null;
}

/**
 * Capture the width anchor: the `.verse` element at the viewport midpoint,
 * and how far through its own height the midpoint fell (0 = top edge, 1 =
 * bottom edge). Used to re-seat that same fractional point after a width
 * reflow changes every verse's height.
 */
export function captureWidthAnchor(
  verses: readonly VerseRect[],
  midY: number,
  viewTop: number,
  viewBottom: number,
): WidthAnchor | null {
  const picked = pickByMidpoint(verses, midY, viewTop, viewBottom);
  if (!picked) return null;
  const height = picked.bottom - picked.top;
  const ratio = height > 0 ? clamp01((midY - picked.top) / height) : 0;
  return { id: picked.id, ratio };
}

/**
 * How much to add to `scroller.scrollTop` so the anchored verse's `ratio`
 * point lands back on the viewport midpoint, after its rect has changed
 * (grown/shrunk from a width-triggered rewrap). `rect` is the anchored
 * verse's CURRENT (post-reflow) bounding rect, in the same coordinate frame
 * as `scrollerTop`.
 */
export function widthRestoreDelta(
  rect: Rect,
  ratio: number,
  scrollerTop: number,
  clientHeight: number,
): number {
  const midY = scrollerTop + clientHeight / 2;
  const anchorPoint = rect.top + ratio * (rect.bottom - rect.top);
  return anchorPoint - midY;
}

/**
 * Strict width-change gate: true only when the observed width actually moved.
 * Ordinary scrolling and content-height changes report the same width and
 * must never trigger width compensation. Rounded to the nearest pixel: this
 * same helper also gates whether a caller's width reading agrees with the
 * last one the ResizeObserver processed (Reader.tsx `captureAll`'s in-flight
 * guard) — comparing two getBoundingClientRect() reads taken moments apart
 * (rather than the same paint) can differ by sub-pixel noise that isn't a
 * real width change, which would otherwise wedge that guard open forever.
 */
export function widthChanged(prevWidth: number, nextWidth: number): boolean {
  return Math.round(prevWidth) !== Math.round(nextWidth);
}

/**
 * Capture-invalidation gate (FL-007): true while the scroller still sits
 * exactly where the app last *programmatically* compensated a layout mutation
 * (a width-reflow restore, or an FL-004 prepend/trim) and no user scroll has
 * moved it since. While true the width anchor must NOT be re-captured: adjacent
 * `.verse` spans share the line where one ends and the next begins, so their
 * token-union rects overlap by ~a line and `elementFromPoint` at the midpoint
 * can re-pick the NEIGHBOUR verse — flipping the anchor's identity with no real
 * movement, so the inverse reflow (panel close) restores the wrong verse and
 * lands one text line off. A genuine user scroll changes scrollTop off the
 * compensated value, clearing the gate and resuming capture. `null` (nothing
 * compensated yet, e.g. first load) never suppresses. The 0.5px tolerance
 * absorbs sub-pixel scroll quantisation without masking a real user scroll.
 */
export function atCompensatedScroll(current: number, compensated: number | null): boolean {
  return compensated != null && Math.abs(current - compensated) < 0.5;
}
