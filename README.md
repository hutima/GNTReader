# GNT Reader

A reading-focused Progressive Web App for the Greek New Testament (SBLGNT,
MACULA Lowfat) and Hebrew Old Testament (WLC, MACULA Lowfat): tap any word
for lemma, transliteration, gloss, parsing, and Strong's number; search by
morphology or Strong's; read offline. No diagramming, no translation text —
gloss mode is built from token-level source data.

## Quickstart

```sh
npm ci
npm test
npm run dev      # http://localhost:5173
```

## Run

| Verb | Command | Output |
| --- | --- | --- |
| dev server | `npm run dev` | http://localhost:5173 |
| tests | `npm test` | Vitest run |
| typecheck | `npm run typecheck` | tsc project build check |
| lint | `npm run lint` | eslint over .ts/.tsx |
| build | `npm run build` | `dist/` (gitignored) |
| preview build | `npm run preview` | serves `dist/` |
| regenerate icons | `npm run icons` | `public/icons/*.png` (committed) |

## Verification

- `npm test && npm run typecheck && npm run lint && npm run build` must all
  exit 0 before any merge (see `.claude/skills/project-change-control`).
- Fresh-clone gate: `d=$(mktemp -d) && git clone . "$d/fresh" && cd "$d/fresh"
  && npm ci && npm test && npm run build`.

### Offline smoke checklist (before any deploy claim)

1. `npm run build && npm run preview`
2. Load the app once (primes the precache), open a chapter.
3. DevTools → Application → Service Workers → status **activated**.
4. DevTools → Network → Offline, then reload.
5. App shell renders; the previously opened chapter still displays.
6. After a redeploy with changes: an unobtrusive "Refresh now" appears; the
   app updates only after tapping it (never mid-use).

## Data sources

All corpus data is CC BY 4.0 / public-domain material fetched on demand from
[Clear-Bible MACULA](https://github.com/Clear-Bible) (Greek: SBLGNT Lowfat,
per book; Hebrew: WLC Lowfat, per chapter), plus a bundled compact Strong's
lexicon (public domain via Open Scriptures, CC BY-SA edition). Tiny fixtures
(John 1, Genesis 1) are bundled for first-run/offline use. Details and
attribution: `docs/data-sources-and-licenses.md`. No copyrighted English
translation is included (see ADR-0001 for the BSB/ASV-only rule).

## Docs of record

- `docs/adr/` — architecture decisions (start at ADR-0001)
- `docs/restart.md` — cold-session continuation (state, traps, next steps)
- `docs/failure-log.md` — settled battles (FL-NNN)
- `docs/config.md` — every configuration axis
- `docs/data-sources-and-licenses.md` — provenance and licensing
- `.claude/skills/` — project discipline skill library
