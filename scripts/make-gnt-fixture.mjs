// Slice chapter 1 out of a MACULA SBLGNT Lowfat book file into a small
// bundled fixture. Elements are removed verbatim, never altered, so fixture
// tokens keep upstream provenance (docs/data-sources-and-licenses.md).
//
// Usage: node scripts/make-gnt-fixture.mjs <path-to-book.xml> <chapter> <out.xml>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [src, chapterArg, out] = process.argv.slice(2);
if (!src || !chapterArg || !out) {
  console.error('usage: node scripts/make-gnt-fixture.mjs <book.xml> <chapter> <out.xml>');
  process.exit(1);
}
const chapter = Number(chapterArg);
const xml = readFileSync(src, 'utf8');

const bookOpen = xml.match(/<book[^>]*>/);
if (!bookOpen) throw new Error('no <book> element found');

// Sentences are flat, non-nested blocks; keep those whose first verse
// milestone is in the requested chapter.
const sentences = xml.match(/<sentence[\s\S]*?<\/sentence>/g) ?? [];
const keep = sentences.filter((s) => {
  const m = s.match(/<milestone unit="verse" id="\w+ (\d+):/);
  return m && Number(m[1]) === chapter;
});
if (!keep.length) throw new Error(`no sentences found for chapter ${chapter}`);

const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
const doc = `${header}${bookOpen[0]}\n${keep.join('\n')}\n</book>\n`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, doc);
console.log(`${out}: ${keep.length} sentences, ${(doc.length / 1024).toFixed(0)} KiB`);
