## ADDED Requirements

### Requirement: Library page fetches and displays the user's books from the API
The system SHALL replace the hardcoded empty array in `library/page.tsx` with a call to `GET /books`. Books SHALL be displayed in a 2-column grid showing cover image (or placeholder), title, and author. A search bar SHALL filter the displayed list client-side by title or author. The page SHALL show an empty-state UI when no books are returned.

#### Scenario: Books load on mount
- **WHEN** the library page renders
- **THEN** it calls `GET /books` and displays the returned books in a 2-column grid

#### Scenario: Search filters displayed books
- **WHEN** the user types in the search bar
- **THEN** only books whose title or author match the query (case-insensitive) are shown

#### Scenario: Empty state when no books
- **WHEN** the API returns an empty array
- **THEN** the empty-state component is shown with a link to `/discover`

#### Scenario: Loading state is shown while fetching
- **WHEN** the page is fetching books from the API
- **THEN** a loading skeleton or spinner is displayed instead of the grid

#### Scenario: Error state is shown on API failure
- **WHEN** the `GET /books` call fails
- **THEN** an error message is displayed and the grid does not render

---

### Requirement: Discover page shows catalog with category filter tabs
The system SHALL implement `discover/page.tsx` calling `GET /books` and displaying results in a grid. The page SHALL render category filter tabs for: All, Leadership, Personal Development, Business (matching the initial catalog). Selecting a tab SHALL call `GET /books?category=<value>` (or show all when "All" is selected). The active tab SHALL be visually distinct.

#### Scenario: All books shown on initial load
- **WHEN** the discover page loads
- **THEN** all published books are displayed and the "All" tab is active

#### Scenario: Category tab filters results
- **WHEN** the user clicks the "Leadership" tab
- **THEN** only books with `category = 'leadership'` are displayed

#### Scenario: Active tab is highlighted
- **WHEN** a category tab is selected
- **THEN** it renders with the active style and the other tabs render with the inactive style

---

### Requirement: Admin upload form seeds the initial book catalog
The system SHALL implement a minimal upload form in `app/(admin)/admin/page.tsx` with fields for title, author, category, language, description, and file pickers for text and audio files. On submit, it SHALL call `POST /books` with `multipart/form-data`. The form SHALL display success confirmation or an error message from the API response. The page SHALL redirect to `/login` if the user is not authenticated.

#### Scenario: Successful upload shows confirmation
- **WHEN** an admin submits the form with valid data and files
- **THEN** a success message is shown and the form resets

#### Scenario: API error is displayed
- **WHEN** the `POST /books` call returns an error
- **THEN** the error message from the API response is shown inline

#### Scenario: Unauthenticated access redirects to login
- **WHEN** a user without a stored access token visits `/admin`
- **THEN** they are redirected to `/login`
