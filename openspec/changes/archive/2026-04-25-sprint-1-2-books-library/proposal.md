## Why

Auth is complete but the platform has no content — the library page hardcodes an empty array and the reader, fragments, and social sharing features have nothing to operate on. Books are the foundational dependency for every downstream feature: you cannot read, highlight, or share without a catalog.

## What Changes

- Introduce a `Book` entity and PostgreSQL migration covering metadata (title, author, ISBN, language, category, cover) and file references (text file key, audio file key in MinIO)
- Add a `books` NestJS module with public list/get endpoints and an admin-only upload endpoint
- Integrate MinIO for storing and serving book text and audio files via presigned URLs
- Replace the hardcoded empty array in `web/app/(library)/library/page.tsx` with a live API call
- Wire `web/app/(library)/discover/page.tsx` with category-filtered browsing
- Add an admin upload form at `web/app/(admin)/admin/page.tsx` to seed initial catalog

## Capabilities

### New Capabilities

- `book-catalog`: Book entity, CRUD API (list, get, admin upload), MinIO storage integration, presigned URL serving
- `library-ui`: Web library page wired to real API data — personal library list and discover/browse by category

### Modified Capabilities

<!-- none — no existing specs yet -->

## Impact

- **API**: New `BooksModule`, `Book` entity, TypeORM migration, MinIO client (`@aws-sdk/client-s3`)
- **Web**: Library page, Discover page, Admin upload form — all currently stubs
- **Storage**: MinIO `books/` and `audio/` buckets (already provisioned in `infra/minio/buckets.sh`)
- **Dependencies**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` in `services/api`; no new web deps
- **Auth impact**: Upload endpoint requires JWT + admin role check; list/get endpoints are public (no auth required for MVP catalog browsing)
