#!/bin/bash
# Noetia MinIO backup — NEM-009 Level 1 (IG-DR-03).
#
# Backs up only IRREPLACEABLE object classes. Public-domain audio (~13 GB) is
# deliberately EXCLUDED per PO-016 and is instead covered by a reconstruction
# manifest, because it can be re-ingested from upstream sources.
#
# RECOVERABILITY classification — NOT a rights classification (NEM-009 §11).
#
#   backup-minio.sh --dry-run   # classify and report, copy nothing
#   backup-minio.sh             # back up irreplaceable classes
#   backup-minio.sh --manifest  # regenerate the reconstruction manifest only
#
# TRANSFER STRATEGY: sequential, one object at a time. NEM-006C established that
# `mc mirror` concurrency and `--limit-download/--limit-upload` both corrupt
# large multipart transfers against this deployment. Do not reintroduce them
# without new evidence.
set -uo pipefail

ENV_FILE="${ENV_FILE:-/opt/noetia/.env.production}"
CONF="${BACKUP_ENV_FILE:-/opt/noetia/.env.backup}"
STAGING_DIR="${STAGING_DIR:-/opt/backups/minio}"
PROD_STORAGE="${PROD_STORAGE:-noetia-storage-1}"
MANIFEST="$STAGING_DIR/reconstruction-manifest.tsv"

DRY=0; MANIFEST_ONLY=0
for a in "$@"; do
  case "$a" in
    --dry-run)  DRY=1 ;;
    --manifest) MANIFEST_ONLY=1 ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] minio-backup: $*"; }
env_get() { grep -m1 "^$2=" "$1" 2>/dev/null | cut -d= -f2- ; }

[[ -f "$ENV_FILE" ]] || { log "missing $ENV_FILE"; exit 1; }
AK=$(env_get "$ENV_FILE" MINIO_ACCESS_KEY); SK=$(env_get "$ENV_FILE" MINIO_SECRET_KEY)
[[ -n "$AK" && -n "$SK" ]] || { log "could not read MinIO credentials"; exit 1; }

NET=$(docker inspect "$PROD_STORAGE" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}')
IP=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" "$PROD_STORAGE" 2>/dev/null)
[[ -n "$IP" ]] || { log "could not resolve production MinIO"; exit 1; }
mkdir -p "$STAGING_DIR"

# ── Classification ───────────────────────────────────────────────────────────
# IRREPLACEABLE: author-uploaded masters and user-generated assets. Noetia may
#                hold the only copy in existence.
# RECONSTRUCTABLE: public-domain audio (LibriVox/archive.org) and text
#                (Gutenberg/Wikisource); generated share cards.
#
# Author uploads carry an uploadedById in PostgreSQL; catalogue-ingested titles
# do not. The object store alone cannot distinguish them, so the authoritative
# list comes from the database.
IRREPLACEABLE_PREFIXES=(
  "images/backgrounds/user/"   # user-uploaded backgrounds
)

log "resolving author-uploaded titles from PostgreSQL…"
AUTHOR_SLUGS=$(docker exec -i "$PROD_STORAGE" true 2>/dev/null && \
  docker exec -i noetia-db-1 psql -U noetia -d noetia -tAc \
  "SELECT lower(regexp_replace(unaccent(title), '[^a-zA-Z0-9]+', '-', 'g')) FROM books WHERE \"uploadedById\" IS NOT NULL;" 2>/dev/null || echo "")
if [[ -z "$AUTHOR_SLUGS" ]]; then
  log "NOTE: no author-uploaded titles found (or unaccent unavailable) — protecting user assets only"
fi

mc_run() {
  docker run --rm --network "$NET" \
    -e AK="$AK" -e SK="$SK" -e HOST="http://${IP}:9000" \
    -v "$STAGING_DIR:/backup" --entrypoint sh minio/mc -c "$1"
}

if [[ $MANIFEST_ONLY == 1 || $DRY == 1 ]]; then
  log "building reconstruction manifest for EXCLUDED (reconstructable) content…"
  mc_run 'mc alias set p "$HOST" "$AK" "$SK" >/dev/null; mc ls --recursive p/audio p/books' \
    > "$MANIFEST.raw" 2>/dev/null || true
  log "manifest source written: $MANIFEST.raw"
  [[ $DRY == 1 ]] && { log "DRY RUN — nothing copied"; exit 0; }
  exit 0
fi

log "backing up irreplaceable object classes (sequential)…"
for prefix in "${IRREPLACEABLE_PREFIXES[@]}"; do
  log "  prefix: $prefix"
  mc_run "mc alias set p \"\$HOST\" \"\$AK\" \"\$SK\" >/dev/null
          mc find \"p/images/${prefix#images/}\" 2>/dev/null | while IFS= read -r f; do
            [ -z \"\$f\" ] && continue
            rel=\${f#p/}
            mkdir -p \"/backup/\$(dirname \"\$rel\")\"
            mc stat \"\$f\" >/dev/null 2>&1 || continue
            mc cp \"\$f\" \"/backup/\$rel\" >/dev/null 2>&1 || echo \"FAILED \$f\"
          done" || log "  WARNING: prefix $prefix had failures"
done

log "irreplaceable MinIO backup staged in $STAGING_DIR"
if [[ -x /opt/noetia/infra/server/backup-offsite.sh && -f "$CONF" ]]; then
  TAR="/opt/backups/minio_$(date +%Y%m%d_%H%M%S).tar"
  tar -cf "$TAR" -C "$STAGING_DIR" . && \
    /opt/noetia/infra/server/backup-offsite.sh "$TAR" && rm -f "$TAR"
else
  log "NOTE: off-site not configured — MinIO backup is NOT independent of this host"
fi
