import { describe, expect, it } from 'vitest';
import {
  atCompensatedScroll,
  captureWidthAnchor,
  clamp01,
  pickVisibleChapter,
  widthChanged,
  widthRestoreDelta,
} from '@/ui/anchor';

/**
 * Pure-logic coverage for FL-007 (iPad panel-reflow jump + visible-chapter
 * tracking). All inputs are plain rects/numbers — no DOM required, so these
 * run identically in happy-dom and a real browser.
 */

describe('pickVisibleChapter', () => {
  it('midpoint inside chapter 2 of 3 rects picks chapter 2', () => {
    const articles = [
      { chapter: 1, top: 0, bottom: 100 },
      { chapter: 2, top: 100, bottom: 200 },
      { chapter: 3, top: 200, bottom: 300 },
    ];
    expect(pickVisibleChapter(articles, 150, 0, 800)).toBe(2);
  });

  it('midpoint in a gap between articles falls back to greatest intersection', () => {
    const articles = [
      { chapter: 1, top: 0, bottom: 100 },
      { chapter: 2, top: 120, bottom: 220 },
    ];
    // midY=110 lands in the 100-120 gap; viewport [50,300] overlaps chapter 2
    // (100px) more than chapter 1 (50px).
    expect(pickVisibleChapter(articles, 110, 50, 300)).toBe(2);
  });

  it('short last chapter with the midpoint in the trailing blank still picks the last chapter', () => {
    const articles = [
      { chapter: 1, top: -200, bottom: 600 },
      { chapter: 2, top: 600, bottom: 650 }, // short trailing chapter
    ];
    // Scrolled down: viewport [600,800]; midY=700 is past chapter 2's own
    // bottom (blank space below the last chapter), but chapter 1 has scrolled
    // fully out of view (zero overlap) while chapter 2 still overlaps.
    expect(pickVisibleChapter(articles, 700, 600, 800)).toBe(2);
  });

  it('an article taller than the viewport containing the midpoint picks it', () => {
    const articles = [{ chapter: 5, top: -500, bottom: 2000 }];
    expect(pickVisibleChapter(articles, 400, 0, 800)).toBe(5);
  });

  it('returns null when there are no rendered chapters', () => {
    expect(pickVisibleChapter([], 100, 0, 800)).toBeNull();
  });
});

describe('captureWidthAnchor', () => {
  it('returns {id, ratio} for the verse containing the midpoint', () => {
    const verses = [{ id: 'v-1-1', top: 0, bottom: 100 }];
    const anchor = captureWidthAnchor(verses, 25, 0, 800);
    expect(anchor).toEqual({ id: 'v-1-1', ratio: 0.25 });
  });

  it('clamps ratio to 1 when the fallback pick lies below the rect (edge)', () => {
    const verses = [{ id: 'v-1-1', top: 0, bottom: 100 }];
    // midY=150 is outside [0,100), but this is the only verse with any
    // viewport overlap, so it's picked via fallback with an out-of-range ratio.
    const anchor = captureWidthAnchor(verses, 150, 0, 200);
    expect(anchor?.id).toBe('v-1-1');
    expect(anchor?.ratio).toBe(1);
  });

  it('clamps ratio to 0 when the fallback pick lies above the rect (edge)', () => {
    const verses = [{ id: 'v-2-1', top: 100, bottom: 200 }];
    const anchor = captureWidthAnchor(verses, -50, -1000, 1000);
    expect(anchor?.id).toBe('v-2-1');
    expect(anchor?.ratio).toBe(0);
  });

  it('returns null when there are no verses', () => {
    expect(captureWidthAnchor([], 100, 0, 800)).toBeNull();
  });
});

describe('widthRestoreDelta', () => {
  it('re-seats the ratio point at the viewport midpoint after the verse rect grows', () => {
    const scrollerTop = 50;
    const clientHeight = 600;
    const midY = scrollerTop + clientHeight / 2; // 350
    const ratio = 0.4;
    // Verse grew taller after the width-triggered rewrap.
    const grownRect = { top: 300, bottom: 500 };
    const delta = widthRestoreDelta(grownRect, ratio, scrollerTop, clientHeight);

    // Applying `delta` to scrollTop shifts every on-screen rect up by delta;
    // the ratio point must land back exactly on the viewport midpoint.
    const shiftedTop = grownRect.top - delta;
    const reseated = shiftedTop + ratio * (grownRect.bottom - grownRect.top);
    expect(reseated).toBeCloseTo(midY, 6);
  });

  it('is zero when the anchor point already sits on the midpoint', () => {
    const rect = { top: 200, bottom: 400 };
    const delta = widthRestoreDelta(rect, 0.5, 100, 400); // midY=300, anchor=300
    expect(delta).toBeCloseTo(0, 6);
  });
});

describe('widthChanged (width gate)', () => {
  it('is false for an unchanged width (ordinary scroll/height changes never compensate)', () => {
    expect(widthChanged(448, 448)).toBe(false);
  });

  it('is true for a changed width (panel open/close reflow)', () => {
    expect(widthChanged(768, 448)).toBe(true);
  });
});

describe('atCompensatedScroll (capture-invalidation gate)', () => {
  it('is false when nothing has been compensated yet (first load)', () => {
    expect(atCompensatedScroll(1234, null)).toBe(false);
  });

  it('suppresses capture while sitting exactly at the compensated position', () => {
    // The width-reflow restore (and the scroll event its write fires) land here;
    // re-capturing would flip the anchor to a shared-line neighbour (FL-007).
    expect(atCompensatedScroll(5000, 5000)).toBe(true);
  });

  it('tolerates sub-pixel quantisation at the compensated position', () => {
    expect(atCompensatedScroll(5000.3, 5000)).toBe(true);
    expect(atCompensatedScroll(4999.7, 5000)).toBe(true);
  });

  it('re-enables capture once a real user scroll moves off the compensated position', () => {
    expect(atCompensatedScroll(5001, 5000)).toBe(false);
    expect(atCompensatedScroll(4980, 5000)).toBe(false);
  });
});

describe('clamp01', () => {
  it('clamps below 0 and above 1, passes through in-range values', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});
