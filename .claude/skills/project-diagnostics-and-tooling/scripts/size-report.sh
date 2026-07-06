#!/usr/bin/env bash
# size-report.sh — report sizes of files/directories; optional budget check.
# Usage: size-report.sh [-t MAX_BYTES] path [path ...]
#   -t MAX_BYTES  fail (exit 1) if any single path exceeds the budget.
# Example: size-report.sh -t 250000 dist/ index.html
# Exit: 0 all within budget (or no budget), 1 over budget, 2 usage error.
set -u

max=""
if [ "${1:-}" = "-t" ]; then
  max=${2:-}
  shift 2 || { echo "usage: size-report.sh [-t MAX_BYTES] path..." >&2; exit 2; }
fi
if [ "$#" -eq 0 ]; then
  echo "usage: size-report.sh [-t MAX_BYTES] path..." >&2
  exit 2
fi

fail=0
printf '%-12s %-8s %s\n' "BYTES" "BUDGET" "PATH"
for p in "$@"; do
  if [ ! -e "$p" ]; then
    printf '%-12s %-8s %s\n' "missing" "-" "$p"
    fail=1
    continue
  fi
  bytes=$(du -sb -- "$p" | cut -f1)
  if [ -n "$max" ] && [ "$bytes" -gt "$max" ]; then
    printf '%-12s %-8s %s   OVER\n' "$bytes" "$max" "$p"
    fail=1
  else
    printf '%-12s %-8s %s\n' "$bytes" "${max:--}" "$p"
  fi
done
exit "$fail"
