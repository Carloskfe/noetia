# NEM-016 corrective mission: F1 and F2

## 1. Mission and objective

Fix the two sharing-lifecycle defects found by the acceptance harness (PR #30): stalled storage hanging revocation (F1), and book deletion leaving card images public (F2). Update the harness to work with the records that already exist on staging.

## 2. Date and status

2026-11-03. **Corrections ready for review.** Draft PR only. Not merged, not deployed, not run against staging or production.

## 3. Scope and exclusions

**In scope:** the two corrections, regression tests, harness compatibility, documentation, local testing on disposable infrastructure.

**Not done, as instructed:** no staging or production execution; no change to staging data, accounts or storage; no merge or deploy; no Traefik, Docker networking or AutoGuildX change; nothing on NEM-018; nothing on F3.

**No schema migration, destructive operation or architecture change was needed**, so no stop condition was triggered.

## 4. Executive summary

- **F1 is fixed for all deletion paths.** With MinIO really paused, the pre-fix code hadn't responded after 30 s, the limit set in this test (over 180 s in the earlier measurement). With the fix, revocation, fragment deletion, account deletion and book deletion each returned 204 in about 5 s.
- **F2 is fixed.** Deleting a book now revokes its live shares and queues their images in the same transaction. Pre-fix, the images returned 200 after deletion; now they return 404, or are deleted by the sweep if storage is down.
- **Recovery works.** In both outage modes the real 10-minute sweep cleared every queued row and every affected image returned 404.
- **The fix is not on staging.** Staging runs `aaf708e`, so it still has both defects until a new deployment is authorized.
- **One related gap remains by choice.** Storage reads and uploads still have no timeout, so share creation and social publish can still hang on a stalled store (§7).

## 5. Verified findings

### 5.1 Root cause: F1

`StorageService` builds its S3 client with no request timeout (`services/api/src/storage/storage.service.ts`). A paused MinIO keeps accepting TCP connections but never answers, so the SDK waits indefinitely, and `connectionTimeout`-style limits wouldn't help.

`ShareLifecycleService.purgeImages` awaits each delete in sequence, and every deletion path awaits `purgeImages` before responding. The database transaction has already committed by then, which is why the share was gone while the request hung. The failure handler that records `attempts` never ran, because the call never failed. That's why the outbox showed `attempts=0`.

### 5.2 Root cause: F2

`BooksService.remove` only called `repo.remove(book)`. `shares` deliberately has no foreign key to `books` (migration 065), so nothing touched the shares. The page returned 404 only because `getPublicShare` checks book eligibility, which is why the defect looked smaller than it was. `images/` is public-read, so the images stayed reachable. `BooksController.remove` is the only book-deletion path in the API.

### 5.3 Corrections

| Area | Change | Why this shape |
|---|---|---|
| `StorageService.delete` | A 5 s deadline covering SDK retries; on expiry it rejects with `StorageTimeoutError` and aborts the request | Limited to deletion on purpose. A timeout on the shared client could break 500 MB uploads and reads |
| `purgeImages` | Stops at the first timeout, and after 15 s in total. Keys not reached keep their outbox rows | Without this, an account with 20 shares would wait 20 × 5 s |
| `retryPendingDeletions` | Same stop at a timeout; no time budget, since no request is waiting | Keeps existing sweep behaviour |
| `ShareLifecycleService.revokeForBook` | New; same pattern as `revokeForFragment` | Reuses the existing outbox |
| `BooksService.remove` | Revokes, queues and deletes in one transaction, then purges after commit | Same order as fragment and account deletion |
| `BooksModule` | Imports `ShareLifecycleModule` | That module was built for exactly this; no circular import |

Four source files, 79 lines added. **No reader, sync, audio, web, mobile or migration file changed.**

**Portability:** the fix commit `74b8cfb` applies cleanly to both the PR #25 branch and the deployed candidate, checked with a merge dry run. It hasn't been applied to either.

### 5.4 Harness compatibility

The fixture and administrator you listed are pinned in `lib/guard.mjs` and treated as read-only:

| Behaviour | Detail |
|---|---|
| Fixture | Verified by id, title, uploader and published state. Any mismatch stops the run with nothing changed. Never created |
| Book writes on staging | Refused in the client, whatever the options say, with no network call. A14b and X9 stay BLOCKED there |
| Administrator | Never created, and the harness refuses to log in as it. `admin-sql` refuses any target but `local` |
| Clean-up | Removes only the run's shares and `@staging.invalid` accounts |
| New checks | X6.admin compares the administrator set before and after; X6.protected confirms both records are unchanged |
| On `aaf708e` | X8 is BLOCKED, because it can't pass there and would stall storage for nothing |

**Facts taken from your brief, not verified by me:** the two record ids, the email and the deployed commit. The first harness step on staging checks the fixture; the administrator is checked by the baseline evidence.

## 6. External references

None needed.

## 7. Risks

| Level | Risk | Handling |
|---|---|---|
| **High** | Staging still has both defects, and production would get them if PR #25 merged without this fix | Carry the fix to PR #25 before merging; Product Owner decision |
| **Medium** | **Reads and uploads are still unbounded.** `quote-integrity.service.ts` `getText` (share creation) and `social.controller.ts` `getBuffer` (publish) can hang on a stalled store, from code reading; not measured. Not changed, because a timeout here needs a decision about large files and shared callers | Decision 3 |
| **Medium** | **Shares of books deleted before this fix keep public images.** This only covers future deletions. Finding and revoking old ones is a data change | Decision 4; the legacy-share audit lists them |
| **Low** | **A share created while its book is being deleted can stay live.** The request checks the book, renders, then saves; a delete in between isn't caught. The page returns 404, but the image stays public. Closing it needs a lock or foreign key, which goes beyond the design | Reported, not fixed |
| **Low** | During an outage each deletion takes about 5 s, up to about 20 s at worst | Bounded by design |
| **Low** | A delete that times out on a slow but healthy store is retried by the sweep, and deleting twice is safe | No data risk |
| **Low** | The sweep stops at a timeout, so a key that always timed out would hold up the rows behind it. The existing overdue error reports it | Monitor the log |
| **Low** | Book text and audio objects still aren't deleted with the book | Out of scope, as before |

## 8. Recommendations

**Required before PR #25 merges:** carry `74b8cfb` to the PR #25 branch, then verify on staging.

**Optional:** a separate decision on bounding reads, and on the legacy images (decisions 3 and 4).

## 9. Tests and verification performed

All local. **Nothing touched staging or production.** Image-gen ran with no route out, confirmed by a connection test.

### Stalled storage, real MinIO and the real AWS SDK

| Operation | Pre-fix `aaf708e`, paused | Fix, paused | Fix, stopped |
|---|---|---|---|
| Revoke a share | **No response in 30 s** (test limit) | 204 in 5019 ms | 204 in 5014 ms |
| Revoke again | not meaningful | 204 in 12 ms | 204 in 8 ms |
| Delete a fragment with 2 shares | **No response in 30 s** | 204 in 5025 ms | 204 in 5020 ms |
| Delete an account with 2 shares | **No response in 30 s** | 204 in 5032 ms | 204 in 5025 ms |
| Delete a book with 2 shares | 204 in 29 ms, because it ignored the shares (F2) | 204 in 5020 ms | 204 in 5013 ms |
| Outbox during the outage | not checked | 7 rows; first of each batch `attempts=1`, `StorageTimeoutError` | same |
| Outbox empty after storage returned | not checked | 181 s | 538 s |
| Affected images after recovery | not checked | all 404 | all 404 |
| API restarts; unhandled rejections | not checked | 0; 0 | 0; 0 |

The corrective script's expected results: **41 of 41 held**, exit 0.

### Book deletion, normal storage

| Check | Pre-fix | Fix |
|---|---|---|
| Book with 2 live shares and 1 revoked: pages and images after deletion | **The 2 live shares' images returned 200** | All 404 |
| Repeat deletion | not reached as a failure | 404, nothing changed |
| Book with no shares | not separately checked | 204 |
| Share on another book | not separately checked | Still live, image 200 |

### Automated suites

| Check | Result |
|---|---|
| API unit tests | **1162 passed, 78 suites** (1143 before; 19 added) |
| API `tsc --noEmit` | Pass |
| ESLint on the changed source files | No errors |
| Line coverage: `books.service`, `share-lifecycle.service`, `storage.service` | 100%, 98.5%, 94.3% |
| Harness unit tests | **87 passed** |
| Full matrix on the fix, automated checks outside X8 | **47 of 47 PASS**; 80 of 80 expected results held; verdict INCOMPLETE, since manual checks are pending |
| Negative control on baseline `9192c50` | 13 tests FAIL; verdict REJECTED, as it should be |
| Tokens or passwords in logs and reports | 0 |

### Required test list

| Required | Where |
|---|---|
| Normal storage operation | Matrix run, X9 |
| Storage unavailable | Fix, stopped |
| Stalled, connection open | Fix, paused |
| Repeated revocation | X8.repeat, unit test |
| Recovery and eventual deletion | X8.recovered, X8.drained |
| Book with multiple shares; without shares; repeated deletion | X9 |
| Storage failure during book deletion; cleanup after recovery | X8.book, X8.recovered |
| No regression to reader behaviour | A17.run, X6.books, A19's sync-map read, no reader file changed. **The manual reader test A20 hasn't run** |

### Failures along the way, all in my test code

- A refactor indented a Python snippet, so the no-route check couldn't execute. The script flagged it; I stopped and fixed it before relying on any run.
- A script teardown removed the admin grant before clean-up, leaving a fixture behind. The harness refused to create a duplicate, as designed.
- Four evidence checks failed on the first matrix run because they read a snapshot taken after A14b, which now correctly revokes everything. Those checks now read the snapshot from just before A14b, with a regression test. That run isn't counted.

### Limitations

- No Traefik or TLS, and no web app. On staging, the proxy's own timeouts could shape what the client sees.
- Local data is small: 2 seeded books and 1 existing fragment.
- `docker pause` models one kind of stall, and others, such as a slow disk, weren't tested.
- The batch stop and the 15 s budget are proven by unit tests. The local run only had batches of 2.
- Web, mobile and manual checks haven't run. CI doesn't run on this PR.

## 10. Open questions and Product Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| 1 | Carry `74b8cfb` to PR #25 and rebuild the staging candidate? | Yes. Otherwise a merge ships both defects |
| 2 | Authorize deploying the corrected candidate to staging, then X8 (pauses storage) by name? | Yes, in a quiet window, as a separate authorization |
| 3 | Bound storage reads too? They carry the same hang risk on share creation and publish | Yes, as a small follow-up that excludes uploads and reader paths |
| 4 | What about card images from books deleted before this fix? | Audit first (read-only), then decide |
| 5 | Approve a disposable staging book for X9? Without it the verdict stays INCOMPLETE, since the existing fixture must not be deleted | Yes, or accept the local evidence in writing |
| 6 | Are the limits right: 5 s per delete, 15 s per request? | Yes, unless staging shows otherwise |

The earlier decisions in `docs/reports/2026-11-03-NEM-016-acceptance-harness.md` §10 stay open, except that the grant and fixture questions (items 2 and 9) are now settled by your staging facts.

## 11. Changes made

Application:
- `services/api/src/storage/storage.service.ts`
- `services/api/src/sharing/share-lifecycle.service.ts`
- `services/api/src/books/books.service.ts`
- `services/api/src/books/books.module.ts`
- their three unit-test files

Harness and docs:
- `infra/tests/nem-016-acceptance/`: pinned records, X8, X9, `run-f1-f2.sh`, updated docs
- the NEM-016 mission record (Rev 6) and this report

No migration, new required variable, or dependency. **Protected systems:** the reader, Escucha Activa and the sync pipeline weren't edited.

## 12. Next recommended action

The Product Owner reviews this report and decides §10. **Nothing runs on staging until then.**
