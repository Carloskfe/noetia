## ADDED Requirements

### Requirement: Authenticated user can create a fragment from a phrase range
The system SHALL allow an authenticated user to create a fragment by sending `POST /fragments` with `{ bookId, startPhraseIndex, endPhraseIndex, text }`. The fragment SHALL be owned by the requesting user. The system SHALL return 201 with the created fragment record.

#### Scenario: Valid fragment creation
- **WHEN** an authenticated user sends `POST /fragments` with a valid bookId and phrase range
- **THEN** the system creates the fragment and returns 201 with `{ id, userId, bookId, startPhraseIndex, endPhraseIndex, text, note, createdAt }`

#### Scenario: Unauthenticated request
- **WHEN** an unauthenticated client sends `POST /fragments`
- **THEN** the system returns 401 Unauthorized

#### Scenario: Single-phrase fragment (start equals end)
- **WHEN** an authenticated user sends `POST /fragments` with `startPhraseIndex === endPhraseIndex`
- **THEN** the system creates the fragment successfully and returns 201

### Requirement: Authenticated user can update the note on their fragment
The system SHALL allow an authenticated user to update the optional `note` field of a fragment they own via `PATCH /fragments/:id` with `{ note }`. The system SHALL return 200 with the updated fragment. If the fragment does not belong to the requesting user, the system SHALL return 403.

#### Scenario: Owner updates note
- **WHEN** the fragment owner sends `PATCH /fragments/:id` with a new note string
- **THEN** the system updates the note and returns 200 with the updated record

#### Scenario: Non-owner attempts update
- **WHEN** a user sends `PATCH /fragments/:id` for a fragment they do not own
- **THEN** the system returns 403 Forbidden

#### Scenario: Fragment not found
- **WHEN** the fragmentId does not exist
- **THEN** the system returns 404 Not Found

### Requirement: Authenticated user can delete their own fragment
The system SHALL allow an authenticated user to delete a fragment they own via `DELETE /fragments/:id`. The system SHALL return 204 on success. If the fragment does not belong to the requesting user, the system SHALL return 403.

#### Scenario: Owner deletes fragment
- **WHEN** the fragment owner sends `DELETE /fragments/:id`
- **THEN** the system hard-deletes the record and returns 204

#### Scenario: Non-owner attempts delete
- **WHEN** a different user sends `DELETE /fragments/:id`
- **THEN** the system returns 403 Forbidden
