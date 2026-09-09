import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStrongsCache } from '@/io/strongs';
import { clearWordStudyCache, type WordStudyData } from '@/io/wordstudy';
import { WordStudySection } from '@/ui/WordStudySection';

/**
 * Unit tests for the detail panel's async "Word study" section
 * (src/ui/WordStudySection.tsx): loading/ready/hebrew/missing/error states,
 * the gloss-distribution bars + accessible table, and Strong's-enriched
 * derivation links. No real network — `fetch` is stubbed per test.
 */

const GREEK_LEXICON = {
  '303': { l: 'ἀνά', t: 'aná', g: 'up' },
  '2775': { l: 'κεφαλαιόω', t: 'kephalaióō', g: 'to sum up' },
  '3004': { l: 'λέγω', t: 'légō', g: 'to say' },
};

function stubWordStudy(
  data: WordStudyData | null,
  opts: { ok?: boolean; lexiconOk?: boolean } = {},
) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost/');
    if (url.pathname.endsWith('wordstudy/gnt.json')) {
      if (opts.ok === false || data == null) return { ok: false, status: 404 } as Response;
      return { ok: true, status: 200, json: async () => data } as unknown as Response;
    }
    if (url.pathname.endsWith('lexicon/strongs-greek.json')) {
      if (opts.lexiconOk === false) return { ok: false, status: 404 } as Response;
      return { ok: true, status: 200, json: async () => GREEK_LEXICON } as unknown as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
}

function metaFixture(): WordStudyData['meta'] {
  return {
    sources: [{ repo: 'x/y', rev: 'abc', license: 'CC0' }],
    generated: 'test',
    corpus: 'SBLGNT',
    glossSource: 'Berean Interlinear Bible (@gloss)',
  };
}

const LOGOS_DATA: WordStudyData = {
  meta: metaFixture(),
  strongs: {
    '346': {
      t: 2,
      g: [['sum up', 2]],
      d: ['303', '2775'],
      dt: 'from G303 (ἀνά) and G2775 (κεφαλαιόω) (in its original sense);',
      r: 'derived',
    },
    '3056': {
      t: 330,
      g: [
        ['word', 165],
        ['words', 49],
        ['[the] word', 9],
        ['saying', 9],
        ['a word', 8],
        ['account', 7],
        ['speech', 7],
        ['message', 6],
        ['report', 4],
        ['statement', 4],
      ],
      d: ['3004'],
      dt: 'from G3004 (λέγω);',
      r: 'derived',
    },
    '3004': { t: 1000, g: [['say', 900]], r: 'root', dt: 'a primary verb' },
  },
  lemmas: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearWordStudyCache();
  clearStrongsCache();
});

beforeEach(() => {
  clearWordStudyCache();
  clearStrongsCache();
});

describe('WordStudySection', () => {
  it('loading -> success: renders total, top-gloss bars, an Other bucket, and a glossed derivation link', async () => {
    stubWordStudy(LOGOS_DATA);
    const openStrongs = vi.fn();
    const { container } = render(
      <WordStudySection token={{ language: 'grc', strong: '3056' }} openStrongs={openStrongs} />,
    );

    expect(screen.getByText('Loading word study…')).toBeInTheDocument();

    await screen.findByText((_, el) => el?.textContent === '330× in the Greek NT');

    // Bars live in .ws-bars — scope queries there, since the (closed) <details>
    // table below also contains every gloss word structurally.
    const bars = within(container.querySelector<HTMLElement>('.ws-bars')!);
    // Top 8 of 10 glosses shown as bars, remaining 2 folded into "Other (2)".
    expect(bars.getByText('word')).toBeInTheDocument();
    expect(bars.getByText('message')).toBeInTheDocument(); // 8th (last shown) gloss
    expect(bars.getByText('Other (2)')).toBeInTheDocument();
    expect(bars.queryByText('report')).not.toBeInTheDocument(); // folded, not its own bar
    expect(bars.queryByText('statement')).not.toBeInTheDocument(); // folded, not its own bar

    const derivedRow = screen.getByText('Derived from').closest<HTMLElement>('.row')!;
    await waitFor(() => expect(derivedRow).toHaveTextContent('from G3004 (λέγω, to say);'));
    const link = within(derivedRow).getByRole('button', { name: 'G3004' });
    await userEvent.click(link);
    expect(openStrongs).toHaveBeenCalledWith('G3004');
  });

  it('enriches every Greek reference in a multi-part derivation while preserving qualifier prose', async () => {
    stubWordStudy(LOGOS_DATA);
    const openStrongs = vi.fn();
    render(<WordStudySection token={{ language: 'grc', strong: '346' }} openStrongs={openStrongs} />);

    const derivedLabel = await screen.findByText('Derived from');
    const derivedRow = derivedLabel.closest<HTMLElement>('.row')!;
    await waitFor(() =>
      expect(derivedRow).toHaveTextContent(
        'from G303 (ἀνά, up) and G2775 (κεφαλαιόω, to sum up) (in its original sense);',
      ),
    );

    const refs = within(derivedRow).getAllByRole('button');
    expect(refs.map((button) => button.textContent)).toEqual(['G303', 'G2775']);
    await userEvent.click(refs[1]!);
    expect(openStrongs).toHaveBeenCalledWith('G2775');
  });

  it('falls back to source-provided lemmas when the Strong’s lexicon is unavailable', async () => {
    stubWordStudy(LOGOS_DATA, { lexiconOk: false });
    render(<WordStudySection token={{ language: 'grc', strong: '346' }} openStrongs={() => {}} />);

    const derivedLabel = await screen.findByText('Derived from');
    const derivedRow = derivedLabel.closest<HTMLElement>('.row')!;
    await waitFor(() =>
      expect(derivedRow).toHaveTextContent(
        'from G303 (ἀνά) and G2775 (κεφαλαιόω) (in its original sense);',
      ),
    );
    expect(within(derivedRow).getAllByRole('button')).toHaveLength(2);
  });

  it('renders an accessible, complete table of every gloss inside a disclosure', async () => {
    stubWordStudy(LOGOS_DATA);
    render(<WordStudySection token={{ language: 'grc', strong: '3056' }} openStrongs={() => {}} />);
    await screen.findByText('Gloss distribution');

    const summary = screen.getByText('All 10 glosses');
    await userEvent.click(summary);

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Gloss', 'Count', '% of glossed']);
    const reportRow = within(table).getByText('report').closest('tr')!;
    expect(within(reportRow).getByText('4')).toBeInTheDocument();
  });

  it('shows a "root" row (not "derived from") when the dictionary marks a lexeme primary', async () => {
    stubWordStudy(LOGOS_DATA);
    render(<WordStudySection token={{ language: 'grc', strong: '3004' }} openStrongs={() => {}} />);
    await screen.findByText('Root');
    expect(screen.getByText('a primary verb')).toBeInTheDocument();
    expect(screen.queryByText('Derived from')).not.toBeInTheDocument();
  });

  it('Hebrew tokens always show the truthful "not available" state, without waiting on a fetch', async () => {
    stubWordStudy(LOGOS_DATA); // even if the index loads fine, Hebrew never gets a lookup
    render(<WordStudySection token={{ language: 'hbo', strong: '430' }} openStrongs={() => {}} />);
    expect(screen.getByText('Word-study data isn’t available for this word yet.')).toBeInTheDocument();
    expect(screen.queryByText('Loading word study…')).not.toBeInTheDocument();
  });

  it('shows "not available" when the index loads but has no entry for this lexeme', async () => {
    stubWordStudy(LOGOS_DATA);
    render(<WordStudySection token={{ language: 'grc', strong: '999999' }} openStrongs={() => {}} />);
    await screen.findByText('Word-study data isn’t available for this word yet.');
  });

  it('shows an error state when the index fails to load (offline / never downloaded)', async () => {
    stubWordStudy(null, { ok: false });
    render(<WordStudySection token={{ language: 'grc', strong: '3056' }} openStrongs={() => {}} />);
    await screen.findByText(/couldn’t be loaded/);
  });
});
