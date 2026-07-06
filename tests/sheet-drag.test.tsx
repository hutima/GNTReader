import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSheetDrag } from '@/ui/useSheetDrag';

/**
 * The grabber must actually dismiss on a downward drag (this regressed twice
 * because unit tests never exercised the pointer sequence — see CLAUDE.md; the
 * authoritative check is a real-browser drag).
 */
function Harness({ onDismiss }: { onDismiss: () => void }) {
  const { grabberProps } = useSheetDrag(onDismiss);
  return <div data-testid="grabber" {...grabberProps} />;
}

describe('useSheetDrag', () => {
  it('dismisses on a drag past the threshold', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const g = screen.getByTestId('grabber');
    fireEvent.pointerDown(g, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(g, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(g, { clientY: 200, pointerId: 1 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('snaps back (no dismiss) on a small drag', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const g = screen.getByTestId('grabber');
    fireEvent.pointerDown(g, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(g, { clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(g, { clientY: 20, pointerId: 1 });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
