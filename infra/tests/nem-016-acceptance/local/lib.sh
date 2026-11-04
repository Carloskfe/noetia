# Shared by run-local.sh and run-f1-f2.sh. LOCAL ONLY.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export N16_REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
export N16_API_TAG=new
WORK="${N16_WORK:-$(mktemp -d)}"; mkdir -p "$WORK"
export NEM016_TARGET=local NEM016_LOCAL_API=http://127.0.0.1:14016 NEM016_LOCAL_STORAGE=http://127.0.0.1:19016
export NEM016_STATE_DIR="$WORK/state" NEM016_SECRET_FILE="$WORK/seed"
export NEM016_PRESET_BG_URL=http://bgstatic/backgrounds/imagen-7.jpg NEM016_A15_BUDGET_S=120
export NEM016_INELIGIBLE_BOOK_ID=aaaaaaaa-0000-4000-8000-000000000002 NEM016_ELIGIBLE_BOOK_ID=aaaaaaaa-0000-4000-8000-000000000001
DC() { docker compose -f "$HERE/docker-compose.yml" "$@"; }
H() { node "$HERE/../acceptance.mjs" "$@"; }
PSQL() { DC exec -T db psql -U noetia -d noetia_staging "$@"; }
say() { printf '\n=== %s\n' "$*"; }
PASS=0; FAIL=0
expect() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "ok    $1 ($2)"; else FAIL=$((FAIL+1)); echo "WRONG $1: got '$2', expected '$3'"; fi; }
status() { node -e 'const s=require(process.argv[1]).results[process.argv[2]];console.log(s?s.status:"NOT RUN")' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$1"; }
evidence() { H evidence-sql --label "$1" | PSQL -q -f - > "$WORK/ev-$NEM016_RUN_ID-$1.txt" 2>&1; H ingest-evidence "$WORK/ev-$NEM016_RUN_ID-$1.txt"; }
genCount() { DC logs --no-log-prefix image-gen 2>/dev/null | grep -c 'POST /generate'; }
grant() { H admin-sql --grant | PSQL -q -f -; }
revoke() { H admin-sql --revoke | PSQL -q -f -; }
wait_healthy() { for _ in $(seq 1 60); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$NEM016_LOCAL_API/health")" = 200 ] && return 0; sleep 2; done; echo "api never became healthy"; return 1; }
teardown() { [ "${N16_KEEP:-0}" = 1 ] || { docker unpause n16acc-storage-1 >/dev/null 2>&1; DC --profile tools down -v --remove-orphans >/dev/null 2>&1; }; }
trap teardown EXIT


bring_up() {
  say 'Bring up the stack and migrate with the candidate image'
  must DC up -d --quiet-pull --wait db cache storage
  must DC up -d --quiet-pull bgstatic image-gen
  for _ in $(seq 1 40); do DC exec -T image-gen python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:5000/health', timeout=2)" >/dev/null 2>&1 && break; sleep 2; done
  DC run --rm migrate > "$WORK/migrate.log" 2>&1; expect 'migrations applied' "$?" 0
  PSQL -q -f - < "$HERE/seed-local-books.sql" > "$WORK/seed.log" 2>&1; expect 'local books seeded' "$?" 0
  must DC up -d api; wait_healthy || exit 1
  expect 'image-gen has no route out' "$(DC exec -T image-gen python -c "import socket
try:
  socket.create_connection(('1.1.1.1', 443), 3); print('reachable')
except OSError:
  print('unreachable')" | tr -d '\r')" unreachable
  H init-secret "$NEM016_SECRET_FILE"
}
must() { "$@" || { echo "ERROR: setup step failed: $*"; exit 1; }; }
