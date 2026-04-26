## REMOVED Requirements

### Requirement: Each fragment card in the Fragment Sheet has a Share button
**Reason:** Requirement text is unchanged; only the component opened by the share button changes. Retained as-is in the base spec. Superseded by updated implementation below.
**Migration:** No migration needed — the share button remains and its placement is unchanged. The component it opens changes from `SharePicker` to `ShareModal`.

### Requirement: Platform picker lets the user choose a target social platform
**Reason:** Replaced by the unified `ShareModal` which integrates platform+format selection, font, and background controls in one panel.
**Migration:** `SharePicker.tsx` is deleted. All functionality is absorbed into `ShareModal.tsx`.

### Requirement: Share preview modal shows the generated image with download and copy-link actions
**Reason:** Replaced by the unified `ShareModal` which shows the live CSS preview before generation and the generated image URL for download/copy after.
**Migration:** `SharePreviewModal.tsx` is deleted. All functionality is absorbed into `ShareModal.tsx`.

## ADDED Requirements

### Requirement: ShareModal replaces SharePicker and SharePreviewModal as the single share entry point
The `FragmentSheet` SHALL open `ShareModal` (not `SharePicker`) when the user clicks the share button on a fragment card. `ShareModal` SHALL receive `fragmentId`, `fragmentText`, `author`, `bookTitle`, and `note` as props. `SharePicker.tsx` and `SharePreviewModal.tsx` SHALL be deleted.

#### Scenario: Clicking share on a fragment card opens ShareModal
- **WHEN** the user clicks the share icon on a fragment card in the Fragment Sheet
- **THEN** the `ShareModal` component is rendered with the correct fragment data

#### Scenario: ShareModal closes when the backdrop is clicked
- **WHEN** the user clicks outside the `ShareModal` panel
- **THEN** the modal closes and the Fragment Sheet remains open
