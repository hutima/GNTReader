import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import * as sources from '@/io/sources';
import { clearMemoryCache } from '@/io/sources';
import { LAST_REF_DEBOUNCE_MS, useAppStore } from '@/state/store';

/**
 * FL-008: `visibleChapter` tracks where the reader is actually scrolled to,
 * independent of the last *navigated* `chapter`. It must never feed back into
 * navigation (no reload, no Reader-load-effect re-run), only into the header
 * title / picker highlight / persisted position — see src/ui/anchor.ts and
 * the Reader.tsx capture points.
 */

const publicDir = join(__dirname, '..', 'public');

function fileFor(pathname: string): string | null {
  const rel = pathname.replace(/^\//, '');
  for (const candidate of [rel, `fixtures/${rel}`]) {
    try {
      return readFileSync(join(publicDir, candidate), 'utf8');
    } catch {
      /* try next */
    }
  }
  return null;
}

beforeAll(() => {
  clearMemoryCache();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost/');
    const body = fileFor(url.pathname);
    if (body == null) return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => JSON.parse(body),
    } as unknown as Response;
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  act(() => {
    useAppStore.getState().restorePosition('gnt', 4, 1);
  });
  localStorage.clear();
  vi.useRealTimers();
});

describe('visibleChapter (FL-008)', () => {
  it('navigate() sets both chapter and visibleChapter', () => {
    act(() => {
      useAppStore.getState().navigate('gnt', 5, 3);
    });
    const s = useAppStore.getState();
    expect(s.chapter).toBe(3);
    expect(s.visibleChapter).toBe(3);
  });

  it('restorePosition() sets both chapter and visibleChapter', () => {
    act(() => {
      useAppStore.getState().restorePosition('ot', 1, 2);
    });
    const s = useAppStore.getState();
    expect(s.chapter).toBe(2);
    expect(s.visibleChapter).toBe(2);
  });

  it('setVisibleChapter changes neither chapter/bookNum/testament, nor reloads the Reader', async () => {
    const loadSpy = vi.spyOn(sources, 'loadChapter');
    render(<App />);
    await screen.findByRole('heading', { name: 'John 1' });
    const headingBefore = screen.getByRole('heading', { name: 'John 1' });
    const callsBefore = loadSpy.mock.calls.length;

    act(() => {
      useAppStore.getState().setVisibleChapter(2);
    });

    const s = useAppStore.getState();
    expect(s.chapter).toBe(1);
    expect(s.bookNum).toBe(4);
    expect(s.testament).toBe('gnt');
    expect(s.visibleChapter).toBe(2);
    // The Reader's load effect (deps [testament,bookNum,chapter]) never fired
    // again — same DOM node, no new loadChapter call.
    expect(screen.getByRole('heading', { name: 'John 1' })).toBe(headingBefore);
    expect(loadSpy.mock.calls.length).toBe(callsBefore);
    loadSpy.mockRestore();
  });

  it('debounces the gr:lastRef write (~500ms) and keeps the {testament,bookNum,chapter} shape', () => {
    vi.useFakeTimers();
    act(() => {
      useAppStore.getState().navigate('gnt', 4, 1);
    });
    localStorage.clear(); // isolate from navigate()'s own immediate write

    act(() => {
      useAppStore.getState().setVisibleChapter(2);
    });
    // Not written yet — still debouncing.
    expect(localStorage.getItem('gr:lastRef')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(LAST_REF_DEBOUNCE_MS);
    });
    const raw = localStorage.getItem('gr:lastRef');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ testament: 'gnt', bookNum: 4, chapter: 2 });
  });

  it('flushes the pending write immediately on pagehide', () => {
    vi.useFakeTimers();
    act(() => {
      useAppStore.getState().navigate('gnt', 4, 1);
    });
    localStorage.clear();

    act(() => {
      useAppStore.getState().setVisibleChapter(3);
    });
    expect(localStorage.getItem('gr:lastRef')).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(JSON.parse(localStorage.getItem('gr:lastRef')!)).toEqual({
      testament: 'gnt',
      bookNum: 4,
      chapter: 3,
    });
  });

  it('header title shows visibleChapter, not the last navigated chapter', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'John 1' });
    expect(screen.getByRole('button', { name: /John 1/ })).toBeInTheDocument();

    act(() => {
      useAppStore.getState().setVisibleChapter(2);
    });
    expect(screen.getByRole('button', { name: /John 2/ })).toBeInTheDocument();
    expect(useAppStore.getState().chapter).toBe(1); // unchanged — no navigation happened
  });

  it('BookPicker highlights visibleChapter (not the last navigated chapter)', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'John 1' });

    act(() => {
      useAppStore.getState().setVisibleChapter(2);
    });
    act(() => {
      useAppStore.getState().openPanel('picker');
    });
    // Drill into the current book (John) to reach the chapter grid.
    act(() => {
      screen.getByRole('button', { name: 'John' }).click();
    });

    const chapterTwo = screen.getByRole('button', { name: '2' });
    const chapterOne = screen.getByRole('button', { name: '1' });
    expect(chapterTwo).toHaveAttribute('aria-current', 'true');
    expect(chapterOne).not.toHaveAttribute('aria-current');
  });
});
