## 1. Database — Migration & Entity

- [x] 1.1 Create migration `1714000000006-CreateFragments` — creates `fragments` table: id UUID PK, userId UUID FK → users.id ON DELETE CASCADE, bookId UUID FK → books.id ON DELETE CASCADE, startPhraseIndex INT NOT NULL, endPhraseIndex INT NOT NULL, text TEXT NOT NULL, note TEXT nullable, createdAt TIMESTAMPTZ DEFAULT now(), updatedAt TIMESTAMPTZ DEFAULT now(); add index on (userId, bookId)
- [x] 1.2 Create `src/fragments/fragment.entity.ts` with TypeORM columns matching the migration (ManyToOne relations to User and Book)
- [x] 1.3 Create `src/fragments/fragments.module.ts` importing `TypeOrmModule.forFeature([Fragment])`, registering `FragmentsService` and `FragmentsController`, and exporting `FragmentsService`
- [x] 1.4 Import `FragmentsModule` in `src/app.module.ts`

## 2. API — Fragments Service

- [x] 2.1 Create `src/fragments/dto/create-fragment.dto.ts` with `@IsUUID() bookId`, `@IsInt() startPhraseIndex`, `@IsInt() endPhraseIndex`, `@IsString() text`
- [x] 2.2 Create `src/fragments/dto/update-fragment.dto.ts` with optional `@IsString() note`
- [x] 2.3 Create `src/fragments/fragments.service.ts` with methods:
  - `create(userId, dto): Promise<Fragment>`
  - `findByUserAndBook(userId, bookId): Promise<Fragment[]>` — ordered by startPhraseIndex ASC
  - `findOne(id): Promise<Fragment | null>`
  - `update(id, userId, dto): Promise<Fragment>` — throws ForbiddenException if userId mismatch
  - `remove(id, userId): Promise<void>` — throws ForbiddenException if userId mismatch
  - `combine(userId, fragmentIds): Promise<Fragment>` — validates ≥2 IDs, same book, same user; concatenates texts; creates new; deletes originals

## 3. API — Fragments Controller & Books Controller Extension

- [x] 3.1 Create `src/fragments/fragments.controller.ts` with:
  - `POST /fragments` — JwtAuthGuard, calls `fragmentsService.create(req.user.id, dto)`, returns 201
  - `PATCH /fragments/:id` — JwtAuthGuard, calls `fragmentsService.update(id, req.user.id, dto)`, returns 200
  - `DELETE /fragments/:id` — JwtAuthGuard, calls `fragmentsService.remove(id, req.user.id)`, returns 204
  - `POST /fragments/combine` — JwtAuthGuard, calls `fragmentsService.combine(req.user.id, body.fragmentIds)`, returns 201
- [x] 3.2 Add `GET /books/:id/fragments` to `src/books/books.controller.ts` — JwtAuthGuard, calls `fragmentsService.findByUserAndBook(req.user.id, id)`, returns array (inject FragmentsService via constructor)
- [x] 3.3 Add `FragmentsModule` to imports in `BooksModule` so `FragmentsService` is available in `BooksController`

## 4. API — Unit Tests

- [x] 4.1 Create `tests/unit/fragments/fragments.service.spec.ts` — mock TypeORM repository; test `create`, `findByUserAndBook` (with results, empty), `update` (owner, non-owner → 403), `remove` (owner, non-owner → 403), `combine` (valid merge, <2 IDs → 422, different books → 422, non-owner ID → 403); no real DB
- [x] 4.2 Run `npm run test` in `services/api` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 5. Web — Reader: Fragment State & Selection

- [x] 5.1 Add fragment state to the reader page: `fragments: Fragment[]` loaded via `GET /books/:id/fragments` on mount (authenticated only; skip if no token); `selectionStart: number | null`; `showPopover: boolean`; `showDrawer: boolean`
- [x] 5.2 Compute `savedPhraseSet`: a `Set<number>` of all phrase indices covered by any fragment (for efficient span class lookup)
- [x] 5.3 Update phrase span click handler: if `selectionStart === null` → seek audio (existing behaviour); if clicking same span as selectionStart → cancel selection; otherwise → set selectionEnd and show popover
- [x] 5.4 Render phrase spans with three possible CSS states: active (yellow, existing), saved (blue tint: `bg-blue-100`), selected range (indigo: `bg-indigo-200`), default (hover gray)

## 6. Web — Save as Fragment Popover

- [x] 6.1 Create `services/web/components/FragmentPopover.tsx` — small absolute-positioned card showing the selected phrase count and two buttons: "Guardar fragmento" and "Cancelar"
- [x] 6.2 Wire "Guardar fragmento": call `POST /fragments` with `{ bookId, startPhraseIndex, endPhraseIndex, text }` (text = selected phrases joined with space); on success add to `fragments` state, recompute `savedPhraseSet`, clear selection, close popover
- [x] 6.3 Wire "Cancelar": clear `selectionStart`, close popover

## 7. Web — Fragment Sheet Drawer

- [x] 7.1 Create `services/web/components/FragmentSheet.tsx` — slide-in right drawer (fixed, full-height, w-80) with:
  - Header: "Fragmentos" title + close button
  - Empty state when no fragments
  - List of fragment cards: text preview, note (if any), edit note inline (textarea on click), delete button
  - "Seleccionar" toggle button to enter multi-select mode
- [x] 7.2 In multi-select mode: each card shows a checkbox; when ≥2 checked, a "Combinar" button appears at the bottom; clicking "Combinar" calls `POST /fragments/combine`, replaces items in state, exits multi-select mode
- [x] 7.3 Add Fragments button to reader page top controls (bookmark icon); toggle `showDrawer` state; render `<FragmentSheet>` when `showDrawer` is true, passing fragments, onClose, onDelete, onCombine, onNoteUpdate callbacks

## 8. Web — Unit Tests

- [x] 8.1 Create `services/web/tests/unit/reader/fragment-utils.spec.ts` — test the `savedPhraseSet` computation logic (extract to a pure function `buildSavedPhraseSet(fragments): Set<number>`): empty fragments → empty set, single fragment → correct range, overlapping fragments → union of ranges
- [x] 8.2 Run `npm run test` in `services/web` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 9. Verification

- [x] 9.1 Run migration in dev DB: `docker exec alexandria-api-1 node /app/node_modules/typeorm/cli.js migration:run -d /app/dist/data-source.js` — confirm `fragments` table exists
- [x] 9.2 `POST /fragments` with JWT and valid body → returns 201 fragment record
- [x] 9.3 `GET /books/:id/fragments` with JWT → returns array of user's fragments ordered by startPhraseIndex
- [x] 9.4 `PATCH /fragments/:id` with note → returns 200 with updated note
- [x] 9.5 `DELETE /fragments/:id` → returns 204; subsequent GET no longer includes it
- [x] 9.6 `POST /fragments/combine` with two IDs → returns 201 new fragment; originals gone
- [x] 9.7 Open reader in browser: click one phrase then another → popover appears; save → spans turn blue
- [x] 9.8 Open Fragment Sheet drawer → saved fragment appears; delete works; combine works
- [x] 9.9 All api and web tests still pass after all changes
- [x] 9.10 Commit and push all changes to GitHub
