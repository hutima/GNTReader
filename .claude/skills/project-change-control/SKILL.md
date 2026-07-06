---
name: project-change-control
description: Load before making, reviewing, approving, or merging ANY change — code, docs, config, data, or release — and whenever asked to force-push, rewrite history, delete work, revert, hotfix, bypass a rule, or do a large rewrite. Defines change classes and their gates, the six non-negotiables with rationale, the reviewer checklist, branch/commit/PR conventions, and the exception protocol. Start here when unsure whether an action is allowed.
---

# Change Control

This skill is the project's constitution: how changes are classified, what gate
each class must pass, and the rules that are never broken. Everything else in
the library routes through it. If a runbook elsewhere appears to let you merge,
deploy, or delete something without the gates below, the runbook is wrong and
this skill wins.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| To find and fix a bug | `project-debugging-playbook` |
| The definition of acceptable evidence, test recipes | `project-validation-and-qa` |
| Session-side behavior: claim labeling, delegation mechanics | `ai-session-discipline` |
| To stand up a brand-new project | `new-project-bootstrap` |
| To record a design decision (ADR) | `project-architecture-contract` |

## The six non-negotiables

Each rule exists because its violation class is expensive. The rationale is part
of the rule: if you don't know why a rule exists, you can't tell when you're
about to violate its spirit.

1. **Verification before merge, always.** No change lands without executed
   evidence — a test run, a reproduction transcript, a command whose output
   shows the new behavior. The single exception is the **emergency class**
   (below), which compresses the gate — ship the minimal diff, backfill the
   evidence same day — but never removes it. *Rationale:* the costliest
   failure class in AI-assisted work is the confident-but-wrong change: it
   reads correctly, reviews correctly, and fails in use. Appearance is not
   evidence (see `project-validation-and-qa` for the evidence hierarchy).

2. **Small reviewed changes.** One concern per change, reviewable in one
   sitting; ~400 changed lines is the guideline (a guideline, not a law —
   a 900-line mechanical rename can be fine; a 200-line change mixing a fix
   and a refactor is not). *Rationale:* review quality collapses with size,
   and small changes make `git bisect` and reverts surgical instead of
   traumatic.

3. **Big-bang rewrites are gated exceptions.** A wholesale replacement of a
   working system requires, before any code: explicit owner sign-off, a
   migration plan, and a rollback path. *Rationale:* rewrites silently drop
   accumulated fixes whose reasons live in the failure log; they are where
   settled battles get re-fought.

4. **No destructive git without sign-off.** Never rewrite shared history,
   force-push a shared branch, or delete another contributor's work without
   explicit owner sign-off recorded in the change. Repurposing or wiping a
   repo is an owner decision, never a session decision. *Rationale:*
   everything else in this doctrine assumes history is trustworthy; destroy
   history and you destroy the evidence chain.

5. **Claims are labeled.** Every PR and handoff states what was
   verified-by-execution vs. verified-by-reading vs. inferred vs. assumed
   (mechanics and phrasing in `ai-session-discipline`). *Rationale:* an
   unlabeled guess is indistinguishable from a verified fact until it fails.

6. **Delegation is deliberate.** Mechanical, well-specified, independently
   verifiable work may be delegated to the junior tier (quicker/cheaper
   models, e.g. Sonnet-class); judgment, gate decisions, and irreversible
   actions stay with the lead. Delegated output is verified by the lead
   before acceptance — the acceptor owns the claim. *Rationale:* cost
   discipline must never become quality leakage; the routing table lives in
   `ai-session-discipline`.

## Change classification

Classify every change before starting it. When a change spans classes, the
strictest class applies to the whole change.

| Class | Definition | Examples | Required gate | Junior tier may execute? |
|---|---|---|---|---|
| **docs-only** | No executable behavior can change | README wording, comments, CHANGELOG | Self-review + render/preview check | Yes; lead skims diff |
| **additive** | New capability, off by default; existing paths untouched | New optional flag, new script, new skill | Evidence that existing entry points still pass + new thing demonstrated | Yes; lead reviews evidence |
| **behavior-changing** | Any observable change to existing behavior | Bug fix, output format change, dependency upgrade, config default change | Full reviewer checklist below; test changed WITH the behavior | Junior may draft; lead reviews and merges |
| **destructive / irreversible** | Deletes data or work, rewrites history, publishes externally | Force-push, file/branch deletion, `npm publish`, release tag, golden-file update | All of the above + explicit owner sign-off + stated rollback path | Never |
| **emergency** | Live breakage; speed matters | Hotfix to a broken deploy | Minimal diff now; full evidence + failure-log entry (`project-failure-archaeology`) same day | Never |

Notes:
- A **dependency upgrade** is behavior-changing, not additive — transitive
  behavior moves under you. Run the full test entry point, not just the code
  you touched.
- A **golden-file update** is destructive because it redefines "correct"; it
  needs a diagnosis of why the new output is right (`project-validation-and-qa`).
- **Reverts** are behavior-changing and require a failure-log entry so the
  reverted approach isn't silently retried later.

## Reviewer checklist

The reviewer's job is to demand evidence, not to re-derive the work. Block the
merge until every box is checked:

- [ ] **Verification statement present**: exact commands run and their output,
      meeting the evidence tier for the change class
      (`project-validation-and-qa`). "Should work" is an automatic block.
- [ ] **Tests moved with behavior**: behavior-changing diffs change/add a test;
      no test, golden file, or check was edited/disabled just to pass — if one
      was, that's a diagnosis moment, not a review comment.
- [ ] **Scope matches intent**: the diff contains nothing unrelated to the
      stated What/Why. Unrelated improvements get their own change.
- [ ] **Docs of record updated in the same PR**: README / CHANGELOG /
      `docs/config.md` / ADRs — whichever this change makes stale
      (`project-docs-and-writing` owns the list).
- [ ] **Claims labeled**: anything not verified-by-execution is explicitly
      marked (`ai-session-discipline`).
- [ ] **Class-specific extras**: destructive → sign-off recorded + rollback
      path stated; emergency → follow-up items filed before merge.

## Branch, commit, and PR conventions

- One branch per change, short-lived: `<type>/<slug>` where type ∈
  `fix | feat | docs | chore`. Delete after merge.
- Commit subject: imperative, ≤72 chars ("Add offline cache versioning", not
  "Added…"/"Adding…"). Body explains *why*, not *what* (the diff shows what).
- PR body template — all five sections, every PR:

  ```markdown
  ## What
  One paragraph. What changes, observable from outside.

  ## Why
  The problem or requirement. Link failure-log entry / ADR if any.

  ## Verification
  Commands run and their output (paste, don't paraphrase).

  ## Claims
  verified-by-execution: …
  verified-by-reading: …
  inferred/assumed: …

  ## Docs updated
  List of docs-of-record touched, or "none affected" with one line of
  justification.
  ```

- Merge is allowed only when the reviewer checklist passes. Self-merge without
  review is allowed only for **docs-only** changes, and still requires the PR
  body.

## The exception protocol

Rules meet situations they didn't anticipate. The escape hatch is explicit:

1. **Stop.** Do not proceed on your own authority. Do not "do it once and
   explain later."
2. **Ask the project owner**, stating: the rule, why it seems wrong here, the
   proposed exception, the blast radius, and the rollback if the exception
   goes badly.
3. **Record the granted exception** as an ADR (`docs/adr/`, template in
   `project-architecture-contract`) with date, scope, and expiry. Un-expired
   exceptions are re-cited, not re-argued.
4. **A session never approves its own exception.** The junior tier never
   approves any exception. An AI session's approval authority is zero; its
   job is to surface the decision with a good recommendation.

## Emergency changes

Emergencies compress the gate; they never remove it. Ship the minimal diff,
then — same day — backfill the evidence, write the failure-log entry, and file
the follow-up items. An emergency that skips the backfill becomes tomorrow's
unexplained behavior.

## Instantiation

When this kit is copied into a real project, customize:

- **Owner identity**: name the human(s) who can grant sign-offs and exceptions.
- **Examples column** of the classification table: replace with this project's
  real change types (e.g. "service-worker cache bump" for a PWA).
- **Size guideline** (rule 2) if the project's review capacity differs.
- **Self-merge policy** if the team is >1 human (default above assumes a solo
  owner + AI sessions).
Keep the six non-negotiables verbatim — they are the kit's spine, and siblings
cite them by number.

## Provenance and maintenance

- Authored 2026-07-03 for the seed kit. This skill is pure discipline: it
  contains no sandbox-executable commands, so nothing here was
  verified-by-execution; the git conventions are standard `git`/GitHub
  behavior as of that date (verified-by-reading against git 2.43 docs
  knowledge), and internal consistency against sibling skills was checked at
  authoring time.
- Cross-reference re-verification: `ls .claude/skills/` — every skill named
  here must exist.
- Convention drift check: `grep -rn "failure-log\|docs/adr\|tests/golden" .claude/skills/ | grep -v README` — paths cited here must match the owners' definitions.
- If the six non-negotiables ever change, update `README.md` (library index)
  and `ai-session-discipline` in the same commit — they restate rules 5–6.
