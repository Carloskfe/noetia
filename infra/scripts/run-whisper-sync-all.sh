#!/bin/bash
# Re-runs seed-sync-whisper for all 16 Spanish books that have Whisper VTTs.
# Run from /opt/noetia on the production server.

COMPOSE="docker compose --env-file .env.production -f docker-compose.server.yml"
CONTAINER="noetia-api-1"

docker exec "$CONTAINER" mkdir -p /app/transcriptions

run_book() {
  local vtt_file="$1"
  local book_title="$2"
  local dest="/app/transcriptions/$(basename "$vtt_file")"
  echo ""
  echo "=========================================="
  echo "Syncing: $book_title"
  echo "=========================================="
  docker cp "$vtt_file" "$CONTAINER:$dest"
  $COMPOSE exec -T -e DB_HOST=db api \
    node dist/ingestion/seed-sync-whisper.js \
    --book "$book_title" \
    --transcript "$dest"
}

run_book "transcriptions/lazarillo.merged.vtt"             "Lazarillo de Tormes"
run_book "transcriptions/el-sombrero-de-tres-picos.merged.vtt" "El Sombrero de Tres Picos"
run_book "transcriptions/rimas-y-leyendas.merged.vtt"      "Leyendas"
run_book "transcriptions/don-juan.merged.vtt"              "Don Juan Tenorio"
run_book "transcriptions/marianela.merged.vtt"             "Marianela"
run_book "transcriptions/dona-perfecta.merged.vtt"         "Doña Perfecta"
run_book "transcriptions/niebla.merged.vtt"                "Niebla"
run_book "transcriptions/martin-fierro.merged.vtt"         "El Gaucho Martín Fierro"
run_book "transcriptions/cuentos-de-amor.merged.vtt"       "Cuentos de Amor de Locura y de Muerte"
run_book "transcriptions/cuatro-jinetes.merged.vtt"        "Los Cuatro Jinetes del Apocalipsis"
run_book "transcriptions/la-isla-del-tesoro.merged.vtt"    "La Isla del Tesoro"
run_book "transcriptions/viaje-al-centro.merged.vtt"       "Viaje al Centro de la Tierra"
run_book "transcriptions/romeo-y-julieta.merged.vtt"       "Romeo y Julieta"
run_book "transcriptions/crimen-y-castigo.merged.vtt"      "Crimen y Castigo"
run_book "transcriptions/la-odisea.merged.vtt"             "La Odisea"
run_book "transcriptions/salmos.merged.vtt"                "Salmos"

echo ""
echo "=========================================="
echo "All 16 books processed. Quality report:"
echo "=========================================="
$COMPOSE exec -T -e DB_HOST=db api node dist/ingestion/sync-quality-report.js
