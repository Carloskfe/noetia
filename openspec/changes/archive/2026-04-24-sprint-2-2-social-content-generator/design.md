## Context

The image-gen service is a Flask app with Pillow + pycairo available and four template files that currently return blank white PNGs. MinIO is running with an `images/` bucket. The NestJS API can reach image-gen at `http://image-gen:5000` via Docker bridge networking. Fragments already carry `text`, `bookId`, and `userId`; books carry `title` and `author`.

## Goals / Non-Goals

**Goals:**
- Render styled, watermarked quote card PNGs for four platforms (LinkedIn, Instagram, Facebook, WhatsApp).
- Store generated PNGs in MinIO and return short-lived pre-signed URLs.
- Expose `POST /generate` on image-gen and `POST /fragments/:id/share` on the API.
- Add a share flow to the Fragment Sheet: platform picker → generation → preview with download / copy-link.

**Non-Goals:**
- Custom fonts or user-adjustable templates (MVP uses one fixed design per platform).
- Async/queued rendering via BullMQ worker (synchronous HTTP call is sufficient at MVP scale).
- Deep links or attribution tracking (future sprint).
- TikTok / Snapchat formats.

## Decisions

**D1 — Synchronous rendering over queued jobs**
Image generation takes < 1 s for Pillow-based cards. Introducing a BullMQ job + polling adds latency and UI complexity for no benefit at MVP scale. Revisit if p95 render time exceeds 3 s.

**D2 — image-gen owns MinIO upload**
The image-gen service uploads directly to MinIO and returns a pre-signed URL rather than returning raw bytes to the API. This keeps large binary blobs off the API-to-image-gen HTTP boundary and lets image-gen own the full storage lifecycle. The API only passes metadata and forwards the URL.

**D3 — MinIO SDK (`minio` Python client) over boto3**
MinIO's own Python SDK has a smaller footprint than boto3 and first-class support for the MinIO-specific pre-sign API. The `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` env vars are already set in docker-compose.

**D4 — One fixed design system per platform**
Each template uses: dark navy background (`#0D1B2A`), white quote text (wrapped, centered), gold accent rule, smaller attribution line, bottom-right watermark ("Noetia"). Fonts fall back to Pillow's built-in default to avoid font file bundling complexity in MVP.

**D5 — NestJS `SharingModule` as the orchestration layer**
A dedicated `sharing/` module in the API keeps fragment-to-image-gen orchestration isolated from `FragmentsModule`. `FragmentsController` delegates to `SharingService` for the share endpoint, which calls image-gen via `HttpModule` and returns the URL.

## Risks / Trade-offs

- **Pillow default font is low-quality at small sizes** → Acceptable for MVP; real font files can be added in a follow-up without changing the API contract.
- **Pre-signed URLs expire** → Set TTL to 7 days; sufficient for immediate sharing. Users who revisit old share links will get 403s but this is a known trade-off.
- **image-gen is a single-process Flask dev server** → Production will need gunicorn (already in the Dockerfile pattern); out of scope for this sprint.
- **MinIO connectivity from image-gen** → Both containers are on the same Docker network; if image-gen cannot reach MinIO, the `/generate` call returns 500 and the API propagates it cleanly.
