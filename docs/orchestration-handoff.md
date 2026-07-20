# Orchestration handoff (temporary — delete when all three PRs are complete)

Last updated: 2026-07-20. Lead: Fable orchestration session.
Branch: `claude/ipad-reader-stability-nrdpvf` (currently even with `origin/main`
except this file). A cold session must be able to resume from here in <5 min.

## OWNER DIRECTIVE (2026-07-20 04:0x UTC, latest — supersedes earlier pause)

Owner (asleep): continue ALL THREE PRs until tokens run out. PR/merge each
when complete and verified (pre-authorized). Wake-up retry reminders set
via send_later: 05:20 UTC (trig_01CDJGsgMC282zs53uKp7hQc) and backup
08:20 UTC (trig_0152TG798BvgijvQKN7c4dAA) — the owner said their token
budget resets at "1:20 AM" (timezone unstated; both US-Eastern and
US-Pacific interpretations covered). Groundwork PR #15 already merged.
05:20 UTC reminder fired: all three implementers had died ~04:05 (token
exhaustion, as owner predicted — no processes, no writes after 04:03).
Respawned continuation agents at 05:20 for all three: PR 1 in the main
checkout (substantial WIP found: anchor.ts + reader-anchor.test.ts +
Reader/store/App/backup edits + browser-smoke additions, smoke was
mid-iteration/failing), PR 2/3 continuing the preserved worktrees
agent-a6f639edbd138d515 / agent-a12428391d7838de3.

STATUS 06:0x UTC: **PR 3 MERGED — PR #16** (squash 53497a2; verified by
lead: 113/113 tests, precache excludes progress/**, John totals cross-match
Scout D, browser smoke 8/8; sizes gnt.json 421.7 KB gzip [over estimate,
flagged + accepted, lazy-only], OT 3 shards ~266-272 KB gzip each behind
ot.json manifest; CORPUS_CACHE now corpus-v2; failure-log now has FL-006 =
generator happy-dom OOM, fixed via installFreshDomShim in harness).
CONSEQUENCES for in-flight PRs: PR 2 must rebase onto main and bump
CORPUS_CACHE to corpus-v3 (its agent was messaged the full conflict list);
PR 1's failure-log entry must be renumbered FL-006→FL-007 at/before merge
(failure-log.md will conflict — resolve by appending after FL-006).
PR 1 + PR 2 agents still running.

STATUS 06:1x UTC — PR 1: Sonnet implementation COMPLETE (commits 4a72179,
9df5080, 8290027: anchor.ts, width-gated RO, visibleChapter store field,
BookPicker highlight, 7+ unit tests, smoke steps 10a-10d; its run: max
drift 0.4px @768, FL-004 guard 0.3px). Lead merged origin/main into the
branch (8e76766) resolving config.md/failure-log.md conflicts and
renumbering the reflow entry FL-006→FL-007 repo-wide (PR #16 took FL-006).
Lead verification: gates green (134/134 tests), BUT browser smoke step
"834px close drift" FAILED 1-of-3 runs with drift 35px (~one text line;
implementer had also seen it and mis-filed it as host contention —
rerun-until-pass rejected). ESCALATED to Opus debugging agent (running):
isolated 834px open/close loop with rAF/RO timing instrumentation, root
cause + minimal fix + 20-loop proof + 3× full smoke required. Suspects:
pending rAF capture racing the close-commit/RO delivery; smooth-scroll
remnant; ratio rounding across rewrap. Do NOT merge PR 1 until this is
fixed and re-verified.

## Mission

Three independently mergeable changes (owner brief, 2026-07-20):

1. **PR 1 `fix/reader-viewport-state`** — iPad panel-reflow jump fix +
   visible-chapter tracking (header/picker/lastRef follow scrolling without
   resetting the chapter window).
2. **PR 2 `feat/lexeme-word-study`** — Logos-like word-study section in the
   detail panel (Berean gloss distribution, Strong's derivation, generated
   lazy index).
3. **PR 3 `feat/vocabulary-progress`** — vocabulary progress analytics modal
   (token-coverage % per book, generated per-testament index).
   A small shared **groundwork PR** (generator harness) precedes 2 and 3.

Do not merge any PR — owner merges. Follow `.claude/skills/project-change-control`.

## Reconnaissance results (all verified 2026-07-20)

### Scout A — iPad jump REPRODUCED (real Chromium, verified-by-execution)

- Jump on 768–834px-wide viewports only: `.detail.side` (320px flex child)
  mounts on token select, reader content width 768→448px, `.verses
  {max-width:44rem}` rewraps, scrollHeight +130–151%. No compensation exists.
- 1024px+ iPads: remaining 704px still fits 44rem column → no jump.
  Phones (<768px, bottom sheet): no width change, no jump.
- Anchor-token drift ~20–23px per open; ~restores on close; not cumulative.
  scrollTop surged +2785px on open at 768×1024 (partly the select-scroll
  effect, Reader.tsx:214).
- Scripts + full report: session scratchpad `scoutA/` (not committed).

### Scout B — state map (verified-by-reading)

- `store.chapter` conflates navigation anchor and visible chapter.
- Consumers meaning "visible": header title (App.tsx:38), BookPicker current
  highlight, `gr:lastRef` persistence. Meaning "navigation": Reader load
  effect (Reader.tsx:86, deps `[testament,bookNum,chapter]` — any write
  resets the 5-chapter window), SearchPanel scope, navigate targets.
- NO existing tests cover IntersectionObserver/scroll-anchor logic.

### Scout C — lexical sources (verified-by-execution/-reading)

- MACULA Greek LICENSE.md: `@gloss` = **Berean Interlinear** (public domain
  since 2023-04-30); `@english` = **Cherith** (CC BY 4.0). Never use
  `english` (or the UI's `gloss ?? english` fallback) for BSB/Berean stats.
- macula-greek pinned SHA: `8423afe47b9e8f24b7772e808af45c7159a6fe7e`.
- openscriptures/strongs has machine-parseable `<strongs_derivation>` +
  `<strongsref>` but is **GPL 3.0** → MIT-incompatible.
- Bundled `public/lexicon/strongs-greek.json` has no derivation data; its
  documented "CC BY-SA" provenance may be a mislabel — **flag to owner**.

### Scout D — progress-index sizing (verified-by-execution on 4 real books)

- vocab.ts keys: lexemeKey `${language}|${lemma}`; parseKey
  `${language}|${lemma??''}|${signature}` (signature prefers `morph` attr).
- GNT extrapolation: nested per-token Shape 1 ≈ 1.44 MB raw / 249 KB gzip;
  ~30k unique (lexeme,parse) pairs GNT-wide. OT (morpheme tokens) ~508k
  tokens / ~147k pairs, assumed ~1.5–2 MB gzip.

### Opus decision doc — data architecture (PRs 2+3), accepted by lead

1. **Derivation source: morphgnt/strongs-dictionary-xml (CC0)** — quoted CC0
   waiver verified. NOT openscriptures (GPL). Hebrew derivation (if pursued):
   STEPBible TBESH (CC BY 4.0, attributed). Label "Derived from" when
   `<strongsref>` refs exist; "Root"/primary only when Strong's text says so.
2. **Lexical identity**: `${language}|${normalizeStrong(strong)}` (existing
   normalizeStrong keeps homograph letter suffixes); lemma fallback
   documented. Gloss normalization (generator, raw `@gloss` only): NFC, trim,
   collapse whitespace, typographic→ASCII punctuation, strip trailing
   `.,;:`; case-fold for grouping but display most-frequent original casing.
   Missing-gloss tokens counted in total, omitted from distribution
   (documented).
3. **Word-study index**: single `public/wordstudy/gnt.json`
   `{strong: {t, g:[[gloss,n]…], d:[refs], dt, r}}`, est ≈250 KB gzip.
   Runtime fetch (like lexicon), NOT Vite import. Add `/wordstudy/` to
   `isCorpusRequest` in sw.ts + globIgnores; **bump CORPUS_CACHE
   corpus-v1→v2 in the same commit** (FL-001).
4. **Progress index**: Shape 3 per book — string tables `L`,`P` + unique-pair
   counts `c:[[li,pi,n]…]`; shards `public/progress/gnt.json` + `ot.json`
   (OT lazy; measure — split per-book if a shard >400 KB gzip). Coverage:
   token known iff pair's lexKey∈knownLexemes OR parseKey∈knownParses; sums
   over `n` → no double counting by construction. Generator imports
   lowfat.ts + vocab.ts under a DOM shim (like vitest/happy-dom) — one key
   implementation.
5. **Groundwork PR first**: `scripts/generate/` fetch→.cache→parse harness,
   `revisions.json` pinned SHAs, size report. No speculative abstraction.
6. **Hebrew scope**: word study — occurrences + Strong's + derivation
   (STEPBible) only; gloss distribution = truthful unavailable state (Cherith
   must not be shown as Berean/BSB). Progress analytics — both testaments.

## PR 1 approved design (Opus doc, accepted by lead 2026-07-20)

Implement in Reader.tsx + new pure module src/ui/anchor.ts:

- **Reflow fix**: ResizeObserver on the scroller, gated strictly on WIDTH
  delta. Continuously maintained midpoint anchor `{verseId, ratio}` — the
  `.verse` (id `v-{ch}-{v}`) containing the scroller's vertical midpoint,
  ratio = position of midpoint within that verse's rect. Captured on
  rAF-throttled scroll, after initial load, after the `[chapters]` layout
  effect, and after each width restore. On width change: scrollTop +=
  (anchored point's new y) − midpoint, instant, then recapture. Fully
  separate from FL-004's prepend `anchorRef` (height-delta, `[chapters]`
  effect) — no shared refs, no double-fire. `overflow-anchor:none` stays.
  Select-scroll effect unchanged (its visibility guard no-ops post-restore).
- **Visible chapter**: store gains `visibleChapter` + `setVisibleChapter`
  (writes ONLY visibleChapter; ~500ms-debounced `gr:lastRef` write, same
  shape, + pagehide flush). Computed by the same rAF scroll handler via pure
  `pickVisibleChapter` (midpoint containment primary, greatest visible
  intersection fallback), recomputed after range mutations and width
  restores. `navigate()`/`restorePosition()` also set it synchronously.
  Consumers switched: header title (App.tsx), BookPicker highlight,
  backup.ts lastRef. Unchanged on nav `chapter`: Reader load effect,
  anchorKey/rangeKey, SearchPanel scope, targetVerse flow. visibleChapter
  appears in NO data-loading dep array → loop impossible by construction.
- **Tests**: tests/reader-anchor.test.ts (7 pure-geometry cases),
  visible-chapter store/UI tests, browser-smoke additions: 5× open/close
  drift <6px at 768×1024 + 834×1112, select-while-open, rotation, header
  follows midpoint crossing John 1→2 with NO window reset.
- **Failure log**: new FL-006 (width-reflow ≠ FL-004 height-insertion),
  cross-linked to FL-004.

## Branch strategy (lead ruling)

Designated session branch `claude/ipad-reader-stability-nrdpvf` carries
PR 1 (scope matches its name). Owner brief explicitly names branches for
the other changes — treat as permission: `feat/generated-data-groundwork`
(harness, from origin/main), then `feat/lexeme-word-study`, then
`feat/vocabulary-progress` (each atop groundwork once merged/stacked).
No PR is opened until its branch passes all gates; owner merges.

## In flight (2026-07-20, may be stale if resuming cold)

- Sonnet implementer: PR 1 on `claude/ipad-reader-stability-nrdpvf`
  (main checkout) per the design above. Commits locally; lead reviews,
  then independent verification re-run, then Opus adversarial review,
  then push.
- DONE — groundwork **PR #15 MERGED to main** (squash ca8e8fd): generator
  harness (fetchPinned/.generate-cache, happy-dom shim over lowfat.ts,
  sizeReport, tsx runner), gates re-verified by lead (18 files/75 tests),
  pinned SHAs re-verified via git ls-remote. Owner authorized "PR and
  merge if done" (message 2026-07-20).
- PAUSED (stopped by user 2026-07-20, do not respawn without need):
  PR 2 `feat/lexeme-word-study` (worktree, off merged main, NO commits
  yet; started files: scripts/generate/wordstudy.ts, src/io/wordstudy.ts,
  tsconfig tweak). Resume = respawn an implementer from the spec below;
  all design decisions stand. Spec: generator reads RAW @gloss (Berean) only — @english inert;
  identity normalizeStrong (+lemma-fallback map); gloss normalization per
  decision doc; morphgnt strongsgreek.xml derivation (d/dt/r); output
  public/wordstudy/gnt.json (meta+strongs+lemmas); DetailPanel async
  "Word study" section (bars top 6–8 + Other + a11y table, Derived-from
  links via openStrongs, Hebrew = truthful unavailable); sw.ts
  isCorpusRequest += /wordstudy/ + CORPUS_CACHE bump same commit;
  globIgnores; ADR-0002; docs; own smoke docs/verification/
  wordstudy-smoke.mjs (port 4321).
- PAUSED (stopped by user 2026-07-20): PR 3 `feat/vocabulary-progress`
  (worktree, off merged main, NO commits yet; in progress: SettingsPanel
  button, sw.ts, docs rows, styles — generator was mid-run). Resume =
  respawn from the spec below; decisions stand. Spec: generator via lowfat converters + vocab.ts keys
  (never re-derived); Shape 3 per-book {L,P,c:[[li,pi,n]]} (li=-1 when no
  lexeme), shards public/progress/gnt.json + ot.json (split OT if >400 KB
  gzip); src/ui/progress.ts pure coverage (OR-semantics, no double count,
  0/0 safe); ProgressModal per KnownWordsModal conventions + Settings
  button beside Known words; live recompute on store change; sw.ts
  /progress/ + cache bump; docs; own smoke progress-smoke.mjs (port 4322).
  Known merge conflict PR2↔PR3: sw.ts/CORPUS_CACHE/vite globIgnores/
  config.md — lead merges PR 2 first, PR 3 rebases (bump becomes v3 if
  both land).

## Next literal command

If resuming cold: `git -C /home/user/GNTReader log --oneline -5` and
`git -C /home/user/GNTReader status --short` to see whether PR 1
implementation commits exist; `git worktree list` + `git branch -a` for the
groundwork branch. If implementation hasn't started, respawn implementers
from the two specs above (all design decisions in this file stand — do NOT
redo scouts or design). If commits exist, run the gates
(`npm run typecheck && npm run lint && npm test && npm run build`) and the
browser smoke (`npm run build && npm run preview -- --port 4319 &` then
`node docs/verification/browser-smoke.mjs`), then proceed to review.

## Verified commands

`npm ci` / `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`
all green at branch tip (build verified this session; suite last verified on
main per docs/restart.md).

## Failure-log entries relevant

FL-001 (cache bump discipline — PR 2/3 touch sw.ts), FL-004 (scroll
anchoring/observer recreation — PR 1 must not re-fight), FL-002 (relative
URLs — generated data fetched relatively).

## Open questions for the owner

- Existing `public/lexicon/*.json` provenance says "Open Scriptures … CC
  BY-SA" but openscriptures/strongs is GPL 3.0. Pre-existing possible
  mislabel; needs owner decision (separate from these PRs — new derivation
  data uses CC0 morphgnt instead).

## Beware

- Any write to `store.chapter` from scroll observers resets the reader
  window (Reader.tsx:86). Visible chapter must be a separate field.
- happy-dom cannot simulate reflow/gestures — real-browser verification
  mandatory (CLAUDE.md standing rule).
- tsconfig.app.tsbuildinfo is tracked and churns on build — do not commit
  artifact-only changes.
