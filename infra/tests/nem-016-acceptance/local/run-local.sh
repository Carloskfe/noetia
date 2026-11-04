#!/usr/bin/env bash
# Validates the NEM-016 harness against a disposable local stack. LOCAL ONLY.
# Everything is named n16acc, bound to loopback, and removed on exit.
# X8 (stalled storage) has its own script, run-f1-f2.sh.
# Usage: run-local.sh   Needs images n16acc-api:new, n16acc-api:old (baseline),
#                       n16acc-image-gen:new (see README). Set N16_KEEP=1 to keep the stack.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
bring_up

say 'RUN 1: candidate API, full matrix'
export NEM016_RUN_ID="$(H new-run-id)"; RUN1=$NEM016_RUN_ID
evidence baseline
must H setup-accounts > "$WORK/accounts.log"
OUT="$(H setup-fixture 2>&1)"; case "$OUT" in *'no grant yet'*) R=refused;; *) R="$OUT";; esac; expect 'fixture upload refused without a grant' "$R" refused
must grant; must H setup-fixture; must revoke

G0=$(genCount); H run --only A1 >/dev/null; G1=$(genCount)
expect 'A1 caused no render' "$((G1-G0))" 0
[ "$G1" = "$G0" ] && H set-status A1.log PASS "Local: image-gen POST /generate count unchanged ($G0)"
G0=$(genCount); H run --only A7 >/dev/null; G1=$(genCount)
expect 'A7 caused no render' "$((G1-G0))" 0
[ "$G1" = "$G0" ] && H set-status A7.log PASS "Local: image-gen POST /generate count unchanged ($G0)"

H run --only A2,A3,A4,A5,A6,A8,A9,A10,A14,X1,X2,X3,X4,X5 --approve none | sed 's/^/  /'
H run --only A12,A15,A19 --approve A12,A15,A19 | sed 's/^/  /'

say 'A8b with a fake token'
AID="$(node -e 'console.log(require(process.argv[1]).users.a.id)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json")"
DC exec -T api node - "$AID" < "$HERE/seed-fake-social-token.cjs"; expect 'fake token seeded' "$?" 0
NEM016_A8B_TOKEN_SEEDED=1 H run --only A8b --approve A8b | sed 's/^/  /'

say 'X9 book deletion on real storage'
must grant
H run --only X9 --approve X9 | sed 's/^/  /'
must revoke

say 'A18 portable audit'
B18="$(PSQL -tA -c 'SELECT count(*), md5(string_agg(id, $$|$$ ORDER BY id)) FROM shares')"
DC exec -T api node dist/sharing/audit-legacy-shares.js > "$WORK/audit.json" 2>&1; RC=$?
A18="$(PSQL -tA -c 'SELECT count(*), md5(string_agg(id, $$|$$ ORDER BY id)) FROM shares')"
expect 'audit exit code' "$RC" 0; expect 'audit changed nothing' "$A18" "$B18"
[ "$RC" = 0 ] && [ "$A18" = "$B18" ] && H set-status A18.audit PASS 'Local: audit exited 0; shares unchanged'

A11_MODE="${N16_A11_MODE:-stop}"
say "A11 with storage interrupted (mode: docker $A11_MODE)"
H run --only A11 --approve A11 --phase prepare | sed 's/^/  /'
docker "$A11_MODE" n16acc-storage-1 >/dev/null
START=$(date +%s)
NEM016_A11_TIMEOUT_MS=${N16_A11_TIMEOUT_MS:-180000} H run --only A11 --approve A11 --phase paused | sed 's/^/  /'
echo "  revoke phase took $(( $(date +%s)-START ))s; A11.paused=$(status A11.paused)"
evidence a11-paused
PSQL -tA -c 'SELECT key, attempts, "lastError" FROM card_image_deletions' | sed 's/^/  outbox while interrupted: /'
if [ "$A11_MODE" = pause ]; then docker unpause n16acc-storage-1 >/dev/null; else docker start n16acc-storage-1 >/dev/null; fi
RESUME=$(date +%s)
echo '  storage resumed; waiting for the outbox to drain (sweep runs every 10 min)'
for _ in $(seq 1 135); do [ "$(PSQL -tA -c 'SELECT count(*) FROM card_image_deletions')" = 0 ] && break; sleep 5; done
echo "  outbox rows now: $(PSQL -tA -c 'SELECT count(*) FROM card_image_deletions'), $(( $(date +%s)-RESUME ))s after resuming"
H run --only A11 --approve A11 --phase after | sed 's/^/  /'

say 'A14b, then final evidence, report and clean-up'
evidence pre-a14b
grant
H run --only A14b --approve A14b | sed 's/^/  /'
IMG="$(node -e 'console.log(require(process.argv[1]).shares.a14b.imageUrl)' "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json")"
expect 'F2: after book deletion, the a14b card image' "$(curl -s -o /dev/null -w '%{http_code}' "$IMG")" 404
revoke
evidence final
H report --approve A8b,A11,A12,A14b,A15,A19 --out "$WORK/report-run1.md"
cp "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$WORK/state-run1.json"
for id in $(node --input-type=module -e "import('$HERE/../lib/matrix.mjs').then(({allChecks})=>console.log(allChecks().filter(c=>(c.kind==='api'||c.kind==='db')&&c.test!=='X8').map(c=>c.id).join(' ')))"); do expect "run 1 $id" "$(status "$id")" PASS; done
H cleanup | sed 's/^/  /'
expect 'cleanup dry run left accounts in place' "$(PSQL -tA -c "SELECT count(*) > 0 FROM users WHERE email LIKE 'nem016-%@staging.invalid'")" t
H cleanup --execute | sed 's/^/  /'
expect 'after clean-up, test accounts' "$(PSQL -tA -c "SELECT count(*) FROM users WHERE email LIKE 'nem016-%@staging.invalid'")" 0
expect 'after clean-up, fragments of test accounts' "$(PSQL -tA -c "SELECT count(*) FROM fragments f LEFT JOIN users u ON u.id=f.\"userId\" WHERE u.id IS NULL")" 0
expect 'after clean-up, live test shares' "$(PSQL -tA -c 'SELECT count(*) FROM shares WHERE "revokedAt" IS NULL')" 0
expect 'after clean-up, outbox rows' "$(PSQL -tA -c 'SELECT count(*) FROM card_image_deletions')" 0
expect 'after clean-up, the a14b image' "$(curl -s -o /dev/null -w '%{http_code}' "$IMG")" 404

say 'RUN 2: clean-up path that deletes the fixture itself'
export NEM016_RUN_ID="$(H new-run-id)"
must H setup-accounts >/dev/null; must grant; must H setup-fixture >/dev/null; must revoke
H run --only A2 | sed 's/^/  /'
H cleanup --execute | sed 's/^/  without grant: /'
expect 'without a grant the fixture stays' "$(PSQL -tA -c "SELECT count(*) FROM books WHERE title LIKE 'Cuaderno de pruebas%'")" 1
expect 'without a grant the admin account stays' "$(PSQL -tA -c "SELECT count(*) FROM users WHERE email LIKE 'nem016-%-adm@staging.invalid'")" 1
expect 'the retained fixture keeps its uploader' "$(PSQL -tA -c "SELECT \"uploadedById\" IS NOT NULL FROM books WHERE title LIKE 'Cuaderno de pruebas%'")" t
grant; H cleanup --execute | sed 's/^/  with grant: /'
expect 'with a grant the fixture is gone' "$(PSQL -tA -c "SELECT count(*) FROM books WHERE title LIKE 'Cuaderno de pruebas%'")" 0
expect 'no test accounts remain' "$(PSQL -tA -c "SELECT count(*) FROM users WHERE email LIKE 'nem016-%@staging.invalid'")" 0

say 'RUN 3: NEGATIVE CONTROL, baseline API on the migrated schema'
export N16_API_TAG=old
must DC up -d api; sleep 3; wait_healthy || exit 1
expect 'old app is serving (no revoke route, so a logged-out DELETE is 404)' "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$NEM016_LOCAL_API/shares/x")" 404
export NEM016_RUN_ID="$(H new-run-id)"
evidence baseline
must H setup-accounts >/dev/null
must grant; must H setup-fixture >/dev/null; must revoke
H run --approve A12,A15,A19 --only A1,A2,A3,A4,A5,A7,A9,A10,A12,A14,A15,X1,X2,X3 | sed 's/^/  /'
evidence final
H report --approve A12,A15,A19 --out "$WORK/report-negative.md"
cp "$NEM016_STATE_DIR/$NEM016_RUN_ID/state.json" "$WORK/state-negative.json"
for id in A1.api A3.api A5.api A7.api A10.api A14.api A15.api; do expect "negative control catches $id" "$(status $id)" FAIL; done
R="$(PSQL -tA -c "SELECT count(*) FROM shares s JOIN users u ON u.id=s.\"createdById\" WHERE u.email LIKE 'nem016-$NEM016_RUN_ID-%' AND s.\"configHash\" IS NULL AND s.\"revokedAt\" IS NULL")"
expect 'X7: old app created real shares on the 068 schema' "$([ "$R" -gt 0 ] && echo yes)" yes
echo "  shares created by the old app on the migrated schema: $R"
expect 'negative control catches A4.api' "$(status A4.api)" FAIL
expect 'negative control catches A12.fragment' "$(status A12.fragment)" FAIL
expect 'negative control catches X1.api' "$(status X1.api)" FAIL
H set-status X7.local PASS "Local: the baseline API created $R real shares on the 068 schema"
H report --approve A12,A15,A19 --out "$WORK/report-negative.md"

say "Done: $PASS expected results held, $FAIL did not. Work dir: $WORK"
[ "$FAIL" = 0 ]
