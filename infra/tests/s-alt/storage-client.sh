#!/usr/bin/env bash
# S-ALT: the REAL api storage client (StorageService in the candidate api image, built by `build.sh api`)
# against a REAL MinIO that is reachable only through the unique alias, next to a foreign `storage` and a
# tailnet-style upstream resolver. Proves: alias used for upload/read; presigned/public URLs unchanged;
# MinIO down -> fails closed (no foreign storage, no sink). LOCAL ONLY; dummy credentials; cleans up.
set -uo pipefail
H="$(cd "$(dirname "$0")" && pwd)"
EMIT="$(mktemp "${TMPDIR:-/tmp}/s-alt-values.XXXXXX")"
S_ALT_EMIT="$EMIT" "$H/contract.sh" >/dev/null || { echo "contract.sh FAILED"; rm -f -- "$EMIT"; exit 4; }
# shellcheck disable=SC1090
source "$EMIT"; rm -f -- "$EMIT"
STO="$API_MINIO_ENDPOINT"; IMG="${API_IMAGE:-saltbuild-api}"
docker image inspect "$IMG" >/dev/null 2>&1 || { echo "missing image $IMG (run build.sh api)"; exit 2; }
PASS=0; FAIL=0; FAILED=""
check() { if [[ "$3" =~ ^($4)$ ]]; then PASS=$((PASS+1)); printf 'PASS %-4s %-66s %s\n' "$1" "$2" "$3"
          else FAIL=$((FAIL+1)); FAILED="$FAILED $1"; printf 'FAIL %-4s %-66s got=%s want=%s\n' "$1" "$2" "$3" "$4"; fi; }
cleanup() { docker rm -f salt-sto-minio salt-sto-foreign salt-sto-dns salt-sto-sink >/dev/null 2>&1; docker network rm salt-sto-noetia salt-sto-shared >/dev/null 2>&1; }
trap cleanup EXIT; cleanup
docker network create salt-sto-noetia >/dev/null
docker network create --subnet 10.251.80.0/24 salt-sto-shared >/dev/null
docker run -d --name salt-sto-minio --network salt-sto-noetia --network-alias "$STO" \
  -e MINIO_ROOT_USER=s-alt-dummy -e MINIO_ROOT_PASSWORD=s-alt-dummy-secret minio/minio:latest server /data >/dev/null
docker run -d --name salt-sto-foreign --network salt-sto-shared --network-alias storage -e WHO=foreign-storage -e PORT=9000 \
  -v "$H/responder.py:/r/responder.py:ro" python:3-alpine python -u /r/responder.py >/dev/null
docker run -d --name salt-sto-dns --network salt-sto-shared --ip 10.251.80.53 -e SINK_IP=10.251.80.80 \
  -v "$H/fakedns.py:/f.py:ro" python:3-alpine python -u /f.py >/dev/null
docker run -d --name salt-sto-sink --network salt-sto-shared --ip 10.251.80.80 -e WHO=tailnet-sink -e PORT=9000 \
  -v "$H/responder.py:/r/responder.py:ro" python:3-alpine python -u /r/responder.py >/dev/null
api() { # run the api image on noetia + shared networks, production-like env (compose value for MINIO_ENDPOINT)
  docker create --network salt-sto-noetia --dns 10.251.80.53 --dns-search tail-test.ts.net \
    -e MINIO_ENDPOINT="$STO" -e MINIO_PORT=9000 -e MINIO_ACCESS_KEY=s-alt-dummy -e MINIO_SECRET_KEY=s-alt-dummy-secret \
    -e MINIO_PUBLIC_URL=https://storage.noetia.test -e NODE_PATH=/app/node_modules \
    -v "$H/storage-client.js:/s-alt/storage-client.js:ro" --name salt-sto-api "$IMG" node /s-alt/storage-client.js "$@" >/dev/null
  docker network connect salt-sto-shared salt-sto-api   # also on the shared net: foreign `storage` + sink reachable
  docker start -a salt-sto-api 2>&1 | tail -1; docker rm salt-sto-api >/dev/null 2>&1; }
field() { python3 -I -c "import json,sys;d=json.loads(sys.stdin.read() or '{}');print(d.get(sys.argv[1]))" "$1"; }
log_count() { docker exec "$1" python -c "import urllib.request,json;print(len(json.load(urllib.request.urlopen('http://127.0.0.1:9000/__log'))))"; }

echo "== storage client: image=$IMG MINIO_ENDPOINT=$STO docker=$(docker version --format '{{.Server.Version}}')"
for i in $(seq 1 30); do api setup | grep -q '"ok":true' && break; sleep 1; done
RT="$(api roundtrip)"; echo "     roundtrip: $RT"
check M1 "StorageService upload+getText through $STO"                  "$(field text <<<"$RT")"            'S-ALT round trip'
check M2 "presigned URL host = MINIO_PUBLIC_URL host (unchanged)"        "$(field presignedHost <<<"$RT")"   'storage\.noetia\.test'
check M3 "presigned URL path = /books/<key> (path-style, unchanged)"     "$(field presignedPath <<<"$RT")"   '/books/s-alt/probe\.txt'
check M4 "publicUrl() = MINIO_PUBLIC_URL base (unchanged)"              "$(field publicUrl <<<"$RT")"       'https://storage\.noetia\.test/images/a\.png'
PC="$(api presign-compare "$STO")"
check M5 "presigned URL byte-identical for MINIO_ENDPOINT=storage vs $STO" "$(field identical <<<"$PC")"     'True'
docker stop salt-sto-minio >/dev/null
DN="$(api down)"; echo "     minio down: $DN"
check M6 "MinIO down: getText fails closed (name not found)"            "$(field error <<<"$DN")"           'ENOTFOUND|EAI_AGAIN'
check M7 "foreign 'storage' received nothing"                           "$(log_count salt-sto-foreign)"     '0'
check M8 "tailnet sink received nothing"                                "$(log_count salt-sto-sink)"        '0'
docker start salt-sto-minio >/dev/null; sleep 3
for i in $(seq 1 30); do RT2="$(api roundtrip)"; [[ "$(field text <<<"$RT2")" == 'S-ALT round trip' ]] && break; sleep 1; done
check M9 "MinIO back: round trip works again"                           "$(field text <<<"$RT2")"           'S-ALT round trip'
echo "-- upstream queries:"; docker exec salt-sto-dns sh -c 'sort /tmp/queries.log 2>/dev/null | uniq -c' | sed 's/^/     /'
echo "RESULT storage-client PASSED=$PASS FAILED=$FAIL FAILED_IDS=[${FAILED# }]"
[[ $FAIL == 0 ]]
