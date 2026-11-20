#!/usr/bin/env bash
# S-ALT deployment-transition harness (PA F-1). LOCAL ONLY — never run on a server.
#
# Usage: transition.sh forward|rollback compose-order|web-first
#   forward   old (generic `api`/`storage`, web image saltbuild-web-generic)  ->  new (S-ALT, saltbuild-web)
#   rollback  new -> old
#   compose-order  = what CD does today: one `docker compose up -d`, Compose picks the recreation order
#   web-first      = proposed: `docker compose stop web` BEFORE the `up -d` (then any order is safe)
# Env: API_START_DELAY (seconds the api needs to boot, default 8), REPEAT (transitions per run, default 1).
#
# Continuous host traffic through Traefik (traffic.py) during the transition: credentialed POST /api every
# 100 ms, page GET every 200 ms, SSR share page every 500 ms. PASS = no Noetia credential reaches any foreign
# endpoint (AGX api/web, foreign storage, tailnet sink). Also reports outage windows per stream.
set -uo pipefail
DIR="${1:?forward|rollback}"; MODE="${2:?compose-order|web-first}"
H="$(cd "$(dirname "$0")" && pwd)"; TP=18080
export API_START_DELAY="${API_START_DELAY:-8}"; REPEAT="${REPEAT:-1}"
EMIT="$(mktemp "${TMPDIR:-/tmp}/s-alt-values.XXXXXX")"
S_ALT_EMIT="$EMIT" "$H/contract.sh" >/dev/null || { echo "contract.sh FAILED"; rm -f -- "$EMIT"; exit 4; }
# shellcheck disable=SC1090
source "$EMIT"; rm -f -- "$EMIT"
NEW=(API_ALIAS="$API_ALIAS" STO_ALIAS="$STO_ALIAS" WEB_RUNTIME_API="$WEB_RUNTIME_API" WEB_IMAGE=saltbuild-web)
OLD=(API_ALIAS=api STO_ALIAS=storage WEB_RUNTIME_API=http://api:4000 WEB_IMAGE=saltbuild-web-generic)
if [[ $DIR == forward ]]; then FROM=("${OLD[@]}"); TO=("${NEW[@]}"); else FROM=("${NEW[@]}"); TO=("${OLD[@]}"); fi
for img in saltbuild-web saltbuild-web-generic; do docker image inspect $img >/dev/null 2>&1 || { echo "missing image $img (see README)"; exit 2; }; done
NOE=(docker compose -f "$H/noetia.yml" --project-directory "$H" -p saltnoe)
AGX=(docker compose -f "$H/agx.yml" -p saltagx)
STOPF="$(mktemp -u "${TMPDIR:-/tmp}/s-alt-stop.XXXXXX")"
cleanup() {
  touch "$STOPF" 2>/dev/null
  env "${FROM[@]}" "${NOE[@]}" down -v --remove-orphans >/dev/null 2>&1
  "${AGX[@]}" down -v --remove-orphans >/dev/null 2>&1
  docker rm -f salt-traefik salt-upstream-dns salt-tailnet-sink >/dev/null 2>&1
  docker network rm saltz_proxy >/dev/null 2>&1
}
on_exit() { cleanup; case "$STOPF" in "${TMPDIR:-/tmp}"/s-alt-stop.??????) rm -f -- "$STOPF" ;; esac; }
trap on_exit EXIT; cleanup; rm -f -- "$STOPF"

log_of() { docker exec "$1" python -c "import urllib.request,sys;print(urllib.request.urlopen('http://127.0.0.1:'+sys.argv[1]+'/__log').read().decode())" "$2"; }
secrets_in() { log_of "$1" "$2" | grep -oE 'SALT-SECRET-(TOKEN|COOKIE|BODY)' | wc -l; }
who_traefik() { curl -s -m 5 -H "Host: $1" -o /dev/null -D - "http://127.0.0.1:$TP$2" | tr -d '\r' | awk 'tolower($1)=="x-who:"{print $2}'; }
wait_route() { local i; for i in $(seq 1 120); do [[ "$(who_traefik "$1" "$2")" == "$3" ]] && return 0; sleep 0.5; done; return 1; }

echo "== transition dir=$DIR mode=$MODE api_start_delay=${API_START_DELAY}s repeat=$REPEAT docker=$(docker version --format '{{.Server.Version}}')"
docker network create --subnet 10.251.79.0/24 saltz_proxy >/dev/null || exit 3
docker run -d --name salt-upstream-dns --network saltz_proxy --ip 10.251.79.53 -e SINK_IP=10.251.79.80 \
  -v "$H/fakedns.py:/f.py:ro" python:3-alpine python -u /f.py >/dev/null
docker run -d --name salt-tailnet-sink --network saltz_proxy --ip 10.251.79.80 -e WHO=tailnet-sink -e PORT=4000,9000 \
  -v "$H/responder.py:/r/responder.py:ro" python:3-alpine python -u /r/responder.py >/dev/null
"${AGX[@]}" up -d --quiet-pull >/dev/null 2>&1 || { echo "agx up failed"; exit 3; }
env "${FROM[@]}" "${NOE[@]}" up -d --wait --quiet-pull >/dev/null 2>&1 || { echo "initial noe up failed"; exit 3; }
docker run -d --name salt-traefik --network saltz_proxy -p 127.0.0.1:$TP:80 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro traefik:v2.11 \
  --providers.docker=true --providers.docker.exposedbydefault=false --providers.docker.network=saltz_proxy \
  '--providers.docker.constraints=Label(`salt.test`,`1`)' --entrypoints.web.address=:80 >/dev/null
wait_route noetia.test /api/x noetia-api || { echo "api route never ready"; exit 3; }
echo "   start state: $(docker exec saltnoe-web-1 printenv INTERNAL_API_URL) / api aliases: $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{join $v.DNSNames ","}} {{end}}' saltnoe-api-1)"

python3 -I "$H/traffic.py" $TP "$STOPF" > "$STOPF.json" &
TPID=$!; sleep 3
T0=$(date +%s.%N)
for r in $(seq 1 "$REPEAT"); do
  if [[ $MODE == web-first ]]; then
    env "${FROM[@]}" "${NOE[@]}" stop web >/dev/null 2>&1                      # step 1: old web gone first
    [[ -z "$(docker ps -q -f name=saltnoe-web-1)" ]] || { echo "web still running"; exit 5; }
  fi
  env "${TO[@]}" "${NOE[@]}" up -d --wait --remove-orphans >/dev/null 2>&1      # step 2: exactly CD's `up`
  if [[ $REPEAT -gt 1 && $r -lt $REPEAT ]]; then                                 # bounce back for the next round
    [[ $MODE == web-first ]] && env "${TO[@]}" "${NOE[@]}" stop web >/dev/null 2>&1
    env "${FROM[@]}" "${NOE[@]}" up -d --wait --remove-orphans >/dev/null 2>&1
  fi
done
T1=$(date +%s.%N)
wait_route noetia.test /api/x noetia-api; sleep 3
touch "$STOPF"; wait $TPID
echo "   end state:   $(docker exec saltnoe-web-1 printenv INTERNAL_API_URL) / api aliases: $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{join $v.DNSNames ","}} {{end}}' saltnoe-api-1)"
printf '   transition wall time: %.1fs\n' "$(echo "$T1 - $T0" | bc)"
echo "   traffic: $(cat "$STOPF.json")"
AGXS=$(secrets_in saltagx-api-1 4000); SINKS=$(secrets_in salt-tailnet-sink 4000); WEBS=$(secrets_in saltagx-web-1 3000)
AGXSSR=$(log_of saltagx-api-1 4000 | grep -c '/shares/salt-tr-'); SINKSSR=$(log_of salt-tailnet-sink 4000 | grep -c '/shares/salt-tr-')
echo "   foreign secrets: agx-api=$AGXS agx-web=$WEBS tailnet-sink=$SINKS | foreign SSR share fetches: agx-api=$AGXSSR sink=$SINKSSR"
case "$STOPF" in "${TMPDIR:-/tmp}"/s-alt-stop.??????) rm -f -- "$STOPF.json" ;; esac
TOTAL=$((AGXS + SINKS + WEBS + AGXSSR + SINKSSR))
echo "RESULT transition dir=$DIR mode=$MODE repeat=$REPEAT foreign_hits=$TOTAL $([[ $TOTAL == 0 ]] && echo PASS || echo FAIL)"
[[ $TOTAL == 0 ]]
