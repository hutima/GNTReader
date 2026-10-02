import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStrongsCache } from '@/io/strongs';
import { useAppStore } from '@/state/store';
import { StrongsPanel } from '@/ui/StrongsPanel';

const greekLexicon = {
  '3056': { l: 'λόγος', t: 'logos', g: 'word' },
  '5622': { l: 'ὠφέλεια', t: 'opheleia', g: 'benefit' },
  '1': { l: 'ἄλφα', t: 'alpha', g: 'alpha' },
};

describe('Strong’s lexicon browser', () => {
  beforeEach(() => {
    clearStrongsCache();
    useAppStore.setState({
      testament: 'gnt',
      strongsQuery: '',
      panel: 'strongs',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => greekLexicon,
      })) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStrongsCache();
  });

  it('browses the whole lexicon in Strong’s-number order when search is blank', async () => {
    render(<StrongsPanel />);

    await screen.findByText('G1');
    const refs = [...document.querySelectorAll('.strongs-hit .hit-ref')].map(
      (node) => node.textContent,
    );
    expect(refs).toEqual(['G1', 'G3056', 'G5622']);
    expect(screen.getByRole('navigation', { name: 'Greek alphabet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to Alpha' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Jump to Omega' })).toBeEnabled();
    expect(screen.getByText(/3 entries · Strong’s number order/)).toBeInTheDocument();
  });

  it('keeps the existing ranked search behavior once a query is entered', async () => {
    render(<StrongsPanel />);

    const search = await screen.findByRole('searchbox');
    fireEvent.change(search, { target: { value: 'logos' } });

    await waitFor(() => {
      const refs = [...document.querySelectorAll('.strongs-hit .hit-ref')].map(
        (node) => node.textContent,
      );
      expect(refs).toEqual(['G3056']);
    });
    expect(screen.queryByRole('navigation', { name: 'Greek alphabet' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 search match/)).toBeInTheDocument();
  });
});
