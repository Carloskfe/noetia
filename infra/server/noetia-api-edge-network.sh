#!/usr/bin/env bash
# G1-I1: the dedicated internal Traefik ↔ Noetia API network ("noetia_api_edge").
#
#   noetia-api-edge-network.sh ensure                 create it if missing; if it exists, VALIDATE it (never modify)
#   noetia-api-edge-network.sh check                  validate only (pre-deploy preflight); never creates
#   noetia-api-edge-network.sh members NAME [NAME..]  validate, then require EXACTLY these attached containers
#   noetia-api-edge-network.sh traefik [NAME]         validate, then require Traefik (default `traefik`) attached to
#                                                     proxy, proxy_staging AND this network, its address inside RANGE
#   noetia-api-edge-network.sh api [NAME]             validate, then require the API (default `noetia-api-1`) attached
#                                                     to EXACTLY the internal network + this network, address inside
#                                                     RANGE, and label traefik.docker.network = this network
#
# `traefik` and `api` are read-only. The label check closes the Traefik Docker-provider fallback path (a label naming
# a network the container is not on makes Traefik pick an arbitrary network: G1-I1 R-05, NOT verified live), so it
# must pass after every deploy and every Traefik/API recreation, together with `members traefik noetia-api-1`.
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
TRAEFIK_NETS="${EDGE_TRAEFIK_NETWORKS:-proxy proxy_staging}"   # networks Traefik must keep, besides $NET
API_INTERNAL_NET="${EDGE_API_INTERNAL_NETWORK:-noetia_noetia_net}"

stop() { echo "STOP: $*" >&2; exit 1; }
field() { docker network inspect "$NET" --format "$1"; }

ip2int() { local IFS=.; set -- $1; echo $(( ($1 << 24) + ($2 << 16) + ($3 << 8) + $4 )); }
in_range() { # in_range ADDRESS CIDR → exit 0 if ADDRESS is inside CIDR (IPv4)
  local addr="$1" net="${2%/*}" bits="${2#*/}" mask
  [[ "$addr" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  mask=$(( bits == 0 ? 0 : (0xFFFFFFFF << (32 - bits)) & 0xFFFFFFFF ))
  [ $(( $(ip2int "$addr") & mask )) -eq $(( $(ip2int "$net") & mask )) ]
}
attachments() { # NAME → "network=address" lines
  docker inspect "$1" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}}{{"\n"}}{{end}}' 2>/dev/null \
    | sed '/^$/d' | sort || true
}
addr_on() { printf '%s\n' "$2" | sed -n "s/^$1=//p"; }

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
  traefik)
    name="${2:-traefik}"
    validate
    att="$(attachments "$name")"
    [ -n "$att" ] || stop "container '$name' not found or has no networks"
    for n in $TRAEFIK_NETS "$NET"; do
      printf '%s\n' "$att" | grep -q "^$n=" || stop "'$name' is not attached to '$n' (attached: $(echo $att))"
    done
    a="$(addr_on "$NET" "$att")"
    in_range "$a" "$RANGE" || stop "'$name' address on '$NET' is '$a', outside $RANGE"
    echo "OK: '$name' attached to $(echo $TRAEFIK_NETS) $NET; $NET address $a in $RANGE"
    ;;
  api)
    name="${2:-noetia-api-1}"
    validate
    att="$(attachments "$name")"
    [ -n "$att" ] || stop "container '$name' not found or has no networks"
    nets="$(printf '%s\n' "$att" | cut -d= -f1 | sort | tr '\n' ' ' | sed 's/ $//')"
    want="$(printf '%s\n' "$API_INTERNAL_NET" "$NET" | sort | tr '\n' ' ' | sed 's/ $//')"
    [ "$nets" = "$want" ] || stop "'$name' networks are [$nets], expected exactly [$want]"
    a="$(addr_on "$NET" "$att")"
    in_range "$a" "$RANGE" || stop "'$name' address on '$NET' is '$a', outside $RANGE"
    label="$(docker inspect "$name" --format '{{index .Config.Labels "traefik.docker.network"}}' 2>/dev/null || true)"
    [ "$label" = "$NET" ] || stop "'$name' label traefik.docker.network is '$label', expected '$NET'"
    echo "OK: '$name' networks [$want]; $NET address $a in $RANGE; label traefik.docker.network=$NET"
    ;;
  *)
    echo "usage: $0 ensure|check|members NAME [NAME..]|traefik [NAME]|api [NAME]" >&2
    exit 2
    ;;
esac
