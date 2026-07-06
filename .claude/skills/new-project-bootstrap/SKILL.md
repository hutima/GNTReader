---
name: new-project-bootstrap
description: Load when standing up a brand-new project or repo, or when asked to "set up a project with best practices", scaffold a PWA/CLI/analytics project, or instantiate this skill library into a new codebase. An executable, decision-gated campaign - phases 0-5 with exact commands, expected observations at every gate, if-you-see-X-instead branches, fenced-off wrong paths, and a measurable completion checklist. Not for existing projects.
---

# New-Project Bootstrap Campaign

This is the kit's instantiator: the campaign that takes an empty directory to a
project where every later skill has something to grip — pins, docs of record,
a test verb, and a proven change pipeline. It is written so a junior-tier
(Sonnet-class) session can execute it end-to-end; every gate is a command
result, never a judgment call.

**Structure**: 6 phases. Each phase has commands, an EXPECT block (what you
must observe), and a GATE (what must be true to proceed). If an EXPECT fails,
use the branch table in that phase — do not improvise forward.

## When NOT to use this skill

| Situation | Use instead |
|---|---|
| The project already exists | the specific skill for your task (`ai-session-discipline` has the routing table) |
| Env is broken on an existing project | `project-build-and-env` |
| You only need a design decision recorded | `project-architecture-contract` |

## Phase 0 — Decisions (produce ADR-0001)

No scaffolding before deciding. Fill this table (the day-one checklist details
live in `project-architecture-contract`):

| Decision | Options | Record as |
|---|---|---|
| Domain | PWA / CLI / analytics / other | drives layout + which reference skill applies |
| Name | short, lowercase, hyphenated | repo + package name |
| Runtime + pin | e.g. Node 22 / Python 3.11 / R (version) | pin files in phase 1 |
| Test entry point | `node --test` / `python3 -m unittest discover -s tests` / testthat | the `test` verb |
| Deploy target | GitHub Pages / npm / committed reports / none yet | phase 5 + `project-run-and-operate` |
| License | e.g. MIT / proprietary | LICENSE file |

Write `docs/adr/0001-day-one-decisions.md` using the ADR template from
`project-architecture-contract`, one row per decision with a one-line reason.

**GATE 0**: ADR-0001 exists and every row above has a value. A blank row =
stop and ask the owner; do not pick silently on their behalf.

## Phase 1 — Scaffold

```bash
mkdir <name> && cd <name>
git init -b main
mkdir -p docs/adr tests
: > docs/failure-log.md
: > docs/config.md
```

Then per domain (layout rationale in the domain reference skills):

| Domain | Additional layout | Pin files |
|---|---|---|
| PWA | `index.html`, `manifest.webmanifest`, `sw.js`, `icons/` (`pwa-reference`) | none (no build step) |
| CLI (Node) | `bin/cli.js`, `package.json` with `bin` + `scripts.test` (`cli-reference`) | `.nvmrc`, `package-lock.json` via `npm install --package-lock-only` |
| CLI (Python) | `tool.py` or package dir (`cli-reference`) | `requirements.txt` (may start empty), README states Python version |
| Analytics | `data/raw/`, `data/derived/`, `scripts/`, `reports/` (`analytics-reference`) | `requirements.txt` / `renv.lock` |

Now the three files every project gets, regardless of domain:

1. **README.md** — skeleton from `project-docs-and-writing`; the Quickstart
   section stays empty until phase 2 proves it (write it from the transcript,
   not ahead of it).
2. **First test** — the fresh-clone smoke (`project-validation-and-qa`
   bootstrap rule): one assertion that the entry point exists/runs, in `tests/`.

   Python layout — run with `python3 -m unittest discover -s tests -v`:

   ```python
   # tests/test_smoke.py
   import unittest, pathlib
   class TestSmoke(unittest.TestCase):
       def test_entrypoint_exists(self):
           self.assertTrue(pathlib.Path("README.md").exists())
   ```

   Node layout — run with `node --test`:

   ```js
   // tests/smoke.test.mjs
   import { test } from 'node:test';
   import assert from 'node:assert/strict';
   import { existsSync } from 'node:fs';
   test('entrypoint exists', () => { assert.ok(existsSync('package.json')); });
   ```

3. **.gitignore** — at minimum: `.venv/`, `node_modules/`, `dist/`, `.env`,
   `data/derived/` per domain (`project-run-and-operate` artifact table).

```bash
git add -A && git commit -m "Scaffold <name>: layout, pins, docs of record, smoke test"
```

**EXPECT**: `git log --oneline` shows 1 commit; `ls docs/` shows `adr`,
`config.md`, `failure-log.md`.

**GATE 1**: the test verb runs and passes locally. For the Python layout
above that is `python3 -m unittest discover -s tests -v` — note the
`discover -s tests`: plain `python3 -m unittest` does NOT find tests in a
`tests/` subdirectory without it (verified 2026-07-03; with test files at
repo root the plain form works).

| If you see | It means | Do |
|---|---|---|
| `Ran 0 tests` | discovery missed your files | file must be named `test_*.py`; use `discover -s tests`; check for typos |
| `ModuleNotFoundError` | venv not active / dep not pinned | `project-build-and-env` Python recipe, then return here |

## Phase 2 — Environment gate (fresh clone)

Prove the quickstart by executing it somewhere your working state can't help:

```bash
d=$(mktemp -d) && git clone <repo-or-local-path> "$d/fresh" && cd "$d/fresh"
# follow your DRAFT quickstart VERBATIM, ending with the test verb
python3 -m unittest discover -s tests -v   # or the project's test verb
echo "gate exit=$?"
```

**EXPECT** (real transcript from this campaign's authoring demo, 2026-07-03,
minimal Python scaffold):

```
Ran 1 test in 0.004s

OK
gate exit=0
```

**GATE 2**: every quickstart command exits 0 exactly as written. Now write
that transcript into README Quickstart. The gate is command-passing — "it
obviously works" does not pass it (see fenced wrong paths).

| If you see | It means | Do |
|---|---|---|
| A command you "had to add" | quickstart was written from memory | add it to the README, re-clone, re-run the whole gate |
| Pass in working dir, fail in fresh clone | untracked file or global install doing hidden work | `git status --ignored`; move the dependency into pins; re-gate |

## Phase 3 — Instantiate the skill library

```bash
# from the seed repo checkout:
cp -R <seed-repo>/.claude/skills <newproj>/.claude/
```

Skills are never copied blind — each has an **Instantiation** section stating
what to customize. Walk this checklist and tick every row in the PR body:

- [ ] `project-change-control`: owner identity; project examples per class
- [ ] `ai-session-discipline`: current tier names + as-of date
- [ ] `project-build-and-env`: keep only this project's stack recipe; fill pins
- [ ] `project-validation-and-qa`: record the test verb; create `tests/golden/`
- [ ] `project-run-and-operate`: fill the Run section verbs (`dev`/`test`/`build`)
- [ ] `project-config-and-flags`: start `docs/config.md` from its template
- [ ] `project-architecture-contract`: pick the domain's starter invariants
- [ ] domain reference (`pwa-reference` / `cli-reference` / `analytics-reference`): keep the matching one; the other two may be deleted in single-domain projects
- [ ] `.claude/skills/README.md` (library index): update statuses/inventory if any skill was dropped

**GATE 3**: `ls .claude/skills/` in the new project shows the kept skills;
every kept skill's Instantiation checklist is addressed in the PR body.

## Phase 4 — First change through the full pipeline

Prove change control works before real work starts. Make one trivial,
behavior-visible change (e.g. `--version` output, README-verified command),
taken through the entire pipeline of `project-change-control`:

```bash
git checkout -b feat/pipeline-proof
# 1. write/adjust the test FIRST, watch it fail
# 2. make the change, watch it pass
# 3. run the full test verb
```

PR body uses the five-section template (What / Why / Verification / Claims /
Docs updated) with real pasted output. Merge only when the reviewer checklist
passes.

**GATE 4** — expected artifacts, all present:
merged PR with the five sections; a test that demonstrably failed before and
passes after; docs of record untouched-or-updated deliberately (stated in the
PR); branch deleted after merge.

## Phase 5 — Promotion

Tagging a release is a **destructive/irreversible-class** change
(`project-change-control`): it requires explicit owner sign-off and is **never
executed by the junior tier on its own authority**. A junior-tier session
runs Phases 0–4, then **stops here and hands off** (`ai-session-discipline`
handoff template) with the completion checklist below filled in; the owner (or
lead) reviews and runs the tag.

```bash
# only after owner sign-off is recorded (see project-change-control):
git tag v0.1.0
```

- CHANGELOG.md gets its first entry (`project-docs-and-writing` format).
- README claims check: every capability claimed in the README has a command a
  stranger can run to observe it (claim discipline, `project-docs-and-writing`).
- Deploy target from ADR-0001, if any, exercised once via
  `project-run-and-operate`, smoke-checked via `project-diagnostics-and-tooling`.

**GATE 5 — campaign completion checklist** (all must exit 0 / be true):

- [ ] fresh-clone gate passes (re-run phase 2 command block)
- [ ] test verb passes
- [ ] `test -s docs/adr/0001-day-one-decisions.md`
- [ ] `test -f docs/failure-log.md && test -f docs/config.md`
- [ ] `ls .claude/skills/` shows the instantiated library
- [ ] one merged PR exists with the five-section body
- [ ] `git tag --list v0.1.0` prints the tag

Done means every box, not most boxes.

## Fenced-off wrong paths

| Wrong path | Why it is fenced |
|---|---|
| Scaffolding from memory without pins | the first consumer (including future-you) gets a different environment; the drift bill arrives weeks later as "works on my machine" |
| Copying skills without instantiating | placeholder conventions silently diverge from the project's reality; every skill that references them now lies |
| Skipping the fresh-clone gate ("it obviously works") | your working directory carries hidden state — untracked files, global installs, an activated venv. The gate exists because "obviously" has been wrong often enough to be a settled battle |
| Making the first change outside the pipeline | phase 4 is a drill: it proves the gates work while a failure is still free. Skip it and the first real (expensive) change becomes the drill |
| Deferring `docs/failure-log.md` "until there are failures" | the log must predate the first investigation, or the first investigation isn't recorded and the archaeology never starts |

## Instantiation

This skill is the instantiator; it stays in the seed repo and travels into new
projects unchanged (usable as-is). After a project is bootstrapped, this skill
may be deleted from that project's copy — its job is done there.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  full phase 1-2 sequence on a minimal Python scaffold (git init → layout →
  smoke test → fresh clone → `python3 -m unittest discover -s tests -v` →
  `OK`, exit 0 — transcript excerpted in phase 2), including the
  discovery trap (`discover -s tests` required for `tests/` subdirectories).
  **Not verified here**: PWA/CLI/analytics-specific scaffold contents (owned
  and verified by their reference skills), tag/deploy operations against real
  remotes (network/credentials).
- Re-verify the gate demo:
  `d=$(mktemp -d) && cd $d && git init -q -b main x && cd x && mkdir tests && printf 'import unittest\nclass T(unittest.TestCase):\n    def test_a(self):\n        self.assertTrue(True)\n' > tests/test_smoke.py && python3 -m unittest discover -s tests -v`
- Re-verify cross-references: `ls .claude/skills/` — every sibling named here
  must exist.
