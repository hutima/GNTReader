---
name: project-docs-and-writing
description: Load when writing or updating a README, CHANGELOG, release notes, or any project documentation; when deciding where a fact should be documented (one home per fact); when wording claims about what the project can do; or when docs have drifted from behavior. Provides the docs-of-record set with ownership, README/CHANGELOG templates, the house style rules, and the claim discipline — nothing stated that a stranger can't reproduce.
---

# Docs and Writing

Documentation is the projection of the project into the next reader's head —
usually a zero-context junior or an AI session choosing its next command. Two
failure modes destroy its value: **drift** (docs say X, behavior is Y) and
**oversell** (claims nobody can reproduce). The defenses: every fact has one
home, docs move in the same PR as behavior, and claims carry commands.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| ADR template and decision discipline | `project-architecture-contract` |
| Failure-log format | `project-failure-archaeology` |
| Config catalog format | `project-config-and-flags` |
| PR body template and review gates | `project-change-control` |
| Verifying the commands you're about to document | `project-build-and-env` (quickstart) / `project-validation-and-qa` (evidence) |

## The docs of record — one home per fact

| Doc | Contains | Format owned by |
|---|---|---|
| `README.md` | what/why, verified quickstart, run verbs, claims | this skill |
| `CHANGELOG.md` | user-visible change history | this skill |
| `docs/adr/NNNN-slug.md` | design decisions | `project-architecture-contract` |
| `docs/failure-log.md` | investigations, dead ends, reverts | `project-failure-archaeology` |
| `docs/config.md` | every configuration axis | `project-config-and-flags` |

**One home per fact**: a fact is *explained* in exactly one place; everywhere
else *links* to it. Duplicated explanations drift independently until they
disagree — at which point both are worthless, because a reader can't tell
which one decayed. When you find the same fact explained twice, that's a bug:
keep the owner's copy, replace the other with a reference.

## README template

```markdown
# <name>

One paragraph: what this is and why it exists. No adjectives you can't prove
(see Claim discipline).

## Quickstart
<commands pasted from an EXECUTED transcript — the fresh-clone gate,
project-build-and-env. If you didn't run it today, don't write it today.>

## Run
| Verb | Command | Output lands in |
|---|---|---|
| dev | … | … |
| test | … | … |
<from project-run-and-operate>

## Verification
How to know it works: the test verb + the smoke check, with expected shapes.

## Invariants  <!-- optional; or in ADR-0001 -->
<from project-architecture-contract>

## License
…
```

## CHANGELOG discipline

Keep-a-Changelog style — one sentence: a human-readable, newest-first file
grouping each release's changes under **Added / Changed / Fixed / Removed**.

```markdown
## [0.2.0] - 2026-07-03
### Added
- `--json` output mode for scripted consumers.
### Fixed
- Day-boundary counts near DST transitions (FL-002).
```

- **Entries are written at PR time**, not reconstructed at release time —
  reconstruction produces fiction. The PR checklist's "docs updated" box
  includes this file (`project-change-control`).
- Entries describe **user-visible** effects, cite FL/ADR IDs where relevant,
  and never say just "fix bug" (which bug? the reader has a symptom, not a
  diff).
- Releasing = adding the version header + date above the accumulated
  entries (`project-run-and-operate` gates the release itself).

## House style

| Rule | Not this | This |
|---|---|---|
| Imperative voice for instructions | "You might want to run…" | "Run…" |
| Short sentences; one idea each | 40-word compound qualifications | split them |
| Define each term at first use | "the SW intercepts fetches" (SW undefined) | "the service worker (SW) —…— intercepts fetches" |
| Tables for enumerable facts | prose lists of flags | a table with one row per flag |
| Date-stamp volatile facts | "browsers currently…" | "as of 2026-07-03, browsers…" |
| Expected output next to commands | bare command blocks | command + "expect: …" |
| No relative time | "recently", "the new parser" | dates and versions |

And the meta-rule for AI-written docs: docs state **what is**, not what the
author hopes — every "supports X" in docs is a claim subject to the
discipline below, and unverified statements carry their label
(`ai-session-discipline`).

## Claim discipline

A capability may be claimed in a README, release note, or announcement
**only with a command a stranger can run to observe it.**

- "Works offline" → claimable only with the offline smoke steps next to it
  (`pwa-reference`).
- "Fast"/"small"/"efficient" → banned without a number and the command that
  produced it (`project-diagnostics-and-tooling`); superlatives
  ("blazingly") are banned outright — they age into embarrassment.
- Anything real-but-unproven is labeled **experimental**; anything intended
  is labeled **planned**. Neither appears in the headline description.
- Published numbers meet the reproducibility bar: command + environment +
  data identity (`analytics-reference` reporting stamp), or they don't get
  published.

## Docs drift gate

Behavior-changing PRs update the affected docs of record **in the same PR**
— this is a box in the `project-change-control` reviewer checklist, enforced
there. Docs-only changes are the lightest change class, but still get a PR
body and a render check (view the markdown, click the links).

Drift check for an inherited project:
`grep -n "as of 20" README.md docs/*.md` — stale date-stamps mark the facts
to re-verify first.

## Instantiation

When this kit seeds a real project:

- Create `README.md` from the template (quickstart written only after the
  fresh-clone gate passes) and an empty `CHANGELOG.md` with an
  `## [Unreleased]` header.
- Delete template sections that don't apply; the Run table and Verification
  section are not optional.
- Set the claims baseline: the initial README claims exactly what GATE 5 of
  `new-project-bootstrap` proved, nothing more.

## Provenance and maintenance

- Authored 2026-07-03. Discipline content: templates and style rules are
  asserted from settled practice (Keep-a-Changelog convention
  verified-by-reading as of the authoring date); no sandbox-executable
  claims. The ownership table was cross-checked against the sibling skills
  it cites at authoring time.
- Re-verify ownership stays true:
  `grep -rn "docs/config.md\|failure-log.md\|docs/adr" .claude/skills/*/SKILL.md | grep -v "docs-and-writing"` — owners must match the table above.
- Re-verify cross-references: `ls .claude/skills/` — every sibling named
  here must exist.
