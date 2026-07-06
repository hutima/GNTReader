---
name: project-run-and-operate
description: Load when running, serving, deploying, publishing, or releasing a project — "how do I start this?", choosing npm scripts/Makefile verbs, setting up GitHub Pages or npm publishing, deciding what artifacts are committed vs gitignored and what output lands where, or verifying a deploy actually worked. Provides the single-entry-point rule, per-domain run recipes, deploy rehearsal patterns, artifact conventions, and post-deploy smoke checks.
---

# Run and Operate

Nobody should ever *guess* how to run a project. Every project exposes its
actions through one obvious place with canonical verb names, documents where
output lands, and treats deploys as changes that produce evidence
(a smoke check), not hope.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| To create the environment first (installs, pins) | `project-build-and-env` |
| The smoke/measure scripts themselves | `project-diagnostics-and-tooling` |
| Release gating and sign-off rules | `project-change-control` (publish = destructive class) |
| Domain internals (SW updates, CLI interface, data layout) | `pwa-reference` / `cli-reference` / `analytics-reference` |

## The single-entry-point rule

All run/test/build actions live behind one obvious front door — `npm`
scripts (Node) or a `Makefile` (everything else) — with canonical verbs:

The three canonical verbs are `dev`, `test`, `build` (the kit convention, per
the library index and `project-architecture-contract`). Projects that deploy
add one optional verb, `deploy-check`.

| Verb | Meaning |
|---|---|
| `dev` | run locally for development |
| `test` | the canonical test entry point (`project-validation-and-qa`) |
| `build` | produce deployable artifacts (omit when there's no build step) |
| `deploy-check` | *(optional, deploying projects)* post-deploy smoke (below) |

```jsonc
// package.json (Node projects)
"scripts": {
  "dev": "python3 -m http.server 8000",
  "test": "node --test",
  "deploy-check": "scripts/smoke-http.sh https://<user>.github.io/<repo>/ 200 '<marker>'"
}
```

```make
# Makefile (Python/R/mixed projects)
dev:
	python3 -m http.server 8000
test:
	python3 -m unittest discover -s tests -v
```

Rationale: verbs are the interface between the project and every future
session — README says `npm run dev`/`make test`, and *how* is an
implementation detail that can change without retraining anyone. The verbs
are recorded in ADR-0001 (`project-architecture-contract`).

## Run recipes per domain

- **Static PWA** (verified-by-execution 2026-07-03):
  `python3 -m http.server 8000` from the app directory →
  `http://localhost:8000`. Expected: one log line per request; `.webmanifest`
  served with the correct MIME type. Service workers work on localhost;
  deeper SW/dev-loop guidance: `pwa-reference`.
- **Node CLI** (verified 2026-07-03): after `npm ci`, `node bin/cli.js …`
  (or `node cli.mjs …`). Expected: data on stdout, exit 0 — the contract
  table in `cli-reference`.
- **Python analysis** (pattern; venv assumed active —
  `project-build-and-env`): `python3 scripts/analysis.py` writing to
  `data/derived/` and `reports/`. One entry-point per artifact
  (`analytics-reference`).
- **R analysis** (NOT verifiable in the authoring sandbox — no R):
  `Rscript scripts/analysis.R`, same conventions. Re-verify on first use.

## Deploy patterns

All deploys/publishes are **destructive-class** changes
(`project-change-control`): rehearse, then execute, then smoke-check, and
paste the evidence into the PR/release notes.

### GitHub Pages (static PWA)

- What deploys: the app directory's files as-is (no build step in this kit's
  default).
- The classic breakage is the `/repo-name/` base path — relative-path
  discipline and the local subpath rehearsal live in `pwa-reference`.
- Rehearse locally (subpath test), deploy via the repo's Pages settings or an
  Actions workflow (network/credentials — not exercised in the authoring
  sandbox), then:
  `scripts/smoke-http.sh https://<user>.github.io/<repo>/ 200 '<new-version-marker>'`
  — marker chosen so old-but-cached content fails the check
  (`project-diagnostics-and-tooling`).

### npm publish (CLI)

Rehearsal verified-by-execution 2026-07-03, no credentials needed:

```bash
npm pack --dry-run      # exact file list + size that would ship
npm publish --dry-run   # full rehearsal: "+ pkg@1.0.0" and target registry
```

Expected output shape: `npm notice total files: N`, package size, and for
publish `Publishing to https://registry.npmjs.org/ … (dry-run)`. Review the
file list against the `files` whitelist in package.json — accidental
inclusions (data, .env, sourcemaps) are caught here or shipped forever. The
real `npm publish` needs credentials and is irreversible per version
(labeled: not exercised in the authoring sandbox); CHANGELOG entry gates it
(`project-docs-and-writing`).

### Analytics reports

Reports ship as committed rendered artifacts in `reports/` (or release
attachments): regenerate via the documented one command, commit the output,
cite the generation stamp (date · code version · data snapshot · seed —
`analytics-reference`). "Deploy" = the PR that updates `reports/`.

## Artifact conventions

| Path | Committed? | Rule |
|---|---|---|
| `dist/`, `build/` | no (gitignored) | regenerable by `build`; never hand-edited |
| `reports/` | yes | regenerable outputs we *want* reviewable |
| `data/raw/` | yes (small) or documented source | immutable (`analytics-reference`) |
| `data/derived/` | no by default | regenerable by script |
| `node_modules/`, `.venv/` | never | recreated via `project-build-and-env` |
| `.env` | never | secrets (`project-config-and-flags`) |

The README's Run section states what each verb produces and **where output
lands** — a session that has to `find`-hunt for its own output will
eventually write somewhere wrong.

## Post-run smoke checks

After every deploy/publish/release:

1. Run the relevant check: `smoke-http.sh` for anything served; `--version`
   golden for a published CLI; regeneration for reports.
2. Paste the output into the PR or release notes — this is the deploy's
   Verification section (`project-validation-and-qa` evidence tiers).
3. A deploy without a smoke check hasn't finished; it has merely stopped.

## Instantiation

When this kit seeds a real project:

- Fill in the verbs for the project's stack (delete the non-applicable
  patterns above); record them in ADR-0001 and the README Run section.
- Wire `deploy-check` to the real URL/marker or artifact check.
- Copy the artifact table into the README, adjusted; create the `.gitignore`
  entries in the same commit.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox:
  `python3 -m http.server` serving (incl. `.webmanifest` MIME), `node`
  CLI invocation, `npm pack --dry-run` and `npm publish --dry-run` (both
  exit 0 without credentials, transcripts abridged above). **Not verified
  here**: real `npm publish`, GitHub Pages deployment, Actions workflows,
  `Rscript` (no R) — labeled patterns above.
- Re-verify dry-run behavior: `cd $(mktemp -d) && npm init -y >/dev/null && npm publish --dry-run; echo exit=$?` (expect exit 0, "(dry-run)" in output).
- Re-verify the verbs convention matches the kit:
  `grep -n "dev.*test.*build" .claude/skills/README.md`.
- Cross-references: `ls .claude/skills/` — every sibling named here must exist.
