import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
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
  /** Touch/pen double-tap toggles known; mouse and keyboard stay immediate. */
  doubleTapMark?: boolean;
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
const DOUBLE_TAP_MS = 280;
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
  doubleTapMark = false,
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
  const touchInput = useRef(false);
  const secondTap = useRef(false);
  const tapTimer = useRef<number | null>(null);
  const pendingCleanup = useRef<(() => void) | null>(null);
  const nativeSelection = longPressAction === 'select';

  useEffect(() => () => {
    if (timer.current != null) clearTimeout(timer.current);
    if (tapTimer.current != null) clearTimeout(tapTimer.current);
    pendingCleanup.current?.();
  }, []);

  const cancelPendingTap = () => {
    if (tapTimer.current != null) clearTimeout(tapTimer.current);
    tapTimer.current = null;
    pendingCleanup.current?.();
    pendingCleanup.current = null;
  };

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    touchInput.current = e.pointerType === 'touch' || e.pointerType === 'pen';
    secondTap.current = touchInput.current && doubleTapMark && tapTimer.current != null;
    // Cancel immediately on the second down, not its click: it may become a
    // hold or scroll, which must never let the first tap open a panel midway.
    cancelPendingTap();
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
  const onClick = (e: ReactMouseEvent<HTMLSpanElement>) => {
    if (longPressed.current) {
      // The long press already acted (revealed gloss / marked known).
      longPressed.current = false;
      secondTap.current = false;
      cancelPendingTap();
      return;
    }
    // A drag/selection or the tap dismissing it must not open a panel and
    // move the text under the native selection handles.
    if (nativeSelection && (selectionAtStart.current || window.getSelection()?.toString())) {
      cancelPendingTap();
      secondTap.current = false;
      return;
    }
    if (doubleTapMark && onMark && touchInput.current && e.detail !== 0) {
      if (secondTap.current) {
        e.preventDefault();
        secondTap.current = false;
        onMark(token);
        return;
      }
      const element = e.currentTarget;
      // A rapid tap on a different word or UI control supersedes this tap.
      // Only a pending tap registers this listener, not every visible word.
      const cancelOutside = (event: PointerEvent) => {
        if (!element.contains(event.target as Node)) cancelPendingTap();
      };
      document.addEventListener('pointerdown', cancelOutside, true);
      document.addEventListener('scroll', cancelPendingTap, true);
      pendingCleanup.current = () => {
        document.removeEventListener('pointerdown', cancelOutside, true);
        document.removeEventListener('scroll', cancelPendingTap, true);
      };
      tapTimer.current = window.setTimeout(() => {
        cancelPendingTap();
        if (!window.getSelection()?.toString()) onSelect(token);
      }, DOUBLE_TAP_MS);
      return;
    }
    cancelPendingTap();
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
            cancelPendingTap();
            onSelect(token);
          }
        }}
        className={`token${nativeSelection ? ' selectable' : ''}${selected ? ' selected' : ''}${synClass ? ` ${synClass}` : ''}${
          known ? ' known' : ''
        }`}
        onClick={onClick}
        onDoubleClick={(e) => {
          // Prevent native double-tap word selection competing with marking.
          // Long-press remains entirely native in Select text mode.
          if (doubleTapMark && touchInput.current) e.preventDefault();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          cancelPendingTap();
          secondTap.current = false;
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
