## ADDED Requirements

### Requirement: Book entity persists catalog metadata and file references
The system SHALL store each book's metadata and MinIO object keys in a `books` PostgreSQL table. The `Book` entity SHALL include: `id` (UUID), `title`, `author`, `isbn` (nullable), `language` (default `'es'`), `category` (enum), `description` (nullable), `coverUrl` (nullable), `textFileKey` (nullable), `audioFileKey` (nullable), `isPublished` (boolean, default `false`), `createdAt`, `updatedAt`.

#### Scenario: Book row is created with required fields
- **WHEN** a valid book record is saved via the repository
- **THEN** the row exists in the `books` table with a UUID primary key and `createdAt` populated

#### Scenario: Book row stores file keys, not full URLs
- **WHEN** a book is saved with `textFileKey = 'books/abc.epub'`
- **THEN** the `textFileKey` column contains `'books/abc.epub'` and no MinIO hostname

---

### Requirement: List books endpoint returns published catalog
The system SHALL expose `GET /books` returning an array of published books (`isPublished = true`). The endpoint SHALL accept an optional `category` query parameter to filter results. The endpoint SHALL NOT require authentication.

#### Scenario: List all published books
- **WHEN** `GET /books` is called with no query params
- **THEN** the response is HTTP 200 with an array of books where every item has `isPublished = true`

#### Scenario: Filter books by category
- **WHEN** `GET /books?category=leadership` is called
- **THEN** the response contains only books with `category = 'leadership'`

#### Scenario: Unpublished books are excluded
- **WHEN** a book exists with `isPublished = false`
- **THEN** it does NOT appear in the `GET /books` response

---

### Requirement: Get book detail endpoint returns metadata and presigned URLs
The system SHALL expose `GET /books/:id` returning the full book record plus time-limited presigned URLs for `textFileUrl` and `audioFileUrl` (15-minute TTL). If a file key is null, the corresponding URL field SHALL be null. The endpoint SHALL NOT require authentication.

#### Scenario: Book detail with both files
- **WHEN** `GET /books/:id` is called for a book with both `textFileKey` and `audioFileKey` set
- **THEN** the response includes `textFileUrl` and `audioFileUrl` as non-null strings starting with the MinIO host

#### Scenario: Book detail with missing file
- **WHEN** `GET /books/:id` is called for a book where `audioFileKey` is null
- **THEN** `audioFileUrl` in the response is null

#### Scenario: Book not found
- **WHEN** `GET /books/:id` is called with a non-existent UUID
- **THEN** the response is HTTP 404

---

### Requirement: Admin upload endpoint creates book and stores files in MinIO
The system SHALL expose `POST /books` accepting `multipart/form-data` with metadata fields and optional `textFile` and `audioFile` parts. The endpoint SHALL require a valid JWT belonging to a user with `isAdmin = true`. Uploaded files SHALL be stored in MinIO under the `books/` bucket (text) and `audio/` bucket (audio) using `<uuid>.<ext>` keys. The book record SHALL be created with `isPublished = false` by default.

#### Scenario: Admin uploads a complete book
- **WHEN** an admin sends `POST /books` with title, author, category, a text file, and an audio file
- **THEN** the response is HTTP 201, the book row is created in the DB, and both files exist in MinIO

#### Scenario: Non-admin is rejected
- **WHEN** a non-admin authenticated user sends `POST /books`
- **THEN** the response is HTTP 403

#### Scenario: Unauthenticated request is rejected
- **WHEN** `POST /books` is called without a JWT
- **THEN** the response is HTTP 401

#### Scenario: Upload without files creates book with null keys
- **WHEN** an admin sends `POST /books` with only metadata (no file parts)
- **THEN** the book is created with `textFileKey = null` and `audioFileKey = null`

---

### Requirement: MinIO storage integration generates presigned URLs
The system SHALL use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to interact with MinIO. The `StorageService` SHALL expose `upload(bucket, key, buffer, mimetype)` and `presign(bucket, key, ttlSeconds)` methods. The `StorageService` SHALL be configured via environment variables: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`.

#### Scenario: Presigned URL is generated for an existing object
- **WHEN** `presign('books', 'books/abc.epub', 900)` is called
- **THEN** a URL string is returned that contains the object key and an expiry signature

#### Scenario: File is uploaded to the correct bucket
- **WHEN** `upload('books', 'books/abc.epub', buffer, 'application/epub+zip')` is called
- **THEN** the object exists in the `books` MinIO bucket under key `books/abc.epub`
