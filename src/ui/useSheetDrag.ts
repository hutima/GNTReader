import { useEffect, useRef, useState } from 'react';
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

/**
 * iOS-style swipe-down-to-dismiss for a bottom sheet's grabber handle.
 * Drag the grabber down; release past `threshold` px (default 80) — or with
 * a fast downward flick — to dismiss, otherwise the sheet snaps back.
 */
export function useSheetDrag(onDismiss: () => void, opts?: { threshold?: number }): SheetDrag {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Refs so the window-listener effect below doesn't need to re-attach on
  // every pixel of movement, and so pointerup/cancel always see the latest
  // values (the effect's closure is keyed on `dragging`, not `offset`).
  const startYRef = useRef(0);
  const offsetRef = useRef(0);
  const lastMoveRef = useRef({ y: 0, t: 0 });
  const velocityRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e: PointerEvent) => {
      const dt = e.timeStamp - lastMoveRef.current.t;
      if (dt > 0) {
        velocityRef.current = (e.clientY - lastMoveRef.current.y) / dt;
      }
      lastMoveRef.current = { y: e.clientY, t: e.timeStamp };
      const next = Math.max(0, e.clientY - startYRef.current);
      offsetRef.current = next;
      setOffset(next);
    };

    const onEnd = () => {
      setDragging(false);
      const shouldDismiss = offsetRef.current > threshold || velocityRef.current > FLICK_VELOCITY;
      if (shouldDismiss) {
        onDismissRef.current();
      } else {
        offsetRef.current = 0;
        setOffset(0);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging, threshold]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    offsetRef.current = 0;
    lastMoveRef.current = { y: e.clientY, t: e.timeStamp };
    velocityRef.current = 0;
    setOffset(0);
    setDragging(true);
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
