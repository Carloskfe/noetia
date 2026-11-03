# NEM-018 harness library. LOCAL ONLY — never run on the server.
# Every project and network carries the n18h prefix; nothing else is ever touched.
# (Local dev stacks may use the real names noetia-* / autoguildx-*: never match those.)
P=n18h
PNOE=${P}noetia; PAGX=${P}autoguildx; PSTG=${P}noetia_staging; PTRA=${P}traefik
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PROD_COMPOSE="${PROD_COMPOSE:-$ROOT/docker-compose.server.yml}"
FIX="$HERE/fixtures/autoguildx"
PATCHFILE="$HERE/autoguildx-proxy-agx.patch"
HTTPS_PORT=28443
PASS=0; FAIL=0; FAILED=""

WORK="$(mktemp -d)"
cat > "$WORK/dummy.env" <<ENV
DB_USER=x
DB_NAME=x
DB_PASS=x
MINIO_ACCESS_KEY=x
MINIO_SECRET_KEY=xxxxxxxx
MEILI_MASTER_KEY=x
GRAFANA_ADMIN_PASSWORD=x
RESEND_API_KEY=x
POSTHOG_SECRET_KEY=x
POSTHOG_POSTGRES_PASSWORD=x
STAGING_BASICAUTH=n18:x
ENV

cleanup() {
  for p in "$PSTG" "$PNOE" "$PAGX" "$PTRA"; do
    for c in $(docker ps -aq --filter "label=com.docker.compose.project=$p"); do docker rm -f "$c" >/dev/null 2>&1 || true; done
  done
  for n in $(docker network ls --format '{{.Name}}' | grep "^${P}" || true); do docker network rm "$n" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}

resolve() { # <compose-file> <project> <out.json>  (real file + throwaway values)
  local d; d="$(mktemp -d -p "$WORK")"; cp "$1" "$d/compose.yml"
  touch "$d/.env.production" "$d/.env.staging"
  docker compose -p "$2" --env-file "$WORK/dummy.env" -f "$d/compose.yml" config --format json > "$3"
}

# Apply the proposed AutoGuildX patch to the unmodified fixtures.
patched_agx() { # <out-dir>
  mkdir -p "$1"; cp "$FIX"/*.yml "$1/"
  ( cd "$1" && patch -s -p1 < "$PATCHFILE" )
}

traefik_file() { # <out.yml> <network> [<network>…]
  local out="$1"; shift
  { echo 'services:'; echo '  traefik:'; echo '    image: traefik:v2.11'
    echo "    container_name: ${P}traefik"
    echo '    command:'
    echo '      - --providers.docker=true'
    echo '      - --providers.docker.exposedbydefault=false'
    echo "      - --providers.docker.network=${P}proxy"
    echo '      - --entrypoints.web.address=:80'
    echo '      - --entrypoints.websecure.address=:443'
    echo '      - --log.level=ERROR'
    echo "    ports: [\"127.0.0.1:${HTTPS_PORT}:443\"]"
    echo '    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"]'
    echo "    networks: [$(IFS=,; echo "$*" | sed 's/,/, /g')]"
    echo 'networks:'
    for n in "$@"; do echo "  $n: { external: true, name: ${P}$n }"; done
  } > "$out"
}
dc() { docker compose -p "$1" -f "$2" "${@:3}"; }
ensure_nets() { for n in "$@"; do docker network inspect "$P$n" >/dev/null 2>&1 || docker network create "$P$n" >/dev/null; done; }

PROBE='const h=require("http");const[u,n,w]=process.argv.slice(1);const z=t=>new Promise(r=>setTimeout(r,t));(async()=>{const s={};for(let i=0;i<+n;i++){if(+w)await z(+w);const r=await new Promise(res=>{const q=h.get(u,{agent:false,timeout:1500},x=>{let d="";x.on("data",c=>d+=c);x.on("end",()=>res(d))});q.on("timeout",()=>{q.destroy();res("ERR:TIMEOUT")});q.on("error",e=>res("ERR:"+e.code))});s[r]=(s[r]||0)+1}console.log(JSON.stringify(s))})()'
probe() { docker exec "$1" node -e "$PROBE" "$2" "${3:-5}" "${4:-0}"; }
DNS='require("dns").lookup(process.argv[1],{all:true},(e,a)=>console.log(JSON.stringify({[e?"ERR:"+e.code:a.map(x=>x.address).join(",")]:1})))'
dns() { docker exec "$1" node -e "$DNS" "$2"; }
ip_on() { docker inspect -f "{{(index .NetworkSettings.Networks \"$2\").IPAddress}}" "$1" 2>/dev/null; }
# https request through the local Traefik with the real Host and SNI
req() { local host="$1" path="$2"; shift 2
  curl -sk --max-time 5 --connect-to "$host:443:127.0.0.1:$HTTPS_PORT" "https://$host$path" "$@"; }
js1() { python3 -c 'import json,sys; print(json.dumps({sys.argv[1]:1}))' "$1"; }

check() { # <id> <description> <observed-json> <regex every observed key must fully match>
  if python3 -c 'import json,re,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d and all(re.fullmatch(sys.argv[2],k) for k in d) else 1)' "$3" "$4"; then
    PASS=$((PASS+1)); printf 'PASS  %-5s %-64s %s\n' "$1" "$2" "$3"
  else
    FAIL=$((FAIL+1)); FAILED="$FAILED $1"; printf 'FAIL  %-5s %-64s %s\n' "$1" "$2" "$3"
  fi
}
