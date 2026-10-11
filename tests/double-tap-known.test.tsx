import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenSpan } from '@/ui/TokenSpan';
import { ReadingTokenSchema } from '@/domain/schema';

const token = ReadingTokenSchema.parse({
  id: 'double', sourceId: 'double', testament: 'gnt', language: 'grc',
  book: 'John', bookNum: 4, chapter: 1, verse: 1, wordIndex: 1,
  surface: 'λόγος', gloss: 'word', pos: 'noun', morphology: {},
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  vi.useRealTimers();
});
function mount(enabled = true) {
  const onSelect = vi.fn();
  const onMark = vi.fn();
  const view = render(<TokenSpan token={token} mode="both" selected={false}
    doubleTapMark={enabled} onSelect={onSelect} onMark={onMark} />);
  return { ...view, el: screen.getByRole('button'), onSelect, onMark };
}
function down(el: Element, pointerType = 'touch') {
  fireEvent.pointerDown(el, { pointerType, button: 0, clientX: 10, clientY: 10 });
}
function up(el: Element) {
  fireEvent.pointerUp(el);
  fireEvent.click(el, { detail: 1 });
}
function tap(el: Element, pointerType = 'touch') {
  down(el, pointerType);
  up(el);
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('quick double-tap marking', () => {
  it('marks once without opening details between the taps', () => {
    const { el, onMark, onSelect } = mount();
    tap(el);
    expect(onSelect).not.toHaveBeenCalled();
    advance(100);
    tap(el);
    advance(1000);
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('opens a normal single touch tap after the short double-tap window', () => {
    const { el, onMark, onSelect } = mount();
    tap(el);
    advance(350);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onMark).not.toHaveBeenCalled();
  });
  it('keeps mouse clicks and disabled vocabulary taps immediate', () => {
    const { el, onSelect } = mount();
    tap(el, 'mouse');
    expect(onSelect).toHaveBeenCalledTimes(1);
    cleanup();
    const disabled = mount(false);
    tap(disabled.el);
    expect(disabled.onSelect).toHaveBeenCalledTimes(1);
  });
  it('cancels the pending tap when the next gesture becomes a hold', () => {
    const { el, onMark, onSelect } = mount();
    tap(el);
    advance(80);
    down(el);
    advance(700);
    up(el);
    advance(400);
    expect(onMark).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('does not mark if the second gesture is a scroll', () => {
    const { el, onMark, onSelect } = mount();
    tap(el);
    advance(80);
    down(el);
    fireEvent.pointerMove(el, { pointerType: 'touch', clientX: 10, clientY: 100 });
    up(el);
    advance(400);
    expect(onMark).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('cancels a pending detail open when touching elsewhere', () => {
    const { el, onSelect } = mount();
    tap(el);
    advance(80);
    down(document.body);
    advance(400);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('cancels pending details on a scroll without another pointerdown', () => {
    const { el, onSelect } = mount();
    tap(el);
    advance(80);
    fireEvent.scroll(document.body);
    advance(400);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('does not open stale details after unmounting', () => {
    const { el, onSelect, unmount } = mount();
    tap(el);
    unmount();
    advance(400);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('does not open pending details over an active native selection', () => {
    const { el, onSelect } = mount();
    tap(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()?.addRange(range);
    advance(400);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
