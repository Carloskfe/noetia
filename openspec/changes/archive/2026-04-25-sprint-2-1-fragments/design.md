## Context

The synchronized reading engine (Sprint 1.3) is complete. Users can read and listen, but cannot capture anything. Fragments are the atomic unit of the social layer — a fragment is a saved quote (one or more phrases) that a user highlights while reading. Everything downstream (image generation, sharing, publisher analytics) operates on fragments. The API has auth, books, and reading progress in place. The web reader has phrase spans with `data-phrase-index` attributes, making phrase-level selection straightforward.

## Goals / Non-Goals

**Goals:**
- `Fragment` entity: stores userId, bookId, start/end phrase index, captured text, optional user-edited note
- Fragment CRUD endpoints: create from phrase range, list by book, update note, delete
- Fragment Sheet endpoint: `GET /books/:id/fragments` — returns all fragments the current user has for a book, ordered by phraseIndex
- Combine endpoint: `POST /fragments/combine` — accepts an array of fragment IDs, merges their text in phrase order, creates a new fragment, deletes the originals
- Reader UI: phrase click/drag selection → popover → "Save as Fragment"; saved phrase spans highlighted in blue; Fragment Sheet drawer toggled by a button
- Combine UI: multi-select checkboxes on Fragment Sheet items + "Merge" button
- Unit tests for all new services; no real DB or network calls in tests

**Non-Goals:**
- Image generation from fragments (Sprint 2.2)
- Sharing fragments externally (Sprint 2.3)
- Nested fragments or fragment tags
- Public fragment feeds or social discovery
- Mobile fragment capture (Sprint 4.2)

## Decisions

### 1. Fragment stores phraseIndex range, not raw character offsets

**Decision:** A fragment records `startPhraseIndex` and `endPhraseIndex` (integers) plus a `text` field (the concatenated phrase texts captured at creation time). No character-level offsets.

**Rationale:** The sync map already divides text into phrases at the API level. Phrase indices are stable (they don't change when the book text is reformatted), cheap to store, and trivially map back to audio timestamps for future features. Character offsets would require the client to send raw selection ranges which are browser-specific and fragile.

**Alternative considered:** Character offset ranges — rejected because they're browser-dependent, break on text reflow, and add no value when phrase boundaries are already established.

### 2. No `FragmentSheet` table — it's a query, not an entity

**Decision:** There is no `fragment_sheets` table. A "Fragment Sheet" is simply `SELECT * FROM fragments WHERE userId = $1 AND bookId = $2 ORDER BY startPhraseIndex`. The `GET /books/:id/fragments` endpoint is the fragment sheet.

**Rationale:** The TASKS.md and PRD mention a `fragment_sheets` entity, but it would be a denormalised copy of data already in `fragments`. One table is simpler, easier to test, and avoids synchronisation bugs between the two. The endpoint delivers the same UX a separate table would.

**Alternative considered:** Separate `fragment_sheets` table as a container — rejected; adds migration complexity and a join without benefit for MVP.

### 3. Combine creates a new fragment and deletes the originals — no soft delete

**Decision:** `POST /fragments/combine` creates one new fragment (text = concatenated in phraseIndex order, range = min start → max end), then hard-deletes the source fragments.

**Rationale:** Soft-delete adds a `deletedAt` column and requires filtering in every query. For MVP the combine operation is intentional and irreversible — the user explicitly chose to merge. A hard delete keeps the data model simple.

**Alternative considered:** Soft-delete with undo — deferred; can be added when undo history is a product requirement.

### 4. Text selection in reader via click-to-start + click-to-end on phrase spans

**Decision:** The reader tracks a `selectionStart` phrase index on first click and a `selectionEnd` on a second click on a different span. A popover appears offering "Save as Fragment". No browser `Selection` API involvement.

**Rationale:** The browser `Selection` API works well for arbitrary text but our text is already segmented into phrase spans. Using phrase-index state in React is simpler, works consistently across desktop and mobile (touch), and avoids the complexity of mapping a `Range` object back to phrase indices.

**Alternative considered:** `mouseup` + `window.getSelection()` — rejected; complex to map back to phrase indices and unreliable on touch devices.

### 5. Fragment Sheet as a slide-in drawer, not a separate page

**Decision:** The Fragment Sheet is a right-side drawer panel that overlays the reader without navigating away.

**Rationale:** Leaving the reader to view fragments breaks reading flow. A drawer keeps the user in context and allows them to reference the text while reviewing their fragments, matching the UX of annotation tools like Kindle highlights.

**Alternative considered:** Separate `/fragments` page — rejected for the reader flow; a dedicated page exists at `/fragments` as a stub for a future full fragments feed.

## Risks / Trade-offs

- **Phrase range overlap** → Two fragments can cover overlapping phrase ranges (user highlights the same text twice). No deduplication for MVP; the Fragment Sheet will show both. Mitigation: add a unique constraint later if product decides to prevent duplicates.
- **Combine across non-contiguous phrases** → The combine endpoint merges fragments that may have gaps between them (e.g., phrases 3–5 and 10–12). The combined text will be a concatenation with a separator (`…`) between non-adjacent ranges. Acceptable for MVP.
- **stale `text` field** → The `text` column is captured at fragment creation time from the sync map phrase texts. If a book's sync map is later replaced, existing fragment text will not update. This is intentional — fragments capture what the user read at that moment.

## Migration Plan

1. Run migration `1714000000006-CreateFragments` — creates `fragments` table
2. No data migration needed — table starts empty
3. Rollback: drop `fragments` table; no downstream dependencies yet
