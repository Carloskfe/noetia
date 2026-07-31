#!/usr/bin/env bash
# Gated re-seed of phrase-level sync maps after the aligner onset fix (5700bbe:
# time from the first/last matched word, not the early window edge).
#
# For each book it runs `diagnose-sync --realign` as a PRE-WRITE GATE. Because
# --realign splits the stored text and aligns it to the committed VTT with the
# SAME code path seed-sync-whisper uses, the diagnosis is a faithful dry-run of
# exactly the map the re-seed would write. Only books that pass the gate get
# re-seeded. Free-library books (Reader #1) are processed first.
#
# Run ON THE SERVER from /opt/noetia AFTER `git pull` (CD must have rebuilt the
# api image so dist/ contains diagnose-sync.js):
#
#   scripts/reseed-sync.sh                # DRY RUN — diagnose + gate only, no writes
#   scripts/reseed-sync.sh --apply        # actually re-seed the books that pass
#
# Options:
#   --apply             perform the writes (default: dry run)
#   --manifest FILE     title<TAB>slug manifest (default: scripts/drift-realign.tsv)
#   --min-coverage N    hard-skip books below N% edition coverage (default: 60)
#   --max-offset N      gate: |median offset| must be <= N phrase(s) (default: 1)
#   --no-free-first     keep manifest order (default: free-library books first)
#   --only "Title"      restrict to a single book (repeatable)
#
# Dev testing (uses ts-node against the mounted src instead of prod dist):
#   COMPOSE="docker compose" \
#   DIAGNOSE_CMD="npx ts-node -r tsconfig-paths/register src/ingestion/diagnose-sync.ts" \
#   SEED_CMD="npx ts-node -r tsconfig-paths/register src/ingestion/seed-sync-whisper.ts" \
#   scripts/reseed-sync.sh --manifest /tmp/two-books.tsv
set -uo pipefail

APPLY=0
MANIFEST="scripts/drift-realign.tsv"
MIN_COV=60
MAX_OFF=1
FREE_FIRST=1
ONLY=()

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)         APPLY=1 ;;
    --manifest)      MANIFEST="$2"; shift ;;
    --min-coverage)  MIN_COV="$2"; shift ;;
    --max-offset)    MAX_OFF="$2"; shift ;;
    --no-free-first) FREE_FIRST=0 ;;
    --only)          ONLY+=("$2"); shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

COMPOSE="${COMPOSE:-docker compose --env-file .env.production -f docker-compose.server.yml}"
CONTAINER="${API_CONTAINER:-noetia-api-1}"
DIAGNOSE="${DIAGNOSE_CMD:-node dist/ingestion/diagnose-sync.js}"
SEED="${SEED_CMD:-node dist/ingestion/seed-sync-whisper.js}"
CE="$COMPOSE exec -T -e DB_HOST=db api"
PSQL="$COMPOSE exec -T db psql -U ${DB_USER:-noetia} -d ${DB_NAME:-noetia} -tA"

[ -f "$MANIFEST" ] || { echo "Manifest not found: $MANIFEST" >&2; exit 1; }
docker exec "$CONTAINER" mkdir -p /app/transcriptions >/dev/null

echo "Mode: $([ "$APPLY" = 1 ] && echo APPLY || echo 'DRY RUN (no writes)')  ·  gate: coverage ≥ ${MIN_COV}% and |offset| ≤ ${MAX_OFF} phrase(s)"

# ── Free-library titles (for ordering + tagging) ────────────────────────────
declare -A IS_FREE
while IFS= read -r t; do
  [ -n "$t" ] && IS_FREE["$t"]=1
done < <($PSQL -c "SELECT title FROM books WHERE \"isFree\"=true;" </dev/null 2>/dev/null)

# ── Build the processing order: free first, then the rest ───────────────────
free_lines=(); rest_lines=()
while IFS= read -r line || [ -n "$line" ]; do
  title="${line%%$'\t'*}"
  [ -z "$title" ] && continue
  if [ ${#ONLY[@]} -gt 0 ]; then
    keep=0; for o in "${ONLY[@]}"; do [ "$o" = "$title" ] && keep=1; done
    [ "$keep" = 1 ] || continue
  fi
  if [ "$FREE_FIRST" = 1 ] && [ "${IS_FREE[$title]:-0}" = 1 ]; then
    free_lines+=("$line")
  else
    rest_lines+=("$line")
  fi
done < "$MANIFEST"
ORDERED=("${free_lines[@]}" "${rest_lines[@]}")

seeded=(); skipped=(); failed=()

for line in "${ORDERED[@]}"; do
  IFS=$'\t' read -r title slug <<< "$line"
  [ -z "$slug" ] && continue
  tag=$([ "${IS_FREE[$title]:-0}" = 1 ] && echo "[free]" || echo "      ")
  echo "── $tag $title ($slug)"

  vtt="transcriptions/$slug.merged.vtt"
  if [ ! -f "$vtt" ]; then
    echo "    VTT missing ($vtt) — skip"; skipped+=("$title: no VTT"); continue
  fi
  # Copy the committed VTT into the container. On prod /app/transcriptions is not
  # mounted so this populates it; on dev it is a read-only mount, so cp fails but
  # the file is already present — tolerate that and only fail if it is truly absent.
  if ! docker cp "$vtt" "$CONTAINER:/app/transcriptions/$slug.merged.vtt" </dev/null >/dev/null 2>&1; then
    if ! docker exec "$CONTAINER" test -f "/app/transcriptions/$slug.merged.vtt" >/dev/null 2>&1; then
      echo "    docker cp failed and VTT not present in container"; failed+=("$title: cp"); continue
    fi
  fi

  # ── Pre-write gate: diagnose the map the seed WOULD produce ────────────────
  out="$($CE $DIAGNOSE --book "$title" --transcript "/app/transcriptions/$slug.merged.vtt" --realign </dev/null 2>&1)"
  cov=$(printf '%s\n' "$out" | sed -n 's/.*Edition coverage: *\([0-9.]*\)%.*/\1/p' | head -1)
  med=$(printf '%s\n' "$out" | sed -n 's/.*≈ *\(-\{0,1\}[0-9][0-9]*\) phrase.*/\1/p' | head -1)
  [ -z "$med" ] && med=$(printf '%s\n' "$out" | grep -q '≈ 0 phrase' && echo 0)
  verdict=$(printf '%s\n' "$out" | sed -n 's/^VERDICT: *//p' | head -1)

  if [ -z "$cov" ] || [ -z "$med" ]; then
    echo "    diagnose failed: $(printf '%s\n' "$out" | tail -1)"; failed+=("$title: diagnose"); continue
  fi
  absmed=${med#-}
  echo "    coverage=${cov}%  median=${med} phrase(s)  — ${verdict}"

  # Gate
  reason=""
  if awk "BEGIN{exit !($cov < $MIN_COV)}"; then
    reason="coverage ${cov}% < ${MIN_COV}% (edition mismatch — fix text first)"
  elif ! [ "$absmed" -le "$MAX_OFF" ] 2>/dev/null; then
    reason="offset ${med} > ${MAX_OFF} phrase(s)"
  elif printf '%s' "$verdict" | grep -qi "ACCUMULATING"; then
    reason="accumulating drift — investigate before writing"
  fi
  if [ -n "$reason" ]; then
    echo "    GATE FAIL — $reason (not re-seeded)"; skipped+=("$title: $reason"); continue
  fi
  awk "BEGIN{exit !($cov < 90)}" && echo "    ⚠ coverage ${cov}% < 90% — timing fix applies but stays below the free-library gate"

  if [ "$APPLY" != 1 ]; then
    echo "    GATE PASS — would re-seed (dry run)"; seeded+=("$title (dry)"); continue
  fi

  # ── Write ─────────────────────────────────────────────────────────────────
  $CE $SEED --book "$title" --transcript "/app/transcriptions/$slug.merged.vtt" </dev/null 2>&1 \
    | grep -iE "Phrases aligned|Avg confidence|Sync map saved|Book not found|Error" | sed 's/^/      /'
  esc_title=${title//\'/\'\'}
  newcov=$($PSQL -c "SELECT ROUND((s.\"syncCoverage\"*100)::numeric,1) FROM sync_maps s JOIN books b ON b.id=s.\"bookId\" WHERE b.title='${esc_title}';" </dev/null 2>/dev/null | head -1)
  echo "      re-seeded — live coverage now ${newcov:-?}%"
  seeded+=("$title")
done

echo
echo "════════ Summary ════════"
echo "Re-seeded (${#seeded[@]}):"; printf '  ✓ %s\n' "${seeded[@]:-(none)}"
echo "Skipped   (${#skipped[@]}):"; printf '  – %s\n' "${skipped[@]:-(none)}"
echo "Failed    (${#failed[@]}):"; printf '  ✗ %s\n' "${failed[@]:-(none)}"
[ ${#failed[@]} -eq 0 ]
