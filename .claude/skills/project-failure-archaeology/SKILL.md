---
name: project-failure-archaeology
description: Load when finishing any investigation over ~30 minutes, reverting a change, rejecting an approach, or hitting a "known weird thing" — and at the START of debugging, to check whether the battle is already settled. Provides the failure-log format (docs/failure-log.md, FL-NNN entries), the mandatory-entry rule, search-first usage, the supersede discipline, and class-level seed entries for battles the industry has already settled.
---

# Failure Archaeology

Purpose, plainly: **nobody re-fights a settled battle.** The failure log is
the project's memory of what broke, why, what was tried, and what was decided
— the memory that survives session boundaries, model upgrades, and staff
changes. In an AI-operated project this is the difference between compounding
knowledge and Groundhog Day: a session that doesn't write down its dead ends
condemns a future session to repeat them.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| The active debugging procedure | `project-debugging-playbook` (its step zero reads this log) |
| Recording a *design decision* (not a failure) | `project-architecture-contract` (ADR) |
| The revert/emergency change process | `project-change-control` |

Boundary: ADRs record what we *chose*; the failure log records what *happened*
— an investigation, revert, or rejected approach. A failure often produces
both (an FL entry citing a new ADR).

## The canonical location

`docs/failure-log.md` in every kit project, created at bootstrap
(`new-project-bootstrap` phase 1) — it must predate the first investigation.
One file, append-ordered, newest entries at the top.

## Entry template (this skill owns the format)

```markdown
## FL-NNN — <one-line symptom> (YYYY-MM-DD)
Status: resolved | wontfix | open | superseded-by-FL-NNN
Symptom: <verbatim error text or observable behavior — what a future
  session would grep for>
Root cause: <the mechanism, one paragraph — or "unknown" for open entries>
Evidence: <the commands and output that PROVED the cause — not the
  reasoning that suggested it>
Fix / decision: <what was done or decided, incl. "approach X rejected
  because Y">
Links: <PR #, ADR-NNNN, related FL-NNN>
```

Rules:

- **IDs are sequential and never reused** (`FL-001`, `FL-002`, …). Cite them
  in PRs, ADRs, code comments, and regression-test names
  (`project-validation-and-qa` — every bug fix's test cites its FL).
- **Symptom is verbatim** where possible: future sessions search by pasting
  error text; paraphrases don't match.
- **Evidence is executed proof** (`project-proof-toolkit` standard), labeled
  per `ai-session-discipline` if anything is inferred.
- **Supersede, never edit destructively**: new understanding = new entry (or
  a dated addendum) + old entry's status set to `superseded-by-FL-NNN`. An
  edited history can't be trusted, and trust is this file's entire value.

## The mandatory-entry rule

An entry is **required** — not optional, not "if it seems interesting" — for:

| Event | Why mandatory |
|---|---|
| Any investigation over ~30 minutes | that half hour is the entry's cost ceiling; re-investigation costs it again, every time |
| Any revert | the reverted approach WILL be re-proposed; the entry is what stops it (also required by `project-change-control`) |
| Any rejected approach | "we tried that" without evidence convinces nobody, including future you |
| Any known-weird-thing | tolerated weirdness without a writeup becomes a trap (`project-architecture-contract` weak-points register may also apply) |
| A stop-condition trigger | `project-debugging-playbook`: the stop write-up IS a draft entry |

The 30-minute threshold is deliberate: below it, re-discovery is cheaper than
maintenance; above it, the log pays for itself on first re-hit.

## Using the log

- **Search first, always** (debugging step zero):
  `grep -in "<verbatim error fragment>" docs/failure-log.md` — try 2–3
  keyword variants before concluding it's new.
- On a hit: follow the entry's fix/decision, cite its ID in your PR. If
  reality now differs from the entry, that's a *new* entry superseding the
  old — the battle moved.
- Review `open` entries when entering their area; an open entry is an
  invitation, not a fence.

## Seed entries — battles already settled industry-wide

Copy these into a new project's `docs/failure-log.md` as its first entries.
**Each is labeled `library seed — class-level pattern, not an incident from
this repository`** (this seed repo has no incident history; these encode the
industry's, so sessions recognize the class on first contact).

```markdown
## FL-001 — Deployed fix not visible; old content served (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: after deploy, users/devtools still show previous version; incognito shows new.
Root cause: stale service worker serving the old cache; new SW waiting.
Fix / decision: cache-version bump discipline + update runbook — see pwa-reference (stale-SW trap).

## FL-002 — Counts/dates off by one near midnight or DST (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: daily aggregates disagree by one day/hour across timezones; tests fail twice a year.
Root cause: local-time day boundaries and 23/25-hour DST days.
Fix / decision: UTC everywhere internally; explicit timezone only at display; test DST weeks — see analytics-reference (traps).

## FL-003 — Float comparison fails "impossibly" (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: 0.1 + 0.2 != 0.3; equality assertions flake on arithmetic results.
Root cause: binary floating point cannot represent these decimals exactly.
Fix / decision: tolerance comparison (math.isclose / rel_tol) and tolerance-based goldens — see analytics-reference, project-validation-and-qa.

## FL-004 — "Works on my machine", fails on fresh clone/CI (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: ModuleNotFoundError / command not found / different versions elsewhere.
Root cause: unpinned deps, global installs, inactive venv, npm install vs ci drift.
Fix / decision: pins + fresh-clone gate + env-doctor — see project-build-and-env, project-diagnostics-and-tooling.

## FL-005 — Script dies with 'bad interpreter' or phantom diffs (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: env: 'bash\r': No such file or directory; every line shows changed.
Root cause: CRLF line endings from a Windows-side edit.
Fix / decision: .gitattributes `* text=auto eol=lf` — see project-build-and-env (traps).

## FL-006 — Debugged the wrong build for an hour (seed)
Status: resolved (class) · library seed — class-level pattern, not an incident from this repository
Symptom: edits have no effect; print statements don't print.
Root cause: running stale dist/deployed copy, or a cache (npm/browser/SW) served old code.
Fix / decision: verify the edit-run loop first (make a visible change, confirm it appears) — see project-debugging-playbook (traps).
```

## Instantiation

When this kit seeds a real project:

- Create `docs/failure-log.md` at bootstrap; paste the seeds (keep their seed
  labels); real entries start at `FL-007`.
- Prune seeds that can't apply (e.g. FL-001 in a CLI-only project) — record
  the pruning in the bootstrap PR.
- As real entries accumulate, promote recurring ones into
  `project-debugging-playbook`'s triage table (cite the FL ID in the row).

## Provenance and maintenance

- Authored 2026-07-03. Discipline content plus seeds. The seeds encode
  industry-settled failure classes; their mechanisms are verified where
  siblings verified them (FL-003's float behavior and FL-004's npm-ci trap
  were verified-by-execution during sibling authoring; FL-001/002/005/006
  are verified-by-reading, settled practice). No incident in this seed repo
  is described anywhere in this skill — by design.
- Re-verify the format is in sync with users of it:
  `grep -rn "FL-NNN\|failure-log.md" .claude/skills/*/SKILL.md | grep -v failure-archaeology | head`
  — every citing skill must match this file's conventions.
- Re-verify FL-003's claim anytime:
  `python3 -c "print(0.1+0.2==0.3)"` → `False`.
