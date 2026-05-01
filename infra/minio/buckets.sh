#!/bin/sh
# Noetia — MinIO bucket initialization
# Creates required buckets with correct access policies.
# Idempotent: safe to run multiple times.

set -e

MINIO_ALIAS="local"
MINIO_URL="${MINIO_URL:-http://storage:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-changeme}"

echo "Configuring MinIO alias..."
mc alias set "$MINIO_ALIAS" "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

echo "Creating buckets..."
mc mb --ignore-existing "$MINIO_ALIAS/books"
mc mb --ignore-existing "$MINIO_ALIAS/audio"
mc mb --ignore-existing "$MINIO_ALIAS/images"

echo "Setting access policies..."
mc anonymous set none "$MINIO_ALIAS/books"
mc anonymous set none "$MINIO_ALIAS/audio"
mc anonymous set download "$MINIO_ALIAS/images"

echo "Buckets initialized:"
mc ls "$MINIO_ALIAS"
