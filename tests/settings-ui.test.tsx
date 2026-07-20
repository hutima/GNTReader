import { render, screen, waitFor, within } from '@testing-library/react';
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
  it('renders "How to use" first, and an "About the author" button in the last (About) section', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });

    const headings = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings[0]).toBe('How to use');
    expect(headings[headings.length - 1]).toBe('About');
    expect(headings.indexOf('How to use')).toBeLessThan(headings.indexOf('Appearance'));

    // The bio/link content is not present until the About modal is opened.
    expect(within(dialog).queryByText(/Wycliffe College/)).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('link', { name: 'definedfaith.wordpress.com' }),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).getByRole('button', { name: 'About the author' }),
    ).toBeInTheDocument();
  });

  it('opens the About the author modal with correct external links, and dismisses it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settingsDialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(
      within(settingsDialog).getByRole('button', { name: 'About the author' }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'About the author' });

    const blog = within(dialog).getByRole('link', { name: 'definedfaith.wordpress.com' });
    expect(blog).toHaveAttribute('href', 'https://definedfaith.wordpress.com/');
    expect(blog).toHaveAttribute('target', '_blank');
    expect(blog).toHaveAttribute('rel', 'noopener noreferrer');

    const linkedin = within(dialog).getByRole('link', { name: 'LinkedIn' });
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/timothyhutama/');
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');

    for (const [name, href] of [
      ['Bible & catechism memorization', 'https://hutima.github.io/Lectio-Memorization/'],
      ['Scripture Diagrammer', 'https://hutima.github.io/ScriptureDiagrammer/'],
      ['PCA ordination study', 'https://hutima.github.io/PCA_Ordination_Study/'],
    ] as const) {
      const link = within(dialog).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    const mail = within(dialog).getByRole('link', { name: 't.hutama@queensu.ca' });
    expect(mail).toHaveAttribute('href', 'mailto:t.hutama@queensu.ca');
    expect(mail).not.toHaveAttribute('target');

    expect(dialog).toHaveTextContent('@hutima');
    // The links list must not point back at GNT Reader itself.
    expect(within(dialog).queryByText(/GNT Reader/i, { selector: 'a' })).not.toBeInTheDocument();

    // Close button dismisses it.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'About the author' })).not.toBeInTheDocument();
  });

  it('dismisses the About the author modal on backdrop click', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settingsDialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(
      within(settingsDialog).getByRole('button', { name: 'About the author' }),
    );
    await screen.findByRole('dialog', { name: 'About the author' });

    // Only the About modal renders a `.modal-backdrop` at this point (the
    // Settings sheet itself uses `.sheet-backdrop`).
    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).toBeTruthy();
    await user.click(backdrop as Element);

    expect(screen.queryByRole('dialog', { name: 'About the author' })).not.toBeInTheDocument();
  });

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
