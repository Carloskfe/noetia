# NEM-020-D6 — Live Payment Exposure Assessment

> **Status (Rev 5): CONTAINED — temporary control in place since 2026-11-08; D6 NOT CLOSED.** The PO executed Appendix A (Option A): `STRIPE_SECRET_KEY` is empty in `.env.production` and in the running API, only the API was recreated, and an unauthenticated gift checkout now returns `400 {"error":"payments_not_configured"}` [PO-VERIFIED, §7.6]. Plan, token-package, single-book, portal, cancel/resume/sync, and webhook paths are **fail-closed in code but not tested in production** (§7.7). Closure requires the durable payments control (option E) and the follow-ups in §16. Merge not granted.
>
> History: assessment accepted by Product Architecture (2026-11-08); Option A authorized (Rev 3); Appendix A security correction (Rev 4).
>
> **Assessment:** Read-only. Nothing was changed in code, databases, Stripe, configuration, or production.
>
> **Verdict: HIGH, bordering CRITICAL.** With the live Stripe key in production, `main` lets **any visitor, without logging in,** open a real Stripe Checkout page for a gift card whose price is built into the code. The public `/gift` page is served in production. A real charge then only requires someone to pay. Registered users can also reach plan and token checkout, whose stored price IDs are real-format (not placeholders); whether they are *live-mode* prices is unverified. **No payment has been found.**
>
> **Recommended containment (requires a separate PO decision):** clear `STRIPE_SECRET_KEY` in `.env.production` and recreate only the `api` container (§11, option A), then a durable payments kill-switch under its own mission (option E).

Evidence labels: **[PO-VERIFIED]** executed and observed in production by the Product Owner as operator (2026-11-08), not observed by Claude · **[CODE]** read from `origin/main` `6a5e5c0` · **[PROD-GET]** observed through a public, unauthenticated HTTP GET to production · **[PO]** attested by the Product Owner · **[UNVERIFIED]** · **[PROPOSED]** recommendation only.

---

## 1. Mission and objective

| | |
|---|---|
| **Identifier** | `NEM-020-D6` — separately assessed finding D6 of NEM-020 (protocol §3). NEM-020's scope is unchanged |
| **Type** | Read-only security and payment-exposure assessment |
| **Authorization** | Product Owner, *Noetia — D6 Payment Exposure Assessment* (2026-11-08). Publication: Product Owner, *GOV-001* §7 (2026-11-08) |
| **Objective** | Review every payment-initiation endpoint; classify access control; evaluate the live key; separate code-level exposure from production reachability and actual activity; propose and compare containment; recommend a minimal intervention with verification and rollback; list the evidence still needed |
| **Parent** | NEM-020 report, Rev 3 §7.5 D6, Draft PR [#37](https://github.com/Carloskfe/noetia/pull/37) |

## 2. Date and status

| | |
|---|---|
| **Dates** | Assessed 2026-11-08; delivered in chat 2026-11-08 (not marked pending publication — see §14); published 2026-11-08 under GOV-001 |
| **Lifecycle status** | **Contained (temporary control); review** — assessment accepted 2026-11-08; Option A executed and verified by the PO 2026-11-08. **Not completed**: see §17 |
| **Delivery state** | Report **not merged**. Production: environment change and API-only recreate performed by the PO (2026-11-08); no code deployed |
| **This report authorizes** | **Nothing.** Each follow-up in §16 needs its own PO decision |

### Review record

| Date | Reviewer role | Verdict | Conditions | Merge authorization |
|---|---|---|---|---|
| 2026-11-08 | Product Architecture (independent review), recorded under PO instruction *GOV-001 Review Closure and PR Reconciliation* | **Accepted** as a read-only payment-exposure assessment | Payment containment **not authorized** by that instruction; remains a separate, urgent PO decision | **NOT GRANTED** |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-08 | Assessment as delivered in chat on 2026-11-08, published without changing its findings; structured per the reporting protocol (commits `a4a2766`, `4558954`) |
| 2 | 2026-11-08 | Product Architecture verdict recorded (accepted; containment not authorized; merge not granted). Findings unchanged |
| 3 | 2026-11-08 | PO decision *NEM-020-D6 Production Payment Containment — APPROVED, Option A*. Remote preflight recorded (§7.5); procedure verified against the repository configuration and hardened (backup outside the repo, open-session stop gate, forced API-only recreate, fail-closed verification order); Appendix A operator procedure. **Containment not yet executed** |
| 4 | 2026-11-08 | PO *Security Correction to Appendix A* (documentation only). **C2 rewritten**: no `diff`; in-place write from the backup; line-by-line comparison inside awk printing only counts and line numbers; mode/owner check; automatic restore on any failure. Safety review of all of Appendix A: success flags gate C2 → C3 and V1 → V6; backup SHA-256 stored at C1 and verified before rollback; rollback works in a fresh session. Procedure tested on fake files (§13). **Containment not yet executed** |
| 5 | 2026-11-08 | **Containment executed and verified by the PO** (§7.6). Post-containment code review of every Stripe-dependent path (§7.7) and non-payment impact (§7.8); `.env.production` mode `644` recorded as a separate security follow-up (§7.9); risks, open items, and governance status updated (§9, §16, §17). Status: **Contained, not closed** |

## 3. Repository baseline

| Item | Value |
|---|---|
| Code examined | `origin/main` `6a5e5c0` (the CD-deployed branch). Production's exact running commit was **not** checked [UNVERIFIED] |
| This branch | `docs/nem-020-d6-live-payment-exposure`, created from `origin/main` `6a5e5c0` |
| Parent report | `docs/nem-020-pre-launch-billing-inventory` `0e5cbcb` (PR #37, Rev 3) |

## 4. Scope and exclusions

**In scope:** objectives 1–8 of the authorization (§1).

**Excluded and not done:** code changes; database reads or writes; Stripe API calls of any kind, including creating Checkout Sessions; **any POST to production**; configuration changes; deployments, restarts, credential rotation; changes to NEM-020's scope; implementing containment.

**Production contact:** limited to public, unauthenticated GET requests that any visitor's browser makes (`/gift`, `/pricing`, `/api/subscriptions/plans`, `/api/subscriptions/token-packages`). They do not reach Stripe. Price IDs returned were classified by format only and **not recorded**.

## 5. Executive summary

- **Gift checkout is public** [CODE]. `POST /api/gifts/checkout` has no authentication guard; only the global throttle (120 requests per minute per IP) applies. It creates a Stripe Checkout Session with an inline price ($9.99 / $24.99), so it works without any configured Stripe product.
- **It is reachable in production** [PROD-GET]. `https://noetia.app/gift` returns 200 and shows those prices; the page posts to that endpoint. Production uses a live key [PO].
- **Plan and token checkout** require login and a confirmed email [CODE]. All 6 plans and 4 token packages carry real-format price IDs [PROD-GET]; their mode is [UNVERIFIED].
- **Live Stripe Customer objects** are created for a user (with their email) *before* any price is validated, so even an invalid price leaves a live-mode write [CODE].
- **No payment, subscription, or collection** has occurred [PO]. No stop condition has triggered.
- **The key removal fails closed** [CODE]: every Stripe call goes through a guard that returns 400 `payments_not_configured` when no key is set. Only billing functions use the key.

## 6. Work completed

1. Located every Stripe call in `services/api/src` (`checkout.sessions.create`, `customers.create`, `billingPortal.sessions.create`, `subscriptions.*`, `webhooks.constructEvent`).
2. Read each controller route's guards, the global guards, the validation pipe, and the Traefik routing for `/api`.
3. Searched for feature flags, payment switches, and web middleware.
4. Traced web and mobile callers of each payment endpoint.
5. Traced how plan and token price IDs reach production (migration 041 and setup documentation).
6. Made four public GET requests to production (§4).
7. Compared five containment options and prepared verification and rollback steps for the recommended one.

## 7. Verified findings and evidence

### 7.1 Payment initiation endpoints

| Endpoint | Access control | Price source | Exposure |
|---|---|---|---|
| `POST /api/gifts/checkout` — `services/api/src/gifts/gifts.controller.ts:9-23`, `gifts.service.ts:51-90` | **None.** No `@UseGuards`; `req.user?.id` is always undefined, so `buyerUserId` is always null. Global `ThrottlerGuard` only (`app.module.ts:34-36,74`) | Inline `price_data`, `{1: 999, 3: 2499}` cents, USD (`gifts.service.ts:62-75`) | **Any visitor** [CODE + PROD-GET] |
| `POST /api/subscriptions/checkout` — `subscriptions.controller.ts:41-46`, `subscriptions.service.ts:207-220` | `JwtAuthGuard` + `EmailConfirmedGuard` | `plans.stripePriceId`; `mode: subscription`, 14-day trial | Any registered user with a confirmed email. Real-format IDs on all 6 plans [PROD-GET]; mode [UNVERIFIED] |
| `POST /api/subscriptions/tokens/purchase` — `subscriptions.controller.ts:48-53`, `subscriptions.service.ts:257-275` | JWT + confirmed email | `token_packages.stripePriceId`; the placeholder guard (`:260`) rejects only `price_token_*` | Real-format IDs on all 4 packages [PROD-GET]; mode [UNVERIFIED] |
| `POST /api/subscriptions/books/:bookId/purchase` — `subscriptions.controller.ts:83-88`, `subscriptions.service.ts:233-255` | JWT + confirmed email | Inline `books.priceCents` | API-only (no web or mobile caller found); only for published books with `priceCents > 0` (NEM-020 Q13) |
| `POST /api/subscriptions/portal` — `subscriptions.service.ts:223-231` | JWT + confirmed email | — | Not a payment; requires an existing `stripeCustomerId` |
| Customer creation — `subscriptions.service.ts:195-206` | Called by plan, token, and book checkout | — | **Live Customer with the user's email is created before price validation** |

### 7.2 Gating and wiring

- No feature flag or payment switch exists in `services/` [CODE].
- No Next.js middleware exists; `services/web/app/(billing)/layout.tsx` renders only a verification banner [CODE]. `/gift` is linked from `/pricing` (`pricing/page.tsx:221`).
- Traefik routes `noetia.app/api/*` to the API and strips `/api` (`docker-compose.server.yml:73-79`) [CODE].
- The gift DTO is an inline type, so the global `ValidationPipe` does not validate `recipientEmail`; only `tokenCount ∈ {1, 3}` is checked before Stripe is called [CODE].
- Gift fulfilment depends on the webhook `checkout.session.completed` (`webhooks.service.ts:56,85`). If the live webhook endpoint or secret is not configured, **a paid gift would never be delivered** [CODE; configuration UNVERIFIED].
- Price IDs: migration 041 sets them from environment variables by `name` (`Individual`, `Duo`, `Family`), which does not match the production plan names (`Individual Monthly`, `Dual Reader Monthly`, …). The production IDs were therefore set by another means [CODE + PROD-GET].

### 7.3 Effect of removing the key [CODE]

All Stripe use goes through `requireStripe()` (`gifts.service.ts:46-49`, `subscriptions.service.ts:190-193`), which throws `BadRequestException({ error: 'payments_not_configured' })` when the key is empty. The webhook returns 400 when the key or webhook secret is missing (`webhooks.controller.ts:37-39`). The API reads the key only via `env_file: .env.production`. No non-billing feature uses it.

### 7.4 Verified versus unverified

| Claim | Status |
|---|---|
| Unauthenticated gift checkout exists in code | **Verified** [CODE] |
| `/gift` page served in production | **Verified** [PROD-GET] |
| Production API route present | Inferred from the page and CD; **not** probed (no POST made) |
| Live key in production env file and running API | [PO] |
| Price IDs are live-mode | [UNVERIFIED] |
| Live webhook endpoint configured; webhook secret matches | [UNVERIFIED] |
| No payments, subscriptions, or collections | [PO] |
| No live Checkout Sessions or Customers yet | [UNVERIFIED] |
| Staging key mode (staging is also public) | [UNVERIFIED] |

### 7.5 Containment preflight (Rev 3)

**Authorization:** PO, *NEM-020-D6 Production Payment Containment* (2026-11-08), Option A: clear `STRIPE_SECRET_KEY`, recreate only the production `api` container, verify, prepare rollback. Not authorized: restoring or rotating keys, Stripe changes, payments or sessions, code, CI/CD, database writes, other deployments, staging changes, merges.

**Executor.** This machine holds only the restricted offsite-backup SSH key (`noetia-offsite-backup`). Using it for a production change would exceed its purpose, and creating access is not authorized. **The PO runs Appendix A as operator**; Claude verifies the returned output and records it in Rev 4.

| # | Preflight item (authorization §1) | Result | Evidence |
|---|---|---|---|
| 1 | Production environment, API, deployment configuration, health | **Partly verified remotely.** `GET /api/health`, `/api/books?limit=1`, `/api/subscriptions/plans`, `/`, `/gift` → 200 (2026-11-08). Server-side identity, container state, and running image: **operator** (A.2 P1, P3, P4) | [PROD-GET]; Appendix A |
| 2 | No deployment underway | **Verified remotely:** last `cd.yml` run `6a5e5c0`, 2026-10-31, completed/success; none queued or running. Re-check immediately before execution (A.1, A.2 P2) | `gh run list --workflow cd.yml` |
| 3 | Payment, subscription, pending-checkout activity | **Operator** (A.2 P6 database, P7 Stripe Dashboard). PO previously attested no payments, subscriptions, or collections | [PO] |
| 4 | Removing the key fails closed | **Verified** in code (§7.3). No startup config validation reads it; the only readers are `gifts.service.ts:41`, `subscriptions.service.ts:56`, `webhooks.controller.ts:27` | [CODE] |
| 5 | Targeted API-only recreation supported | **Verified** in configuration: `api` reads `env_file: .env.production`; its own healthcheck on `/health` with `start_interval: 5s`; startup command `node dist/main` runs **no migrations** (no `migrationsRun`; migrations run only in CD); `--no-deps --no-build --force-recreate` leaves db, cache, web, worker untouched | `docker-compose.server.yml` (`api:`), `services/api/Dockerfile:25` |
| 6 | Protected rollback | Prepared (A.4). Backup stored **outside the git checkout** (`/root/noetia-d6/`, mode 700/600), because `.gitignore` does **not** cover `.env.production` (only `.env`, `.env.local`, `.env.*.local`) | `.gitignore:13-15` |

**Procedure changes from §11.2 (Rev 1), after verification:**
- Backup moved from `/opt/noetia/.env.production.pre-d6` to `/root/noetia-d6/` (outside the repository; restricted permissions; refuses to overwrite).
- `--force-recreate --wait` added, so the recreate is deterministic and blocks until healthy.
- **New stop gate: open live Checkout Sessions.** An already-created session stays payable on Stripe's hosted page until it expires (up to 24 hours), even after the key is removed. Expiring sessions is a Stripe write and is not authorized, so any open session stops the procedure for a new decision.
- The payment-disabled check (gift POST) is allowed **only after** the running API is confirmed to hold no key, so it cannot reach Stripe.

**Discovery:** `.env.production` is not ignored by `.gitignore`, contrary to CLAUDE.md's guidance to "confirm with `.gitignore`". No commit happens on the server, but a `git add .` there would stage it. Not changed (outside this authorization).

### 7.6 Containment outcome (Rev 5) [PO-VERIFIED]

Executed by the Product Owner as operator on 2026-11-08 using Appendix A (Rev 4). Claude did not access production; the results below are the PO's verified report.

| Check | Result |
|---|---|
| Preflight | Database and Stripe Live Dashboard: no existing transactions before containment |
| C1 backup | Root-only backup created and verified |
| C2 key cleared | `STRIPE_SECRET_KEY` cleared in `.env.production`; all other lines preserved |
| C3 recreate | Only the `api` container recreated, using its existing image |
| V1 running API | `STRIPE MODE: empty`; Stripe webhook secret still present |
| V2 services | All 12 production services running; API healthy, 0 restarts |
| V4 health | `/api/health` → HTTP 200 |
| V5 non-payment functions | Login, library, reading, audio synchronization, and highlights passed manual checks |
| V6 payment initiation | Unauthenticated `POST /api/gifts/checkout` (valid body, `tokenCount: 1`) → **HTTP 400 `{"error":"payments_not_configured"}`** |
| Persistence | Gift-card count remains **0** |
| V7 Stripe | Final Live Dashboard inspection: no new payment activity |

### 7.7 Remaining payment paths: fail-closed in code, not tested in production

All Stripe use goes through `requireStripe()` (`gifts.service.ts:46-49`, `subscriptions.service.ts:190-193`), which throws `400 {"error":"payments_not_configured"}` when the client is null. Nest 10 returns an object passed to `BadRequestException` unchanged as the body (`@nestjs/common` 10.4.22 `HttpException.createBody`, local install), and `SentryGlobalFilter` (`main.ts:21`) does not report `HttpException`s (`@sentry/nestjs` `isExpectedError`). In every path, database writes come **after** the Stripe call, so none is reached.

| Path (all JWT + confirmed email except the webhook) | Checks before Stripe | Stops at (no key) | Writes before that point | Production-tested? |
|---|---|---|---|---|
| Gift checkout `gifts.service.ts:51-90` (unauthenticated) | `:58-60` token count | `:66` | None (gift rows only in `fulfillGift`, webhook-only) | **Yes** (V6) |
| Plan checkout `subscriptions.service.ts:207-220` | `:208-209` plan exists | `:199` customer creation, or `:211` if the user already has a `stripeCustomerId` (`:198`) | None; `stripeCustomerId` write at `:203` is after the Stripe call | No |
| Token package `:257-275` | `:258-261` package and placeholder check (production IDs are real-format, so it passes) | `:199` or `:264` | None | No |
| Single book `:233-255` | `:234-236` published, `priceCents` | `:199` or `:238` | None | No |
| Billing portal `:223-231` | `:225` no customer → 404 `no_billing_account` | `:226` | None | No |
| Cancel / resume `:482-498` | `:484`, `:494` no subscription → 404 | `:485`, `:495` (before status updates `:488`, `:496`) | None | No |
| Sync `:500-511` | `:502` no subscription → `{status:'none'}` without Stripe | `:503` (before update) | None | No |
| Webhook `webhooks.controller.ts:37-39` | — | 400 `Stripe is not configured`, before signature check | None | No |

Testing the authenticated paths in production would require a real account and is not recommended: the code path is the same guard already verified by V6, and a misconfiguration would create a live Stripe Customer.

### 7.8 Non-payment impact (code review)

| Area | Effect | Evidence |
|---|---|---|
| Reading, listening, library, fragments, sharing, clubs, login, registration | None | Only `gifts.service.ts:41`, `subscriptions.service.ts:56`, `webhooks.controller.ts:27` read the key; no Stripe use in `auth/`, `users/`, `books/`, `library/` |
| Token redemption, gift claim, daily token cron (`subscriptions.service.ts:157`), persona cron | None | Ledger and database only |
| `GET /subscriptions/me` (`:315`), plan and token-package lists | None | Database reads |
| API startup | None | No config validation; Stripe client is null |
| User experience | Pricing, gift, and "manage billing" actions show a generic payment error; purchase buttons remain visible | `pricing/page.tsx`, `gift/page.tsx`, `account/billing/page.tsx` — to be addressed by option E |
| Webhook deliveries | Any Stripe delivery gets 400; if a live endpoint is registered, Stripe retries and may eventually disable it | Low while there is no live activity |

### 7.9 Separate security follow-up: `.env.production` is world-readable (`644`)

**Finding [PO-VERIFIED].** The production `.env.production` has mode `644`: readable by every local user and process on the server, not only root. It holds database, JWT, OAuth, SMTP, MinIO, social-token, and Stripe webhook secrets. C2 preserved the existing mode by design (§A.3); the mode predates the containment.

**Related:** `.gitignore` does not cover `.env.production` (§7.5), so a `git add .` on the server would stage it.

**Recommendation [PROPOSED; separate authorization; infrastructure change]:** `chmod 600` (owner root) after confirming every reader runs as root — the CD job (`DEPLOY_SSH_KEY` → `/root/.ssh/deploy_key`, per CLAUDE.md) and manual `docker compose` use. A mode change does not restart anything. Include a check that the offsite-backup account cannot read the file before or after. Add `.env.production` to `.gitignore` through a documentation/config change under its own authorization. **Not changed here.**

## 8. External references

None. No external page was consulted.

## 9. Risks

| Rating | Risk |
|---|---|
| ~~Critical~~ **Mitigated (Rev 5)** | A visitor pays for a gift before the coordinated launch. Contained: gift checkout returns 400 without a key (§7.6) |
| ~~High~~ **Mitigated** | Card testing against an unauthenticated live checkout |
| ~~High~~ **Mitigated** | Live trialing subscriptions from plan checkout (fail-closed in code, §7.7) |
| ~~Medium~~ **Mitigated** | Live Customer objects created before launch (customer creation now fails closed, §7.7) |
| **High** (Rev 5) | **Containment is a single configuration value.** Restoring the key (for example from the password manager during unrelated work) silently reopens every payment path, including the unauthenticated gift checkout. Only option E removes this |
| **High** (Rev 5) | `.env.production` is world-readable (`644`) on the server (§7.9) |
| Medium (Rev 5) | The root-only backup `/root/noetia-d6/env.production.pre-d6` holds the live key; retention needs a decision |
| Medium (Rev 5) | Purchase buttons remain visible and fail with a generic error |
| Medium | Staging, if it also holds a live key, has the same exposure (staging is not altered by the containment) |
| Medium | Open live Checkout Sessions remain payable for up to 24 hours after containment (A.2 P7 gate) |
| Low | `.env.production` not covered by `.gitignore` (§7.5) |
| Low | Stripe API use through repeated unauthenticated session creation (throttled per IP) |

## 10. Decisions

**(a) Made under existing authority:** no POST or Stripe call made; production contact limited to public GETs; price IDs classified by format only, not recorded.

**(b) Requiring Product Owner approval:**
1. Containment: option A then E (recommended), C, or accept the risk until launch.
2. If A: authorization for the operator commands in §11, and whether the optional POST verification is allowed.
3. Whether E becomes a new mission: a payments switch, authentication on gift checkout, no live customer creation before launch.

## 11. Recommendations

### 11.1 Options [PROPOSED]

| Option | Security | Operational risk | Reversibility | User impact |
|---|---|---|---|---|
| **A. Clear `STRIPE_SECRET_KEY` in `.env.production`; recreate only `api`** | Closes every payment path; fails closed (§7.3) | Low: seconds of API unavailability; no build or migration | Seconds: restore the line, recreate | Gift, pricing purchase, and billing portal show an error. No paying users exist. Reading unaffected |
| B. Replace with a test key | **Unsafe**: a test-card gift could issue **real tokens** if the webhook secret matches test mode | Low | Yes | — |
| C. Roll or restrict the live key in Stripe | Closes immediately, no restart | Credential rotation; API keeps a dead key | **No** — needs a new key | As A |
| D. Block routes at Traefik | Partial, per route | **High** — past Traefik edits caused outages | Yes | As A |
| E. Code: payments off by default, gift checkout authenticated, purchase UI hidden until M11 | Durable; matches SA-003 Rev 7 L2 | Medium: mission, tests, deploy | Yes | As A, plus clear UI messaging |

### 11.2 Required (subject to PO authorization)

**A now, then E before the key returns.** Operator commands (copy from this report, never through a chat tool; check `gh run list --workflow cd.yml --limit 5` shows no running deploy first):

```bash
cd /opt/noetia && cp -p .env.production .env.production.pre-d6 && sed -i 's/^STRIPE_SECRET_KEY=.*/STRIPE_SECRET_KEY=/' .env.production && docker compose --env-file .env.production -f docker-compose.server.yml up -d --no-deps --no-build api
```

**Verification:**
- NEM-020 Appendix D key checker against the file and the running API → both `STRIPE MODE: empty`.
- `docker compose --env-file .env.production -f docker-compose.server.yml ps api` → healthy.
- `curl -s -o /dev/null -w '%{http_code}' https://noetia.app/api/subscriptions/plans` → `200`; log in and load the book list.
- Optional, only if authorized: a gift-checkout POST returns 400 `payments_not_configured` without contacting Stripe.

**Rollback:**
```bash
cd /opt/noetia && cp -p .env.production.pre-d6 .env.production && docker compose --env-file .env.production -f docker-compose.server.yml up -d --no-deps --no-build api
```
Re-run the checker (expect `live`). Delete `.env.production.pre-d6` once the final state is settled. A later CD deploy reads the same file, so containment persists.

### 11.3 Optional
- Correct CLAUDE.md §Infrastructure, which says Stripe keys are not in production (separate documentation authorization).

## 12. Changes made

| Item | Change |
|---|---|
| Files | `docs/reports/2026-11-08-NEM-020-D6-live-payment-exposure-assessment.md` (**new**, this report). The index entry is in the GOV-001 PR ([#39](https://github.com/Carloskfe/noetia/pull/39)), because `docs/reports/README.md` is not on `main` |
| Code, database, migrations | **None** |
| Configuration, secrets | **None** |
| Stripe and external services | **None.** No Stripe call |
| Deployments, restarts | **None** |
| Production | Claude: public GET requests only (§4, Rev 3). **Rev 5, by the PO as operator (2026-11-08):** `STRIPE_SECRET_KEY` cleared in `.env.production`; root-only backup in `/root/noetia-d6/`; `api` container recreated with its existing image. No other service, image, migration, database, Stripe, or staging change [PO-VERIFIED] |

## 13. Tests and validation

| Check | Result |
|---|---|
| Code trace of all Stripe call sites | Done (§7.1, §7.3) |
| `GET https://noetia.app/gift`, `/pricing` | 200; gift page shows $9.99 and $24.99 |
| `GET /api/subscriptions/plans`, `/token-packages` | 200; 6 plans and 4 packages, all real-format price IDs |
| POST to any payment endpoint | **Not run** (prohibited) |
| Stripe Dashboard checks | **Not run** (no access; §16) |
| Containment commands | **Not run on production** (Rev 3: authorized, awaiting operator) |
| Rev 3: Appendix A commands as rendered (15 table commands) | `bash -n` syntax check: all pass |
| Rev 3: C1, C2, rollback on a fake env file (fake keys) | Backup created mode 600 and refuses to overwrite; C2 changes only `STRIPE_SECRET_KEY` and prints no value; checker `live` → `empty` → `live` after rollback; file mode preserved (640 → 640) |
| Rev 3: P5 / V1 pipeline (simulated container env) | Prints only mode words |
| Rev 4: hardened C1/C2/C3, V1/V6, rollback (fake files, stubbed `docker compose` and `curl`) | All 7 commands pass `bash -n`. C2 normal: 1 line cleared, inode and mode unchanged. Fail-closed cases all stop and leave the original content: extra unexpected change, key already empty, mode/owner mismatch, missing backup (file **not** truncated). CRLF, duplicate key lines, and a file without a trailing newline handled. Tampered backup → rollback refuses. C3 refuses without C2; V6 refuses unless the running API reports `empty`. Leak scan of all outputs: 0 secret strings |
| Rev 5: production containment (PO as operator) | All gates passed (§7.6), including V6 `400 payments_not_configured` and gift-card count 0 |
| Rev 5: authenticated payment paths in production | **Not tested** (code-verified only, §7.7) |
| Rev 3: remote preflight | `cd.yml` idle (last run `6a5e5c0`, success); five public endpoints 200 |

## 14. Deviations and discoveries

- **Deviation — initial delivery.** On 2026-11-08 this assessment was delivered in chat as a concise summary, without the *PENDING PUBLICATION* banner or intended path required by the protocol then proposed (PR #36 §5.2). GOV-001 records the cause and the correction; this report publishes the content unchanged in substance.
- Discovery: migration 041 cannot have set the production price IDs (name mismatch, §7.2).
- Discovery: customer creation precedes price validation (§7.1).

## 15. Protected-systems confirmation

Not modified: reader / Escucha Activa; book ownership; token ledger; production and staging data; billing code; Stripe configuration; business-rule engines; infrastructure; deployment configuration; application code.

## 16. Open questions and unresolved items

| # | Item | Owner |
|---|---|---|
| 1 | ~~Containment decision~~ ~~Operator execution of Appendix A~~ **Done and verified 2026-11-08** (§7.6) | PO |
| 1a | **Durable payments control (option E)** as its own engineering mission: payments off by default regardless of key, authenticated gift checkout, no customer creation before launch, purchase UI hidden until M11 (SA-003 Rev 7 L2) | PO / Product Architecture |
| 1b | `.env.production` mode `644` → `600`, and `.gitignore` coverage (§7.9) — separate authorization | PO |
| 1c | Retention of the root-only backup containing the live key (keep until option E ships, then delete with approval) | PO |
| 1d | Key-restoration guard: until option E ships, any restoration of `STRIPE_SECRET_KEY` needs an explicit PO decision; record this in the operations runbook (separate authorization) | PO |
| 2 | Live mode: product and price counts, active/archived — are the stored price IDs live prices? | PO / operator |
| 3 | Live webhook endpoints, and whether the production webhook secret matches | PO / operator |
| 4 | Live Checkout Sessions by status and Customer count (counts only) | PO / operator |
| 5 | Staging key mode (NEM-020 Appendix D, Step 4) | PO / operator |
| 6 | Production running commit | PO / operator |

## 17. Next recommended action

1. **Recommended D6 governance status: CONTAINED — not closed.** The temporary control is verified; keep D6 open until option E is deployed and verified, then mark it Completed with a final revision.
2. Product Architecture reviews Rev 5.
3. PO decides §16 items 1a–1d; 1b (file permissions) is the quickest risk reduction.
4. The Appendix A P6 outputs (Part A and Part B) feed NEM-020 Rev 4; §16 items 2–6 remain open.
3. ~~Product Architecture reviews this report.~~ Done 2026-11-08 (accepted).

*Recommendation only.*

---

## Appendix A — Containment Option A: operator procedure (Rev 3)

**Rules.** Copy commands from the **rendered** GitHub page (table cells show `|`; the raw Markdown escapes it as `\|`). Run on the production server as root, in **one** SSH session, **one line at a time**. Copy from this report on GitHub, **never through a chat tool**. Every command prints only status words, counts, names, or timestamps — never a secret. If any line prints something that looks like a key, or a gate is not met: **STOP** and report. Do not paste environment-file contents anywhere.

### A.1 On your own machine, immediately before starting

```bash
gh run list --repo Carloskfe/noetia --workflow cd.yml --limit 3
```
Gate: no run `queued` or `in_progress`. Do not merge anything to `main` until A.3 and A.4 verification are complete.

### A.2 Preflight (read-only)

Session setup — the NEM-020 Appendix D verified fetch (pinned commit; fails closed):
```bash
U="https://raw.githubusercontent.com/Carloskfe/noetia/b705fd58c3362accd06808878c062d7b9f4cfe2f/docs/reports/2026-11-07-NEM-020-pre-launch-billing-inventory.md"
get(){ curl -fsSL "$U" | awk -v L="$1" 'index($0,"**"L)==1{getline;getline;print;exit}'; }
K=$(get "Key-mode check payload" | base64 -d); [ "$(printf %s "$K" | sha256sum | cut -c1-64)" = 91aadfae43e4e76adfea1bc0bd7c4fdfb60b4e2f32f8e7c7d6e7006db7c5e719 ] && echo KEYCHECK OK || { echo KEYCHECK MISMATCH - STOP; unset K; }
PA=$(get "Part A payload" | base64 -d | gunzip); [ "$(printf '%s\n' "$PA" | sha256sum | cut -c1-64)" = 47006ae346c39cbbf30a1e9745bc0998ee74184914b6a117f86d34202d872c64 ] && echo PARTA OK || { echo PARTA MISMATCH - STOP; unset PA; }
PB=$(get "Part B payload" | base64 -d | gunzip); [ "$(printf '%s\n' "$PB" | sha256sum | cut -c1-64)" = 4dee07a517dd1225b0ae4ae977a02a353cc90ef5ea467b142c7d909949906e67 ] && echo PARTB OK || { echo PARTB MISMATCH - STOP; unset PB; }
cd /opt/noetia && DC="docker compose --env-file .env.production -f docker-compose.server.yml" && echo READY
```
Gate: `KEYCHECK OK`, `PARTA OK`, `PARTB OK`, `READY`.

| Step | Command (one line) | Gate (STOP if not met) |
|---|---|---|
| P1 Identity | `hostname; git rev-parse --short HEAD; M0=$(stat -c '%a %U:%G' .env.production); echo "env file mode/owner: $M0"` | HEAD `6a5e5c0`. `M0` now holds the file mode/owner; C2 checks it |
| P2 No deploy or maintenance | `pgrep -af 'docker compose\|docker-compose\|migration:run\|npm run build' \| grep -v pgrep \|\| echo NO-ACTIVE-OPERATION` | `NO-ACTIVE-OPERATION` |
| P3 Containers | `$DC ps --format '{{.Service}} {{.Status}}'; docker inspect -f '{{.Name}} {{.State.StartedAt}} restarts={{.RestartCount}}' $($DC ps -q)` | All `Up`; `api` healthy. **Keep this output** for comparison in V2 |
| P4 API image present | `docker image inspect "$(docker inspect -f '{{.Config.Image}}' $($DC ps -q api))" >/dev/null && echo API-IMAGE-PRESENT` | `API-IMAGE-PRESENT` |
| P5 Key mode | `[ -n "$K" ] && awk "$K" .env.production` then `[ -n "$K" ] && $DC exec -T api sh -c 'printf "STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET"' \| awk "$K"` | Both `STRIPE MODE: live`; **no** `WARNING` line. Record `WEBHOOK SECRET` |
| P6 Database activity (read-only) | NEM-020 Appendix D Step 3: identity line, then Part A, then Part B | `noetia\|noetia\|on\|68\|ReconcilePlanDisplayPrices1748300000067`; ends `ROLLBACK`. **STOP** if Q2 shows `with_stripe_sub` > 0 for `active`/`trialing`/`past_due`; Q9 shows `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `charge.succeeded`, or `payment_intent.succeeded`; or Q14 `gift_cards_with_checkout` > 0 |
| P7 Stripe Dashboard, **live mode**, view only | Payments: succeeded / uncaptured / incomplete counts. Subscriptions: count by status. Checkout Sessions: **open** and **complete** counts. Webhooks: endpoint count, failed deliveries. Customers: count | **STOP** on any succeeded or uncaptured payment, any subscription, any **open** or **complete** Checkout Session, or any failed webhook delivery for a checkout event |

### A.3 Containment

Rev 4: each step sets a flag only on success, and the next step refuses to run without it. Run the blocks exactly as shown, one line each.

**C1 — Protected backup.** Copies the file to `/root/noetia-d6/` (directory 700, file 600, refuses to overwrite), confirms it is byte-identical, and stores its SHA-256 in a root-only file for rollback integrity. Prints only the mode, owner, and path.
```bash
unset C1OK; [ ! -e /root/noetia-d6/env.production.pre-d6 ] && install -d -m 700 /root/noetia-d6 && install -m 600 .env.production /root/noetia-d6/env.production.pre-d6 && cmp -s .env.production /root/noetia-d6/env.production.pre-d6 && (umask 077; sha256sum /root/noetia-d6/env.production.pre-d6 > /root/noetia-d6/env.production.pre-d6.sha256) && stat -c '%a %U %n' /root/noetia-d6/env.production.pre-d6 && C1OK=1 && echo BACKUP-OK
```
Gate: `600 root /root/noetia-d6/env.production.pre-d6` and `BACKUP-OK`. Nothing printed → a backup already exists or the copy failed: **STOP**.

**C2 — Clear the key and verify without printing values.** Writes the cleared file **in place** from the backup (same inode, so the original mode and owner are kept), then compares the backup and the new file **line by line inside awk**: every line must be identical except `STRIPE_SECRET_KEY=…` lines, which must now be exactly `STRIPE_SECRET_KEY=`. It prints only counts and line numbers, never content. It then checks the mode/owner against `M0` (P1) and that the key checker reports `empty`. **Any failure restores the original file automatically** (the API has not been recreated, so service is unchanged) and prints STOP. No `diff` is used.
```bash
unset C2OK; [ "$C1OK" = 1 ] && [ -n "$K" ] && [ -n "$M0" ] && awk '/^STRIPE_SECRET_KEY=/{print "STRIPE_SECRET_KEY=";next}{print}' /root/noetia-d6/env.production.pre-d6 > .env.production && awk -v want='STRIPE_SECRET_KEY=' 'NR==FNR{a[FNR]=$0;n=FNR;next}{m=FNR;if($0!=a[FNR]){if(a[FNR]~/^STRIPE_SECRET_KEY=/&&$0==want)c++;else{bad++;print "UNEXPECTED DIFFERENCE at line " FNR}}}END{if(m!=n){bad++;print "LINE COUNT DIFFERS"}if(bad||c<1){print "C2 COMPARE FAIL";exit 1}print "C2 COMPARE OK: " c " line(s) cleared, " n-c " other lines identical"}' /root/noetia-d6/env.production.pre-d6 .env.production && [ "$(stat -c '%a %U:%G' .env.production)" = "$M0" ] && KM=$(awk "$K" .env.production) && echo "$KM" && echo "$KM" | grep -qx 'STRIPE MODE: empty' && C2OK=1 && echo C2-OK; [ "$C2OK" = 1 ] || { [ "$C1OK" = 1 ] && [ -s /root/noetia-d6/env.production.pre-d6 ] && cat /root/noetia-d6/env.production.pre-d6 > .env.production && echo "C2 FAILED - ORIGINAL FILE RESTORED - STOP" || echo "C2 NOT RUN OR FAILED - FILE NOT TOUCHED - STOP"; }
```
Gate: `C2 COMPARE OK: 1 line(s) cleared, N other lines identical`, `STRIPE MODE: empty`, `WEBHOOK SECRET` as in P5, `C2-OK`. Any `UNEXPECTED DIFFERENCE`, `LINE COUNT DIFFERS`, `C2 COMPARE FAIL`, or `STOP` line: **STOP** (file already restored).

**C3 — Recreate only the API.** Runs only if C2 succeeded in this session.
```bash
if [ "$C2OK" = 1 ]; then $DC up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api; echo "exit=$?"; else echo "C3 NOT RUN - C2 NOT CONFIRMED - STOP"; fi
```
Gate: `exit=0`. Expected impact: API unavailable roughly 10–60 seconds; web, database, cache, worker untouched (`--no-deps`; `--no-build` uses the existing image checked in P4).

### A.4 Verification

| Step | Command | Gate |
|---|---|---|
| V1 Running API holds no key | See the V1 block below the table | `STRIPE MODE: empty` and `V1-OK`. Otherwise **STOP** (V6 will refuse to run) |
| V2 Only the API restarted | `$DC ps --format '{{.Service}} {{.Status}}'; docker inspect -f '{{.Name}} {{.State.StartedAt}} restarts={{.RestartCount}}' $($DC ps -q)` | All `Up`, `api` healthy; only the api `StartedAt` differs from P3; `restarts=0` |
| V3 No application errors | `$DC logs --since 10m api 2>&1 \| grep -ciE 'error\|exception\|unhandled'` | `0`. If not 0, review the lines **privately** before sharing (they may contain user data); report the count and message types only |
| V4 Public endpoints (any machine) | `for u in /api/health "/api/books?limit=1" /api/subscriptions/plans / /gift /pricing; do curl -s -o /dev/null -w "$u %{http_code}\n" "https://noetia.app$u"; done` | All `200` |
| V5 Non-payment functions (browser) | Log in; open Biblioteca; open a book and turn pages; play Escucha Activa audio for 30 seconds; open a fragment | All work |
| V6 Payment initiation disabled | See the V6 block below the table (run on the server, in the same session) | `{"error":"payments_not_configured"} HTTP 400`. With no key the API never contacts Stripe (§7.3) |
| V7 Stripe Dashboard, live | Checkout Sessions and Customers since the containment time | No new objects |
| V8 End session | `unset K PA PB U DC M0 KM C1OK C2OK V1OK; unset -f get` | — |

**V1** (sets `V1OK` only when the running API holds no key):
```bash
unset V1OK; [ -n "$K" ] && KM=$($DC exec -T api sh -c 'printf "STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET"' | awk "$K") && echo "$KM" && echo "$KM" | grep -qx 'STRIPE MODE: empty' && V1OK=1 && echo V1-OK
```
**V6** (refuses to run unless V1 succeeded in this session, so it cannot reach Stripe):
```bash
if [ "$V1OK" = 1 ]; then curl -s -w ' HTTP %{http_code}\n' -X POST https://noetia.app/api/gifts/checkout -H 'Content-Type: application/json' -d '{"recipientEmail":"containment-check@example.invalid","tokenCount":1}'; else echo "V6 NOT RUN - V1 NOT CONFIRMED - STOP"; fi
```

**If any verification fails: STOP and report the exact condition. Do not restore the key without explicit PO approval.** If the API is not healthy after C3, collect `$DC ps api` and `$DC logs --tail 50 api` (review privately first) and report.

### A.5 Rollback (only with explicit PO approval)

Verifies the backup against the SHA-256 stored in C1 **before** restoring; restores in place (keeps inode, mode, owner); confirms the restored file is byte-identical to the backup; only then recreates the API. Works in a fresh session.
```bash
cd /opt/noetia && DC="docker compose --env-file .env.production -f docker-compose.server.yml" && if sha256sum -c --quiet /root/noetia-d6/env.production.pre-d6.sha256 && cat /root/noetia-d6/env.production.pre-d6 > .env.production && cmp -s /root/noetia-d6/env.production.pre-d6 .env.production; then echo RESTORE-OK; $DC up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api; echo "exit=$?"; else echo "RESTORE NOT DONE - STOP"; fi
```
Gate: `RESTORE-OK` and `exit=0`; then V1 (expect `STRIPE MODE: live`), V2, V4. `RESTORE NOT DONE - STOP` → nothing was recreated; report. Keep the backup until the PO decides the final state; deleting it needs PO approval (it contains the live key). The password manager remains the canonical copy. A later CD deploy reads the same file, so containment persists across deploys.

### A.6 Return to Claude

The outputs of A.1, P1–P6, the P7 counts, C1–C3, V1–V4 and V6, the V5 and V7 results, and the attestation: *"No Stripe change, database write, other container restart, or staging change was made, and no secret was displayed or shared."*

