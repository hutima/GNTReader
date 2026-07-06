import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { clearMemoryCache } from '@/io/sources';
import { useAppStore } from '@/state/store';

/**
 * Reader UI smoke (test plan item 5): selector renders, token tap opens the
 * detail panel, gloss mode swaps displayed text but preserves selection.
 * fetch is served from public/ on disk — same files the app ships.
 */

const publicDir = join(__dirname, '..', 'public');

function fileFor(pathname: string): string | null {
  // The loader candidates are BASE_URL-relative ("/fixtures/…", "/lexicon/…").
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

describe('reader UI smoke', () => {
  it('loads John 1, opens the detail panel on token tap, and gloss mode preserves selection', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default position: John 1 (bundled fixture).
    await screen.findByRole('heading', { name: 'John 1' });
    expect(screen.getAllByText('Ἐν').length).toBeGreaterThan(0);

    // Tap a token → detail panel with lemma, gloss, Strong's, parsing.
    await user.click(screen.getAllByText('ἀρχῇ')[0]!);
    const detail = await screen.findByRole('complementary', { name: 'Word details' });
    expect(detail).toHaveTextContent('ἀρχή');
    expect(detail).toHaveTextContent('beginning');
    expect(detail).toHaveTextContent('G746');
    expect(detail).toHaveTextContent('dat');
    // Greek transliteration falls back to the Strong's entry (never generated).
    await waitFor(() => expect(detail).toHaveTextContent('archḗ'));

    // Gloss mode: token text becomes the gloss…
    await user.click(screen.getByRole('tab', { name: 'Gloss' }));
    expect(screen.queryAllByText('Ἐν')).toHaveLength(0);
    expect(screen.getAllByText('In [the]').length).toBeGreaterThan(0);
    // …and the selection (detail panel) survives the mode switch.
    expect(screen.getByRole('complementary', { name: 'Word details' })).toHaveTextContent('G746');
    expect(useAppStore.getState().selectedToken?.lemma).toBe('ἀρχή');

    // Back to original for the picker test below.
    await user.click(screen.getByRole('tab', { name: 'Original' }));
    expect(screen.getAllByText('Ἐν').length).toBeGreaterThan(0);
  });

  it('book/chapter selector renders both testaments and navigates', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /John 1/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose book and chapter' });
    expect(dialog).toHaveTextContent('Greek NT');
    expect(dialog).toHaveTextContent('Hebrew OT');
    expect(dialog).toHaveTextContent('Revelation');

    // Switch to the OT, pick Genesis → chapter grid → chapter 1.
    await user.click(screen.getByRole('tab', { name: 'Hebrew OT' }));
    await user.click(screen.getByRole('button', { name: 'Genesis' }));
    await user.click(screen.getByRole('button', { name: /^1$/ }));

    await screen.findByRole('heading', { name: 'Genesis 1' });
    const state = useAppStore.getState();
    expect(state.testament).toBe('ot');
    expect(state.bookNum).toBe(1);
    expect(state.chapter).toBe(1);
  });
});
