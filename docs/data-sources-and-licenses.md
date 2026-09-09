# Data sources and licenses

All corpus data is fetched at runtime from public sources or bundled as tiny
fixtures. App code is MIT. No paid or restrictively-copyrighted translation
is included, and none may be added except BSB or ASV (see ADR-0001).

| Data | Source | License | How used |
| --- | --- | --- | --- |
| Greek NT text + morphology (SBLGNT Lowfat) | [Clear-Bible/macula-greek](https://github.com/Clear-Bible/macula-greek) `SBLGNT/lowfat/` | MACULA Greek: CC BY 4.0; SBLGNT text © Society of Biblical Literature, CC BY 4.0 | Fetched per book on demand; John 1 sliced into a bundled fixture (`public/fixtures/gnt/`) |
| Hebrew OT text + morphology (WLC Lowfat) | [Clear-Bible/macula-hebrew](https://github.com/Clear-Bible/macula-hebrew) `WLC/lowfat/` | MACULA Hebrew: CC BY 4.0; Westminster Leningrad Codex: public domain | Fetched per chapter on demand; Genesis 1 bundled as fixture (`public/fixtures/ot/`) |
| Strong's lexicon (Greek + Hebrew, compact JSON) | James Strong, Exhaustive Concordance (1890, public domain) via the Open Scriptures machine-readable edition; compact JSON as prepared in hutima/ScriptureDiagrammer `public/lexicon/` | Open Scriptures edition: CC BY-SA | Bundled (`public/lexicon/`, ~1.2 MB), fetched on demand at runtime, never precached |
| Dodson Greek definitions | [biblicalhumanities/Dodson-Greek-Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon) `dodson.csv`, pinned at `74f70358d4acfaf2f980bf2feb58ab7115cbbcbc` | Public domain; repository LICENSE is CC0 1.0 Universal | Fetched on demand from the pinned revision, indexed by Strong's number, and shown as the supplemental **Definition** in Greek token details; runtime-cached for offline reuse |
| Brown-Driver-Briggs Hebrew definitions + Strong's crosswalk | [openscriptures/HebrewLexicon](https://github.com/openscriptures/HebrewLexicon) `BrownDriverBriggs.xml` + `LexicalIndex.xml`, pinned at `21c9add13bc727d3a951361778e97e3ff7afd1ce` | Original BDB text: public domain; Open Scriptures machine-readable transcription / lexical-index mappings: CC BY 4.0 | Fetched on demand from the pinned revision; `LexicalIndex.xml` maps Strong's numbers (including augmented homographs) to BDB entry ids, and the app shows the distinct BDB `<def>` sense labels as the supplemental **Definition** in Hebrew token details; runtime-cached for offline reuse |
| English glosses / transliterations | Token-level `gloss`/`english`/`transliteration` attributes inside the MACULA files above | Same as their containing corpus (CC BY 4.0) | Gloss display mode; token detail panel |
| Gentium Book Plus (scripture face — Greek) | SIL International, via the `@fontsource/gentium-book-plus` package | SIL Open Font License 1.1 (`src/fonts/Gentium-Book-Plus-OFL.txt`) | Vendored woff2 (greek + greek-ext subsets, weights 400/700) in `src/fonts/`; scripture text and the logo Α/Ω |
| Source Sans 3 / Source Sans Pro (UI face) | Adobe / SIL, via the `@fontsource/source-sans-3` package | SIL Open Font License 1.1 (`src/fonts/Source-Sans-3-OFL.txt`) | Vendored woff2 (latin + latin-ext subsets, weights 400/600/700) in `src/fonts/`; all non-scripture UI text |
| Word-study gloss distribution (Berean `@gloss`) | [Clear-Bible/macula-greek](https://github.com/Clear-Bible/macula-greek) `SBLGNT/lowfat/`, `@gloss` attribute only | Berean Interlinear Bible, public domain since 2023-04-30 | Generated at build time (`scripts/generate/wordstudy.ts` → `public/wordstudy/gnt.json`); the token-level display gloss elsewhere in the app uses the SAME attribute. The sibling `@english` attribute (Cherith, CC BY 4.0) is a different translation and is never read by the generator, so word-study stats stay invariant to it |
| Word-study derivation (Strong's Greek dictionary) | [morphgnt/strongs-dictionary-xml](https://github.com/morphgnt/strongs-dictionary-xml) `strongsgreek.xml`, by Dr. Ulrik Sandborg-Petersen | CC0 waiver (README.md: "To the extent possible under law, Ulrik Sandborg-Petersen has waived all copyright and related or neighboring rights to *Strong's Dictionary in XML with real Greek*") | Generated at build time into the same `public/wordstudy/gnt.json` (`d`/`dt`/`r` fields) — a handful of entries derive from a Hebrew-language `<strongsref>` (transliterated proper nouns); those are kept in the flattened text but excluded from the clickable derivation list (see `scripts/generate/wordstudy.ts`) |

## Generated data

| Data | Source | License | How used |
| --- | --- | --- | --- |
| Vocabulary-progress index (`public/progress/{gnt,ot}.json`, + `ot-N.json` shards if sharded) | Built by `npm run generate:progress` (`scripts/generate/progress.ts`) from the same pinned `macula-greek`/`macula-hebrew` revisions above | CC BY 4.0 — the `L`/`P` arrays contain lemmas and parse signatures (source-derived text), not just counts, so this generated file carries the same MACULA provenance as the corpus rows above, even though no running scripture text is shipped | Fetched on demand by the Settings → "Vocabulary progress" modal (`src/ui/ProgressModal.tsx`); never precached, runtime-cached like other corpus data (`src/sw.ts`); see ADR-0003 |

`scripts/generate/harness.ts` fetches pinned upstream files (never a runtime
fetch of an un-pinned ref) and parses them with the app's own
`src/io/lowfat.ts` under a DOM shim, so generated keys/tokens match the
runtime exactly. Both generated features above (the vocabulary-progress index
and the word-study index, whose two rows are in the main table above) share
this harness:

- Pinned revisions (repo + commit SHA + license) live in
  `scripts/generate/revisions.json`; generators only ever fetch that exact
  SHA, never a branch, into a gitignored local cache (`.generate-cache/`).
- `scripts/generate/wordstudy.ts` (`npm run generate:wordstudy`) emits
  `public/wordstudy/gnt.json` — see the two word-study rows above and
  `docs/adr/0002-generated-lexical-indexes.md` for the full design
  (identity, gloss normalization, derivation extraction, sizing).
- Supplemental Dodson/BDB definitions are runtime sources rather than generated
  artifacts. Their immutable revision SHAs live beside their URLs in
  `src/io/lexiconDefinitions.ts`; the service worker recognizes those exact
  pinned URLs and runtime-caches successful responses.
- The Strong's dictionary used for word-study derivations is a different
  machine-readable edition of the same public-domain Strong's data as the
  bundled lexicon. The bundled lexicon still drives the "Strong's" detail row
  and lexicon search; the generated index drives the "Word study" section;
  Dodson/BDB supply the separate supplemental "Definition" row.

Provenance notes:

- Fixture files are verbatim slices of the upstream XML (elements removed,
  none altered), so token-level data in fixtures carries upstream provenance.
- License texts live upstream; attribution is shown in the app README and
  this file. CC BY 4.0 requires attribution — keep these tables current when
  adding sources. (License identification: verified-by-reading upstream repo
  documentation and the reference app's source headers, 2026-07-06.)
- Explicitly NOT included: NIV, ESV, NASB, NRSV, NET or any other
  copyright-restricted translation; the 21 MB parallel-English alignment data
  from the reference app.
