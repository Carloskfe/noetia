#!/usr/bin/env bash
# Batch Whisper transcription pipeline for all remaining Spanish books.
# Sorted by chapter count (shortest first) so early books finish quickly.
#
# Books already done (merged VTT exists, already aligned in DB):
#   Romeo y Julieta 99.1% · Don Juan Tenorio 98.6% · Cuentos de Amor 98.0%
#   Niebla 88.1% · Marianela 99.8% · Lazarillo 84.1%
#   (below 85%: Salmos 80.9% · Los Cuatro Jinetes 77.2% · Crimen y Castigo 72.7%
#    El Sombrero 70.6% · Doña Perfecta 69.0% · Viaje Centro 67.4%
#    La Odisea 59.1% · Leyendas 58.8% · La Isla 55.7% · Martín Fierro 55.4%)
#
# Usage:
#   bash scripts/whisper-batch.sh           # all books, medium model
#   bash scripts/whisper-batch.sh small     # use 'small' model (~4x faster on CPU)
#   SKIP="genesis mateo" bash scripts/whisper-batch.sh  # skip specific books
#
# After all books complete, commit and push transcriptions/, then run
# seed-sync-whisper.js on the server for each new .merged.vtt file.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${1:-medium}"
SKIP="${SKIP:-}"

run_book() {
  local url="$1" slug="$2" dir="$3" lang="${4:-es}"
  if echo "$SKIP" | grep -qw "$slug"; then
    echo "==> SKIP $dir"
    return
  fi
  if [[ -f "$REPO/transcriptions/$slug.merged.vtt" ]]; then
    echo "==> ALREADY DONE: $dir"
    return
  fi
  echo ""
  echo "============================================================"
  echo "==> START: $dir  (model=$MODEL, lang=$lang)"
  echo "============================================================"
  python3 "$REPO/scripts/whisper-book.py" \
    --url "$url" --slug "$slug" --dir "$dir" \
    --lang "$lang" --model "$MODEL"
}

# ── Bible epistles (1–6 chapters each, very short) ───────────────────────────
run_book "https://librivox.org/bible-reina-valera-nt-10-la-epistola-del-apostol-san-pablo-a-los-efesios-by-reina-valera/" \
         "efesios" "Efesios"

run_book "https://librivox.org/bible-reina-valera-nt-11-filipenses-by-reina-valera/" \
         "filipenses" "Filipenses"

# ── Short Bible books ─────────────────────────────────────────────────────────
run_book "https://librivox.org/bible-reina-valera-nt-27-apocalipsis-by-reina-valera/" \
         "apocalipsis" "Apocalipsis"

run_book "https://librivox.org/bible-reina-valera-nt-01-mateo-by-reina-valera/" \
         "mateo" "Mateo"

run_book "https://librivox.org/bible-reina-valera-nt-04-juan-by-reina-valera/" \
         "juan" "Juan"

run_book "https://librivox.org/bible-reina-valera-nt-03-lucas-by-reina-valera/" \
         "lucas" "Lucas"

run_book "https://librivox.org/bible-reina-valera-1909-20-libro-de-los-proverbios-by-reina-valera/" \
         "proverbios" "Proverbios"

run_book "https://librivox.org/isaias-by-reina-valera/" \
         "isaias" "Isaías"

# ── Short literary books ──────────────────────────────────────────────────────
run_book "https://librivox.org/fabulas-y-verdades-by-rafael-pombo/" \
         "fabulas-y-verdades" "Fábulas y Verdades"

run_book "https://librivox.org/cuentos-de-la-selva-para-los-ninos-by-horacio-quiroga/" \
         "cuentos-de-la-selva" "Cuentos de la Selva"

run_book "https://librivox.org/el-gaucho-martin-fierro-by-jose-hernandez/" \
         "martin-fierro" "El Gaucho Martín Fierro"

run_book "https://librivox.org/romeo-y-julieta-by-william-shakespeare/" \
         "romeo-y-julieta" "Romeo y Julieta"

run_book "https://librivox.org/cuentos-de-amor-de-locura-y-de-muerte-by-horacio-quiroga/" \
         "cuentos-de-amor" "Cuentos de Amor de Locura y de Muerte"

# ── Bible long books ──────────────────────────────────────────────────────────
run_book "https://librivox.org/genesis-reina-valera-version/" \
         "genesis" "Génesis"

run_book "https://librivox.org/bible-reina-valera-02-exodo-by-reina-valera/" \
         "exodo" "Éxodo"

# ── Medium literary books ─────────────────────────────────────────────────────
run_book "https://librivox.org/los-cuatro-jinetes-del-apocalipsis-by-vicente-blasco-ibanez/" \
         "cuatro-jinetes" "Los Cuatro Jinetes del Apocalipsis"

run_book "https://librivox.org/la-odisea-by-homero/" \
         "la-odisea" "La Odisea"

run_book "https://librivox.org/viaje-al-centro-de-la-tierra-by-jules-verne/" \
         "viaje-al-centro" "Viaje al Centro de la Tierra"

# ── Long literary books (run overnight) ──────────────────────────────────────
run_book "https://librivox.org/crimen-y-castigo-by-fyodor-dostoyevsky/" \
         "crimen-y-castigo" "Crimen y Castigo"

run_book "https://librivox.org/don-quijote-vol-1-by-miguel-de-cervantes-saavedra/" \
         "don-quijote-vol-1" "Don Quijote Vol. I"

run_book "https://librivox.org/don-quijote-volume-2-by-miguel-de-cervantes-saavedra/" \
         "don-quijote-vol-2" "Don Quijote Vol. II"

# ── Remaining auto-sync Spanish books (no VTT yet) ───────────────────────────

run_book "https://librivox.org/carta-del-apostol-santiago-by-reina-valera/" \
         "santiago" "Santiago"

run_book "https://librivox.org/1-corintios-reina-valera/" \
         "1-corintios" "1 Corintios"

run_book "https://librivox.org/hebreos-version-reina-valera/" \
         "hebreos" "Hebreos"

run_book "https://librivox.org/bible-nt-06-romanos-by-reina-valera/" \
         "romanos" "Romanos"

run_book "https://librivox.org/el-bible-reina-valera-nt-02-evangelio-segun-marcos-by-reina-valera/" \
         "marcos" "Marcos"

run_book "https://librivox.org/bible-reina-valera-nt-05-hechos-de-los-apostoles-by-reina-valera/" \
         "hechos" "Hechos"

run_book "https://librivox.org/platero-y-yo-by-juan-ramon-jimenez/" \
         "platero-y-yo" "Platero y yo"

run_book "https://librivox.org/pepita-jimenez-by-juan-valera/" \
         "pepita-jimenez" "Pepita Jiménez"

run_book "https://librivox.org/orgullo-y-prejuicio1-by-jane-austen/" \
         "orgullo-y-prejuicio" "Orgullo y Prejuicio"

run_book "https://librivox.org/la-divina-comedia-by-dante-alighieri/" \
         "la-divina-comedia" "La Divina Comedia"

echo ""
echo "============================================================"
echo "All done! Next: commit and push transcriptions/, then run"
echo "seed-sync-whisper.js on the server for each new merged VTT."
echo "============================================================"
