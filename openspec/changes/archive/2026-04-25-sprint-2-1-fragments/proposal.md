## Why

The reading engine (Sprint 1.3) is complete but users have no way to capture or save what they read — highlights and fragments are the core social differentiator that feeds the quote card and sharing pipeline. Without fragments there is nothing to share, making Sprints 2.2 and 2.3 impossible to build.

## What Changes

- Introduce `fragments` and `fragment_sheets` tables with full TypeORM entities and a migration
- Add Fragment CRUD API endpoints (create, read, update, delete) — authenticated, scoped to the requesting user
- Add a Fragment Sheet endpoint that lists all fragments a user has saved for a specific book
- Add a "combine fragments" endpoint that merges multiple fragment IDs into a single new fragment
- Extend the synchronized reader UI with a text-selection handler, a "Save as Fragment" highlight popover, and visual distinction for saved phrase spans
- Add a Fragment Sheet panel (slide-in drawer) listing, editing, and deleting fragments for the current book
- Add a multi-select + merge UI so users can combine fragments into a single quote

## Capabilities

### New Capabilities

- `fragment-crud`: Fragment entity, CRUD API (create by phrase range, read, update text, delete), scoped to authenticated user
- `fragment-sheet`: Fragment Sheet API resource (list all fragments per user+book) and the web Fragment Sheet drawer panel
- `fragment-combine`: Combine-fragments endpoint (merge multiple fragments into one) and the multi-select merge UI in the reader

### Modified Capabilities

- `synchronized-reader`: Reader now renders saved-highlight spans for phrases that belong to a fragment, shows a selection popover on phrase tap/click, and hosts the Fragment Sheet drawer toggle — spec-level UI behaviour changes

## Impact

- **api**: new migration, two new entities (`Fragment`, `FragmentSheet` is a view over fragments grouped by book), three new services, new endpoints under `/fragments/`
- **web**: reader page extended with selection state, popover component, fragment highlight CSS, Fragment Sheet drawer, and combine UI
- **db**: two new tables: `fragments`, plus a unique index on `(userId, bookId)` for efficient sheet queries
- **dependencies**: no new npm packages needed
