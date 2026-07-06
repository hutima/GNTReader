import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { clearMemoryCache } from '@/io/sources';
import { useAppStore } from '@/state/store';

/**
 * In Both mode with vocabulary mode on, marking a lexeme known removes the
 * gloss under every occurrence of that word — the reduction that leaves only
 * the words still being learned.
 */
const publicDir = join(__dirname, '..', 'public');
function fileFor(pathname: string): string | null {
  const rel = pathname.replace(/^\//, '');
  for (const candidate of [rel, `fixtures/${rel}`]) {
    try {
      return readFileSync(join(publicDir, candidate), 'utf8');
    } catch {
      /* next */
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

afterEach(() => {
  const s = useAppStore.getState();
  s.resetKnown();
  s.setVocabMode(false);
  s.setDisplayMode('original');
});

describe('vocabulary display', () => {
  it('hides the gloss of a word once its lexeme is marked known', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'John 1' });

    // Both mode shows the gloss "beginning" under ἀρχῇ (lemma ἀρχή, twice in ch1).
    await user.click(screen.getByRole('tab', { name: 'Both' }));
    expect(screen.getAllByText('beginning').length).toBeGreaterThan(0);

    // Enable vocab mode and mark the lexeme known → its glosses vanish.
    act(() => {
      useAppStore.getState().setVocabMode(true);
      useAppStore.getState().markKnown('lexeme', 'grc|ἀρχή');
    });
    expect(screen.queryByText('beginning')).toBeNull();
  });
});
