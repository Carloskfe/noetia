## 1. API Dependencies & Storage Setup

- [x] 1.1 Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `services/api/package.json` and run `pnpm install`
- [x] 1.2 Create `src/storage/storage.service.ts` with `upload(bucket, key, buffer, mimetype)` and `presign(bucket, key, ttlSeconds)` methods using S3Client configured from `MINIO_*` env vars
- [x] 1.3 Create `src/storage/storage.module.ts` exporting `StorageService` as a global provider
- [x] 1.4 Import `StorageModule` in `src/app.module.ts`

## 2. User Entity — isAdmin Flag

- [x] 2.1 Add `@Column({ type: 'boolean', default: false }) isAdmin: boolean` to `src/users/user.entity.ts`
- [x] 2.2 Create migration `1714000000004-CreateBooksTable` that adds `isAdmin` column to `users` AND creates the full `books` table (id UUID PK, title, author, isbn nullable, language default 'es', category enum, description nullable, coverUrl nullable, textFileKey nullable, audioFileKey nullable, isPublished boolean default false, createdAt, updatedAt)

## 3. Books Module — API

- [x] 3.1 Create `src/books/book.entity.ts` with all columns from the migration (use `BookCategory` enum: `leadership`, `personal-development`, `business`)
- [x] 3.2 Create `src/books/dto/create-book.dto.ts` with `@IsString()` / `@IsEnum()` / `@IsOptional()` validators for all metadata fields
- [x] 3.3 Create `src/books/books.service.ts` with methods: `findAll(category?)`, `findById(id)`, `create(dto, textKey?, audioKey?)`
- [x] 3.4 Create `src/books/books.controller.ts` with:
  - `GET /books` — public, calls `booksService.findAll(category?)`, returns books array
  - `GET /books/:id` — public, calls `booksService.findById(id)`, attaches presigned URLs, returns 404 if not found
  - `POST /books` — JwtAuthGuard + isAdmin check (throw `ForbiddenException` if not admin), `FilesInterceptor` for `textFile` and `audioFile`, uploads to MinIO, creates book record
- [x] 3.5 Create `src/books/books.module.ts` importing `TypeOrmModule.forFeature([Book])`, `StorageModule`, and `UsersModule`; register controller and service
- [x] 3.6 Import `BooksModule` in `src/app.module.ts`

## 4. Database Migration

- [x] 4.1 Run migration against the dev database: `pnpm --filter @alexandria/api migration:run`
- [x] 4.2 Verify `books` table exists and `users.isAdmin` column is present in the DB

## 5. Web — Library Page

- [x] 5.1 Replace the hardcoded `const books: any[] = []` in `app/(library)/library/page.tsx` with a `useEffect` that calls `apiFetch('/books')` on mount
- [x] 5.2 Add `loading` and `error` state — show a spinner while fetching, an error message on failure
- [x] 5.3 Ensure the existing `BookGrid` and `EmptyLibrary` components render correctly from live API data (fix any field name mismatches — API returns `coverUrl`, `title`, `author`, `id`)

## 6. Web — Discover Page

- [x] 6.1 Implement `app/(library)/discover/page.tsx` with category filter tabs: All, Leadership, Personal Development, Business
- [x] 6.2 On tab change, call `apiFetch('/books')` or `apiFetch('/books?category=<value>')` and re-render the grid
- [x] 6.3 Show active tab with blue highlight style; inactive tabs in gray
- [x] 6.4 Reuse the `BookGrid` component from library page (or extract to `components/BookGrid.tsx` if shared)

## 7. Web — Admin Upload Page

- [x] 7.1 Implement `app/(admin)/admin/page.tsx` with a form: title, author, category select, language select, description textarea, text file input, audio file input
- [x] 7.2 On mount, redirect to `/login` if no access token in `sessionStorage`
- [x] 7.3 On submit, build a `FormData` object and call `fetch('/api/books', { method: 'POST', headers: { Authorization: 'Bearer ...' }, body: formData })` (do NOT set `Content-Type` — browser sets boundary automatically)
- [x] 7.4 Show success message on 201 and reset the form; show API error message on failure

## 8. Verification

- [x] 8.1 `POST /books` with admin JWT and files returns 201 and book appears in DB
- [x] 8.2 `GET /books` returns the seeded book with `isPublished = true`
- [x] 8.3 `GET /books/:id` returns presigned `textFileUrl` and `audioFileUrl`
- [x] 8.4 `POST /books` with non-admin JWT returns 403
- [x] 8.5 Library page at `http://localhost:3000/library` shows books from API (not empty array)
- [x] 8.6 Discover page category tabs filter correctly
- [x] 8.7 Admin page at `http://localhost:3000/admin` uploads a book successfully
- [x] 8.8 Commit and push all changes to GitHub
