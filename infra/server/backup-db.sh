#!/bin/bash
# Daily PostgreSQL backup — runs inside the db container via docker compose
# Keeps 7 daily backups + 4 weekly (Sunday) backups
# Logs to /opt/backups/postgres/backup.log

set -euo pipefail

BACKUP_DIR="/opt/backups/postgres"
COMPOSE_FILE="/opt/noetia/docker-compose.server.yml"
ENV_FILE="/opt/noetia/.env.production"
DB_USER="noetia"
DB_NAME="noetia"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday ... 7=Sunday
FILENAME="noetia_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting backup → $FILENAME"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
log "Backup complete — $FILENAME ($SIZE)"

# ── Retention ────────────────────────────────────────────────────────────────
# Keep all backups from the last 7 days
# Keep Sunday backups for 28 days (4 weeks)
# Delete everything else older than 7 days

find "$BACKUP_DIR" -name "noetia_*.sql.gz" -mtime +7 | while read -r file; do
  FILE_DATE=$(basename "$file" | grep -oP '\d{8}')
  FILE_DOW=$(date -d "$FILE_DATE" +%u 2>/dev/null || echo "0")
  if [ "$FILE_DOW" = "7" ]; then
    # Sunday backup — keep for 28 days
    find "$file" -mtime +28 -delete && log "Deleted old weekly backup: $(basename "$file")"
  else
    log "Deleted old daily backup: $(basename "$file")"
    rm -f "$file"
  fi
done

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "noetia_*.sql.gz" | wc -l)
log "Retention complete — $BACKUP_COUNT backup(s) on disk"
