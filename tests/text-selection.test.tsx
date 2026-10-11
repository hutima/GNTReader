import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenSpan } from '@/ui/TokenSpan';
import { ReadingTokenSchema } from '@/domain/schema';
import { useAppStore } from '@/state/store';
import { applyBackup, buildBackup, parseBackup } from '@/state/backup';

const token = ReadingTokenSchema.parse({
  id: 'test', sourceId: 'test', testament: 'gnt', language: 'grc',
  book: 'John', bookNum: 4, chapter: 1, verse: 1, wordIndex: 1,
  surface: 'λόγος', gloss: 'word', pos: 'noun', morphology: {},
});
afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  vi.useRealTimers();
});

function mount(action?: 'select' | 'mark' | 'gloss') {
  const onSelect = vi.fn();
  const onMark = vi.fn();
  render(<TokenSpan token={token} mode="original" selected={false}
    longPressAction={action} onSelect={onSelect} onMark={onMark} />);
  return { el: screen.getByRole('button'), onSelect, onMark };
}

describe('text selection gestures', () => {
  it('allows the native selection context menu by default', () => {
    const { el } = mount();
    expect(fireEvent.contextMenu(el)).toBe(true);
  });
  it('keeps a short tap opening word details', () => {
    const { el, onSelect } = mount();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(el);
    fireEvent.click(el, { detail: 1 });
    expect(onSelect).toHaveBeenCalledWith(token);
  });
  it('does not reveal a gloss, mark known or open details after a default hold', () => {
    vi.useFakeTimers();
    const { el, onSelect, onMark } = mount();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerUp(el);
    fireEvent.click(el, { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onMark).not.toHaveBeenCalled();
  });
  it('does not open details when a text range is selected', () => {
    const { el, onSelect } = mount();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()?.addRange(range);
    fireEvent.click(el, { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('preserves opt-in hold-to-mark and suppresses its release click', () => {
    vi.useFakeTimers();
    const { el, onSelect, onMark } = mount('mark');
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(el);
    fireEvent.click(el, { detail: 1 });
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onMark).toHaveBeenCalledWith(token);
    expect(onSelect).not.toHaveBeenCalled();
    expect(fireEvent.contextMenu(el)).toBe(false);
  });
  it('preserves opt-in hold-to-gloss', () => {
    vi.useFakeTimers();
    const { el } = mount('gloss');
    fireEvent.pointerDown(el);
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerUp(el);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('hold preference', () => {
  it('defaults to selection for existing installations too', () => {
    expect(useAppStore.getState().holdToSelect).toBe(true);
  });
  it('survives backup round-trip and does not change when importing an older backup', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'gnt-reader', backupVersion: 1,
      settings: { holdToSelect: false } }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    applyBackup(parsed.backup);
    expect(useAppStore.getState().holdToSelect).toBe(false);
    expect(localStorage.getItem('gr:holdToSelect')).toBe('off');
    expect(buildBackup().settings?.holdToSelect).toBe(false);
    applyBackup({ app: 'gnt-reader', backupVersion: 1, settings: { vocabMode: true } });
    expect(useAppStore.getState().holdToSelect).toBe(false);
  });
});
