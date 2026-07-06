import { create } from 'zustand';
import { z } from 'zod';
import type { ReadingToken, Testament } from '@/domain/schema';
import type { SearchQuery } from '@/search/morphology';

/**
 * App state. Small and flat; chapter data itself lives in the loader caches
 * (src/io/sources.ts + IndexedDB), not here. Position and display mode
 * persist to localStorage (docs/config.md).
 */

export type DisplayMode = 'original' | 'gloss' | 'both';

const PositionSchema = z.object({
  testament: z.enum(['gnt', 'ot']),
  bookNum: z.number().int().positive(),
  chapter: z.number().int().positive(),
});

const DisplayModeSchema = z.enum(['original', 'gloss', 'both']);

export type ThemeChoice = 'system' | 'light' | 'dark';
const ThemeSchema = z.enum(['system', 'light', 'dark']);

const POSITION_KEY = 'gr:lastRef';
const MODE_KEY = 'gr:displayMode';
const THEME_KEY = 'gr:theme';
const SCALE_KEY = 'gr:readingScale';
const SYNTAX_KEY = 'gr:syntax';

/** Reading font-size multiplier bounds (settings; iOS-safe — CSS var, not zoom). */
export const READING_SCALE_MIN = 0.8;
export const READING_SCALE_MAX = 1.8;
export const READING_SCALE_STEP = 0.1;

function clampScale(n: number): number {
  const r = Math.round(n * 10) / 10;
  return Math.min(READING_SCALE_MAX, Math.max(READING_SCALE_MIN, r));
}

function loadPosition(): z.infer<typeof PositionSchema> {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) return PositionSchema.parse(JSON.parse(raw));
  } catch {
    /* fall through to default */
  }
  return { testament: 'gnt', bookNum: 4, chapter: 1 }; // John 1 (bundled fixture)
}

function loadMode(): DisplayMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw) return DisplayModeSchema.parse(raw);
  } catch {
    /* fall through to default */
  }
  return 'original';
}

function loadTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) return ThemeSchema.parse(raw);
  } catch {
    /* fall through to default */
  }
  return 'system';
}

function loadScale(): number {
  try {
    const raw = localStorage.getItem(SCALE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampScale(n);
    }
  } catch {
    /* fall through to default */
  }
  return 1;
}

function loadSyntax(): boolean {
  try {
    // Default ON — the highlight is only shown for a tapped word.
    return localStorage.getItem(SYNTAX_KEY) !== 'off';
  } catch {
    return true;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — persistence is best-effort */
  }
}

/**
 * Reflect the theme choice onto the root element: an explicit `data-theme`
 * override wins over the `prefers-color-scheme` media query; 'system' removes
 * it so the OS setting is followed. See src/styles.css.
 */
export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Reflect the reading scale onto the root as the `--reading-scale` variable. */
export function applyReadingScale(scale: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--reading-scale', String(scale));
}

export type PanelView = 'none' | 'picker' | 'search' | 'strongs' | 'settings';

interface AppState {
  testament: Testament;
  bookNum: number;
  chapter: number;
  /** Verse to scroll to after a navigation (search click-through). */
  targetVerse: number | null;
  displayMode: DisplayMode;
  theme: ThemeChoice;
  /** Reading font-size multiplier (applied via CSS var, not viewport zoom). */
  readingScale: number;
  /** Highlight a tapped word's clause, coloured by grammatical role. */
  syntaxHighlight: boolean;
  selectedToken: ReadingToken | null;
  panel: PanelView;
  /** Prefill for the Strong's panel (detail-panel click-through). */
  strongsQuery: string;
  /** One-shot prefill for the search panel ("find occurrences"). */
  searchPrefill: SearchQuery | null;

  navigate(testament: Testament, bookNum: number, chapter: number, verse?: number): void;
  clearTargetVerse(): void;
  setDisplayMode(mode: DisplayMode): void;
  setTheme(theme: ThemeChoice): void;
  setReadingScale(scale: number): void;
  setSyntaxHighlight(on: boolean): void;
  selectToken(token: ReadingToken | null): void;
  openPanel(panel: PanelView): void;
  openStrongs(query: string): void;
  openSearch(prefill?: SearchQuery): void;
  openSettings(): void;
  consumeSearchPrefill(): void;
}

const initial = loadPosition();

export const useAppStore = create<AppState>((set) => ({
  testament: initial.testament,
  bookNum: initial.bookNum,
  chapter: initial.chapter,
  targetVerse: null,
  displayMode: loadMode(),
  theme: loadTheme(),
  readingScale: loadScale(),
  syntaxHighlight: loadSyntax(),
  selectedToken: null,
  panel: 'none',
  strongsQuery: '',
  searchPrefill: null,

  navigate(testament, bookNum, chapter, verse) {
    safeSet(POSITION_KEY, JSON.stringify({ testament, bookNum, chapter }));
    set({
      testament,
      bookNum,
      chapter,
      targetVerse: verse ?? null,
      panel: 'none',
      // Keep the selection when it lives in the destination chapter (gloss
      // toggles and search click-through must not lose it).
      ...(verse === undefined ? { selectedToken: null } : {}),
    });
  },
  clearTargetVerse: () => set({ targetVerse: null }),
  setDisplayMode(mode) {
    safeSet(MODE_KEY, mode);
    set({ displayMode: mode });
  },
  setTheme(theme) {
    safeSet(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  setReadingScale(scale) {
    const s = clampScale(scale);
    safeSet(SCALE_KEY, String(s));
    applyReadingScale(s);
    set({ readingScale: s });
  },
  setSyntaxHighlight(on) {
    safeSet(SYNTAX_KEY, on ? 'on' : 'off');
    set({ syntaxHighlight: on });
  },
  selectToken: (token) => set({ selectedToken: token }),
  openPanel: (panel) => set({ panel }),
  openStrongs: (query) => set({ panel: 'strongs', strongsQuery: query }),
  openSearch: (prefill) => set({ panel: 'search', searchPrefill: prefill ?? null }),
  openSettings: () => set({ panel: 'settings' }),
  consumeSearchPrefill: () => set({ searchPrefill: null }),
}));
