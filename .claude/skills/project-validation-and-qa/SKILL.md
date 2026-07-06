---
name: project-validation-and-qa
description: Load when deciding whether a change is proven, adding or bootstrapping tests, setting or judging acceptance thresholds, updating golden/expected files, handling a flaky test, or writing the Verification section of a PR. Defines the evidence hierarchy ("looks right" is not evidence), per-stack test recipes (Node, Python, R), golden-file policy, and the flaky-test quarantine protocol.
---

# Validation and QA

The policy layer for evidence: what counts as proof that a change works, how
tests are structured and bootstrapped, and the rules for golden files,
thresholds, and flakes. `project-change-control` demands a verification
statement in every PR; this skill defines what may appear in it.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Merge gates and change classes | `project-change-control` |
| Measurement scripts (timing, size, smoke) | `project-diagnostics-and-tooling` |
| Proof *methods* (bisect, minimal repro, differential) | `project-proof-toolkit` |
| Session-side claim labeling | `ai-session-discipline` |
| Domain test mechanics (SW offline, CLI subprocess, data checks) | `pwa-reference` / `cli-reference` / `analytics-reference` |

## The evidence hierarchy

Higher rows beat lower rows. A PR's Verification section must cite tier 1 or
tier 2 evidence for the change class it claims (`project-change-control`).

| Tier | Evidence | Example | Acceptable for |
|---|---|---|---|
| 1 | **Executed automated test** | `npm test` output pasted, includes the new/changed test | everything |
| 2 | **Executed manual reproduction with transcript** | commands + output showing before/after behavior | behavior changes where a test is impractical — with a stated reason |
| 3 | **Static reasoning** | "the null check dominates this path" | supporting argument only; never sufficient alone |
| 4 | **Appearance** | "looks right", "compiles", "renders fine" | nothing. This is not evidence. |

Rules:

- Evidence is **pasted, not paraphrased**. "Tests pass" without output is a
  tier-4 claim wearing a tier-1 costume.
- Tier 2 evidence must show the **failing case first**, then the same case
  passing. A transcript that only shows success proves nothing about the fix.
- Reasoning (tier 3) accompanies evidence; it never substitutes for it.

## Thresholds: fixed before running

An acceptance threshold (test count, coverage floor, size budget, latency
budget, error tolerance) is decided and written down **before** the check runs.

- **Why**: a threshold chosen after seeing the number is a description, not a
  gate — this is how goalposts move without anyone deciding to move them.
- **Where**: in the test itself (assertion), or in the config catalog
  (`docs/config.md`, see `project-config-and-flags`) when shared across checks.
- **Changing one is a behavior-changing change**: PR explaining why the new
  threshold is right, through `project-change-control`. "The check was red" is
  not a reason.

## Test structure per stack

Definitions, once: a **unit test** exercises one function/module in isolation;
an **integration test** exercises components together (real files, real
subprocess); an **end-to-end (e2e) test** exercises the shipped artifact the
way a user runs it. Small projects need a handful of each, weighted toward the
bottom of that list — an e2e smoke catches whole classes a unit test can't.

### Node (verified-by-execution 2026-07-03, node 22.22.2)

The built-in runner discovers `*.test.mjs` (also `*.test.js`) — no install:

```bash
# tests/math.test.mjs
# import { test } from 'node:test';
# import assert from 'node:assert/strict';
# test('adds', () => { assert.equal(1 + 2, 3); });
node --test            # discovers and runs; exit 0 on pass
```

Expected output shape (yours will differ in duration):

```
# tests 1
# pass 1
# fail 0
```

Wire it as the canonical verb: `"scripts": { "test": "node --test" }` →
`npm test`.

### Python (verified-by-execution 2026-07-03, python 3.11.15)

stdlib `unittest` discovers `test_*.py` — no install. Put tests under `tests/`
(the kit default layout) and discover them explicitly:

```bash
# tests/test_math.py
# import unittest
# class TestMath(unittest.TestCase):
#     def test_adds(self):
#         self.assertEqual(1 + 2, 3)
python3 -m unittest discover -s tests -v   # exit 0 on pass, output ends "OK"
```

**Trap (verified 2026-07-03):** plain `python3 -m unittest -v` does NOT find
tests in a `tests/` subdirectory — it prints `Ran 0 tests … OK` and exits 0,
a silent false pass. Always `discover -s tests` for the kit's layout; the bare
form only works when `test_*.py` sits at repo root.

`pytest` is the better tool when available, but it is a dependency — pin it in
`requirements.txt` (`project-build-and-env`) before making it the canonical
entry point.

### R (NOT verifiable in the authoring sandbox — R not installed; treat as pattern, re-verify on first use)

`testthat` is the standard: tests in `tests/testthat/test-*.R`, run via
`Rscript -e 'testthat::test_dir("tests/testthat")'`. Pin via `renv`.

### Domain-specific layers

- PWA: offline smoke + install checklist → `pwa-reference`.
- CLI: subprocess golden-output tests → `cli-reference`.
- Analytics: data sanity assertions + pipeline goldens → `analytics-reference`.

## Golden files

A **golden file** (also "snapshot" or "expected file") is a committed expected
output compared against actual output, byte-for-byte or with a stated
tolerance. Convention: they live in `tests/golden/`.

The iron rule: **a golden file is only updated by a reviewed change that
explains why the new output is more correct than the old.** Updating a golden
to silence a failing test — without that diagnosis — is destroying the
project's memory of what "correct" means. Golden updates are
destructive-class changes (`project-change-control`), and regenerating them is
never delegated to the junior tier and never combined in one commit with the
code change that altered the output (two commits: the reviewer must be able to
see behavior change and expectation change separately).

Tolerances: for floating-point or timing-adjacent output, compare with an
explicit tolerance written into the test — never exact equality
(`analytics-reference` covers why).

## Bootstrapping tests in a project that has none

1. **First test = the fresh-clone smoke**: build it, run it, assert one
   visible fact (the CLI's `--version` exits 0; the page serves HTTP 200; the
   analysis produces an output file). Wire it to the `test` verb. This single
   test converts "works on my machine" into a checked claim
   (`project-build-and-env` owns the fresh-clone gate).
2. **Grow tests around bugs**: every bug fixed gets a regression test that
   fails before the fix and passes after, named/commented with its failure-log
   ID (`FL-NNN`, see `project-failure-archaeology`). Bugs mark exactly where
   tests earn their keep.
3. **Test the seams you rely on**: parser in/out, file formats, exit codes —
   before refactoring near them, not after.

Coverage percentage is a diagnostic, not a goal; a coverage target adopted as
a goal produces assertion-free tests that satisfy it.

## Flaky tests

A **flaky test** passes and fails on the same code. Policy:

1. **Quarantine, don't delete**: move/mark it skipped with a link to a
   failure-log entry (`FL-NNN`) and an owner. A deleted flake is a bug report
   burned.
2. **Rerun-until-pass is banned as evidence.** A suite that passed on retry
   has not passed; it has been sampled favorably.
3. Diagnose with `project-debugging-playbook` (flaky row of the triage table);
   the usual mechanisms are time, ordering, shared state, and network.
4. A quarantined test older than its stated review date blocks new quarantines
   — flakes must not accumulate silently.

## Writing the Verification section (PR template)

```markdown
## Verification
- `npm test` → 14/14 pass (output below)      ← tier 1
- Manual repro of FL-012: before → error, after → correct output (transcript below)  ← tier 2
- Not verified: behavior under R 4.x (no R in this environment) — labeled assumed.
<details><summary>output</summary>… pasted output …</details>
```

Claims outside the tiers get labeled per `ai-session-discipline`.

## Instantiation

When this kit is copied into a real project:

- Choose the canonical test entry point (the `test` verb) and record it in the
  README Run section (`project-run-and-operate`).
- Create `tests/` and `tests/golden/` (even if empty) and the fresh-clone
  smoke as test #1.
- Set the project's initial thresholds (size/latency budgets if relevant) in
  `docs/config.md` with today's date.
- Delete the stack sections that don't apply; re-verify the R section on first
  use if kept.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  `node --test` recipe (node 22.22.2, including `*.test.mjs` auto-discovery)
  and the `python3 -m unittest discover -s tests -v` recipe (python 3.11.15),
  both with the expected-output shapes shown — including the confirmed
  `Ran 0 tests … OK` silent false pass from the bare form against a `tests/`
  subdir. **Not verified here**: the R/testthat pattern (R not installed) and
  pytest behavior (not installed) — labeled above.
- Re-verify Node recipe: `cd $(mktemp -d) && printf 'import {test} from "node:test";\nimport assert from "node:assert/strict";\ntest("t",()=>assert.equal(1,1));\n' > a.test.mjs && node --test`
- Re-verify Python recipe: `cd $(mktemp -d) && mkdir tests && printf 'import unittest\nclass T(unittest.TestCase):\n    def test_a(self):\n        self.assertTrue(True)\n' > tests/test_a.py && python3 -m unittest discover -s tests -v`
- Cross-references: `ls .claude/skills/` — every sibling named here must exist.
