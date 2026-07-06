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

const POSITION_KEY = 'gr:lastRef';
const MODE_KEY = 'gr:displayMode';

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

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — persistence is best-effort */
  }
}

export type PanelView = 'none' | 'picker' | 'search' | 'strongs';

interface AppState {
  testament: Testament;
  bookNum: number;
  chapter: number;
  /** Verse to scroll to after a navigation (search click-through). */
  targetVerse: number | null;
  displayMode: DisplayMode;
  selectedToken: ReadingToken | null;
  panel: PanelView;
  /** Prefill for the Strong's panel (detail-panel click-through). */
  strongsQuery: string;
  /** One-shot prefill for the search panel ("find occurrences"). */
  searchPrefill: SearchQuery | null;

  navigate(testament: Testament, bookNum: number, chapter: number, verse?: number): void;
  clearTargetVerse(): void;
  setDisplayMode(mode: DisplayMode): void;
  selectToken(token: ReadingToken | null): void;
  openPanel(panel: PanelView): void;
  openStrongs(query: string): void;
  openSearch(prefill?: SearchQuery): void;
  consumeSearchPrefill(): void;
}

const initial = loadPosition();

export const useAppStore = create<AppState>((set) => ({
  testament: initial.testament,
  bookNum: initial.bookNum,
  chapter: initial.chapter,
  targetVerse: null,
  displayMode: loadMode(),
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
  selectToken: (token) => set({ selectedToken: token }),
  openPanel: (panel) => set({ panel }),
  openStrongs: (query) => set({ panel: 'strongs', strongsQuery: query }),
  openSearch: (prefill) => set({ panel: 'search', searchPrefill: prefill ?? null }),
  consumeSearchPrefill: () => set({ searchPrefill: null }),
}));
