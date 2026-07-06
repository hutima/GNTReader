import { useState } from 'react';
import { usePwa } from '@/pwa/pwa';

/**
 * Mandatory service-worker update overlay. When a new worker is waiting this
 * blocks the app until the user taps "Refresh now" (or cold-restarts) — the
 * waiting worker never activates on its own this session (ADR-0001, FL-001),
 * so there is no auto-reload to race. The check-for-updates / clear-cache
 * utilities live in Settings.
 */
export function UpdateModal() {
  const { updateAvailable, acceptRefreshAvailable } = usePwa();
  const [busy, setBusy] = useState(false);

  if (!updateAvailable) return null;

  return (
    <div className="modal-backdrop" data-mandatory="true">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updateAvailableTitle"
      >
        <h2 className="modal-title" id="updateAvailableTitle">
          Update available
        </h2>
        <p className="hint">
          A new version of GNT Reader is ready. Tap <strong>Refresh now</strong> to update — or
          just close the app fully and reopen it. Your reading position and any downloaded
          scripture stay on this device.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="mini accept"
            onClick={() => {
              setBusy(true);
              acceptRefreshAvailable();
            }}
          >
            {busy ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>
    </div>
  );
}
