#!/usr/bin/env bash
# NEM-017 — local network-isolation regression test (S19). LOCAL ONLY.
#
# Mirrors the REAL compose files (networks + Traefik labels) with identity
# responders, then checks that a missing service fails safely instead of
# resolving to the other environment, that normal traffic stays in-environment,
# and that Traefik routes both environments — including across recreations.
#
# Usage (from the repo root):
#   infra/tests/network-isolation/run.sh                 # current working tree
#   PROD_COMPOSE=… STAGING_COMPOSE=… TRAEFIK_COMPOSE=… infra/tests/network-isolation/run.sh
# Requires Docker, python3, curl, openssl. Uses only "s19h"-prefixed local
# projects/networks and removes them on exit. Exit code 0 = all checks passed.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PROD_COMPOSE="${PROD_COMPOSE:-$ROOT/docker-compose.server.yml}"
STAGING_COMPOSE="${STAGING_COMPOSE:-$ROOT/docker-compose.staging.yml}"
TRAEFIK_COMPOSE="${TRAEFIK_COMPOSE:-$ROOT/infra/server/traefik/docker-compose.yml}"
P=s19h
WORK="$(mktemp -d)"
PASS=0; FAIL=0

dc() { docker compose -p "$1" -f "$WORK/$2.yml" "${@:3}"; }
cleanup() {
  for pr in "${P}noetia_staging:staging" "${P}noetia:prod" "${P}traefik:traefik"; do
    dc "${pr%%:*}" "${pr##*:}" down --remove-orphans >/dev/null 2>&1 || true
  done
  for n in $(docker network ls --format '{{.Name}}' | grep "^${P}" || true); do docker network rm "$n" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

# ── 1. Resolve the real compose files with throwaway values (no secrets) ──────
HASH="$(openssl passwd -apr1 s19test)"
cat > "$WORK/dummy.env" <<ENV
DB_PASS=x
MINIO_ACCESS_KEY=x
MINIO_SECRET_KEY=xxxxxxxx
MEILI_MASTER_KEY=x
GRAFANA_ADMIN_PASSWORD=x
STAGING_BASICAUTH='s19:${HASH}'
ENV
resolve() { # $1 compose file  $2 project  $3 out.json
  local d; d="$(mktemp -d -p "$WORK")"; cp "$1" "$d/compose.yml"
  touch "$d/.env.production" "$d/.env.staging"
  docker compose -p "$2" --env-file "$WORK/dummy.env" -f "$d/compose.yml" config --format json > "$3"
}
resolve "$PROD_COMPOSE" noetia "$WORK/prod.json" || exit 2
resolve "$STAGING_COMPOSE" noetia_staging "$WORK/staging.json" || exit 2
resolve "$TRAEFIK_COMPOSE" traefik "$WORK/traefik.json" || exit 2
python3 "$HERE/mirror.py" "$WORK/prod.json" prod "$P" "$WORK/prod.yml"
python3 "$HERE/mirror.py" "$WORK/staging.json" stg "$P" "$WORK/staging.yml"
python3 "$HERE/mirror.py" "$WORK/traefik.json" traefik "$P" "$WORK/traefik.yml" --traefik

# ── 2. Start: external networks, Traefik, production, staging ─────────────────
for n in $(grep -ohE "name: ${P}[a-z_]+" "$WORK"/*.yml | awk '{print $2}' | sort -u); do
  docker network create "$n" >/dev/null 2>&1 || true
done
dc "${P}traefik" traefik up -d >/dev/null 2>&1 || { echo "traefik failed to start"; exit 2; }
dc "${P}noetia" prod up -d >/dev/null 2>&1 || { echo "prod failed to start"; exit 2; }
dc "${P}noetia_staging" staging up -d >/dev/null 2>&1 || { echo "staging failed to start"; exit 2; }
sleep 4

PROBE='const h=require("http");const[u,n,w]=process.argv.slice(1);const z=t=>new Promise(r=>setTimeout(r,t));(async()=>{const s={};for(let i=0;i<+n;i++){if(+w)await z(+w);const r=await new Promise(res=>{const q=h.get(u,{timeout:2000},x=>{let d="";x.on("data",c=>d+=c);x.on("end",()=>res(d))});q.on("timeout",()=>{q.destroy();res("ERR:TIMEOUT")});q.on("error",e=>res("ERR:"+e.code))});s[r]=(s[r]||0)+1}console.log(JSON.stringify(s))})()'
probe() { docker exec "$1" node -e "$PROBE" "$2" "${3:-20}" "${4:-0}"; }
# dns <container> <name>  → {"<addresses>":1} or {"ERR:<code>":1}
DNS='require("dns").lookup(process.argv[1],{all:true},(e,a)=>console.log(JSON.stringify({[e?"ERR:"+e.code:a.map(x=>x.address).join(",")]:1})))'
dns() { docker exec "$1" node -e "$DNS" "$2"; }
# check <id> <description> <observed-json> <regex every answer must match>
check() {
  if python3 -c 'import json,re,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d and all(re.fullmatch(sys.argv[2],k) for k in d) else 1)' "$3" "$4"; then
    PASS=$((PASS+1)); printf 'PASS  %-5s %-62s %s\n' "$1" "$2" "$3"
  else
    FAIL=$((FAIL+1)); printf 'FAIL  %-5s %-62s %s\n' "$1" "$2" "$3"
  fi
}
SAFE='ERR:.*'                     # a missing service must fail, never answer from elsewhere
STG="${P}noetia_staging"; PRD="${P}noetia"
curl_host() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $1" "http://127.0.0.1:18443$2" "${@:3}"; }
curl_body() { curl -s -H "Host: $1" "http://127.0.0.1:18443$2" "${@:3}"; }

echo "── Normal traffic stays in-environment"
check N1 "staging web → api"         "$(probe $STG-web-1 http://api:4000/)"       'stg-api'
check N2 "staging api → storage"     "$(probe $STG-api-1 http://storage:9000/)"   'stg-storage'
check N3 "staging api → db"          "$(probe $STG-api-1 http://db:5432/)"        'stg-db'
check N4 "staging api → cache"       "$(probe $STG-api-1 http://cache:6379/)"     'stg-cache'
check N5 "production web → api"      "$(probe $PRD-web-1 http://api:4000/)"       'prod-api'
check N6 "production api → storage"  "$(probe $PRD-api-1 http://storage:9000/)"   'prod-storage'
check N7 "production api → db"       "$(probe $PRD-api-1 http://db:5432/)"        'prod-db'

echo "── Traefik routes both environments (TLS omitted locally)"
check T1 "noetia.app → production web"            "{\"$(curl_body noetia.app /)\":1}"                         'prod-web'
check T2 "noetia.app/api → production api"        "{\"$(curl_body noetia.app /api/books)\":1}"                'prod-api'
check T3 "storage.noetia.app → production storage" "{\"$(curl_body storage.noetia.app /)\":1}"                'prod-storage'
check T4 "staging.noetia.app (auth) → staging web" "{\"$(curl_body staging.noetia.app / -u s19:s19test)\":1}"  'stg-web'
check T5 "staging.noetia.app (no auth) → 401"     "{\"$(curl_host staging.noetia.app /)\":1}"                 '401'
check T6 "staging.noetia.app/api → staging api"   "{\"$(curl_body staging.noetia.app /api/books)\":1}"        'stg-api'
check T7 "storage.staging.noetia.app → staging storage" "{\"$(curl_body storage.staging.noetia.app /)\":1}"   'stg-storage'

echo "── S19 fall-through: a stopped service must fail safely"
docker stop $STG-storage-1 >/dev/null
check F1  "staging storage DOWN: staging api → storage"       "$(probe $STG-api-1 http://storage:9000/)" "$SAFE"
check F1d "staging storage DOWN: DNS lookup of storage"       "$(dns $STG-api-1 storage)" "$SAFE"
docker start $STG-storage-1 >/dev/null
docker stop $PRD-storage-1 >/dev/null
check F2  "production storage DOWN: production api → storage" "$(probe $PRD-api-1 http://storage:9000/)" "$SAFE"
check F2d "production storage DOWN: DNS lookup of storage"    "$(dns $PRD-api-1 storage)" "$SAFE"
docker start $PRD-storage-1 >/dev/null
docker stop $PRD-api-1 >/dev/null
check F3  "production api DOWN: production web → api"         "$(probe $PRD-web-1 http://api:4000/)" "$SAFE"
check F3d "production api DOWN: DNS lookup of api"            "$(dns $PRD-web-1 api)" "$SAFE"
docker start $PRD-api-1 >/dev/null
docker stop $STG-api-1 >/dev/null
check F4  "staging api DOWN: staging web → api"               "$(probe $STG-web-1 http://api:4000/)" "$SAFE"
check F4d "staging api DOWN: DNS lookup of api"               "$(dns $STG-web-1 api)" "$SAFE"
docker start $STG-api-1 >/dev/null
sleep 2

echo "── Recreation: no cross-environment answer while a container is replaced"
recreate_check() { # id desc prober project file service url allowed
  local out="$WORK/loop.$1"
  # 320 requests paced 25 ms apart (≥ 8 s) spanning the whole replacement; a
  # 1 s stop timeout so the old container is really gone inside the window.
  ( probe "$3" "$7" 320 25 > "$out" ) &
  local pid=$!
  sleep 0.5; dc "$4" "$5" up -d --force-recreate --no-deps -t 1 "$6" >/dev/null 2>&1
  wait $pid
  check "$1" "$2" "$(cat "$out")" "$8"
}
recreate_check R1 "staging api recreated: staging web → api"   $STG-web-1 $STG staging api     http://api:4000/     'stg-api|ERR:.*'
recreate_check R2 "staging storage recreated: staging api → storage" $STG-api-1 $STG staging storage http://storage:9000/ 'stg-storage|ERR:.*'
recreate_check R3 "production api recreated: production web → api" $PRD-web-1 $PRD prod api   http://api:4000/     'prod-api|ERR:.*'
recreate_check R4 "production storage recreated: prod api → storage" $PRD-api-1 $PRD prod storage http://storage:9000/ 'prod-storage|ERR:.*'
sleep 2
( for i in $(seq 1 60); do curl_body noetia.app /; echo; sleep 0.05; done > "$WORK/prodroute" ) &
pid=$!; dc $STG staging up -d --force-recreate --no-deps -t 1 web api storage >/dev/null 2>&1; wait $pid
check R5 "production routing during staging recreation" "$(python3 -c 'import json,collections,sys;print(json.dumps(collections.Counter(l.strip() for l in open(sys.argv[1]) if l.strip())))' "$WORK/prodroute")" 'prod-web'
dc "${P}traefik" traefik up -d --force-recreate >/dev/null 2>&1; sleep 4
check R6 "after Traefik recreation: noetia.app → production web" "{\"$(curl_body noetia.app /)\":1}" 'prod-web'
check R7 "after Traefik recreation: staging.noetia.app/api → staging api" "{\"$(curl_body staging.noetia.app /api/books)\":1}" 'stg-api'

echo "── Network membership"
ON_PROXY="$(docker network inspect ${P}proxy -f '{{range .Containers}}{{.Name}} {{end}}')"
check M1 "no staging container on production's proxy network" "{\"$(echo "$ON_PROXY" | tr ' ' '\n' | grep -c "^${STG}-" || true)\":1}" '0'

echo "PASSED: $PASS  FAILED: $FAIL"
[ "$FAIL" -eq 0 ]
