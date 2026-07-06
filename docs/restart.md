# restart.md — cold-session continuation

Last updated: 2026-07-06 (Phase 0 complete)

## What this project is

A reading-focused GNT/OT PWA (Vite + React + TS, GitHub Pages). NOT a
diagramming app. Reference-only repos (cloned to /workspace in the original
session, NOT dependencies): `hutima/ScriptureDiagrammer`, `hutima/R-learning`
(skills copied to `.claude/skills/`).

Read `docs/adr/0001-day-one-decisions.md` first — it holds the architecture,
the reuse/strip plan, and the SW policy. Then this file.

## Current state

- Phase 0 done: reconnaissance, ADR-0001, docs skeleton, skills copied.
- Phases 1-6 pending (bootstrap → model/adapters → reader UI → search →
  continuous scroll → hardening/PR). Working branch:
  `claude/gnt-ot-reading-pwa-yu5dnq`.

## Verified commands

- (none yet — no code)

## Key reconnaissance facts (verified-by-reading the reference repo)

### Source XML shapes

SBLGNT Lowfat (`Clear-Bible/macula-greek`, `SBLGNT/lowfat/NN-book.xml`, one
file per book, John ≈ 12 MB):

```xml
<book lang="el" id="JHN">
  <sentence><p><milestone unit="verse" id="JHN 1:1">…</milestone> …</p>
    <wg …>
      <w ref="JHN 1:1!2" xml:id="n43001001002" after=" " class="noun"
         type="common" lemma="ἀρχή" normalized="ἀρχῇ" strong="746"
         number="singular" gender="feminine" case="dative"
         english="beginning" gloss="beginning" morph="N-DSF">ἀρχῇ</w>
```

- Verse = `ref` attr per word: `"JHN 1:1!4"` = book code, ch:v, !wordIndex.
- Surface order = sort by fixed-width `xml:id` (`n43001001002`).
- Morph attrs: case/gender/number/person/tense/voice/mood (spelled out),
  `morph` = compact code. NO transliteration for Greek.
- `after` = trailing separator/punctuation (render `surface + after`).

macula-hebrew WLC Lowfat (`Clear-Bible/macula-hebrew`,
`WLC/lowfat/NN-Code-CCC-lowfat.xml`, one file per CHAPTER):

```xml
<chapter lang="he" id="GEN 1">
  <sentence id="GEN 1:1"><p><milestone …/>…</p>
    <w xml:id="o010010010012" ref="GEN 1:1!1" english="beginning"
       gloss="beginning" transliteration="rēʾšiyṯ" strongnumberx="7225"
       morph="Ncfsa" class="noun" lang="H" lemma="רֵאשִׁית" gender="feminine"
       number="singular" state="absolute" after=" ">רֵאשִׁ֖ית</w>
```

- Hebrew is MORPHEME-segmented: several `<w>` share one word `ref` (`!N`);
  a prefix like בְּ has no `after`, so morphemes of one word join with no
  space. Order by `xml:id` (`o…`, fixed width).
- Strong's attr is `strongnumberx` (may have letter suffix, e.g. `0871a`).
- Hebrew-only attrs: `transliteration`, `state`, `stem`, `type`,
  `lang` (`H`/`A` Aramaic). No `case`.
- Hosea's file code is upper-case `HOS` (only oddball); chapter file name:
  `NN-Code-CCC-lowfat.xml` (book num 2-digit, chapter 3-digit).

### Upstream URLs (fetch on demand, SW-cached)

- GNT: `https://raw.githubusercontent.com/Clear-Bible/macula-greek/main/SBLGNT/lowfat/<NN-book>.xml`
- OT: `https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/main/WLC/lowfat/<NN-Code-CCC-lowfat>.xml`
- Fallback chain: bundled fixture → `public/` local copy → upstream.

### Strong's lexicon

Compact JSON `{ "746": {"l":"ἀρχή","t":"archḗ","g":"beginning","k":"…"} }`,
two files (greek 462 KB, hebrew 718 KB) copied from the reference repo's
`public/lexicon/`. Search ranking (reference `src/io/strongs.ts`): number
exact 100 / prefix 60; lemma-or-translit exact 100 / prefix 70; gloss
substring 50; KJV substring 40; lemma substring 20; cap 40; deterministic
tie-break by strong number.

### Algorithms to reuse (from reference, reimplemented in Phase 2+)

- `foldAccents(s) = s.normalize('NFD').replace(/\p{Mn}/gu,'').toLowerCase()`
  — strips Greek accents AND Hebrew points/cantillation. Search uses it on
  both query and corpus.
- Greek transliteration (reference `src/domain/model/transliterate.ts`):
  NFD, map α→a…ω→ō, γ→n before γκξχ, υ→u in diphthongs, ρ+rough→rh,
  rough breathing→leading h, iota subscript→i. ~90 lines, copy wholesale.
  Hebrew translit comes from source attr; Greek fallback = Strong's entry.
- Morph chip abbreviations (reference `src/domain/model/forms.ts`):
  nom/gen/dat/acc/voc · sg/du/pl · m/f/n/c · pres/impf/fut/aor/pf/plpf ·
  act/mid/pass/m/p · ind/subj/opt/impv/inf/ptcp · 1/2/3.
- `tidyGloss(g) = g.replace(/\./g,' ')` — MACULA glosses use dots for spaces
  (`he.created`).
- Viewport: mobile ≤ 767, tablet ≤ 1023; mobile = drawer/sheet, desktop =
  side panel.
- SW update flow: see ADR-0001 (install waits; user-tap SKIP_WAITING only).

### Book metadata

- GNT: 27 books, files `01-matthew.xml` … `27-revelation.xml` (reference
  `src/io/gnt.ts` has the exact table). Chapter counts are NOT in the
  reference (it loads whole books) — hardcode the standard counts.
- OT: 39 books with codes + chapter counts in reference `src/io/ot.ts`.

## Reuse / strip decisions (summary — full list in ADR-0001)

REUSE (ideas/small code): reading-irrelevant-free parts only — morphology
vocab, Lowfat dialect leaf readers, book tables, fetch/cache chain, Strong's
JSON + ranked search, foldAccents, transliteration, morph abbreviations,
hardened SW flow, idb patterns, viewport breakpoints, SearchQuery field shape.

STRIP (never port): KrDocument/SentenceConverter syntax graph, layout/render,
editor, discourse, sermon, contested, guided, export, parallel English (21 MB),
OpenText, Nestle1904 (deferred), userData patch system.

## Open issues

- None blocking. Greek chapter-level fetch is impossible upstream (per-book
  files only) — mitigated via IndexedDB normalized-chapter cache.

## Next command

Phase 1: scaffold Vite app (see ADR-0001 stack table), then `npm install &&
npm test && npm run build`.

## Files touched so far

- `.claude/skills/` (copied from R-learning)
- `docs/adr/0001-day-one-decisions.md`, `docs/restart.md`,
  `docs/failure-log.md`, `docs/config.md`,
  `docs/data-sources-and-licenses.md`

## Known traps

- FL-001 stale service worker (see failure log) — bump cache version with
  cached-asset changes; test offline smoke before deploy claims.
- GitHub Pages subpath: never absolute `/` paths; `base: './'`.
- happy-dom upper-cases XML tag names — compare `tagName.toLowerCase()`.
- Hebrew morphemes share a verse `ref` `!N`; don't dedupe tokens by ref.
- `after` attr may be missing (= no trailing space, Hebrew prefixes).
- 12 MB GNT book fetch: parse once → IndexedDB; don't re-parse per chapter.
