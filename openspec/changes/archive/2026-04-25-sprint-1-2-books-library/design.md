## Context

Auth (sprint 1-1) is complete. The platform has users but no content. The `web/app/(library)/library/page.tsx` and `discover/page.tsx` pages are stubs with hardcoded empty arrays. MinIO is already provisioned with `books/` and `audio/` buckets (`infra/minio/buckets.sh`). The API uses NestJS + TypeORM + PostgreSQL. The web uses Next.js 14 with the `/api` proxy rewrite (Next.js forwards `/api/*` → `http://api:4000/*`).

## Goals / Non-Goals

**Goals:**
- Ship a `Book` entity + migration with full metadata and file-reference columns
- Expose public `GET /books` (list with filters) and `GET /books/:id` (detail + presigned URLs) endpoints
- Expose an admin-only `POST /books` upload endpoint (multipart — metadata + files)
- Store book text and audio files in MinIO; serve via short-lived presigned URLs (not direct MinIO URLs)
- Wire the web library page to call the API and render real books
- Wire the discover page with category filter tabs
- Add a minimal admin upload form so the initial 12-book catalog can be seeded

**Non-Goals:**
- DRM / encrypted streaming (Phase 2)
- Full-text search via Meilisearch (Phase 2)
- Subscription gating / paywalling books (Phase 3)
- Book progress tracking / bookmarks (reader sprint)
- Mobile app (`services/mobile`) — web only this sprint

## Decisions

### 1. Presigned URLs over streaming proxy

**Decision:** MinIO files are served via short-lived presigned URLs (15 min TTL) returned by the API, not proxied through NestJS.

**Rationale:** Proxying large audio files through Node.js would be a bottleneck and waste memory. Presigned URLs offload bandwidth to MinIO/S3 directly. The 15 min TTL is long enough for a reading session to start but short enough to prevent persistent link sharing.

**Alternative considered:** NestJS streaming proxy with range-request support — rejected for MVP due to complexity and resource cost.

### 2. Single `Book` entity, no separate `Author` entity yet

**Decision:** Author name is stored as a `varchar` on `Book`, not a foreign key to an `Author` entity.

**Rationale:** The `authors` module is scaffolded but empty. Introducing a relation now would add migration complexity without delivering user value. A future migration can extract authors into their own table when the Author/Publisher module is ready.

**Alternative considered:** `Author` entity with relation — deferred to the author module sprint.

### 3. Admin role check via `isAdmin` flag on `User`, not a separate RBAC system

**Decision:** Add `isAdmin: boolean` column to `User` (default `false`). The upload endpoint checks `req.user.isAdmin`.

**Rationale:** A full RBAC system is out of scope. A boolean flag is the minimum viable gate that keeps the upload endpoint from being public without introducing permission tables.

**Alternative considered:** Separate `roles` table or `userType === 'editorial'` check — `isAdmin` is more explicit and avoids conflating editorial account type with admin privileges.

### 4. File keys stored in DB, not full URLs

**Decision:** `textFileKey` and `audioFileKey` columns store the MinIO object key (e.g., `books/uuid.epub`), not the full URL.

**Rationale:** Bucket names and MinIO hostnames can change (especially between dev/prod). Storing only the key keeps the entity portable. The API generates presigned URLs at read time from the stored key.

### 5. Multipart upload via NestJS `FileInterceptor`

**Decision:** `POST /books` accepts `multipart/form-data` with metadata fields + optional `textFile` and `audioFile` file parts.

**Rationale:** Simple and works with the existing NestJS stack. For the MVP seed of 12 books, upload speed is not a concern. Direct-to-MinIO presigned upload (for large files) can be added in a future sprint.

## Risks / Trade-offs

- **Presigned URL expiry during long sessions** → If a user leaves a book open for >15 min without interacting, the audio URL may expire mid-session. Mitigation: the reader page will re-fetch the book detail (and fresh presigned URLs) when resuming playback. This is acceptable for MVP.
- **No pagination on `GET /books`** → With 12 books this is fine; add cursor pagination before catalog grows past ~100 titles.
- **`isAdmin` flag requires a manual DB update** → Seeding admin users requires a direct SQL update or a seed script. Acceptable for MVP; add an admin creation CLI command later.
- **MinIO not available in CI** → TypeScript compilation and unit tests pass without MinIO; integration tests require the full Docker stack.

## Migration Plan

1. Run migration `1714000000004-CreateBooksTable` — creates `books` table and adds `isAdmin` to `users`
2. Seed initial 12-book catalog via admin upload form or direct SQL insert (file keys can be uploaded manually to MinIO)
3. No rollback complexity — `books` table can be dropped; `users.isAdmin` column drop is safe (defaults false)

## Open Questions

- Should `GET /books` require authentication for MVP, or remain fully public? → **Decision: public** — no paywall yet, discovery should be frictionless
- File size limits for upload? → Set `50 MB` for text files, `500 MB` for audio as NestJS interceptor limits for MVP
