#!/bin/bash
# Noetia zero-cost independent backup — PULL side (PO-020, NEM-009 §6 Option A).
#
# RUNS ON THE PRODUCT OWNER'S MACHINE, NOT ON THE SERVER.
#
# Fetches encrypted PostgreSQL recovery points from production over SSH (port 222,
# PO-019) onto Product-Owner-controlled storage. This is the only $0 mechanism that
# produces a copy surviving loss of the VPS *and* the Contabo account (DR-07/DR-08).
#
#   backup-pull.sh                       # fetch anything new
#   backup-pull.sh --status              # report independent RPO, fetch nothing
#   backup-pull.sh --dest ~/noetia-backups
#
# WHY PULL, NOT PUSH
#   A push model needs production to hold credentials that can write — and usually
#   delete — the external copies. An attacker with the host then destroys production
#   and its backups together (DR-13). Pulling inverts that: production holds no
#   credential for this machine and cannot reach these files at all.
#
# ENCRYPTION
#   Files arrive already age-encrypted (backup-offsite.sh). This script never
#   decrypts. The age private key lives here, never on the server, so production
#   cannot read its own historical backups.
#
# NEVER transfer .env.production with this script — secrets recovery is a separate,
# deliberate procedure (secret-recovery.md).
set -uo pipefail

SSH_HOST="${NOETIA_SSH_HOST:-}"
SSH_PORT="${NOETIA_SSH_PORT:-222}"      # PO-019 — canonical, do not change to 22
SSH_USER="${NOETIA_SSH_USER:-root}"
REMOTE_DIR="${NOETIA_REMOTE_ENC_DIR:-/opt/backups/postgres/encrypted}"
DEST="${NOETIA_BACKUP_DEST:-$HOME/noetia-backups/postgres}"
KEEP="${NOETIA_BACKUP_KEEP:-30}"
STALE_HOURS="${NOETIA_STALE_HOURS:-48}"

STATUS_ONLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --status) STATUS_ONLY=1; shift ;;
    --dest)   DEST="$2"; shift 2 ;;
    --host)   SSH_HOST="$2"; shift 2 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
info() { echo "   $*"; }
die()  { printf '\033[31mXX %s\033[0m\n' "$*" >&2; exit 1; }

mkdir -p "$DEST"

# ── Independent RPO: how exposed are we if the VPS disappears right now? ──────
report_status() {
  local newest age_h
  newest=$(find "$DEST" -name '*.age' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
  log "Independent (off-site) protection status"
  info "location : $DEST"
  if [[ -z "$newest" ]]; then
    info "recovery points : 0"
    printf '\033[31m   INDEPENDENT RPO: UNBOUNDED — no off-site copy exists.\033[0m\n'
    printf '\033[31m   Loss of the VPS or Contabo account would be unrecoverable.\033[0m\n'
    return 1
  fi
  age_h=$(( ( $(date +%s) - $(stat -c%Y "$newest" 2>/dev/null || stat -f%m "$newest") ) / 3600 ))
  info "recovery points : $(find "$DEST" -name '*.age' -type f | wc -l | tr -d ' ')"
  info "newest          : $(basename "$newest")"
  if [[ $age_h -gt $STALE_HOURS ]]; then
    printf '\033[33m   INDEPENDENT RPO: %sh — STALE (threshold %sh). Run this script.\033[0m\n' "$age_h" "$STALE_HOURS"
    return 1
  fi
  printf '   \033[32mINDEPENDENT RPO: %sh\033[0m\n' "$age_h"
  return 0
}

if [[ $STATUS_ONLY == 1 ]]; then report_status; exit $?; fi

[[ -n "$SSH_HOST" ]] || die "set NOETIA_SSH_HOST (or pass --host). Never hard-code it here."
command -v rsync >/dev/null || die "rsync not installed"

log "Pulling encrypted recovery points"
info "from : ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR} (port ${SSH_PORT})"
info "to   : $DEST"

# Read-only on the far side: rsync only reads. --ignore-existing means an already
# fetched point is never re-downloaded or overwritten, so a compromised production
# host cannot replace good local copies with bad ones.
if ! rsync -av --ignore-existing --timeout=120 \
      -e "ssh -p ${SSH_PORT} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
      "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/*.age" "$DEST/" 2>&1 | tail -8; then
  die "pull failed — production unreachable, or no encrypted backups exist yet (is backup-offsite.sh configured?)"
fi

# ── Integrity: age files begin with a known header ───────────────────────────
log "Verifying transferred files"
bad=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if ! head -c 22 "$f" | grep -q "age-encryption.org"; then
    echo "   CORRUPT/NOT-AGE: $(basename "$f")"; bad=$((bad+1))
  fi
done < <(find "$DEST" -name '*.age' -type f -mmin -60 2>/dev/null)
[[ $bad -eq 0 ]] && info "all recently fetched files carry a valid age header" || die "$bad file(s) failed verification"

# ── Retention on the independent side ────────────────────────────────────────
mapfile -t stale < <(find "$DEST" -name '*.age' -type f -printf '%T@ %p\n' 2>/dev/null \
                       | sort -rn | tail -n +$((KEEP+1)) | cut -d' ' -f2-)
for f in "${stale[@]:-}"; do [[ -n "$f" ]] && rm -f "$f" && echo "   pruned $(basename "$f")"; done

report_status
echo
info "Restore from an independent copy (decrypt here, never on the server):"
info "  age -d -i <your-key.txt> -o restored.dump <file>.age"
info "  infra/server/restore-db.sh --file restored.dump --project noetia_restore_test"
