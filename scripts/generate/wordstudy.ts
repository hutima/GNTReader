/**
 * Generates `public/wordstudy/gnt.json`: a gloss-distribution + derivation
 * index for every Greek lexeme in the SBLGNT, built from pinned upstream
 * sources (never a runtime fetch — see docs/adr/0002-generated-lexical-indexes.md).
 *
 * Run: `npm run generate:wordstudy` (then delete `.generate-cache/`, disk quota).
 *
 * Identity, gloss handling, and derivation rules are documented at the call
 * sites below; the top-level summary lives in the ADR and
 * docs/data-sources-and-licenses.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BookInfo } from '../../src/io/books';
import { GNT_BOOKS } from '../../src/io/books';
import { parseXml } from '../../src/io/lowfat';
import { normalizeStrong } from '../../src/io/strongs';
import { WordStudySchema, type WordStudyData, type WordStudyEntry } from '../../src/io/wordstudy';
import {
  closeDomShim,
  fetchPinned,
  installFreshDomShim,
  maybeGc,
  REPO_ROOT,
  REVISIONS,
  sizeReport,
} from './harness';

// --- Raw token walk (deliberately NOT src/io/lowfat.ts's greekXmlToChapters:
// that function's `gloss` field already falls back to `@english` when
// `@gloss` is absent, and this generator must NEVER read `@english`) --------

export interface RawToken {
  strong?: string;
  lemma?: string;
  /** RAW `@gloss` only — no `@english` fallback, ever. */
  gloss?: string;
}

/** `xml:id` — read via both paths (happy-dom vs browser namespace handling, FL-003). */
function xmlIdOf(el: Element): string | null {
  return (
    el.getAttribute('xml:id') ||
    el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') ||
    null
  );
}

/**
 * Walks a book's `<w>` leaves the same way `src/io/lowfat.ts` does (dedup by
 * `xml:id` — discontinuous groups can repeat a word — then sort by the
 * fixed-width id to restore reading order), but extracts only `strong`,
 * `lemma`, and the RAW `gloss` attribute. Reading order matters here: the
 * gloss-casing tie-break ("most frequent; ties: first seen") depends on
 * processing tokens in a stable, reproducible order.
 */
export function walkGreekTokensRaw(xml: string): RawToken[] {
  const dom = parseXml(xml);
  const parseError = dom.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Malformed GNT XML: ${parseError.textContent?.slice(0, 200)}`);
  }
  const seen = new Map<string, Element>();
  for (const w of Array.from(dom.getElementsByTagName('*')).filter(
    (el) => el.tagName.toLowerCase() === 'w',
  )) {
    const id = xmlIdOf(w);
    if (id && !seen.has(id)) seen.set(id, w);
  }
  return Array.from(seen.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, w]) => ({
      strong: w.getAttribute('strong') ?? undefined,
      lemma: w.getAttribute('lemma') ?? undefined,
      gloss: w.getAttribute('gloss') ?? undefined,
    }));
}

// --- Gloss normalization ----------------------------------------------------

const CURLY_SINGLE_RE = /[‘’]/g; // ‘ ’
const CURLY_DOUBLE_RE = /[“”]/g; // “ ”
const DASH_RE = /[–—]/g; // – —
const TRAILING_PUNCT_RE = /[.,;:]+$/;

/**
 * Per-gloss normalization (documented in the ADR): Unicode NFC → trim →
 * collapse internal whitespace to one space → typographic→ASCII punctuation
 * (curly quotes → straight, en/em dash → hyphen) → strip TRAILING `.,;:`
 * only. Grouping for display is case-insensitive on this result; the
 * FUNCTION itself preserves case (callers group/pick display casing).
 */
export function normalizeGloss(raw: string): string {
  let s = raw.normalize('NFC').trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(CURLY_SINGLE_RE, "'").replace(CURLY_DOUBLE_RE, '"').replace(DASH_RE, '-');
  s = s.trimEnd().replace(TRAILING_PUNCT_RE, '').trimEnd();
  return s;
}

// --- Strong's Greek dictionary (derivation) --------------------------------

export interface DerivationInfo {
  /** Strong's numbers this lexeme derives from — GREEK-language refs only.
   *  A handful of entries (~320 of 5624; 3 mixed) derive from a HEBREW-
   *  language `<strongsref>` instead (transliterated proper nouns like
   *  Ἀαρών/Aaron); those numbers live in the same numeric space as Greek
   *  numbers, and the UI's derivation link is Greek-only
   *  (`openStrongs('G' + num)`), so they are deliberately excluded from `d`
   *  to avoid emitting a wrong-language link. The full derivation text
   *  (`dt`) still mentions them as "H<num>". */
  d?: string[];
  dt?: string;
  r?: 'root' | 'derived';
}

/**
 * happy-dom's XML `DOMParser` does not treat `<tag ... />` as self-closing
 * for elements it doesn't already know are void — it opens a new element and
 * nests everything that follows inside it, corrupting sibling order (found
 * while parsing `strongsgreek.xml`, whose `<greek/>`, `<pronunciation/>`, and
 * `<strongsref/>` are all self-closing; see docs/failure-log.md FL-007).
 * MACULA Lowfat XML never uses self-closing tags, so this workaround is
 * scoped to this one file rather than applied to every XML parse. Safe here:
 * no attribute value in this dictionary contains the literal substring `/>`.
 */
export function fixSelfClosingXml(xml: string): string {
  return xml.replace(
    /<([A-Za-z_][\w.-]*)((?:[^>'"]|'[^']*'|"[^"]*")*?)\/>/g,
    '<$1$2></$1>',
  );
}

const PRIMARY_RE = /\bprimary\b|\bprimitive\b/i;

/**
 * Parses `strongsgreek.xml` into a derivation map keyed by
 * `normalizeStrong(entry@strongs)`. `dt` is built by walking each
 * `<strongs_derivation>`'s child nodes in document order, replacing each
 * `<strongsref>` with `G<num> (<greek unicode>)` (Greek) or `H<num>`
 * (Hebrew — no Hebrew lexicon loaded here, so no gloss to add) so the text
 * reads naturally (e.g. "from G3007 (λεῖμμα);").
 */
export function buildDerivations(rawXml: string): Map<string, DerivationInfo> {
  const dom = parseXml(fixSelfClosingXml(rawXml));
  const parseError = dom.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Malformed strongsgreek.xml: ${parseError.textContent?.slice(0, 200)}`);
  }
  const entries = Array.from(dom.getElementsByTagName('*')).filter(
    (el) => el.tagName.toLowerCase() === 'entry',
  );

  const unicodeByNum = new Map<string, string>();
  for (const entry of entries) {
    const rawStrong = entry.getAttribute('strongs');
    if (!rawStrong) continue;
    const key = normalizeStrong(rawStrong);
    const greekEl = Array.from(entry.getElementsByTagName('*')).find(
      (c) => c.tagName.toLowerCase() === 'greek',
    );
    const unicode = greekEl?.getAttribute('unicode');
    if (unicode) unicodeByNum.set(key, unicode);
  }

  const derivations = new Map<string, DerivationInfo>();
  for (const entry of entries) {
    const rawStrong = entry.getAttribute('strongs');
    if (!rawStrong) continue;
    const key = normalizeStrong(rawStrong);
    const derivEl = Array.from(entry.getElementsByTagName('*')).find(
      (c) => c.tagName.toLowerCase() === 'strongs_derivation',
    );
    if (!derivEl) continue;

    const greekNums: string[] = [];
    let dt = '';
    for (const node of Array.from(derivEl.childNodes)) {
      if (node.nodeType === 3 /* Node.TEXT_NODE */) {
        dt += node.textContent ?? '';
      } else if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
        const el = node as unknown as Element;
        if (el.tagName.toLowerCase() === 'strongsref') {
          const isGreek = el.getAttribute('language') !== 'HEBREW';
          const num = normalizeStrong(el.getAttribute('strongs') ?? '');
          const unicode = isGreek ? unicodeByNum.get(num) : undefined;
          dt += `${isGreek ? 'G' : 'H'}${num}${unicode ? ` (${unicode})` : ''}`;
          if (isGreek) greekNums.push(num);
        } else {
          dt += el.textContent ?? '';
        }
      }
    }
    dt = dt.replace(/\s+/g, ' ').trim();

    const info: DerivationInfo = {};
    if (greekNums.length) {
      info.d = greekNums;
      info.r = 'derived';
    } else if (PRIMARY_RE.test(dt)) {
      info.r = 'root';
    }
    if (dt) info.dt = dt;
    derivations.set(key, info);
  }
  return derivations;
}

// --- Aggregation -------------------------------------------------------------

interface CaseVariant {
  count: number;
  firstSeen: number;
}
interface CaseGroup {
  total: number;
  variants: Map<string, CaseVariant>;
}
interface LexemeAgg {
  t: number;
  groups: Map<string, CaseGroup>;
}

/**
 * Aggregates raw tokens into the two output maps. Identity: tokens with a
 * `@strong` group by `normalizeStrong(strong)` into `strongs`; tokens with
 * no `@strong` group by NFC-normalized lemma into `lemmas` (a separate map,
 * per the design — these two id spaces are not merged so a lemma fallback
 * entry never silently collides with a Strong's-keyed one). A token with
 * neither is unidentifiable and is skipped (not expected in the SBLGNT, but
 * cheaper to skip than to guess a key).
 *
 * Gloss handling: glossless tokens count toward `t` but are excluded from
 * `g`. Present glosses are normalized (`normalizeGloss`), grouped
 * case-insensitively, and the most-frequent original casing is the display
 * form (ties broken by first-seen order — hence the raw walk's stable
 * ordering matters).
 */
export function buildWordStudy(
  tokens: RawToken[],
  derivations: Map<string, DerivationInfo>,
  meta: WordStudyData['meta'],
): WordStudyData {
  const strongsAgg = new Map<string, LexemeAgg>();
  const lemmasAgg = new Map<string, LexemeAgg>();
  let seq = 0;

  function aggFor(map: Map<string, LexemeAgg>, key: string): LexemeAgg {
    let agg = map.get(key);
    if (!agg) {
      agg = { t: 0, groups: new Map() };
      map.set(key, agg);
    }
    return agg;
  }

  for (const tok of tokens) {
    let key: string | null = null;
    let map: Map<string, LexemeAgg> | null = null;
    if (tok.strong) {
      key = normalizeStrong(tok.strong);
      map = strongsAgg;
    } else if (tok.lemma) {
      key = tok.lemma.normalize('NFC');
      map = lemmasAgg;
    }
    if (!key || !map) continue;

    const agg = aggFor(map, key);
    agg.t += 1;

    if (tok.gloss && tok.gloss.trim()) {
      const norm = normalizeGloss(tok.gloss);
      if (norm) {
        const caseKey = norm.toLowerCase();
        let group = agg.groups.get(caseKey);
        if (!group) {
          group = { total: 0, variants: new Map() };
          agg.groups.set(caseKey, group);
        }
        group.total += 1;
        let variant = group.variants.get(norm);
        if (!variant) {
          variant = { count: 0, firstSeen: seq++ };
          group.variants.set(norm, variant);
        }
        variant.count += 1;
      }
    }
  }

  function finalize(map: Map<string, LexemeAgg>, withDerivation: boolean): Record<string, WordStudyEntry> {
    const out: Record<string, WordStudyEntry> = {};
    for (const key of Array.from(map.keys()).sort()) {
      const agg = map.get(key)!;
      const g: [string, number][] = Array.from(agg.groups.values())
        .map((group): [string, number] => {
          let best: { form: string; count: number; firstSeen: number } | null = null;
          for (const [form, v] of group.variants) {
            if (
              !best ||
              v.count > best.count ||
              (v.count === best.count && v.firstSeen < best.firstSeen)
            ) {
              best = { form, count: v.count, firstSeen: v.firstSeen };
            }
          }
          return [best!.form, group.total];
        })
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      const entry: WordStudyEntry = { t: agg.t, g };
      if (withDerivation) {
        const d = derivations.get(key);
        if (d?.d?.length) entry.d = d.d;
        if (d?.dt) entry.dt = d.dt;
        if (d?.r) entry.r = d.r;
      }
      out[key] = entry;
    }
    return out;
  }

  return {
    meta,
    strongs: finalize(strongsAgg, true),
    lemmas: finalize(lemmasAgg, false),
  };
}

// --- Script entry point -----------------------------------------------------

async function main(): Promise<void> {
  const allTokens: RawToken[] = [];
  for (const book of GNT_BOOKS as BookInfo[]) {
    // A fresh happy-dom Window per book (rather than one shared Window for
    // the whole run, `installDomShim`): happy-dom retains internal
    // bookkeeping for every Document its owning Window has ever parsed, so
    // reusing one Window across all 27 books grows unbounded and OOMs
    // partway through (FL-006, discovered independently by this generator
    // and by `scripts/generate/progress.ts` — see harness.ts). Opening and
    // closing a Window per book keeps memory bounded; does not affect output.
    const win = installFreshDomShim();
    if (!book.file) throw new Error(`GNT book "${book.name}" has no file name`);
    const path = await fetchPinned('macula-greek', `SBLGNT/lowfat/${book.file}`);
    const xml = readFileSync(path, 'utf8');
    const tokens = walkGreekTokensRaw(xml);
    allTokens.push(...tokens);
    console.log(`  ${book.name}: ${tokens.length} tokens`);
    await closeDomShim(win);
    maybeGc();
  }

  const dictWin = installFreshDomShim(); // fresh Window for the Strong's-dictionary parse
  const dictPath = await fetchPinned('morphgnt-strongs', 'strongsgreek.xml');
  const derivations = buildDerivations(readFileSync(dictPath, 'utf8'));
  await closeDomShim(dictWin);

  const meta: WordStudyData['meta'] = {
    sources: [{ ...REVISIONS['macula-greek']! }, { ...REVISIONS['morphgnt-strongs']! }],
    generated: 'scripts/generate/wordstudy.ts v1',
    corpus: 'SBLGNT',
    glossSource: 'Berean Interlinear Bible (@gloss)',
  };

  const data = buildWordStudy(allTokens, derivations, meta);
  const validated = WordStudySchema.parse(data); // fail fast on any shape drift

  const outDir = join(REPO_ROOT, 'public', 'wordstudy');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'gnt.json');
  writeFileSync(outPath, JSON.stringify(validated));

  const glossed = allTokens.filter((t) => t.gloss && t.gloss.trim()).length;
  console.log();
  console.log(
    `${allTokens.length} tokens total, ${glossed} with a non-empty @gloss ` +
      `(${((glossed / allTokens.length) * 100).toFixed(1)}%).`,
  );
  console.log(`${Object.keys(validated.strongs).length} Strong's-keyed lexemes, ` +
    `${Object.keys(validated.lemmas).length} lemma-fallback lexemes.`);
  console.log();
  console.log(sizeReport([outPath]));
}

const isMain = process.argv[1] != null && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
}
