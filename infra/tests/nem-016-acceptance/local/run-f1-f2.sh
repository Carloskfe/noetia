#!/usr/bin/env bash
# Demonstrates NEM-016 F1 and F2 on real infrastructure. LOCAL ONLY.
#   Pass 1: pre-fix image (n16acc-api:prefix): the defects must appear.
#   Pass 2: fix (n16acc-api:new), storage paused: connection open, no response.
#   Pass 3: fix, storage stopped: unavailable.
# Passes 2 and 3 wait for the real 10-minute sweep. Needs the images in README.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap teardown EXIT
CHECKS='X8.prepare X8.revoke X8.repeat X8.fragment X8.account X8.book X8.outbox X8.recovered X8.drained'
drain() { local key="$1"; for _ in $(seq 1 135); do [ "$(PSQL -tA -c 'SELECT count(*) FROM card_image_deletions')" = 0 ] && return 0; sleep 5; done; return 1; }
detail() { node -e 'const s=require(process.argv[1]).results[process.argv[2]];console.log(`  ${process.argv[2].padEnd(13)} ${(s?s.status:"NOT RUN").padEnd(8)} ${s?s.detail.slice(0,150):""}`)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$1"; }
swap_api() { export N16_API_TAG="$1"; must DC up -d api; sleep 3; wait_healthy || exit 1; }
restarts() { docker inspect -f '{{.RestartCount}} {{.State.Status}}' n16acc-api-1; }
new_run() { export NEM016_RUN_ID="$(H new-run-id)"; evidence baseline; must H setup-accounts >/dev/null; must grant; must H setup-fixture >/dev/null; }

export N16_API_TAG=prefix
bring_up

say 'PASS 1: pre-fix image: the defects must appear'
export NEM016_STALL_TIMEOUT_MS=30000
new_run
H run --only X8 --approve X8 --phase prepare | sed 's/^/  /'
docker pause n16acc-storage-1 >/dev/null
H run --only X8 --approve X8 --phase stalled >/dev/null
docker unpause n16acc-storage-1 >/dev/null
for c in X8.revoke X8.fragment X8.account X8.book; do detail $c; done
expect 'pre-fix: revocation exceeds the limit' "$(status X8.revoke)" FAIL
expect 'pre-fix: fragment deletion exceeds the limit' "$(status X8.fragment)" FAIL
expect 'pre-fix: account deletion exceeds the limit' "$(status X8.account)" FAIL
H run --only X9 --approve X9 >/dev/null
detail X9.api
expect 'pre-fix: book deletion leaves shares and images (F2)' "$(status X9.api)" FAIL
PSQL -q -c "UPDATE shares SET \"revokedAt\"=now() WHERE \"revokedAt\" IS NULL" >/dev/null
drain x || echo 'outbox did not drain after pass 1'
# The grant is still in place, so this removes the fixture and the admin account too.
must H cleanup --execute >/dev/null

interrupt_pass() {
  local mode="$1" start resume
  say "PASS: fix, storage interrupted with docker $mode"
  new_run
  H run --only X8 --approve X8 --phase prepare | sed 's/^/  /'
  docker "$mode" n16acc-storage-1 >/dev/null
  start=$(date +%s)
  H run --only X8 --approve X8 --phase stalled | sed 's/^/  /'
  echo "  all stalled operations together: $(( $(date +%s)-start ))s"
  evidence x8-stalled
  PSQL -tA -c 'SELECT attempts, "lastError", count(*) FROM card_image_deletions GROUP BY 1,2 ORDER BY 1 DESC' | sed 's/^/  outbox (attempts|error|rows): /'
  if [ "$mode" = pause ]; then docker unpause n16acc-storage-1 >/dev/null; else docker start n16acc-storage-1 >/dev/null; fi
  resume=$(date +%s)
  drain x; expect "$mode: the sweep drains the outbox" "$?" 0
  echo "  outbox empty $(( $(date +%s)-resume ))s after storage returned"
  H run --only X8 --approve X8 --phase after >/dev/null
  must revoke
  evidence final
  for c in $CHECKS A17.run X6.books X6.admin X6.protected; do detail "$c"; expect "$mode: $c" "$(status "$c")" PASS; done
  expect "$mode: API never restarted" "$(restarts)" '0 running'
  expect "$mode: no unhandled rejection in API logs" "$(DC logs --no-log-prefix api 2>/dev/null | grep -ci 'unhandled')" 0
  expect "$mode: API still healthy" "$(curl -s -o /dev/null -w '%{http_code}' "$NEM016_LOCAL_API/health")" 200
  cp "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$WORK/state-$mode.json"
  must grant; must H cleanup --execute >/dev/null
}

swap_api new
unset NEM016_STALL_TIMEOUT_MS
interrupt_pass pause
interrupt_pass stop

say "Done: $PASS expected results held, $FAIL did not. Work dir: $WORK"
[ "$FAIL" = 0 ]
