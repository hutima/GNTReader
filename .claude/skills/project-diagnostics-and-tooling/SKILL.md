---
name: project-diagnostics-and-tooling
description: Load when a claim needs a number — performance ("is it slower?"), size budgets, environment drift ("works on my machine"), deploy/server health — or before writing "faster", "smaller", or "fixed" in any PR. Ships four tested scripts (env-doctor.sh, smoke-http.sh, timeit.sh, size-report.sh) with interpretation guides, plus the measurement discipline (medians, N≥5, one variable) that makes before/after numbers trustworthy.
---

# Diagnostics and Tooling

Doctrine: **measure, don't eyeball.** Every performance, size, health, or
drift claim carries a number or a transcript produced by a command someone
else can rerun. This skill ships the commands (in `scripts/`, relative to this
skill's directory) and the discipline for using them.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| What evidence a PR must contain (policy) | `project-validation-and-qa` |
| Proof *methods* (bisect, differential, estimation) | `project-proof-toolkit` |
| To fix a broken environment (not just detect it) | `project-build-and-env` |
| Browser-side PWA verification | `pwa-reference` |

## The scripts

All four verified-by-execution 2026-07-03 (bash 5.2; transcripts below are
real output). Copy `scripts/` into instantiated projects (conventionally to
the project's own `scripts/` or keep inside `.claude/skills/…/scripts/`).

### env-doctor.sh — is this environment what the project expects?

```bash
scripts/env-doctor.sh tool[:min-version] [more...]
scripts/env-doctor.sh node:22 python3:3.11 git jq
```

Captured output — healthy environment (exit 0):

```
TOOL         WANT>=     FOUND        RESULT
node         22         22.22.2      PASS
python3      3.11       3.11.15      PASS
git          any        2.43.0       PASS
jq           any        1.7          PASS
```

Captured output — failing (exit 1):

```
TOOL         WANT>=     FOUND        RESULT
node         99         22.22.2      FAIL
rscript      any        missing      FAIL
```

Interpretation: `missing` = not on PATH → install or activate (venv/nvm —
`project-build-and-env`); a version FAIL = drift → align to the pin, don't
"try anyway" (drifted runs produce unexplainable results). Run it: at session
start on an unfamiliar machine, in the fresh-clone gate, and whenever two
machines disagree ("fails only in CI" → run on both, diff the tables).

Limits (honest): it reads the *first dotted number* from `<tool> --version`;
tools with exotic version output may show `unknown` (counts as FAIL when a
minimum was requested).

### smoke-http.sh — is the served thing actually serving?

```bash
scripts/smoke-http.sh URL [EXPECTED_STATUS] [CONTENT_MARKER]
scripts/smoke-http.sh http://localhost:8000/manifest.webmanifest 200 '"start_url"'
```

Captured output:

```
PASS http://localhost:8124/manifest.webmanifest — status 200, marker found
FAIL http://localhost:8124/nope.html — status 404 (expected 200)
```

Interpretation: status FAIL on a *deployed* URL after a deploy = wrong
artifact/path (GitHub Pages base paths — `pwa-reference`); marker FAIL with
status 200 = the server answered with the *wrong content* (index fallback,
stale cache) — that combination is the classic silent deploy failure. Marker
choice: a string unique to the *new* version (e.g. the new cache-version
constant), so the check distinguishes old-but-200 from new.
Run it: after every deploy/release, in the PR/release evidence
(`project-run-and-operate`).

### timeit.sh — is it actually faster/slower?

```bash
scripts/timeit.sh N -- command [args...]
scripts/timeit.sh 5 -- python3 scripts/analysis.py
```

Captured output (exit 0; failing command aborts with exit 1 and no numbers):

```
runs=5 min=19ms median=20ms max=21ms
```

Interpretation: compare **medians**, not single runs or means (one GC pause
or cache miss poisons a mean). min≈median≈max like above = stable
measurement; max >> median = noisy — raise N or quiet the machine before
concluding anything. The command's own output is discarded — verify the
command works once before timing it.

### size-report.sh — is the artifact within budget?

```bash
scripts/size-report.sh [-t MAX_BYTES] path [path...]
scripts/size-report.sh -t 250000 dist/ index.html
```

Captured output:

```
BYTES        BUDGET   PATH
786          250000   /tmp/…/sw.js
1140         250000   /tmp/…
```

Over budget prints `OVER` on the row and exits 1. Interpretation: budgets are
acceptance thresholds — set them *before* measuring and store them where
thresholds live (`project-validation-and-qa`, `docs/config.md`). A sudden
size jump with no intended asset change usually means an accidental inclusion
(sourcemaps, data files) — list the directory before raising the budget.

## Measurement discipline

The scripts produce numbers; these rules make the numbers mean something:

1. **Same machine, same session** for before/after. Cross-machine timing
   comparisons are noise wearing a suit.
2. **N ≥ 5 runs, compare medians** (`timeit.sh` does this for you).
3. **One variable at a time** — measure, change one thing, measure again.
   Two changes per measurement = zero attributable changes
   (`project-proof-toolkit`, controlled experiment).
4. **Record the exact command next to the result** in the PR — a number
   without its command is unreproducible and therefore not evidence.
5. **Warm vs cold**: decide which you're measuring (first run pays
   caches/JIT). `timeit.sh`'s min-vs-max spread shows you when this matters.

## External tools

| Tool | Status in authoring sandbox (2026-07-03) | Check before relying |
|---|---|---|
| Browser DevTools (network/SW panels) | n/a (browser step) | — manual; see `pwa-reference` |
| Lighthouse | not installed; `npx lighthouse` is network-dependent | `npx --yes lighthouse --version` |
| hyperfine (better timeit) | not installed | `command -v hyperfine` |

Prefer the shipped scripts as the baseline: zero-install, work everywhere the
kit works. Adopt the fancier tool only when it's pinned into the project
(`project-build-and-env`).

## Instantiation

When this kit seeds a real project:

- Copy the four scripts; wire the relevant ones into the project verbs
  (e.g. `"deploy-check": "scripts/smoke-http.sh https://… 200 '<marker>'"`).
- Set the project's real minimums in the env-doctor invocation and record it
  in the README (the fresh-clone gate should call it).
- Set initial size/latency budgets in `docs/config.md` with today's date.

## Provenance and maintenance

- Authored 2026-07-03. All four scripts verified-by-execution in the
  authoring sandbox: syntax (`bash -n`), pass paths, fail paths, and exit
  codes (env-doctor 0/1, smoke-http 0/1 incl. 404 and marker cases, timeit
  0/1 incl. nonzero-command abort, size-report 0/1 incl. OVER). Transcripts
  above are captured, lightly abridged (paths shortened). **Not verified
  here**: Lighthouse/hyperfine (absent), macOS `date +%s%N` behavior
  (timeit.sh assumes GNU date — on macOS install coreutils or re-verify).
- Re-verify all four in ~15s:
  `cd .claude/skills/project-diagnostics-and-tooling/scripts && ./env-doctor.sh git && ./size-report.sh . && ./timeit.sh 3 -- true && (python3 -m http.server 8199 >/dev/null 2>&1 & sleep 0.5; ./smoke-http.sh http://localhost:8199/ 200; kill %1)`
- Scripts are behavior-carrying: changes to them are behavior-changing
  changes (`project-change-control`) and require rerunning the fail-path
  tests, not just the happy path.
