---
name: ai-session-discipline
description: Load at the start of any AI session on this project, and again whenever about to claim "done"/"fixed", write a PR body or handoff, delegate work to a cheaper model tier (e.g. Sonnet) or accept delegated output, or after repeated failed fix attempts. Provides claim labeling (verified/inferred/assumed), the pre-done checklist, hallucination countermeasures, tier delegation rules with routing table, self-distrust triggers, and the handoff template.
---

# AI Session Discipline

The behavior layer that keeps AI work honest and affordable. Confident-but-
unverified claims are one of the two costliest failure classes this kit defends
against; this skill is the defense. It applies to every session tier — the lead
and the junior — and to humans reviewing AI output.

**Tiers, defined once** (names are volatile; as of 2026-07-03): the **lead** is
the strongest available session (Opus-class), owns judgment and gates; the
**junior** is the quicker/cheaper tier (Sonnet-class), executes well-specified
work. The standard never changes between tiers — delegation changes who does
the work, never what evidence is required.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Merge gates, change classes, exception protocol | `project-change-control` |
| Evidence tier definitions, test recipes | `project-validation-and-qa` |
| The debugging procedure itself | `project-debugging-playbook` |
| To stand up a new project | `new-project-bootstrap` |

This skill implements those policies at the session level; it does not redefine
them.

## Claim classification

Every summary, PR body, and handoff labels its claims with exactly these four
labels (this skill owns them; siblings cite them):

| Label | Meaning | Example phrasing |
|---|---|---|
| **verified-by-execution** | You ran it and observed the result | "`npm test` passed 12/12 — output pasted below" |
| **verified-by-reading** | You read the code/docs; you did not run it | "the handler is registered in `app.js` (read, not executed)" |
| **inferred** | Follows from verified facts, itself unchecked | "since the parser rejects empty input, the API path likely 400s — not tested" |
| **assumed** | Taken on faith: memory, convention, training data | "assuming GitHub Pages serves from `/repo-name/` — check before relying" |

Rules:

- **"Should work" is banned.** Replace it with the discriminating command that
  would prove it — then, if cheap, run that command and upgrade the label.
- **"Fixed" is reserved** for: you reproduced the failure, applied the change,
  and watched the same reproduction pass. Anything less is "changed, unverified".
- A claim's label can only be **upgraded by evidence**, never by confidence.

## The pre-"done" checklist

Say "done" only after every box:

- [ ] I ran it (not: it compiles, not: it looks right).
- [ ] I watched the **previously-failing case** pass (for fixes).
- [ ] I ran the **wider test entry point** (`npm test` / `python3 -m pytest` /
      the project's `test` verb), not just the new test.
- [ ] I reviewed `git diff` for **side effects in every file I touched**.
- [ ] My claims are **labeled** (table above).
- [ ] Docs of record updated per the `project-change-control` reviewer
      checklist.

If a box is unchecked, report what remains instead of "done". Partial progress
stated plainly beats completion claimed falsely — the first costs minutes, the
second costs a debugging session.

## Hallucination countermeasures

Treat your own memory as an **assumed**-tier source. Anything recalled rather
than observed gets checked before it is used or stated:

| Recalled thing | Check before use |
|---|---|
| File or path exists | `ls <path>` / `test -f <path> && echo yes` |
| CLI flag or subcommand | `<tool> --help 2>&1 \| grep -- <flag>` |
| Tool present + version | `command -v <tool> && <tool> --version` |
| API/function signature | open the source: `grep -rn "def <name>\|function <name>" .` |
| Config key is real | `grep -rn "<key>" docs/config.md src/` |
| "The convention here is…" | check this repo's docs of record, not training data |

Two habits close most of the gap:

1. **Probe, then state.** A 2-second `--help` beats a wrong runbook line.
2. **Date your volatile facts.** Model knowledge ages; repos age faster. Write
   "as of YYYY-MM-DD" next to anything that can drift.

## Delegation between tiers

This section is the mechanics of non-negotiable #6 (`project-change-control`).
Purpose: spend lead-tier tokens on judgment, junior-tier tokens on execution,
and never let cost discipline become quality leakage.

### The delegation test — delegate only if ALL four are YES

1. **Specified?** Inputs, expected output, and done-criteria are written down;
   no unstated judgment calls remain inside the task.
2. **Verifiable?** The lead can check the result much cheaper than doing the
   work (a command to run, a diff to scan, a sample to spot-check).
3. **Reversible?** A wrong result costs only tokens — the task crosses no
   gates and touches nothing irreversible.
4. **Fenced?** The task cannot need policy or scope decisions mid-flight; if
   it hits one, the instruction is "stop and return with the question."

### Routing table

| Task | Tier | Why |
|---|---|---|
| Sweep files for a pattern; inventory flags/paths/TODOs | junior | mechanical, cheaply verifiable by sampling |
| Run the test suite / scripts and report output | junior | output is the evidence |
| Apply a stated template or mechanical refactor across files | junior | spec + diff review |
| Draft tests from a written spec | junior | lead reviews the assertions |
| First draft of docs from an outline | junior | lead edits for claims |
| Root-cause a novel failure | **lead** | judgment; hypotheses need taste |
| Classify a change / decide a gate / approve anything | **lead** — never delegated | non-negotiable #6 |
| Update goldens, publish, delete, force-push | **lead + human owner** | destructive class (`project-change-control`) |
| The final "done" or merge recommendation | **lead** | the acceptor owns the claim |

### Acceptance protocol (lead side)

1. Delegated work must arrive with **labeled claims and evidence** — the
   junior follows this same skill; unlabeled output is returned, not patched.
2. **Verify before accepting**: re-run at least one claimed command, or
   spot-check ≥3 items (or ~10%, whichever is larger) of any sweep. After
   acceptance, the claim is yours — "the junior said so" is not a label.
3. **Two failed deliveries** on the same task → stop delegating it; do it at
   lead tier and record why the delegation failed (bad spec? hidden judgment?)
   so the routing table can be tuned.
4. **Never assign verification of a task to the tier that produced it.**

### Junior-side obligations

- Execute the spec; do not improvise policy. On ambiguity or a judgment call:
  stop and return with the question and your recommendation.
- Same claim labels, same pre-"done" checklist, scaled to the task.
- Return format: what was done, evidence, labeled claims, open questions.

## Scope discipline

Do what was asked. List extra ideas at the end; do not implement them. Never
widen a small fix into a refactor without the gate (non-negotiable #2). You are
drifting when: you touch files unrelated to the symptom; you hear yourself
think "while I'm here…"; the diff grows after the fix already passed.

## Self-distrust triggers

| Trigger | Action |
|---|---|
| 2 failed fix attempts | Stop. Write up findings, search the failure log (`project-debugging-playbook` stop rule) |
| 30 min without a reproduction | Same — and question whether you're reproducing the right thing |
| About to edit a test or golden file to make it pass | Stop — that's a diagnosis moment (`project-validation-and-qa`) |
| About to disable a check, lint, or gate | Exception protocol (`project-change-control`) — never on your own authority |
| An observation contradicts your model of the system | Your model is wrong somewhere; re-derive it (`project-proof-toolkit`, estimation recipe) |
| You're arguing *for* your change instead of testing it | Flip adversarial: spend the next action trying to refute it |

## The handoff template

Every session ends with this. It **supplements, never replaces**, the
five-section PR body (What / Why / Verification / Claims / Docs updated) that
`project-change-control` mandates: in a PR, the handoff goes in a `## Handoff`
section beneath those five; in an issue or standalone note it stands alone.
The bar: a
cold junior-tier session must be able to resume in under 5 minutes.

```markdown
## Handoff — YYYY-MM-DD
State: <branch, latest commit, what is in flight>
Verified: <claims with labels and the exact commands behind them>
Open: <what is not done, known unknowns>
Next command: <the literal next thing to run>
Failure log: <FL-NNN entries created or updated, or "none">
Beware: <traps discovered this session>
```

## Session start ritual (any kit project)

1. Read the README quickstart and Run sections.
2. Search the failure log for your symptom: `grep -in "<symptom>" docs/failure-log.md`
3. Skim `ls docs/adr/` for decisions touching your area.
4. Load the skill for your task type:

| Task type | Load |
|---|---|
| Stand up a new project | `new-project-bootstrap` |
| Fix a bug | `project-debugging-playbook` |
| Make/review/merge any change | `project-change-control` |
| Add or modify tests, define acceptance | `project-validation-and-qa` |
| Environment won't build | `project-build-and-env` |
| Measure performance/size, run diagnostics | `project-diagnostics-and-tooling` |
| Prove or refute a claim | `project-proof-toolkit` |
| Add config/flags, handle secrets | `project-config-and-flags` |
| Run, deploy, publish | `project-run-and-operate` |
| Write or restructure docs | `project-docs-and-writing` |
| Record a design decision | `project-architecture-contract` |
| PWA / CLI / data-analysis mechanics | `pwa-reference` / `cli-reference` / `analytics-reference` |

## Instantiation

When this kit is copied into a real project:

- Update the **tier names** and their "as of" date to the current model lineup.
- Append project-specific banned phrases and traps as they are discovered
  (each should also have a failure-log entry).
- Tune the acceptance spot-check size (≥3 or ~10%) to the project's risk.

## Provenance and maintenance

- Authored 2026-07-03. Discipline content. The shell one-liners in the
  countermeasures and ritual tables were verified-by-execution in the
  authoring sandbox (bash 5.2, git 2.43) except `<tool> --help` patterns,
  which are generic by construction. Tier names (Opus/Sonnet) are
  **volatile** — re-verify the current model lineup before citing them.
- Re-verify cross-references: `ls .claude/skills/` — every skill named here
  must exist.
- Re-verify the routing table stays in sync with the library:
  `grep -c '| ' .claude/skills/README.md` vs. the inventory table there.
- If the claim labels ever change, update `project-change-control` (rule 5)
  and the library `README.md` in the same commit.
