import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { useAppStore } from '@/state/store';

/**
 * Settings sheet wiring: the header ⚙️ opens it; the theme override writes
 * data-theme onto <html>; the reading-size stepper changes the scale; the
 * Strong's entry point switches panels. No data needed — fetch is stubbed 404.
 */
beforeAll(() => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
});

afterEach(() => {
  // Reset appearance side effects between tests.
  document.documentElement.removeAttribute('data-theme');
  useAppStore.getState().setTheme('system');
  useAppStore.getState().setReadingScale(1);
  useAppStore.getState().openPanel('none');
});

describe('settings sheet', () => {
  it('opens from the header and applies theme + reading-size overrides', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveTextContent('Appearance');

    // Explicit dark theme → data-theme on the root element.
    await user.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(useAppStore.getState().theme).toBe('dark');

    // Reading size stepper changes the scale (and the CSS var).
    const before = useAppStore.getState().readingScale;
    await user.click(screen.getByRole('button', { name: 'Increase reading size' }));
    expect(useAppStore.getState().readingScale).toBeGreaterThan(before);
    expect(document.documentElement.style.getPropertyValue('--reading-scale')).not.toBe('');
  });

  it('routes to the Strong’s lexicon from settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(screen.getByRole('button', { name: /Browse Strong’s lexicon/ }));

    await waitFor(() => expect(useAppStore.getState().panel).toBe('strongs'));
  });
});
