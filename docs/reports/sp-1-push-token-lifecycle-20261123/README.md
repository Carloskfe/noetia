# SP-1: push-token lifecycle and account-deletion privacy (diagnostic and remediation design)

**Mode:** diagnostic and design only.

**Not done:**
- no change to application code, migrations or data;
- no SQL executed against any environment;
- no notification sent;
- no build.

**Recommendations are not approvals.** Implementation needs an independent PA review and a separate PO authorization (§14).

**Revision 2 (2026-11-23)** applies:
- PA follow-up F-SP1-1 (submission vs delivery), F-SP1-2 (single-owner threat model) and F-SP1-3 (deletion transaction boundary);
- the **PO scope clarification**: no users currently have active paid subscriptions or purchased tokens. The priority is minimal, cost-efficient push-notification privacy protection, and financial and commerce items are deferred to a pre-commerce-activation review (§15). See the change log in §16.

---

## 1. Verified repository baseline (revalidated 2026-11-23)

| Ref | Head | Note |
|---|---|---|
| `main` | `8f2f294` | **Analysis base** |
| PR #78 Checkpoint A | `81143790` | No diff vs `main` in `push/`, `users/users.service.ts`, `gifts/`, `auth/`, mobile `hooks/`, `auth/`, `navigation/`, `api/` |
| PR #82 B2 preparation | `0ad54f75` | §6.1 V-1…V-12, C-1…C-4 (PA-accepted) |
| PR #83 B2-A1 | `0f147359` | Email only; does not touch push, deletion or gifts |
| PR #60 payment lifecycle | `d8e61e24` | Rewrites `fulfillGift`. `claimGift`'s push call is unchanged in intent (§9). |
| PRs #66, #75, #80, #81 | `9c9e4903`, `cb953607`, `28aa6680`, `c4106a2b` | No push or deletion changes |

All line references are to `main` @ `8f2f294`.

**PO scope input (2026-11-23):** Noetia currently has **no users with active paid subscriptions or purchased tokens**.
- This lowers the urgency of commerce-related items.
- It does **not** mean commerce tables are empty. Gift, ledger and subscription rows may exist (for example promo or courtesy tokens, test data or past gifts).
- The design preserves all existing financial behaviour and data.

---

## 2. Lifecycle diagram

**Evidence levels** (F-SP1-1). Each step is marked:
- **[code]**: confirmed by reading the source.
- **[unobserved]**: the server discards the information.
- **[untested]**: needs a real device.

```mermaid
sequenceDiagram
    autonumber
    participant D as Device (one app install)
    participant M as Mobile app (JS)
    participant API as API (NestJS)
    participant DB as push_tokens
    participant X as Expo push service

    Note over D,M: Account A signs in
    M->>D: requestPermissionsAsync / getExpoPushTokenAsync (projectId 99e7…) [code]
    D-->>M: ExponentPushToken[T] [code: call exists; same T per install = untested]
    M->>API: POST /push/register {token:T} (JWT A), every MainNavigator mount [code]
    API->>DB: UPSERT (userId=A, token=T) ON CONFLICT (userId, token) [code]
    Note over M: A logs out → POST /auth/logout deletes refresh token only [code]
    Note over DB: (A,T) REMAINS [code]
    Note over D,M: Account B signs in on the same install
    M->>API: POST /push/register {token:T} (JWT B) [code]
    API->>DB: UPSERT (B,T) → rows (A,T) and (B,T) [code]
    Note over API: Event for A (e.g. gift_claimed, invite_accepted)
    API->>DB: SELECT tokens WHERE userId=A → T [code]
    API->>X: POST /push/send {to:T, title, body} — submission attempt [code]
    X-->>API: HTTP response + ticket ok/error [unobserved: response discarded]
    X--)D: delivery to device, if Expo accepted the ticket [untested]
    Note over D: lock-screen display depends on OS permission and settings [untested]
    Note over API: A deletes account (web DELETE /users/me)
    API->>DB: deleteAccount: no push_tokens delete, no FK → (A,T) REMAINS [code]
    Note over API: Old gift bought by A is claimed later
    API->>DB: SELECT tokens WHERE userId=A (user row gone) → T [code]
    API->>X: POST /push/send "¡Regalo reclamado!" — submission attempt [code]
    X-->>API: ticket ok/error [unobserved]
    X--)D: delivery and display [untested]
```

### 2.1 Delivery evidence levels (F-SP1-1)

| Level | Event | Status in this diagnostic |
|---|---|---|
| L1 | Server **selects** the token and **submits** a request to `https://exp.host/--/api/v2/push/send` | **Confirmed from code** for every scenario in §4.1 |
| L2 | Expo **accepts or rejects** the ticket (`status: ok \| error`, e.g. `DeviceNotRegistered`) | **Unobserved**: `sendExpo` never reads the response (F-10). Not known for any scenario. |
| L3 | Expo, APNs or FCM **deliver** to the device | **Untested.** Requires a real device. |
| L4 | Notification **shown** (banner or lock screen) | **Untested.** Also depends on OS notification permission and user settings. |

Nothing in this report claims L2, L3 or L4. "Push sent" in revision 1 meant **L1 submission** only.

---

## 3. Findings with code references

### 3.1 Token ownership and registration

| ID | Finding | Reference |
|---|---|---|
| F-1 | `push_tokens(id, userId uuid NOT NULL, token varchar(255), platform varchar(20), createdAt)`. **No foreign key on `userId`.** Unique `(userId, token)`. Index on `userId` only. **No index on `token` alone.** | migration `1714000000045-CreatePushTokens.ts:5-16`, `push/push-token.entity.ts` |
| F-2 | `POST /push/register` (`JwtAuthGuard`) passes the inline body type `{ token: string; platform?: string }`. It carries no class-validator metadata, so the global `ValidationPipe({whitelist:true})` validates nothing. There is no format, length or platform check; over-length input gives a DB error (500). Only the **global** throttle applies (120 requests a minute per client). | `push/push.controller.ts:9-17`, `main.ts:40`, `app.module.ts:34-36` |
| F-3 | `registerToken` upserts on `(userId, token)` and never inspects other users' rows for the same token. **One token can have any number of owners.** | `push/push.service.ts` `registerToken` |
| F-4 | JWT authentication loads the user on every request (401 if missing), and refresh re-checks the user. **A deleted account cannot register tokens.** | `auth/jwt.strategy.ts`, `auth/auth.controller.ts:91-110` |
| F-5 | Mobile registers on **every `MainNavigator` mount** if permission is granted. Errors are swallowed. **There is no unregister call anywhere.** | `mobile/src/hooks/usePushNotifications.ts:15-34`, `app.config.js` (`extra.eas.projectId`) |

### 3.2 Logout, session expiry and account switching

| ID | Finding | Reference |
|---|---|---|
| F-6 | Mobile `logout()`: `POST /auth/logout` (deletes the refresh token only), then `clearToken()`, then the login screen. **Push registration untouched.** | `mobile/src/auth/AuthContext.tsx:18-24`, `api/src/auth/auth.controller.ts:117-128` |
| F-7 | Session expiry: when refresh fails, the API client throws. There is no logout path. | `mobile/src/api/client.ts:20-70` |
| F-8 | Account switch: B's first mount registers `(B,T)`; `(A,T)` remains. | F-3 + F-5 + F-6 |

### 3.3 Submission to Expo

| ID | Finding | Reference |
|---|---|---|
| F-9 | `sendToUser(userId, …)` selects tokens by `userId`. It loads the user only for language and **submits even if the user row is missing**. | `push/push.service.ts` `sendToUser` |
| F-10 | `sendExpo` POSTs one message per token without an access token. **The response is discarded**, so L2 is unknown and nothing is pruned. On a network exception it logs `Push failed to ${to}`, which is the **full token**. | `push/push.service.ts` `sendExpo` |
| F-11 | Recipient sources: `gift_claimed` goes to `gift_cards.buyerUserId` (**can be a deleted account**). `invite_accepted` goes to `subscriptions.userId` (deleted with the account). Club pushes go to `club_members` (cascade-deleted). | `gifts.service.ts:160`, `subscriptions.service.ts:419`, `club-*.service.ts` |
| F-12 | `gift_cards.buyerUserId` has **no foreign key**. `claimGift` therefore **submits** (L1) `gift_claimed` to a deleted buyer's remaining tokens. | migration `…043`, `gifts.service.ts:128-163` |

### 3.4 Account deletion

| ID | Finding | Reference |
|---|---|---|
| F-13 | Sequence:<br>1. `DELETE user_books`<br>2. `DELETE token_ledger`<br>3. `DELETE user_cause_preferences`<br>4. `DELETE courtesy_token_quotas`<br>5. `DELETE subscriptions`<br>6. `DELETE waitlist_entries` (by email)<br>7. `repo.delete(userId)` (FK cascades fire here)<br>8. farewell email, best-effort with `.catch(() => {})` | `users/users.service.ts:54-76` |
| F-14 | **Not transactional.** Each statement auto-commits on the default manager. A failure in steps 1–7 throws (the controller returns 500) and leaves the earlier steps committed. | same |
| F-15 | Mobile has no account-deletion entry point (web only). Out of scope; flagged to the PO. | `web/components/DeleteAccountModal.tsx:25` |
| F-16 | No Stripe call during deletion. **Deferred** to the pre-commerce-activation review (§15). | `users.service.ts` |

Full per-table results are in §10.

---

## 4. Confirmed defects versus hypothetical risks

### 4.1 Confirmed from source (reproducible with unit tests)

| ID | Defect | Findings | In SP-1 Phase 1? |
|---|---|---|---|
| **D-1** | One device token can have several owners | F-1, F-3 | **Yes** (Option A) |
| **D-2** | Logout never revokes the registration | F-6 | Partly: A removes it at the next registration. Phase 2 (B) closes the gap. |
| **D-3** | Session expiry never revokes | F-7 | Partly (A); Phase 2 optional |
| **D-4** | Account deletion leaves `push_tokens` rows; no FK | F-1, F-13 | **Yes** (Option C-min) |
| **D-5** | Server **submits** (L1) a push for a deleted account when its old gift is claimed. L2–L4 unknown or untested. | F-9, F-12 | **Yes** (Option D) |
| **D-6** | `sendToUser` submits for non-existent users | F-9 | **Yes** (Option D) |
| **D-7** | Full token logged on network failure; ticket errors ignored | F-10 | Redaction: **Yes**. Pruning: optional (SP-D12). |
| **D-8** | Registration body unvalidated | F-2 | **Yes** |
| **D-9** | Account deletion not transactional | F-14 | **No.** Deferred (§5.3, §15). |
| **D-10** | Deletion leaves encrypted social OAuth tokens in Redis (until TTL, up to 60 days) | §10 | No. Deferred privacy item (SP-D10). |
| **D-11** | Deletion leaves public share records and pages | §10 | No. Deferred (SP-D6). |
| **D-12** | The ES/EN farewell claim "all your data … erased" is inaccurate | §10 | No copy change (SP-D8) |

### 4.2 Hypothetical or device-dependent

| ID | Risk | Depends on |
|---|---|---|
| **H-1** | A's notification is **delivered and shown** (L3, L4) to B on a shared device | The same Expo token for both sessions on one install (documented by Expo as per installation; **untested**), plus Expo acceptance |
| **H-2** | A logged-out device keeps receiving the account's notifications | Token validity, OS permission; **untested** |
| **H-3** | A deleted account's device receives the gift-claimed push | App installed, token valid, Expo acceptance; **untested** |
| **H-4** | Token misuse by someone holding another person's token (§5.1) | Obtaining the token |
| **H-5** | Rate of invalid tokens | Expo L2 responses, which are unobserved; production data (§7.3) |
| **H-6** | Stripe billing after deletion | Payments being activated. **Deferred** (§15). |
| **H-7** | Whether any real devices are registered | Production data (§7.3); released-build history (PO) |

**About the Expo token.** Expo push tokens are bearer-like: without Expo's optional enhanced push security, anyone holding a token can submit notifications to that device under the app's identity. That makes logging them (D-7) and accepting arbitrary values (D-8) more serious than the raw strings suggest.

---

## 5. Remediation options and trade-offs

| Option | What | Fixes | Trade-offs |
|---|---|---|---|
| **A**: server-side single owner | On `register(user, T)`, in one transaction: take an advisory lock for T, delete rows for T with `userId ≠ user`, upsert `(user, T)` | D-1; D-2 and D-3 once the next account registers | Threat model in §5.1. No migration. |
| **B**: logout revocation | Authenticated unregister of `(caller, T)`, called by mobile `logout()` | D-2 window | Mobile OTA (JS-only) needs separate authorization. Old versions never call it. **Phase 2.** |
| **C-min**: deletion cleanup (push only) | One additional `DELETE FROM "push_tokens" WHERE "userId" = $1`, placed per §5.3 | D-4 | Not atomic with the user delete. Option D covers the residue (§5.3). |
| **C-full**: transactional deletion | Wrap steps 1–7 in one transaction | D-9 | Changes the failure semantics of the whole deletion, which involves financial tables. **Deferred** (§15). |
| **D**: send-time protection | `sendToUser` returns before submission when the user row is missing (already loaded) | D-5, D-6 | About 3 lines. Defence in depth; also neutralizes legacy orphans and any C-min failure. |
| **E-lite**: ticket pruning | Read the Expo response; delete `(userId, T)` on `DeviceNotRegistered` | D-7 (stale tokens), H-5 | No extra calls or infrastructure. **Optional** (SP-D12). Not required for the privacy goal. |
| **Validation + redaction** | Class DTO for `/push/register`; never log a full token | D-8, D-7 (logging) | Must not reject real client tokens (Q4) |

### 5.1 Option A threat model (F-SP1-2)

**Token string vs proof of possession.**
- The server receives a token string over an authenticated request.
- It **cannot verify** that the requesting device actually holds that token. Expo offers no challenge API.
- The only proof-of-possession scheme would be to send a nonce push and have the app echo it back. That needs a mobile change and an extra send per registration, so it is **not proposed** (it adds a device round trip; no new infrastructure is permitted).
- Option A therefore trusts "last authenticated registrant of T owns T".

**Scenarios:**

| Scenario | Today | With A + validation | Assessment |
|---|---|---|---|
| **Legitimate switch** (A logs out, B logs in on the same install) | `(A,T)` and `(B,T)`; A's notifications keep going to the device | B's first launch evicts A; only `(B,T)` remains | **Intended behaviour** |
| **Legitimate multi-device** (A on phone and tablet) | Rows `(A,T1)`, `(A,T2)` | Unchanged; eviction is per token, not per user | Safe |
| **Reinstall or token rotation** | New T' added; old T stays until Expo rejects it (ignored) | New T' added. Old T stays unless E-lite prunes it (optional), but it belongs to the same user, so there is no cross-account exposure. | Acceptable |
| **Erroneous registration** (client bug sends a wrong or foreign token) | Adds a foreign owner silently | Could evict the real owner. Validation limits it to well-formed Expo tokens. | Low likelihood: the client only ever sends its own `getExpoPushTokenAsync()` result |
| **Malicious registration** (attacker with an account and victim's token T) | Attacker's notifications reach the victim's device. The victim keeps receiving their own. | Attacker **evicts** the victim, so the victim stops receiving Noetia pushes until the victim's app next mounts `MainNavigator` and re-registers (self-healing ping-pong). The attacker's own notifications reach the victim's device. **The attacker never receives the victim's notifications**: delivery goes to the device, not the account. | Confidentiality: not weakened. Availability: new eviction-DoS, self-healing. Integrity: spam limited to Noetia's own message templates, already possible today. |
| **How T could leak** | Logged on network failure (D-7); device compromise; Expo dashboard access | Redaction removes the log source. Tokens are not guessable (random identifier). | Residual sources are out of Noetia's control |
| **Registration race** (A and B register T concurrently, e.g. a rapid switch or two devices with the same restored backup) | Both rows inserted | `pg_advisory_xact_lock(hashtext(T))` serializes registrations of T. Each transaction deletes the other owners, then upserts. The last to commit is the sole owner. | Race-free for the same T. `hashtext` collisions only serialize unrelated tokens (harmless). One lock per transaction, so no deadlock. Released at commit or rollback. |
| **Race with send** | — | A send that read `(A,T)` just before eviction may still submit once to T | Bounded: one in-flight message at the moment of switching. Accepted. |
| **Validation limits** | None | Shape `^Expo(nent)?PushToken\[[^\]]+\]$`, ≤ 255 characters, platform enum | Proves **format, not ownership**. Prevents garbage and over-length 500s. Must be confirmed against stored values (Q4) before enforcing. |
| **Request flooding / eviction churn** | Global 120 requests a minute | Add a route-level `@Throttle` on `/push/register` (e.g. 10 a minute) using the **already-installed** `@nestjs/throttler`. Log an eviction counter with a redacted token hash. | No new dependency |
| **Installed clients** | Register on every mount | Same request contract. Ownership converges to the last account opened on each device. Malformed values (none expected) would get 400, which old clients swallow. | Backward compatible |

**Remaining risk after A + validation + redaction + route throttle:**
- No proof of possession.
- A leaked token allows self-healing eviction-DoS and Noetia-templated spam to that device. Spam was already possible.
- The logout-to-next-login window (until Phase 2).
- One in-flight message during a switch.

**Adequacy assessment:** adequate for the bounded remediation.
- It removes the confirmed cross-account exposure (D-1) for all installed versions.
- It does not weaken confidentiality.
- It adds no infrastructure.
- It closes the main token-leak source in Noetia's own logs.
- Proof of possession should be reconsidered only if notification content becomes sensitive. Revisit before B2-B2 adds club content.

### 5.2 Why not a DB-enforced single owner now

`UNIQUE(token)` plus `ON CONFLICT (token) DO UPDATE` is atomic without locks. But it needs a migration and a de-duplication of existing multi-owner rows (a data change), and it removes multi-owner history in one step. The advisory-lock approach reaches the same invariant organically, with no schema or data change. **Phase 3 (optional).**

### 5.3 Account-deletion boundary (F-SP1-3, revised for narrowed scope)

These are two **separate** proposals:

1. **In SP-1 Phase 1:** minimal push-token cleanup (C-min) plus send-time protection (D).
2. **Deferred:** full multi-table transactional deletion (C-full), as a pre-commerce-activation review item (§15).

**Placement analysis for C-min:**

| Placement | Effect on existing deletion | Failure behaviour | Verdict |
|---|---|---|---|
| (i) New statement **before** step 1 or anywhere in steps 1–6 | Adds a new failure point that could **abort the deletion** with a 500 before the user row is removed. It also changes the order relative to the financial statements. | Partial-deletion window grows | Rejected |
| (ii) Inside a new transaction around steps 1–7 | Changes atomicity of financial deletes (`token_ledger`, `subscriptions`) and cascades (clubs) | Changes semantics | Rejected; this is C-full (deferred) |
| **(iii) After step 7 (user row deleted), before step 8 (email), best-effort, errors caught and logged without user ID, email or token** | Steps 1–7 unchanged in order, statements and failure semantics. Cascades unchanged. Club content unchanged. Financial tables unchanged. The email still runs afterwards, unchanged and best-effort. | If the cleanup fails, deletion still succeeds and the orphan rows remain, but **Option D makes them inert** (no submission to non-existent users). Idempotent, so it can be retried by a later sweep (Phase 3). | **Recommended** |

**Implementation shape** (for the future mission; not implemented):
- Use the existing `this.dataSource.manager.query(…)` style already used in `deleteAccount`.
- This needs **no new module dependency**. `UsersModule` does not import `PushModule` today, and C-min doesn't need it to.

**Atomicity statement.** C-min does **not** give atomic removal of the user row and their push tokens. Atomicity isn't needed for the privacy goal, because:
- Option D prevents any submission to a missing user, whatever rows remain;
- a deleted account cannot re-register (F-4);
- the cleanup is idempotent.

**STOP:** if the PA or PO requires **guaranteed atomic** removal of push tokens together with the user row, that can't be achieved without wrapping the user delete, and therefore the deletion sequence, in a transaction. That is C-full, a larger deletion redesign touching financial tables and cascades. Under the narrowed scope it is **out of SP-1**, and the work must STOP for a separate decision.

---

## 6. Revised minimal remediation architecture

### Phase 1: SP-1-I1 (server only; no migration, data change, mobile release, dependency or infrastructure)

| # | Change | Defects closed |
|---|---|---|
| 1 | **Option A.** `registerToken` runs in one transaction: advisory lock on `hashtext(T)`, delete rows for T with another `userId`, upsert `(user, T)`. Eviction counted in a log line with a redacted token (prefix plus short hash). | D-1 |
| 2 | **Validation.** `RegisterPushTokenDto` (Expo token pattern, max 255; `platform` in `ios \| android \| web \| unknown`, default `unknown`), plus a route-level `@Throttle` (existing dependency) | D-8 |
| 3 | **Option D.** `sendToUser` returns before any submission when the user row doesn't exist | D-5, D-6 |
| 4 | **C-min.** After `repo.delete(userId)` in `deleteAccount`: `DELETE FROM "push_tokens" WHERE "userId" = $1`, best-effort, caught, logged without identifiers; farewell email unchanged afterwards | D-4 |
| 5 | **Redaction.** `sendExpo` never logs a full token (prefix plus hash only) | D-7 (logging) |
| 6 | *(Optional, SP-D12)* **E-lite.** Parse the Expo response; delete `(userId, T)` on `DeviceNotRegistered`; redacted logging | D-7 (stale tokens) |

### Phase 1 boundaries: will **not** change

- Push payloads, titles, bodies and `data` for all 5 types (B2-B territory).
- Callers (`gifts`, `subscriptions`, `clubs`).
- `claimGift` semantics: the gift is still claimed and tokens are still credited when the buyer is deleted; only the push is skipped.
- Deletion steps 1–7, their order and failure semantics; cascades; club content; financial tables; the farewell email (text, order, best-effort).
- Schema, indexes, existing rows; mobile code; the web; Redis; Stripe; gift and ledger records.

### Later phases (not authorized)

- **Phase 2:** Option B, logout unregister. Mobile OTA, JS-only.
- **Phase 3:** optional migrations (FK cascade, `UNIQUE(token)`, token index) and a one-time orphan cleanup, after the §7.3 counts.

---

## 7. Tests required before any remediation can be accepted

### 7.1 Unit tests (API, jest; repositories, query runner and `fetch` mocked; no network, DB or sends)

**Golden master first:** before any change, capture the exact Expo request bodies (`to`, `title`, `body`, `data`, `sound`) for P-1 to P-5 in ES and EN. They must be byte-identical after Phase 1.

| # | Scenario | Expected after Phase 1 | Today |
|---|---|---|---|
| 1 | A registers T | One row `(A,T)`; runs in a transaction with an advisory lock on T | Row, no transaction |
| 2 | B registers the same T | `(A,T)` deleted and `(B,T)` upserted in the same transaction; one redacted eviction log line | Both rows (**fails**) |
| 3 | A logs out (Phase 1: no server call) | Unchanged until 2. Documented residual (H-2). | Same |
| 4 | After 2, `sendToUser(A)` | No submission to T. `sendToUser(B)` submits once to T. | Submits to T for A (**fails**) |
| 5 | `deleteAccount(A)` | Steps 1–7 issued **in the same order with the same statements** as today (asserted). Then `DELETE push_tokens WHERE userId=A`. Then the farewell email. | No push delete (**fails**) |
| 5b | C-min statement throws | `deleteAccount` resolves (no 500); farewell still sent; error logged without user ID, email or token | n/a |
| 5c | Step 1–7 failure | Behaviour **identical to today** (asserted): the error propagates and no push delete runs | baseline |
| 6 | Old gift of deleted A claimed | Gift claimed and tokens credited (**unchanged**); no `fetch` | Submits (**fails**) |
| 7 | Legacy orphan `(A,T)` present, A missing | No `fetch` (Option D) | Submits (**fails**) |
| 8 | Network failure in `sendExpo` | Swallowed; log contains neither the full token nor `ExponentPushToken[` followed by its value | Full token logged (**fails**) |
| 8b | *(if E-lite)* `DeviceNotRegistered` ticket | `(userId,T)` deleted; other errors logged redacted; no retry | Ignored |
| 9 | Concurrent `registerToken(A,T)` and `registerToken(B,T)` | Both take the same advisory lock key. Delete and upsert happen inside each transaction. With interleaved mocks the final state has one owner. | n/a |
| 9b | *(optional)* Real-Postgres concurrency on a **disposable local dev DB** (docker compose; never staging or production) | Exactly one row for T after parallel transactions | — |
| 10 | Existing types | P-1 to P-5 Expo bodies match the golden master | baseline |
| 11 | Validation | Malformed token, over 255 characters, unknown platform: 400 and no DB write. Valid `ExponentPushToken[…]` and `ExpoPushToken[…]` accepted. Missing platform becomes `unknown`. | 500 or stored (**fails**) |
| 12 | Throttle | Route limit metadata present on `/push/register` | n/a |
| 13 | Multi-device | `(A,T1)` survives `register(A,T2)` | Same |
| 14 | No identifiers in new logs | Captured logger output contains no user ID, email or full token | n/a |

**Coverage:** the modified services (`push.service.ts`, `users.service.ts`) keep or raise their coverage. No threshold change.

### 7.2 Device tests (manual; separate authorization; staging and test accounts only)

These are the only way to verify L2–L4:

1. Two accounts on one install (H-1).
2. Logout window (H-2).
3. Deleted-account gift claim (H-3).
4. Older app version behaviour.

None may run under this mission.

### 7.3 Read-only SQL diagnostic plan

**Not executed.** The PO runs it when authorized. Aggregates only; it never selects token values or email addresses.

```sql
BEGIN TRANSACTION READ ONLY;
-- Q1 orphaned push registrations (user deleted)
SELECT count(*) AS orphan_tokens FROM push_tokens pt
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pt."userId");
-- Q2 tokens with more than one owner, and the size distribution
SELECT owners, count(*) AS tokens FROM (
  SELECT token, count(DISTINCT "userId") AS owners FROM push_tokens GROUP BY token) t
 WHERE owners > 1 GROUP BY owners ORDER BY owners;
-- Q3 registrations per user
SELECT n AS tokens_per_user, count(*) AS users FROM (
  SELECT "userId", count(*) AS n FROM push_tokens GROUP BY "userId") t GROUP BY n ORDER BY n;
-- Q4 token shape and platform mix (gate for the validation pattern)
SELECT platform, (token ~ '^Expo(nent)?PushToken\[[^]]+\]$') AS well_formed, count(*)
  FROM push_tokens GROUP BY 1, 2 ORDER BY 1, 2;
-- Q5 age profile
SELECT date_trunc('month', "createdAt") AS month, count(*) FROM push_tokens GROUP BY 1 ORDER BY 1;
-- Q6 gifts whose buyer no longer exists (could trigger D-5); counts only
SELECT g.status, (g."expiresAt" > now()) AS claimable, count(*)
  FROM gift_cards g
 WHERE g."buyerUserId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = g."buyerUserId")
 GROUP BY 1, 2;
ROLLBACK;
```

Q7 (other deletion residue: shares, upload codes, events) moves to the deferred review (§15). It isn't needed for Phase 1.

---

## 8. Database impact and migration assessment

| Change | Migration? | Data change? | Phase |
|---|---|---|---|
| Option A (advisory lock + transaction) | No | Deletes another owner's row **only when T is next registered** (organic) | 1 |
| C-min | No | Deletes only the departing user's push rows | 1 |
| Option D, redaction, validation, throttle | No | None | 1 |
| E-lite (optional) | No | Deletes rows Expo reports as `DeviceNotRegistered` | 1 (optional) |
| Index on `push_tokens(token)` | Yes | No | 3 |
| FK `push_tokens.userId → users ON DELETE CASCADE` | Yes | Needs Q1 orphans removed first | 3 |
| `UNIQUE(token)` | Yes | Needs Q2 de-duplication | 3 |
| One-time orphan cleanup | Data | Deletes Q1 rows | 3 (PO decision) |

**Phase 1 performance:** the token-lookup delete in A is a sequential scan of `push_tokens` (no token index). Expected to be negligible at current scale (Q3 and Q5 confirm). An index is Phase 3 if needed.

---

## 9. Backward-compatibility analysis

- **Installed apps:** the request contract is unchanged for valid tokens, and Phase 1 is server-only. Old clients converge to a single owner on their next launch. Malformed values (none expected; check Q4 first) get 400, which old clients swallow.
- **Logout (Phase 2):** additive endpoint; old clients don't call it.
- **Notification payloads:** byte-identical (golden master, test 10). **SP-1 Phase 1 should precede B2-B2's club copy.**
- **PR #60:** no file overlap with Phase 1 (`push.service.ts`, `push.controller.ts`, a new DTO, `users.service.ts`). #60 doesn't change `claimGift`'s push call, and Option D lives in `PushService`.
- **PR #83 (B2-A1):** no overlap; farewell email unchanged.
- **Web:** no change.

---

## 10. Account-deletion and retention findings

Classes are proposals only:

| Class | Meaning |
|---|---|
| **Delete** | Must be deleted |
| **Retain** | Legitimate retention |
| **Anonymize** | Separate from identity |
| **Unintended** | Retained by accident |
| **Over-delete** | Deletes other people's data |

**Every financial row is preserved by SP-1. Commerce items are deferred to §15.**

| Data | Today on deletion | Proposed class | SP-1 Phase 1 |
|---|---|---|---|
| `users` row | Deleted | Delete | Unchanged |
| `reading_progress`, `fragments`, `reading_stats`, `user_personas`, `user_books`, `user_cause_preferences` | Deleted | Delete | Unchanged |
| `token_ledger`, `courtesy_token_quotas`, `subscriptions` (+ invites) | Deleted locally; Stripe not touched | Retention question | **Unchanged; deferred (§15)** |
| `push_tokens` | **Retained, no FK** | Unintended → Delete | **C-min + D** |
| `gift_cards` (buyer and recipient identities, emails) | Retained | Retain transaction, anonymize identity (proposal) | **Unchanged; deferred (§15)** |
| `subscription_invites.invitedEmail` from others' plans | Retained (48 h expiry) | Minor | Unchanged |
| `shares` (quote copy, public `/s/<id>`, PNG in public bucket) | Retained and public | Decision (SP-D6) | Unchanged; deferred privacy item |
| User-uploaded backgrounds (public bucket) | Retained | Decision | Unchanged; deferred |
| `events` (`user_id` → SET NULL; no text in payload) | Pseudonymized | Acceptable | Unchanged |
| `books.uploadedById` | Set NULL | **Retain** (readers' permanent ownership) | Unchanged |
| `upload_codes.createdById`, `usedBy` | Retained | Decision | Unchanged |
| Clubs owned by the user, and `club_books`, `club_polls`, `club_sessions` by creator (CASCADE) | **Over-delete** of shared club content | Decision (SP-D7) | Unchanged |
| Redis `social:tokens:<id>:*` | Retained until TTL (≤ 60 days) | Unintended → Delete | Unchanged; deferred privacy item (SP-D10) |
| Redis `refresh:<id>:*` | Until TTL (30 days), unusable | Harmless | Unchanged |
| Stripe customer and subscription | Not touched | Decision | **Deferred (§15)** |

### Comparison with the ES/EN deletion email

The email (E-4) claims that fragments, library and preferences are erased: *"All your data … has been erased"*.

| Claim | Accurate today? |
|---|---|
| Fragments | Rows yes. Shared copies and pages no (D-11). |
| Library | Yes |
| Preferences | Yes |
| "All your data" | **No**: push tokens (fixed by Phase 1), gift records, Redis OAuth tokens, shares, backgrounds, upload codes and the Stripe customer remain |

**No copy is rewritten.** Even after Phase 1 the claim stays inaccurate (D-10, D-11, gift records). Wording is SP-D8 (legal), and French E-4 stays release-blocked.

---

## 11. Estimated effort and operational costs

| Package | Effort |
|---|---|
| **Phase 1** (A, validation and throttle, D, C-min, redaction, tests 1–14, golden master) | **≈ 1.5–2 days** |
| E-lite (optional) | + ≈ 0.5 day |
| Phase 2 (B, mobile OTA) | ≈ 1 day + authorization |
| Phase 3 (migrations, orphan cleanup) | ≈ 1–1.5 days + snapshot + staging |
| Deferred deletion and commerce items (§15) | Sized at review time |

**Operational cost:** none.
- Expo push is free.
- No new infrastructure, dependency or vendor; `@nestjs/throttler` is already installed.

---

## 12. Outstanding PO decisions

None of these is approved.

| ID | Decision | Recommendation | Needed for |
|---|---|---|---|
| **SP-D1** | Token ownership: single owner (last authenticated registrant wins) vs multiple (today) | Single owner, with the §5.1 residual risk accepted | **Phase 1** |
| **SP-D3** | No migration in Phase 1 (advisory lock instead of `UNIQUE(token)`) | No migration now | **Phase 1** |
| **SP-D12** | Include E-lite pruning in Phase 1? | Optional. Include only if the PO wants stale-token hygiene now; not required for privacy. | **Phase 1** |
| **SP-D13** | Accept C-min's non-atomic best-effort cleanup with Option D as the guarantee (vs STOP for C-full) | Accept | **Phase 1** |
| SP-D2 | Logout revocation (Phase 2, OTA) | After Phase 1 | Phase 2 |
| SP-D4 | One-time orphan cleanup | After Q1 counts | Phase 3 |
| SP-D6 | Shares and public pages after deletion | Decision | Deferred |
| SP-D7 | Club over-deletion | Decision | Deferred |
| SP-D8 | Deletion-email wording (legal) | After deletion decisions | Deferred |
| SP-D9 | Mobile OTA for Phase 2 | — | Phase 2 |
| SP-D10 | Redis third-party token cleanup | Delete (deferred privacy item) | Deferred |
| SP-D11 | In-app account deletion on mobile | Flag for store compliance | Out of SP-1 |
| ~~SP-D5~~ | Gift-record retention and anonymization | **Moved to §15** (pre-commerce-activation) | Deferred |

---

## 13. Explicit STOP conditions (for SP-1-I1 implementation)

STOP and report if any of the following happens:

- atomic removal of push tokens together with the user row is required; that is C-full, a deletion redesign (§5.3);
- any change to deletion steps 1–7, their order, failure semantics, cascades, club content, financial tables or the farewell email becomes necessary;
- Option A can't be made race-free without a schema change;
- the validation pattern would reject token shapes present in stored data (Q4) or sent by real clients;
- push payloads or copy would change (B2-B);
- any migration, data cleanup, mobile change, new dependency or infrastructure becomes necessary;
- tests would need real Expo sends, staging or production data;
- any gift, ledger, subscription or Stripe behaviour would change.

---

## 14. Proposed bounded implementation mission

**SP-1-I1: push-token isolation and deletion cleanup (server only).**

- **Scope:** §6 Phase 1 items 1–5. Item 6 only if SP-D12 approves it.
- **Prerequisites:** PA acceptance of this revision; PO decisions SP-D1, SP-D3, SP-D12 and SP-D13. Ideally the PO also runs the Q4 result (validation gate) before merge.
- **Tests:** §7.1 tests 1–14, with the push golden master captured first.
- **Out of scope:** Phase 2 and 3, everything in §15, D-9 to D-12, push copy (B2-B), email copy.
- **Deliverable:** Draft PR targeting `main` (not NEM-025-stacked), with test evidence.
- **STOP** for PA review after implementation. No merge or deploy without separate authorization.

---

## 15. Pre-commerce-activation review items (deferred from SP-1)

Per the PO scope clarification:
- these are **not** SP-1 requirements;
- all existing financial behaviour and data are preserved;
- table contents are **not** assumed empty.

They must be reviewed **before payments or purchased tokens are activated**.

| ID | Item | Why it matters at activation |
|---|---|---|
| PCA-1 | Stripe customer and subscription handling on account deletion (F-16, H-6) | A deleted user could keep being billed |
| PCA-2 | Transactional multi-table account deletion (C-full, D-9) | Partial deletion across financial tables |
| PCA-3 | `token_ledger` and courtesy quota retention vs deletion | Accounting and token-expiry obligations |
| PCA-4 | Gift-record retention and anonymization by role and status (former SP-D5) | Unclaimed gifts must stay claimable; identities may need anonymizing |
| PCA-5 | Financial-record retention policy (legal) | Retention periods; deletion-email wording |
| PCA-6 | Gift fulfilment and claim interactions with PR #60's exactly-once changes | Consistency once payments are live |
| PCA-7 | Other residue sizing (former Q7: shares, upload codes, events) | Input to the deletion-completeness decisions |

**Non-financial deferred privacy items** (separate decisions, not PCA): D-10 Redis social tokens (SP-D10), D-11 shares (SP-D6), club over-deletion (SP-D7), deletion-email wording (SP-D8).

---

## 16. Change log

| Rev | Change |
|---|---|
| 1 (`d673913`) | Initial diagnostic |
| 2 | **F-SP1-1:** diagram and text separate L1 submission (confirmed) from L2 Expo ticket (unobserved) and L3/L4 delivery and display (untested); D-5 and H-1 to H-3 reworded. **F-SP1-2:** §5.1 Option A threat model; route throttle with the existing dependency; adequacy assessment. **F-SP1-3:** §5.3 separates C-min (Phase 1) from C-full (deferred), with placement analysis and a STOP. **PO scope:** commerce items moved to §15 (PCA-1 to PCA-7); Phase 1 narrowed (§6), with new decisions SP-D12 and SP-D13 and SP-D5 moved; Redis cleanup deferred; effort revised; tests revised (5b, 5c, 12–14). |

**Prohibitions observed:**
- no application code, migration, data or legal-copy change;
- no SQL executed;
- no notification sent;
- no build or OTA;
- no dependency or expense;
- no merge;
- no B2-A2 or B2-B work;
- French and payments untouched.

**STOP FOR INDEPENDENT PA RE-REVIEW.**
