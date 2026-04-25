## ADDED Requirements

### Requirement: Reader top bar with exit and discover navigation
The reader page SHALL display a fixed top bar (height 48 px) that is always visible while reading. The top bar SHALL contain three zones: a left zone with a back button (chevron-left icon) that navigates to `/library`, a centered zone showing the book title truncated to one line, and a right zone with a magnifier icon button that navigates to `/discover`. The phrase list container SHALL have top padding sufficient to clear the top bar so no text is hidden beneath it.

#### Scenario: User taps back button
- **WHEN** the user taps the chevron-left button in the top bar
- **THEN** the browser navigates to `/library` and the reader is unmounted

#### Scenario: User taps discover button
- **WHEN** the user taps the magnifier icon in the top bar
- **THEN** the browser navigates to `/discover`

#### Scenario: Book title is displayed
- **WHEN** the reader has loaded a book
- **THEN** the book title is visible in the center of the top bar, truncated with an ellipsis if it exceeds the available width

#### Scenario: Top bar does not overlap reading content
- **WHEN** the reader renders phrases
- **THEN** the first phrase is fully visible below the top bar with no overlap
