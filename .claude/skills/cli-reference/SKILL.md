---
name: cli-reference
description: Domain pack for command-line tools and small libraries. Load when building or modifying a CLI (flags, subcommands, --help/--version), deciding exit codes or stdout/stderr behavior, adding machine-readable --json output, testing a CLI (golden output, subprocess), fixing "works in terminal but breaks in a pipe/script" issues, or packaging/publishing to npm/PyPI. Provides tested Node and Python skeletons and the interface conventions table.
---

# CLI Reference

The domain pack for command-line tools. A CLI's interface is an API: scripts,
pipes, and other tools depend on its exact bytes and exit codes. These
conventions exist so a CLI behaves predictably inside `cron`, pipelines, and
CI — not just when a human is watching.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Golden-file update *policy* | `project-validation-and-qa` |
| Env/dependency setup | `project-build-and-env` |
| Publish/release gating | `project-change-control` (destructive class) + `project-run-and-operate` |
| PWA or analytics domain | `pwa-reference` / `analytics-reference` |

## Interface conventions

| Convention | Rule | Why |
|---|---|---|
| stdout | **data only** | so `tool | jq`, `tool > file` work; a log line on stdout corrupts every consumer |
| stderr | diagnostics: logs, warnings, usage errors | keeps the data channel clean |
| exit codes | `0` success · `1` runtime failure · `2` usage error | scripts branch on these; argparse already uses 2 (verified below) |
| `--help` / `-h` | mandatory; prints usage to stdout, exits 0 | help is a successful query, not an error |
| `--version` | mandatory; version string only, exits 0 | scripts pin against it |
| flags | `--long` for every flag; `-s` short forms for the common few | greppable scripts vs. typing comfort |
| `--` separator | everything after `--` is positional | lets users pass values starting with `-` |
| verbosity | quiet by default; `-v` opts in | noise hides signal in pipelines |
| `--json` | when output is structured, offer machine-readable mode | consumers parse JSON, not prose |
| determinism | same inputs → same bytes (no timestamps in default output) | golden tests and reproducible pipelines |

## TTY awareness

Color codes and prompts belong only in interactive terminals. Detect
(verified-by-execution 2026-07-03 — both print false when piped):

```js
// Node
const interactive = Boolean(process.stdout.isTTY);
```

```python
# Python
import sys
interactive = sys.stdout.isatty()
```

Rule: when not a TTY (piped/redirected), disable color and never prompt —
block on stdin only if the interface documents it. Honor `NO_COLOR` when you
add color at all.

## Node CLI skeleton (verified-by-execution 2026-07-03, node 22.22.2)

`node:util`'s `parseArgs` is built in — no dependency:

```js
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import process from 'node:process';

const VERSION = '0.1.0';
let args;
try {
  args = parseArgs({
    options: {
      upper: { type: 'boolean', short: 'u', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });
} catch (err) {
  console.error(`usage error: ${err.message}`);
  process.exit(2);
}
if (args.values.help) {
  console.log('usage: greet [-u|--upper] [--version] <name>');
  process.exit(0);
}
if (args.values.version) { console.log(VERSION); process.exit(0); }
const name = args.positionals[0];
if (!name) { console.error('usage error: <name> is required'); process.exit(2); }
const msg = `hello, ${name}`;
console.log(args.values.upper ? msg.toUpperCase() : msg);
```

Verified transcript (abridged):

```
$ node cli.mjs Ada          → hello, Ada
$ node cli.mjs -u Ada       → HELLO, ADA
$ node cli.mjs --version    → 0.1.0
$ node cli.mjs              → usage error: <name> is required   (exit 2)
$ node cli.mjs --bogus      → usage error: Unknown option '--bogus'… (exit 2)
```

Note: `parseArgs` **throws** on unknown options — the try/catch converting
that to exit 2 is load-bearing, not decoration.

Packaging as a command (pattern; `npm link`/publish not exercised in the
authoring sandbox): in `package.json` add
`"bin": { "greet": "./cli.mjs" }`, keep the shebang line, and
`chmod +x cli.mjs`. Locally run with `node cli.mjs`; after `npm link` or
install, as `greet`.

## Python CLI skeleton (verified-by-execution 2026-07-03, python 3.11.15)

```python
#!/usr/bin/env python3
import argparse, sys

def main() -> int:
    p = argparse.ArgumentParser(prog="greet", description="Greet someone.")
    p.add_argument("name", help="who to greet")
    p.add_argument("-u", "--upper", action="store_true", help="shout")
    p.add_argument("--version", action="version", version="0.1.0")
    args = p.parse_args()
    msg = f"hello, {args.name}"
    print(msg.upper() if args.upper else msg)
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

Verified: happy path, `-u`, `--version` all behave; missing argument prints
usage to **stderr** and exits **2** (argparse's built-in convention, matching
the table). Packaging beyond `python3 greet.py` (pyproject
`[project.scripts]`, `pipx`) is a pattern — not exercised here; re-verify at
first use.

## Cross-platform traps

| Trap | Symptom | Defense |
|---|---|---|
| CRLF in the script | `env: 'node\r': No such file or directory` | `.gitattributes`: `* text=auto eol=lf` (`project-build-and-env`) |
| Hardcoded `/` joins | breaks on Windows | `path.join` / `pathlib` |
| `HOME` assumed | undefined on Windows (`USERPROFILE`) | `os.homedir()` / `pathlib.Path.home()` |
| Shell-quoting in examples | docs work in bash, fail in cmd/PowerShell | prefer single tokens; test docs in the shell you name |
| Unconditional ANSI color | garbage in logs/pipes | TTY check above + `NO_COLOR` |

## Testing a CLI

Test the CLI **as a subprocess** — the shipped interface, not the internals.
Golden test (verified-by-execution 2026-07-03; policy for updating goldens:
`project-validation-and-qa`):

```python
# test_cli.py
import subprocess, sys, unittest

RUN = [sys.executable, "greet.py"]

class TestGreetCLI(unittest.TestCase):
    def test_golden_stdout(self):
        r = subprocess.run(RUN + ["Ada"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "hello, Ada\n")   # golden: exact bytes
        self.assertEqual(r.stderr, "")

    def test_usage_error_exit_code(self):
        r = subprocess.run(RUN, capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn("required: name", r.stderr)
```

`python3 -m unittest -v` → `Ran 2 tests … OK` (verified). The same pattern in
Node: spawn with `child_process.execFile` inside `node --test`.

Assert all three channels: stdout bytes, stderr content, exit code. That
triple is the CLI's contract.

Shell-measurement trap (hit during this skill's authoring): in
`cmd | tail -1; echo $?` the `$?` is **tail's** exit code, not `cmd`'s.
Check exit codes without a pipe, or use `PIPESTATUS`/`set -o pipefail`.

## Packaging and publishing

- **semver** in one sentence: `MAJOR.MINOR.PATCH` — breaking / feature /
  fix; a CLI's "API" includes its output format and exit codes, so changing
  those bumps MAJOR (this is the CLI-specific rule most people get wrong).
- Publishing is a **destructive-class** change (`project-change-control`):
  irreversible against a public registry. The publish/dry-run rehearsal
  recipe (`npm pack --dry-run`, `npm publish --dry-run`, the `files`
  whitelist) lives in `project-run-and-operate` — follow it there; do not
  publish without it.
- CHANGELOG entry gates the release (`project-docs-and-writing`).

## Instantiation

When this kit seeds a real CLI project:

- Copy the matching skeleton as the starting `bin/`/`tool.py`; rename, keep
  the exit-code and stdout/stderr discipline verbatim.
- Start `test_cli.py` (or the Node equivalent) from the golden pattern above
  as test #1 alongside the fresh-clone smoke.
- Record output-format guarantees (what `--json` emits) in `docs/config.md`
  and treat them as MAJOR-version surface.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  Node skeleton (happy/short-flag/version/missing-arg/unknown-flag paths with
  exit codes), the Python skeleton (same paths; argparse exits 2 to stderr),
  the subprocess golden test (2/2 OK), and both TTY snippets printing false
  under a pipe. **Not verified here**: `npm link`/`npm publish`, pyproject
  entry points/pipx, Windows behavior — labeled patterns above.
- Re-verify Node skeleton: copy the JS block to `cli.mjs`, then
  `node cli.mjs Ada && node cli.mjs; echo $?` (expect `hello, Ada` then 2).
- Re-verify Python skeleton + test: copy both Python blocks and run
  `python3 -m unittest -v` (expect 2 tests OK).
- Cross-references: `ls .claude/skills/` — every sibling named here must exist.
