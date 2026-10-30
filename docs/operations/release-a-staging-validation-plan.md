# Release A — Staging Validation Plan (Stripe test mode)

**Release:** `release/acquisition-a` (draft PR #14) · **Status:** PLAN — not executed · **Production:** untouched by every step below.
**Rules:** no secret is pasted into chat, a ticket, or a commit; every server command is **one line** (CLAUDE.md, 2026-05-12 incident); staging auto-deploy stays **unarmed** (no `staging` branch); NEM-006A/006C are **not merged** anywhere.

## 0. STOP GATE — staging must never call the production API

`main` (and therefore `release/acquisition-a`) builds the web image with `ENV NEXT_PUBLIC_API_URL=https://noetia.app/api` hard-coded (`services/web/Dockerfile:19`). Deploying the release branch to staging **without** NEM-006A's fix `3c71e5a` (build args, carried by `nem-006c-staging-content`) would make the staging website call **production** — every unlock and token test would write production data.

Two one-line checks on the host; **stop** unless both pass:
```bash
cd /opt/noetia-staging && git merge-base --is-ancestor 3c71e5a HEAD && echo STAGING-BUILD-FIX-PRESENT
```
(after the build)
```bash
docker exec noetia_staging-web-1 sh -c "grep -rlF 'https://noetia.app/api' /app/.next | head -3; echo ---; grep -rlF 'https://staging.noetia.app/api' /app/.next | head -1"
```
Pass = **nothing** above `---` and at least one file below it.

**Verified locally 2026-10-30** (production web image built twice with the staging build args, bundles searched, images deleted afterwards):

| Build | Production API refs | Staging API refs |
|---|---|---|
| Release A + `nem-006c-staging-content` (validation checkout) | **0** | 43 |
| Release A alone (negative control) | **43** | 0 |

### Gate 2 — production and staging must not resolve each other's services

Both stacks put `api`, `web` and `storage` on the shared Traefik `proxy` network, and both address each other by those bare names (`INTERNAL_API_URL=http://api:4000`, `MINIO_ENDPOINT=storage`). Docker does not guarantee which container a name shared across attached networks resolves to, so **this must be measured, not assumed** — and it concerns **production** as well (e.g. production's `/s/<id>` server-rendered share page and production uploads), since staging went live on 2026-08-18. Read-only, one line each:
```bash
docker inspect -f '{{.Name}} {{range $n,$v := .NetworkSettings.Networks}}{{$n}}={{$v.IPAddress}} {{end}}' $(docker ps -q --filter name=noetia-api-1 --filter name=noetia-storage-1 --filter name=noetia_staging-api-1 --filter name=noetia_staging-storage-1)
```
```bash
for c in noetia-api-1 noetia_staging-api-1; do for i in 1 2 3; do docker exec $c node -e "require('dns').lookup('storage',{all:true},(e,a)=>console.log('$c',e||a.map(x=>x.address).join(',')))"; done; done
```
```bash
for c in noetia-web-1 noetia_staging-web-1; do for i in 1 2 3; do docker exec $c node -e "require('dns').lookup('api',{all:true},(e,a)=>console.log('$c',e||a.map(x=>x.address).join(',')))"; done; done
```
Pass = every lookup returns **only** IPs of its own stack's containers. **Fail → STOP and report to the Product Owner**: the remedy (unique hostnames such as `noetia-api-1` / `noetia_staging-api-1` in each stack's `INTERNAL_API_URL` and `MINIO_ENDPOINT`) is a **production and staging configuration change** needing explicit approval.

## 1. Minimum staging dependency (NEM-006A / 006C)

Staging infrastructure (`docker-compose.staging.yml`, staging web build isolation, `docs/staging/RUNBOOK.md`) exists only on `nem-006c-staging-content` (which contains NEM-006A). Release A needs it **only to run on the staging host** — nothing from it is needed in the release itself.

**Minimum safe path:** a **host-local** validation checkout = Release A + `nem-006c-staging-content` (dry-run merge: clean, 21 files, no conflicts). It is created **inside `/opt/noetia-staging` only**, never pushed, and discarded after validation. No repository branch receives staging changes; `main` and the release branch are untouched.

## 2. What the operator provides (no secrets in chat)

### 2a. Access
| Need | Who | Notes |
|---|---|---|
| SSH to the host (`-p 222`) to run the one-line commands below | Operator | Claude does not receive credentials; the operator runs commands and pastes **outputs** (no `.env` values) |
| Stripe Dashboard in **Test mode** | Operator | Test-mode objects only; nothing in live mode |
| A device/simulator with an Expo dev build | Operator / developer | `EXPO_PUBLIC_API_URL=https://staging.noetia.app/api` **and** `EXPO_PUBLIC_WEB_URL=https://staging.noetia.app` (without it, "Get tokens" opens the **production** checkout — fixed in `a7aae70`, but the variable must be set). The staging API is not behind basic auth since NEM-006A `15e5762` |

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
grep -E '^(NEXT_PUBLIC_API_URL|DB_NAME|APP_ENV|WEB_URL|MINIO_PUBLIC_URL)=' /opt/noetia-staging/.env.staging
```
```bash
grep -cE '^STRIPE_SECRET_KEY=sk_live_' /opt/noetia-staging/.env.staging
```
(must print `0`). Note: the API has **no** code-level guard refusing a live key on staging — this check is the only protection (recommended follow-up: refuse to start when `APP_ENV=staging` and the key is `sk_live_`, and reject `livemode: true` webhook events on staging).
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
Then run the §0 bundle check **before any test**. No migration is introduced by Release A. Staging CD cannot be used: `cd-staging.yml` triggers on a `staging` branch (deliberately absent) and its `workflow_dispatch` is unavailable while the workflow file is not on `main`. Afterwards restore the previous staging checkout (`git checkout <previous branch>`, then rebuild) and delete `validation/release-a` on the host.

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

## 5. Open PRs — dependencies and blockers (2026-10-30)

| PR | Content | Mergeable | Dependency | Blocker |
|---|---|---|---|---|
| [#14](https://github.com/Carloskfe/noetia/pull/14) (draft) | Release A: NEM-011/012/014/015 | yes | Contains **#11** and **#13** in full. Staging run needs host-local `nem-006c-staging-content` (§0–§2) | Staging W1–W11/M1–M4; reconciliation baseline; reviews; merge method (**merge commit, not squash** — recovery plan); deployment approval |
| [#11](https://github.com/Carloskfe/noetia/pull/11) | NEM-011 only | yes | Subset of #14 | **Must not be merged on its own** — `main` deploys production and D1 forbids NEM-011 without NEM-012. Not a draft today. Recommendation: close as superseded by #14 once #14 is approved (PO decision) |
| [#13](https://github.com/Carloskfe/noetia/pull/13) | NEM-012…015 mission drafts + rollout plan | yes | Subset of #14 (#14 carries newer versions) | Superseded by #14; recommendation: close with #14's approval |
| [#12](https://github.com/Carloskfe/noetia/pull/12) | PO-021…023 + impact assessment | yes | Links to PO-006…013 resolve only when `nem-009-resilience-impl` lands; #14's docs link to #12's files | Product Architecture review |
| [#10](https://github.com/Carloskfe/noetia/pull/10) | NEM-010 draft | yes | NEM-010 D1 = the same staging decision as this plan | PO decisions D1, D3 |
| [#16](https://github.com/Carloskfe/noetia/pull/16) (draft) | Reporting protocol + registry | yes | none | PO approval (governance change) |

No two PRs change the same file. Every merge to `main` triggers a production deploy (docs-only merges rebuild nothing, but still run CD).

## 6. Next execution phase — Product Owner approval requested

### 6a. What needs which authorization

| Category | Items | Authorization |
|---|---|---|
| Read-only checks | §0 gates 1–2, §2b pre-checks | Covered by the current phase — **operator executes** (no change) |
| **Test-mode Stripe objects** | Webhook endpoint for `staging.noetia.app`; test prices for a token pack and one plan; test customers/subscriptions created by the matrix | **Separate PO approval** (Stripe configuration change, test mode only) |
| **Staging configuration** | `STRIPE_WEBHOOK_SECRET` (and test key if missing) in `.env.staging` — entered by the operator | **Separate PO approval** (secret change, staging) |
| **Staging data** | Test price IDs in `token_packages`/`plans`; one book set `isFree=false`; test-account email confirmation | **Separate PO approval** (staging data change) |
| **Staging deployment** | Host-local validation checkout + manual rebuild (§2d); restore afterwards | **Separate PO approval** (deployment, staging) |
| Production, read-only | Reconciliation baseline + Stripe live read-only checks (§4) | **Separate PO approval** (production access, read-only) |
| Production changes | Gate-2 remedy if it fails; any merge; any deploy | **Not requested** |

### 6b. Execution steps

Approval is requested for **staging-only** actions, run by the operator with the agent guiding and recording evidence:

1. Read-only host pre-checks (§2b).
2. Stripe **test-mode** configuration: webhook endpoint + test prices (§2c.1–2) — creates **test-mode** Stripe objects only.
3. **Staging** data changes: test price IDs, one paid book, test-account email confirmation (§2c.3–4, §3).
4. Host-local validation checkout + manual staging deploy (§2d), gated by §0.
5. Validation matrix W1–W11, M1–M4 (§3) and evidence recording.
6. Supervised, read-only production reconciliation + Stripe live **read-only** checks (§4).

Explicitly **not** requested: production deployment, merging any PR, production data or Stripe live-mode changes, secrets entered by the agent, arming staging auto-deploy, merging NEM-006A/006C.
