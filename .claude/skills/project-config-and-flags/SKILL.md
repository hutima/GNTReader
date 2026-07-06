---
name: project-config-and-flags
description: Load when adding, changing, or auditing any configuration axis — env vars, CLI flags, config files, feature flags, thresholds — when config behaves differently than documented (drift), when deciding where a setting lives or which value wins (precedence), or when handling secrets/.env files. Provides the config catalog template, precedence rules, the new-flag checklist with fail-fast validation, secrets handling, and drift re-verification.
---

# Config and Flags

Every configuration axis is behavior wearing a smaller diff. Flags accumulate,
defaults drift from docs, experimental toggles outlive their experiments —
until nobody can say what a production run actually does. The defense is a
catalog with an owner and a last-verified date, plus fail-fast validation so a
wrong value dies loudly at startup instead of skewing behavior silently.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Environment recreation (venv, pins, installs) | `project-build-and-env` |
| CLI flag *interface* conventions (--long, exit codes) | `cli-reference` |
| Threshold policy (fixed-before-running) | `project-validation-and-qa` |
| Recording the decision behind a setting | `project-architecture-contract` (ADR) |

## The config catalog

Every project keeps `docs/config.md` — one row per axis, no exceptions
("small" flags are the ones that drift first). This skill owns the format:

```markdown
| Name | Type | Default | Allowed | Status | Validated | Owner | Last verified |
|---|---|---|---|---|---|---|---|
| APP_LOG_LEVEL | env var | info | debug,info,warn,error | production | startup, fail-fast | <owner> | 2026-07-03 |
| APP_TIMEOUT_S | env var | 30 | positive int | production | startup, fail-fast | <owner> | 2026-07-03 |
| --experimental-cache | CLI flag | off | on,off | experimental → decide by 2026-09-01 | startup | <owner> | 2026-07-03 |
```

Column rules:

- **Status** is `production` or `experimental` — and experimental rows carry
  a promotion-or-retirement date. An experimental flag with no date is a
  permanent flag nobody admitted to adding.
- **Last verified** is when someone last confirmed the row matches reality
  (drift section below). A stale date is a warning, not a formality.
- The rows above are the template's example patterns, not this repo's state.

## Precedence

One convention, stated once, applied everywhere:

**built-in default < config file < environment variable < CLI flag**
(later wins).

Rationale: the further right, the closer to the person running *this*
invocation. Any deviation is a real design decision → record it as an ADR and
note it in the catalog. When debugging "the config isn't taking effect",
check the layers in reverse order — something to the right is overriding you.

## New-flag checklist

Adding a configuration axis is a behavior-changing change
(`project-change-control`). Before merge:

- [ ] **Default preserves existing behavior** — turning the feature on is the
      user's act, not the upgrade's.
- [ ] **Catalog row added** with all columns filled.
- [ ] **Validated at startup, fail-fast** — invalid values kill the process
      with the offending value in the message. Tested pattern
      (verified-by-execution 2026-07-03):

```python
import os, sys

ALLOWED_LOG_LEVELS = {"debug", "info", "warn", "error"}

def load_config():
    cfg = {
        "log_level": os.environ.get("APP_LOG_LEVEL", "info"),
        "timeout_s": os.environ.get("APP_TIMEOUT_S", "30"),
    }
    if cfg["log_level"] not in ALLOWED_LOG_LEVELS:
        sys.exit(f"config error: APP_LOG_LEVEL={cfg['log_level']!r} "
                 f"not in {sorted(ALLOWED_LOG_LEVELS)}")
    try:
        cfg["timeout_s"] = int(cfg["timeout_s"])
    except ValueError:
        sys.exit(f"config error: APP_TIMEOUT_S={cfg['timeout_s']!r} is not an integer")
    return cfg
```

      Verified: valid env → runs (exit 0); `APP_LOG_LEVEL=loud` →
      `config error: APP_LOG_LEVEL='loud' not in ['debug','error','info','warn']`
      (exit 1); non-integer timeout → clear error (exit 1). Same shape in
      Node: validate in one `loadConfig()`, `process.exit(1)` with the value
      named.
- [ ] **At least one test** exercises the non-default value.
- [ ] **Experimental flags**: promotion-or-retirement date in the catalog;
      retirement is a real change that deletes code, not just the row.

## Secrets

- **Never committed.** Not in code, not in config files, not "temporarily".
- Pattern: real values in `.env` (gitignored), shape documented in a
  committed `.env.example` with placeholder values:

  ```bash
  # .gitignore
  .env
  # .env.example (committed)
  API_KEY=replace-me
  ```

- Verification commands (shapes verified-by-execution 2026-07-03 on a planted
  demo repo — the history scan found a committed key):

  ```bash
  # working tree:
  grep -rniE 'api[_-]?key|secret|passw(or)?d|token' --include='*.py' --include='*.js' .
  # full history (catches "deleted but still in git"):
  git log -p | grep -niE 'api[_-]?key.*=|passw(or)?d.*=' | head
  ```

  Expect noise (the word "password" in docs is fine); investigate hits, don't
  auto-judge. A secret found **in history** is compromised even if the file
  was deleted — rotate the credential; do not force-push history rewrites on
  your own authority (`project-change-control`, destructive class: surface it
  to the owner with the rotation done first).

## Drift re-verification

Flags drift: code changes defaults, docs don't move. Discipline:

1. **Make effective config dumpable**: a `--print-config` mode or debug log
   at startup that prints the resolved values (post-precedence). The
   `load_config()` pattern above already produces the dict — print it.
2. **Before every release** (and when touching config code): dump effective
   config with no overrides set, diff against the catalog's Default column,
   update `Last verified` on the rows you confirmed — or fix whichever side
   lies.
3. Catalog change + code change travel in the same PR
   (`project-change-control` docs-drift gate).

## Domain notes (owned elsewhere)

- CLI flag naming/interface: `cli-reference`.
- PWA: config is baked at deploy time (no server) — cache version and
  base-path constants are the config that matters: `pwa-reference`.
- Analytics: runs are parameterized by config-as-data so results are
  reproducible: `analytics-reference`.

## Instantiation

When this kit seeds a real project:

- Create `docs/config.md` from the catalog template (delete the example
  rows); add the owner identity.
- Copy the `load_config()` pattern into the project's startup path in its
  language; wire `--print-config` or equivalent.
- Create `.env.example` + the `.gitignore` line even if there are no secrets
  yet — the pattern must predate the first secret.
- Run the secrets history scan once at adoption on any pre-existing repo.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  fail-fast `load_config()` pattern (all three paths with exit codes), and
  both secrets-scan command shapes on a planted repo (history scan caught a
  committed key). Asserted from settled practice: the precedence convention,
  catalog discipline, .env pattern (mechanically trivial; the *discipline*
  is the content).
- Re-verify the validation pattern: copy the Python block, run
  `APP_LOG_LEVEL=loud python3 -c "import config_demo"`-style (expect exit 1
  with the value named).
- Re-verify scan shapes: run both commands at repo root; expect noise, no
  errors.
- Cross-references: `ls .claude/skills/` — every sibling named here must
  exist.
