#!/usr/bin/env bash
# NEM-016 integrated candidate — migration-first rehearsal. LOCAL ONLY.
# Real api images built from the live baseline and the candidate, against a
# disposable pgvector PG16 (the staging DB image). Uses only n16h-prefixed
# resources. Usage: migration-rehearsal.sh <baseline-sha> <candidate-sha>
set -uo pipefail
OLD_SHA="${1:?baseline sha}"; NEW_SHA="${2:?candidate sha}"
P=n16h; NET=${P}net; DB=${P}db; PASS=0; FAIL=0; FAILED=""
W="$(mktemp -d)"
cleanup() { docker rm -f $DB ${P}cache ${P}minio ${P}old ${P}new ${P}blocker >/dev/null 2>&1; docker network rm $NET >/dev/null 2>&1; rm -rf "$W"; }
trap cleanup EXIT
ROOT="$(git rev-parse --show-toplevel)"
build() { local t="$1" sha="$2" d="$W/$1"; mkdir -p "$d"; git -C "$ROOT" archive "$sha" services/api infra/postgres | tar -x -C "$d"; docker build -q --target production -t ${P}-api:$t "$d/services/api" >/dev/null || exit 2; }
build old "$OLD_SHA"; build new "$NEW_SHA"
docker network create $NET >/dev/null
docker run -d --name $DB --network $NET --network-alias db -e POSTGRES_DB=noetia_staging -e POSTGRES_USER=noetia -e POSTGRES_PASSWORD=x -v "$W/old/infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro" pgvector/pgvector:pg16 >/dev/null
docker run -d --name ${P}cache --network $NET --network-alias cache redis:7-alpine >/dev/null
docker run -d --name ${P}minio --network $NET --network-alias storage -e MINIO_ROOT_USER=stagingkey -e MINIO_ROOT_PASSWORD=stagingsecret minio/minio:latest server /data >/dev/null
for i in $(seq 1 40); do docker exec $DB pg_isready -U noetia -d noetia_staging >/dev/null 2>&1 && break; sleep 1; done; sleep 3
ENVS=(-e NODE_ENV=production -e APP_ENV=staging -e DB_HOST=db -e DB_NAME=noetia_staging -e DB_USER=noetia -e DB_PASS=x -e REDIS_URL=redis://cache:6379 -e JWT_SECRET=x -e MINIO_ENDPOINT=storage -e MINIO_PORT=9000 -e MINIO_ACCESS_KEY=stagingkey -e MINIO_SECRET_KEY=stagingsecret -e MINIO_PUBLIC_URL=http://storage:9000 -e MEILI_HOST=http://127.0.0.1:1 -e MEILI_MASTER_KEY=x -e SMTP_HOST= -e STRIPE_SECRET_KEY=sk_test_x -e STRIPE_WEBHOOK_SECRET=whsec_x -e SOCIAL_TOKEN_SECRET=0123456789abcdef0123456789abcdef)
sql() { docker exec -i $DB psql -U noetia -d noetia_staging -tA -c "$1" 2>&1; }
one() { docker run --rm --network $NET "${ENVS[@]}" ${P}-api:$1 "${@:2}" 2>&1; }
check() { # id description observed expected-regex
  if [[ "$3" =~ ^($4)$ ]]; then PASS=$((PASS+1)); printf 'PASS  %-4s %-62s %s\n' "$1" "$2" "$3"; else FAIL=$((FAIL+1)); FAILED="$FAILED $1"; printf 'FAIL  %-4s %-62s %s\n' "$1" "$2" "$3"; fi; }
last() { sql "SELECT (SELECT count(*) FROM migrations)||' '||timestamp FROM migrations ORDER BY timestamp DESC LIMIT 1"; }
serve() { docker rm -f ${P}$1 >/dev/null 2>&1; docker run -d --name ${P}$1 --network $NET "${ENVS[@]}" ${P}-api:$1 >/dev/null; for i in $(seq 1 45); do docker exec ${P}$1 wget -qO- http://127.0.0.1:4000/health >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }
get() { docker exec ${P}$1 node -e 'fetch("http://127.0.0.1:4000"+process.argv[1]).then(r=>console.log(r.status)).catch(e=>console.log("ERR",e.message))' "$2" 2>&1; }
SCHEMA="SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name='shares' AND column_name IN ('revokedAt','configHash','quoteProvenance'))||'/'||(to_regclass('card_image_deletions') IS NOT NULL)||'/'||(SELECT count(*) FROM pg_indexes WHERE tablename='shares' AND indexname IN ('IDX_shares_createdById','UQ_shares_creator_config_live'))"
PRICES="SELECT string_agg(\"amountCents\"::text,',' ORDER BY name,interval) FROM plans WHERE name IN ('Individual Monthly','Individual Annual','Dual Reader Monthly','Dual Reader Annual')"
OLDP='13500,1499,8900,999'; NEWP='12999,1399,8399,899'  # Dual Annual, Dual Monthly, Individual Annual, Individual Monthly
BOOK=00000000-0000-4000-8000-000000000001

echo "── Live-baseline state: migrations applied by the baseline image"
one old npm run migration:run:prod > "$W/base.log"; check B1 "baseline image applies its migrations" "$?" 0
check B2 "baseline stops at 066" "$(last)" '[0-9]+ 1748300000066'
BASECOUNT="$(sql 'SELECT count(*) FROM migrations')"; echo "        baseline migration rows: $BASECOUNT"
sql "SELECT string_agg(name||'='||\"amountCents\",' ') FROM plans WHERE name IN ('Individual Monthly','Individual Annual','Dual Reader Monthly','Dual Reader Annual')" | sed 's/^/        plans: /'
check B3 "plan prices are the pre-067 values" "$(sql "$PRICES")" "$OLDP"
serve old; check B4 "baseline api serves" "$(get old /health)" 200
sql "INSERT INTO shares (id,\"bookId\",quote,author,title,\"imageUrl\") VALUES ('legacy1','$BOOK','q','a','t','http://x/y.png')" >/dev/null
check B5 "baseline api reads a legacy share (book absent → gated or 200)" "$(get old /shares/legacy1)" '200|404'
LEG_BEFORE="$(get old /shares/legacy1)"
docker exec -i $DB pg_dump -U noetia -d noetia_staging -Fc > "$W/p0.dump"
check B6 "P0 restore point written" "$([ -s "$W/p0.dump" ] && echo yes)" yes

echo "── migration:show from the new image (read-only)"
one new node node_modules/typeorm/cli.js migration:show -d dist/data-source.js > "$W/show.log"; SHOWRC=$?
echo "        exit code $SHOWRC; pending: $(grep -aE '\[ \]' "$W/show.log" | tr -s ' ' | tr '\n' ';')"
check S1 "lists exactly 067 and 068 as pending" "$(grep -acE '\[ \]' "$W/show.log")" 2
check S2 "both pending lines are 067/068" "$(grep -aE '\[ \]' "$W/show.log" | grep -cE '1748300000067|1748300000068')" 2
check S3 "show changed nothing" "$(last)" "$BASECOUNT 1748300000066"

echo "── Failure drill 1: 067 aborts on an unexpected price"
sql "UPDATE plans SET \"amountCents\"=1234 WHERE name='Individual Monthly' AND interval='month'" >/dev/null
one new npm run migration:run:prod > "$W/f1.log"; RC=$?
check F1 "migration run fails" "$([ $RC -ne 0 ] && echo nonzero || echo 0)" nonzero
check F2 "error names the unexpected price" "$(grep -ac 'unexpected amountCents 1234' "$W/f1.log" | sed 's/[1-9][0-9]*/found/')" found
check F3 "nothing applied: migrations at 066" "$(last)" "$BASECOUNT 1748300000066"
check F4 "nothing applied: no 068 schema" "$(sql "$SCHEMA")" '0/false/0'
sql "UPDATE plans SET \"amountCents\"=999 WHERE name='Individual Monthly' AND interval='month'" >/dev/null

echo "── Failure drill 2: 068 cannot get its lock (long transaction on shares)"
docker run -d --name ${P}blocker --network $NET -e PGPASSWORD=x pgvector/pgvector:pg16 psql -h db -U noetia -d noetia_staging -c "BEGIN; LOCK TABLE shares IN ACCESS SHARE MODE; SELECT pg_sleep(40); COMMIT;" >/dev/null
sleep 2
T0=$(date +%s); one new npm run migration:run:prod > "$W/f2.log"; RC=$?; T1=$(date +%s)
check L1 "migration run fails" "$([ $RC -ne 0 ] && echo nonzero || echo 0)" nonzero
check L2 "fails on lock_timeout" "$(grep -ac 'lock timeout' "$W/f2.log" | sed 's/[1-9][0-9]*/found/')" found
echo "        failed after $((T1-T0))s"
check L3 "067 rolled back with it (same transaction)" "$(sql "$PRICES")" "$OLDP"
check L4 "migrations still at 066" "$(last)" "$BASECOUNT 1748300000066"
check L5 "old api still serves during the failure" "$(get old /health)" 200
docker rm -f ${P}blocker >/dev/null
# Removing the client doesn't end its session while pg_sleep runs: release the lock explicitly.
sql "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE query LIKE '%pg_sleep(40)%' AND pid <> pg_backend_pid()" >/dev/null

echo "── P3: migrate first, new image, old api still serving"
one new npm run migration:run:prod > "$W/up.log"; check M1 "migration run succeeds" "$?" 0
check M2 "now at 068, two more rows" "$(last)" "$((BASECOUNT+2)) 1748300000068"
check M3 "068 schema: 3 columns / table / 2 indexes" "$(sql "$SCHEMA")" '3/true/2'
check M4 "067 applied the new prices" "$(sql "$PRICES")" "$NEWP"
check M5 "legacy row untouched" "$(sql "SELECT \"revokedAt\" IS NULL AND \"configHash\" IS NULL AND \"quoteProvenance\" IS NULL FROM shares WHERE id='legacy1'")" t
one new npm run migration:run:prod > "$W/up2.log"; check M6 "re-run is a no-op" "$(last)" "$((BASECOUNT+2)) 1748300000068"

echo "── A13: OLD api on the NEW schema"
check O1 "old api /health" "$(get old /health)" 200
check O2 "old api answers legacy share as before" "$(get old /shares/legacy1)" "$LEG_BEFORE"
check O3 "old api: unknown share 404" "$(get old /shares/nope)" 404
sql "INSERT INTO shares (id,\"bookId\",quote,author,title,\"imageUrl\") VALUES ('legacy2','$BOOK','q','a','t','http://x/y.png')" >/dev/null
check O4 "old-shape insert (no new columns) works" "$(sql "SELECT count(*) FROM shares WHERE id='legacy2'")" 1
check O5 "old api logs no column errors" "$(docker logs ${P}old 2>&1 | grep -ciE 'column .* does not exist|QueryFailed')" 0

echo "── P5: NEW api on the new schema"
docker rm -f ${P}old >/dev/null; serve new; check N1 "new api healthy" "$(get new /health)" 200
check N2 "new api: unknown share 404" "$(get new /shares/nope)" 404
check N3 "new api: legacy share of an ineligible book is hidden" "$(get new /shares/legacy1)" 404
check N4 "new api logs no schema errors" "$(docker logs ${P}new 2>&1 | grep -ciE 'column .* does not exist|relation .* does not exist|QueryFailed')" 0

echo "── Rollback constraints"
sql "UPDATE shares SET \"revokedAt\"=now() WHERE id='legacy2'" >/dev/null
one new npm run migration:revert:prod > "$W/r1.log"; RC=$?
check R1 "068 down refused while a revoked share exists" "$([ $RC -ne 0 ] && echo nonzero || echo 0)/$(grep -ac 'Refusing to roll back 068' "$W/r1.log" | sed 's/[1-9][0-9]*/found/')" 'nonzero/found'
check R2 "still at 068" "$(last)" "$((BASECOUNT+2)) 1748300000068"
sql "DELETE FROM shares WHERE id='legacy2'" >/dev/null; sql "INSERT INTO card_image_deletions (key) VALUES ('k')" >/dev/null
one new npm run migration:revert:prod > "$W/r2.log"; RC=$?
check R3 "068 down refused while a deletion is queued" "$([ $RC -ne 0 ] && echo nonzero || echo 0)" nonzero
sql "DELETE FROM card_image_deletions" >/dev/null
one new npm run migration:revert:prod > "$W/r3.log"; check R4 "068 down succeeds when clean" "$?" 0
check R5 "068 schema removed, 067 prices kept" "$(sql "$SCHEMA") $(sql "$PRICES")" "0/false/0 $NEWP"
one new npm run migration:revert:prod > "$W/r4.log"; check R6 "067 down restores old prices" "$(sql "$PRICES")" "$OLDP"
check R7 "back at 066" "$(last)" "$BASECOUNT 1748300000066"
docker rm -f ${P}new >/dev/null; serve old; check R8 "baseline api serves after schema rollback" "$(get old /health)" 200
one new npm run migration:run:prod > "$W/up3.log"; check R9 "re-applies cleanly" "$(last)" "$((BASECOUNT+2)) 1748300000068"

echo "── Full restore from the P0 dump"
docker rm -f ${P}old >/dev/null
sql "SELECT 1" >/dev/null
docker exec -i $DB psql -U noetia -d postgres -c 'DROP DATABASE noetia_staging' >/dev/null && docker exec -i $DB psql -U noetia -d postgres -c 'CREATE DATABASE noetia_staging' >/dev/null
docker exec -i $DB pg_restore -U noetia -d noetia_staging --no-owner < "$W/p0.dump" > "$W/restore.log" 2>&1
check D1 "dump restores to 066" "$(last)" "$BASECOUNT 1748300000066"
check D2 "prices restored" "$(sql "$PRICES")" "$OLDP"
check D3 "baseline api serves after restore" "$(serve old && get old /health)" 200

echo "RESULT migration-rehearsal PASSED=$PASS FAILED=$FAIL FAILED_IDS=[${FAILED# }]"
[ "$FAIL" -eq 0 ]
