import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GNT_BOOKS } from '@/io/books';
import { greekXmlToChapters } from '@/io/lowfat';
import { lexemeKey, parseKey } from '@/ui/vocab';
import { cachePath, gzipSize, installDomShim, sizeReport } from '../scripts/generate/harness';

/**
 * Unit tests for the shared generator harness (scripts/generate/harness.ts).
 * No network: only the pure parts (cache path construction, gzip sizing) and
 * the offline fixture parse are exercised.
 */

const fixturePath = join(__dirname, '..', 'public', 'fixtures', 'gnt', 'john-1.xml');

describe('cachePath', () => {
  it('builds a deterministic path from the pinned rev in revisions.json', () => {
    const path = cachePath('macula-greek', 'SBLGNT/lowfat/01-matthew.xml');
    expect(path).toMatch(
      /\.generate-cache[/\\]macula-greek[/\\]8423afe47b9e8f24b7772e808af45c7159a6fe7e[/\\]SBLGNT[/\\]lowfat[/\\]01-matthew\.xml$/,
    );
  });

  it('throws for an unknown source key rather than guessing a ref', () => {
    expect(() => cachePath('not-a-real-source', 'x')).toThrow();
  });
});

describe('gzipSize / sizeReport', () => {
  it('gzip of compressible XML text is smaller than the raw file', () => {
    const raw = readFileSync(fixturePath).length;
    const gz = gzipSize(fixturePath);
    expect(gz).toBeGreaterThan(0);
    expect(gz).toBeLessThan(raw);
  });

  it('sizeReport prints a table with the path and both sizes', () => {
    const report = sizeReport([fixturePath]);
    expect(report).toContain(fixturePath);
    expect(report).toMatch(/KB|B/);
  });
});

describe('installDomShim', () => {
  it('parses the John 1 fixture to the SAME lexemeKey/parseKey as the ambient test runtime', () => {
    const xml = readFileSync(fixturePath, 'utf8');
    const john = GNT_BOOKS.find((b) => b.name === 'John')!;

    // "Runtime" parse: this test file already runs under Vitest's happy-dom
    // environment (vite.config.ts test.environment), the same DOM the app ships with.
    const runtimeToken = greekXmlToChapters(xml, { sourceId: 'runtime', book: john })[0]!.verses[0]!
      .tokens[0]!;

    // "Generator" parse: explicitly install the harness's own DOM shim (a
    // fresh happy-dom Window) and re-parse, as a standalone Node script would.
    installDomShim();
    const generatorToken = greekXmlToChapters(xml, { sourceId: 'generator', book: john })[0]!.verses[0]!
      .tokens[0]!;

    expect(generatorToken.surface).toBe(runtimeToken.surface);
    expect(generatorToken.lemma).toBe(runtimeToken.lemma);
    expect(lexemeKey(generatorToken)).toBe(lexemeKey(runtimeToken));
    expect(parseKey(generatorToken)).toBe(parseKey(runtimeToken));
  });
});
