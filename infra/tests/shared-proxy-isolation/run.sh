#!/usr/bin/env bash
# NEM-018 — topology test. LOCAL ONLY — never run on the server.
#
#   run.sh baseline       Noetia main + AutoGuildX a09e9a8, both on `proxy` (today)
#   run.sh alias          as baseline + unique aliases, callers use the unique names
#   run.sh noetia-moved   Noetia moves to proxy_noetia, AutoGuildX stays on proxy
#   run.sh recommended    AutoGuildX moves to proxy_agx via the proposed patch
#
# STAGING_COMPOSE=<file> adds the NEM-017 staging stack (recommended variant only).
# The files are the real compose files: networks and Traefik labels are kept and
# applications are replaced by identity responders. Exit 0 = every check passed.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
VARIANT="${1:?usage: run.sh baseline|alias|noetia-moved|recommended}"
trap cleanup EXIT

# ── Build the variant ─────────────────────────────────────────────────────────
AGX_DIR="$FIX"; NOE_ARGS=(); AGX_ARGS=(); NETS=(proxy); NOE_API=api; AGX_API=api; NOE_NET=proxy; AGX_NET=proxy
case "$VARIANT" in
  baseline) ;;
  alias)
    NOE_ARGS=(--alias noetia); AGX_ARGS=(--alias agx); NOE_API=noetia-api; AGX_API=agx-api ;;
  noetia-moved)
    NOE_ARGS=(--rename proxy=proxy_noetia); NETS=(proxy proxy_noetia); NOE_NET=proxy_noetia ;;
  recommended)
    AGX_DIR="$WORK/agx-after"; patched_agx "$AGX_DIR"; NETS=(proxy proxy_agx); AGX_NET=proxy_agx ;;
  *) echo "unknown variant $VARIANT"; exit 2 ;;
esac
resolve "$PROD_COMPOSE" noetia "$WORK/noe.json" || exit 2
resolve "$AGX_DIR/docker-compose.server.yml" autoguildx "$WORK/agx.json" || exit 2
resolve "$AGX_DIR/docker-compose.analytics.yml" autoguildx "$WORK/ana.json" || exit 2
python3 "$HERE/mirror.py" "$WORK/noe.json" noetia $P "$WORK/noe.yml" --rewrite-host "$NOE_API" ${NOE_ARGS[@]+"${NOE_ARGS[@]}"}
python3 "$HERE/mirror.py" "$WORK/agx.json" agx $P "$WORK/agx.yml" ${AGX_ARGS[@]+"${AGX_ARGS[@]}"}
python3 "$HERE/mirror.py" "$WORK/ana.json" agx $P "$WORK/ana.yml"
if [ -n "${STAGING_COMPOSE:-}" ]; then
  resolve "$STAGING_COMPOSE" noetia_staging "$WORK/stg.json" || exit 2
  python3 "$HERE/mirror.py" "$WORK/stg.json" stg $P "$WORK/stg.yml"
  NETS+=(proxy_staging)
fi
traefik_file "$WORK/tra.yml" "${NETS[@]}"
ensure_nets "${NETS[@]}"
dc $PTRA "$WORK/tra.yml" up -d >/dev/null 2>&1 || { echo "traefik failed"; exit 2; }
dc $PNOE "$WORK/noe.yml" up -d >/dev/null 2>&1 || { echo "noetia failed"; exit 2; }
dc $PAGX "$WORK/agx.yml" up -d >/dev/null 2>&1 || { echo "agx failed"; exit 2; }
dc $PAGX "$WORK/ana.yml" up -d >/dev/null 2>&1 || { echo "analytics failed"; exit 2; }
[ -n "${STAGING_COMPOSE:-}" ] && { dc $PSTG "$WORK/stg.yml" up -d >/dev/null 2>&1 || { echo "staging failed"; exit 2; }; }
sleep 5
N=$PNOE; A=$PAGX
SAFE='ERR:.*'
echo "═══ variant: $VARIANT (noetia→api via '$NOE_API', agx→api via '$AGX_API')"

echo "── N: each application resolves its own services"
check N1  "Noetia web → $NOE_API"            "$(probe $N-web-1 http://$NOE_API:4000/)"  'noetia-api'
check N2  "Noetia api → storage"             "$(probe $N-api-1 http://storage:9000/)"   'noetia-storage'
check N3  "Noetia api → db"                  "$(probe $N-api-1 http://db:5432/)"        'noetia-db'
check N4  "Noetia api → cache"               "$(probe $N-api-1 http://cache:6379/)"     'noetia-cache'
check N5  "Noetia api → search"              "$(probe $N-api-1 http://search:7700/)"    'noetia-search'
check N6  "Noetia api → image-gen"           "$(probe $N-api-1 http://image-gen:5000/)" 'noetia-image-gen'
check N7  "Noetia prometheus → api (scrape)" "$(probe $N-prometheus-1 http://api:4000/)" 'noetia-api'
check N8  "AutoGuildX web → $AGX_API"        "$(probe $A-web-1 http://$AGX_API:4000/)"  'agx-api'
check N9  "AutoGuildX api → db"              "$(probe $A-api-1 http://db:5432/)"        'agx-db'
check N10 "PostHog → posthog_db"             "$(probe $A-posthog-1 http://posthog_db:5432/)" 'agx-posthog_db'

echo "── T: Traefik reaches both applications; routing behaviour preserved (self-signed TLS)"
check T1  "noetia.app → Noetia web"                 "$(js1 "$(req noetia.app /)")" 'noetia-web'
check T2  "noetia.app/api/books → Noetia api"       "$(js1 "$(req noetia.app /api/books)")" 'noetia-api'
check T3  "…/api prefix is stripped"                "$(js1 "$(req noetia.app /api/books -D - -o /dev/null | tr -d '\r' | awk 'tolower($1)=="x-seen-path:"{print $2}')")" '/books'
check T4  "storage.noetia.app → Noetia storage"     "$(js1 "$(req storage.noetia.app /)")" 'noetia-storage'
check T5  "www.noetia.app → 301 apex"               "$(js1 "$(req www.noetia.app /x -o /dev/null -w '%{http_code} %{redirect_url}')")" '301 https://noetia.app/x'
check T6  "autoguildx.com → AutoGuildX web"         "$(js1 "$(req autoguildx.com /)")" 'agx-web'
check T7  "autoguildx.com/api/v1/x → AutoGuildX api" "$(js1 "$(req autoguildx.com /api/v1/x)")" 'agx-api'
check T8  "…/api prefix is NOT stripped"            "$(js1 "$(req autoguildx.com /api/v1/x -D - -o /dev/null | tr -d '\r' | awk 'tolower($1)=="x-seen-path:"{print $2}')")" '/api/v1/x'
check T9  "autoguildx.com/socket.io websocket upgrade" "$(js1 "$(req autoguildx.com /socket.io/ --http1.1 --max-time 2 -D - -o /dev/null -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' | tr -d '\r' | awk 'NR==1{c=$2} tolower($1)=="x-who:"{w=$2} END{print c" "w}')")" '101 agx-api'
check T10 "www.autoguildx.com → 301 apex"           "$(js1 "$(req www.autoguildx.com /x -o /dev/null -w '%{http_code} %{redirect_url}')")" '301 https://autoguildx.com/x'
check T11 "analytics.autoguildx.com → PostHog"      "$(js1 "$(req analytics.autoguildx.com /)")" 'agx-posthog'

echo "── X: neither application can see the other (everything running)"
NOE_IP=$(ip_on $N-api-1 "${P}$NOE_NET"); AGX_IP=$(ip_on $A-api-1 "${P}$AGX_NET"); STO_IP=$(ip_on $N-storage-1 "${P}$NOE_NET")
check X1 "Noetia web cannot resolve AutoGuildX api container"  "$(dns $N-web-1 $A-api-1)"  "$SAFE"
check X2 "Noetia web cannot resolve AutoGuildX web container"  "$(dns $N-web-1 $A-web-1)"  "$SAFE"
check X3 "Noetia web cannot resolve posthog"                   "$(dns $N-web-1 posthog)"   "$SAFE"
check X4 "AutoGuildX web cannot resolve Noetia api container"  "$(dns $A-web-1 $N-api-1)"  "$SAFE"
check X5 "AutoGuildX api cannot resolve Noetia storage"        "$(dns $A-api-1 storage)"   "$SAFE"
check X6 "AutoGuildX api has no IP path to Noetia api (metrics)" "$(probe $A-api-1 http://$NOE_IP:4000/metrics 1)" "$SAFE"
check X7 "AutoGuildX api has no IP path to Noetia MinIO"       "$(probe $A-api-1 http://$STO_IP:9000/ 1)" "$SAFE"
check X8 "Noetia api has no IP path to AutoGuildX api"         "$(probe $N-api-1 http://$AGX_IP:4000/ 1)" "$SAFE"

echo "── F: a stopped service fails safely instead of reaching the other application"
docker stop -t 1 $N-api-1 >/dev/null; sleep 3
check F1  "Noetia api DOWN: web → $NOE_API"                "$(probe $N-web-1 http://$NOE_API:4000/)" "$SAFE"
check F1g "Noetia api DOWN: generic name 'api' from web"   "$(dns $N-web-1 api)" "$SAFE"
# End to end: browser → Traefik → web rewrite (router for /api is gone with the api)
CODE=$(req noetia.app /api/auth/me -H 'Authorization: Bearer n18-canary' -o /dev/null -w '%{http_code}')
check E1  "Noetia api DOWN: browser token never reaches AutoGuildX" "$(probe $A-api-1 http://127.0.0.1:4000/__tokens 1)" '\[\]'
echo "        (browser saw HTTP $CODE from noetia.app/api/auth/me)"
docker start $N-api-1 >/dev/null; sleep 3
docker stop -t 1 $A-api-1 >/dev/null; sleep 1
check F2  "AutoGuildX api DOWN: web → $AGX_API"            "$(probe $A-web-1 http://$AGX_API:4000/)" "$SAFE"
check F2g "AutoGuildX api DOWN: generic name 'api' from web" "$(dns $A-web-1 api)" "$SAFE"
docker start $A-api-1 >/dev/null
docker stop -t 1 $N-web-1 >/dev/null; sleep 1
check F3  "Noetia web DOWN: generic name 'web' from api"   "$(dns $N-api-1 web)" "$SAFE"
docker start $N-web-1 >/dev/null
docker stop -t 1 $A-web-1 >/dev/null; sleep 1
check F4  "AutoGuildX web DOWN: generic name 'web' from api" "$(dns $A-api-1 web)" "$SAFE"
docker start $A-web-1 >/dev/null
sleep 3

echo "── R: no cross-application answer while a container is replaced"
recreate_check() { # id desc prober project file service url allowed
  local out="$WORK/loop.$1"
  ( probe "$3" "$7" 320 25 > "$out" ) & local pid=$!
  sleep 0.5; dc "$4" "$5" up -d --force-recreate --no-deps -t 1 "$6" >/dev/null 2>&1
  wait $pid
  check "$1" "$2" "$(cat "$out")" "$8"
}
# Per-request connections (agent:false), so every request does a fresh DNS lookup.
recreate_check R1 "Noetia api recreated: web → $NOE_API"     $N-web-1 $N "$WORK/noe.yml" api http://$NOE_API:4000/ 'noetia-api|ERR:.*'
recreate_check R2 "AutoGuildX api recreated: web → $AGX_API" $A-web-1 $A "$WORK/agx.yml" api http://$AGX_API:4000/ 'agx-api|ERR:.*'
sleep 3
check R3 "after recreations: noetia.app/api → Noetia api"      "$(js1 "$(req noetia.app /api/x)")" 'noetia-api'
check R4 "after recreations: autoguildx.com/api → AutoGuildX"  "$(js1 "$(req autoguildx.com /api/x)")" 'agx-api'
check R5 "after recreations: Noetia web → $NOE_API"     "$(probe $N-web-1 http://$NOE_API:4000/)" 'noetia-api'
check R6 "after recreations: AutoGuildX web → $AGX_API" "$(probe $A-web-1 http://$AGX_API:4000/)" 'agx-api'

echo "── M: network membership"
SHARED=$(python3 - "$P" <<'PY'
import json,re,subprocess,sys
p=sys.argv[1]
bad=[]
for n in subprocess.check_output(['docker','network','ls','--format','{{.Name}}'],text=True).split():
    if not n.startswith(p): continue
    cs=json.loads(subprocess.check_output(['docker','network','inspect',n]))[0]['Containers']
    apps=set()
    for c in cs.values():
        name=c['Name']
        if name==p+'traefik': continue
        apps.add(re.match(r'(noetia_staging|noetia|autoguildx)[-_]',name[len(p):]).group(1))
    if len(apps)>1: bad.append(n[len(p):]+':'+'+'.join(sorted(apps)))
print(','.join(bad) or 'none')
PY
)
check M1 "no network holds two applications (Traefik excepted)" "$(js1 "$SHARED")" 'none'

if [ -n "${STAGING_COMPOSE:-}" ]; then
  echo "── S: coexistence with the NEM-017 staging stack (three proxy networks)"
  S=$PSTG
  check S1 "Staging web → api"                        "$(probe $S-web-1 http://api:4000/)" 'stg-api'
  check S2 "staging.noetia.app/api → staging api (no basic auth, by design)" "$(js1 "$(req staging.noetia.app /api/x)")" 'stg-api'
  check S2b "staging.noetia.app without basic auth → 401" "$(js1 "$(req staging.noetia.app / -o /dev/null -w '%{http_code}')")" '401'
  docker stop -t 1 $S-api-1 >/dev/null; sleep 1
  check S3 "Staging api DOWN: web → api fails safely"  "$(probe $S-web-1 http://api:4000/)" "$SAFE"
  docker start $S-api-1 >/dev/null
  docker stop -t 1 $N-storage-1 >/dev/null; sleep 1
  check S4 "Noetia storage DOWN: api → storage fails safely" "$(probe $N-api-1 http://storage:9000/)" "$SAFE"
  docker start $N-storage-1 >/dev/null
fi

echo "RESULT variant=$VARIANT PASSED=$PASS FAILED=$FAIL FAILED_IDS=[${FAILED# }]"
[ "$FAIL" -eq 0 ]
