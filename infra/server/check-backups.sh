#!/bin/bash
# Noetia backup health check — NEM-009 Level 1 (IG-DR-07).
#
# A backup job that fails silently for six months is not a backup strategy.
# This detects: failed runs, STALE backups (the dangerous case — a job that
# stopped running produces no error at all), size anomalies, and off-site failure.
#
#   check-backups.sh            # human-readable
#   check-backups.sh --nagios   # exit 0 OK / 1 WARN / 2 CRIT, one-line output
#
# Run hourly from cron; wire the non-zero exit to whatever alerting exists.
set -uo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/postgres}"
STATUS_FILE="$BACKUP_DIR/last-status"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"      # daily cadence + 2h grace
MIN_SIZE_BYTES="${MIN_SIZE_BYTES:-1024}"
SHRINK_PCT="${SHRINK_PCT:-50}"            # alert if newest is <50% of previous

NAGIOS=0; [[ "${1:-}" == "--nagios" ]] && NAGIOS=1
crit=(); warn=()

if [[ ! -d "$BACKUP_DIR" ]]; then
  crit+=("backup directory $BACKUP_DIR does not exist — backups have never run")
else
  newest=$(find "$BACKUP_DIR" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  if [[ -z "$newest" ]]; then
    crit+=("no backup files found in $BACKUP_DIR")
  else
    age_h=$(( ( $(date +%s) - $(stat -c%Y "$newest") ) / 3600 ))
    size=$(stat -c%s "$newest")
    [[ $age_h -gt $MAX_AGE_HOURS ]] && crit+=("newest backup is ${age_h}h old (max ${MAX_AGE_HOURS}h)")
    [[ $size -lt $MIN_SIZE_BYTES ]] && crit+=("newest backup implausibly small (${size}B)")

    prev=$(find "$BACKUP_DIR" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | sed -n 2p | cut -d' ' -f2-)
    if [[ -n "$prev" ]]; then
      psize=$(stat -c%s "$prev")
      if [[ $psize -gt 0 ]] && [[ $(( size * 100 / psize )) -lt $SHRINK_PCT ]]; then
        warn+=("newest backup is $(( size * 100 / psize ))% of the previous size — possible truncation")
      fi
    fi
  fi
fi

if [[ -f "$STATUS_FILE" ]]; then
  read -r state _ rest < "$STATUS_FILE"
  [[ "$state" == "FAIL" ]] && crit+=("last run reported FAIL: $rest")
  [[ "$state" == "WARN" ]] && warn+=("last run reported WARN: $rest")
else
  warn+=("no status file — backup script may predate monitoring")
fi

if [[ ${#crit[@]} -gt 0 ]]; then
  if [[ $NAGIOS == 1 ]]; then echo "CRITICAL: ${crit[*]}"; else printf 'CRITICAL:\n'; printf '  - %s\n' "${crit[@]}"; fi
  exit 2
elif [[ ${#warn[@]} -gt 0 ]]; then
  if [[ $NAGIOS == 1 ]]; then echo "WARNING: ${warn[*]}"; else printf 'WARNING:\n'; printf '  - %s\n' "${warn[@]}"; fi
  exit 1
else
  echo "OK: backups current"
  exit 0
fi
