# SP-1-I1: push-token isolation and account-deletion cleanup (completion report)

**Scope:** SP-1-I1 only, authorized by the PO under the PA-accepted design in PR #84 (`824992d8`), with final decisions:

| Decision | Status |
|---|---|
| SP-D1 (single owner) | Approved |
| SP-D3 (advisory lock, no migration) | Approved |
| SP-D12 (ticket pruning) | Deferred |
| SP-D13 (best-effort cleanup with send-time guard) | Approved |

**Not done:**
- merge, deployment, SQL against a live environment, or data cleanup;
- mobile change, build or OTA;
- Phase 2 or 3;
- B2 work;
- expenses.

**MANDATORY STOP FOR INDEPENDENT PA REVIEW.**

---

## 1. Verified baseline

| Item | Value |
|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01`, matches the PO reference. **Branch base.** |
| PR #84 | `824992d80fd56f6cd137f493eb5b48e4c6d3447e`, matches |
| Governance read | `CLAUDE.md`, `docs/engineering-missions/README.md`, `REVIEW-CHECKLIST.md`, SP-1 report §§5–7, 12–15 |
| Open-PR conflict scan (all 40 open PRs) | **No open PR touches** `services/api/src/push/**`, `users/users.service.ts`, or their tests. Eleven NEM-019…024 branches touch `app.module.ts`, which SP-1-I1 does **not** modify. |

- **Branch:** `fix/sp-1-i1-push-token-isolation`.
- **Draft PR:** targets `main`.

## 2. Draft PR and HEAD

The PR URL and final HEAD SHA are recorded in the PR description and the completion comment, because this file is part of the commit it would describe.

## 3. Changed files

| File | Change |
|---|---|
| `services/api/src/push/push.service.ts` | `registerToken`: transactional single-owner reassignment. `sendToUser`: deleted-user guard. `sendExpo`: redacted log. New export `PUSH_TOKEN_LOCK_NAMESPACE`. |
| `services/api/src/push/push.controller.ts` | Validated DTO; route throttle; `req` typed (removes one pre-existing `any`) |
| `services/api/src/push/dto/register-push-token.dto.ts` | **New**: `RegisterPushTokenDto`, token pattern, max length, platform enum |
| `services/api/src/push/push-register.throttle.ts` | **New**: throttle values and the per-session tracker |
| `services/api/src/users/users.service.ts` | `deleteAccount`: best-effort `push_tokens` cleanup after the user-row delete; `Logger` |
| `services/api/tests/unit/push/push.golden-master.spec.ts` + snapshot | **New** (golden-master commit) |
| `services/api/tests/unit/users/users.delete-order.golden-master.spec.ts` + snapshot | **New** (golden-master commit). The post-implementation comparison excludes only the added step. |
| `services/api/tests/unit/push/push.single-owner.spec.ts` | **New**: ownership, concurrency, rollback, deleted-account, logging |
| `services/api/tests/unit/push/push.controller.spec.ts` | **New**: controller contract; throttle metadata and enforcement |
| `services/api/tests/unit/push/dto/register-push-token.dto.spec.ts` | **New**: validation |
| `services/api/tests/unit/users/users.delete-push-cleanup.spec.ts` | **New**: cleanup ordering and failure behaviour |
| `services/api/tests/unit/push/push.service.spec.ts` | `registerToken` test adapted to the transaction (same upsert assertion) |
| `docs/reports/sp-1-i1-20261123/README.md`, `concurrency-check.ts` | This report and the evidence script (not a test; not run by jest) |

**Not changed:**
- `GiftsService`, subscriptions, clubs, any caller;
- `push-token.entity.ts`, `push.module.ts`, `app.module.ts`, `main.ts`;
- migrations, schema, dependencies, mobile, web, email templates.

## 4. Golden master captured before implementation

Commit **`a3073f6`** contains tests only, on unchanged code. It holds 18 snapshots:

**Push payloads (16):** the exact Expo request (URL, method, headers, and JSON body `{to, title, body, data, sound}`) for:
- all five types × `es`/`en`, with `gift_claimed` for n = 1 and 3;
- a stored `null` language (Spanish fallback);
- a stored `fr-CA` (Spanish, unchanged);
- two devices (one request per token, in order);
- a call with no vars.

**Deletion order (2):** the exact ordered sequence of the six SQL statements, `repo.delete` and `sendFarewell`, for a user with and without an email.

**After implementation:** `git diff a3073f6 HEAD -- '*.snap'` is **empty**, and every run uses `--ci`, so no snapshot can be written.

## 5. Transaction and advisory-lock implementation

```ts
await this.tokenRepo.manager.transaction(async (em) => {
  await em.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [PUSH_TOKEN_LOCK_NAMESPACE /* 53010001 */, token]);
  const removed = await em.delete(PushToken, { token, userId: Not(userId) });   // other accounts only
  await em.getRepository(PushToken).upsert({ userId, token, platform }, { conflictPaths: ['userId', 'token'] });
  return removed.affected ?? 0;
});
```

- **Authentication:** unchanged (`JwtAuthGuard`; the strategy re-loads the user, so a deleted account can't register).
- **Lock:**
  - The two-key form keeps this lock in its own namespace, separate from any other advisory lock (none exist in `src/` today).
  - Transaction-scoped, so it is released at commit or rollback.
  - One lock per transaction, so no deadlock.
  - A `hashtext` collision only serializes two unrelated tokens.
- **Upsert:** the same conflict target as before (`(userId, token)`), so a same-user re-registration updates `platform` exactly as it did.
- **Multi-device:** the delete filter is `token = T AND userId <> me`, so a user's other tokens are never touched.
- **Schema:** no migration, index, table or dependency. It uses the existing `UQ_push_tokens_user_token` constraint.

## 6. Ownership and concurrency verification

**Unit** (`push.single-owner.spec.ts`, in-memory fake of the transaction, lock and delete/upsert surface):

| # | Scenario | Result |
|---|---|---|
| 1 | A registers T: lock query issued with namespace and token | ✅ |
| 2 | B registers T: B is the sole owner, with one redacted log line | ✅ |
| 3 | B again: idempotent, no eviction | ✅ |
| 4 | A's other token survives | ✅ |
| 5 | 40 rounds of three concurrent registrations: always one owner | ✅ |
| 5b | **Control:** same interleaving without the lock gives multiple owners, which proves the test can detect the race | ✅ |
| 6 | Upsert failure inside the transaction: rolled back, A still owns T, error propagates | ✅ |

**Real PostgreSQL 16** (one-off, disposable container from the already-present `postgres:16-alpine` image on `127.0.0.1:55432`; no image pull, no cost):
- The container was **removed after the run**.
- Staging, production and the local dev DB were **not** touched.
- Script: [`concurrency-check.ts`](concurrency-check.ts).
- Table created with the **exact DDL of migration `1714000000045`**.
- The real `PushService.registerToken` ran with a pool of 12 connections.

| Run | Rounds | Distinct owners of T after each round |
|---|---|---|
| `PushService.registerToken` (with lock): A registers, then 5 accounts concurrently | 200 | **`{"1": 200}`**: always exactly one owner |
| Control: same transaction **without** the lock | 200 | `{"4": 1, "5": 199}`: the race is real under READ COMMITTED |
| Multi-device and idempotency | — | A keeps `ExpoPushToken[A-tablet]`; B sole owner of T after a duplicate registration |
| Rollback (forced `varchar(20)` violation after the delete) | — | Error `value too long for type character varying(20)`; **B still owns T** (delete rolled back) |

This also confirms that `pg_advisory_xact_lock($1, hashtext($2))` resolves to the `(int4, int4)` overload with node-postgres parameters on Postgres 16.

## 7. DTO and throttle verification

**DTO** (`RegisterPushTokenDto`, validated by the app's global `ValidationPipe({ whitelist: true, transform: true })`):

- **Token rules:** `@IsString`, `@MaxLength(255)` (the column width) and `@Matches(/^Expo(?:nent)?PushToken\[[^\]\s]+\]$/)`.
- **Platform rules:** optional; `@IsIn(['ios', 'android', 'web', 'unknown'])`. The controller keeps `dto.platform ?? 'unknown'`.
- **Accepted** (tests):
  - the mobile test fixture `ExponentPushToken[test]`;
  - typical and mixed-charset `ExponentPushToken[…]`;
  - `ExpoPushToken[…]`;
  - exactly 255 characters;
  - all four platforms;
  - platform omitted;
  - unknown extra fields are stripped, as with every DTO in the app.
- **Rejected with 400** (13 cases):
  - missing, empty or non-string token;
  - a non-Expo or raw APNs/FCM-style string;
  - empty brackets, whitespace, trailing characters or a wrong-case prefix;
  - 256 characters;
  - platform `windows`, `IOS`, or over 20 characters.

**Compatibility with installed clients:**
- The mobile app obtains its token only from `Notifications.getExpoPushTokenAsync()` (`usePushNotifications.ts:21`) and sends `platform: Platform.OS`. For the configured targets (iOS and Android; `app.config.js`) that is `ios` or `android`, and the pattern accepts Expo's documented shapes.
- **Limitation:** compatibility with tokens stored in production can't be confirmed without data. The SP-1 report's query **Q4** (read-only, PO-run) is required. **Per I1-3, I make no deployment recommendation until Q4 shows every stored token matches the pattern.**

**Throttle:** `@Throttle({ global: { limit: 10, ttl: 60_000, getTracker: pushRegisterTracker } })`.

- **Why the key is `global`:** `ThrottlerGuard` v6.5 reads overrides only under the **names of configured throttlers**, and the app configures a single throttler named `global` (`app.module.ts:34-36`). An override keyed `default` would be ignored (see §13 F-X1).
- **Why per bearer session:** until `TRUSTED_PROXY_CIDRS` is set, the client address is the proxy's, so an IP-keyed route limit would be one bucket shared by **all** users and could block legitimate registrations.
  - The tracker uses a SHA-256 hash of the bearer string, which is never stored or logged.
  - It falls back to the client address when there is no bearer; those requests are rejected by `JwtAuthGuard` anyway.
  - A forged bearer only gets its own bucket and still fails authentication.
- **Design note for PA:** per-session tracking refines the PA-accepted "route-level `@Throttle`" so it doesn't regress installed clients. The installed library supports it directly (`getTracker` option); no new code path or dependency.
- **Tests:**
  - metadata present under `global` and absent under `default`;
  - the **real `ThrottlerGuard`**, configured as in the app, allows 10 requests per session per minute and rejects the 11th with `ThrottlerException` (429);
  - two sessions behind the same proxy IP get independent buckets;
  - the tracker never returns the raw bearer.

## 8. Deleted-account send-prevention evidence

`sendToUser` now returns before any submission when `userRepo.findOneBy({ id })` returns nothing. For existing users, the language source and the payload are unchanged (golden master).

| Test | Result |
|---|---|
| Orphaned `(deleted-A, T)` row; `sendToUser('deleted-A', 'gift_claimed')` | **0** `fetch` calls |
| **Gift scenario** with the real `GiftsService.claimGift`: gift bought by `deleted-buyer`, buyer deleted, claimed later | Resolves `{tokenCount: 3}`. Three ledger entries saved. Gift updated to `claimed` by the claimer. **0** `fetch` calls. `GiftsService` not modified. |
| After B takes over T, `sendToUser(A)` | 0 submissions; `sendToUser(B)` submits once to T |
| Existing user | One submission per token, payload byte-identical to the golden master |

## 9. Account-deletion cleanup ordering

```text
1–6  DELETE user_books / token_ledger / user_cause_preferences / courtesy_token_quotas / subscriptions / waitlist_entries   (unchanged)
7    repo.delete(userId)                                                                                                     (unchanged)
7a   DELETE FROM "push_tokens" WHERE "userId" = $1   — NEW, best-effort, try/catch, no identifiers in the warning
8    sendFarewell (best-effort)                                                                                              (unchanged)
```

| Test | Result |
|---|---|
| Golden master: steps 1–7 and 8, with 7a filtered out, equal the pre-implementation snapshot | ✅ byte-identical |
| 7a appears exactly once, immediately after 7 and immediately before 8; also for users without an email | ✅ |
| 7a throws | Deletion resolves; farewell still sent; one warning: `account deletion: push-token cleanup failed (registrations left inert)` |
| Failure in step 2 (`token_ledger`) | Rejects with the same error as before; no user delete, no 7a, no email (unchanged behaviour) |
| Failure in step 7 | Rejects; no 7a, no email (unchanged) |

There is no new transaction and no change to the SQL, cascades, commerce tables or order.

## 10. Logging-redaction evidence

| Location | Before | After |
|---|---|---|
| `sendExpo` network failure | `Push failed to ExponentPushToken[…]: <message>` | `Push submission failed: <message>` |
| Reassignment (new) | — | `push.register: token reassigned; N previous registration(s) removed` |
| Deletion cleanup failure (new) | — | `account deletion: push-token cleanup failed (registrations left inert)` |

The test captures every `Logger` method and asserts that no line contains the token, `PushToken[`, a user ID or `@`. The throttle tracker hashes the bearer. No logging service, vendor or dependency was added.

## 11. Test results and coverage

All runs are local, with `jest --maxWorkers=2 --ci`. CI only runs on PRs into `main`, so this PR **will** run CI.

| Metric | Baseline `main` `8f2f294` | SP-1-I1 |
|---|---|---|
| API test suites | 75 passed | **81 passed** |
| API tests | 1,293 passed | **1,361 passed** (+68, 0 failing) |
| Snapshots | — | 18 passed (unchanged since `a3073f6`) |
| All files (statements / branches / functions / lines) | 90.58 / 69.14 / 87.56 / 91.83 | **90.72 / 70.09 / 87.59 / 91.97** |
| `push.service.ts` | 96.42 / 57.14 / 100 / 96 | **100 / 96 / 100 / 100** |
| `users.service.ts` | 100 / 80 / 100 / 100 | 100 / 80 / 100 / 100 |
| Global 80% branch gate | fails (69.14) | fails (70.09); **pre-existing**, improved |

Push and users suites: 94 tests, all passing.

## 12. Typecheck, lint and build

| Check | Baseline | SP-1-I1 |
|---|---|---|
| `tsc --noEmit` | pass | pass |
| `npm run lint` | 0 errors, 254 warnings | 0 errors, **253** warnings (one pre-existing `any` removed) |
| `eslint` on changed `src` files | clean | clean |
| `nest build` | — | pass |

## 13. Existing versus introduced failures

| Item | Status |
|---|---|
| API global branch coverage below 80% | **Pre-existing** (69.14 on `main`); improved to 70.09 |
| Lint warnings | Pre-existing; count reduced by 1 |
| **Introduced failures** | **None** |
| **F-X1 (pre-existing, found, not fixed)** | Every existing route-level override is written `@Throttle({ default: … })`: `auth.controller.ts:65, 215, 225, 235` and `waitlist.controller.ts:42`. The app's only throttler is named `global`, and `ThrottlerGuard` v6 reads `THROTTLER_LIMIT + <throttler name>`, so **these per-route limits are never applied**; only the global 120 a minute per client address applies. Outside SP-1-I1 scope; reported for a separate decision. |

## 14. Five push payloads unchanged

Confirmed. All 16 push golden-master snapshots (five types × es/en, plus fallbacks, multi-device and no-vars) are byte-identical to `a3073f6`. No copy or `data` change.

## 15. PR integration and conflict assessment

| PR | Overlap | Assessment |
|---|---|---|
| #60 (payments) | `gifts.service.ts` (callers) only; SP-1-I1 doesn't touch it | Compatible. #60 keeps `claimGift`'s push call, which the `PushService` guard covers. |
| #83 B2-A1, #82 B2 prep | None | Compatible. The farewell email is unchanged. |
| #84 SP-1 design | Docs | This PR implements its Phase 1 (minus SP-D12) |
| NEM-019…024 branches | `app.module.ts` | No conflict; not modified here |
| Future B2-B2 (club copy) | `push.service.ts` `buildContent` | Different function. B2-B2 should land after this PR (SP-1 report §9). |

## 16. Remaining SP-1 risks and deferred decisions

**Remaining risks** (SP-1 report §5.1):

- No proof of possession. A leaked token allows a self-healing eviction-DoS against that device, and Noetia-templated spam to it, which was already possible.
- The window between A's logout and the next login on the device (Phase 2: logout unregister, mobile OTA).
- At most one in-flight message during an account switch.
- Session-expiry revocation is not done.
- Historical orphan and multi-owner rows stay until organically reassigned. Orphans are **inert** (send guard).
- Stale tokens aren't pruned (SP-D12 deferred).
- Validation compatibility with production tokens is unverified until **Q4**.

**Deferred** (not implemented, per I1-7):

- **Phase 2 and 3:** Expo ticket parsing and pruning; logout unregister; session-expiry revocation; background jobs; historical orphan deletion; uniqueness, FK or index migrations.
- **Deletion completeness:** full deletion transaction (PCA-2); Redis credential cleanup (SP-D10); gift anonymization (PCA-4); public shares (SP-D6); club ownership (SP-D7); deletion-email copy (SP-D8).
- **Separate decision:** F-X1, the ineffective `default` throttle overrides.
- **Pre-commerce-activation items:** PCA-1 to PCA-7.

## 17. Data and financial behaviour

**Confirmed:**
- No data was modified anywhere: no SQL against staging, production or the local dev DB.
- The only database used was a disposable container, created and removed for §6.
- The only runtime data effects the code introduces are the approved token-registration operations (deleting other accounts' rows for the same token at registration time) and the departing user's `push_tokens` rows at deletion.
- Gift purchase, claim and fulfilment; ledger and courtesy tokens; subscriptions; Stripe; USD-only pricing; the 2.22% Causas share; Noetia+ and NoetiaX Coming Soon; library, reading progress, clubs, the reader and Escucha Activa; email templates; localization; NEM-025/026; and the French and payment gates are **untouched**.

---

**MANDATORY STOP AFTER IMPLEMENTATION FOR INDEPENDENT PA REVIEW.**

The Product Owner retains authority over integration, merge, deployment and any further work.
