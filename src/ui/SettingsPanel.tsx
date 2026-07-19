import { useEffect, useRef, useState } from 'react';
import { useInstallPrompt } from '@/pwa/install';
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
import { KnownWordsModal } from './KnownWordsModal';

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
  const vocabMode = useAppStore((s) => s.vocabMode);
  const setVocabMode = useAppStore((s) => s.setVocabMode);
  const vocabMarkLexeme = useAppStore((s) => s.vocabMarkLexeme);
  const setVocabMarkLexeme = useAppStore((s) => s.setVocabMarkLexeme);
  const resetKnown = useAppStore((s) => s.resetKnown);
  const knownCount = useAppStore((s) => s.knownLexemes.size + s.knownParses.size);
  const [showKnown, setShowKnown] = useState(false);
  const { status, updateAvailable, checkForUpdate, clearCachesAndReload } = usePwa();
  const { canInstall, isStandalone, isIos, promptInstall } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);
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
    <>
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
          <section className="settings-section about-author">
            <h3>About the author</h3>
            <p className="settings-note">
              GNT Reader is maintained by Timothy Hutama, an MTS student at Wycliffe College. The
              author makes no guarantees about the content but has made a best attempt to make
              sure everything is accurate.
            </p>
            <p className="settings-note">
              Timothy blogs at{' '}
              <a href="https://definedfaith.wordpress.com/" target="_blank" rel="noopener noreferrer">
                definedfaith.wordpress.com
              </a>
              .
            </p>
            <p className="settings-note">
              If you have comments or issues, please reach out on{' '}
              <a href="https://www.linkedin.com/in/timothyhutama/" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              .
            </p>
            <div className="settings-note">
              <span>Other projects by Timothy:</span>
              <ul className="about-links">
                <li>
                  <a
                    href="https://hutima.github.io/Lectio-Memorization/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bible &amp; catechism memorization
                  </a>
                </li>
                <li>
                  <a
                    href="https://hutima.github.io/ScriptureDiagrammer/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Scripture Diagrammer
                  </a>
                </li>
                <li>
                  <a
                    href="https://hutima.github.io/PCA_Ordination_Study/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    PCA ordination study
                  </a>
                </li>
              </ul>
            </div>
            <p className="settings-note">
              If you&apos;d like to buy me a coffee as thanks, you can send a gift via e-transfer
              to <a href="mailto:t.hutama@queensu.ca">t.hutama@queensu.ca</a> or Venmo at{' '}
              <strong>@hutima</strong>.
            </p>
            {!isStandalone && (canInstall || isIos) && (
              <div className="settings-row">
                <div className="label">
                  <span>Install this app</span>
                  <small>Works offline, opens full screen.</small>
                </div>
                <button
                  type="button"
                  className="mini"
                  onClick={() => (canInstall ? void promptInstall() : setShowIosHelp((v) => !v))}
                >
                  {canInstall ? 'Install' : 'How to install'}
                </button>
              </div>
            )}
            {!isStandalone && !canInstall && isIos && showIosHelp && (
              <p className="settings-note">
                Tap the Share button, then &quot;Add to Home Screen&quot;, then Add.
              </p>
            )}
          </section>

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
            <h3>Vocabulary</h3>
            <p className="settings-note">
              In Both mode, hide the gloss under words you&apos;ve marked known, so only the words
              you&apos;re still learning keep a gloss. Mark words (or a single form) from a word&apos;s
              detail panel.
            </p>
            <div className="settings-row">
              <div className="label">
                <span>Vocabulary mode</span>
                <small>Hide glosses for known words (Both mode)</small>
              </div>
              <div className="segmented" role="group" aria-label="Vocabulary mode">
                <button
                  type="button"
                  aria-pressed={!vocabMode}
                  className={!vocabMode ? 'on' : ''}
                  onClick={() => setVocabMode(false)}
                >
                  Off
                </button>
                <button
                  type="button"
                  aria-pressed={vocabMode}
                  className={vocabMode ? 'on' : ''}
                  onClick={() => setVocabMode(true)}
                >
                  On
                </button>
              </div>
            </div>
            {vocabMode && (
              <div className="settings-row">
                <div className="label">
                  <span>Long-press marks</span>
                  <small>Tap-hold a word in Gloss/Both mode to mark it known</small>
                </div>
                <div className="segmented" role="group" aria-label="Long-press marks">
                  <button
                    type="button"
                    aria-pressed={!vocabMarkLexeme}
                    className={!vocabMarkLexeme ? 'on' : ''}
                    onClick={() => setVocabMarkLexeme(false)}
                  >
                    This form
                  </button>
                  <button
                    type="button"
                    aria-pressed={vocabMarkLexeme}
                    className={vocabMarkLexeme ? 'on' : ''}
                    onClick={() => setVocabMarkLexeme(true)}
                  >
                    Whole word
                  </button>
                </div>
              </div>
            )}
            <div className="settings-actions">
              <button
                type="button"
                className="mini"
                disabled={knownCount === 0}
                onClick={() => setShowKnown(true)}
              >
                Known words{knownCount > 0 ? ` (${knownCount})` : ''}
              </button>
              <button
                type="button"
                className="mini reject"
                disabled={knownCount === 0}
                onClick={() => resetKnown()}
              >
                Reset
              </button>
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
      {showKnown && <KnownWordsModal onClose={() => setShowKnown(false)} />}
    </>
  );
}
