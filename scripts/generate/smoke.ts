/**
 * Proves the generator harness end-to-end WITHOUT any network access:
 * installs the DOM shim, parses the bundled John 1 fixture with the app's
 * own Greek Lowfat converter (`src/io/lowfat.ts`), prints the first token's
 * surface/lemma/Strong's + vocab keys (`src/ui/vocab.ts`), and reports the
 * fixture's raw/gzip size. Run: `npm run generate:smoke`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { greekXmlToChapters } from '../../src/io/lowfat';
import { GNT_BOOKS } from '../../src/io/books';
import { lexemeKey, parseKey } from '../../src/ui/vocab';
import { installDomShim, REPO_ROOT, sizeReport } from './harness';

installDomShim();

const fixturePath = join(REPO_ROOT, 'public', 'fixtures', 'gnt', 'john-1.xml');
const xml = readFileSync(fixturePath, 'utf8');

const john = GNT_BOOKS.find((b) => b.name === 'John');
if (!john) throw new Error('John missing from GNT_BOOKS');

const chapters = greekXmlToChapters(xml, { sourceId: 'macula-greek-sblgnt-lowfat', book: john });
const firstVerse = chapters[0]?.verses[0];
const firstToken = firstVerse?.tokens[0];
if (!firstVerse || !firstToken) {
  throw new Error('No tokens parsed from the fixture — DOM shim or fixture path is broken.');
}

console.log(
  `Parsed ${chapters.length} chapter(s); ${firstVerse.ref} has ${firstVerse.tokens.length} tokens.`,
);
console.log(
  `First token: surface=${firstToken.surface} lemma=${firstToken.lemma} strong=${firstToken.strong}`,
);
console.log(`  lexemeKey=${lexemeKey(firstToken)}`);
console.log(`  parseKey=${parseKey(firstToken)}`);
console.log();
console.log(sizeReport([fixturePath]));
