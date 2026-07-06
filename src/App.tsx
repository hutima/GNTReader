import { bookInfo } from '@/io/books';
import { useAppStore } from '@/state/store';
import { usePwa } from '@/pwa/pwa';
import { BookPicker } from '@/ui/BookPicker';
import { DetailPanel } from '@/ui/DetailPanel';
import { Reader } from '@/ui/Reader';

const MODES = [
  { id: 'original', label: 'Original' },
  { id: 'gloss', label: 'Gloss' },
  { id: 'both', label: 'Both' },
] as const;

export default function App() {
  const { testament, bookNum, chapter, displayMode, panel } = useAppStore();
  const setDisplayMode = useAppStore((s) => s.setDisplayMode);
  const openPanel = useAppStore((s) => s.openPanel);
  const pwa = usePwa();

  const book = bookInfo(testament, bookNum);

  return (
    <div className="app">
      <header className="header">
        <button
          type="button"
          className="title-button"
          onClick={() => openPanel(panel === 'picker' ? 'none' : 'picker')}
          aria-haspopup="dialog"
        >
          {book ? `${book.name} ${chapter}` : 'GNT Reader'} <span className="chev">▾</span>
        </button>
        <div className="header-spacer" />
        <div className="segmented compact" role="tablist" aria-label="Display mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={displayMode === m.id}
              className={displayMode === m.id ? 'on' : ''}
              onClick={() => setDisplayMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {pwa.offline && <span className="badge">offline</span>}
        {pwa.updateAvailable && (
          <button type="button" className="badge badge-action" onClick={pwa.acceptRefreshAvailable}>
            Refresh now
          </button>
        )}
      </header>

      <div className="content">
        <Reader />
        <DetailPanel />
      </div>

      {panel === 'picker' && <BookPicker />}
    </div>
  );
}
