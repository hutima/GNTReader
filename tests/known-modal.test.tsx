import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { KnownWordsModal } from '@/ui/KnownWordsModal';
import { useAppStore } from '@/state/store';

afterEach(() => {
  useAppStore.getState().resetKnown();
  localStorage.clear();
});

describe('known-words modal', () => {
  it('lists known lexemes alphabetically and removes one on ✕', async () => {
    const user = userEvent.setup();
    useAppStore.getState().markKnown('lexeme', 'grc|λόγος');
    useAppStore.getState().markKnown('lexeme', 'grc|θεός');

    render(<KnownWordsModal onClose={() => {}} />);
    expect(screen.getByText('λόγος')).toBeInTheDocument();
    expect(screen.getByText('θεός')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove λόγος' }));
    expect(screen.queryByText('λόγος')).toBeNull();
    expect(useAppStore.getState().knownLexemes.has('grc|λόγος')).toBe(false);
    expect(useAppStore.getState().knownLexemes.has('grc|θεός')).toBe(true);
  });
});
