#!/usr/bin/env bash
# G1-I1 Stage B-2 — network-contract test for infra/server/noetia-api-edge-network.sh.
#
# Runs the REAL helper against a FAKE `docker` on PATH (no daemon, no networks, no containers are touched), so
# every OK/STOP path is exercised deterministically: IPAM validation, idempotent creation flags, exact
# membership, Traefik attachments, and the API network/label contract (the R-05 fallback condition).
#
#   bash infra/tests/trusted-proxy/helper-contract.sh        # exit 0 = all cases pass
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HELPER="$HERE/../../server/noetia-api-edge-network.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/state"

# ── fake docker ────────────────────────────────────────────────────────────────
# State: $WORK/state/net.<field> files for the network, att.<container> ("net=ip" lines), label.<container>,
# members (names), created (create args log). Absent net.exists → network does not exist.
cat > "$WORK/bin/docker" <<'FAKE'
#!/usr/bin/env bash
S="$FAKE_STATE"
fmt=""; args=()
while [ $# -gt 0 ]; do
  case "$1" in --format) fmt="$2"; shift 2 ;; *) args+=("$1"); shift ;; esac
done
if [ "${args[0]}" = network ] && [ "${args[1]}" = inspect ]; then
  [ -f "$S/net.exists" ] || exit 1
  case "$fmt" in
    "") echo '[]' ;;
    '{{.Driver}}') cat "$S/net.driver" ;;
    '{{.Internal}}') cat "$S/net.internal" ;;
    '{{.EnableIPv6}}') cat "$S/net.ipv6" ;;
    '{{len .IPAM.Config}}') cat "$S/net.count" ;;
    '{{range .IPAM.Config}}{{.Subnet}}{{end}}') cat "$S/net.subnet" ;;
    '{{range .IPAM.Config}}{{.Gateway}}{{end}}') cat "$S/net.gateway" ;;
    '{{range .IPAM.Config}}{{.IPRange}}{{end}}') cat "$S/net.range" ;;
    *Containers*) cat "$S/members" 2>/dev/null ;;
    *) echo "fake docker: unknown network format $fmt" >&2; exit 3 ;;
  esac
  exit 0
fi
if [ "${args[0]}" = network ] && [ "${args[1]}" = create ]; then
  echo "${args[*]:2}" > "$S/created"
  touch "$S/net.exists"; echo bridge > "$S/net.driver"; echo true > "$S/net.internal"; echo false > "$S/net.ipv6"
  echo 1 > "$S/net.count"; echo 10.211.75.0/28 > "$S/net.subnet"; echo 10.211.75.1 > "$S/net.gateway"
  echo 10.211.75.8/29 > "$S/net.range"
  exit 0
fi
if [ "${args[0]}" = inspect ]; then
  c="${args[1]}"
  [ -f "$S/att.$c" ] || exit 1
  case "$fmt" in
    *NetworkSettings.Networks*) tr ' ' '\n' < "$S/att.$c"; echo ;;
    *traefik.docker.network*) cat "$S/label.$c" 2>/dev/null || echo '<no value>' ;;
    *) exit 3 ;;
  esac
  exit 0
fi
echo "fake docker: unsupported: ${args[*]}" >&2; exit 3
FAKE
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH" FAKE_STATE="$WORK/state"

# ── fixtures ──────────────────────────────────────────────────────────────────
reset() { rm -f "$WORK/state"/*; }
good_net() {
  touch "$WORK/state/net.exists"
  echo bridge > "$WORK/state/net.driver"; echo true > "$WORK/state/net.internal"; echo false > "$WORK/state/net.ipv6"
  echo 1 > "$WORK/state/net.count"; echo 10.211.75.0/28 > "$WORK/state/net.subnet"
  echo 10.211.75.1 > "$WORK/state/net.gateway"; echo 10.211.75.8/29 > "$WORK/state/net.range"
}
set_field() { echo "$2" > "$WORK/state/net.$1"; }
members() { printf '%s\n' "$@" > "$WORK/state/members"; }
attach() { local c="$1"; shift; echo "$*" > "$WORK/state/att.$c"; }
label() { echo "$2" > "$WORK/state/label.$1"; }

PASS=0; FAIL=0
expect() { # expect ok|stop "description" -- helper args...
  local want="$1" desc="$2"; shift 3
  local out rc
  out="$(bash "$HELPER" "$@" 2>&1)"; rc=$?
  if { [ "$want" = ok ] && [ $rc -eq 0 ]; } || { [ "$want" = stop ] && [ $rc -eq 1 ] && printf '%s\n' "$out" | grep -q '^STOP: '; }; then
    PASS=$((PASS + 1)); printf 'PASS  %-4s %s\n' "$want" "$desc"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-4s %s (rc=%s)\n      %s\n' "$want" "$desc" "$rc" "$out"
  fi
}

# ── network validation (check) ────────────────────────────────────────────────
reset;           expect stop "check: missing network" -- check
reset; good_net; expect ok   "check: exact IPAM, bridge, internal, IPv4-only" -- check
reset; good_net; set_field driver macvlan;          expect stop "check: wrong driver" -- check
reset; good_net; set_field internal false;          expect stop "check: not --internal" -- check
reset; good_net; set_field ipv6 true;               expect stop "check: IPv6 enabled" -- check
reset; good_net; set_field count 2;                 expect stop "check: two IPAM configs" -- check
reset; good_net; set_field subnet 10.211.0.0/16;    expect stop "check: wrong subnet" -- check
reset; good_net; set_field gateway 10.211.75.9;     expect stop "check: wrong gateway" -- check
reset; good_net; set_field range '<nil>';           expect stop "check: no allocation range" -- check
reset; good_net; set_field range 10.211.75.0/28;    expect stop "check: range = whole subnet" -- check

# ── ensure: creates with the exact flags, validates, never "fixes" ─────────────
reset; expect ok "ensure: creates when missing" -- ensure
if [ "$(cat "$WORK/state/created")" = "--driver bridge --internal --subnet 10.211.75.0/28 --gateway 10.211.75.1 --ip-range 10.211.75.8/29 noetia_api_edge" ]; then
  PASS=$((PASS + 1)); echo "PASS  ok   ensure: exact create flags"
else FAIL=$((FAIL + 1)); echo "FAIL  ok   ensure: exact create flags ($(cat "$WORK/state/created"))"; fi
reset; good_net; expect ok "ensure: existing correct network → validated, not recreated" -- ensure
[ ! -f "$WORK/state/created" ] && { PASS=$((PASS + 1)); echo "PASS  ok   ensure: no create call for an existing network"; } \
  || { FAIL=$((FAIL + 1)); echo "FAIL  ok   ensure: unexpected create call"; }
reset; good_net; set_field internal false; expect stop "ensure: existing wrong network → STOP, not modified" -- ensure

# ── membership ────────────────────────────────────────────────────────────────
reset; good_net; members traefik;                    expect ok   "members: pre-deploy, Traefik only" -- members traefik
reset; good_net; members noetia-api-1 traefik;       expect ok   "members: exactly traefik + API" -- members traefik noetia-api-1
reset; good_net; members noetia-api-1 rogue traefik; expect stop "members: unauthorized third member" -- members traefik noetia-api-1
reset; good_net; members traefik;                    expect stop "members: API missing post-deploy" -- members traefik noetia-api-1
reset; good_net;                                     expect stop "members: empty network" -- members traefik

# ── Traefik attachments ───────────────────────────────────────────────────────
reset; good_net; attach traefik proxy=172.18.0.3 proxy_staging=172.22.0.2 noetia_api_edge=10.211.75.8
expect ok   "traefik: proxy + proxy_staging + edge (.8 in range)" -- traefik
reset; good_net; attach traefik proxy=172.18.0.3 proxy_staging=172.22.0.2 noetia_api_edge=10.211.75.15
expect ok   "traefik: edge .15 (top of range)" -- traefik
reset; good_net; attach traefik proxy=172.18.0.3 proxy_staging=172.22.0.2
expect stop "traefik: not attached to the edge network" -- traefik
reset; good_net; attach traefik proxy=172.18.0.3 noetia_api_edge=10.211.75.8
expect stop "traefik: proxy_staging lost (stale recreation)" -- traefik
reset; good_net; attach traefik proxy_staging=172.22.0.2 noetia_api_edge=10.211.75.8
expect stop "traefik: proxy lost" -- traefik
reset; good_net; attach traefik proxy=172.18.0.3 proxy_staging=172.22.0.2 noetia_api_edge=10.211.75.3
expect stop "traefik: static edge address .3 outside range" -- traefik
reset; good_net; attach traefik proxy=172.18.0.3 proxy_staging=172.22.0.2 noetia_api_edge=10.211.75.16
expect stop "traefik: edge address .16 outside range" -- traefik
reset; good_net; expect stop "traefik: container not found" -- traefik

# ── API network + label contract (closes the R-05 fallback condition at release) ─
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 noetia_api_edge=10.211.75.9; label noetia-api-1 noetia_api_edge
expect ok   "api: internal + edge, label = edge" -- api
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 noetia_api_edge=10.211.75.9; label noetia-api-1 proxy
expect stop "api: stale label 'proxy' (R-05 fallback condition)" -- api
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 noetia_api_edge=10.211.75.9
expect stop "api: label missing (provider default 'proxy' → fallback)" -- api
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 proxy=172.18.0.4 noetia_api_edge=10.211.75.9; label noetia-api-1 noetia_api_edge
expect stop "api: still on shared 'proxy'" -- api
reset; good_net; attach noetia-api-1 noetia_api_edge=10.211.75.9; label noetia-api-1 noetia_api_edge
expect stop "api: internal network missing (web/worker/Prometheus cut off)" -- api
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 proxy=172.18.0.4; label noetia-api-1 proxy
expect stop "api: pre-B-2 topology (not on edge)" -- api
reset; good_net; attach noetia-api-1 noetia_noetia_net=172.19.0.5 noetia_api_edge=10.211.75.2; label noetia-api-1 noetia_api_edge
expect stop "api: edge address outside range" -- api

echo "────────────────────────────────────────"
echo "helper-contract: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
