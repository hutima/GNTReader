import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ReadingToken } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { displayGloss } from './morph';

interface Props {
  token: ReadingToken;
  mode: DisplayMode;
  selected: boolean;
  /** Syntax-role highlight class when this token is in the selected clause. */
  synClass?: string;
  /** Vocabulary mode: the reader has marked this word known — hide its gloss. */
  known?: boolean;
  /** Default: native text selection. Opt-in: reveal gloss / mark known. */
  longPressAction?: 'select' | 'gloss' | 'mark';
  onMark?(token: ReadingToken): void;
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
 * Tap opens word details and syntax highlighting. Default hold lets the
 * browser select native text; legacy hold-to-mark/gloss is opt-in. Use an
 * inline span with keyboard button semantics: native buttons are selection
 * boundaries on mobile browsers. Punctuation stays outside the tap target.
 */
export function TokenSpan({
  token,
  mode,
  selected,
  synClass,
  known,
  longPressAction = 'select',
  onMark,
  onSelect,
}: Props) {
  const { mark, space } = afterParts(token.after);
  const surface = <span className={token.language}>{token.surface}</span>;

  const [showGloss, setShowGloss] = useState(false);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const selectionAtStart = useRef(false);
  const nativeSelection = longPressAction === 'select';

  useEffect(() => () => {
    if (timer.current != null) clearTimeout(timer.current);
  }, []);

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    longPressed.current = false;
    selectionAtStart.current = nativeSelection && Boolean(window.getSelection()?.toString());
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (longPressAction === 'mark') onMark?.(token);
      else if (longPressAction === 'gloss') setShowGloss(true);
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
      longPressed.current = true;
    }
  };
  const endPress = () => {
    clearTimer();
    setShowGloss(false);
  };
  const onClick = () => {
    if (longPressed.current) {
      // The long press already acted (revealed gloss / marked known).
      longPressed.current = false;
      return;
    }
    // A drag/selection or the tap dismissing it must not open a panel and
    // move the text under the native selection handles.
    if (nativeSelection && (selectionAtStart.current || window.getSelection()?.toString())) return;
    onSelect(token);
  };

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(token);
          }
        }}
        className={`token${nativeSelection ? ' selectable' : ''}${selected ? ' selected' : ''}${synClass ? ` ${synClass}` : ''}${
          known ? ' known' : ''
        }`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          if (!nativeSelection) e.preventDefault();
          else {
            clearTimer();
            longPressed.current = true;
          }
        }}
      >
        {mode === 'original' && surface}
        {mode === 'gloss' && <span className="token-gloss">{displayGloss(token)}</span>}
        {/* Both mode: known words keep the stack slot but drop the gloss, so
            their surface stays aligned with the glossed words on the same row. */}
        {mode === 'both' && (
          <span className="token-stack">
            {surface}
            {!known && <span className="token-gloss under">{displayGloss(token)}</span>}
          </span>
        )}
        {showGloss && (
          <span className="gloss-bubble" role="tooltip">
            {displayGloss(token)}
          </span>
        )}
      </span>
      {mark && <span className={`after ${token.language}`}>{mark}</span>}
      {space && ' '}
    </>
  );
}
