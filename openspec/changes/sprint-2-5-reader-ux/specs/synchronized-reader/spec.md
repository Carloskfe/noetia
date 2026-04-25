## MODIFIED Requirements

### Requirement: Clicking a phrase seeks audio to that phrase's start time
The reader SHALL register a click handler on each phrase span that operates in two modes depending on selection state. When no selection is in progress, clicking a phrase SHALL set the audio `currentTime` to that phrase's `startTime`. When a selection is in progress (a `selectionStart` phrase has already been clicked), clicking a second phrase SHALL complete the selection and show the "Save as Fragment" popover — it SHALL NOT seek the audio.

#### Scenario: User clicks a phrase (no selection in progress)
- **WHEN** the user clicks a phrase span with `data-phrase-index="n"` and no selection is in progress
- **THEN** the audio currentTime is set to phrases[n].startTime and playback continues

#### Scenario: User starts a selection by clicking a phrase
- **WHEN** the user clicks a phrase span while holding Shift, or clicks a phrase that is different from the current audio position in selection mode
- **THEN** the phrase is marked as selectionStart and the reader enters selection mode

#### Scenario: User completes a selection
- **WHEN** the user clicks a second phrase span while a selectionStart is set
- **THEN** all phrase spans between selectionStart and the clicked index are highlighted in selection color and the "Save as Fragment" popover appears

## ADDED Requirements

### Requirement: Reader top bar replaces fixed top-right controls
The reader page SHALL render a full-width fixed top bar in place of the previous fixed top-right button cluster. The top bar SHALL contain (left to right): back button, book title, font size controls (A− / A+), dark mode toggle, discover button, and the Fragments drawer button. The mode toggle (Reading / Listening) SHALL remain accessible within the top bar or be relocated to a consistent position within it.

#### Scenario: All controls visible in top bar
- **WHEN** the reader page loads with a book
- **THEN** the top bar shows the back button, book title, A−, A+, dark mode icon, discover icon, and Fragments button

### Requirement: Phrase spans indicate saved fragment membership
The reader SHALL fetch the user's Fragment Sheet for the current book on mount (authenticated only). Phrase spans whose index falls within any saved fragment's `startPhraseIndex`–`endPhraseIndex` range SHALL render with a distinct saved-highlight CSS class (blue tint), visually distinguishing them from unsaved and active phrases.

#### Scenario: Phrases covered by a saved fragment
- **WHEN** the reader loads and the user has a saved fragment covering phrases 3–7
- **THEN** spans 3, 4, 5, 6, and 7 render with the saved-highlight CSS class

#### Scenario: No saved fragments
- **WHEN** the user has no fragments for the book
- **THEN** no phrase spans receive the saved-highlight class

### Requirement: Save as Fragment popover
After a phrase selection is completed, the reader SHALL display a small popover anchored near the selected text with a "Save as Fragment" action button and a "Cancel" button. Clicking "Save as Fragment" SHALL call `POST /fragments` with the selection range and concatenated phrase texts, add the new fragment to the local fragment list (updating highlighted spans), and dismiss the popover. Clicking "Cancel" SHALL dismiss the popover and clear the selection.

#### Scenario: User saves a selection as a fragment
- **WHEN** the user completes a phrase selection and clicks "Save as Fragment"
- **THEN** the system posts the fragment, the selected spans gain the saved-highlight class, and the popover closes

#### Scenario: User cancels the selection
- **WHEN** the user clicks "Cancel" in the popover
- **THEN** the selection highlight clears and the popover closes without creating a fragment

### Requirement: Fragment Sheet drawer is accessible from the reader
The reader page SHALL display a "Fragments" icon button in the top bar. Clicking it SHALL open the Fragment Sheet drawer (see fragment-sheet spec). The drawer SHALL be closable by clicking outside it or a close button.

#### Scenario: User opens the Fragment Sheet from the reader
- **WHEN** the user clicks the Fragments button
- **THEN** the Fragment Sheet drawer slides in over the reader without navigating away
