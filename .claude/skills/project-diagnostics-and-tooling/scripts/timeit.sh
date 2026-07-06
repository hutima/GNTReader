#!/usr/bin/env bash
# timeit.sh — run a command N times; report min/median/max wall time in ms.
# Usage: timeit.sh N -- command [args...]
# Example: timeit.sh 5 -- python3 scripts/analysis.py
# Notes: wall-clock via date +%s%N (Linux/GNU date). Command's stdout/stderr
#        are discarded so timing output stays clean; run the command once
#        yourself first to confirm it works.
# Exit: 0 on success; 2 on usage error; 1 if any run exits nonzero.
set -u

n=${1:-}
if [ -z "$n" ] || [ "${2:-}" != "--" ] || [ "$#" -lt 3 ]; then
  echo "usage: timeit.sh N -- command [args...]" >&2
  exit 2
fi
shift 2

times_file=$(mktemp)
trap 'rm -f "$times_file"' EXIT

i=1
while [ "$i" -le "$n" ]; do
  start=$(date +%s%N)
  if ! "$@" >/dev/null 2>&1; then
    echo "FAIL run $i: command exited nonzero — timings invalid" >&2
    exit 1
  fi
  end=$(date +%s%N)
  echo $(( (end - start) / 1000000 )) >> "$times_file"
  i=$((i + 1))
done

sort -n "$times_file" | awk -v n="$n" '
  { a[NR] = $1 }
  END {
    median = (n % 2) ? a[(n + 1) / 2] : int((a[n / 2] + a[n / 2 + 1]) / 2)
    printf "runs=%d min=%dms median=%dms max=%dms\n", n, a[1], median, a[n]
  }'
