#!/usr/bin/env bash
# NEM-018 — run every variant and compare with the expected outcome. LOCAL ONLY.
# Exit 0 only if today's topology and the alias option fail exactly the expected
# checks, and both network-separation options and the rollout rehearsal pass.
# STAGING_COMPOSE=<NEM-017 staging file> additionally runs the three-network end state.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; RC=0
expect() { # <label> <expected failed ids> <cmd…>
  local label="$1" want="$2"; shift 2
  local out got; out="$("$@" 2>&1 | grep -av 'level=warning')"; echo "$out"
  got="$(echo "$out" | sed -n 's/^RESULT.*FAILED_IDS=\[\(.*\)\]$/\1/p')"
  [ "$label" = baseline ] && got="$(echo "$got" | sed -E 's/ ?\bR[12]\b//g')"
  if ! echo "$out" | grep -aq '^RESULT'; then echo "SUITE-FAIL $label: no result"; RC=1
  elif [ "$got" = "$want" ]; then echo "SUITE-OK   $label: failed checks as expected [$got]"
  else echo "SUITE-FAIL $label: expected [$want], got [$got]"; RC=1; fi
}
# STAGING_COMPOSE only applies to the one run that asks for the three-network end state.
plain() { env -u STAGING_COMPOSE "$@"; }
# Baseline R1/R2 are a race: a fast recreate only sometimes lets a lookup through to
# the other application, so they are reported but excluded from the comparison.
expect baseline 'X1 X2 X3 X4 X5 X6 X7 X8 F1 F1g E1 F2 F2g F3 F4 M1' plain "$HERE/run.sh" baseline
expect alias 'X1 X2 X3 X4 X5 X6 X7 X8 F1g F2g F3 F4 M1' plain "$HERE/run.sh" alias
expect noetia-moved '' plain "$HERE/run.sh" noetia-moved
expect recommended '' plain "$HERE/run.sh" recommended
[ -n "${STAGING_COMPOSE:-}" ] && expect recommended+staging '' "$HERE/run.sh" recommended
expect rollout '' "$HERE/rollout.sh"
[ $RC -eq 0 ] && echo "ALL SUITES AS EXPECTED" || echo "SUITE FAILURES"
exit $RC
