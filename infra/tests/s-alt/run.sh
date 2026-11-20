#!/usr/bin/env bash
# S-ALT disposable failure-path harness. LOCAL ONLY — never run on a server.
#
# Usage: run.sh [candidate|generic|plain][-b2]            (default: candidate)
#   candidate  values read from the EFFECTIVE docker-compose.server.yml (contract.sh), web = saltbuild-web
#              (built by `build.sh web`, i.e. through the production compose build arg)
#   generic    negative control = production today: aliases api/storage, web image built with
#              INTERNAL_API_URL=http://api:4000                (image saltbuild-web-generic)
#   plain      negative control = unique names WITHOUT the reserved suffix (noetia-api / noetia-storage),
#              shows the upstream-DNS (tailnet MagicDNS) fall-through (image saltbuild-web-plain)
#   -b2        additionally apply the PR #62 Stage B-2 topology (api leaves the shared proxy for an internal edge net)
# Env: NDOTS (if set, web/api get an explicit resolver ndots via ndots.yml; unset = production, Docker default), UPSTREAM_MODE (magic|all, see fakedns.py).
#
# Creates network saltz_proxy (10.251.79.0/24; named to sort AFTER the project networks, as `proxy` does after
# `noetia_noetia_net` in production — Docker DNS answers from the first-sorting network), projects saltnoe/saltagx,
# containers salt-traefik / salt-upstream-dns / salt-tailnet-sink; removes them on exit.
# Never touches anything not prefixed salt (local dev stacks noetia-*/autoguildx-* are not matched).
set -uo pipefail
VARIANT="${1:-candidate}"
H="$(cd "$(dirname "$0")" && pwd)"
TP=18080; NDOTS="${NDOTS:-}"; UPSTREAM_MODE="${UPSTREAM_MODE:-magic}"
BASEV="${VARIANT%-b2}"

case "$BASEV" in
  candidate)
    EMIT="$(mktemp "${TMPDIR:-/tmp}/s-alt-values.XXXXXX")"
    S_ALT_EMIT="$EMIT" "$H/contract.sh" >/dev/null || { echo "contract.sh FAILED — fix the static contract first"; rm -f -- "$EMIT"; exit 4; }
    # shellcheck disable=SC1090
    source "$EMIT"; rm -f -- "$EMIT"
    export API_ALIAS STO_ALIAS WEB_RUNTIME_API WEB_IMAGE="${WEB_IMAGE:-saltbuild-web}"
    STO="$API_MINIO_ENDPOINT" ;;
  generic) export API_ALIAS=api STO_ALIAS=storage WEB_RUNTIME_API=http://api:4000 WEB_IMAGE=saltbuild-web-generic; STO=storage ;;
  plain)   export API_ALIAS=noetia-api STO_ALIAS=noetia-storage WEB_RUNTIME_API=http://noetia-api:4000 WEB_IMAGE=saltbuild-web-plain; STO=noetia-storage ;;
  *) echo "unknown variant $VARIANT"; exit 2 ;;
esac
TARGET="$API_ALIAS"
docker image inspect "$WEB_IMAGE" >/dev/null 2>&1 || { echo "missing image $WEB_IMAGE (see README: build.sh / control builds)"; exit 2; }

NOEFILE="$H/noetia.yml"; EDGE=0
if [[ "$VARIANT" == *-b2 ]]; then
  EDGE=1; NOEFILE="$(mktemp "${TMPDIR:-/tmp}/s-alt-b2.XXXXXX")"
  python3 -I - "$H/noetia.yml" "$NOEFILE" <<'PY'
import sys
s = open(sys.argv[1]).read()
api_start = s.index("  api:"); sto_start = s.index("  storage:")
api = s[api_start:sto_start]
api = api.replace("      proxy: {}\n", "      edge: {}\n", 1).replace("traefik.docker.network=saltz_proxy", "traefik.docker.network=saltz_edge")
s = s[:api_start] + api + s[sto_start:]
s = s.replace("networks:\n  noetia_net: {}\n", "networks:\n  noetia_net: {}\n  edge:\n    external: true\n    name: saltz_edge\n", 1)
open(sys.argv[2], "w").write(s)
PY
fi
NOE=(docker compose -f "$NOEFILE" --project-directory "$H" -p saltnoe)
if [[ -n "$NDOTS" ]]; then export NDOTS; NOE+=(-f "$H/ndots.yml"); fi
AGX=(docker compose -f "$H/agx.yml" -p saltagx)
PASS=0; FAIL=0; FAILED=""

cleanup() {
  "${NOE[@]}" down -v --remove-orphans >/dev/null 2>&1
  "${AGX[@]}" down -v --remove-orphans >/dev/null 2>&1
  docker rm -f salt-traefik salt-upstream-dns salt-tailnet-sink >/dev/null 2>&1
  docker network rm saltz_proxy saltz_edge >/dev/null 2>&1
}
on_exit() { cleanup; [[ $EDGE == 1 ]] && case "$NOEFILE" in "${TMPDIR:-/tmp}"/s-alt-b2.??????) rm -f -- "$NOEFILE" ;; esac; }
trap on_exit EXIT
cleanup

check() { # id description actual expected-regex
  if [[ "$3" =~ ^($4)$ ]]; then PASS=$((PASS+1)); printf 'PASS %-4s %-74s %s\n' "$1" "$2" "$3"
  else FAIL=$((FAIL+1)); FAILED="$FAILED $1"; printf 'FAIL %-4s %-74s got=%s want=%s\n' "$1" "$2" "$3" "$4"; fi
}
fact() { printf 'FACT %-4s %-74s %s\n' "$1" "$2" "$3"; }

owner() { # map an IP to the salt container that owns it (any network)
  local ip="$1" c
  [[ "$ip" == ERR:* ]] && { echo "$ip"; return; }
  for c in $(docker ps --filter name=salt --format '{{.Names}}'); do
    docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$c" | tr ' ' '\n' | grep -qx "$ip" && { echo "$c"; return; }
  done
  echo "unknown:$ip"
}
dns_node() { owner "$(docker exec "$1" node -e "require('dns').promises.lookup(process.argv[1]).then(r=>console.log(r.address),e=>console.log('ERR:'+e.code))" "$2")"; }
dns_py()   { owner "$(docker exec "$1" python -c "
import socket,sys
try: print(socket.gethostbyname(sys.argv[1]))
except Exception as e: print('ERR:'+type(e).__name__)" "$2")"; }
http_py() { docker exec "$1" python -c "
import json,sys,urllib.request
try: print(json.load(urllib.request.urlopen(sys.argv[1],timeout=4))['who'])
except Exception as e: print('ERR:'+type(e).__name__)" "$2"; }
via_traefik() { curl -s -m 8 -H "Host: $1" "${@:3}" "http://127.0.0.1:$TP$2"; }
who_traefik() { via_traefik "$@" -o /dev/null -D - | tr -d '\r' | awk 'tolower($1)=="x-who:"{print $2}'; }
code_traefik() { via_traefik "$@" -o /dev/null -w '%{http_code}'; }
log_of() { docker exec "$1" python -c "import urllib.request,sys;print(urllib.request.urlopen('http://127.0.0.1:'+sys.argv[1]+'/__log').read().decode())" "$2"; }
secrets_in() { log_of "$1" "$2" | grep -oE 'SALT-SECRET-(TOKEN|COOKIE|BODY)' | wc -l; }
foreign_hits() { # requests received by every non-Noetia endpoint (AGX api/web, foreign storage, tailnet sink)
  local n=0 x
  for x in "$AA 4000" "$AW 3000" "saltagx-stg-storage-1 9000" "salt-tailnet-sink 4000"; do
    n=$((n + $(log_of $x | python3 -I -c "import json,sys;print(len(json.load(sys.stdin)))")))
  done; echo $n; }
wait_route() { local i; for i in $(seq 1 60); do [[ "$(who_traefik "$1" "$2")" == "$3" ]] && return 0; sleep 0.5; done; return 1; }
wait_gone()  { local i; for i in $(seq 1 60); do [[ "$(who_traefik "$1" "$2")" != "$3" ]] && return 0; sleep 0.5; done; return 1; }

echo "== variant=$VARIANT image=$WEB_IMAGE api_alias=$API_ALIAS storage_endpoint=$STO runtime_INTERNAL_API_URL=$WEB_RUNTIME_API ndots=${NDOTS:-unset} upstream=$UPSTREAM_MODE docker=$(docker version --format '{{.Server.Version}}')"
docker network create --subnet 10.251.79.0/24 saltz_proxy >/dev/null || exit 3
[[ $EDGE == 1 ]] && docker network create --internal saltz_edge >/dev/null
docker run -d --name salt-upstream-dns --network saltz_proxy --ip 10.251.79.53 -e SINK_IP=10.251.79.80 -e MODE="$UPSTREAM_MODE" \
  -v "$H/fakedns.py:/f.py:ro" python:3-alpine python -u /f.py >/dev/null
docker run -d --name salt-tailnet-sink --network saltz_proxy --ip 10.251.79.80 -e WHO=tailnet-sink -e PORT=4000,9000 \
  -v "$H/responder.py:/r/responder.py:ro" python:3-alpine python -u /r/responder.py >/dev/null
"${AGX[@]}" up -d --quiet-pull >/dev/null 2>&1 || { echo "agx up failed"; exit 3; }
"${NOE[@]}" up -d --quiet-pull >"${TMPDIR:-/tmp}/s-alt-up.log" 2>&1 || { echo "noe up failed:"; tail -5 "${TMPDIR:-/tmp}/s-alt-up.log"; exit 3; }
docker run -d --name salt-traefik --network saltz_proxy -p 127.0.0.1:$TP:80 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro traefik:v2.11 \
  --providers.docker=true --providers.docker.exposedbydefault=false --providers.docker.network=saltz_proxy \
  '--providers.docker.constraints=Label(`salt.test`,`1`)' --entrypoints.web.address=:80 >/dev/null
[[ $EDGE == 1 ]] && docker network connect saltz_edge salt-traefik
wait_route noetia.test /api/x noetia-api || echo "WARN: api route not ready"
for i in $(seq 1 90); do [[ "$(code_traefik noetia.test /)" == 200 ]] && break; sleep 0.5; done

W=saltnoe-web-1; A=saltnoe-api-1; AW=saltagx-web-1; AA=saltagx-api-1
TOKEN='Bearer SALT-SECRET-TOKEN'; COOKIE='refresh_token=SALT-SECRET-COOKIE'; BODY='{"password":"SALT-SECRET-BODY"}'

echo "-- 0. build/runtime consistency of the web image"
check B1 "baked /api rewrite == runtime INTERNAL_API_URL/:path*" \
  "$(docker exec $W sh -c "grep -o '\"destination\":\"http[^\"]*\"' .next/routes-manifest.json")" "\"destination\":\"${WEB_RUNTIME_API}/:path\\*\""
check B2 "container runtime INTERNAL_API_URL"                      "$(docker exec $W printenv INTERNAL_API_URL)" "$WEB_RUNTIME_API"

echo "-- 1. normal operation"
check N1 "web resolves $TARGET -> Noetia api"                      "$(dns_node $W $TARGET)"                    'saltnoe-api-1'
check N2 "browser noetia.test/api/x -> Noetia api (Traefik)"       "$(who_traefik noetia.test /api/x)"         'noetia-api'
check N3 "web /api rewrite (direct) -> Noetia api"                 "$(http_py $AW http://$W:3000/api/x)"        'noetia-api'
via_traefik noetia.test /s/salt-share-1 -o /dev/null
check N4 "SSR /s/<id> fetch reached Noetia api"                    "$(log_of $A 4000 | grep -c '/shares/salt-share-1')" '1'
check N5 "api resolves $STO -> Noetia storage"                     "$(dns_py $A $STO)"                          'saltnoe-storage-1'
check N6 "api -> http://$STO:9000 -> Noetia storage"               "$(http_py $A http://$STO:9000/)"            'noetia-storage'
check T1 "noetia.test/ -> 200 (web)"                               "$(code_traefik noetia.test /)"              '200'
check T2 "storage.noetia.test -> Noetia storage"                   "$(who_traefik storage.noetia.test /)"       'noetia-storage'
check N7 "no foreign endpoint received anything in normal operation" "$(foreign_hits)"                         '0'
check T3 "agx.test/api/x -> AGX api"                               "$(who_traefik agx.test /api/x)"             'agx-api'
check T4 "agx.test/ -> AGX web"                                    "$(who_traefik agx.test /)"                  'agx-web'
FH0=$(foreign_hits)   # the two legitimate AGX requests just made by T3/T4; later checks count requests beyond these

echo "-- 2-4. Noetia api STOPPED (AGX api runs with generic 'api'; upstream resolver answers tailnet-style names)"
"${NOE[@]}" stop api >/dev/null 2>&1; wait_gone noetia.test /api/x noetia-api
check F1  "web resolves $TARGET (api down) -> not found"           "$(dns_node $W $TARGET)"                    'ERR:ENOTFOUND|ERR:EAI_AGAIN'
fact  F1g "web resolves generic 'api' (api down)"                  "$(dns_node $W api)"
fact  F1b "web resolves bare 'noetia-api' (api down)"              "$(dns_node $W noetia-api)"
code=$(code_traefik noetia.test /api/books -X POST -H "Authorization: $TOKEN" -H "Cookie: $COOKIE" -H 'content-type: application/json' --data "$BODY")
check F2c "credentialed POST noetia.test/api/books -> temporary 5xx" "$code"                                   '5[0-9][0-9]'
check F2  "AGX api received NO Noetia credentials/body"            "$(secrets_in $AA 4000)"                     '0'
check F6  "tailnet sink received NO Noetia credentials/body"       "$(secrets_in salt-tailnet-sink 4000)"       '0'
code=$(code_traefik noetia.test /api/books -H "Authorization: $TOKEN")
check F7  "rewrite path, GET with token -> temporary 5xx"          "$code"                                      '5[0-9][0-9]'
via_traefik noetia.test /s/salt-share-2 -o /dev/null
check F3  "SSR /s/<id> (api down) did NOT reach AGX api"           "$(log_of $AA 4000 | grep -c '/shares/salt-share-2')" '0'
check F8  "SSR /s/<id> (api down) did NOT reach tailnet sink"      "$(log_of salt-tailnet-sink 4000 | grep -c '/shares/salt-share-2')" '0'
check F9  "no foreign endpoint received anything while api down"   "$(( $(foreign_hits) - FH0 ))"               '0'

echo "-- 5. Noetia api back"
"${NOE[@]}" start api >/dev/null 2>&1; wait_route noetia.test /api/x noetia-api
check F4  "web resolves $TARGET -> Noetia api again"               "$(dns_node $W $TARGET)"                    'saltnoe-api-1'
check F5  "web rewrite -> Noetia api again"                        "$(http_py $AW http://$W:3000/api/x)"        'noetia-api'

echo "-- 6. storage stays within Noetia"
"${NOE[@]}" stop storage >/dev/null 2>&1
check S1  "api resolves $STO (storage down) -> not found"          "$(dns_py $A $STO)"                          'ERR:gaierror'
check S2  "api -> http://$STO:9000 (storage down) fails closed"    "$(http_py $A http://$STO:9000/)"            'ERR:.*'
fact  S1g "api resolves generic 'storage' (storage down)"          "$(dns_py $A storage)"
check S4  "no foreign storage / sink received anything"            "$(( $(foreign_hits) - FH0 ))"               '0'
"${NOE[@]}" start storage >/dev/null 2>&1; sleep 1
check S3  "api -> $STO -> Noetia storage again"                    "$(http_py $A http://$STO:9000/)"            'noetia-storage'

echo "-- 7. repeated storage recreation (3x) with continuous fresh-DNS probing from api"
docker exec -d $A python -c "
import json,time,urllib.request
seen={}; end=time.time()+30
while time.time()<end:
    try: w=json.load(urllib.request.urlopen('http://$STO:9000/__probe',timeout=1.5))['who']
    except Exception as e: w='ERR:'+type(e).__name__
    seen[w]=seen.get(w,0)+1; time.sleep(0.1)
open('/tmp/sprobe.json','w').write(json.dumps(seen))"
for n in 1 2 3; do "${NOE[@]}" up -d --force-recreate --no-deps storage >/dev/null 2>&1; sleep 3; done
sleep 22
SPROBE="$(docker exec $A cat /tmp/sprobe.json 2>/dev/null)"
fact  R5  "storage probe outcomes (who:count) during recreations"  "$SPROBE"
check R6  "storage probe never answered by a foreign endpoint"     "$(echo "$SPROBE" | grep -cE 'foreign-storage|tailnet-sink|unknown')" '0'
check R7  "storage probe reached Noetia storage"                   "$(echo "$SPROBE" | grep -c 'noetia-storage')" '1'

echo "-- 8. repeated api recreation (5x force-recreate + stop/start) with continuous fresh-DNS probing from web"
docker exec -d $W node -e "
const http=require('http');const end=Date.now()+60000;const seen={};
(function loop(){ if(Date.now()>end){require('fs').writeFileSync('/tmp/probe.json',JSON.stringify(seen));return;}
 const r=http.get({host:'$TARGET',port:4000,path:'/__probe',agent:false,timeout:1500},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>{let w;try{w=JSON.parse(b).who}catch{w='bad'};seen[w]=(seen[w]||0)+1;setTimeout(loop,100)})});
 r.on('error',e=>{seen['ERR:'+e.code]=(seen['ERR:'+e.code]||0)+1;setTimeout(loop,100)});
 r.on('timeout',()=>r.destroy(Object.assign(new Error('t'),{code:'TIMEOUT'})));})();" 2>/dev/null
for n in 1 2 3 4 5; do "${NOE[@]}" up -d --force-recreate --no-deps api >/dev/null 2>&1; sleep 4; done
"${NOE[@]}" stop api >/dev/null 2>&1; sleep 6; "${NOE[@]}" start api >/dev/null 2>&1
sleep 50
PROBE="$(docker exec $W cat /tmp/probe.json 2>/dev/null)"
fact  R0  "api probe outcomes (who:count) during recreations"      "$PROBE"
check R1  "no probe answered by AGX or the tailnet sink"           "$(echo "$PROBE" | grep -cE 'agx-api|tailnet-sink|bad')" '0'
check R8  "probe file written (probe ran the full window)"         "$(echo "$PROBE" | grep -c 'noetia-api')" '1'
wait_route noetia.test /api/x noetia-api
check R2  "after recreations: noetia.test/api -> Noetia api"       "$(who_traefik noetia.test /api/x)"      'noetia-api'
check R3  "after recreations: web $TARGET -> Noetia api"           "$(dns_node $W $TARGET)"                 'saltnoe-api-1'
check R4  "after recreations: agx.test/api -> AGX api"             "$(who_traefik agx.test /api/x)"         'agx-api'
check Z1  "total Noetia secrets seen by any foreign endpoint"      "$(( $(secrets_in $AA 4000) + $(secrets_in $AW 3000) + $(secrets_in saltagx-stg-storage-1 9000) + $(secrets_in salt-tailnet-sink 4000) ))" '0'

echo "-- upstream resolver queries (names Docker could not answer locally)"
docker exec salt-upstream-dns sh -c 'sort /tmp/queries.log 2>/dev/null | uniq -c' | sed 's/^/     /'

echo "-- residual exposure (recorded, not pass/fail)"
fact  X1  "Noetia web resolves AGX container name saltagx-api-1"   "$(dns_node $W saltagx-api-1)"
fact  X2  "AGX web resolves Noetia container name saltnoe-api-1"   "$(dns_py $AW saltnoe-api-1)"
for net in saltz_proxy saltz_edge saltnoe_noetia_net; do
  NIP=$(docker inspect -f "{{with index .NetworkSettings.Networks \"$net\"}}{{.IPAddress}}{{end}}" $A 2>/dev/null)
  [[ -n "$NIP" ]] && fact X3 "AGX api -> Noetia api via $net ($NIP:4000)" "$(http_py $AA http://$NIP:4000/)"
done
"${AGX[@]}" stop api >/dev/null 2>&1
fact  X4  "AGX api DOWN: AGX web resolves generic 'api'"           "$(dns_py $AW api)"
fact  X5  "AGX api DOWN: AGX web -> http://api:4000"              "$(http_py $AW http://api:4000/)"
"${AGX[@]}" start api >/dev/null 2>&1

echo "RESULT variant=$VARIANT ndots=${NDOTS:-unset} PASSED=$PASS FAILED=$FAIL FAILED_IDS=[${FAILED# }]"
[[ $FAIL == 0 ]]
