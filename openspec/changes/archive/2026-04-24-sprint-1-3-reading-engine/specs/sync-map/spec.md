## ADDED Requirements

### Requirement: Admin can upload a phrase sync map for a book
The system SHALL allow an authenticated admin user to create or replace the phrase-to-timestamp mapping for a book via `POST /books/:id/sync-map`. The body SHALL be `{ phrases: [{ text, startTime, endTime, index }] }`. The endpoint SHALL upsert (insert if none exists, replace if one exists). If the requesting user is not an admin, the system SHALL return 403.

#### Scenario: Admin uploads a valid sync map
- **WHEN** an admin sends `POST /books/:id/sync-map` with a valid phrases array
- **THEN** the system saves the sync map and returns 201 with the saved record

#### Scenario: Non-admin attempts upload
- **WHEN** a non-admin authenticated user sends `POST /books/:id/sync-map`
- **THEN** the system returns 403 Forbidden

#### Scenario: Admin uploads sync map for non-existent book
- **WHEN** an admin sends `POST /books/:id/sync-map` for a bookId that does not exist
- **THEN** the system returns 404 Not Found

### Requirement: Anyone can fetch the sync map for a book
The system SHALL allow unauthenticated requests to `GET /books/:id/sync-map` and return the full phrases array. If no sync map exists for the book, the system SHALL return 404.

#### Scenario: Sync map exists
- **WHEN** a client sends `GET /books/:id/sync-map` and a sync map exists for the book
- **THEN** the system returns 200 with `{ bookId, phrases: [...] }`

#### Scenario: No sync map for book
- **WHEN** a client sends `GET /books/:id/sync-map` and no sync map exists
- **THEN** the system returns 404 Not Found
