---
name: project-proof-toolkit
description: Load when a claim must be proven rather than believed — "which commit broke this?", "are these implementations equivalent?", "is this result plausible?", "did my change cause the difference?" — or when review demands evidence stronger than reasoning. Provides proof recipes with worked transcripts: minimal reproduction, git bisect with an automated probe, differential testing, invariant checks, estimation, and controlled experiments.
---

# Proof Toolkit

The standard, stated once: **a claim is proven when the evidence would
convince a skeptical stranger without trusting the author.** These recipes
produce that kind of evidence. Reasoning supports; execution proves.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| The triage flow for an unknown breakage | `project-debugging-playbook` (it routes here for rigor) |
| What evidence a PR must contain (policy) | `project-validation-and-qa` |
| The measuring scripts (timing/size/smoke) | `project-diagnostics-and-tooling` |
| Statistical methodology for data claims | `analytics-reference` |

## Chooser

| Question | Recipe |
|---|---|
| Which commit broke it? | git bisect |
| What exactly triggers it? | minimal reproduction |
| Are two implementations (or before/after) equivalent? | differential testing |
| Is this property ever violated at runtime? | invariant checking |
| Is this number/result even plausible? | back-of-envelope estimation |
| Did my change cause the measured difference? | controlled experiment |

## Recipe: minimal reproduction

**Use when** you have a failing case but it's embedded in too much context to
reason about.

1. Copy the failing case somewhere disposable.
2. Delete half of the remaining input/code/config. Failure persists → keep
   deleting from what's left. Failure vanishes → restore, delete the other
   half. (This is binary search on the cause's location.)
3. **Done when removing anything makes the failure vanish** — every remaining
   piece is load-bearing. That's the definition; "it feels small" isn't it.
4. The final repro becomes the regression test (`project-validation-and-qa`).

Worked micro-example: a 300-line data pipeline "sometimes" crashes on a
40k-row CSV. Halving the CSV repeatedly → still crashes at 2 rows →
crashes at 1 specific row → the repro is one row with an unquoted comma in a
text field. The 300 lines were never the problem, and now the fix is obvious
— that redirect of attention is what minimization buys.

## Recipe: git bisect with an automated probe

**Use when** behavior regressed and a commit in a known range is the culprit.

1. Write a probe script that exits 0 on good, nonzero on bad — the same
   discipline as any test. It must not depend on uncommitted files (bisect
   checks out old commits under you).
2. Run:

```bash
git bisect start
git bisect bad                 # current commit is broken
git bisect good <known-good>   # e.g. a tag, or the first commit
git bisect run ./probe.sh      # automated binary search
git bisect reset               # ALWAYS return to your branch when done
```

Verified-by-execution 2026-07-03 on a throwaway 8-commit repo where commit
c5 silently broke a function; probe:
`python3 -c 'import lib; raise SystemExit(0 if lib.greet() == "ok" else 1)'`.
Real transcript (abridged):

```
Bisecting: 1 revision left to test after this (roughly 1 step)
Bisecting: 0 revisions left to test after this (roughly 0 steps)
[884b566…] c5: refactor greet
884b566… is the first bad commit
    c5: refactor greet
```

3 automated checkouts found the culprit in an 8-commit range —
bisect is log₂(N): 1000 commits ≈ 10 probe runs.

**Done when** the reported first-bad-commit's diff explains the symptom AND
the probe confirms: parent good, culprit bad. If the diff *can't* explain the
symptom, distrust the probe (flaky probe = garbage bisect —
`project-validation-and-qa` flaky rules apply to probes too).

## Recipe: differential testing

**Use when** two things should behave identically: old vs new implementation,
refactor vs original, library vs hand-rolled.

Run both on the **same generated inputs** and compare outputs. Verified
2026-07-03 (fixed seed, 200 random lists, comparing `sorted()` against a
hand-rolled sort):

```python
import random
random.seed(1)                       # reproducible disagreement hunting
for trial in range(200):
    xs = [random.randint(-50, 50) for _ in range(random.randint(0, 20))]
    assert sort_a(xs) == sort_b(xs), f"diverged on {xs}"
print("differential: 200 random inputs, no divergence")
```

- The assert message prints the diverging input — that input then gets
  minimized (recipe above) and becomes a regression test.
- Include the empty/degenerate cases in generation (length 0 above).
- **Done when**: N diverse inputs, zero divergence (state N), or a divergence
  found — either result is a proof, one of equivalence-so-far, one of
  difference.
- Before/after a refactor this is the strongest cheap evidence that behavior
  was preserved.

## Recipe: invariant checking

**Use when** correctness means "property P always holds" (balances sum to
zero, output is sorted, IDs unique) — properties eyes skip over in output.

Assert P **in-flight**, at the seams, instead of inspecting final output:

```python
assert len(set(r["id"] for r in rows)) == len(rows), "duplicate ids after join"
```

- A violated invariant kills the run at the first violation — near the cause
  — rather than at the report, far from it (`analytics-reference` uses this
  as its assertion layer; starter invariants per domain:
  `project-architecture-contract`).
- Keep the asserts in: they are executable documentation and permanent
  tripwires. Only gate them out where measured cost forbids
  (`project-diagnostics-and-tooling` to measure, not vibes).
- Optional extension (labeled optional, adds a dependency): property-based
  testing (Hypothesis/fast-check) generates the inputs for you.

## Recipe: back-of-envelope estimation

**Use when** judging whether a number — runtime, size, count, cost — is
plausible, *before* trusting it or the code that produced it.

1. **Predict before measuring**, from first principles, to an order of
   magnitude.
2. Measure.
3. **Off by >10× → your model of the system is wrong** — that's a finding:
   stop and find the missing factor before proceeding; it is usually the bug.

Worked example (verified 2026-07-03): predict `sum(range(10_000_000))` in
CPython. Model: pure-Python loop work runs at very roughly 10⁷–10⁸ simple
operations/sec → 10⁷ iterations ≈ 100ms–1s. Measured: **163ms**. Model holds
(within 10×), so trust extends to the next estimate built on it. Had it
measured 5ms, the right response is not "great, it's fast" but "my model is
wrong — what am I actually measuring?" (e.g. an optimized path, or the work
didn't happen).

## Recipe: controlled experiment

**Use when** attributing a measured difference to a cause.

1. **One variable.** Same machine, same data, same everything except the one
   change (flag, version, implementation).
2. **N ≥ 5 runs per condition, compare medians** — use `timeit.sh` from
   `project-diagnostics-and-tooling`.
3. Difference in medians ≫ the within-condition spread → attributable.
   Difference within the spread → you measured noise; say so.
4. Record both command lines with both results in the PR — the pair is the
   evidence (`project-validation-and-qa` thresholds decide "how much better
   is enough", fixed before running).

## Instantiation

Usable as-is in any project. When instantiating: nothing to customize, but
wire the recipes to local reality — the probe script pattern into
`tests/`, invariants into the pipeline seams, and cite this skill's recipes
by name in PR evidence so reviewers know the method used.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  full bisect runbook on a constructed 8-commit repo (transcript above,
  culprit found and confirmed), the differential harness (200 seeded random
  inputs), and the estimation example (predicted 100ms–1s, measured 163ms).
  Asserted from settled practice (verified-by-reading): minimization's
  done-criterion, invariant placement guidance, the >10× rule of thumb.
- Re-verify bisect quickly: any repo, `git bisect start && git bisect reset`
  (mechanics), or rebuild the demo: 8 commits, break one file mid-history,
  probe with a one-line python check as above.
- Re-verify estimation example:
  `python3 -c "import time; t=time.perf_counter(); sum(range(10_000_000)); print(f'{(time.perf_counter()-t)*1000:.0f}ms')"`
  (machine-dependent; the *prediction discipline* is the content, not 163).
- Cross-references: `ls .claude/skills/` — every sibling named here must exist.
