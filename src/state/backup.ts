import { z } from 'zod';
import { TestamentSchema } from '@/domain/schema';
import { useAppStore, type DisplayMode, type ThemeChoice } from './store';

/**
 * Backup / restore: a JSON snapshot of the persisted `gr:*` axes (see
 * docs/config.md) so a reader can move their settings and known-words
 * progress between devices or recover after clearing site data. Values are
 * read from (and applied to) the live zustand store, not raw localStorage,
 * so in-memory state — and its side effects (theme/reading-scale DOM
 * application, persistence) — stay the source of truth.
 */

export const BACKUP_APP_ID = 'gnt-reader' as const;
export const BACKUP_VERSION = 1 as const;

const DisplayModeSchema = z.enum(['original', 'gloss', 'both']);
const ThemeSchema = z.enum(['system', 'light', 'dark']);

const PositionSchema = z.object({
  testament: TestamentSchema,
  bookNum: z.number().int().positive(),
  chapter: z.number().int().positive(),
});

const SettingsSchema = z.object({
  displayMode: DisplayModeSchema.optional(),
  theme: ThemeSchema.optional(),
  readingScale: z.number().finite().positive().optional(),
  syntax: z.boolean().optional(),
  vocabMode: z.boolean().optional(),
  vocabMarkLexeme: z.boolean().optional(),
});

const ProgressSchema = z.object({
  lastRef: PositionSchema.optional(),
  knownLexemes: z.array(z.string()).optional(),
  knownParses: z.array(z.string()).optional(),
});

// Unknown top-level/nested keys are silently dropped (zod's default,
// non-strict object behaviour) — lenient on extras, forward-compatible.
export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  backupVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  settings: SettingsSchema.optional(),
  progress: ProgressSchema.optional(),
});

export type BackupFile = z.infer<typeof BackupSchema>;

/** Snapshot the live store into the backup shape. */
export function buildBackup(): BackupFile {
  const s = useAppStore.getState();
  return {
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      displayMode: s.displayMode,
      theme: s.theme,
      readingScale: s.readingScale,
      syntax: s.syntaxHighlight,
      vocabMode: s.vocabMode,
      vocabMarkLexeme: s.vocabMarkLexeme,
    },
    progress: {
      // The visible (scrolled-to) chapter, not just the last navigated one —
      // a long continuous-scroll session should resume where it was reading,
      // not snap back to the chapter it happened to have last tapped (FL-008).
      lastRef: { testament: s.testament, bookNum: s.bookNum, chapter: s.visibleChapter },
      knownLexemes: [...s.knownLexemes],
      knownParses: [...s.knownParses],
    },
  };
}

export type ParseBackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Validate untrusted JSON text against the backup shape. Never throws. */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues;
    if (issues.some((i) => i.path[0] === 'app')) {
      return { ok: false, error: 'That file is not a GNT Reader backup.' };
    }
    if (issues.some((i) => i.path[0] === 'backupVersion')) {
      return { ok: false, error: 'This backup was made by an incompatible version of GNT Reader.' };
    }
    const first = issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    return { ok: false, error: `Backup file is not valid${where}: ${first?.message ?? 'unknown error'}.` };
  }
  return { ok: true, backup: result.data };
}

export interface ApplyBackupSummary {
  /** Count of known lexemes/parses restored, or null if that field was absent from the file. */
  knownLexemes: number | null;
  knownParses: number | null;
}

/**
 * Apply a validated backup via the store's own setters, so side effects
 * (theme/reading-scale DOM application, localStorage persistence) run just
 * as they would from the UI. Only fields present in the file are touched —
 * import never wipes settings/progress the file doesn't mention. Known-word
 * arrays, when present, replace the corresponding set wholesale.
 */
export function applyBackup(backup: BackupFile): ApplyBackupSummary {
  const s = useAppStore.getState();
  const settings = backup.settings;
  if (settings) {
    if (settings.displayMode !== undefined) s.setDisplayMode(settings.displayMode as DisplayMode);
    if (settings.theme !== undefined) s.setTheme(settings.theme as ThemeChoice);
    if (settings.readingScale !== undefined) s.setReadingScale(settings.readingScale);
    if (settings.syntax !== undefined) s.setSyntaxHighlight(settings.syntax);
    if (settings.vocabMode !== undefined) s.setVocabMode(settings.vocabMode);
    if (settings.vocabMarkLexeme !== undefined) s.setVocabMarkLexeme(settings.vocabMarkLexeme);
  }

  const progress = backup.progress;
  const summary: ApplyBackupSummary = { knownLexemes: null, knownParses: null };
  if (progress) {
    if (progress.lastRef) {
      s.restorePosition(progress.lastRef.testament, progress.lastRef.bookNum, progress.lastRef.chapter);
    }
    if (progress.knownLexemes !== undefined || progress.knownParses !== undefined) {
      const cur = useAppStore.getState();
      const lexemes = progress.knownLexemes ?? [...cur.knownLexemes];
      const parses = progress.knownParses ?? [...cur.knownParses];
      s.restoreKnown(lexemes, parses);
      if (progress.knownLexemes !== undefined) summary.knownLexemes = lexemes.length;
      if (progress.knownParses !== undefined) summary.knownParses = parses.length;
    }
  }
  return summary;
}
