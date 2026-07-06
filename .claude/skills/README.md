# Best-Practices Skill Library (seed kit)

This repository is a deliberately empty **seed repo**. Its only product is this
skill library, which gets copied into new projects (PWAs, CLI tools, analytics
work) so junior/mid-level engineers and smaller AI models can work at a senior
engineer's standard from day one.

**Chain of custody:** the retiring author → **Opus** (successor lead session) →
**Sonnet** (Opus's quicker/cheaper junior). Skills are written so a Sonnet-class
model can execute them; Opus routes work between tiers (see
`ai-session-discipline`).

## Doctrine — the six non-negotiables

Every skill is consistent with these. Full rationale in `project-change-control`.

1. **Verification before merge, always.** No change lands without executed evidence.
2. **Small reviewed changes.** Big-bang rewrites are gated exceptions, never routine.
3. **No destructive git without sign-off.** Never rewrite shared history or delete another contributor's work.
4. **Claims are labeled.** verified-by-execution / verified-by-reading / inferred / assumed.
5. **Environments are recreatable by command,** not memory.
6. **Delegation is deliberate.** Mechanical, verifiable work goes to the junior tier; judgment, gates, and irreversible actions stay with the lead; delegated output is verified before acceptance.

## Shared conventions (one home per fact)

| Fact | Convention | Owner skill |
|---|---|---|
| Failure log | `docs/failure-log.md`, entries `FL-NNN` | project-failure-archaeology |
| Decision records | `docs/adr/NNNN-slug.md` | project-architecture-contract |
| Config catalog | `docs/config.md` | project-config-and-flags |
| Golden files | `tests/golden/` | project-validation-and-qa |
| Run verbs | `dev`, `test`, `build` | project-run-and-operate |
| Claim labels | verified-by-execution / verified-by-reading / inferred / assumed | ai-session-discipline |
| Stop rules | 2 failed fix attempts or 30 min without repro → stop & write up | project-debugging-playbook |
| PR body | What / Why / Verification / Claims / Docs updated | project-change-control |

## Inventory and status

| # | Skill | Status | One-liner |
|---|---|---|---|
| 1 | project-change-control | ✅ | Change classes and gates, the six non-negotiables with rationale, reviewer checklist, exception protocol. |
| 2 | ai-session-discipline | ✅ | Claim labeling, pre-"done" checks, hallucination countermeasures, self-distrust triggers, handoff template, Opus→Sonnet delegation routing. |
| 3 | project-validation-and-qa | ✅ | Evidence hierarchy, thresholds fixed before running, per-stack test recipes, golden-file and flaky-test policy. |
| 4 | project-build-and-env | ✅ | From-scratch environment recipes per stack, version pinning, the fresh-clone gate, known traps. |
| 5 | project-debugging-playbook | ✅ | The debugging loop, symptom→triage table, time-sink traps, discriminating experiments, stop conditions. |
| 6 | new-project-bootstrap | ✅ | Decision-gated campaign to stand up a new project and instantiate this kit (phases 0–5, gates, branch tables). |
| 7 | pwa-reference | ✅ | Manifest, service-worker lifecycle, caching strategies, stale-SW trap, GitHub Pages base paths, offline testing. |
| 8 | cli-reference | ✅ | Argv/exit-code/stdout conventions, Node+Python CLI skeletons, TTY detection, golden CLI tests, publishing. |
| 9 | analytics-reference | ✅ | Raw-data immutability, reproducibility, hypothesis-predicts-numbers methodology, sanity probes, classic traps. |
| 10 | project-diagnostics-and-tooling | ✅ | Measure don't eyeball: ships tested scripts (env-doctor, smoke-http, timeit, size-report) with interpretation guides. |
| 11 | project-proof-toolkit | ✅ | Proof recipes: minimal repro, git bisect, differential testing, invariants, estimation, controlled experiments. |
| 12 | project-architecture-contract | ✅ | ADR discipline, testable invariants per domain, known-weak-points register, day-one decision checklist. |
| 13 | project-config-and-flags | ✅ | Config catalog format, precedence, new-flag checklist, secrets pattern, drift re-verification. |
| 14 | project-run-and-operate | ✅ | Single entry point rule, run recipes per domain, deploy patterns, artifact conventions, smoke checks. |
| 15 | project-failure-archaeology | ✅ | Failure-log format, mandatory-entry rule, search-first usage, class-level seed entries. |
| 16 | project-docs-and-writing | ✅ | Docs of record and ownership, README/CHANGELOG templates, house style, claim discipline. |

Status legend: ☐ pending · ✅ authored (committed) · Statuses are updated in the
same commit that authors the skill.

## Authoring rules (for any session resuming this work)

Work **one skill at a time**, in inventory order. Commit and push after each
skill (`Add <skill-name> skill`), updating this table's status in the same
commit. Branch: `claude/skill-library-setup-fi3wok`; PR stays open until the
set is complete.

Every skill must:

- Live at `.claude/skills/<name>/SKILL.md`; extra depth in `references/`,
  executable helpers in `scripts/` (inside the skill's own directory only).
- Have YAML frontmatter with exactly `name` (= directory name) and a
  trigger-rich `description` (third person, <450 chars, says when to load it,
  with task/symptom keywords).
- Follow section order: purpose → **When NOT to use this skill** (name the
  sibling to use instead) → body → **Instantiation** (what to customize when
  copied into a real project) → **Provenance and maintenance** (date-stamp,
  verified-by-execution vs asserted-from-knowledge, one-line re-verification
  commands).
- Body ≤ ~450 lines, imperative runbook voice, tables/checklists over prose,
  jargon defined at first use, copy-pasteable commands.
- **Ground truth only:** commands are either tested in a sandbox at authoring
  time or explicitly labeled unverified (all R commands; network/registry
  operations; browser steps). Wrong runbooks are worse than none.
- No invented repo facts (this seed repo has no code/tests/CI); examples are
  labeled as patterns. No machine-specific paths. Date-stamp volatile facts.
  No oversell: optional practices stay labeled optional.
- Respect the ownership table above: own your facts, cross-reference siblings
  by exact name for everything else.

Authoring sandbox as of 2026-07-03: node 22.22.2, npm 10.9.7, python3 3.11.15
(stdlib only), git 2.43.0, jq 1.7, bash 5.2, curl 8.5. **Not** installed: R,
shellcheck, hyperfine — anything depending on them gets labeled unverified.

## After all 16 exist (final task)

1. Frontmatter validation across all skills (name = dir, description present).
2. Run every shipped script once; re-verify cross-references point to real skills.
3. Delegate the mechanical sweep to a Sonnet-class agent (dogfooding rule 6),
   lead verifies findings, apply fixes.
4. Update this README if inventory drifted; final push.
