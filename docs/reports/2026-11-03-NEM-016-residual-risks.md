# NEM-016 residual risks: R1, R2, R3

## 1. Mission and objective

Resolve the risks left after PR #31: a share created during book deletion could stay active (R1), storage reads and uploads could hang (R2), and card images from before the F2 correction may remain public (R3, analysis only).

## 2. Date and status

2026-11-03. **R1 and the NEM-016 part of R2 are ready for review. General uploads need your approval and weren't changed. R3 is read-only analysis.** Draft PR only. Not merged, not deployed, and not run against staging or production. Staging stays pinned to `aaf708e`, so it has none of these corrections.

## 3. Scope and exclusions

**In scope:** the corrections above, regression tests, an audit tool, documentation, and testing on disposable local infrastructure.

**Not done, as instructed:** no staging or production execution; no database change outside disposable local stacks; no merge or deploy; no Traefik, AutoGuildX or NEM-018 work. The staging administrator and fixture weren't touched, and no object was deleted outside the local stack.

**Stop conditions:** R1 needed no migration or architecture change. R2's general upload path did reach the stop condition, so §5.3 presents the design and it wasn't implemented.

## 4. Executive summary

- **R1 is fixed with row locks and no migration.** On PR #31's code, forced interleavings left active shares with public images. On the fix, all 9 scenarios held, and `pg_stat_activity` confirmed each side really waits for the other.
- **R2 is fixed on the share paths.** Against a really stalled MinIO, PR #31's quote read and render hadn't answered after 60 s, the limit set in this test. They now fail in 15.0 s and 8.1 s with the existing error responses, and publish fails in 10.0 s. Sockets are released.
- **General uploads still hang on a stalled store** (no response in 45 s, the test limit). That's the publishing path, so it's a design for you to approve.
- **R3: only part of the problem can be identified safely.** Images still linked to a share can be judged. Images with no share row can't, because they may be in public use, so the tool never proposes them for deletion.
- **No measurable cost on the normal path:** share p50 went from 43 to 44 ms and book deletion stayed at 9 ms, on small local samples.

## 5. Verified findings

### 5.1 R1 root cause

Share creation isn't one transaction, and it has no link to the book that the database enforces:

| Step | Share creation | Holds a lock? |
|---|---|---|
| 1 | `SharingController`: reads the fragment and book, checks eligibility | No |
| 2 | `createOrReuseShare`: checks the quote, checks reuse, consumes the rate limit | No |
| 3 | `render`: HTTP call to image-gen, which stores the card | No |
| 4 | `shareRepo.save`: inserts the share | Only the insert |

`shares.bookId` has no foreign key (migration 065), so nothing stops step 4 inserting a share for a book that's gone. `BooksService.remove` revokes the shares it can see, then deletes the book.

**The race:** a delete that commits between step 1 and step 4 never sees the new share, and step 4 then saves it as active. The window is at least the render time. The page returns 404 through the eligibility check, but the image stays public, which is the same harm as F2.

**A second defect found while tracing this:** when a save failed, the rendered card wasn't always cleaned up. A failure other than a duplicate left it public with no record, and a duplicate's cleanup was a single attempt that was never retried.

### 5.2 R1 correction

| Side | Lock | Effect |
|---|---|---|
| Share save | `FOR KEY SHARE` on the book row, in a short transaction around the insert | Doesn't block reads, other share saves or `shareCount` updates. Never held during a render |
| Book deletion | `FOR UPDATE` on the book row, before revoking | Conflicts with the above |

These two locks conflict, so there are only two outcomes, and both are safe:
- **The save commits first.** The delete waits, then revokes that share, because `revokeForBook` runs after the lock and sees it.
- **The delete commits first.** The save waits, then finds no book and returns 404.

The save also re-checks eligibility under the lock, using the same `isBookPubliclyEligible` rule. Authorization and the rule itself are unchanged.

Any card that doesn't become a share now goes through `ShareLifecycleService.discardImage`. It writes an outbox row, then tries the delete, so a storage failure leaves it to the sweep rather than leaving it public.

**`BooksService.remove` is the only book-deletion path in the application.** The "cull" tool only sets `isFree=false`.

### 5.3 R2 inventory

| Operation | Caller | Blocks a user request? | Before | Now |
|---|---|---|---|---|
| `presign` (reader text and audio) | `books.controller` | No network call | Fine | **Unchanged. The browser fetches directly, so the reader is out of the blast radius** |
| `delete` | Revoke, fragment, account, book | Yes | Bounded by F1 | Unchanged, 5 s |
| `getText` | `quote-integrity` (share, uncached) | Yes | **Unbounded** | **15 s**, existing 503 |
| `getBuffer` | `social.controller` (publish) | Yes | **Unbounded** | **10 s**, existing 502 |
| API `fetch` to image-gen | `sharing.service` (share) | Yes | **Unbounded** | **30 s**, 502 |
| `put_object` | image-gen (share) | Yes, through the above | **5 minutes per attempt**, up to 5 retries (minio-py default, read from its source) | **3 s connect, 8 s read**; a stalled read isn't retried. 5xx and connection retries and certificate handling are unchanged |
| `getText` | Whisper sync, diagnose, audit | No, batch | Unbounded | Unchanged; a slow batch is legitimate |
| `upload` | `POST /books`: text, audio up to 500 MB, cover | Yes, on publishing | **Unbounded on a stall** | **Unchanged. Design below** |
| Own S3 clients | Ingestion scripts | No, batch | Unbounded | Unchanged |

Deadlines are per call, not on the shared client, because a client-wide limit would apply to 500 MB uploads and batch reads. Existing errors are reused, and timed-out requests are aborted. A body that stalls after its headers is destroyed as well, which the socket probe confirms.

**Why those values:** a 200 MB read took 0.4 s locally against the 15 s limit. The API's 30 s render limit is above image-gen's time on a stalled store, so image-gen fails first. An unreachable store that times out every connection could take about 21 s, and with a slow background fetch that could pass 30 s, so the API could rarely give up first (calculated, not measured).

### 5.4 Proposed design for general uploads: not implemented, needs approval

**Why it isn't the 5 s treatment:** a 500 MB upload is legitimately slow, and a total deadline would break real authors on a loaded host.

| Limit | Proposal | Purpose |
|---|---|---|
| No-progress limit | Abort if no bytes move for **60 s** | Catches a stall at any file size |
| Overall limit | **120 s + 1 s per MB** (about 10 minutes for 500 MB) | Backstop for a very slow store |
| Scope | `POST /books` only; a new `upload` option, as for reads | Ingestion and batch tools unchanged |
| Failure | Existing error path, and the book isn't created | Already the order in the controller: the row comes after the upload |

**Effect on reader and publishing:** the reader isn't affected, because it doesn't use `upload`. Authors are: a failed upload would now error instead of hanging. A no-progress limit also needs SDK-level progress tracking, and I haven't tested that for reliability, so the design would need the same local proof.

**Observed today:** a stalled store left `POST /books` waiting past the 45 s test limit. With storage stopped it failed by itself with a 500 after 15 s.

### 5.5 R3 analysis

Full procedure: `docs/operations/nem-016-orphan-card-images.md`. Tool: `services/api/src/sharing/audit-orphan-images.ts`, which only lists objects and reads in a rolled-back read-only transaction. **It has no delete mode.**

| Class | Confidence | Dry-run plan |
|---|---|---|
| `book_deleted`: a live share whose book is gone (the F2 defect) | **Safely identifiable** | Revoke, then delete |
| `revoked_not_deleted`: all shares revoked, nothing queued | **Safely identifiable** | Delete |
| `in_use`, `queued` | Certain | Nothing |
| `live_book_ineligible`, `recent`, `unreferenced_before_shares`, `unreferenced` | **Ambiguous** | Nothing |

**Main false-positive risk:** an image with no share row could be a true orphan, or a card from before migration 065 whose URL is still in use. Nothing distinguishes them. The doc lists the others: restored databases, reset timestamps, and mixed environments.

**Not known:** how many such images exist on staging or production. Running this there needs your authorization.

## 6. External references

None needed. Tools tested: Node 20.20.2, `pgvector/pgvector:pg16`, `minio/minio:latest`, AWS SDK v3, minio-py 7.2.7.

## 7. Risks

| Level | Risk | Handling |
|---|---|---|
| **High** | None of this is on staging or PR #25 yet. A merge of #25 alone ships F1, F2, R1 and R2 | Carry the fixes to #25; decision 1 |
| **Medium** | General uploads still hang on a stalled store | Decision 2 |
| **Medium** | Old orphaned images stay public until someone acts | Decision 3 |
| **Medium** | R1's race can't be tested on staging, because forcing it needs locks and a render gate. Its evidence is local | Decision 5 |
| **Low** | A process crash between the render and the save leaves an unreferenced card. There's no outbox row yet at that point | Would need a write before each render. The audit reports it as ambiguous |
| **Low** | If the API gives up at 30 s while image-gen still finishes, that card stays unreferenced. It needs a slow background fetch and repeated connection timeouts together | Same |
| **Low** | A share save stuck on a database problem would hold the book lock, so a book delete would wait for it. Saves are short, and book deletion is admin-only | No `lock_timeout` added |
| **Low** | A refused share still used one of the reader's 20 cards per 10 minutes | Only during a race; left as is |
| **Low** | Direct SQL deleting a book bypasses the lock | Project rules already route changes through the application |

## 8. Recommendations

**Required before PR #25 merges:** carry these corrections with F1 and F2.

**Optional:** implement the upload design, and run the R3 audit, once you've decided on them.

## 9. Tests and verification performed

All local. **Nothing touched staging or production.** Image-gen ran with no route out, confirmed by a connection test.

### R1: forced interleavings on real Postgres

| Scenario | PR #31 code `a90b646` | The fix |
|---|---|---|
| Book deleted during the render | **201; active share survives; image 200** | 404; no row; image 404 |
| Save holds the book lock first | **Active share survives; image 200** (delete didn't wait) | Delete **confirmed blocked**, then revokes it; image 404 |
| Delete holds the book lock first | **201; active share survives; image 200** | Save **confirmed blocked**, then 404; no row; image 404 |
| 5 concurrent shares during a delete | **All 5 active; images 200** | All 5 refused; no rows; images 404 |
| Two simultaneous deletes | **204, 204** | 204, 404; no share survives |
| Storage stalled during the race | Not run | Refused in 5010 ms; outbox `attempts=1`, `StorageTimeoutError`; the sweep deleted the image |
| Database failure saving a share (injected trigger) | Not run | 500; no row; image 404; outbox clear; the next share works |
| Database failure deleting a book (injected trigger) | Not run | 500; book and share unchanged; image intact; a retry succeeds |
| 18 unsynchronized rounds | **Active shares survived in several rounds** (one earlier run passed) | Held: 17 saved first and revoked, 1 refused |

**About the stress test:** its detection is probabilistic. It passed on the broken code in one run and caught it in others, and most rounds save before the delete. The fix's stress result is a sanity check, and the forced interleavings are the proof.

### R2: real MinIO

| Operation | PR #31, paused | Fix, paused | Fix, stopped |
|---|---|---|---|
| Share, uncached book (quote read) | **No response in 60 s** (test limit) | 503 in 15010 ms | 503 in 15012 ms |
| Share, cached book (render) | **No response in 60 s** | 502 in 8066 ms | 502 in 6063 ms |
| Social publish (card read) | Not run: on old code a resumed request could reach LinkedIn | 502 in 10045 ms | 502 in 10046 ms |
| Sharing after storage returns | 201 | 201 | 201 |
| Rows saved during the outage | Not checked | 0 | 0 |

**Publish after recovery wasn't run end to end**, because a success would call LinkedIn. Reading a card after recovery is covered by the same storage path and the unit tests.

**Socket probe, real AWS SDK against a server that goes quiet (2 s test deadline):**

| Mode | Error | Timed out at | Socket closed at |
|---|---|---|---|
| Accepts, never answers | `StorageTimeoutError` | 2001 ms | 2002 ms |
| Sends headers, stalls mid-body | `StorageTimeoutError` | 2008 ms | 2008 ms |

### Performance with normal storage (local, small samples)

| Path | PR #31 p50 / p95 | Fix p50 / p95 | Samples |
|---|---|---|---|
| Create a share | 43 / 66 ms | 44 / 59 ms | 15 each |
| Delete a book | 9 / 10 ms | 9 / 9 ms | 8 each |

| Size | Upload | Bounded read |
|---|---|---|
| 1 MB | 51 ms | 11 ms |
| 10 MB | 63 ms | 29 ms |
| 50 MB | 272 ms | 113 ms |
| 200 MB | 1075 ms | 396 ms |

These measure no real contention and no production disk, so treat them as rough. A difference of 1 ms is within noise, and this doesn't prove zero cost under load.

### R3: on seeded objects

Every seeded class was classified as expected, covers were ignored, and the dry-run plan held exactly the 2 safe objects and 1 share. The object listing, share rows and outbox were identical before and after.

### Automated suites and regression

| Check | Result |
|---|---|
| API unit tests | **1209 passed, 80 suites** |
| API `tsc --noEmit`; ESLint on changed files | Pass; no errors |
| Line coverage: `books.service` 100%, `sharing.service` 100%, `orphan-image-audit` 100%, `share-lifecycle.service` 98.6%, `storage.service` 95.2% | Above the 80% rule |
| Line coverage: `audit-orphan-images` | **51%, below the 80% rule.** Its `main()` connects to real services; the real run in §9 exercises it, and unit tests cover the rest |
| image-gen `pytest` | **270 passed**, 94.64% coverage |
| Harness unit tests | **89 passed** |
| `run-r1-r2.sh` (R1, R2, R3) | **35 of 35** expected results held, on PR #31 code and the fix |
| `run-local.sh`: full matrix on the fix, including quotation integrity, image generation and A19's sync-map read | **80 of 80**; 47 of 47 automated checks PASS |
| Negative control on `9192c50`, in that run | 13 tests FAIL; verdict REJECTED, as it should be |
| `run-f1-f2.sh`: F1 and F2 still hold | **41 of 41**; each deletion 204 in about 5 s |
| API restarts; unhandled rejections | 0; 0 |
| Tokens or passwords in logs and reports | 0 |
| Harness compatibility | The pinned staging fixture and administrator stay read-only. X10, X11, X12 are local-only and can't affect the staging verdict |

### Failures along the way, all in my test code

- Three orchestration bugs stopped earlier attempts: R3 ran on an image without the tool, Pass 1 reused accounts it had just deleted, and fragment keys collided across processes, which hid the R2 baseline. None of those runs count. The script now also fails if a pass measures nothing.
- `pkill` killed my own shell twice, because the pattern matched my own command.

**One defect in my fix, caught before commit:** my first image-gen client replaced minio-py's default without keeping its certificate settings, and lowered its retries from 5 to 3. I found this by reading the library's source while checking a claim for this report. Local tests hadn't caught it, because the local stack uses plain HTTP. It now differs from the default only in its timeouts and in not retrying a stalled read, a new test compares the two directly, and every run was repeated on the corrected code.

### Limitations

- No Traefik or TLS, and no web app. Staging timings may differ.
- Reader behaviour is covered by no reader file changing, API reads, and data digests. **The manual reader test A20 hasn't run.**
- CI doesn't run on this PR, because it targets a non-`main` branch.
- R3 ran on seeded data with its minimum age set to 0, because new objects can't be aged, so the age rule was only proven by unit tests.

## 10. Open questions and Product Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| 1 | Carry F1, F2, R1 and R2 to PR #25, and rebuild the staging candidate? | Yes |
| 2 | Implement the upload design in §5.4? | Yes, as a separate change, with the same local proof |
| 3 | Authorize the read-only R3 audit on staging, then production? | Yes, and decide on clean-up from its numbers |
| 4 | Clean-up policy for the ambiguous classes? | Keep them. Extra storage costs far less than a broken public link |
| 5 | Accept local evidence for R1, since it can't be forced on staging? | Yes |
| 6 | Are the limits right: 15 s, 10 s, 30 s, and image-gen's 3 s and 8 s? | Yes, unless staging shows otherwise |

The earlier decisions in the PR #31 report stay open, except that R2's reads and the old-image question are now covered here.

## 11. Changes made

| File | Why |
|---|---|
| `services/api/src/sharing/sharing.service.ts` | R1: save under the book lock; withdraw unsaved cards. R2: render limit |
| `services/api/src/books/books.service.ts` | R1: lock the book before revoking |
| `services/api/src/sharing/share-lifecycle.service.ts` | R1: `discardImage` through the outbox |
| `services/api/src/storage/storage.service.ts` | R2: optional per-call read deadline; shared deadline helper |
| `services/api/src/sharing/quote-integrity.service.ts` | R2: bound the source read |
| `services/api/src/social/social.controller.ts` | R2: bound the card read |
| `services/image-gen/storage.py` | R2: connect and read limits on card uploads |
| `services/api/src/sharing/card-key.ts` | R3: lets the audit share the key rule without loading Nest |
| `services/api/src/sharing/orphan-image-audit.ts`, `audit-orphan-images.ts` | R3: read-only audit |
| Unit tests for each | Regression coverage |
| `infra/tests/nem-016-acceptance/` | X10, X11, X12, `run-r1-r2.sh`, render gate, socket probe |
| `docs/operations/nem-016-orphan-card-images.md`, this report, the mission record | Documentation |

**No migration, dependency or required variable.** No reader, sync, audio, web or mobile file changed. The staging administrator and fixture stay pinned and read-only.

## 12. Next recommended action

The Product Owner reviews this report and decides §10. **Nothing runs on staging until then.**
