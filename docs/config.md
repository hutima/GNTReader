# Configuration catalog

One row per configuration axis. Precedence: built-in < config file < env var
< CLI flag (last wins). New axes are validated at startup and fail fast.

| Name | Type | Default | Allowed | Status | Validated | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `base` (vite) | build const | `./` | `./` only (GitHub Pages subpath) | active | invariant test (no absolute-root URLs in dist) | app | 2026-07-06 |
| `CORPUS_CACHE` | SW const (`src/sw.ts` + loaders) | `corpus-v2` | `corpus-vN` | active | static check test | app | 2026-07-20 |
| `DB_NAME` / `DB_VERSION` | idb consts (`src/persistence/db.ts`) | `gnt-reader` / 2 | bump version with schema change (v2 added token `syntax`) | active | unit test | app | 2026-07-06 |
| Display mode | localStorage `gr:displayMode` | `both` | `original` \| `gloss` \| `both` | active | zod parse w/ fallback | ui | 2026-07-19 |
| Theme | localStorage `gr:theme` | `system` | `system` \| `light` \| `dark` (sets `data-theme` on `<html>`) | active | zod parse w/ fallback | ui | 2026-07-06 |
| Reading size | localStorage `gr:readingScale` | `1` | 0.8–1.8, 0.1 step (CSS var `--reading-scale`, not viewport zoom) | active | clamped on load | ui | 2026-07-06 |
| Syntax highlight | localStorage `gr:syntax` | `on` | `on` \| `off` (tap-to-highlight clause by role) | active | default-on unless `off` | ui | 2026-07-06 |
| Vocabulary mode | localStorage `gr:vocab` | `on` | `on` \| `off` (hide glosses for known words in Both mode) | active | default-on unless `off` | ui | 2026-07-19 |
| Long-press marks lexeme | localStorage `gr:vocabMarkLexeme` | `off` | `on` (whole lexeme) \| `off` (just this parse) | active | default-off unless `on` | ui | 2026-07-06 |
| Known words | localStorage `gr:knownLexemes` / `gr:knownParses` | `[]` | JSON string arrays of lexeme / parse keys | active | parsed w/ fallback to empty; Reset in Settings | ui | 2026-07-06 |
| Last position | localStorage `gr:lastRef` | John 1 | any valid ref | active | zod parse w/ fallback | ui | 2026-07-06 |
| Tutorial seen | localStorage `gr:tutorialSeen` | `off` (unset) | `on` \| `off` — first-launch step-through tour (TutorialModal), teaches vocab mode in the Both view; "Replay tour" in Settings reopens without resetting this flag | active | zod parse w/ fallback | ui | 2026-07-19 |
| Search result cap | const `SEARCH_RESULT_CAP` | 300 | int > 0 | active | asserted in tests | search | 2026-07-06 |
| Strong's result cap | const `STRONGS_RESULT_CAP` | 40 | int > 0 | active | asserted in tests | search | 2026-07-06 |
| Prefetch radius | const `PREFETCH_CHAPTERS` | 2 | 0-2 | active | asserted in tests | reader | 2026-07-06 |
| Reader window radius | const `WINDOW_RADIUS` (`src/ui/Reader.tsx`) | 2 | int > 0 (chapters kept each side; far ones dropped) | active | verified-by-reading | reader | 2026-07-06 |
| Pinned upstream revisions | `scripts/generate/revisions.json` | see file | `{sourceKey: {repo, rev, license}}`; `rev` is a full commit SHA, never a branch | active | build-time generators only fetch this pinned SHA (`fetchPinned`); no runtime effect | data | 2026-07-20 |
| Vocabulary-progress index | `public/progress/{gnt,ot}.json` (+ `ot-N.json` shards if OT exceeds the 400 KB gzip budget) | built by `npm run generate:progress` (`scripts/generate/progress.ts`) | committed generated JSON; `ot.json` is either the full `{meta,books}` index or a `{meta,shards}` manifest — see ADR-0003 | active | zod-validated on fetch (`src/ui/progress.ts`); generator determinism tests (`tests/progress-generator.test.ts`) | data | 2026-07-20 |
| Visible-chapter `gr:lastRef` debounce | const `LAST_REF_DEBOUNCE_MS` (`src/state/store.ts`) | 500 (ms) | int > 0; flushed immediately on `pagehide` | active | fake-timer unit test | reader | 2026-07-20 |

No runtime env vars and no secrets exist in this app (static PWA; all data
sources are public). `.env` is unused; if one is ever added, commit a
`.env.example` with its shape and gitignore the real file.

**Vocabulary percentage definition** (Settings → "Vocabulary progress",
`src/ui/progress.ts`): token coverage over every markable token in a book —
each occurrence of a word counts separately (a common word repeated 50 times
contributes 50 to the denominator, not 1). A token counts as known if its
lexeme is marked known OR its exact parse is marked known (same "known"
semantics as reading-mode gloss-hiding, `src/ui/vocab.ts` `isKnown`); a token
known both ways is still counted once, by construction — the generated index
stores one row per unique (lexeme, parse) pair with its token count, so a
row can only ever be added to the "known" side once. 0-token books/testaments
show "—", never `NaN`; 100% is only shown when every token is known.
