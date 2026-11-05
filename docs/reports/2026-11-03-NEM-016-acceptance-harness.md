# NEM-016 acceptance test harness

## 1. Mission and objective

Prepare a repeatable, safe harness for NEM-016 sharing-integrity acceptance (A1–A20 and supplemental cases), with fixture and account procedures, a coverage matrix, a report template and a manual checklist. Stop before any staging execution.

## 2. Date and status

2026-11-03. **Harness ready for review. Not run against staging or production.** Draft PR only.

## 3. Scope and exclusions

**In scope:** harness code, local validation, documentation.

**Not done, as instructed:** no staging or production execution; no staging database or storage change; no Traefik or Docker networking change; no merge or deploy; nothing on NEM-018; no application code change.

**Taken from the mission brief and not independently verified:** NEM-016 is deployed to staging, 067 and 068 are applied, infrastructure and isolation checks passed, staging has 84 books and no administrators. The deployed commit is not known here; the operator supplies it.

## 4. Executive summary

- The harness covers **29 tests and 64 checks**: 25 automated over HTTP, 19 from read-only SQL evidence, 7 for the operator on the host, 13 manual.
- Against the real candidate code on a disposable local stack, **all 44 automated checks passed**. Against the old baseline API, **13 of the 16 tests it ran failed**, so the harness does detect these defects. It didn't run A6, A8, A11 or A19 in that pass; those rely on the unit-test defects or on Run 1.
- Local validation found **three issues in the application** (§5.1), two of them in NEM-016's own paths: a stalled storage service hangs revocations, and deleting a book leaves its card images public.
- It also found **corrections to the acceptance plan** (§5.2). The most important: A11 as written (`pause`) can't produce its expected result, so it now uses `stop`.
- The verdict can't reach ACCEPTED without Product Owner input, because the A13 sequence can no longer be replayed.

## 5. Verified findings

**Labels:** facts below were observed in code or on the local stack unless marked otherwise. None were observed on staging.

### 5.1 Application findings (not fixed)

| # | Finding | Evidence | Level |
|---|---|---|---|
| F1 | **A stalled storage service hangs revocation.** The S3 client has no request timeout. With MinIO paused, `DELETE /shares/:id` hadn't responded after 180 s (the limit set in the test). The revocation does commit first, so the share returns 404 and the outbox row exists. Fragment and account deletion use the same `purgeImages` call, so the same wait is expected (inferred; not measured) | `storage.service.ts:23`; `share-lifecycle.service.ts` `revoke` and `purgeImages`; local run | Medium |
| F2 | **Deleting a book leaves its card images public.** The share page returns 404, but the image still returned 200 until the share was revoked. `shares` has no foreign key to `books`, and `books.service.ts` `remove` doesn't revoke. This is outside D07's listed triggers, but the effect is the same as the gap G9 closed | `books.service.ts:67`; migration 065; local run | Medium |
| F3 | **Analytics events aren't being written on a migrations-built schema.** The `Event` entity writes `userId`, `bookId`, `eventType`; migration 057 creates `user_id`, `book_id`, `event_type`; `synchronize` is off. Every emit logged `column "userId" of relation "events" does not exist`. Emits are caught, so user requests are unaffected. Present on `main` since `4e0705f`, so not caused by NEM-016. **Production is unverified.** The persona pipeline reads `events` | `events/event.entity.ts`; migration 057; local API logs | Medium; High for analytics if production matches |

Smaller observations:
- With `SMTP_HOST` empty, sends go to `127.0.0.1:1025` and fail, which is what makes staging safe (gate G4). The failure log includes the recipient address, which conflicts with the project's no-PII logging rule.
- `PATCH /users/me` lets a user set their own `userType`, including `author`. Author uploads still need an admin to publish, so this doesn't publish anything by itself. Code reading only.

### 5.2 Corrections to the acceptance plan

| Plan said | Actual | Handling |
|---|---|---|
| A11: `dcs pause storage`, expect `attempts ≥ 1` | Pause gives `attempts=0` and a hung request (F1). `stop` gives a 204 after about 15 s with `attempts=1`, and the real sweep then cleared the row, 218 s after resuming in this run | The procedure uses `stop` |
| A15: A creates 21 cards | The limit is per user in a fixed window, so A's earlier cards would use it up | Dedicated account; waits for a fresh window; a crossed window is NOT RUN, not FAIL |
| A9: read `shareCount` | `GET /books/:id` is behind `SubscriptionGuard`, and the fixture isn't free | Checked from database evidence |
| A2: `quoteProvenance` checked | Not exposed by any API | Checked from database evidence |
| Shares return 200 | The API returns **201** | The harness accepts both; no behaviour concern |
| A14b: only the page is checked | The image stays public (F2) | Clean-up revokes before deleting the book |
| A17: baseline before P1 | That moment has passed | Run baseline automated; deploy baseline needs the pre-deploy dump, or stays BLOCKED |
| A13: P4 sequence | Can't be replayed | See §5.3 |

### 5.3 Handling of the special considerations

- **A13:** A13.sequence stays BLOCKED unless evidence from the deploy exists, and that keeps the verdict INCOMPLETE. A13.schema is checked. New local test X7 closes the earlier limitation: the baseline API created **54 real shares** on the 068 schema. X7 can't produce ACCEPTED.
- **A11:** BLOCKED until `--approve A11`, and it does nothing until the operator names a phase. The harness has no access to Docker, so it can't interrupt storage itself.
- **Existing books:** the route allowlist makes writes to them impossible, and X6 compares a digest of their published flag, uploader and sync coverage before and after. One side effect remains and is flagged: A19 raises one real book's `shareCount` by 1, because that's what sharing does.

### 5.4 No administrator on staging

Publishing the fixture needs an administrator: author uploads wait for admin review. So the smallest change is a one-row grant on a synthetic account, removed straight after the upload. The harness prints the SQL, which aborts unless it changes exactly one `nem016-…@staging.invalid` row. It never runs it. X6.admin confirms no administrator remains.

### 5.5 Coverage

Full matrix: `infra/tests/nem-016-acceptance/COVERAGE.md`. Fully automated (HTTP and SQL evidence): A8, A8b, A10, A11, A14, A15, A19, X1–X6, though A11 and the SQL evidence still need an operator to act on the host. Needs a person or host check as well: A1–A7, A9, A12, A13, A14b, A17. Fully manual or operator: A16, A18, A20, X7.

## 6. External references

None needed. Tools tested: Node 20.20.2, Docker Compose, `pgvector/pgvector:pg16`, `redis:7-alpine`, `minio/minio:latest`.

## 7. Risks

| Level | Risk | Mitigation |
|---|---|---|
| **High** | A staging run writes to a public API on a host shared with production | Nothing runs without authorization; route and target allowlists; health check between tests; quiet window |
| **Medium** | A11 stops staging storage, and a stopped service is where DNS fall-through occurred before NEM-017 | Named approval; re-check isolation first |
| **Medium** | The temporary admin grant sits on a public API | One synthetic account, removed right after upload; X6.admin confirms |
| **Medium** | The authorization phrase can be typed by anyone with the repository | It's a speed bump only. Real control stays with the Product Owner and host access |
| **Low** | A19's `shareCount` +1 on a real book, and the fixture text object after book deletion, stay behind | Flagged; approval named; listed in the report |
| **Low** | Local results may not match staging timing or routing | Measurements labelled local; staging run still needed |

## 8. Recommendations

**Required before staging execution:** the decisions in §10.

**Recommended before PR #25 can merge (Product Owner to decide):**
- F1: add a request timeout to the S3 client, so a stalled store fails into the existing retry path.
- F2: revoke a book's shares when it's deleted.

**Separate from NEM-016:**
- F3: verify production with a read-only query, then decide on a corrective migration or entity mapping in its own mission.
- Remove addresses from the e-mail failure log.

## 9. Tests and verification performed

All local. **Nothing touched staging or production.** Image-gen ran with no route out, confirmed by a connection test.

| Check | Result |
|---|---|
| Unit tests (`node --test`): safety guards, status logic, evidence, 15 injected defects | **69 passed** |
| Local end-to-end script | **76 of 76 expected results held** |
| Run 1, candidate `aaf708e` API: automated checks (api and db) | **44 of 44 PASS** |
| Run 1, operator checks done locally: A1.log, A7.log, A18 | PASS |
| Run 1 report | 16 tests PASS, 0 FAIL, 13 NOT RUN (they wait on manual or staging-only checks); verdict INCOMPLETE, as it should be |
| Run 2, clean-up paths | With and without the admin grant; retained fixture keeps its uploader; no accounts, shares or outbox rows left |
| Run 3, negative control, baseline `9192c50` API | **13 tests FAIL; verdict REJECTED**, including A1, A3, A5, A7, A10, A12, A14, A15. A2's API check passed, as the old code accepts faithful quotes, and failed on evidence |
| Secrets scan of the log, state and reports | 0 tokens or passwords |
| Staging target without authorization | Refused, exit 3, no network call |
| Local leftovers | 0 containers, volumes or networks |

**Failures along the way, all in my harness:**
- First attempt: `minio/mc` couldn't be pulled, and my script hid the error and carried on. It now uses the MinIO image's `mc` and stops on any setup failure.
- Second attempt: A9 and X4 failed with 401 reading the book. My fake API hadn't modelled the guard, so unit tests missed it; it now does, and the check moved to database evidence. That run also still reported "0 wrong" because its summary didn't cover those checks, so the script now asserts every automated check.
- MinIO data was on tmpfs, which a `stop` would have erased, faking a passing 404. It's now on a volume.

**Limitations:**
- Web and mobile weren't in the stack, so 13 manual checks haven't run, including A16 and the protected reader test A20.
- No Traefik or TLS; storage ran without staging's routing.
- Local data is 2 seeded books and 1 pre-existing fragment, not staging's catalogue.
- Whether staging's seeded books have audio for A20 is unknown.
- Coverage percentage doesn't apply: this is a test tool outside the service test suites, and CI doesn't run it.

## 10. Open questions and Product Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| 1 | Authorize staging execution, naming the deployed commit? | Your call; a quiet window, operator present |
| 2 | Approve the one-row temporary admin grant and the fixture upload? | Approve; needed for all fixture tests |
| 3 | Approve by name: A11 (stop storage), A12, A15, A19; optionally A8b, A14b? | A11, A12, A15, A19 yes. Skip A8b and A14b unless wanted; both are optional |
| 4 | Is `stop` acceptable in place of the plan's `pause` for A11? | Yes; `pause` can't produce the expected result |
| 5 | A13: is the sequence gap acceptable, or does evidence from the deploy exist? | Accept if no evidence exists, citing X7 and the rehearsal |
| 6 | F1 and F2: fix before PR #25 merges? | Yes to both, within NEM-016's scope |
| 7 | F3: authorize a read-only production check? | Yes, as a separate item |
| 8 | Clean-up policy after the run? | Keep data until review, then run `cleanup` |
| 9 | Has the fixture already been uploaded to staging? | Please confirm. The brief says it exists, which I read as the file; the harness detects an upload and won't duplicate it |

## 11. Changes made

No application, infrastructure or production change. New files only:
- `infra/tests/nem-016-acceptance/` (harness, tests, local stack, README, `COVERAGE.md`, `REPORT-TEMPLATE.md`, `MANUAL-CHECKLIST.md`)
- this report

The `docs/reports/README.md` index isn't on this branch (it's on PR #23), so no index was updated.

**Protected systems:** the reader and Escucha Activa weren't touched. A20 remains the runtime check for them.

## 12. Next recommended action

The Product Owner reviews this report and decides §10. **Nothing runs on staging until then.**
