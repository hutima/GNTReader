import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetInstallStateForTests, initInstallPrompt, useInstallPrompt } from '@/pwa/install';

/**
 * Install-prompt module logic, tested directly (no real browser gesture
 * needed here — this is plain event listener + module-state wiring, not a
 * pointer/touch gesture; see CLAUDE.md's real-browser rule for sheet drags).
 */

function dispatchBeforeInstallPrompt(overrides: {
  prompt?: () => void;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}) {
  const evt = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => void;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  evt.prompt = overrides.prompt ?? vi.fn();
  evt.userChoice = overrides.userChoice ?? Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(evt);
  return evt;
}

beforeEach(() => {
  __resetInstallStateForTests();
});

describe('install prompt module', () => {
  it('captures beforeinstallprompt and flips canInstall on', () => {
    initInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    act(() => {
      dispatchBeforeInstallPrompt({});
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('promptInstall() calls prompt() and clears state once accepted', async () => {
    initInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    const promptSpy = vi.fn();

    act(() => {
      dispatchBeforeInstallPrompt({
        prompt: promptSpy,
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      });
    });
    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('appinstalled clears the captured prompt and marks standalone', async () => {
    initInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      dispatchBeforeInstallPrompt({});
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.canInstall).toBe(false));
    expect(result.current.isStandalone).toBe(true);
  });
});
