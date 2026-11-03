#!/usr/bin/env bash
# NEM-017 — LOCAL rehearsal of the production rollout and rollback sequence.
#
# Starts from the ORIGINAL configuration (staging on the shared proxy network),
# applies the NEM-017 steps in order — create proxy_staging, attach the RUNNING
# Traefik live, move staging — then rolls back. A background monitor requests
# the production site through Traefik every 50 ms during the whole rehearsal;
# the rehearsal passes only if production never returned anything but prod-web,
# Traefik was never restarted, and staging routing works at each stable point.
#
# Usage (repo root): BEFORE_STAGING=… BEFORE_TRAEFIK=… [PROD_COMPOSE=…] \
#   infra/tests/network-isolation/rollout.sh
# BEFORE_* must point at the pre-NEM-017 files (e.g. `git show origin/nem-006a-staging:<path>`).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
PROD_COMPOSE="${PROD_COMPOSE:-$ROOT/docker-compose.server.yml}"
AFTER_STAGING="$ROOT/docker-compose.staging.yml"
AFTER_TRAEFIK="$ROOT/infra/server/traefik/docker-compose.yml"
: "${BEFORE_STAGING:?path to the pre-NEM-017 docker-compose.staging.yml}"
: "${BEFORE_TRAEFIK:?path to the pre-NEM-017 traefik docker-compose.yml}"
P=s19h; WORK="$(mktemp -d)"; PASS=0; FAIL=0
dc() { docker compose -p "$1" -f "$WORK/$2.yml" "${@:3}"; }
cleanup() {
  [ -n "${MON:-}" ] && kill "$MON" 2>/dev/null
  for pr in "${P}noetia_staging:stg-after" "${P}noetia_staging:stg-before" "${P}noetia:prod" "${P}traefik:traefik-before"; do
    dc "${pr%%:*}" "${pr##*:}" down --remove-orphans >/dev/null 2>&1 || true; done
  for n in $(docker network ls --format '{{.Name}}' | grep "^${P}" || true); do docker network rm "$n" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT
HASH="$(openssl passwd -apr1 s19test)"
printf "DB_PASS=x\nMINIO_ACCESS_KEY=x\nMINIO_SECRET_KEY=xxxxxxxx\nMEILI_MASTER_KEY=x\nGRAFANA_ADMIN_PASSWORD=x\nSTAGING_BASICAUTH='s19:%s'\n" "$HASH" > "$WORK/dummy.env"
gen() { # compose project out [--traefik]
  local d; d="$(mktemp -d -p "$WORK")"; cp "$1" "$d/c.yml"; touch "$d/.env.production" "$d/.env.staging"
  docker compose -p "$2" --env-file "$WORK/dummy.env" -f "$d/c.yml" config --format json > "$d/c.json" || exit 2
  python3 "$HERE/mirror.py" "$d/c.json" "$4" "$P" "$WORK/$3.yml" ${5:-}
}
gen "$PROD_COMPOSE" noetia prod prod
gen "$BEFORE_STAGING" noetia_staging stg-before stg
gen "$AFTER_STAGING" noetia_staging stg-after stg
gen "$BEFORE_TRAEFIK" traefik traefik-before traefik --traefik
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
route() { curl -s -m 2 -H "Host: $1" "http://127.0.0.1:18443$2" "${@:3}"; }
expect() { local got; got="$(route "$2" "$3")"; [ "$got" = "$4" ] && ok "$1 ($2$3 → $got)" || bad "$1 ($2$3 → '$got', expected $4)"; }

echo "── Initial state: ORIGINAL configuration"
docker network create ${P}proxy >/dev/null
dc ${P}traefik traefik-before up -d >/dev/null 2>&1
dc ${P}noetia prod up -d >/dev/null 2>&1
dc ${P}noetia_staging stg-before up -d >/dev/null 2>&1; sleep 4
STARTED="$(docker inspect -f '{{.State.StartedAt}}' ${P}traefik)"
expect I1 noetia.app / prod-web
expect I2 staging.noetia.app /api/books stg-api
( while :; do echo "$(route noetia.app /)"; sleep 0.05; done > "$WORK/monitor" ) & MON=$!

echo "── Step 1: docker network create proxy_staging"
docker network create ${P}proxy_staging >/dev/null && ok "S1 network created"
expect S1b noetia.app / prod-web
echo "── Step 2: docker network connect proxy_staging traefik  (live, no restart)"
docker network connect ${P}proxy_staging ${P}traefik && ok "S2 Traefik attached live"
[ "$(docker inspect -f '{{.State.StartedAt}}' ${P}traefik)" = "$STARTED" ] && ok "S2b Traefik not restarted" || bad "S2b Traefik restarted"
expect S2c noetia.app / prod-web
expect S2d staging.noetia.app /api/books stg-api
echo "── Step 3: recreate staging with the NEM-017 compose (proxy_staging)"
dc ${P}noetia_staging stg-after up -d --remove-orphans >/dev/null 2>&1; sleep 4
expect S3a staging.noetia.app /api/books stg-api
expect S3b storage.staging.noetia.app / stg-storage
expect S3c noetia.app / prod-web
ON="$(docker network inspect ${P}proxy -f '{{range .Containers}}{{.Name}} {{end}}')"
echo "$ON" | grep -q "${P}noetia_staging-" && bad "S3d staging still on proxy: $ON" || ok "S3d no staging container on proxy"
echo "── Rollback R1: staging back to the ORIGINAL compose"
dc ${P}noetia_staging stg-before up -d --remove-orphans >/dev/null 2>&1; sleep 4
expect RB1 staging.noetia.app /api/books stg-api
echo "── Rollback R2: docker network disconnect proxy_staging traefik ; network rm"
docker network disconnect ${P}proxy_staging ${P}traefik && docker network rm ${P}proxy_staging >/dev/null && ok "RB2 detached and removed"
[ "$(docker inspect -f '{{.State.StartedAt}}' ${P}traefik)" = "$STARTED" ] && ok "RB2b Traefik never restarted" || bad "RB2b Traefik restarted"
expect RB3 noetia.app / prod-web
expect RB4 staging.noetia.app /api/books stg-api
kill $MON 2>/dev/null; MON=; sleep 0.2
TOTAL=$(grep -c . "$WORK/monitor"); BADN=$(grep -vc '^prod-web$' "$WORK/monitor")
[ "$BADN" -eq 0 ] && ok "MON production answered prod-web to all $TOTAL monitor requests" || bad "MON $BADN of $TOTAL production requests were not prod-web"
echo "PASSED: $PASS  FAILED: $FAIL"; [ "$FAIL" -eq 0 ]
