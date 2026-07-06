import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ReadingToken } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { displayGloss } from './morph';

interface Props {
  token: ReadingToken;
  mode: DisplayMode;
  selected: boolean;
  onSelect(token: ReadingToken): void;
}

/**
 * The source `after` attribute is a bare separator: " " (word break), Greek
 * punctuation (· , . ; ’ — a space follows it in running text), Hebrew maqqef
 * "־" (joins the next word, NO space) or sof pasuq "׃". Absent/empty means
 * the next morpheme joins directly (Hebrew prefixes).
 */
function afterParts(after: string | undefined): { mark: string; space: boolean } {
  if (!after) return { mark: '', space: false };
  if (after === ' ') return { mark: '', space: true };
  return { mark: after, space: after !== '־' };
}

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;

/**
 * One tappable token. A tap opens the detail panel; a tap-hold (long press)
 * reveals just the English gloss in a transient bubble without opening the
 * panel. `after` renders OUTSIDE the tappable area so the highlight hugs the
 * word. Gloss mode replaces the surface; both mode stacks the gloss underneath.
 */
export function TokenSpan({ token, mode, selected, onSelect }: Props) {
  const { mark, space } = afterParts(token.after);
  const surface = <span className={token.language}>{token.surface}</span>;

  const [showGloss, setShowGloss] = useState(false);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    longPressed.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setShowGloss(true);
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    // A drag means the user is scrolling — cancel the pending long press.
    if (
      start.current &&
      (Math.abs(e.clientX - start.current.x) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - start.current.y) > MOVE_CANCEL_PX)
    ) {
      clearTimer();
    }
  };
  const endPress = () => {
    clearTimer();
    setShowGloss(false);
  };
  const onClick = () => {
    if (longPressed.current) {
      // The long press already revealed the gloss; don't also open the panel.
      longPressed.current = false;
      return;
    }
    onSelect(token);
  };

  return (
    <>
      <button
        type="button"
        className={`token${selected ? ' selected' : ''}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        {mode === 'original' && surface}
        {mode === 'gloss' && <span className="token-gloss">{displayGloss(token)}</span>}
        {mode === 'both' && (
          <span className="token-stack">
            {surface}
            <span className="token-gloss under">{displayGloss(token)}</span>
          </span>
        )}
        {showGloss && (
          <span className="gloss-bubble" role="tooltip">
            {displayGloss(token)}
          </span>
        )}
      </button>
      {mark && <span className={`after ${token.language}`}>{mark}</span>}
      {space && ' '}
    </>
  );
}
