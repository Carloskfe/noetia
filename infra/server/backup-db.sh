#!/bin/bash
# Noetia PostgreSQL backup — NEM-009 Level 1.
#
# Canonical backup path:  /opt/backups/postgres   (see C-DR-01 — the older
# /opt/noetia/backups/ reference in incident-response.md was never correct).
#
# Produces a PostgreSQL CUSTOM-FORMAT dump (-Fc): compressed, selectively
# restorable, and restorable in parallel with `pg_restore -j`, which is what makes
# the 4-hour RTO (PO-015) achievable. Plain SQL dumps restore single-threaded.
#
#   backup-db.sh                 # take a backup, verify, prune
#   backup-db.sh --tier0         # hourly Tier-0 run (PO-014, RPO <= 1h)
#   backup-db.sh --measure-only  # time a dump without keeping it (see §7 gate)
#
# Exit non-zero on any failure so cron/monitoring can detect it. Never deletes a
# backup it has not replaced with a verified newer one.
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/postgres}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/noetia/docker-compose.server.yml}"
ENV_FILE="${ENV_FILE:-/opt/noetia/.env.production}"
DB_USER="${DB_USER:-noetia}"
DB_NAME="${DB_NAME:-noetia}"
LOG_FILE="$BACKUP_DIR/backup.log"
STATUS_FILE="$BACKUP_DIR/last-status"   # read by check-backups.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

TIER0=0; MEASURE_ONLY=0
for a in "$@"; do
  case "$a" in
    --tier0)        TIER0=1 ;;
    --measure-only) MEASURE_ONLY=1 ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

PREFIX="noetia"; [[ $TIER0 == 1 ]] && PREFIX="noetia_hourly"
FILENAME="${PREFIX}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() { log "FAILED: $*"; echo "FAIL $(date +%s) $*" > "$STATUS_FILE"; exit 1; }

command -v docker >/dev/null || fail "docker not found"
[[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"

log "Starting backup → $FILENAME"
START=$(date +%s)

# Write to .partial first: a crashed dump must never look like a valid backup.
TARGET="$BACKUP_DIR/$FILENAME"
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
      pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$TARGET.partial" 2>>"$LOG_FILE"; then
  rm -f "$TARGET.partial"
  fail "pg_dump returned non-zero"
fi

# ── Verify before trusting it (IG-DR-01) ─────────────────────────────────────
SIZE_BYTES=$(stat -c%s "$TARGET.partial" 2>/dev/null || echo 0)
[[ "$SIZE_BYTES" -gt 1024 ]] || { rm -f "$TARGET.partial"; fail "dump implausibly small (${SIZE_BYTES}B)"; }

# pg_restore --list parses the archive TOC: proves the file is a readable custom
# dump, not merely non-empty. `pg_dump | gzip` could never be checked this way.
# `grep -c` prints 0 and exits 1 on no match — `|| echo 0` would emit two lines.
TABLE_COUNT=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
                pg_restore --list /dev/stdin < "$TARGET.partial" 2>/dev/null | grep -c "TABLE DATA" || true)
TABLE_COUNT=${TABLE_COUNT:-0}
[[ "$TABLE_COUNT" -ge 10 ]] || { rm -f "$TARGET.partial"; fail "archive unreadable or only $TABLE_COUNT tables"; }

mv "$TARGET.partial" "$TARGET"
DURATION=$(( $(date +%s) - START ))
SIZE_H=$(du -h "$TARGET" | cut -f1)
log "Backup verified — $FILENAME ($SIZE_H, ${TABLE_COUNT} tables, ${DURATION}s)"

if [[ $MEASURE_ONLY == 1 ]]; then
  rm -f "$TARGET"
  log "--measure-only: dump discarded. Duration ${DURATION}s, size ${SIZE_H}."
  exit 0
fi

# ── Off-site push (IG-DR-04) ─────────────────────────────────────────────────
# Independence is what makes this a backup rather than a second copy on the same
# disk. Enabled only once the operator provisions a destination — see
# docs/operating-framework/resilience/EXTERNAL-ACTIONS.md.
if [[ -x /opt/noetia/infra/server/backup-offsite.sh ]]; then
  if /opt/noetia/infra/server/backup-offsite.sh "$TARGET" >>"$LOG_FILE" 2>&1; then
    log "Off-site copy OK"
  else
    # Local backup succeeded; off-site did not. Surface it, do not discard the dump.
    log "WARNING: off-site copy FAILED — this backup exists only on the production host"
    echo "WARN $(date +%s) offsite-failed" > "$STATUS_FILE"
  fi
else
  log "NOTE: off-site push not configured — backup is NOT independent of this host"
fi

# ── Retention (PO-014 operational; financial/legal retention is separate) ────
# Hourly: 48h. Daily: 30d. Weekly (Sunday): 12 weeks. Deletion only ever removes
# files older than the window, never the newest recovery point.
prune() {
  local pattern="$1" days="$2" label="$3" n=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    rm -f "$f" && n=$((n+1))
  done < <(find "$BACKUP_DIR" -name "$pattern" -type f -mtime "+$days" 2>/dev/null)
  [[ $n -gt 0 ]] && log "Pruned $n $label backup(s) older than ${days}d"
  return 0
}

prune "noetia_hourly_*.dump" 2 "hourly"

# Daily/weekly: keep Sunday dumps 84 days, all others 30.
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  base=$(basename "$f")
  fdate=$(echo "$base" | sed -n 's/^noetia_\([0-9]\{8\}\)_.*/\1/p')
  [[ -z "$fdate" ]] && continue
  dow=$(date -d "$fdate" +%u 2>/dev/null || echo 0)
  if [[ "$dow" == "7" ]]; then
    if [[ -n $(find "$f" -mtime +84 2>/dev/null) ]]; then
      rm -f "$f" && log "Pruned weekly backup: $base"
    fi
  else
    rm -f "$f" && log "Pruned daily backup: $base"
  fi
done < <(find "$BACKUP_DIR" -name "noetia_[0-9]*.dump" -type f -mtime +30 2>/dev/null)

COUNT=$(find "$BACKUP_DIR" -name "*.dump" -type f | wc -l)
log "Retention complete — $COUNT recovery point(s) on disk"
echo "OK $(date +%s) ${DURATION}s ${SIZE_BYTES}B" > "$STATUS_FILE"
