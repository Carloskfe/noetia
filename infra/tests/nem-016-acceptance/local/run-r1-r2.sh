#!/usr/bin/env bash
# Demonstrates NEM-016 R1, R2 and R3 on real Postgres and a really stalled MinIO.
# LOCAL ONLY. Everything is named n16acc and removed on exit.
# Pass 1 runs PR #31's code (images tagged pr31): the defects must appear.
# Pass 2 runs the fix (images tagged new). Includes one wait for the real sweep.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap teardown EXIT
export N16_IMAGE_GEN_URL=http://render-gate:5001
D() { node "$HERE/race-driver.mjs" "$@"; }
new_run() { export NEM016_RUN_ID="$(H new-run-id)"; must H setup-accounts >/dev/null; must grant; must H setup-fixture >/dev/null; }
restarts() { docker inspect -f '{{.RestartCount}} {{.State.Status}}' n16acc-api-1; }
checkStatus() { status "$1"; }
seed_token() { local id; id="$(node -e 'console.log(require(process.argv[1]).users.a.id)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json")"; DC exec -T api node - "$id" < "$HERE/seed-fake-social-token.cjs" >/dev/null; }

# R3 audits with the fix's tool, which earlier images don't have.
export N16_API_TAG=new N16_IMAGE_GEN_TAG=new
must DC --profile race up -d --quiet-pull render-gate
bring_up

say 'R3: read-only audit, on seeded objects (needs a store with no shares yet)'
MC() { DC exec -T storage sh -c "mc alias set l http://127.0.0.1:9000 localonlykey localonlysecret >/dev/null && $1"; }
UUID() { node -e 'console.log(crypto.randomUUID())'; }
OLDKEY="$(UUID).png"; MC "echo old | mc pipe l/images/$OLDKEY >/dev/null && echo cover | mc pipe l/images/covers/$(UUID).png >/dev/null"
sleep 2
new_run
node "$HERE/seed-r3.mjs" > "$WORK/r3-seed.json"; expect 'R3 seeded' "$?" 0
SNAP() { echo "$(MC 'mc ls --recursive --json l/images' | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(require("crypto").createHash("md5").update(s.split("\n").map(l=>{try{const j=JSON.parse(l);return j.key+j.etag}catch{return ""}}).sort().join()).digest("hex")))')|$(PSQL -tA -c 'SELECT md5(string_agg(id || coalesce("revokedAt"::text, $$$$) || "visitCount", $$|$$ ORDER BY id)) FROM shares')|$(PSQL -tA -c 'SELECT count(*), coalesce(sum(attempts),0) FROM card_image_deletions')"; }
B="$(SNAP)"
DC exec -T api node dist/sharing/audit-orphan-images.js --min-age-hours=0 > "$WORK/r3-report.json" 2> "$WORK/r3-report.err"; expect 'R3 audit exit code' "$?" 0
A="$(SNAP)"; expect 'R3 audit changed nothing' "$A" "$B"
node "$HERE/check-r3.mjs" "$WORK/r3-seed.json" "$WORK/r3-report.json" "$OLDKEY" > "$WORK/r3-check.txt"; R3RC=$?; cat "$WORK/r3-check.txt" | sed 's/^/  /'; expect 'R3 classes as expected' "$R3RC" 0
R3UNCHANGED=FAIL; [ "$A" = "$B" ] && R3UNCHANGED=PASS
R3CLASSES=FAIL; [ "$R3RC" = 0 ] && R3CLASSES=PASS
reset_db() { PSQL -q -c "DELETE FROM card_image_deletions" -c "DELETE FROM shares" -c "DELETE FROM books WHERE title LIKE 'Cuaderno%'" -c "DELETE FROM users WHERE email LIKE 'nem016-%'" >/dev/null; }
reset_db

say 'PASS 1: PR #31 code: the race and the unbounded paths must appear'
export N16_API_TAG=pr31 N16_IMAGE_GEN_TAG=pr31
must DC up -d image-gen api; sleep 3; wait_healthy || exit 1
new_run
D r1 baseline | tee "$WORK/r1-baseline.txt" | sed 's/^/  /'
for c in render share-first delete-first concurrent; do
  grep -q "^FAIL X10.$c" "$WORK/r1-baseline.txt"; expect "PR #31 code shows the race: $c" "$?" 0
done
seed_token
D r2 baseline pause | tee "$WORK/r2-baseline.txt" | sed 's/^/  /'; expect 'PR #31 code: R2 measured' "$?" 0
grep -q '"quote":{"status":"TimeoutError"' "$WORK/r2-baseline.txt"; expect 'PR #31 code: quote read hangs past the client limit' "$?" 0
grep -q '"render":{"status":"TimeoutError"' "$WORK/r2-baseline.txt"; expect 'PR #31 code: render hangs past the client limit' "$?" 0
D perf pr31 | tee -a "$WORK/perf.txt" | sed 's/^/  /'; expect 'PR #31 code: performance measured' "$?" 0
docker unpause n16acc-storage-1 >/dev/null 2>&1
reset_db

say 'PASS 2: the fix'
export N16_API_TAG=new N16_IMAGE_GEN_TAG=new
must DC up -d image-gen api; sleep 3; wait_healthy || exit 1
new_run
H set-local X12.classes "$R3CLASSES" 'Every seeded class as expected; plan holds only the 2 safe objects'
H set-local X12.unchanged "$R3UNCHANGED" 'Object listing, share rows and outbox identical before and after'
seed_token
D r1 fix | tee "$WORK/r1-fix.txt" | sed 's/^/  /'
for c in X10.render X10.share-first X10.delete-first X10.double-delete X10.concurrent X10.stress X10.rollback-share X10.rollback-delete X10.storage; do expect "fix: $c" "$(status "$c")" PASS; done
D r2 fix pause | tee "$WORK/r2-pause.txt" | sed 's/^/  /'; expect 'fix: R2 pause ran' "$?" 0
D r2 fix stop | tee "$WORK/r2-stop.txt" | sed 's/^/  /'; expect 'fix: R2 stop ran' "$?" 0
for c in X11.quote X11.render X11.publish X11.recovery; do expect "fix: $c" "$(status "$c")" PASS; done
D perf fix | tee -a "$WORK/perf.txt" | sed 's/^/  /'; expect 'fix: performance measured' "$?" 0
expect 'API never restarted' "$(restarts)" '0 running'
expect 'no unhandled rejection in API logs' "$(DC logs --no-log-prefix api 2>/dev/null | grep -ci 'unhandled')" 0

say 'Sockets: real SDK against a server that goes quiet'
for m in no-answer mid-body; do
  OUT="$(DC exec -T api node - stall "$m" < "$HERE/storage-probe.cjs")"; echo "  $OUT"
  E="$(node -e 'const o=JSON.parse(process.argv[1]);console.log(o.error==="StorageTimeoutError"&&o.tookMs<3000&&o.socketClosedAfterMs!==null&&o.socketClosedAfterMs<3500?"ok":"bad")' "$OUT")"
  expect "stall $m: read times out and the socket closes" "$E" ok
  [ "$E" = ok ] || SOCKFAIL=1
  SOCKDETAIL="${SOCKDETAIL:-}$m $OUT; "
done
H set-local X11.sockets "$([ -z "${SOCKFAIL:-}" ] && echo PASS || echo FAIL)" "$SOCKDETAIL"
say 'Sizes: real uploads and bounded reads'
DC exec -T api node - measure < "$HERE/storage-probe.cjs" | tee "$WORK/sizes.txt" | sed 's/^/  /'

say 'Upload path, unchanged by design: what it does on a stalled store'
D upload pause | tee "$WORK/upload-baseline.txt" | sed 's/^/  /'
D upload stop | tee -a "$WORK/upload-baseline.txt" | sed 's/^/  /'
H report --out "$WORK/report-fix.md"
cp "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$WORK/state-fix.json"

say "Done: $PASS expected results held, $FAIL did not. Work dir: $WORK"
[ "$FAIL" = 0 ]
