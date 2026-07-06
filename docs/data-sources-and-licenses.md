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
