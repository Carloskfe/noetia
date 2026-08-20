#!/bin/bash
# Noetia off-site backup push — NEM-009 Level 1 (IG-DR-04, IG-DR-12).
#
# Encrypts a local backup and pushes it to an INDEPENDENT destination, so a
# recovery point survives loss of the production host, disk, or Contabo account.
#
#   backup-offsite.sh <file>       # encrypt into the local spool (+ push if configured)
#   backup-offsite.sh --selftest   # prove encrypt/decrypt round-trips, no upload
#
# ZERO-COST DEFAULT (PO-020): encrypt locally, let an external machine PULL the
# ciphertext over SSH. Production never gets credentials that could delete the
# external copies — which is exactly what makes them survive a host compromise.
#
# INERT UNTIL CONFIGURED. Without /opt/noetia/.env.backup it exits 0 with a
# notice, so it never breaks the local backup that calls it.
# Provisioning steps: docs/operating-framework/resilience/EXTERNAL-ACTIONS.md
#
# SECURITY
#   - age (or gpg) does the cryptography. No custom crypto.
#   - The RECIPIENT PUBLIC KEY lives on the server; the PRIVATE KEY MUST NOT.
#     A host compromise then yields no ability to read historical backups.
#   - The private key lives in the operator's off-server vault. A backup whose
#     key is unrecoverable is not a backup — see backup-security.md.
set -uo pipefail

CONF="${BACKUP_ENV_FILE:-/opt/noetia/.env.backup}"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] offsite: $*"; }

if [[ "${1:-}" == "--selftest" ]]; then
  command -v age >/dev/null || { echo "age not installed: apt-get install -y age"; exit 1; }
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  age-keygen -o "$tmp/key.txt" 2>/dev/null
  pub=$(grep "public key:" "$tmp/key.txt" | cut -d: -f2 | tr -d ' ')
  echo "noetia backup selftest payload" > "$tmp/plain"
  age -r "$pub" -o "$tmp/enc" "$tmp/plain"
  age -d -i "$tmp/key.txt" -o "$tmp/out" "$tmp/enc"
  if cmp -s "$tmp/plain" "$tmp/out"; then echo "SELFTEST OK — encrypt/decrypt round-trip verified"; exit 0
  else echo "SELFTEST FAILED — decrypted output differs"; exit 1; fi
fi

SRC="${1:-}"
[[ -n "$SRC" && -f "$SRC" ]] || { echo "usage: backup-offsite.sh <file>" >&2; exit 2; }

if [[ ! -f "$CONF" ]]; then
  log "not configured ($CONF absent) — skipping off-site copy"
  exit 0
fi
# shellcheck disable=SC1090
set -a; . "$CONF"; set +a

: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT missing}"
command -v age >/dev/null || { log "age not installed"; exit 1; }

# Encrypt in place, into the local encrypted spool. Under PO-020 (zero cost) the
# default model is PULL: the workstation fetches ciphertext over SSH, and
# production never holds credentials that could delete the external copies.
ENC_DIR="${BACKUP_ENC_DIR:-/opt/backups/postgres/encrypted}"
mkdir -p "$ENC_DIR"
ENC="$ENC_DIR/$(basename "$SRC").age"

age -r "$BACKUP_AGE_RECIPIENT" -o "$ENC" "$SRC" || { log "encryption failed"; exit 1; }
log "encrypted → $(basename "$ENC") ($(du -h "$ENC" | cut -f1))"

# Retain a bounded spool so the pull side can catch up after being offline.
ENC_KEEP="${BACKUP_ENC_KEEP:-14}"
mapfile -t old_enc < <(find "$ENC_DIR" -name '*.age' -type f -printf '%T@ %p\n' 2>/dev/null \
                         | sort -rn | tail -n +$((ENC_KEEP+1)) | cut -d' ' -f2-)
for f in "${old_enc[@]:-}"; do [[ -n "$f" ]] && rm -f "$f"; done

# Optional PUSH: only when a remote is configured. Not required under PO-020 and
# deliberately absent by default — a push model would require production to hold
# credentials capable of deleting the very copies meant to survive its compromise.
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  command -v rclone >/dev/null || { log "rclone not installed"; exit 1; }
  if rclone copy "$ENC" "$BACKUP_REMOTE" --no-traverse 2>&1 | tail -3; then
    log "uploaded to $BACKUP_REMOTE"
  else
    log "upload FAILED (encrypted copy retained locally for pull)"
    exit 1
  fi
else
  log "no BACKUP_REMOTE set — encrypted copy awaits PULL (PO-020 zero-cost model)"
fi
exit 0
