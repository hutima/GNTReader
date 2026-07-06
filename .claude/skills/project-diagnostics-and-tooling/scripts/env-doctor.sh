#!/usr/bin/env bash
# env-doctor.sh — verify required tools and minimum versions.
# Usage: env-doctor.sh tool[:min-version] [tool[:min-version] ...]
# Example: env-doctor.sh node:22 python3:3.11 git jq
# Exit: 0 if every check passes, 1 otherwise.
set -u

if [ "$#" -eq 0 ]; then
  echo "usage: env-doctor.sh tool[:min-version] [tool[:min-version] ...]" >&2
  exit 2
fi

fail=0
printf '%-12s %-10s %-12s %s\n' "TOOL" "WANT>=" "FOUND" "RESULT"
for spec in "$@"; do
  tool=${spec%%:*}
  want=""
  case "$spec" in *:*) want=${spec#*:} ;; esac

  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '%-12s %-10s %-12s %s\n' "$tool" "${want:-any}" "missing" "FAIL"
    fail=1
    continue
  fi

  # First dotted number in the tool's version output (tools disagree on flags/format).
  found=$("$tool" --version 2>&1 | head -1 | grep -oE '[0-9]+(\.[0-9]+)+' | head -1)
  found=${found:-unknown}

  if [ -z "$want" ]; then
    printf '%-12s %-10s %-12s %s\n' "$tool" "any" "$found" "PASS"
    continue
  fi

  if [ "$found" = "unknown" ]; then
    printf '%-12s %-10s %-12s %s\n' "$tool" "$want" "$found" "FAIL"
    fail=1
    continue
  fi

  # PASS iff want <= found in version order.
  if printf '%s\n%s\n' "$want" "$found" | sort -V -C; then
    printf '%-12s %-10s %-12s %s\n' "$tool" "$want" "$found" "PASS"
  else
    printf '%-12s %-10s %-12s %s\n' "$tool" "$want" "$found" "FAIL"
    fail=1
  fi
done
exit "$fail"
