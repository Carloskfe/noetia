#!/usr/bin/env bash
# Does a `docker compose run` migration container join the Traefik service? LOCAL ONLY.
# Uses the API service's real labels and healthcheck from a staging compose file.
# Usage: oneoff-labels-check.sh <docker-compose.staging.yml>
set -uo pipefail
P=n16l; W="$(mktemp -d)"; NET=${P}proxy_staging; PORT=28543
cleanup() { docker compose -p ${P}app -f "$W/app.yml" down -v --remove-orphans >/dev/null 2>&1; docker rm -f ${P}traefik >/dev/null 2>&1; docker network rm $NET >/dev/null 2>&1; rm -rf "$W"; }
trap cleanup EXIT
D="$(mktemp -d -p "$W")"; cp "$1" "$D/c.yml"; touch "$D/.env.staging"
printf 'DB_PASS=x\nDB_USER=x\nDB_NAME=x\nMINIO_ACCESS_KEY=x\nMINIO_SECRET_KEY=xxxxxxxx\nMEILI_MASTER_KEY=x\nSTAGING_BASICAUTH=a:b\n' > "$W/e"
docker compose -p ${P}app --env-file "$W/e" -f "$D/c.yml" config --format json > "$W/c.json"
python3 - "$W/c.json" "$W/app.yml" "$NET" <<'PY'
import json,sys
c=json.load(open(sys.argv[1]))['services']['api']; net=sys.argv[3]
srv="require('http').createServer((q,r)=>r.end('api')).listen(4000)"
l=['services:','  api:','    image: node:20-alpine',f'    command: ["node","-e",{json.dumps(srv)}]','    labels:']
for k,v in sorted(c['labels'].items()):
    if not k.startswith('traefik.') or k.endswith('.certresolver'): continue
    if k=='traefik.docker.network': v=net
    l.append(f'      - {json.dumps(k+"="+v.replace("$$","$").replace("$","$$"))}')
l+=['    healthcheck:','      test: ["CMD","wget","-qO-","http://127.0.0.1:4000/"]','      interval: 2s','      start_period: 40s','    networks: [px]','networks:',f'  px: {{external: true, name: {net}}}']
open(sys.argv[2],'w').write('\n'.join(l)+'\n')
PY
docker network create $NET >/dev/null
docker run -d --name ${P}traefik --network $NET -p 127.0.0.1:$PORT:80 -v /var/run/docker.sock:/var/run/docker.sock:ro traefik:v2.11 --providers.docker=true --providers.docker.exposedbydefault=false --providers.docker.network=$NET --entrypoints.websecure.address=:80 --log.level=ERROR >/dev/null
dc() { docker compose -p ${P}app -f "$W/app.yml" "$@"; }
dc up -d >/dev/null 2>&1; for i in $(seq 1 30); do [ "$(curl -s -H 'Host: staging.noetia.app' http://127.0.0.1:$PORT/api/x)" = api ] && break; sleep 1; done
sample() { local n; declare -A c=(); for n in $(seq 1 $1); do s="$(curl -s --max-time 2 -o /dev/null -w '%{http_code}' -H 'Host: staging.noetia.app' http://127.0.0.1:$PORT/api/x)"; c[$s]=$(( ${c[$s]:-0} + 1 )); sleep 0.1; done; for k in "${!c[@]}"; do printf '%s=%s ' "$k" "${c[$k]}"; done; echo; }
echo "before: $(sample 20)"
oneoff() { # label  extra-run-args…  (container runs longer than a real migration, no http server)
  local name=${P}one$1; shift
  dc run -d --rm --no-deps --name $name "$@" api sleep 25 >/dev/null 2>&1
  sleep 3
  echo "  labels traefik.enable=$(docker inspect -f '{{index .Config.Labels "traefik.enable"}}' $name) health=$(docker inspect -f '{{.State.Health.Status}}' $name 2>/dev/null) aliases=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").DNSNames}}" $name)"
  echo "  during: $(sample 150)"
  docker rm -f $name >/dev/null 2>&1; sleep 2
}
echo "plain 'compose run' (healthcheck inherited):"; oneoff a
echo "with -l traefik.enable=false:"; oneoff c -l traefik.enable=false
echo "after: $(sample 20)"
