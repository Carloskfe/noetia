#!/usr/bin/env bash
# NEM-016 candidate: upgrade, rollback and roll-forward rehearsal. LOCAL ONLY.
# Starts from the commit staging is expected to run, moves to the candidate, rolls
# back with a card deletion still queued, then moves forward again. Checks that the
# database and storage stay consistent at each step, and shows why restoring an
# earlier dump is not part of the code rollback.
# Uses the disposable n16acc stack, which is removed on exit.
# Needs images n16acc-api:prefix, n16acc-image-gen:prefix (running commit) and
# n16acc-api:new, n16acc-image-gen:new (candidate).
# Usage: upgrade-rollback-rehearsal.sh <running-sha> <candidate-sha>
set -uo pipefail
RUNNING="${1:?running sha}"; CANDIDATE="${2:?candidate sha}"
source "$(dirname "${BASH_SOURCE[0]}")/../nem-016-acceptance/local/lib.sh"
D() { node "$N16_REPO/infra/tests/staging-candidate/upgrade-rollback-driver.mjs" "$@"; }
trap teardown EXIT

tree() { git -C "$N16_REPO" rev-parse "$1:$2"; }
sql() { PSQL -tA -c "$1"; }
objects() { DC exec -T storage sh -c 'MC_HOST_l=http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@127.0.0.1:9000 mc ls --recursive --json l/images' | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const k=s.split("\n").filter(Boolean).map(l=>{const j=JSON.parse(l);return j.key+":"+j.etag}).sort();console.log(k.length+"/"+require("crypto").createHash("md5").update(k.join()).digest("hex"))})'; }
dbstate() { sql "SELECT (SELECT count(*)||'/'||md5(string_agg(name,',' ORDER BY timestamp)) FROM migrations)||' '||(SELECT md5(string_agg(id||coalesce(\"revokedAt\"::text,'')||coalesce(\"imageUrl\",'')||coalesce(\"configHash\",'')||coalesce(\"quoteProvenance\"::text,''),'|' ORDER BY id)) FROM shares)||' '||(SELECT count(*) FROM card_image_deletions)||' '||(SELECT md5(string_agg(name||\"amountCents\",'|' ORDER BY name,interval)) FROM plans)||' '||(SELECT count(*)||'/'||md5(string_agg(id::text||title,'|' ORDER BY id)) FROM books)||' '||(SELECT count(*) FROM users)||' '||(SELECT md5(string_agg(\"bookId\"::text||coalesce(\"syncCoverage\"::text,''),'|' ORDER BY \"bookId\")) FROM sync_maps)"; }
ids() { docker inspect -f '{{.Id}}' n16acc-db-1 n16acc-cache-1 n16acc-storage-1 | md5sum | cut -d' ' -f1; }
pending() { DC run --rm migrate node node_modules/typeorm/cli.js migration:show -d dist/data-source.js 2>&1 | grep -acE '\[ \]'; }
# F3 (Event entity writes "userId", migration 057 has user_id) predates NEM-016 and is on main.
# It stays visible as its own count; any other schema error fails the rehearsal.
F3='column "userId" of relation "events" does not exist'
api_log() { DC logs --no-log-prefix api 2>/dev/null; }
schema_errors() { api_log | grep -iE 'column .* does not exist|relation .* does not exist|QueryFailed' | grep -vcF "$F3"; }
known_f3() { echo "  known F3 lines in this API log: $(api_log | grep -cF "$F3")"; }
image_gen_ok() { DC exec -T image-gen python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:5000/health', timeout=3).status)" 2>/dev/null | tr -d '\r'; }
switch_to() { export N16_API_TAG="$1" N16_IMAGE_GEN_TAG="$1"; must DC up -d --no-deps --wait --wait-timeout 300 api image-gen; wait_healthy || exit 1; for _ in $(seq 1 30); do [ "$(image_gen_ok)" = 200 ] && break; sleep 2; done; }
drain() { for _ in $(seq 1 135); do [ "$(sql 'SELECT count(*) FROM card_image_deletions')" = 0 ] && return 0; sleep 5; done; return 1; }

say 'Commits are comparable: same schema and same configuration'
for p in services/api/src/migrations docker-compose.staging.yml .env.staging.example pnpm-lock.yaml services/api/package.json services/web services/worker; do
  expect "unchanged between the commits: $p" "$(tree "$CANDIDATE" "$p")" "$(tree "$RUNNING" "$p")"
done

say 'A. Running commit, with data'
export N16_API_TAG=prefix N16_IMAGE_GEN_TAG=prefix
bring_up
export NEM016_RUN_ID="$(H new-run-id)"
must H setup-accounts >/dev/null; must grant; must H setup-fixture >/dev/null; must revoke
expect 'running commit: share created' "$(D share keep)" 201
expect 'running commit: share created' "$(D share revoked-old)" 201
expect 'running commit: share revoked' "$(D revoke revoked-old | cut -d' ' -f1)" 204
expect 'kept share and image' "$(D probe keep)" '200 200'
expect 'revoked share and image' "$(D probe revoked-old)" '404 404'
DC exec -T db pg_dump -U noetia -d noetia_staging -Fc > "$WORK/p0.dump"; expect 'restore point written' "$([ -s "$WORK/p0.dump" ] && echo yes)" yes
DB_A="$(dbstate)"; OBJ_A="$(objects)"; INFRA="$(ids)"; echo "  objects: $OBJ_A"

say 'B. Upgrade to the candidate: api and image-gen only'
expect 'candidate sees no pending migration' "$(pending)" 0
switch_to new
expect 'data unchanged by the upgrade' "$(dbstate)" "$DB_A"
expect 'objects unchanged by the upgrade' "$(objects)" "$OBJ_A"
expect 'db, cache and storage not recreated' "$(ids)" "$INFRA"
expect 'image-gen healthy' "$(image_gen_ok)" 200
expect 'older share still served' "$(D probe keep)" '200 200'
expect 'older revocation still honoured' "$(D probe revoked-old)" '404 404'
expect 'candidate creates a share' "$(D share post-live)" 201
expect 'candidate refuses an altered quote' "$(D refuse)" 422
expect 'candidate: no schema errors other than F3' "$(schema_errors)" 0; known_f3

say 'C. Roll back, with a card deletion still queued'
expect 'candidate creates a share' "$(D share post-outbox)" 201
docker stop n16acc-storage-1 >/dev/null
REV="$(D revoke post-outbox)"; expect 'revocation with storage down' "${REV%% *}" 204
expect 'revocation stayed bounded' "$([ "${REV##* }" -lt 8000 ] && echo yes)" yes; echo "  took ${REV##* } ms"
expect 'deletion is queued' "$(sql 'SELECT count(*) FROM card_image_deletions')" 1
DB_C="$(dbstate)"
switch_to prefix
expect 'rollback left the data alone' "$(dbstate)" "$DB_C"
expect 'rollback left the queue alone' "$(sql 'SELECT count(*) FROM card_image_deletions')" 1
docker start n16acc-storage-1 >/dev/null
for _ in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' "$NEM016_LOCAL_STORAGE/minio/health/live")" = 200 ] && break; sleep 2; done
expect 'db, cache and storage not recreated' "$(docker inspect -f '{{.Id}}' n16acc-db-1 n16acc-cache-1 n16acc-storage-1 | md5sum | cut -d' ' -f1)" "$INFRA"
echo '  waiting for the running commit to drain the queue (real 10-minute sweep)'
drain; expect 'running commit drains the queue the candidate wrote' "$?" 0
expect 'revocation made by the candidate is honoured' "$(D probe post-outbox)" '404 404'
expect 'share made by the candidate is served' "$(D probe post-live)" '200 200'
expect 'older share still served' "$(D probe keep)" '200 200'
expect 'older revocation still honoured' "$(D probe revoked-old)" '404 404'
expect 'running commit can still create a share' "$(D share rolled-back)" 201
expect 'running commit: no schema errors other than F3' "$(schema_errors)" 0; known_f3

say 'D. Roll forward again'
DB_D="$(dbstate)"; OBJ_D="$(objects)"
expect 'candidate still sees no pending migration' "$(pending)" 0
switch_to new
expect 'data unchanged by the roll-forward' "$(dbstate)" "$DB_D"
expect 'objects unchanged by the roll-forward' "$(objects)" "$OBJ_D"
expect 'share made during the rollback is served' "$(D probe rolled-back)" '200 200'
expect 'revocations still honoured' "$(D probe post-outbox)" '404 404'
expect 'candidate: no schema errors other than F3' "$(schema_errors)" 0; known_f3

say 'E. Why the code rollback does not restore the database'
expect 'share revoked after the restore point' "$(D revoke keep | cut -d' ' -f1)" 204
expect 'its page and image are gone' "$(D probe keep)" '404 404'
SID="$(node -e 'console.log(require(process.argv[1]).shares.keep.id)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json")"
AFTER="$(node -e 'console.log(require(process.argv[1]).shares["post-live"].id)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json")"
DC exec -T db psql -U noetia -d postgres -q -c 'CREATE DATABASE n16restore' >/dev/null
DC exec -T db pg_restore -U noetia -d n16restore --no-owner < "$WORK/p0.dump" > "$WORK/restore.log" 2>&1
RQ() { DC exec -T db psql -U noetia -d n16restore -tA -c "$1"; }
expect 'in the restored copy, that share is live again' "$(RQ "SELECT \"revokedAt\" IS NULL FROM shares WHERE id='$SID'")" t
expect 'but its image no longer exists' "$(D probe keep | cut -d' ' -f2)" 404
expect 'in the restored copy, a later share has vanished' "$(RQ "SELECT count(*) FROM shares WHERE id='$AFTER'")" 0
expect 'while its image is still public' "$(D probe post-live | cut -d' ' -f2)" 200
expect 'the live database was not affected by the copy' "$(sql "SELECT count(*) FROM shares WHERE id='$AFTER'")" 1

say "Done: $PASS expected results held, $FAIL did not. Work dir: $WORK"
[ "$FAIL" = 0 ]
