import { useRef, useState } from 'react';
import type React from 'react';

export interface SheetDrag {
  grabberProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  sheetStyle: React.CSSProperties;
  dragging: boolean;
}

const DEFAULT_THRESHOLD = 80;
/** A downward flick faster than this (px/ms) dismisses even under the distance threshold. */
const FLICK_VELOCITY = 0.5;
/** …but a flick still has to travel at least this far, so a tiny twitch never dismisses. */
const MIN_FLICK_DISTANCE = 28;

/**
 * iOS-style swipe-down-to-dismiss for a bottom sheet's grabber handle. Drag the
 * grabber down; release past `threshold` px (default 80) — or with a fast
 * downward flick — to dismiss, otherwise the sheet snaps back.
 *
 * The move/up listeners are bound SYNCHRONOUSLY in onPointerDown on the
 * pointer-captured grabber element (not via an effect that only runs after a
 * re-render — that race dropped the drag). Every sheet with a grabber uses
 * this; verify a real drag in a browser when touching it (see CLAUDE.md).
 */
export function useSheetDrag(onDismiss: () => void, opts?: { threshold?: number }): SheetDrag {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    let last = { y: e.clientY, t: e.timeStamp };
    let cur = 0;
    let vel = 0;
    let ended = false;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* not supported (older engines / test env) — window fallback still works */
    }
    setDragging(true);
    setOffset(0);

    const onMove = (ev: PointerEvent) => {
      const dt = ev.timeStamp - last.t;
      if (dt > 0) vel = (ev.clientY - last.y) / dt;
      last = { y: ev.clientY, t: ev.timeStamp };
      cur = Math.max(0, ev.clientY - startY);
      setOffset(cur);
    };
    const onEnd = () => {
      if (ended) return; // element + window listeners can both see the pointerup
      ended = true;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      setDragging(false);
      const flick = cur > MIN_FLICK_DISTANCE && vel > FLICK_VELOCITY;
      if (cur > threshold || flick) onDismissRef.current();
      else setOffset(0);
    };

    // Listen on the captured element AND window: pointer capture routes events
    // to the element, but the window listeners cover engines where capture is
    // unavailable or the element is re-parented mid-drag.
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  return {
    grabberProps: {
      onPointerDown,
      style: { touchAction: 'none', cursor: 'grab' },
    },
    sheetStyle: {
      transform: offset ? `translateY(${offset}px)` : undefined,
      transition: dragging ? 'none' : 'transform 0.2s ease',
    },
    dragging,
  };
}
