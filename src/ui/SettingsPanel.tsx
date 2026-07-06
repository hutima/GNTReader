import { useEffect, useRef, useState } from 'react';
import { usePwa } from '@/pwa/pwa';
import { downloadAllScripture, type DownloadResult } from '@/io/download';
import {
  READING_SCALE_MAX,
  READING_SCALE_MIN,
  READING_SCALE_STEP,
  useAppStore,
  type ThemeChoice,
} from '@/state/store';
import { useSheetDrag } from './useSheetDrag';

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const STATUS_LABEL: Record<string, string> = {
  idle: '',
  checking: 'Checking for updates…',
  uptodate: 'You have the latest version.',
  error: 'Service worker unavailable in this context.',
};

interface DlState {
  done: number;
  total: number;
  label: string;
}

/**
 * Settings sheet (opened from the header ⚙️): appearance (theme override +
 * reading size), offline download of the whole corpus, the Strong's lexicon
 * entry point, and the app update / cache utilities.
 */
export function SettingsPanel() {
  const openPanel = useAppStore((s) => s.openPanel);
  const openStrongs = useAppStore((s) => s.openStrongs);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const readingScale = useAppStore((s) => s.readingScale);
  const setReadingScale = useAppStore((s) => s.setReadingScale);
  const syntaxHighlight = useAppStore((s) => s.syntaxHighlight);
  const setSyntaxHighlight = useAppStore((s) => s.setSyntaxHighlight);
  const { status, updateAvailable, checkForUpdate, clearCachesAndReload } = usePwa();
  const { grabberProps, sheetStyle } = useSheetDrag(() => openPanel('none'));

  const [dl, setDl] = useState<DlState | null>(null);
  const [dlResult, setDlResult] = useState<DownloadResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runDownload() {
    abortRef.current = new AbortController();
    setDlResult(null);
    setDl({ done: 0, total: 0, label: '' });
    const res = await downloadAllScripture({
      signal: abortRef.current.signal,
      onProgress: (p) => setDl({ done: p.done, total: p.total, label: p.label }),
    });
    setDl(null);
    setDlResult(res);
  }

  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const pct = Math.round(readingScale * 100);
  const statusLabel = STATUS_LABEL[status] ?? '';

  return (
    <div className="sheet-backdrop" onClick={() => openPanel('none')}>
      <section
        className="panel-sheet"
        role="dialog"
        aria-label="Settings"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grabber" {...grabberProps} />
        <div className="settings">
          <section className="settings-section">
            <h3>Appearance</h3>
            <div className="settings-row">
              <div className="label">
                <span>Theme</span>
              </div>
              <div className="segmented" role="tablist" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={theme === t.id}
                    className={theme === t.id ? 'on' : ''}
                    onClick={() => setTheme(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="label">
                <span>Reading size</span>
                <small>Scales the scripture text</small>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="Decrease reading size"
                  disabled={readingScale <= READING_SCALE_MIN}
                  onClick={() => setReadingScale(readingScale - READING_SCALE_STEP)}
                >
                  A−
                </button>
                <span className="value" aria-live="polite">
                  {pct}%
                </span>
                <button
                  type="button"
                  aria-label="Increase reading size"
                  disabled={readingScale >= READING_SCALE_MAX}
                  onClick={() => setReadingScale(readingScale + READING_SCALE_STEP)}
                >
                  A+
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div className="label">
                <span>Syntax highlight</span>
                <small>Tint a tapped word&apos;s clause by grammatical role</small>
              </div>
              <div className="segmented" role="group" aria-label="Syntax highlight">
                <button
                  type="button"
                  aria-pressed={!syntaxHighlight}
                  className={!syntaxHighlight ? 'on' : ''}
                  onClick={() => setSyntaxHighlight(false)}
                >
                  Off
                </button>
                <button
                  type="button"
                  aria-pressed={syntaxHighlight}
                  className={syntaxHighlight ? 'on' : ''}
                  onClick={() => setSyntaxHighlight(true)}
                >
                  On
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3>Offline reading</h3>
            <p className="settings-note">
              Download the entire Greek New Testament and Hebrew Old Testament to this device so it
              works with no connection. This can take a few minutes and use tens of MB.
            </p>
            {dl ? (
              <>
                <div className="progress" role="status">
                  <progress value={dl.done} max={dl.total || 1} />{' '}
                  {dl.total ? Math.round((dl.done / dl.total) * 100) : 0}%
                  {dl.label ? ` · ${dl.label}` : ''}
                </div>
                <div className="settings-actions">
                  <button type="button" className="mini reject" onClick={() => abortRef.current?.abort()}>
                    Stop
                  </button>
                </div>
              </>
            ) : (
              <div className="settings-actions">
                <button type="button" className="mini accept" onClick={() => void runDownload()}>
                  Download all scripture
                </button>
              </div>
            )}
            {dlResult && (
              <p className="status-line">
                {dlResult.aborted ? 'Stopped' : 'Done'} — {dlResult.completed}/{dlResult.total}{' '}
                chapters cached
                {dlResult.failed.length > 0 ? ` · ${dlResult.failed.length} unavailable` : ''}.
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3>Reference</h3>
            <div className="settings-actions">
              <button type="button" className="mini" onClick={() => openStrongs('')}>
                Browse Strong’s lexicon
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3>App updates &amp; cache</h3>
            <p className="settings-note">
              A new version installs in the background and is applied only when you choose. If
              something looks stale or broken, check for an update or clear the cache.
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="mini"
                disabled={busy !== null}
                onClick={() => run('check', checkForUpdate)}
              >
                {busy === 'check' ? 'Checking…' : 'Check for updates'}
              </button>
              <button
                type="button"
                className="mini reject"
                disabled={busy !== null}
                onClick={() => run('reset', clearCachesAndReload)}
                title="Unregister the service worker, delete all caches, and reload from the network"
              >
                {busy === 'reset' ? 'Clearing…' : 'Clear cache & reload'}
              </button>
            </div>
            {updateAvailable && <p className="status-line">An update is ready — see the prompt.</p>}
            {statusLabel && <p className="status-line">{statusLabel}</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
