import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { BACKUP_APP_ID, BACKUP_VERSION, applyBackup, buildBackup, parseBackup } from '@/state/backup';
import { useAppStore } from '@/state/store';

/**
 * Backup / restore: export the persisted settings + progress axes as JSON,
 * and re-apply them via the store's own setters on import. Coverage here is
 * unit-level for the parse/build/apply logic (see tests/vocab.test.ts for
 * the analogous pattern) plus a presence check that the Settings sheet
 * exposes the section and its two buttons. Driving a real `<input type=
 * "file">` change event isn't exercised — happy-dom's File/FileList wiring
 * is unreliable for this and the parse/apply path it would trigger is
 * already covered directly.
 */

beforeAll(() => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }) as Response);
});

afterEach(() => {
  act(() => {
    const s = useAppStore.getState();
    s.resetKnown();
    s.setTheme('system');
    s.setDisplayMode('original');
    s.setReadingScale(1);
    s.setSyntaxHighlight(true);
    s.setVocabMode(false);
    s.setVocabMarkLexeme(false);
    s.restorePosition('gnt', 4, 1);
    s.openPanel('none');
  });
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('buildBackup', () => {
  it('snapshots the full settings + progress shape from the live store', () => {
    act(() => {
      const s = useAppStore.getState();
      s.setDisplayMode('both');
      s.setTheme('dark');
      s.setReadingScale(1.3);
      s.setSyntaxHighlight(false);
      s.setVocabMode(true);
      s.setVocabMarkLexeme(true);
      s.markKnown('lexeme', 'grc|λόγος');
      s.markKnown('parse', 'grc|λόγος|n-nsm');
      s.restorePosition('ot', 2, 3);
    });

    const backup = buildBackup();
    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(backup.backupVersion).toBe(BACKUP_VERSION);
    expect(typeof backup.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(backup.exportedAt!))).toBe(false);
    expect(backup.settings).toEqual({
      displayMode: 'both',
      theme: 'dark',
      readingScale: 1.3,
      syntax: false,
      vocabMode: true,
      vocabMarkLexeme: true,
    });
    expect(backup.progress?.lastRef).toEqual({ testament: 'ot', bookNum: 2, chapter: 3 });
    expect(backup.progress?.knownLexemes).toEqual(['grc|λόγος']);
    expect(backup.progress?.knownParses).toEqual(['grc|λόγος|n-nsm']);
  });
});

describe('parseBackup', () => {
  it('rejects invalid JSON', () => {
    const r = parseBackup('{not json');
    expect(r.ok).toBe(false);
  });

  it('rejects junk with no recognizable shape', () => {
    const r = parseBackup(JSON.stringify([1, 2, 3]));
    expect(r.ok).toBe(false);
  });

  it('rejects the wrong app literal', () => {
    const r = parseBackup(JSON.stringify({ app: 'some-other-app', backupVersion: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a GNT Reader backup/i);
  });

  it('rejects an incompatible backupVersion', () => {
    const r = parseBackup(JSON.stringify({ app: BACKUP_APP_ID, backupVersion: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/incompatible version/i);
  });

  it('rejects wrong field types', () => {
    const r = parseBackup(
      JSON.stringify({ app: BACKUP_APP_ID, backupVersion: 1, settings: { theme: 12345 } }),
    );
    expect(r.ok).toBe(false);
  });

  it('accepts a minimal valid file and tolerates missing optional fields', () => {
    const r = parseBackup(JSON.stringify({ app: BACKUP_APP_ID, backupVersion: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.settings).toBeUndefined();
      expect(r.backup.progress).toBeUndefined();
    }
  });

  it('accepts a full valid file and drops unknown extra keys', () => {
    const raw = {
      app: BACKUP_APP_ID,
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { displayMode: 'gloss', extraJunk: 'ignored' },
      progress: { knownLexemes: ['a'], knownParses: [], somethingElse: 42 },
      topLevelJunk: true,
    };
    const r = parseBackup(JSON.stringify(raw));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.settings?.displayMode).toBe('gloss');
      expect(r.backup.progress?.knownLexemes).toEqual(['a']);
      expect(Object.keys(r.backup)).not.toContain('topLevelJunk');
      expect(Object.keys(r.backup.settings ?? {})).not.toContain('extraJunk');
      expect(Object.keys(r.backup.progress ?? {})).not.toContain('somethingElse');
    }
  });
});

describe('applyBackup', () => {
  it('round-trips: export, mutate the store, import, and match the original snapshot', () => {
    act(() => {
      const s = useAppStore.getState();
      s.setDisplayMode('gloss');
      s.setTheme('light');
      s.markKnown('lexeme', 'grc|ἀγάπη');
      s.markKnown('parse', 'grc|ἀγάπη|n-nsf');
    });
    const backup = buildBackup();

    act(() => {
      const s = useAppStore.getState();
      s.setDisplayMode('original');
      s.setTheme('dark');
      s.resetKnown();
      s.markKnown('lexeme', 'grc|ξένος'); // pollute before import
    });
    expect(useAppStore.getState().displayMode).toBe('original');

    act(() => {
      applyBackup(backup);
    });

    const s = useAppStore.getState();
    expect(s.displayMode).toBe('gloss');
    expect(s.theme).toBe('light');
    // setTheme's DOM side effect ran too, not just the in-memory field.
    expect(document.documentElement.dataset.theme).toBe('light');
    expect([...s.knownLexemes]).toEqual(['grc|ἀγάπη']);
    expect([...s.knownParses]).toEqual(['grc|ἀγάπη|n-nsf']);
  });

  it('only touches fields present in the file, and only replaces known-word sets that are present', () => {
    act(() => {
      const s = useAppStore.getState();
      s.setTheme('dark');
      s.setVocabMode(true);
      s.markKnown('lexeme', 'grc|φῶς');
      s.markKnown('parse', 'grc|φῶς|n-nsn');
    });
    const beforeParses = [...useAppStore.getState().knownParses];

    act(() => {
      applyBackup({
        app: BACKUP_APP_ID,
        backupVersion: BACKUP_VERSION,
        settings: { displayMode: 'both' }, // theme/vocabMode omitted
        progress: { knownLexemes: ['grc|καινός'] }, // knownParses omitted
      });
    });

    const s = useAppStore.getState();
    expect(s.displayMode).toBe('both');
    expect(s.theme).toBe('dark'); // untouched
    expect(s.vocabMode).toBe(true); // untouched
    expect([...s.knownLexemes]).toEqual(['grc|καινός']); // replaced wholesale
    expect([...s.knownParses]).toEqual(beforeParses); // untouched
  });
});

describe('settings sheet: Backup section', () => {
  it('renders before Install app?/About, with export and import buttons', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });

    const headings = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    // Backup is followed only by the conditional "Install app" section and
    // the final "About" section — nothing else comes after it.
    const backupIndex = headings.indexOf('Backup');
    expect(backupIndex).toBeGreaterThan(-1);
    expect(headings.slice(backupIndex + 1).every((h) => h === 'Install app' || h === 'About')).toBe(
      true,
    );
    expect(headings[headings.length - 1]).toBe('About');

    expect(within(dialog).getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import backup' })).toBeInTheDocument();
  });
});
