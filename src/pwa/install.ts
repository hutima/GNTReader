import { useSyncExternalStore } from 'react';

/**
 * PWA "Install app" prompt — captures the browser's `beforeinstallprompt`
 * event (Chrome/Edge/Android) so Settings can offer an explicit "Install"
 * button instead of relying on the browser's own UI, and separately detects
 * iOS/iPadOS (which never fires that event) so Settings can show manual
 * "Add to Home Screen" steps instead.
 *
 * Mirrors src/pwa/pwa.ts's module-state + listeners + useSyncExternalStore
 * pattern. initInstallPrompt() must run before React mounts (see
 * src/main.tsx) so an early `beforeinstallprompt` fired during startup isn't
 * missed — per spec, calling `preventDefault()` on it is what lets us defer
 * and replay the native prompt later via `.prompt()`.
 */

// `beforeinstallprompt` isn't in lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallState {
  canInstall: boolean;
  isStandalone: boolean;
  isIos: boolean;
}

function detectIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

function detectIsIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ Safari reports a desktop Mac UA; touch is the tell.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

let deferredEvent: BeforeInstallPromptEvent | null = null;
let state: InstallState = {
  canInstall: false,
  isStandalone: detectIsStandalone(),
  isIos: detectIsIos(),
};
const listeners = new Set<() => void>();
function set(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let initialised = false;

/** Capture `beforeinstallprompt` / `appinstalled`. Call once, at startup. */
export function initInstallPrompt(): void {
  if (initialised) return;
  initialised = true;
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    set({ canInstall: false, isStandalone: true });
  });
}

/** Wired to the Settings "Install" button. */
export async function promptInstall(): Promise<void> {
  const evt = deferredEvent;
  if (!evt) return;
  await evt.prompt();
  const choice = await evt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredEvent = null;
    set({ canInstall: false });
  }
}

// --- React binding -----------------------------------------------------------

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): InstallState {
  return state;
}

export function useInstallPrompt(): InstallState & { promptInstall: typeof promptInstall } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, promptInstall };
}

/** Test-only: reset module state between tests (see tests/install-prompt.test.ts). */
export function __resetInstallStateForTests(): void {
  deferredEvent = null;
  initialised = false;
  state = { canInstall: false, isStandalone: detectIsStandalone(), isIos: detectIsIos() };
  listeners.clear();
}
