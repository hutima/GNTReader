import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { clearMemoryCache } from '@/io/sources';

/**
 * The part-of-speech / morph-code help terms must be tappable: on touch there
 * is no hover, so tapping the term reveals its explanation inline (the `title`
 * tooltip alone never shows on a phone).
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

describe('detail-panel help terms', () => {
  it('taps the part of speech to reveal its explanation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'John 1' });
    // ἀρχῇ is a common noun in the fixture.
    await user.click(screen.getAllByText('ἀρχῇ')[0]!);
    const detail = await screen.findByRole('complementary', { name: 'Word details' });

    const term = within(detail).getByRole('button', { name: 'noun' });
    expect(detail).not.toHaveTextContent('Names a person, place, thing');
    await user.click(term);
    expect(detail).toHaveTextContent('Names a person, place, thing, or idea.');
  });
});
