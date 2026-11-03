# NEM-016: SA-001 Stage 0, sharing security and integrity corrections

> Implementation report (agent reporting protocol). **Not merged, not deployed.** No production migration, no Stripe change. Copyright, privacy and platform conclusions are internal assessments, not legal certification.

## 1. Mission and objective

Close the sharing defects documented in the SA-001 report (Draft PR #24) before any SA-001 feature work:
- S1, S2/C1, S3/G9, S8/S15, S12, S13, S14
- G8, G10

Mission record: `docs/engineering-missions/IN-PROGRESS/NEM-016-sa001-stage0-sharing-integrity.md`. NEM-016 is the next free identifier; NEM-015 is the highest used on any branch.

## 2. Date and status

- **Date:** 2026-11-02
- **Status:** implementation complete on branch `fix/nem-016-sa001-stage0-sharing-integrity`, branched from `origin/main` `6a5e5c0`. Draft PR open; **awaiting Product Architecture review and PO decision.**

## 3. Scope and exclusions

**In scope:** the corrections in §5.

**Excluded, not started:**
- the public book page
- new sharing UX
- the reflection-sharing experience
- the `[…]` source-range quotation editor (design only, §5.10)
- the D06 rights policy
- analytics
- native links
- auth throttling fixes (S16, S17, reported only)

## 4. Executive summary

- **All nine Stage 0 areas are implemented and tested.** The tests pass:

  | Suite | Result |
  |---|---|
  | API | 1056 / 1056 (baseline before changes: 948 / 948) |
  | Web | 303 / 303 |
  | Mobile | 187 / 187 |
  | image-gen | 206 / 206, 93.9% coverage |

- **One additive migration (068):** two nullable columns and two indexes on `shares`. It was tested up, down and re-up on local Postgres 16 inside a rolled-back transaction. `down` refuses to run while revoked shares exist, so a rollback can't silently re-publish withdrawn content.
- **No existing reader content is overwritten or deleted, apart from the authorized lifecycle.** Readers' own revocations, fragment deletion and account deletion now remove the related share and its card image.
- **User-visible changes:**
  - A card whose text isn't the author's wording is refused with an explanation. Shortening is still allowed.
  - Mobile "Open image" opens the image, and Android shares now include the link.
  - The fragments tutorial now says "shorten" instead of "edit".
- **Two new pre-existing findings, out of scope and not fixed:**
  - **S16:** per-route `@Throttle({ default: … })` limits on auth endpoints are silently ignored.
  - **S17:** without `trust proxy`, every client probably shares one IP-keyed throttle bucket behind Traefik.

## 5. Verified findings and changes

### 5.1 S1: ownership before sharing
`sharing.controller.ts` returns **404** unless `fragment.userId === req.user.id`. It's 404 rather than 403 so other readers' fragment ids can't be probed. Nothing is rendered, counted or emitted for a non-owner.

### 5.2 S3 / G9: revocation and deletion lifecycle
New `ShareLifecycleService` (`sharing/share-lifecycle.service.ts`), in its own `ShareLifecycleModule` to avoid circular module imports:

- **`DELETE /shares/:id` (creator only, 204, idempotent).** Sets `revokedAt` and deletes the card PNG from the public `images/` bucket. Someone else's share returns 404.
- **Fragment delete** (`FragmentsService.remove`) revokes the fragment's live shares *before* deleting it. If revocation fails, the fragment isn't deleted.
  - **Combine** does not revoke: merging isn't withdrawing.
- **Account deletion** (`UsersService.deleteAccount`) hard-deletes, before the user row:
  - every share the user created
  - any share of the user's fragments made by someone else (possible before S1)

  It then deletes their images. If the share delete fails, the user row is kept. The query must run first because fragments cascade with the user.
- **Image cleanup:**
  - It's best-effort: a storage failure is logged by key and never blocks revocation.
  - It deletes only keys matching `images/<uuid4>.png`, so it can't delete other objects.
- **Public API:** `GET /shares/:id` returns 404 for revoked shares and doesn't count the visit.

### 5.3 G10: mobile regressions
In `ShareSheet.tsx`:
- **Open image** now uses `res.imageUrl`. Since 2026-07-19 it had opened `res.url`, the share page.
- **The Android share message includes the page link.** `buildShareContent` puts it in `message` on Android, where React Native ignores `url`, and passes `url` on iOS without duplicating it.
- Specific error messages were added for: quote refused, book not shareable, rate limited.

This is JavaScript-only, so it can ship as an OTA update. No OTA was published.

### 5.4 G8: duplicate shares
- `shareConfigHash` is a sha256 of: the creator, the fragment, the text, every rendering option and a hash of the background.
- An identical live share is returned with `reused: true`. In that case there's no render, no new row, no `shareCount` increment and no rate-limit charge.
- A partial unique index `(createdById, configHash) WHERE revokedAt IS NULL AND configHash IS NOT NULL` handles concurrent double-clicks. The loser returns the winner's share and deletes its own orphan image.
- `shareCount` now uses an atomic `increment` instead of read-modify-save.

### 5.5 S12: renderer URL fetching
- **API (`share-background.ts`) is the authoritative gate.** `bgImage` must be either:
  - an inline `data:image/{png,jpeg,webp};base64` of at most 8,000,000 characters (web presets and uploads), or
  - `http(s)://<allowed host>/backgrounds/imagen-N.jpg` with N from 1 to 18 (mobile presets).

  Allowed hosts are `noetia.app`, `staging.noetia.app`, the `WEB_URL` host, and the optional `SHARE_BG_ALLOWED_HOSTS`. URLs with credentials, a query or a fragment are rejected. Anything else gets 400 `unsupported_background_image` before image-gen is called.
- **image-gen (`templates/base.py`), defence in depth:**
  - data URIs limited to raster image types
  - http/https only
  - preset path only
  - **redirects not followed**
  - 10 MB read cap
  - optional `BG_IMAGE_ALLOWED_HOSTS`

  A rejected source renders the existing navy fallback without any fetch. Previously the renderer called `urllib.request.urlopen` on any string, including `file://` and internal hosts.

### 5.6 S13: server-side social publishing
`POST /social/:platform/publish` no longer fetches the caller's `imageUrl`. It requires:
1. an exact `<MINIO_PUBLIC_URL>/images/<uuid>.png` URL
2. a matching **live share created by the caller**
3. the per-user publish rate limit

The bytes are read with the S3 client (`StorageService.getBuffer`), never over HTTP. Pinterest still receives the validated public URL. The API and image-gen read the same `MINIO_PUBLIC_URL` from `.env.production` [V `docker-compose.server.yml`].

### 5.7 S14: ineligible books
- `books/book-eligibility.ts` holds the **single** quality-gate definition: author uploads pass; ingested books need sync coverage of at least 0.90. `GET /books` now uses it with identical SQL semantics, and its tests are unchanged and pass.
- `isBookPubliclyEligible` adds the `isPublished` check.
- Share creation returns 422 `book_not_shareable` for ineligible books, and `GET /shares/:id` returns 404 if the book later becomes ineligible.

### 5.8 S15 / S8: validation and rate limits
- **`ShareFragmentDto`**, with the global `ValidationPipe` (`whitelist: true`):
  - `platform` from a known list
  - `text` up to 2000 characters, `citation` up to 200
  - up to 4 hex colours
  - booleans, enumerated `bgType`/`bgFit`/`textAlign`
  - `textScale` between 0.5 and 2
  - length caps on `font`/`format`/`gradientDir`
  - size cap on `bgImage`

  Payloads from current web and mobile clients still validate (tested).
- **`ShareRateLimiter`** is a per-user fixed window in Redis:
  - 20 new renders per 10 minutes
  - 10 social publishes per 10 minutes
  - HTTP 429 `rate_limited`
  - fails open if Redis is down

  It's keyed by user, not IP, because of S17.

### 5.9 S2 / C1: quotation integrity, the Stage 0 guardrail
**Verified context:**
- Fragments store client-supplied `text` and **never** populate `startPhraseIndex`/`endPhraseIndex` [V `fragments.service.ts` `create`].
- `PATCH /fragments/:id` accepts any text.
- So there are no stored source positions to trust.

**What Stage 0 does.** `QuoteIntegrityService` checks the rendered text, which is the `text` override or the stored fragment text, against the book's source. The source is the sync-map phrases when present (what the reader displays), otherwise the stored text file.

| Case | Rule |
|---|---|
| Single passage | Must appear verbatim at the wording level. Normalization: Unicode NFC, case-folding, soft hyphens removed, punctuation and whitespace collapsed. Words and their order must match, aligned to word boundaries. |
| Shortening and edge truncation | Allowed (leading or trailing `…`) |
| Internal omissions (`[…]`, `[...]`, `(…)`, `…`, `...`, and the combine feature's ` … `) | Each passage verbatim, **in source order, non-overlapping**, at least 3 words per passage, at most 6 passages |
| Failure | 422 `quote_not_in_source` with `reason`: `not_in_source`, `segment_too_short`, `too_many_segments`, `empty` or `no_source` |
| Storage outage | 503 `quote_source_unavailable`, not a false "unfaithful" result |

**What is preserved:**
- Notes and fragment text stay editable; nothing is overwritten.
- All visual customization is unchanged.
- Previously edited fragments simply can't be rendered as quotes until their text is restored to the author's wording.

**Limit:** Stage 0 verifies wording and order. It **can't** judge whether an omission changes the meaning. That's the §5.10 design.

### 5.10 Technical design: controlled internal omissions `[…]` (not implemented)

1. **Source-range representation.**
   - Add `sourceSpans jsonb` to `fragments` and to the `shares` snapshot (additive migration, no backfill).
   - Format: `[{ start: { phrase, offset }, end: { phrase, offset } }, …]`.
   - The reader captures spans from `PhraseRenderer` phrase indices and DOM offsets at selection time. Combine concatenates the children's spans.
   - `null` means legacy, verified by text search as in Stage 0.
2. **Verification.**
   - The server rebuilds the quote **from the spans** against the sync map.
   - The quote part is never typed freely. The reader can only shorten a span or drop a middle range, which creates a new span boundary.
   - Rendering inserts `[…]` between spans.
3. **Meaning-integrity safeguards:**
   - at most 4 spans; minimum span length
   - maximum gap, e.g. the same chapter or N phrases
   - block or require confirmation when the omitted text contains a negation or qualifier from an ES/EN list (no, not, never, nunca, jamás, ni, sin, except, excepto, salvo, but, pero, only, solo)
   - a publish preview that shows the omitted text to the reader
   - a reader attestation for multi-span quotes
   - D06 per-title limits and the rights-holder removal path apply to every span
4. **Previously edited fragments:**
   - Never auto-overwritten.
   - At share time, offer "restore the author's wording": fuzzy-locate the best source passage and let the reader accept it.
   - Offer "keep my wording as a note": move the edited text to `note` only on the reader's explicit action.
5. **Migration:** one additive migration. Legacy rows keep working through the Stage 0 text check.
6. **Estimate [A]:** 4–6 engineer-days, part of Stage 3.

### 5.11 New security findings (pre-existing; not fixed, out of scope)

| # | Finding | Evidence | Risk | Recommendation |
|---|---|---|---|---|
| **S16** | Per-route throttles on auth endpoints use the key `default`, but the only configured throttler is named `global`. `@nestjs/throttler` 6.5 reads limits per throttler name, so those stricter limits (for example 10/min) are ignored and only the global 120/min applies. | `auth.controller.ts:65,215,225,235`; `app.module.ts:34-36`; `throttler.guard.js:67-81` | High (brute-force protection weaker than intended) | Separate fix: rename the keys to `global` or add a `default` throttler, with tests |
| **S17** | `trust proxy` isn't set. Behind Traefik, `req.ip` is probably the proxy's address, so every client shares one 120/min global bucket. That's a potential availability problem at scale, and the IP limits don't isolate abusers. | No `trust proxy` in `src/` [V]; the production effect is [A], not tested | Medium | Set `app.set('trust proxy', 1)` (or Traefik's hop count) in a separate infra-reviewed mission |

## 6. External references

None new. The platform references are in the SA-001 report §6.

## 7. Risks

| Level | Risk |
|---|---|
| High | **Legacy shares.** Rows created before this change are still public, including any made through S1 or with edited text. No retroactive audit or clean-up was done, because that's an irreversible production operation (§10). |
| Medium | **Rejections of genuine quotes.** The wording check may reject a genuine quote whose source text differs from what the reader rendered, for example books shown from a raw text file with unusual markup. The message tells the reader what to do, but only production data will show the real false-rejection rate. |
| Medium | **Code rollback.** Rolling back the code without the migration would make the old code serve revoked shares again: the old `getPublicShare` ignores `revokedAt`, and the images would be gone. Delete revoked rows before a code rollback (§8). |
| Low | **Dev configuration.** Mobile development against a LAN IP needs `SHARE_BG_ALLOWED_HOSTS` for preset backgrounds. Production is unaffected. |
| Low | **Rate-limit values** (20 renders and 10 publishes per 10 minutes per user) are engineering defaults. |

## 8. Recommendations, migration and rollback assessment

**Migration 068 (`1748300000068-AddShareLifecycle.ts`)**
- `up`:
  - `ADD COLUMN IF NOT EXISTS "revokedAt" timestamptz`
  - `"configHash" varchar(64)`, both nullable
  - index on `createdById`
  - partial unique index
- No backfill; existing rows are untouched.
- On PG16, adding nullable columns is metadata-only. The index builds lock writes on `shares` briefly; the table is small (0 rows locally; production count unknown [A]).
- `down` drops the indexes and columns, but **throws if any revoked share exists**.
- Tested on local Postgres 16 in a rolled-back transaction:
  - up and idempotent re-up
  - duplicate live share rejected (23505)
  - revoked row with the same hash allowed
  - legacy NULL-hash rows unaffected
  - down refused with revoked rows; down then succeeded after they were removed
  - re-up

  The local DB was left unchanged.
- **Production:** CD runs pending migrations automatically on merge to `main`, so merging this PR applies 068 in production. That needs PO authorization; check `gh run list` first.

**Irreversible runtime operations introduced**
- deleting card images on revoke, fragment deletion and account deletion
- hard-deleting share rows on account deletion

These are the authorized lifecycle (D07, D12), all reader-initiated.

**Configuration**
- No required environment changes.
- Optional: `SHARE_BG_ALLOWED_HOSTS` (API) and `BG_IMAGE_ALLOWED_HOSTS` (image-gen).

**Required next:** Product Architecture review; a PO decision on merge timing and on the §10 data questions.

**Optional:**
- the S16/S17 fix mission
- a revoke button in the UI (Stage 3; today a reader can revoke by deleting the fragment, or through the API)

## 9. Tests and verification performed

| Suite | Command | Result | New or updated coverage |
|---|---|---|---|
| API | `npx jest --coverage` | **75 suites, 1056 tests, all pass** (baseline 948). Overall statements 91.2%. `sharing/` 98.9%; `share-lifecycle` 100%; `quote-integrity` 100%; `books.service` 100%. | Cross-user sharing (S1), unauthorized text overrides (C1), revocation and idempotency, fragment-delete ordering, account-deletion clean-up and ordering, duplicate re-use and race, unsafe background URLs (13 cases), social-publish source validation (6 untrusted URLs, other user's or revoked share, storage read), eligibility (create plus public), DTO limits, rate limits (per user, 429, fail-open) |
| API types | `npx tsc --noEmit` | pass | — |
| API lint | `npx eslint` on changed `src` | 0 errors (the migration file is ignored by the repo's config) | — |
| image-gen | `python3 -m pytest` | **206 pass, 93.9%** | 17 new tests: data-URI types and size, 8 rejected URLs with no fetch, allow-list, download cap, no redirects, fallback render |
| Web | `npx jest` | **19 suites, 303 tests, all pass** | `shareErrorKey` mapping; EN/ES copy present; error code surfaced from `shareFragment` |
| Web types and lint | `tsc --noEmit`; `next lint` on changed files | pass; only pre-existing warnings | — |
| Mobile | `npx jest` | **24 suites, 187 tests, all pass** | Android link in message, iOS `url` without duplication, never the image URL, error mapping, ES copy |
| Mobile types | `tsc --noEmit` | pass | — |
| Migration | local PG16, rolled back | pass (see §8) | — |

**Limitations:**
- There's no render-test library on mobile; the share logic was extracted into pure functions and tested.
- No end-to-end run against the local Docker stack, because its containers mount the main checkout, not this branch.
- Quote verification hasn't been measured against production fragments.

## 10. Open questions and PO decisions

1. **Legacy shares.**
   - **Option A:** audit only. Read-only counts: shares whose creator isn't the fragment owner, and shares failing the quote check, using a script.
   - **Option B:** revoke the offending rows. This is irreversible and needs explicit authorization.

   Recommendation: A first.
2. **Orphan shares of accounts deleted before this change.** Delete them, or keep them? Irreversible. A read-only count is possible: `SELECT COUNT(*) FROM shares s WHERE s."createdById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s."createdById")`.
3. **Rate-limit values** (20/10 per 10 minutes): confirm or adjust.
4. **S16/S17:** authorize a separate throttling-fix mission?
5. **§5.10 omission design:** accept as the Stage 3 basis?
6. **Merge timing:** merging applies 068 and changes sharing behaviour in production.

## 11. Changes made

**API (`services/api`)**
- New:
  - `src/books/book-eligibility.ts`
  - `src/migrations/1748300000068-AddShareLifecycle.ts`
  - `src/sharing/{dto/share-fragment.dto.ts, quote-integrity.service.ts, share-background.ts, share-lifecycle.module.ts, share-lifecycle.service.ts, share-rate-limiter.ts}`
- Modified:
  - `src/books/books.service.ts`
  - `src/fragments/{fragments.module.ts, fragments.service.ts}`
  - `src/sharing/{share.entity.ts, sharing.controller.ts, sharing.module.ts, sharing.service.ts}`
  - `src/social/{social.controller.ts, social.module.ts}`
  - `src/storage/storage.service.ts`
  - `src/users/{users.module.ts, users.service.ts}`
- Tests:
  - new: `book-eligibility`, the `sharing/*` specs, the DTO spec
  - updated: `fragments.service`, `sharing.controller`, `sharing.service`, `social.controller`, `storage.service`, `users.service`

**image-gen**
- `templates/base.py`
- `tests/unit/templates/test_base.py`

**Web**
- `components/ShareModal.tsx`
- `lib/share-utils.ts`
- `lib/i18n/{en,es}.ts`: four `shareCard` error keys; the fragments tutorial "Edit before sharing" became "Shorten before sharing"
- `tests/unit/lib/share-utils.spec.ts`

**Mobile**
- `src/components/ShareSheet.tsx`
- `src/i18n/{en,es}.ts`: three `sharing` error keys
- `tests/unit/components/ShareSheet.spec.ts`

**Docs**
- the mission record
- this report

**Not changed:** Stripe, entitlements, subscriptions, the reader, the sync pipeline, infrastructure, production.

## 12. Next recommended action

1. Product Architecture reviews the Draft PR.
2. The PO decides §10, items 1–6.
3. **Don't merge or deploy until the PO explicitly authorizes it.** After any merge: run the deployment verification in `CLAUDE.md` and confirm migration 068 was applied.
