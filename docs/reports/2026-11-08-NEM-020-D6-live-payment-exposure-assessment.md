# NEM-020-D6 — Live Payment Exposure Assessment

> **Status: ACCEPTED by Product Architecture (2026-11-08) as a read-only payment-exposure assessment · Containment NOT authorized · Merge NOT granted.** D6 remains an **unresolved live-payment exposure** and a separate, urgent Product Owner decision.
>
> **Assessment:** Read-only. Nothing was changed in code, databases, Stripe, configuration, or production.
>
> **Verdict: HIGH, bordering CRITICAL.** With the live Stripe key in production, `main` lets **any visitor, without logging in,** open a real Stripe Checkout page for a gift card whose price is built into the code. The public `/gift` page is served in production. A real charge then only requires someone to pay. Registered users can also reach plan and token checkout, whose stored price IDs are real-format (not placeholders); whether they are *live-mode* prices is unverified. **No payment has been found.**
>
> **Recommended containment (requires a separate PO decision):** clear `STRIPE_SECRET_KEY` in `.env.production` and recreate only the `api` container (§11, option A), then a durable payments kill-switch under its own mission (option E).

Evidence labels: **[CODE]** read from `origin/main` `6a5e5c0` · **[PROD-GET]** observed through a public, unauthenticated HTTP GET to production · **[PO]** attested by the Product Owner · **[UNVERIFIED]** · **[PROPOSED]** recommendation only.

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
| **Lifecycle status** | **Accepted (assessment)** — Product Architecture, 2026-11-08. The exposure itself is **open**: containment awaits a separate PO decision |
| **Delivery state** | **Not merged.** Nothing deployed |
| **This report authorizes** | **Nothing.** Containment is a separate PO decision |

### Review record

| Date | Reviewer role | Verdict | Conditions | Merge authorization |
|---|---|---|---|---|
| 2026-11-08 | Product Architecture (independent review), recorded under PO instruction *GOV-001 Review Closure and PR Reconciliation* | **Accepted** as a read-only payment-exposure assessment | Payment containment **not authorized** by that instruction; remains a separate, urgent PO decision | **NOT GRANTED** |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-08 | Assessment as delivered in chat on 2026-11-08, published without changing its findings; structured per the reporting protocol (commits `a4a2766`, `4558954`) |
| 2 | 2026-11-08 | Product Architecture verdict recorded (accepted; containment not authorized; merge not granted). Findings unchanged |

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

## 8. External references

None. No external page was consulted.

## 9. Risks

| Rating | Risk |
|---|---|
| **Critical** (conditional) | A visitor pays for a gift before the coordinated launch, contrary to Q4 (SA-003 Rev 7), with no refund or dispute process, and possibly **no delivery** if the live webhook is not configured |
| **High** | Card testing against an unauthenticated live checkout: dispute fees and Stripe account risk |
| **High** | Live trialing subscriptions from plan checkout, handled by webhook code SA-003 found defective |
| Medium | Live Customer objects with user emails created before launch |
| Medium | Staging, if it also holds a live key, has the same exposure |
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
| Production | Four public GET requests only (§4) |

## 13. Tests and validation

| Check | Result |
|---|---|
| Code trace of all Stripe call sites | Done (§7.1, §7.3) |
| `GET https://noetia.app/gift`, `/pricing` | 200; gift page shows $9.99 and $24.99 |
| `GET /api/subscriptions/plans`, `/token-packages` | 200; 6 plans and 4 packages, all real-format price IDs |
| POST to any payment endpoint | **Not run** (prohibited) |
| Stripe Dashboard checks | **Not run** (no access; §16) |
| Containment commands | **Not run** (not authorized); syntax reviewed only |

## 14. Deviations and discoveries

- **Deviation — initial delivery.** On 2026-11-08 this assessment was delivered in chat as a concise summary, without the *PENDING PUBLICATION* banner or intended path required by the protocol then proposed (PR #36 §5.2). GOV-001 records the cause and the correction; this report publishes the content unchanged in substance.
- Discovery: migration 041 cannot have set the production price IDs (name mismatch, §7.2).
- Discovery: customer creation precedes price validation (§7.1).

## 15. Protected-systems confirmation

Not modified: reader / Escucha Activa; book ownership; token ledger; production and staging data; billing code; Stripe configuration; business-rule engines; infrastructure; deployment configuration; application code.

## 16. Open questions and unresolved items

| # | Item | Owner |
|---|---|---|
| 1 | **Containment decision (§10b) — URGENT, still open** | PO |
| 2 | Live mode: product and price counts, active/archived — are the stored price IDs live prices? | PO / operator |
| 3 | Live webhook endpoints, and whether the production webhook secret matches | PO / operator |
| 4 | Live Checkout Sessions by status and Customer count (counts only) | PO / operator |
| 5 | Staging key mode (NEM-020 Appendix D, Step 4) | PO / operator |
| 6 | Production running commit | PO / operator |

## 17. Next recommended action

1. PO decides containment (§10b). The NEM-020 read-only inventory continues independently.
2. Operator returns §16 items 2–6; results feed NEM-020 Rev 4.
3. ~~Product Architecture reviews this report.~~ Done 2026-11-08 (accepted).

*Recommendation only.*
