#!/usr/bin/env bash
# NEM-006C — rebuild reader-validatable content in the Noetia STAGING environment.
#
# Takes staging from "books with text but no audio and no timings" to
# "Escucha Activa works", and can do it again after `down -v`. Three phases:
#
#   1. audio mirror   production MinIO ──READ-ONLY──> staging MinIO   (~13 GB)
#   2. transcripts    repository transcriptions/ ──> staging api container
#   3. staging run    dist/ingestion/stage-content.js wires audio keys and
#                     rebuilds sync maps from the committed VTT corpus
#
# Whisper is never re-run — the VTT corpus in the repository is the source.
#
# Run ON THE SERVER from /opt/noetia-staging:
#
#   scripts/seed-staging-content.sh --dry-run     # inventory only, no writes
#   scripts/seed-staging-content.sh               # full run
#   scripts/seed-staging-content.sh --skip-mirror # audio already mirrored
#   scripts/seed-staging-content.sh --only "Niebla"
#
# Options:
#   --dry-run           resolve and report only; no mirror, no DB writes
#   --skip-mirror       skip phase 1 (audio already present in staging MinIO)
#   --only "Title"      restrict to one title (repeatable)
#   --prod-env PATH     production env file, read-only (default /opt/noetia/.env.production)
#   --report DIR        where to copy the report (default ./reports/staging-content)
#
# SAFETY
#   Production is a READ SOURCE ONLY. This script never writes to production's
#   database, object store, Redis, or Meilisearch. The mirror is one-directional
#   and the api-side run refuses to start unless APP_ENV, DB_NAME, and
#   MINIO_PUBLIC_URL all independently say "staging".
set -uo pipefail

STAGING_DIR="${STAGING_DIR:-/opt/noetia-staging}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-$STAGING_DIR/.env.staging}"
PROD_ENV_FILE="/opt/noetia/.env.production"
PROJECT="noetia_staging"
COMPOSE_FILE="docker-compose.staging.yml"
PROD_STORAGE_CONTAINER="${PROD_STORAGE_CONTAINER:-noetia-storage-1}"
REPORT_DIR="./reports/staging-content"
AUDIO_BUCKET="audio"

DRY_RUN=0
SKIP_MIRROR=0
ONLY_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)     DRY_RUN=1; shift ;;
    --skip-mirror) SKIP_MIRROR=1; shift ;;
    --only)        ONLY_ARGS+=(--only "$2"); shift 2 ;;
    --prod-env)    PROD_ENV_FILE="$2"; shift 2 ;;
    --report)      REPORT_DIR="$2"; shift 2 ;;
    -h|--help)     sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

dcs() {
  docker compose -p "$PROJECT" --env-file "$STAGING_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
warn() { printf '\033[33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31mXX %s\033[0m\n' "$*" >&2; exit 1; }

# Read one KEY=value from an env file without sourcing it — .env.staging contains
# values with spaces and '<' that would be mangled or redirected by the shell.
env_get() { grep -m1 "^$2=" "$1" 2>/dev/null | cut -d= -f2- ; }

prod_health() {
  local web api
  web=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://noetia.app || echo 000)
  api=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://noetia.app/api/books || echo 000)
  echo "prod-web:$web prod-api:$api"
  [[ "$web" == "200" && "$api" == "200" ]]
}

# ── Preflight ───────────────────────────────────────────────────────────────
cd "$STAGING_DIR" || die "staging checkout not found: $STAGING_DIR"
[[ -f "$STAGING_ENV_FILE" ]] || die "missing $STAGING_ENV_FILE"
[[ -f "$COMPOSE_FILE" ]]     || die "must run from the staging checkout ($COMPOSE_FILE not found)"

STAGING_DB=$(env_get "$STAGING_ENV_FILE" DB_NAME)
STAGING_PUBLIC=$(env_get "$STAGING_ENV_FILE" MINIO_PUBLIC_URL)
[[ "$STAGING_DB"     == *staging* ]] || die "DB_NAME ($STAGING_DB) is not a staging database — refusing"
[[ "$STAGING_PUBLIC" == *staging* ]] || die "MINIO_PUBLIC_URL ($STAGING_PUBLIC) is not staging — refusing"

log "NEM-006C staging content$([[ $DRY_RUN == 1 ]] && echo ' (DRY RUN)')"
echo "  staging dir : $STAGING_DIR"
echo "  staging db  : $STAGING_DB"
echo "  storage     : $STAGING_PUBLIC"

log "Production health (before)"
prod_health || warn "production did not return 200/200 before we started — investigate first"

# ── Phase 1: audio mirror (production → staging, read-only on production) ───
if [[ $SKIP_MIRROR == 0 && $DRY_RUN == 0 ]]; then
  [[ -f "$PROD_ENV_FILE" ]] || die "production env file not readable: $PROD_ENV_FILE"

  PROD_AK=$(env_get "$PROD_ENV_FILE" MINIO_ACCESS_KEY)
  PROD_SK=$(env_get "$PROD_ENV_FILE" MINIO_SECRET_KEY)
  STAG_AK=$(env_get "$STAGING_ENV_FILE" MINIO_ACCESS_KEY)
  STAG_SK=$(env_get "$STAGING_ENV_FILE" MINIO_SECRET_KEY)
  [[ -n "$PROD_AK" && -n "$PROD_SK" && -n "$STAG_AK" && -n "$STAG_SK" ]] \
    || die "could not read MinIO credentials (never echoed; check both env files)"

  PROD_NET=$(docker inspect "$PROD_STORAGE_CONTAINER" \
    --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}')
  [[ -n "$PROD_NET" ]] || die "could not find production storage container: $PROD_STORAGE_CONTAINER"
  STAG_NET="${PROJECT}_noetia_staging_net"

  STAG_STORAGE_CONTAINER="${PROJECT}-storage-1"
  docker inspect "$STAG_STORAGE_CONTAINER" >/dev/null 2>&1 \
    || die "staging storage container not found: $STAG_STORAGE_CONTAINER"

  log "Phase 1 — mirroring $AUDIO_BUCKET/ production → staging (read-only on production)"
  echo "  ~13 GB over the host's local network. Production is never written to."

  # The two MinIO servers live on different Docker networks, so the mc container
  # is attached to BOTH. Each server is addressed by its CONTAINER name, not the
  # compose service alias — "storage" resolves on both networks and would be
  # ambiguous, which is exactly the kind of ambiguity that writes to the wrong
  # place. `mc mirror` is resumable and skips objects already present with a
  # matching etag, so a re-run after an interruption costs only the remainder.
  # --limit-download throttles the read so it cannot starve production's MinIO,
  # the production container running closest to its memory limit.
  MIRROR_CID=$(docker create \
    --network "$PROD_NET" \
    -e PROD_AK="$PROD_AK" -e PROD_SK="$PROD_SK" \
    -e STAG_AK="$STAG_AK" -e STAG_SK="$STAG_SK" \
    -e PROD_HOST="http://${PROD_STORAGE_CONTAINER}:9000" \
    -e STAG_HOST="http://${STAG_STORAGE_CONTAINER}:9000" \
    --entrypoint sh minio/mc -c '
      set -e
      mc alias set prod "$PROD_HOST" "$PROD_AK" "$PROD_SK" >/dev/null
      mc alias set stag "$STAG_HOST" "$STAG_AK" "$STAG_SK" >/dev/null
      mc mb --ignore-existing stag/audio
      mc mirror --preserve --limit-download 200MiB prod/audio stag/audio
    ')
  [[ -n "$MIRROR_CID" ]] || die "could not create the mirror container"
  docker network connect "$STAG_NET" "$MIRROR_CID" || die "could not attach staging network"
  docker start "$MIRROR_CID" >/dev/null || die "could not start the mirror"
  echo "  mirror container: ${MIRROR_CID:0:12} (follow with: docker logs -f ${MIRROR_CID:0:12})"

  # §40 — watch production for the whole transfer; its reliability outranks
  # staging completion, so a degraded check stops the copy immediately.
  while [[ "$(docker inspect -f '{{.State.Running}}' "$MIRROR_CID" 2>/dev/null)" == "true" ]]; do
    sleep 30
    if ! prod_health; then
      warn "production health degraded during transfer — stopping the mirror"
      docker stop "$MIRROR_CID" >/dev/null 2>&1
      docker rm "$MIRROR_CID" >/dev/null 2>&1
      die "aborted: production reliability takes priority over staging completion"
    fi
  done

  MIRROR_RC=$(docker inspect -f '{{.State.ExitCode}}' "$MIRROR_CID" 2>/dev/null || echo 1)
  docker logs --tail 5 "$MIRROR_CID" 2>&1 | sed 's/^/  /'
  docker rm "$MIRROR_CID" >/dev/null 2>&1
  [[ "$MIRROR_RC" == "0" ]] || die "audio mirror failed (exit $MIRROR_RC) — re-run to resume"
  log "Phase 1 complete"
else
  log "Phase 1 — skipped$([[ $DRY_RUN == 1 ]] && echo ' (dry run)')"
fi

# ── Phase 2: transcripts into the staging api container ─────────────────────
log "Phase 2 — copying transcription corpus into the staging api container"
API_CID=$(dcs ps -q api)
[[ -n "$API_CID" ]] || die "staging api container is not running — 'dcs up -d' first"
docker exec "$API_CID" mkdir -p /app/transcriptions
docker cp transcriptions/. "$API_CID:/app/transcriptions/" \
  || die "failed to copy transcriptions into the container"
VTT_COUNT=$(docker exec "$API_CID" sh -c 'find /app/transcriptions -name "*.vtt" | wc -l')
echo "  $VTT_COUNT VTT files present in the container"

# ── Phase 3: wire audio + rebuild sync maps ─────────────────────────────────
log "Phase 3 — staging content run"
DRY_FLAG=()
[[ $DRY_RUN == 1 ]] && DRY_FLAG=(--dry-run)
dcs exec -T api node dist/ingestion/stage-content.js "${DRY_FLAG[@]}" "${ONLY_ARGS[@]}"
RUN_STATUS=$?

# ── Report + search index ───────────────────────────────────────────────────
mkdir -p "$REPORT_DIR"
docker cp "$API_CID:/app/staging-content-report.json" "$REPORT_DIR/" 2>/dev/null || true
docker cp "$API_CID:/app/staging-content-report.md"   "$REPORT_DIR/" 2>/dev/null || true
echo "  report → $REPORT_DIR/"

if [[ $DRY_RUN == 0 ]]; then
  log "Reindexing staging search"
  dcs exec -T api node dist/ingestion/seed-search.js \
    || warn "staging search reindex failed — search results may be stale"
fi

log "Production health (after)"
prod_health || warn "production is not 200/200 — investigate"

log "Done — production writes: NONE"
exit $RUN_STATUS
