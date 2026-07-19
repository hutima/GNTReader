import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { useAppStore } from '@/state/store';

/**
 * First-launch tutorial (TutorialModal): a skippable step-through card
 * teaching vocabulary mode in the Both view. src/test/setup.ts pre-seeds
 * gr:tutorialSeen so it never auto-opens for the other suites — here we
 * force it open per test via the store action (the loader already ran at
 * module-import time, so localStorage pokes after the fact wouldn't do
 * anything; existing suites use the same store-action convention).
 */
beforeAll(() => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
});

beforeEach(() => {
  useAppStore.getState().openTutorial();
});

afterEach(() => {
  useAppStore.getState().closeTutorial();
  useAppStore.getState().openPanel('none');
});

describe('first-launch tutorial', () => {
  it('renders step 1 with Skip tour and Next when forced open', async () => {
    render(<App />);
    const dialog = await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });
    expect(within(dialog).getByRole('button', { name: 'Skip tour' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('steps through Next to the final step, where "Get started" closes it and persists tutorialSeen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });

    for (const title of [
      'The Both view',
      'Mark words you know',
      'Watch the helps fade',
      'Make it yours',
    ]) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByRole('dialog', { name: title });
    }

    const finalDialog = screen.getByRole('dialog', { name: 'Make it yours' });
    expect(within(finalDialog).queryByRole('button', { name: 'Skip tour' })).not.toBeInTheDocument();
    expect(within(finalDialog).getByRole('button', { name: 'Get started' })).toBeInTheDocument();

    await user.click(within(finalDialog).getByRole('button', { name: 'Get started' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Make it yours' })).not.toBeInTheDocument(),
    );
    expect(useAppStore.getState().tutorialOpen).toBe(false);
    expect(useAppStore.getState().tutorialSeen).toBe(true);
    expect(localStorage.getItem('gr:tutorialSeen')).toBe('on');
  });

  it('"Skip tour" closes the tutorial and persists tutorialSeen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });

    await user.click(screen.getByRole('button', { name: 'Skip tour' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Welcome to GNT Reader' })).not.toBeInTheDocument(),
    );
    expect(useAppStore.getState().tutorialOpen).toBe(false);
    expect(useAppStore.getState().tutorialSeen).toBe(true);
    expect(localStorage.getItem('gr:tutorialSeen')).toBe('on');
  });

  it('"Back" returns to the previous step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'The Both view' });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });
  });

  it('Settings "Replay tour" reopens the tutorial and closes the settings sheet', async () => {
    const user = userEvent.setup();
    // Start as a returning user who has already dismissed the tour once.
    useAppStore.getState().closeTutorial();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settingsDialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(settingsDialog).getByRole('button', { name: 'Replay tour' }));

    await screen.findByRole('dialog', { name: 'Welcome to GNT Reader' });
    expect(useAppStore.getState().panel).toBe('none');
  });
});
