#!/usr/bin/env bash
# Build the candidate images EXACTLY as CD does (`docker compose --env-file .env.production
# -f docker-compose.server.yml build <svc>`), against a throwaway .env.production that sets the old
# generic values, so the image proves the compose build arg (not the env file) reaches the bundle.
# Produces local images saltbuild-web / saltbuild-api. LOCAL ONLY. Usage: build.sh web|api [...]
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/s-alt-build.XXXXXX")"
cleanup() { case "$WORK" in "${TMPDIR:-/tmp}"/s-alt-build.??????) rm -rf -- "$WORK" ;; esac; }
trap cleanup EXIT
cp "$ROOT/docker-compose.server.yml" "$WORK/"
ln -s "$ROOT/services" "$WORK/services"
printf '%s\n' DB_PASS=x MINIO_ACCESS_KEY=x MINIO_SECRET_KEY=x MEILI_MASTER_KEY=x GRAFANA_ADMIN_PASSWORD=x \
  INTERNAL_API_URL=http://api:4000 MINIO_ENDPOINT=storage > "$WORK/.env.production"
cd "$WORK" && docker compose -p saltbuild --env-file .env.production -f docker-compose.server.yml build "$@"
