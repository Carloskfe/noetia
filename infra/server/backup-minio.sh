#!/bin/bash
# Weekly MinIO backup — tars the minio_data Docker volume directly
# Keeps 4 weekly backups (28 days)
# Logs to /opt/backups/minio/backup.log
# Recommended schedule: every Sunday at 3 AM

set -euo pipefail

BACKUP_DIR="/opt/backups/minio"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="minio_${TIMESTAMP}.tar.gz"
VOLUME="noetia_minio_data"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting MinIO backup → $FILENAME"

docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar czf "/backup/$FILENAME" -C /data .

SIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
log "Backup complete — $FILENAME ($SIZE)"

# ── Retention — keep last 4 weekly backups (28 days) ─────────────────────────
find "$BACKUP_DIR" -name "minio_*.tar.gz" -mtime +28 | while read -r file; do
  log "Deleted old backup: $(basename "$file")"
  rm -f "$file"
done

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "minio_*.tar.gz" | wc -l)
log "Retention complete — $BACKUP_COUNT backup(s) on disk"
