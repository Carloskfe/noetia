#!/usr/bin/env bash
# Re-align all books whose merged VTTs were regenerated with correct audio
# timing (drift fix). Run ON THE SERVER from /opt/noetia after `git pull`.
# Copies each corrected VTT into the api container and re-runs seed-sync-whisper.
# Coverage is unaffected (timeline shift only), so live books stay live; the
# playback highlight now tracks the narration.
set -uo pipefail
CE="docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api"
docker exec noetia-api-1 mkdir -p /app/transcriptions
while IFS=$'\t' read -r title slug; do
  [ -z "$slug" ] && continue
  echo "── $title ($slug)"
  docker cp "transcriptions/$slug.merged.vtt" "noetia-api-1:/app/transcriptions/$slug.merged.vtt" || { echo "  cp failed"; continue; }
  $CE node dist/ingestion/seed-sync-whisper.js --book "$title" --transcript "/app/transcriptions/$slug.merged.vtt" 2>&1 \
    | grep -iE "Phrases aligned|Avg confidence|Sync map saved|Book not found|Error" | sed 's/^/    /'
done < scripts/drift-realign.tsv
echo "Done. Verify coverage: SELECT title, ROUND((\"syncCoverage\"*100)::numeric,1) FROM sync_maps s JOIN books b ON b.id=s.\"bookId\";"
