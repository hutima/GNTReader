# Supplemental lexical definitions

The token detail panel keeps two different kinds of English help separate:

- **Gloss** is the contextual token gloss supplied by the MACULA corpus.
- **Definition** is a broader lexical definition keyed by the token's Strong's
  number.

Greek definitions come from Jeffrey Dodson's public-domain Greek Lexicon. The
app prefers Dodson's longer definition, falling back to his brief definition
when needed.

Hebrew definitions come from the public-domain Brown-Driver-Briggs lexicon via
Open Scriptures' Strong's-to-BDB crosswalk. To keep a nineteenth-century BDB
article from overwhelming the compact detail panel, the UI extracts the
distinct `<def>` sense labels, removes duplicates, and shows at most twelve;
additional senses are indicated with an ellipsis.

Hebrew homographs are handled conservatively. Open Scriptures uses an `aug`
letter to distinguish multiple lexical entries sharing one Strong's number.
An exact augmented token (for example `441a`) resolves to its matching BDB
entry. A bare number is only given an augmented definition when there is one
unambiguous candidate; otherwise no supplemental definition is shown rather
than guessing.

All supplemental source URLs are pinned to immutable upstream commit SHAs in
`src/io/lexiconDefinitions.ts`. They are fetched only when a word detail panel
needs them and are then runtime-cached by the service worker for offline reuse.
See `docs/data-sources-and-licenses.md` for provenance and licensing.
