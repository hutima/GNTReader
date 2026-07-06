# Configuration catalog

One row per configuration axis. Precedence: built-in < config file < env var
< CLI flag (last wins). New axes are validated at startup and fail fast.

| Name | Type | Default | Allowed | Status | Validated | Owner | Last verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `base` (vite) | build const | `./` | `./` only (GitHub Pages subpath) | active | invariant test (no absolute-root URLs in dist) | app | 2026-07-06 |
| `CORPUS_CACHE` | SW const (`src/sw.ts` + loaders) | `corpus-v1` | `corpus-vN` | active | static check test | app | 2026-07-06 |
| `DB_NAME` / `DB_VERSION` | idb consts (`src/persistence/db.ts`) | `gnt-reader` / 1 | bump version with schema change | active | unit test | app | 2026-07-06 |
| Display mode | localStorage `gr:displayMode` | `original` | `original` \| `gloss` \| `both` | active | zod parse w/ fallback | ui | 2026-07-06 |
| Last position | localStorage `gr:lastRef` | John 1 | any valid ref | active | zod parse w/ fallback | ui | 2026-07-06 |
| Search result cap | const `SEARCH_RESULT_CAP` | 300 | int > 0 | active | asserted in tests | search | 2026-07-06 |
| Strong's result cap | const `STRONGS_RESULT_CAP` | 40 | int > 0 | active | asserted in tests | search | 2026-07-06 |
| Prefetch radius | const `PREFETCH_CHAPTERS` | 1 | 0-2 | active | asserted in tests | reader | 2026-07-06 |

No runtime env vars and no secrets exist in this app (static PWA; all data
sources are public). `.env` is unused; if one is ever added, commit a
`.env.example` with its shape and gitignore the real file.
