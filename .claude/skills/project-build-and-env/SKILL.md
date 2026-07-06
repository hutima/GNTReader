---
name: project-build-and-env
description: Load when setting up a project from a fresh clone, writing or fixing setup/install docs, adding or upgrading dependencies, hitting "works on my machine", missing-module or command-not-found errors, wrong tool versions, or lockfile conflicts. Provides from-scratch environment recipes (Node, Python, R, static web), the version-pinning table, the fresh-clone verification gate, and the known-traps table.
---

# Build and Environment

Doctrine (non-negotiable #5, `project-change-control`): **an environment is
recreatable from scratch by copy-pasteable commands, and setup docs are only
true if they were executed.** Write quickstarts from a transcript, never from
memory — environment breakage is one of the two costliest failure classes this
kit defends against, and almost every instance traces to a setup step someone
wrote down without running.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| To run/deploy an already-working project | `project-run-and-operate` |
| Config semantics, env-var precedence, secrets | `project-config-and-flags` |
| To diagnose env drift with a script | `project-diagnostics-and-tooling` (`env-doctor.sh`) |
| Bug-hunting that isn't setup-related | `project-debugging-playbook` |

## From-scratch recipes per stack

Each recipe is the complete path from bare clone to passing test verb. Copy
the one that applies; delete the rest at instantiation.

### Node (verified-by-execution 2026-07-03, node 22.22.2 / npm 10.9.7)

```bash
node -v                      # must match the pin (see pinning table)
npm ci                       # exact install from package-lock.json
npm test                     # the canonical test verb must pass
```

Rules that make this work:

- **`npm ci` for every consumer; `npm install` only when changing deps.**
  `npm ci` installs exactly the lockfile (deleting `node_modules` first);
  `npm install` may rewrite the lockfile. A consumer who runs `npm install`
  can silently change what everyone else gets.
- `npm ci` **requires** `package-lock.json` — without one it fails
  (verified: `npm error code EUSAGE … can only install with an existing
  package-lock.json`). If a repo lacks a lockfile, that is the bug: generate
  it once with `npm install --package-lock-only`, review, commit.
- `package-lock.json` is **always committed**. It is the reproducibility
  contract.

### Python (verified-by-execution 2026-07-03, python 3.11.15 / pip 24.0)

```bash
python3 -m venv .venv        # create project-local environment
. .venv/bin/activate         # POSIX shells; Windows: .venv\Scripts\activate
python -V                    # inside the venv, plain `python` is correct
pip install -r requirements.txt
python -m unittest -v        # or the project's test verb
```

Rules:

- **One venv per project, in-repo at `.venv/`, gitignored.** Never install
  into the system Python; never share venvs between projects.
- Freeze direct deps with pins in `requirements.txt` (e.g. `pytest==8.2.0`).
  For a full transitive snapshot: `pip freeze > requirements.lock` and commit
  both (install from the lock in CI/consumers).
- Every README command assumes the venv is active; say so once at the top of
  the quickstart.

### Static web / PWA (verified-by-execution 2026-07-03)

No build step is the default for this kit's PWAs — the environment is just a
static file server:

```bash
python3 -m http.server 8000   # serve current dir at http://localhost:8000
```

Service workers require `localhost` or HTTPS — this qualifies. Details in
`pwa-reference`. If a bundler is ever introduced, that is a behavior-changing
decision → ADR + this skill's Node recipe applies.

### R (NOT verifiable in the authoring sandbox — R not installed; treat as pattern and re-verify on first use)

The `renv` package is the standard for reproducible R environments:

```r
install.packages("renv")   # once per machine
renv::init()               # once per project: creates renv.lock
renv::restore()            # consumers: install exactly renv.lock
```

Commit `renv.lock`. Run scripts via `Rscript`, not interactive sessions, so
commands are reproducible. Re-verify this whole recipe against current renv
docs the first time an R project is instantiated.

## Version pinning table

| What | Where the pin lives | Drift symptom if unpinned |
|---|---|---|
| Node runtime | `.nvmrc` + `"engines": {"node": ">=22"}` in package.json | syntax/API errors that "only happen on my machine" |
| npm deps | `package-lock.json` (committed) | behavior changes with no diff in your code |
| Python runtime | README states the version; optionally `.python-version` | stdlib/behavior drift, wheel install failures |
| Python deps | `requirements.txt` (pinned) + optional `requirements.lock` | today's clone ≠ last month's clone |
| R deps | `renv.lock` (committed) | analysis results change silently |
| Tool versions (formatter, linter) | dev-deps in the same lockfiles | formatting churn in unrelated PRs |

`engines` alone does not block a wrong Node version unless
`engine-strict=true` is set in `.npmrc` — treat `.nvmrc` as the human signal
and `env-doctor.sh` as the enforcement (`project-diagnostics-and-tooling`).

## The fresh-clone gate

The only proof that setup docs are true. Run it at bootstrap
(`new-project-bootstrap` phase 2), after any dependency change, and whenever
setup docs are edited:

```bash
d=$(mktemp -d) && git clone <repo-url> "$d/fresh" && cd "$d/fresh"
# now follow the README quickstart VERBATIM — no improvisation, no memory
# finish with the test verb:
npm test    # or: python -m unittest / project's test verb
```

Gate criteria: every quickstart command exits 0 **as written in the README**.
If you had to deviate — even once — the docs are wrong: fix the README, not
the transcript, and re-run the gate. A deviation you "just know" is a trap you
are leaving for the next session.

## Known traps (each verified or industry-settled; see failure-log seeds)

| Trap | Symptom | Defense |
|---|---|---|
| `npm install` as a consumer | lockfile diff you didn't intend | use `npm ci` (verified above) |
| venv not activated | `ModuleNotFoundError` despite "I installed it" | `which python` must point into `.venv/` |
| `python` vs `python3` | `command not found: python` outside venv | outside venv say `python3`; inside venv `python` is correct (verified above) |
| Global installs (`npm i -g`, `pip` without venv) | works for you, breaks fresh clones | everything project-local; fresh-clone gate catches it |
| Case-sensitive imports | works on macOS/Windows, breaks on Linux | match file name case exactly; Linux is the referee |
| CRLF line endings | `bad interpreter`, weird diffs | `.gitattributes` with `* text=auto eol=lf` |
| Stale caches | inexplicable installs/builds | `npm cache clean --force` / `pip cache purge`; suspect caches only AFTER a fresh-clone repro (`project-debugging-playbook`) |

## Dependency changes

Adding/upgrading a dependency is **behavior-changing** (`project-change-control`):

1. Change it in the manifest (`package.json` / `requirements.txt`), install,
   run the full test verb.
2. Commit manifest + lockfile together, never the lockfile alone.
3. Re-run the fresh-clone gate before merge.
4. State in the PR what pulled the dependency in and what was considered
   instead (one line each).

## Instantiation

When this kit is copied into a real project:

- Keep only the applicable stack recipe(s); delete the rest.
- Fill in the pin values (Node/Python versions) and create the pin files in
  the same commit.
- Put the chosen quickstart in the README **from an executed transcript**, and
  record the fresh-clone gate as test #1 (`project-validation-and-qa`).
- If R is kept: re-verify the renv recipe on first use and upgrade its label
  from pattern to verified in this section.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  venv recipe (create/activate/`python -V`/empty `pip freeze`), `npm ci`
  failing without a lockfile (EUSAGE) and succeeding after
  `npm install --package-lock-only`, and `python3 -m http.server` (serving
  checked in `project-diagnostics-and-tooling` authoring). **Not verified
  here**: the R/renv recipe (R not installed), Windows activation path,
  `engine-strict` enforcement behavior — labeled pattern/assumed above.
- Re-verify npm ci trap: `cd $(mktemp -d) && npm init -y >/dev/null && npm ci; echo "exit=$?"` (expect EUSAGE, nonzero).
- Re-verify venv recipe: `cd $(mktemp -d) && python3 -m venv .venv && . .venv/bin/activate && python -V`.
- Version facts (node 22 / python 3.11) are the authoring sandbox's —
  re-check with `node -v; python3 -V` in yours before citing.
