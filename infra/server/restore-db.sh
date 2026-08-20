#!/bin/bash
# Noetia PostgreSQL restore — NEM-009 Level 1 (IG-DR-06).
#
# Restores a custom-format dump into an ISOLATED environment and validates it.
# Refuses to touch production: this script exists to prove recoverability, and a
# restore tool that can overwrite the live database is a liability, not an asset.
#
#   restore-db.sh --file <dump> --project restore_test
#   restore-db.sh --file <dump> --project restore_test --validate-only
#
# Creates a throwaway compose project with its own volume, restores into it,
# runs the restore-test-plan.md checks, and reports MEASURED restore time.
# Tear down with:  docker compose -p <project> down -v
#
# SAFETY (NEM-009 §18/§28): aborts if the target project name resembles
# production, and never connects to the production database, MinIO, Redis, or
# Meilisearch. No email is sent; no Stripe event is processed.
set -uo pipefail

FILE=""; PROJECT="noetia_restore_test"; VALIDATE_ONLY=0
PGIMAGE="${PGIMAGE:-postgres:16-alpine}"
DB_USER="noetia"; DB_NAME="noetia_restore"; DB_PASS="restore-only-$RANDOM$RANDOM"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)          FILE="$2"; shift 2 ;;
    --project)       PROJECT="$2"; shift 2 ;;
    --validate-only) VALIDATE_ONLY=1; shift ;;
    --image)         PGIMAGE="$2"; shift 2 ;;
    -h|--help)       sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
info() { echo "   $*"; }
die()  { printf '\033[31mXX %s\033[0m\n' "$*" >&2; exit 1; }

# ── Refuse anything that could be production ─────────────────────────────────
case "$PROJECT" in
  noetia|noetia_prod*|noetia-prod*) die "refusing: project '$PROJECT' looks like production" ;;
esac
[[ "$PROJECT" == *restore* || "$PROJECT" == *test* ]] || \
  die "refusing: project name must contain 'restore' or 'test' so it cannot be mistaken for a live stack"

CONTAINER="${PROJECT}-restoredb-1"
VOLUME="${PROJECT}_restore_data"

if [[ $VALIDATE_ONLY == 0 ]]; then
  [[ -n "$FILE" && -f "$FILE" ]] || die "dump not found: ${FILE:-<none>}"

  log "Isolated restore target"
  info "project : $PROJECT"
  info "image   : $PGIMAGE"
  info "source  : $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"

  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true

  log "Starting isolated PostgreSQL (no host port, no production network)"
  docker run -d --name "$CONTAINER" \
    --label "com.docker.compose.project=$PROJECT" \
    -v "$VOLUME:/var/lib/postgresql/data" \
    -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB_NAME" \
    "$PGIMAGE" >/dev/null || die "could not start restore container"

  for i in $(seq 1 40); do
    docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
    sleep 2
    [[ $i == 40 ]] && die "restore database never became ready"
  done
  info "ready"

  log "Restoring — measuring elapsed time (PO-015)"
  # The archive MUST be a seekable file inside the container: `pg_restore -j`
  # rejects stdin outright ("parallel restore from standard input is not
  # supported"), and parallel restore is the entire reason for choosing custom
  # format. Piping the dump in would fail only during a real disaster.
  docker cp "$FILE" "$CONTAINER:/tmp/restore.dump" >/dev/null || die "could not stage dump into container"
  START=$(date +%s)
  # Errors are reported but do not abort, so validation reports what survived.
  docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" -j 4 --no-owner --no-privileges \
    /tmp/restore.dump 2>/tmp/restore-errors.log || true
  RESTORE_SECONDS=$(( $(date +%s) - START ))
  docker exec "$CONTAINER" rm -f /tmp/restore.dump >/dev/null 2>&1 || true
  # `grep -c` prints 0 AND exits 1 when there is no match; `|| echo 0` would
  # append a second line and break the arithmetic test below.
  ERRCOUNT=$(grep -c "^pg_restore: error" /tmp/restore-errors.log 2>/dev/null || true)
  ERRCOUNT=${ERRCOUNT:-0}
  info "restore completed in ${RESTORE_SECONDS}s (${ERRCOUNT} pg_restore error line(s))"
  [[ "$ERRCOUNT" -gt 0 ]] && info "see /tmp/restore-errors.log"
else
  docker inspect "$CONTAINER" >/dev/null 2>&1 || die "no restore container '$CONTAINER' to validate"
  RESTORE_SECONDS="n/a"
fi

q() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null | tr -d ' \n'; }

# ── Tier 0 — aggregate evidence only; no user data is printed (NEM-009 §19) ──
log "Tier 0 validation — structural integrity"
MIGRATION=$(q "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1;")
MIGCOUNT=$(q "SELECT COUNT(*) FROM migrations;")
USERS=$(q "SELECT COUNT(*) FROM users;")
OWNED=$(q "SELECT COUNT(*) FROM user_books;")
TOKENS=$(q "SELECT COUNT(*) FROM token_ledger;")
BOOKS=$(q "SELECT COUNT(*) FROM books;")
FRAGMENTS=$(q "SELECT COUNT(*) FROM fragments;")
SYNCMAPS=$(q "SELECT COUNT(*) FROM sync_maps;")

printf '   %-28s %s\n' "migration head" "${MIGRATION:-MISSING}"
printf '   %-28s %s\n' "migrations applied" "${MIGCOUNT:-0}"
printf '   %-28s %s\n' "users" "${USERS:-0}"
printf '   %-28s %s\n' "user_books (ownership)" "${OWNED:-0}"
printf '   %-28s %s\n' "token_ledger" "${TOKENS:-0}"
printf '   %-28s %s\n' "books" "${BOOKS:-0}"
printf '   %-28s %s\n' "fragments" "${FRAGMENTS:-0}"
printf '   %-28s %s\n' "sync_maps" "${SYNCMAPS:-0}"

log "Referential integrity — the checks that matter for ownership"
ORPHAN_OWNED=$(q "SELECT COUNT(*) FROM user_books ub LEFT JOIN users u ON u.id=ub.\"userId\" WHERE u.id IS NULL;")
ORPHAN_BOOKS=$(q "SELECT COUNT(*) FROM user_books ub LEFT JOIN books b ON b.id=ub.\"bookId\" WHERE b.id IS NULL;")
ORPHAN_TOKENS=$(q "SELECT COUNT(*) FROM token_ledger t LEFT JOIN users u ON u.id=t.\"userId\" WHERE u.id IS NULL;")
printf '   %-28s %s\n' "orphaned ownership (user)" "${ORPHAN_OWNED:-?}"
printf '   %-28s %s\n' "orphaned ownership (book)" "${ORPHAN_BOOKS:-?}"
printf '   %-28s %s\n' "orphaned tokens" "${ORPHAN_TOKENS:-?}"

FAILED=0
[[ -z "$MIGRATION" ]] && { echo "   FAIL: no migration head"; FAILED=1; }
[[ "${USERS:-0}" == "0" ]] && { echo "   FAIL: zero users restored"; FAILED=1; }
[[ "${ORPHAN_OWNED:-1}" != "0" ]] && { echo "   FAIL: ownership rows reference missing users"; FAILED=1; }
[[ "${ORPHAN_BOOKS:-1}" != "0" ]] && { echo "   FAIL: ownership rows reference missing books"; FAILED=1; }
[[ "${ORPHAN_TOKENS:-1}" != "0" ]] && { echo "   FAIL: token rows reference missing users"; FAILED=1; }

log "Result"
if [[ $FAILED == 0 ]]; then
  echo "   RESTORE VALIDATED — measured restore time: ${RESTORE_SECONDS}s"
  echo "   Ownership and token state are internally consistent."
  echo
  echo "   Tear down:  docker rm -f $CONTAINER && docker volume rm $VOLUME"
  exit 0
else
  echo "   RESTORE VALIDATION FAILED — see failures above"
  echo "   Tear down:  docker rm -f $CONTAINER && docker volume rm $VOLUME"
  exit 1
fi
