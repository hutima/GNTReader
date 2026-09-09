import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BDB_URL,
  DODSON_URL,
  HEBREW_LEXICAL_INDEX_URL,
  clearSupplementalDefinitionCache,
  loadSupplementalDefinition,
} from '@/io/lexiconDefinitions';

afterEach(() => {
  vi.unstubAllGlobals();
  clearSupplementalDefinitionCache();
});

describe('supplemental definition loading', () => {
  it('uses Dodson for Greek and prefers the longer definition', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(DODSON_URL);
      return {
        ok: true,
        text: async () =>
          [
            '"Strong\'s"\t"GK"\t"Greek"\t"Brief"\t"Longer"',
            '"0303"\t"0324"\t"a)na/"\t"up, again"\t"as a prefix: up, anew, back."',
          ].join('\n'),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSupplementalDefinition('grc', 'G0303')).resolves.toEqual({
      source: 'Dodson',
      text: 'as a prefix: up, anew, back.',
    });
    await loadSupplementalDefinition('grc', '303');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the Open Scriptures crosswalk plus BDB for Hebrew and caches both files', async () => {
    const lexical = `<?xml version="1.0"?><index><entry id="arn"><xref bdb="a.dl.ad" strong="430"/></entry></index>`;
    const bdb = `<?xml version="1.0"?><lexicon><entry id="a.dl.ad"><def>gods</def><def>God</def></entry></lexicon>`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === HEBREW_LEXICAL_INDEX_URL) {
        return { ok: true, text: async () => lexical } as unknown as Response;
      }
      if (url === BDB_URL) {
        return { ok: true, text: async () => bdb } as unknown as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSupplementalDefinition('hbo', 'H0430')).resolves.toEqual({
      source: 'BDB / Open Scriptures',
      text: 'gods; God',
    });
    await loadSupplementalDefinition('hbo', '430');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
