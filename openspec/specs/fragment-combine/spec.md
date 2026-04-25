## ADDED Requirements

### Requirement: Authenticated user can combine multiple fragments into one
The system SHALL allow an authenticated user to merge two or more of their fragments via `POST /fragments/combine` with `{ fragmentIds: string[] }`. The system SHALL: sort the selected fragments by `startPhraseIndex`, concatenate their texts (joining non-adjacent ranges with " … "), create a new fragment spanning the overall min `startPhraseIndex` to max `endPhraseIndex`, delete the original fragments, and return 201 with the new fragment. All fragment IDs MUST belong to the requesting user and the same book; otherwise the system SHALL return 403 or 422.

#### Scenario: User combines two adjacent fragments
- **WHEN** an authenticated user sends `POST /fragments/combine` with two fragmentIds from the same book
- **THEN** the system creates a new fragment with concatenated text, deletes the originals, and returns 201 with the new record

#### Scenario: User combines non-adjacent fragments
- **WHEN** the selected fragments have a gap between their phrase ranges
- **THEN** the system joins the texts with " … " as a separator and returns 201

#### Scenario: Fewer than two fragment IDs provided
- **WHEN** the request body contains fewer than two fragmentIds
- **THEN** the system returns 422 Unprocessable Entity

#### Scenario: Fragment belongs to a different user
- **WHEN** one or more fragmentIds belong to a different user
- **THEN** the system returns 403 Forbidden and performs no deletions

#### Scenario: Fragment IDs span different books
- **WHEN** the fragmentIds reference fragments from different books
- **THEN** the system returns 422 Unprocessable Entity

### Requirement: Reader provides multi-select UI to combine fragments
The Fragment Sheet drawer SHALL include a "Select" toggle that activates multi-select mode. In multi-select mode each fragment row displays a checkbox. When two or more fragments are checked, a "Merge" button SHALL appear. Clicking "Merge" SHALL call `POST /fragments/combine`, replace the selected items with the new combined fragment in the list, and exit multi-select mode.

#### Scenario: User selects fragments and merges
- **WHEN** the user enables multi-select, checks two or more fragments, and clicks "Merge"
- **THEN** the system calls `POST /fragments/combine`, updates the drawer list with the new fragment, and returns to normal mode

#### Scenario: User selects only one fragment
- **WHEN** the user enables multi-select and checks only one fragment
- **THEN** the "Merge" button remains disabled
