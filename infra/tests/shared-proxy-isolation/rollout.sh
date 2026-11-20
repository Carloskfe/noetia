#!/usr/bin/env bash
# NEM-018 — rehearsal of the proposed production migration and rollback.
# LOCAL ONLY — never run on the server. Starts from today's topology and uses the
# same commands as the runbook, including AutoGuildX's CD script (rm -f of web,
# api, db, then `up -d --remove-orphans`), restricted to n18h-prefixed containers.
# Monitors request noetia.app and autoguildx.com every 50 ms during every step.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
trap cleanup EXIT
N=$PNOE; A=$PAGX; T=${P}traefik

resolve "$PROD_COMPOSE" noetia "$WORK/noe.json" || exit 2
python3 "$HERE/mirror.py" "$WORK/noe.json" noetia $P "$WORK/noe.yml" --rewrite-host api
for v in before after; do
  d="$FIX"; [ $v = after ] && { d="$WORK/agx-after"; patched_agx "$d"; }
  resolve "$d/docker-compose.server.yml" autoguildx "$WORK/agx-$v.json" 2>/dev/null || exit 2
  resolve "$d/docker-compose.analytics.yml" autoguildx "$WORK/ana-$v.json" 2>/dev/null || exit 2
  python3 "$HERE/mirror.py" "$WORK/agx-$v.json" agx $P "$WORK/agx-$v.yml"
  python3 "$HERE/mirror.py" "$WORK/ana-$v.json" agx $P "$WORK/ana-$v.yml"
done
traefik_file "$WORK/tra-before.yml" proxy
ensure_nets proxy
dc $PTRA "$WORK/tra-before.yml" up -d >/dev/null 2>&1
dc $N "$WORK/noe.yml" up -d >/dev/null 2>&1
dc $A "$WORK/agx-before.yml" up -d >/dev/null 2>&1
dc $A "$WORK/ana-before.yml" up -d >/dev/null 2>&1
sleep 5
started() { docker inspect -f '{{.State.StartedAt}}/{{.RestartCount}}' $T; }
BOOT="$(started)"
noe_ids() { docker ps -q --no-trunc --filter "label=com.docker.compose.project=$N" | sort | tr -d '\n' | sha256sum | cut -c1-12; }
NOE_IDS="$(noe_ids)"

monitor() { # <host> <outfile>; stops when $WORK/stop exists
  while [ ! -e "$WORK/stop" ]; do
    printf '%s %s\n' "$(date +%s.%N)" "$(req "$1" / --max-time 2 -w ' %{http_code}' 2>/dev/null | tr '\n' ' ')" >> "$2"; sleep 0.05
  done; }
# Counter of answers (the leading timestamp is dropped).
counts() { python3 -c 'import json,collections,sys; print(json.dumps(collections.Counter(" ".join(l.split()[1:]) for l in open(sys.argv[1]) if l.strip())))' "$1"; }
# Seconds between the first and the last non-200 answer.
outage() { python3 -c 'import sys
t=[float(l.split()[0]) for l in open(sys.argv[1]) if l.strip() and not l.split()[-1]=="200"]
print(f"{t[-1]-t[0]:.1f}s across {len(t)} failed samples" if t else "none")' "$1"; }
mon_start() { rm -f "$WORK/stop" "$WORK/mon.noe" "$WORK/mon.agx"; touch "$WORK/mon.noe" "$WORK/mon.agx"
  monitor noetia.app "$WORK/mon.noe" & M1=$!; monitor autoguildx.com "$WORK/mon.agx" & M2=$!; }
mon_stop() { touch "$WORK/stop"; wait $M1 $M2 2>/dev/null; }
# What the AutoGuildX CD job does, restricted to this harness' containers.
agx_cd() { # <agx-compose>
  docker ps -a --format '{{.Names}}' | grep -E "^${A}-(web|api|db)" | xargs -r docker rm -f >/dev/null 2>&1 || true
  dc $A "$1" up -d --remove-orphans 2>&1; }

echo "── Precondition: the new AutoGuildX file before the network exists"
OUT="$(dc $A "$WORK/agx-after.yml" up -d --no-deps api web 2>&1)"; RC=$?
check P1 "compose refuses to start (network missing)" "$(js1 "rc=$([ $RC -ne 0 ] && echo nonzero || echo 0)")" 'rc=nonzero'
sleep 1
check P2 "without the CD rm -f, AutoGuildX stays up"  "$(js1 "$(req autoguildx.com /)")" 'agx-web'
echo "        compose said: $(echo "$OUT" | tail -1)"
OUT="$(agx_cd "$WORK/agx-after.yml")"; RC=$?
check P3 "the CD job with the network missing fails..."    "$(js1 "rc=$([ $RC -ne 0 ] && echo nonzero || echo 0)")" 'rc=nonzero'
check P4 "...AFTER removing AutoGuildX web, api, db (outage)" "$(js1 "$(docker ps -a --format '{{.Names}}' | grep -cE "^$A-(web|api|db)-" || true)")" '0'
dc $A "$WORK/agx-before.yml" up -d >/dev/null 2>&1; sleep 4
check P5 "restored by applying the previous file"          "$(js1 "$(req autoguildx.com /)")" 'agx-web'

mon_start
echo "── Step 1: create proxy_agx and attach the RUNNING Traefik"
docker network create ${P}proxy_agx >/dev/null
docker network connect ${P}proxy_agx $T
sleep 3
check A1 "Traefik not restarted by the live attach"        "$(js1 "$([ "$(started)" = "$BOOT" ] && echo same || echo changed)")" 'same'
check A2 "Traefik is on proxy and proxy_agx"               "$(js1 "$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' $T | xargs)")" "${P}proxy ${P}proxy_agx"
check A3 "autoguildx.com still answers (still on proxy)"   "$(js1 "$(req autoguildx.com /)")" 'agx-web'

echo "── Step 2: AutoGuildX deploys the new file through its CD job"
agx_cd "$WORK/agx-after.yml" >"$WORK/cd1.log"; RC=$?
check B1 "CD job succeeded"                                "$(js1 "rc=$RC")" 'rc=0'
sleep 4
check B2 "autoguildx.com → AutoGuildX web"                 "$(js1 "$(req autoguildx.com /)")" 'agx-web'
check B3 "autoguildx.com/api → AutoGuildX api"             "$(js1 "$(req autoguildx.com /api/v1/x)")" 'agx-api'
check B4 "AutoGuildX web → api"                            "$(probe $A-web-1 http://api:4000/)" 'agx-api'
check B5 "AutoGuildX no longer on proxy"                   "$(js1 "$(docker network inspect ${P}proxy -f '{{range .Containers}}{{.Name}} {{end}}' | tr ' ' '\n' | grep -c "^$A" || true)")" '0'
check B6 "Noetia containers not recreated (same IDs)"      "$(js1 "$([ "$(noe_ids)" = "$NOE_IDS" ] && echo same || echo changed)")" 'same'
docker stop -t 1 $N-api-1 >/dev/null; sleep 3
check B7 "Noetia api DOWN: no answer from AutoGuildX"      "$(probe $N-web-1 http://api:4000/)" 'ERR:.*'
docker start $N-api-1 >/dev/null; sleep 3
# Discovery D1: analytics shares the compose project, so --remove-orphans removes it.
check D1 "PostHog removed as an orphan by the CD job"      "$(js1 "$(docker ps -a --format '{{.Names}}' | grep -c "^$A-posthog" || true)")" '0'
dc $A "$WORK/ana-after.yml" up -d >/dev/null 2>&1; sleep 4
check B8 "analytics.autoguildx.com after re-applying analytics" "$(js1 "$(req analytics.autoguildx.com /)")" 'agx-posthog'
mon_stop
check M1 "Noetia monitor during migration (excl. the deliberate stop in B7)" "$(counts "$WORK/mon.noe")" 'noetia-web 200'
check M2 "AutoGuildX monitor never answered by Noetia"    "$(counts "$WORK/mon.agx")" 'agx-web 200|(.* )?000|.* 404|.* 50[0-9]'
echo "        AutoGuildX outage: $(outage "$WORK/mon.agx") (stand-ins start instantly; production adds the image build)"

echo "── Failure drill: Traefik recreated from a file WITHOUT proxy_agx"
dc $PTRA "$WORK/tra-before.yml" up -d --force-recreate >/dev/null 2>&1; sleep 4
check G1 "noetia.app unaffected"                           "$(js1 "$(req noetia.app /)")" 'noetia-web'
G2="$(req autoguildx.com / --max-time 35 -o /dev/null -w '%{http_code} after %{time_total}s')"
check G2 "autoguildx.com is down (this is the hazard)"     "$(js1 "$G2")" '50[0-9] after .*'
BOOT="$(started)"
docker network connect ${P}proxy_agx $T; sleep 3
check G3 "live attach recovers it without a restart"       "$(js1 "$(req autoguildx.com /)")" 'agx-web'
check G4 "Traefik not restarted by the recovery"           "$(js1 "$([ "$(started)" = "$BOOT" ] && echo same || echo changed)")" 'same'
docker restart -t 1 $T >/dev/null; sleep 4
check G5 "a plain docker restart keeps the live attachment" "$(js1 "$(req autoguildx.com /)")" 'agx-web'
BOOT="$(started)"

mon_start
echo "── Rollback: previous AutoGuildX file through the same CD job"
agx_cd "$WORK/agx-before.yml" >"$WORK/cd2.log"; RC=$?
check C1 "rollback CD job succeeded"                       "$(js1 "rc=$RC")" 'rc=0'
dc $A "$WORK/ana-before.yml" up -d >/dev/null 2>&1
sleep 4
check C2 "autoguildx.com → AutoGuildX web"                 "$(js1 "$(req autoguildx.com /)")" 'agx-web'
check C3 "autoguildx.com/api → AutoGuildX api"             "$(js1 "$(req autoguildx.com /api/v1/x)")" 'agx-api'
check C4 "analytics.autoguildx.com → PostHog"              "$(js1 "$(req analytics.autoguildx.com /)")" 'agx-posthog'
check C5 "AutoGuildX back on proxy"                        "$(js1 "$(docker network inspect ${P}proxy -f '{{range .Containers}}{{.Name}} {{end}}' | tr ' ' '\n' | grep -c "^$A-api" || true)")" '1'
docker network disconnect ${P}proxy_agx $T
docker network rm ${P}proxy_agx >/dev/null
sleep 2
check C6 "Traefik not restarted by rollback or disconnect" "$(js1 "$([ "$(started)" = "$BOOT" ] && echo same || echo changed)")" 'same'
check C8 "Noetia containers not recreated by rollback"     "$(js1 "$([ "$(noe_ids)" = "$NOE_IDS" ] && echo same || echo changed)")" 'same'
check C7 "routing intact after disconnect"                 "$(js1 "$(req autoguildx.com /)")" 'agx-web'
mon_stop
check M3 "Noetia monitor during rollback"                  "$(counts "$WORK/mon.noe")" 'noetia-web 200'
check M4 "AutoGuildX monitor never answered by Noetia"     "$(counts "$WORK/mon.agx")" 'agx-web 200|(.* )?000|.* 404|.* 50[0-9]'
echo "        AutoGuildX outage: $(outage "$WORK/mon.agx") (stand-ins start instantly; production adds the image build)"

echo "RESULT rollout PASSED=$PASS FAILED=$FAIL FAILED_IDS=[${FAILED# }]"
[ "$FAIL" -eq 0 ]
