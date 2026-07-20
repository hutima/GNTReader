# Data sources and licenses

All corpus data is fetched at runtime from public sources or bundled as tiny
fixtures. App code is MIT. No paid or restrictively-copyrighted translation
is included, and none may be added except BSB or ASV (see ADR-0001).

| Data | Source | License | How used |
| --- | --- | --- | --- |
| Greek NT text + morphology (SBLGNT Lowfat) | [Clear-Bible/macula-greek](https://github.com/Clear-Bible/macula-greek) `SBLGNT/lowfat/` | MACULA Greek: CC BY 4.0; SBLGNT text © Society of Biblical Literature, CC BY 4.0 | Fetched per book on demand; John 1 sliced into a bundled fixture (`public/fixtures/gnt/`) |
| Hebrew OT text + morphology (WLC Lowfat) | [Clear-Bible/macula-hebrew](https://github.com/Clear-Bible/macula-hebrew) `WLC/lowfat/` | MACULA Hebrew: CC BY 4.0; Westminster Leningrad Codex: public domain | Fetched per chapter on demand; Genesis 1 bundled as fixture (`public/fixtures/ot/`) |
| Strong's lexicon (Greek + Hebrew, compact JSON) | James Strong, Exhaustive Concordance (1890, public domain) via the Open Scriptures machine-readable edition; compact JSON as prepared in hutima/ScriptureDiagrammer `public/lexicon/` | Open Scriptures edition: CC BY-SA | Bundled (`public/lexicon/`, ~1.2 MB), fetched on demand at runtime, never precached |
| English glosses / transliterations | Token-level `gloss`/`english`/`transliteration` attributes inside the MACULA files above | Same as their containing corpus (CC BY 4.0) | Gloss display mode; token detail panel |
| Gentium Book Plus (scripture face — Greek) | SIL International, via the `@fontsource/gentium-book-plus` package | SIL Open Font License 1.1 (`src/fonts/Gentium-Book-Plus-OFL.txt`) | Vendored woff2 (greek + greek-ext subsets, weights 400/700) in `src/fonts/`; scripture text and the logo Α/Ω |
| Source Sans 3 / Source Sans Pro (UI face) | Adobe / SIL, via the `@fontsource/source-sans-3` package | SIL Open Font License 1.1 (`src/fonts/Source-Sans-3-OFL.txt`) | Vendored woff2 (latin + latin-ext subsets, weights 400/600/700) in `src/fonts/`; all non-scripture UI text |

## Generated data (upcoming)

No generated data ships yet. A build-time generator harness
(`scripts/generate/harness.ts`) exists so future features (e.g. a word-study
index, a vocabulary-progress index) can be built from pinned upstream
revisions rather than the runtime-fetched files above:

- Pinned revisions (repo + commit SHA + license) live in
  `scripts/generate/revisions.json`; generators only ever fetch that exact
  SHA, never a branch, into a gitignored local cache (`.generate-cache/`).
- Generators parse MACULA Lowfat XML with the app's own `src/io/lowfat.ts`
  (same code the reader uses at runtime) so generated keys/tokens match the
  runtime exactly.
- No new upstream sources are introduced by this harness itself; the pinned
  Strong's dictionary source (`morphgnt/strongs-dictionary-xml`, CC0) is a
  different machine-readable edition of the same public-domain Strong's data
  than the one already bundled (see the Strong's row above) and will be
  reconciled — or the existing bundled lexicon kept — in the feature PR that
  actually emits generated data.

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
