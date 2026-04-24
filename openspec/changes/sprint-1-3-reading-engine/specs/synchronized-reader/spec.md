## ADDED Requirements

### Requirement: Reader loads book content and sync data on mount
The reader page SHALL accept a `?bookId=` query parameter and on mount fetch: book detail (title, author, `audioFileUrl`, `textFileUrl`), the book's sync map, and the user's saved progress. It SHALL restore the reading position to the saved phrase index.

#### Scenario: All data loads successfully
- **WHEN** a user navigates to `/reader?bookId=<id>` and all three fetches succeed
- **THEN** the page renders the book title, phrase-span text, and audio player; the view scrolls to the saved phrase

#### Scenario: Book not found
- **WHEN** the bookId does not exist or the API returns 404
- **THEN** the page displays an error message and no audio player

#### Scenario: No sync map available
- **WHEN** the book exists but has no sync map
- **THEN** the page renders the raw book text without phrase spans and disables click-to-seek

### Requirement: Book text is rendered as phrase spans
The reader SHALL render each phrase from the sync map as a `<span data-phrase-index="n">` element. Phrases SHALL be displayed inline, preserving natural reading flow.

#### Scenario: Sync map has phrases
- **WHEN** the sync map contains N phrases
- **THEN** the text column renders exactly N `<span>` elements each with the correct `data-phrase-index`

#### Scenario: No sync map
- **WHEN** no sync map is available
- **THEN** the text is rendered as a single unsegmented block

### Requirement: Audio player provides full playback controls
The reader SHALL render an audio player with: play/pause toggle, scrub bar (range input showing current time / duration), playback speed selector (0.75×, 1×, 1.25×, 1.5×, 2×), and a current time / total duration display.

#### Scenario: User plays audio
- **WHEN** the user clicks the play button
- **THEN** audio begins playing and the button changes to a pause icon

#### Scenario: User scrubs to a position
- **WHEN** the user drags the scrub bar to a new position
- **THEN** audio seeks to that time and continues playing from the new position

#### Scenario: User changes playback speed
- **WHEN** the user selects 1.5× from the speed selector
- **THEN** audio plays at 1.5× speed

### Requirement: Active phrase is highlighted as audio plays
The reader SHALL listen to the audio `timeupdate` event and highlight the phrase whose `startTime ≤ currentTime < endTime`. The active phrase SHALL scroll into view if it is outside the visible area.

#### Scenario: Audio advances through phrases
- **WHEN** the audio currentTime enters a new phrase's time range
- **THEN** the previous phrase loses its highlight and the new phrase gains the active CSS class and scrolls into view

#### Scenario: Audio time is before all phrases
- **WHEN** currentTime is before the first phrase's startTime
- **THEN** no phrase is highlighted

### Requirement: Clicking a phrase seeks audio to that phrase's start time
The reader SHALL register a click handler on each phrase span. Clicking a phrase SHALL set the audio `currentTime` to that phrase's `startTime`.

#### Scenario: User clicks a phrase
- **WHEN** the user clicks a phrase span with `data-phrase-index="n"`
- **THEN** the audio currentTime is set to phrases[n].startTime and playback continues

### Requirement: Reading and Listening mode toggle
The reader SHALL provide a mode toggle. In **Reading Mode**, audio controls are hidden except a minimal floating play button. In **Listening Mode**, the full audio sidebar is shown and the view auto-scrolls to the active phrase on each phrase change.

#### Scenario: User switches to Listening Mode
- **WHEN** the user clicks the Listening Mode toggle
- **THEN** the full audio controls panel appears and auto-scroll activates

#### Scenario: User switches to Reading Mode
- **WHEN** the user clicks the Reading Mode toggle
- **THEN** the full audio controls panel hides and only the floating play button remains

### Requirement: Reading progress is persisted automatically
The reader SHALL save the user's current phrase index to the API whenever the active phrase changes, debounced by 2 seconds. Progress is only saved if the user is authenticated.

#### Scenario: Authenticated user advances to a new phrase
- **WHEN** the active phrase index changes and 2 seconds elapse without another change
- **THEN** `POST /books/:id/progress` is called with the current phraseIndex

#### Scenario: Unauthenticated user reads
- **WHEN** an unauthenticated user reads the book
- **THEN** no progress API call is made
