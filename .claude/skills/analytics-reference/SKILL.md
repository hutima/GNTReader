---
name: analytics-reference
description: Domain pack for data-analysis and statistics projects (Python or R). Load when starting an analysis, ingesting a new dataset, writing data pipelines or reports, choosing acceptance criteria for a result, or when numbers look wrong, differ between runs, or can't be reproduced. Provides raw-data immutability, reproducibility doctrine, the hypothesis-predicts-numbers methodology, a tested sanity probe, and classic statistical traps.
---

# Analytics Reference

The domain pack for analysis work, built around one idea: **an analysis is a
program whose output is a claim** — so it gets the same discipline as any
program (versioned, tested, reproducible), plus statistical guardrails,
because data can be wrong in ways code can't.

## When NOT to use this skill

| If you need… | Use instead |
|---|---|
| Generic evidence policy, golden-file rules | `project-validation-and-qa` |
| Environment pinning mechanics (venv/renv) | `project-build-and-env` |
| Proof methods beyond statistics (bisect, differential) | `project-proof-toolkit` |
| PWA or CLI domain | `pwa-reference` / `cli-reference` |

## Layout and the raw-immutability rule

```
data/raw/       # inputs exactly as received — NEVER edited in place
data/derived/   # regenerable by script; gitignored or small+committed
scripts/        # one entry-point script per derived artifact / report
reports/        # rendered outputs, committed (project-run-and-operate)
```

**`data/raw/` is immutable.** Never clean, fix, or re-save a raw file — every
correction happens in code, in `scripts/`, producing `data/derived/`.
*Rationale:* an edited raw file destroys the ability to re-derive anything
(you can no longer distinguish "the data said X" from "someone made it say
X"), and the edit itself is invisible to review. If a raw file must be
replaced (new export from a source), it arrives as a new dated file:
`data/raw/sales_2026-07-03.csv`.

## Reproducibility doctrine

1. **Pin the environment**: Python venv + pinned `requirements.txt`
   (`project-build-and-env`; verified there). R: `renv` — labeled unverified
   in the authoring sandbox (no R); re-verify at first use.
2. **Seed anything stochastic, and record the seed.** Verified 2026-07-03:

   ```python
   import random
   random.seed(42)                    # same seed → same sequence
   print([random.randint(0, 99) for _ in range(3)])   # → [81, 14, 3], every run
   ```

   Same rule for `numpy`/`torch`/R `set.seed()` when present. The seed is part
   of the result: report it.
3. **Every number in a report is generated, never typed.** Hand-typed numbers
   drift from the code that produced them within two edits. Inline them
   (notebook/R Markdown) or generate the report file from the script.
4. **One command per artifact**: each report/figure is regenerable by exactly
   one documented command (`project-run-and-operate` single-entry-point rule).
   A report that cannot be regenerated is not accepted as evidence.

## The experiment methodology (hypothesis → predicted numbers → run)

This is the kit's research discipline. It exists because the cheapest way to
fool yourself with data is to decide what "success" means *after* seeing the
result.

1. **Write the hypothesis and its predicted numbers BEFORE running.** Not "the
   new variant is better" but "variant B improves conversion by ≥2 points on
   segment X; if the effect is <1 point the mechanism I'm claiming is wrong."
   Commit this (issue, ADR, or the analysis script header) so the timestamp
   proves the order.
2. **Run. Compare against the prediction** — not against "what looks
   interesting."
3. **Acceptance bar**: one mechanism must explain **all** observations,
   including the negatives and the weird cells, before the result is
   accepted. A story that explains only the favorable rows is a story.
4. **Adversarial pass, assigned**: before acceptance, a second person or
   session is explicitly tasked to refute it — alternative mechanisms,
   leakage, artifact-of-processing. Refutation is well-specified and
   independently checkable, so it satisfies the delegation test in
   `ai-session-discipline` — the lead may assign it to the junior tier. The
   refuter never reviews their own analysis.
5. **Retired ideas get a failure-log entry** (`project-failure-archaeology`)
   with the evidence that killed them, so the idea isn't silently retried
   next quarter.

Thresholds set in step 1 are pre-registered in the
`project-validation-and-qa` sense: changing one after seeing data is a
gated, explained change — not an edit.

## Sanity checks on any new dataset

Run these before analyzing anything. The probe below is stdlib-only —
**pandas is not assumed** (verified absent in the authoring sandbox; check
`python3 -c "import pandas"` before writing pandas code) — and was
verified-by-execution 2026-07-03 on a synthetic CSV planted with one missing
value, one duplicate key, and one invalid date; it caught all three:

```python
# scripts/sanity.py — run: python3 scripts/sanity.py data/raw/<file>.csv
import csv, collections, datetime, sys

path = sys.argv[1]
rows = list(csv.DictReader(open(path, newline="")))
print(f"rows: {len(rows)}")

for col in rows[0]:                       # missing rate per column
    n = sum(1 for r in rows if not r[col].strip())
    if n: print(f"missing {col}: {n}/{len(rows)}")

dupes = [k for k, c in collections.Counter(r["id"] for r in rows).items() if c > 1]
print(f"duplicate ids: {dupes or 'none'}")

vals = [float(r["amount"]) for r in rows if r["amount"].strip()]
print(f"amount min={min(vals)} max={max(vals)}")

def date_ok(s):
    try:
        datetime.date.fromisoformat(s); return True
    except ValueError:
        return False
bad = [r["date"] for r in rows if not date_ok(r["date"])]
print(f"unparseable dates: {bad or 'none'}")

assert len(rows) > 0, "empty dataset"
```

Checklist the probe implements (adapt column names per dataset):

| Check | Question it answers |
|---|---|
| Row count vs expectation | did the export truncate? did a join explode? |
| Missing rate per column | is "no data" hiding inside the averages? |
| Duplicate keys | will joins double-count? |
| Ranges + units | negative amounts? cents vs dollars? |
| Date parse + timezone | `2026-13-01` and friends; naive vs aware datetimes |
| Join cardinality before/after | row count must be explainable across every join |

Wire the checks that must always hold as `assert`s at the top of each
analysis script — a failed assumption should kill the run loudly, not skew
the result silently.

## Classic traps

| Trap | One-line description | Defense |
|---|---|---|
| Leakage | information from the outcome/test set influences the pipeline | split first, then transform; fit only on training data |
| p-hacking / forking paths | trying analyses until one "works" | pre-registered prediction (methodology step 1); report what was tried |
| Simpson's paradox | aggregate trend reverses within every subgroup | always check the direction inside key subgroups |
| Survivorship bias | the dataset only contains things that survived to be measured | ask what exited the data before it arrived |
| Float equality | `0.1 + 0.2 == 0.3` is `False` (verified) | `math.isclose(a, b, rel_tol=…)`; tolerance-based goldens (`project-validation-and-qa`) |
| Off-by-one dates / DST | day boundaries and 23/25-hour days shift counts | work in UTC; test the DST-transition weeks explicitly |

## Validation for pipelines

- **Golden outputs**: run the pipeline on a small fixed input committed to
  `tests/`, compare against `tests/golden/` with explicit tolerances for
  floats (policy: `project-validation-and-qa`).
- **Assertion layer**: the inline `assert`s above are the pipeline's unit
  tests; run them via the project's test verb so CI-style checks catch data
  drift.
- A result's Verification section reports: seed, environment pin, data
  snapshot identity, and the pre-registered prediction it was compared to.

## Reporting

Every report carries, generated not typed:

```python
import datetime, subprocess
stamp = f"Generated {datetime.date.today()} · code {subprocess.run(['git','rev-parse','--short','HEAD'],capture_output=True,text=True).stdout.strip()} · data data/raw/sales_2026-07-03.csv · seed 42"
```

Date, code version, data snapshot, seed. A reader must be able to regenerate
the report from that line plus the README.

## Instantiation

When this kit seeds a real analytics project:

- Create the layout above; put the first raw file in dated form.
- Copy `sanity.py` into `scripts/` and adapt the key/amount/date column names.
- Choose Python or R; if R, re-verify the renv + testthat patterns and
  upgrade their labels in this file's copy.
- Record the project's pre-registration home (where hypotheses get written
  before runs) in the README.

## Provenance and maintenance

- Authored 2026-07-03. Verified-by-execution in the authoring sandbox: the
  sanity probe end-to-end on a planted synthetic CSV (caught missing value,
  duplicate id, invalid date `2026-13-01`), seed reproducibility
  (`[81, 14, 3]` twice), `0.1+0.2==0.3 → False` with `math.isclose → True`,
  and pandas' absence (import fails — stdlib-only claim honest). **Not
  verified here**: all R content (renv, set.seed, testthat), numpy/pandas
  specifics — labeled above.
- Re-verify the probe: copy the CSV+script from this file's authoring test —
  or fastest: `python3 -c "import csv"` (stdlib present) then run
  `scripts/sanity.py` against any CSV with id/amount/date columns.
- Re-verify seeding: `python3 -c "import random; random.seed(42); print([random.randint(0,99) for _ in range(3)])"` twice — identical output.
- Cross-references: `ls .claude/skills/` — every sibling named here must exist.
