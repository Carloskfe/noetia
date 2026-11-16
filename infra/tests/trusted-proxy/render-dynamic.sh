#!/usr/bin/env bash
# G1-I1 Checkpoint IV disposable harness — writes Traefik's dynamic routes for the disposable topology.
#
#   render-dynamic.sh OUT_DIR API_NETWORK [API_ADDRESS_OVERRIDE]
#
# Reads (docker inspect, read-only) the address of:
#   g1q4-api          on API_NETWORK          → route Host(noetia.test) && PathPrefix(/api)  (stripprefix /api)
#   g1q4-staging-api  on g1q4-proxy-staging   → route Host(staging.test)
#   g1q4-agx-api      on g1q4-proxy           → route Host(agx.test)
# i.e. what Traefik's Docker provider would select via `traefik.docker.network`. API_ADDRESS_OVERRIDE forces a
# specific (e.g. stale) API address to simulate a wrong label. Writes OUT_DIR/routes.yml only.
set -euo pipefail
OUT="$1"; API_NET="$2"; OVERRIDE="${3:-}"
case "$API_NET" in g1q4-*) ;; *) echo "refusing: network must be a g1q4-* test network" >&2; exit 1 ;; esac
ip_of() { docker inspect "$1" --format "{{with index .NetworkSettings.Networks \"$2\"}}{{.IPAddress}}{{end}}"; }
API_IP="${OVERRIDE:-$(ip_of g1q4-api "$API_NET")}"
STAGING_IP="$(ip_of g1q4-staging-api g1q4-proxy-staging)"
AGX_IP="$(ip_of g1q4-agx-api g1q4-proxy)"
[ -n "$API_IP" ] || { echo "g1q4-api has no address on $API_NET" >&2; exit 1; }
# Written to a temp name Traefik ignores (no .yml extension), then renamed: an in-place rewrite let Traefik's
# file watcher read a truncated file (no routes → brief 404s), observed in the first R-01 run.
cat > "$OUT/.routes.tmp" <<EOF
http:
  middlewares:
    strip-api: { stripPrefix: { prefixes: ["/api"] } }
  routers:
    noetia-api: { rule: "Host(\`noetia.test\`) && PathPrefix(\`/api\`)", entryPoints: [web], service: noetia-api, middlewares: [strip-api] }
    staging:    { rule: "Host(\`staging.test\`)", entryPoints: [web], service: staging }
    agx:        { rule: "Host(\`agx.test\`)", entryPoints: [web], service: agx }
  services:
    noetia-api: { loadBalancer: { servers: [{ url: "http://$API_IP:4000" }] } }
    staging:    { loadBalancer: { servers: [{ url: "http://$STAGING_IP:4000" }] } }
    agx:        { loadBalancer: { servers: [{ url: "http://$AGX_IP:4000" }] } }
EOF
mv -f "$OUT/.routes.tmp" "$OUT/routes.yml"
echo "routes: noetia-api→$API_IP ($API_NET) staging→$STAGING_IP agx→$AGX_IP"
