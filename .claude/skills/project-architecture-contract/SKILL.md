---
name: project-architecture-contract
description: Load when making or questioning a design decision — choosing a stack, structure, dependency, or data layout; when about to change something that "was decided for a reason"; when writing an ADR; when defining invariants a test should enforce; or at project start for the day-one decisions. Provides the ADR template and supersede discipline, testable-invariant patterns per domain, the known-weak-points register, and the day-one checklist.
---

# Architecture Contract

Design decisions are load-bearing: changing one silently breaks assumptions
other code (and other skills) stand on. This skill is how decisions get
recorded so they can be *found*, *understood*, and *changed deliberately* —
and how the system's must-hold properties (invariants) and known weaknesses
stay written down instead of living in one person's head. In a project run by
succeeding AI sessions, the contract IS the institutional memory.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| The change process/gates for implementing a decision | `project-change-control` |
| The chronicle of failures and dead ends | `project-failure-archaeology` |
| Config values and flags (settings, not decisions) | `project-config-and-flags` |
| To bootstrap a whole project (uses this skill's checklist) | `new-project-bootstrap` |

## ADRs — Architecture Decision Records

An **ADR** is a short numbered document recording one significant decision:
what was decided, what else was considered, and what it costs. This skill
owns the template; ADRs live at `docs/adr/NNNN-slug.md`.

**Write an ADR when** a choice: is expensive to reverse, constrains future
changes, resolves a debated tradeoff, or grants an exception to a rule
(`project-change-control` exception protocol). Not for choices any reasonable
person would make identically — ADR-worthy means "someone will later ask why."

Template:

```markdown
# ADR-NNNN: <decision in one line>
Date: YYYY-MM-DD
Status: proposed | accepted | superseded-by-NNNN

## Context
The forces at play: the problem, constraints, and what makes this non-obvious.

## Decision
What we will do, stated in the imperative. One decision per ADR.

## Alternatives considered
Each rejected option with the one-line reason it lost. (This section is why
future readers won't re-propose them.)

## Consequences
What gets easier, what gets harder, what we're now committed to — including
the unpleasant consequences. An ADR with only upside hasn't been thought
through.
```

Discipline:

- **Numbering**: zero-padded, sequential (`0001-…`, `0002-…`). ADR-0001 is
  always the day-one decisions (below).
- **Supersede, never rewrite.** A changed decision = new ADR with the new
  reasoning + the old one's Status set to `superseded-by-NNNN`. History must
  show what was believed when. The change itself routes through
  `project-change-control` (behavior-changing or stricter).
- ADRs are cited by number in PRs, code comments, and failure-log entries —
  that's what makes them load-bearing rather than decorative.

## Invariants

An **invariant** is a property that must hold at all times, stated so a
command or test can check it. "The app is robust" is a wish; "the app shell
renders with the network disabled" is an invariant.

How to write one testably: name the property, the scope it holds over, and
the command/test that would catch a violation. Starter invariants per domain
(adopt at bootstrap, adapt freely):

| Domain | Invariant | Checked by |
|---|---|---|
| PWA | App shell loads offline after first visit | offline smoke checklist (`pwa-reference`) |
| PWA | Every deploy that changes cached files bumps the SW cache version | review checklist + failure-log seed (`pwa-reference`) |
| CLI | stdout carries only data; diagnostics go to stderr | subprocess golden test asserting stderr empty on success (`cli-reference`) |
| CLI | Exit code is 0 exactly when the operation succeeded | exit-code assertions (`cli-reference`) |
| Analytics | `data/raw/` is never modified in place | review discipline + `git log --follow data/raw/` audit (`analytics-reference`) |
| Analytics | Every published figure is regenerable by one command | regeneration run before release (`project-run-and-operate`) |
| All | Fresh clone + README quickstart → passing test verb | fresh-clone gate (`project-build-and-env`) |

Where they live: an `## Invariants` section in the README (or ADR-0001),
each with its checking command. An invariant nobody can check is a hope —
wire each to a test or a runbook step (`project-validation-and-qa`;
in-flight asserts: `project-proof-toolkit`).

## Known-weak-points register

Weak points are stated plainly, not hidden — hidden weaknesses become
3-hour debugging sessions for whoever inherits them
(`project-failure-archaeology` exists because of this). Keep a table in the
README or ADR-0001:

```markdown
| Weak point | Why tolerated for now | Revisit when |
|---|---|---|
| Sanity probe assumes `id` column name | only one dataset today | second dataset arrives |
| No e2e test for install flow | manual checklist covers it; low change rate | install code changes |
```

Rules: every entry has a **revisit trigger** (an event, not a date-you'll-
ignore); triggers are checked during review when nearby code changes; fixing
a weak point deletes the row in the same PR.

## Day-one decisions (ADR-0001 checklist)

Every new project records these before scaffolding
(`new-project-bootstrap` phase 0 enforces this):

| Decision | Default in this kit | Details owned by |
|---|---|---|
| Domain (PWA / CLI / analytics) | — (the one real choice) | domain reference skills |
| Runtime + version pin | Node 22 / Python 3.11 (as of 2026-07-03) | `project-build-and-env` |
| Test framework + entry point | `node --test` / `python3 -m unittest discover -s tests` | `project-validation-and-qa` |
| Run verbs | `dev`, `test`, `build` | `project-run-and-operate` |
| Deploy target | GitHub Pages / npm / committed reports | `project-run-and-operate` |
| Data layout (if any) | `data/raw` immutable, `data/derived` regenerable | `analytics-reference` |
| License | owner's call | — |
| SW update policy (PWA only) | skipWaiting+claim | `pwa-reference` |

A blank row is a question for the owner, not a silent default
(`ai-session-discipline`: sessions don't decide policy).

## Instantiation

When this kit seeds a real project:

- Create `docs/adr/` and write ADR-0001 from the checklist above.
- Adopt the domain's starter invariants; wire each to its check.
- Start the weak-points register with whatever the bootstrap consciously
  deferred (there is always something — write it down).
- Replace the register examples above with real entries; the examples are
  patterns, not this repo's state.

## Provenance and maintenance

- Authored 2026-07-03. Discipline content: the ADR format is the widely used
  Nygard-style record (verified-by-reading; no sandbox-executable claims);
  the invariant table's checking commands are owned and verified by the
  cited sibling skills; register examples are illustrative patterns.
- Re-verify cross-references: `ls .claude/skills/` — every sibling named
  here must exist.
- Re-verify the day-one defaults still match the kit:
  `grep -n "node --test\|discover -s tests" .claude/skills/project-validation-and-qa/SKILL.md`
  and `grep -n "dev.*test.*build" .claude/skills/README.md`.
- The runtime defaults (Node 22 / Python 3.11) are date-stamped and will
  drift — update them when the kit's sandbox/base images move.
