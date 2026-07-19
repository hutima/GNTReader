import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { useAppStore } from '@/state/store';

// The shell smoke needs no data — stub fetch so happy-dom never opens a real
// connection (its teardown abort is noisy).
beforeAll(() => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
});

describe('app shell smoke', () => {
  it('renders the header navigation and display-mode control', () => {
    render(<App />);
    // Default position is John 1 (bundled fixture).
    expect(screen.getByRole('button', { name: /John 1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Original' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gloss' })).toBeInTheDocument();
    // Both is the first-run default display mode (below) — it should be the
    // selected tab on a fresh render.
    expect(screen.getByRole('tab', { name: 'Both' })).toHaveAttribute('aria-selected', 'true');
  });

  it('defaults to the Both view with vocabulary mode on for a first run', () => {
    // No gr:displayMode / gr:vocab keys are present (only setup.ts's
    // gr:tutorialSeen), so the loaders' first-run fallbacks apply — assert
    // via the store rather than localStorage, since the module already
    // loaded before this test runs.
    expect(useAppStore.getState().displayMode).toBe('both');
    expect(useAppStore.getState().vocabMode).toBe(true);
  });
});
