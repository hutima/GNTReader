---
name: project-debugging-playbook
description: Load when something is broken and the cause is unknown — errors, wrong output, crashes, flaky behavior, "works locally but not deployed", "worked yesterday", regressions after upgrades — or when a fix attempt just failed. Provides the debugging loop, a symptom→triage table, the time-sink traps with why each burns hours, discriminating-experiment recipes, and the mandatory stop conditions.
---

# Debugging Playbook

Debugging is hypothesis testing under time pressure. The failure mode isn't
ignorance — it's skipping steps: fixing before reproducing, changing three
things at once, trusting a cache. This playbook is the loop plus the guardrails
that keep a session out of the classic holes.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Environment won't build / installs fail | `project-build-and-env` |
| Rigorous proof methods (bisect runbook, minimal repro, differential) | `project-proof-toolkit` |
| To measure (timing, sizes, smoke) | `project-diagnostics-and-tooling` |
| To land the fix once found | `project-change-control` |
| Domain mechanics (stale service worker, CLI exit codes, data checks) | `pwa-reference` / `cli-reference` / `analytics-reference` |

## Step zero — search the failure log

Before any investigation (this is mandatory, and it's the cheapest step):

```bash
grep -in "<error text or symptom keyword>" docs/failure-log.md
```

A hit means the battle is settled: follow the entry's fix/decision and cite its
`FL-NNN` ID. Re-fighting settled battles is the exact waste
`project-failure-archaeology` exists to prevent.

## The debugging loop

1. **Reproduce.** One command (or short script) that shows the failure on
   demand. No reproduction → no debugging; you'd be theorizing. Capture the
   exact output.
2. **Minimize.** Shrink input/config/code until everything left is
   load-bearing (recipe in `project-proof-toolkit`). Small repros point at
   causes; big ones hide them.
3. **Hypothesize — in writing, with a prediction.** "I believe X because Y;
   if true, doing Z will show W." A hypothesis that doesn't predict an
   observation is a vibe.
4. **Run the discriminating experiment.** The cheapest action whose outcome
   *differs* depending on whether the hypothesis is true (menu below). Record
   the result either way — negatives are evidence too.
5. **Fix** — the smallest change that addresses the *cause*, not the symptom.
6. **Prove the fix on the original reproduction** — the failing case from
   step 1 must now pass, then the wider test verb
   (`project-validation-and-qa`). Add the regression test citing the FL ID.
7. **Record.** If this took >30 min, was a revert, or killed an approach:
   failure-log entry (`project-failure-archaeology` owns the format).

## Symptom → triage table

| Symptom | First suspects, in order | Discriminating first move |
|---|---|---|
| Works locally, broken deployed | path/base-URL differences; stale deploy artifact; env vars unset; cache layers | `curl` the deployed asset and diff against local (`project-diagnostics-and-tooling` smoke script); for PWAs suspect the service worker first → `pwa-reference` |
| Worked yesterday, broken today | what changed: your commits, dependency drift, external service | `git log --since=yesterday --oneline`; if nothing local, diff the lockfile; then bisect (`project-proof-toolkit`) |
| Intermittent / flaky | time/timezones, ordering, shared state, network | run the failing case 20× in a loop and record the pass rate — make randomness a number, then vary one factor (`project-validation-and-qa` flaky policy) |
| Silently wrong output | wrong input actually read; unit/format confusion; float comparison; error swallowed by a broad catch | print/assert at the boundary: dump exactly what was read and what was produced at the first seam |
| Environment won't build | (not this skill) | → `project-build-and-env`, then its fresh-clone gate |
| Slow / perf regression | measure before theorizing | `timeit.sh` before/after on the suspect command → `project-diagnostics-and-tooling` |
| Fails only in CI / other machine | version skew, case-sensitivity, CRLF, missing pin | run `env-doctor.sh` in both places and diff (`project-diagnostics-and-tooling`) |
| Error message points at line N | the *symptom* lives at N; the cause is often upstream data/state | read the failing value's provenance backward from N before editing N |

## Time-sink traps

Each of these is an industry-settled way to lose hours (class-level seeds in
`project-failure-archaeology`):

| Trap | Why it burns time |
|---|---|
| **Fixing without a reproduction** | you can't tell whether you fixed it — so you "fix" it repeatedly. The fix-verify loop has no signal. |
| **Shotgun changes** (3 edits per attempt) | when it passes you don't know which edit mattered — and the other two are now unexplained behavior nobody meant to ship. One variable per attempt. |
| **Trusting caches** | npm/pip caches, browser cache, service-worker cache each serve you *old* code while you debug *new* code; hours vanish debugging a build you already fixed. Reproduce from clean state before theorizing (SW specifics: `pwa-reference`). |
| **Testing a different build than you edited** | editing `src/` while running an old `dist/`, or the deployed site instead of localhost. Verify the loop first: make a trivially visible change and confirm it appears. |
| **"The error is where the message says"** | messages report where the invariant *died*, not where it was *broken*. Trace the bad value's provenance upstream. |
| **"It can't be my change"** | it usually is. `git stash` → does the failure vanish? That's a 30-second discriminating experiment; run it before blaming infrastructure. |

## Discriminating experiments — the menu

Pick the cheapest one that splits your hypothesis space in half:

- **Stash test**: `git stash` → retest → `git stash pop`. Splits "my change"
  vs "everything else" in 30 seconds.
- **Bisect**: unknown culprit commit, known good point →
  `git bisect start && git bisect bad && git bisect good <ref>` with an
  automated probe. Full runbook + live demo: `project-proof-toolkit`.
- **Binary-search the input/config**: delete half the input (or neutralize
  half the config); failure persists → cause is in the kept half. Repeat.
- **Control vs treatment**: two runs differing in exactly one factor (flag,
  version, machine, file). Any difference in outcome is attributable — this
  is the only attribution that survives review.
- **Boundary dump**: assert/print the value at a seam (file read, parse,
  network edge) to split "bad data in" from "bad transform".

## Stop conditions (mandatory, not advisory)

| Condition | Action |
|---|---|
| 2 failed fix attempts | Stop. Write up symptom/hypotheses/evidence so far; search the failure log again with new keywords; re-read the repro — you may be reproducing something else. |
| 30 min without a reproduction | Stop. Same write-up; question the report itself (right version? right environment? right expectation?). |
| You notice you're arguing for your fix instead of testing it | Adversarial flip (`ai-session-discipline` self-distrust triggers). |

These mirror `ai-session-discipline`; the write-up becomes the failure-log
entry if the investigation continues past them. For a junior-tier session, a
stop condition additionally means: return to the lead with the write-up rather
than continuing to burn attempts.

## Instantiation

When this kit is copied into a real project:

- Extend the triage table with the project's own recurring symptoms as they
  accumulate failure-log entries (cite `FL-NNN` in the table rows).
- Replace generic first-suspects with the project's real architecture seams
  (e.g. "check the SW cache version first" for a PWA).
- Keep the loop, traps, and stop conditions verbatim — they are
  stack-independent.

## Provenance and maintenance

- Authored 2026-07-03. Discipline content: the loop, traps, and stop rules
  are asserted from settled engineering practice (verified-by-reading), not
  sandbox-executed; the git one-liners (`git stash`, `git log --since`,
  `git bisect` invocation shape) are standard git 2.43 usage, and the bisect
  runbook is verified-by-execution in `project-proof-toolkit` — treat that
  skill as the tested source.
- Re-verify cross-references: `ls .claude/skills/` — every sibling named here
  must exist.
- Re-verify the step-zero command still matches the failure-log convention:
  `grep -n "failure-log.md" .claude/skills/project-failure-archaeology/SKILL.md`.
