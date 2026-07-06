#!/usr/bin/env bash
# smoke-http.sh — assert an HTTP endpoint responds as expected.
# Usage: smoke-http.sh URL [EXPECTED_STATUS] [CONTENT_MARKER]
#   EXPECTED_STATUS defaults to 200.
#   CONTENT_MARKER, if given, must appear in the response body (fixed string).
# Exit: 0 on pass, 1 on fail, 2 on usage error.
set -u

url=${1:-}
expect=${2:-200}
marker=${3:-}

if [ -z "$url" ]; then
  echo "usage: smoke-http.sh URL [EXPECTED_STATUS] [CONTENT_MARKER]" >&2
  exit 2
fi

body=$(mktemp)
trap 'rm -f "$body"' EXIT

status=$(curl -sS -o "$body" -w '%{http_code}' --max-time 30 "$url") || {
  echo "FAIL $url — curl error (network/DNS/refused)" >&2
  exit 1
}

if [ "$status" != "$expect" ]; then
  echo "FAIL $url — status $status (expected $expect)"
  exit 1
fi

if [ -n "$marker" ] && ! grep -qF -- "$marker" "$body"; then
  echo "FAIL $url — status $status but marker not found: $marker"
  exit 1
fi

echo "PASS $url — status $status${marker:+, marker found}"
