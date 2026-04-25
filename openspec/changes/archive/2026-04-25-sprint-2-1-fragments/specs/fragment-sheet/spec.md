## ADDED Requirements

### Requirement: Authenticated user can list their fragments for a book
The system SHALL allow an authenticated user to fetch all their saved fragments for a specific book via `GET /books/:id/fragments`. The response SHALL be an array of fragment records ordered by `startPhraseIndex` ascending. If the user has no fragments for the book, the system SHALL return an empty array (not 404).

#### Scenario: User has fragments for the book
- **WHEN** an authenticated user sends `GET /books/:id/fragments` and has saved fragments for that book
- **THEN** the system returns 200 with a JSON array of fragments ordered by `startPhraseIndex`

#### Scenario: User has no fragments for the book
- **WHEN** an authenticated user sends `GET /books/:id/fragments` and has no saved fragments
- **THEN** the system returns 200 with an empty array `[]`

#### Scenario: Unauthenticated request
- **WHEN** an unauthenticated client sends `GET /books/:id/fragments`
- **THEN** the system returns 401 Unauthorized

### Requirement: Fragment Sheet drawer is accessible from the reader
The reader page SHALL display a "Fragments" button that opens a slide-in drawer panel showing the Fragment Sheet for the current book. The drawer SHALL list each fragment's text and note (if any), and provide Edit note and Delete actions per fragment. The drawer SHALL also expose a multi-select mode for combining fragments.

#### Scenario: User opens the Fragment Sheet
- **WHEN** the user clicks the "Fragments" button in the reader
- **THEN** the Fragment Sheet drawer slides in and displays the user's fragments for the book

#### Scenario: No fragments yet
- **WHEN** the user opens the Fragment Sheet and has no saved fragments
- **THEN** the drawer shows an empty state message

#### Scenario: User deletes a fragment from the drawer
- **WHEN** the user clicks the delete icon on a fragment in the drawer
- **THEN** the system sends `DELETE /fragments/:id`, removes the item from the list, and shows a confirmation
