#!/bin/bash
# Noetia off-site backup push — NEM-009 Level 1 (IG-DR-04, IG-DR-12).
#
# Encrypts a local backup and pushes it to an INDEPENDENT destination, so a
# recovery point survives loss of the production host, disk, or Contabo account.
#
#   backup-offsite.sh <file>       # encrypt + upload one file
#   backup-offsite.sh --selftest   # prove encrypt/decrypt round-trips, no upload
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
: "${BACKUP_REMOTE:?BACKUP_REMOTE missing (e.g. b2:noetia-backups/postgres)}"
command -v age >/dev/null || { log "age not installed"; exit 1; }
command -v rclone >/dev/null || { log "rclone not installed"; exit 1; }

ENC="${SRC}.age"
age -r "$BACKUP_AGE_RECIPIENT" -o "$ENC" "$SRC" || { log "encryption failed"; exit 1; }
log "encrypted $(basename "$ENC") ($(du -h "$ENC" | cut -f1))"

# --immutable where the remote supports it; append-only credentials are the
# stronger control and are described in EXTERNAL-ACTIONS.md.
if rclone copy "$ENC" "$BACKUP_REMOTE" --no-traverse 2>&1 | tail -3; then
  log "uploaded to $BACKUP_REMOTE"
  rm -f "$ENC"
  exit 0
else
  log "upload FAILED"
  rm -f "$ENC"
  exit 1
fi
