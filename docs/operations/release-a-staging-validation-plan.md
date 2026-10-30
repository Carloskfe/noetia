# Release A — Staging Validation Plan (Stripe test mode)

**Release:** `release/acquisition-a` (draft PR #14) · **Status:** PLAN — not executed · **Production:** untouched by every step below.
**Rules:** no secret is pasted into chat, a ticket, or a commit; every server command is **one line** (CLAUDE.md, 2026-05-12 incident); staging auto-deploy stays **unarmed** (no `staging` branch); NEM-006A/006C are **not merged** anywhere.

## 1. Minimum staging dependency (NEM-006A / 006C)

Staging infrastructure (`docker-compose.staging.yml`, staging web build isolation, `docs/staging/RUNBOOK.md`) exists only on `nem-006c-staging-content` (which contains NEM-006A). Release A needs it **only to run on the staging host** — nothing from it is needed in the release itself.

**Minimum safe path:** a **host-local** validation checkout = Release A + `nem-006c-staging-content` (dry-run merge: clean, 21 files, no conflicts). It is created **inside `/opt/noetia-staging` only**, never pushed, and discarded after validation. No repository branch receives staging changes; `main` and the release branch are untouched.

## 2. What the operator provides (no secrets in chat)

### 2a. Access
| Need | Who | Notes |
|---|---|---|
| SSH to the host (`-p 222`) to run the one-line commands below | Operator | Claude does not receive credentials; the operator runs commands and pastes **outputs** (no `.env` values) |
| Stripe Dashboard in **Test mode** | Operator | Test-mode objects only; nothing in live mode |
| A device/simulator with an Expo dev build | Operator / developer | `EXPO_PUBLIC_API_URL=https://staging.noetia.app/api` (the staging API is not behind basic auth since NEM-006A `15e5762`) |

### 2b. Read-only pre-checks on the host (paste outputs)
```bash
docker ps --format '{{.Names}} {{.Status}}' | grep noetia_staging
```
```bash
cd /opt/noetia-staging && git rev-parse --abbrev-ref HEAD && git log -1 --oneline
```
```bash
grep -E '^STRIPE_SECRET_KEY=' /opt/noetia-staging/.env.staging | sed -E 's/.*sk_(live|test)_.*/STRIPE MODE: \1/'
```
```bash
grep -cE '^STRIPE_WEBHOOK_SECRET=whsec_' /opt/noetia-staging/.env.staging
```
```bash
grep -E '^(NEXT_PUBLIC_API_URL|DB_NAME|APP_ENV)=' /opt/noetia-staging/.env.staging
```
**Stop** unless: staging containers healthy · `STRIPE MODE: test` · webhook secret present (`1`) · API URL is `staging.noetia.app` · `DB_NAME=noetia_staging`.

### 2c. Stripe test-mode configuration (Dashboard, Test mode ON)
1. **Webhook endpoint** `https://staging.noetia.app/api/webhooks/stripe` with events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Its signing secret goes into `.env.staging` by the operator (never into chat).
2. **Test prices** for at least the 1-token pack and one plan (Individual monthly). Note their **price IDs** (not secret).
3. **Staging DB price IDs** — migrations 039/041 match plan names that the seed never created (audit finding), so staging rows likely hold seed or placeholder IDs. Set the test IDs in the **staging** DB only, one line each:
```bash
cd /opt/noetia-staging && docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml exec -T db psql -U noetia -d noetia_staging -c "UPDATE token_packages SET \"stripePriceId\"='<price_test_…>' WHERE \"tokenCount\"=1 RETURNING name;"
```
(same pattern for one plan row, by `id`).
4. **A paid book on staging** (staging data only): one published book with `isFree=false`, e.g. `UPDATE books SET "isFree"=false WHERE id='<staging book id>'` — choose a book that has audio + sync so Escucha Activa can be regression-checked.

### 2d. Host-local validation checkout and deploy (staging only)
```bash
cd /opt/noetia-staging && git fetch origin && git checkout -B validation/release-a origin/release/acquisition-a && git merge --no-edit origin/nem-006c-staging-content
```
```bash
cd /opt/noetia-staging && docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml up -d --build --remove-orphans
```
No migration is introduced by Release A. Afterwards restore the previous staging checkout (`git checkout <previous branch>`, then rebuild) and delete `validation/release-a` on the host.

## 3. Validation matrix (evidence required for each row)

Use Stripe **test cards** only. Staging email is disabled — confirm test accounts' email in the **staging** DB (`UPDATE users SET "emailConfirmed"=true WHERE email='<test email>'`).

| # | Scenario | Pass condition | Evidence |
|---|---|---|---|
| W1 | Free account buys the 1-token pack on **hosted Checkout** with `4242 4242 4242 4242` | Stripe delivers `checkout.session.completed` → **200**; `GET /api/subscriptions/me` → `availableTokens: 1` | Stripe event id + delivery status; API JSON |
| W2 | 3-D Secure card `4000 0027 6000 3184` | Authenticated payment credits 1 token | Event id + delivery 200 |
| W3 | Declined card `4000 0000 0000 0002` | No token credited | Balance unchanged |
| W4 | Dashboard **Resend** of the W1 event | Balance does not change (idempotency) | Second delivery 200, balance unchanged |
| W5 | W1 account opens the paid book | Unlock screen → **Unlock with 1 token** → book renders; balance 0 | Screenshots; `GET /api/books/:id` 200 |
| W6 | Subscriber (Individual test plan, `4242…`) | `invoice.paid` issues plan token; paid book readable (legacy streaming) **and** top-bar **Unlock** visible → unlock → button disappears | Event ids; screenshots |
| W7 | Household member (Duo or Family invite) | Member sees pooled tokens; unlock spends the owner's pool; ownership on the member | API JSON both users |
| W8 | Retired per-title purchase | `POST /api/subscriptions/books/:id/purchase` → **410** `title_purchase_discontinued`; no Checkout Session appears in Stripe | curl output; Stripe sessions list |
| W9 | Ownership bypass | `POST /api/library/:paidId` → **403** | curl output |
| W10 | Owned-book regression | Owned book: reading, progress saved, highlight created, **Escucha Activa** audio plays and follows | Screenshots |
| W11 | Cancellation | Cancel the W6 subscription (portal, at period end then immediately in test) → owned/unlocked books still readable; non-owned paid book → unlock screen | Screenshots |
| M1 | Mobile: free account | App opens with **no paywall**; library and free books readable | Screen recording |
| M2 | Mobile: unlock | Reader denial → unlock panel → unlock → reads | Screen recording |
| M3 | Mobile: subscriber | Header **Desbloquear/Unlock** visible on a non-owned paid book → unlock | Screen recording |
| M4 | Mobile: downloaded copy | Download a non-owned paid book as a subscriber, cancel, reopen **online** → unlock panel (not the copy). Offline behaviour recorded (open decision O-2) | Screen recording |

Record every result in `docs/operations/release-a-validation.md` §5 (new section). Any failure → STOP and report; no fixes on the host.

## 4. Reconciliation baseline (operator-supervised, production read-only)

Run per `docs/operations/nem-011-ownership-reconciliation.md` — checksum check, forced read-only session, counts only (sections 1–5), plus the Stripe live-mode **read-only** checks (open sessions, unpaid sessions, failed deliveries, completed per-title sessions). Paste the **count** summaries (no UUID rows) into the validation record. This is the only production touch in the plan, and it is read-only.
