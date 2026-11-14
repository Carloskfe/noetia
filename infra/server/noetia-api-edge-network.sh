#!/usr/bin/env bash
# G1-I1: the dedicated internal Traefik ↔ Noetia API network ("noetia_api_edge").
#
#   noetia-api-edge-network.sh ensure                 create it if missing; if it exists, VALIDATE it (never modify)
#   noetia-api-edge-network.sh check                  validate only (pre-deploy preflight); never creates
#   noetia-api-edge-network.sh members NAME [NAME..]  validate, then require EXACTLY these attached containers
#
# Exit 0 = OK. Exit 1 = STOP (message on stderr): a wrong network is never silently accepted or "fixed".
# The API trusts X-Forwarded-For only from EDGE_IP_RANGE (TRUSTED_PROXY_CIDRS), so the IPAM below and the
# membership (traefik + the API, nothing else) are security invariants — see
# docs/reports/payment-lifecycle-20261112/g1-trusted-proxy-correction-design.md §5.
#
# The values are a QUALIFIED CANDIDATE (Checkpoint III), not a reservation: re-verify the subnet is free on the
# host (docker network inspect of every network; ip route show table all) immediately before creating it.
# Overrides exist only so the local harness can test this script on disposable names.
set -euo pipefail

NET="${EDGE_NETWORK:-noetia_api_edge}"
SUBNET="${EDGE_SUBNET:-10.211.75.0/28}"
GATEWAY="${EDGE_GATEWAY:-10.211.75.1}"
RANGE="${EDGE_IP_RANGE:-10.211.75.8/29}"

stop() { echo "STOP: $*" >&2; exit 1; }
field() { docker network inspect "$NET" --format "$1"; }

validate() {
  docker network inspect "$NET" >/dev/null 2>&1 || stop "network '$NET' does not exist"
  local driver internal ipv6 count subnet gateway range
  driver="$(field '{{.Driver}}')"
  internal="$(field '{{.Internal}}')"
  ipv6="$(field '{{.EnableIPv6}}')"
  count="$(field '{{len .IPAM.Config}}')"
  subnet="$(field '{{range .IPAM.Config}}{{.Subnet}}{{end}}')"
  gateway="$(field '{{range .IPAM.Config}}{{.Gateway}}{{end}}')"
  range="$(field '{{range .IPAM.Config}}{{.IPRange}}{{end}}')"
  [ "$driver" = "bridge" ] || stop "'$NET' driver is '$driver', expected 'bridge'"
  [ "$internal" = "true" ] || stop "'$NET' is not --internal"
  [ "$ipv6" = "false" ] || stop "'$NET' has IPv6 enabled; it must be IPv4-only"
  [ "$count" = "1" ] || stop "'$NET' has $count IPAM configs, expected exactly 1"
  [ "$subnet" = "$SUBNET" ] || stop "'$NET' subnet is '$subnet', expected '$SUBNET'"
  [ "$gateway" = "$GATEWAY" ] || stop "'$NET' gateway is '$gateway', expected '$GATEWAY'"
  [ "$range" = "$RANGE" ] || stop "'$NET' allocation range is '$range', expected '$RANGE'"
  echo "OK: '$NET' bridge, internal, IPv4-only, subnet $SUBNET, gateway $GATEWAY, allocation range $RANGE"
}

case "${1:-}" in
  ensure)
    if docker network inspect "$NET" >/dev/null 2>&1; then
      validate
    else
      docker network create --driver bridge --internal --subnet "$SUBNET" --gateway "$GATEWAY" --ip-range "$RANGE" "$NET" >/dev/null
      echo "created '$NET'"
      validate
    fi
    ;;
  check)
    validate
    ;;
  members)
    shift
    [ "$#" -ge 1 ] || stop "usage: $0 members NAME [NAME..]"
    validate
    expected="$(printf '%s\n' "$@" | sort)"
    actual="$(docker network inspect "$NET" --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | sed '/^$/d' | sort)"
    [ "$actual" = "$expected" ] || stop "'$NET' members are [$(echo $actual)], expected exactly [$(echo $expected)]"
    echo "OK: '$NET' members are exactly [$(echo $expected)]"
    ;;
  *)
    echo "usage: $0 ensure|check|members NAME [NAME..]" >&2
    exit 2
    ;;
esac
