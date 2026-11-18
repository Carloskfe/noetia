# PR #63 — Payment activation gate: final qualification

| | |
|---|---|
| PR | #63 `fix/payments-enabled-fail-closed`, **Draft, DO NOT MERGE** |
| Implementation inspected | `f7e239e` (PA: core implementation accepted for release preparation) |
| This update | Documentation only. No application code, other PR, production or payment state changed |
| Merge / deploy / activation | **None authorized.** Merging to `main` is a production deploy (`cd.yml`) |
| Date | 2026-11-17 |

---

## 1. Final CI status (run `44205729325`, head `f7e239e`)

Baseline: PR #62 run `43780254233` (head `ecddd52`), which is based on the same `main` commit `3b35cb1` and changes no file under `services/`. It is therefore the cleanest available picture of `main` CI.

| Job | PR #63 | Baseline (`main` 3b35cb1 via PR #62) | Classification |
|---|---|---|---|
| api — lint / typecheck / build | pass | pass | — |
| worker — lint / typecheck / build | pass | pass | — |
| web — lint / typecheck / build | pass | pass | — |
| worker — unit tests | pass | pass | — |
| image-gen — unit tests | pass | pass | — |
| **api — unit tests** | fail: 73/73 suites, **1257/1257 tests pass**; branch coverage **69.08%** < 80% | fail: 71/71 suites, 1028/1028 pass; branches **68.83%** | **Baseline.** Coverage-only failure; PR #63 *raises* branch coverage (+0.25 pt) and adds 229 tests, 0 failures |
| **mobile — unit tests** | fail: 179/179 pass; stmts 29.61 / br 14.17 / lines 31.28 / fn 20.86 | identical numbers | **Baseline.** PR #63 touches no mobile file |
| **web — unit tests** | fail: 298/298 pass; stmts 72.8 / br 72.44 / lines 71.61 / fn 51.74 | identical numbers | **Baseline.** PR #63 touches no web file |
| **web — E2E (Playwright)** | fail: `Playwright does not support chromium on ubuntu26.04-x64` at `playwright install` | identical error | **Baseline / runner environment.** No test executed; unrelated to the PR |

**Regressions introduced by PR #63: none.** Every failing job fails identically on the baseline; no test fails anywhere; the only changed metric (API branch coverage) moved up. The coverage gates have never passed on `main` (pre-existing, tracked separately); this PR neither fixes nor worsens that.

## 2. Production requirement: `PAYMENTS_ENABLED` absent or disabled

Until a separately authorized financial release, production must have `PAYMENTS_ENABLED` **absent, empty or `false`** in **both** places:

1. **Effective deployment configuration.** In `docker-compose.server.yml` the `api` service reads `env_file: .env.production`; its `environment:` block does **not** set `PAYMENTS_ENABLED` (verified at `f7e239e`, and nothing under `.github/` sets it). The only source is therefore `/opt/noetia/.env.production`.
2. **Running container.** An edited `.env.production` takes effect only when the API is recreated, so the file and the container can disagree.

Read-only verification the operator runs **before and after** the PR #63 deploy (prints names and a yes/no only, never values):

```bash
cd /opt/noetia
grep -c '^PAYMENTS_ENABLED=true' .env.production                 # expect 0
docker compose --env-file .env.production -f docker-compose.server.yml config \
  | grep -c 'PAYMENTS_ENABLED: "true"'                             # expect 0
docker compose -f docker-compose.server.yml exec -T api \
  sh -c '[ "$PAYMENTS_ENABLED" = "true" ] && echo ON || echo OFF'  # expect OFF
docker compose -f docker-compose.server.yml logs api | grep '\[payments\]' | tail -1
                                                                   # expect "[payments] disabled (...)"
```

Any `ON`, a non-zero count, or a `[payments] ENABLED` line = **STOP**: payments would be live without authorization.

## 3. A restored Stripe key alone cannot activate payments (after PR #63 is deployed)

Confirmed against `f7e239e`:

- The only `new Stripe(` in `services/api/src` is in `common/payments-activation.ts` (`createStripeClient`). `SubscriptionsService`, `GiftsService` and `WebhooksController` obtain their client only from it.
- `resolvePaymentsActivation` checks the flag **first**: unless `PAYMENTS_ENABLED` is exactly `true`, it returns disabled without reading the key.
- With no client, every pathway keeps its existing error: checkout (subscription, token package, book, anonymous gift), portal, cancel, resume, sync → `400 payments_not_configured`; `POST /webhooks/stripe` → `400 Stripe is not configured` before signature verification.
- Executed matrix (PR body): flag missing/empty/`false`/`TRUE`/`1`/`yes`/typo × key `sk_test_`/`sk_live_`/`rk_live_` → **OFF** on every pathway, including HTTP tests of the unauthenticated gift and webhook routes. Negative control (parser accepts anything) fails 118 tests.

**Scope of this guarantee:** it holds for the code on `main` + PR #63. It does **not** hold for code that constructs Stripe itself — see §4.

## 4. Integration requirement: PR #60 `CheckoutStatusService`

PR #60 (`fix/payment-lifecycle-stabilization-20261112`) still constructs Stripe from the key alone in **four** classes:

| File on PR #60 | Construction |
|---|---|
| `subscriptions/subscriptions.service.ts:72-73` | `stripeKey ? new Stripe(stripeKey) : null` |
| `gifts/gifts.service.ts:41-42` | same |
| `subscriptions/webhooks.controller.ts:27-28` | same |
| **`subscriptions/checkout-status.service.ts:69-70`** (new in PR #60, G-1) | same |

**Requirement (blocking for financial release):** when PR #60 is integrated, all four, **including `CheckoutStatusService`**, must obtain their client only through `createStripeClient`. Resolution of the three existing conflicts: keep `createStripeClient`. PR #60's test suites need the one-line `PAYMENTS_ENABLED=true` opt-in. Acceptance check at integration:

```bash
git grep -n "new Stripe(" -- services/api/src   # must list ONLY common/payments-activation.ts
```

Until then, PR #60 merged on its own would reintroduce key-only activation for the read-only `checkout.sessions.retrieve` path and, if merged over PR #63 without resolution, for the other three. This is a recorded gate, not changed here.

## 5. Rollback consequence

Reverting PR #63 (a revert on `main`, i.e. a production deploy) restores the **previous key-only activation**: any non-empty `STRIPE_SECRET_KEY` in production again builds a Stripe client and opens checkout, the anonymous gift path and webhook processing.

Therefore, **before any revert of PR #63 is deployed**, the Stripe-key safety verification must be repeated and recorded:

```bash
grep -c '^STRIPE_SECRET_KEY=..*' /opt/noetia/.env.production   # expect 0
docker compose -f docker-compose.server.yml exec -T api \
  sh -c '[ -n "$STRIPE_SECRET_KEY" ] && echo SET || echo EMPTY' # expect EMPTY
```

and PR #59's G-X1 reverts to its original form ("`STRIPE_SECRET_KEY` absent or empty"). A revert with a key present = unauthorized payment activation. Kill switch after a future authorized activation is unchanged: `PAYMENTS_ENABLED=false` + recreate the API (not a revert).

## 6. Recommended release ordering (recommendation only; nothing merged)

Pairwise merge checks (`git merge-tree`): #63+#59 clean, #63+#62 clean, #59+#62 clean. The three are independent; the order is about risk, not conflicts.

| Step | PR | Why here |
|---|---|---|
| 1 | **#63** payment gate | Smallest blast radius (API only, fail-closed, no behaviour change with flag unset, matching today's state). Strictly reduces risk for every later step: once deployed, a restored key can no longer open payments. Verify §2 after deploy |
| 2 | **#59** public site | Its blocking condition G-X1 can then be stated as "`PAYMENTS_ENABLED` not `true`" (robust to a restored key) instead of relying solely on the key being absent. Web-facing, independent of network topology |
| 3 | **#62** API edge network (Stage B-2) | Infrastructure change with an operator runbook and a known failure mode (504 on every `/api` while CD reports green if Traefik is not attached). Do it last, in its own window, after #63 and #59 are verified, so any `/api` failure is unambiguously attributable to the network change and rollback does not have to untangle application deploys |

Conditions for every step: separate PO merge authorization per PR; one deploy at a time, with no merge while a CD run is in progress (`gh run list` first; CD cancel-in-progress); post-deploy verification per `CLAUDE.md` before the next step. PR #60 is **not** in this sequence: it belongs to the financial release and must satisfy §4 first.

## 7. Status and recommendation

- PR #63 remains **Draft, DO NOT MERGE**.
- Remaining financial-release gates are unchanged and closed (G-1, G-4, G-5, W-1/W1-PO, W-2/SG-PM, USD-1, D4 portal, production webhook and key, gift-email recovery, Terms/legal, NEM-024 separation, PR #60 integration incl. §4). Setting `PAYMENTS_ENABLED=true` in production **is** the financial release and needs its own PO authorization.

**Recommendation: GO for a future, separately PO-authorized merge of PR #63 alone, as step 1 of §6**, subject to: (a) §2 checks returning OFF before and after deploy; (b) no CD run in progress at merge; (c) PA acceptance of this qualification.
**NO-GO** for: activating payments; merging PR #60 without §4; reverting PR #63 without §5.
