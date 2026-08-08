# 11 — Storage

Object storage: **MinIO** (S3-compatible), self-hosted. Module: `services/api/src/storage`.

## Client — CONFIRMED (`storage.service.ts`)
- Uses the AWS S3 SDK (`PutObjectCommand`, `GetObjectCommand`, presigned URL signing).
- Config (names only): `MINIO_ENDPOINT` (default `storage`), `MINIO_PORT` (9000), `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_PUBLIC_URL`.
- Two-client concern: a separate signing client is configured with the **public host** (`MINIO_PUBLIC_URL`) so presigned URLs are reachable from browsers (the internal Docker hostname `storage` is rewritten). Presigning is offline (no network round-trip). **CONFIRMED**.

## Methods — CONFIRMED
- `upload(bucket, key, buffer, mimetype)` — `PutObjectCommand`.
- `presign(bucket, key, ttlSeconds)` — time-limited `GetObjectCommand` URL (audio/text downloads).
- `getText(key, bucket='books')` — read stored book text (used by ingestion/alignment).
- `publicUrl(bucket, key)` — permanent public URL (requires public-read bucket policy).

## Buckets & layout — CONFIRMED (`infra/minio/buckets.sh`)
```
books/            books text + (per CLAUDE.md) covers/          → PRIVATE
audio/            book audio (MP3)                              → PRIVATE
images/           share/, backgrounds/presets/, backgrounds/user/ → PUBLIC
```
- **Access policy (CONFIRMED, CLAUDE.md + bucket audit):** `books/` and `audio/` are **private** (served via presigned URLs); `images/` is **public** (quote cards, backgrounds).

## What is stored — CONFIRMED
- **Book text** (`Book.textFileKey`) — source text for the reader and alignment.
- **Book audio** (`Book.audioFileKey`, `Book.audioStreamKey`) — the streamable MP3 (progressive, <2 s start). Multi-chapter audio is byte-concatenated into one MP3.
- **Covers** (`Book.coverUrl`) — themed cover PNGs.
- **Generated images** — quote cards (`images/share/`) produced by image-gen; background presets and user uploads (`images/backgrounds/`).

## Access pattern — CONFIRMED
- Private assets: API mints a short-lived presigned URL (15 min per project notes) on demand; the web reader refreshes it mid-listen without losing audio position.
- Public assets: served directly from `storage.noetia.app` via `publicUrl`.

## Backups — CONFIRMED (ops)
Weekly MinIO backup (Sunday 3 AM, 4-copy retention). Console access via SSH tunnel (port 9001).

## Limitations / notes — INFERRED
- Single MinIO node (no distributed/erasure setup in compose); durability rests on the VPS disk + weekly backup.
- No CDN in front of `images/` observed (public URLs point at MinIO directly). A CDN is a latent optimization.
- Presigned-URL TTL (15 min) requires the reader's refresh logic for long listens — implemented, but a coupling to watch.
