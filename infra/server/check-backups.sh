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

# Zero-cost monitoring (PO-020): emit Prometheus textfile metrics using the
# node-exporter that is ALREADY deployed. No new service, no new cost.
# Requires one additive flag on node-exporter — see EXTERNAL-ACTIONS.md.
METRICS_DIR="${METRICS_DIR:-/opt/backups/metrics}"
METRICS_FILE="$METRICS_DIR/noetia_backup.prom"

NAGIOS=0; [[ "${1:-}" == "--nagios" ]] && NAGIOS=1
crit=(); warn=()
m_age_h=-1; m_size=0; m_count=0; m_offsite_age_h=-1

if [[ ! -d "$BACKUP_DIR" ]]; then
  crit+=("backup directory $BACKUP_DIR does not exist — backups have never run")
else
  newest=$(find "$BACKUP_DIR" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  if [[ -z "$newest" ]]; then
    crit+=("no backup files found in $BACKUP_DIR")
  else
    age_h=$(( ( $(date +%s) - $(stat -c%Y "$newest") ) / 3600 ))
    size=$(stat -c%s "$newest")
    m_age_h=$age_h; m_size=$size
    m_count=$(find "$BACKUP_DIR" -name "*.dump" -type f | wc -l | tr -d ' ')
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

# ── Independent-copy staleness: the number that actually matters for DR-07/08 ──
ENC_DIR="${BACKUP_ENC_DIR:-$BACKUP_DIR/encrypted}"
if [[ -d "$ENC_DIR" ]]; then
  enc_newest=$(find "$ENC_DIR" -name '*.age' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  if [[ -n "$enc_newest" ]]; then
    m_offsite_age_h=$(( ( $(date +%s) - $(stat -c%Y "$enc_newest") ) / 3600 ))
  else
    warn+=("no encrypted copy staged for pull — independent RPO is UNBOUNDED")
  fi
else
  warn+=("encrypted spool absent — independent RPO is UNBOUNDED (DR-07/08 unmitigated)")
fi

# ── Emit metrics (best effort; never fail the check because of this) ─────────
if mkdir -p "$METRICS_DIR" 2>/dev/null; then
  {
    echo "# HELP noetia_backup_age_hours Age of the newest local PostgreSQL backup."
    echo "# TYPE noetia_backup_age_hours gauge"
    echo "noetia_backup_age_hours $m_age_h"
    echo "# HELP noetia_backup_size_bytes Size of the newest local backup."
    echo "# TYPE noetia_backup_size_bytes gauge"
    echo "noetia_backup_size_bytes $m_size"
    echo "# HELP noetia_backup_count Local recovery points on disk."
    echo "# TYPE noetia_backup_count gauge"
    echo "noetia_backup_count $m_count"
    echo "# HELP noetia_backup_offsite_age_hours Age of newest encrypted copy awaiting pull; -1 means none exists."
    echo "# TYPE noetia_backup_offsite_age_hours gauge"
    echo "noetia_backup_offsite_age_hours $m_offsite_age_h"
  } > "$METRICS_FILE.tmp" 2>/dev/null && mv "$METRICS_FILE.tmp" "$METRICS_FILE" 2>/dev/null || true
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
