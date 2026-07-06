import { usePwa } from './pwa/pwa';

export default function App() {
  const pwa = usePwa();
  return (
    <div className="app">
      <header className="header">
        <h1 className="brand">GNT Reader</h1>
        {pwa.offline && <span className="badge">offline</span>}
        {pwa.updateAvailable && (
          <button className="badge badge-action" onClick={pwa.acceptRefreshAvailable}>
            Refresh now
          </button>
        )}
      </header>
      <main className="reader">
        <p className="placeholder">Bootstrap shell — reader arrives in Phase 3.</p>
      </main>
    </div>
  );
}
