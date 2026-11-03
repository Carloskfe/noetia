# Coordinated Rollout — Acquisition Integrity, Unlock with Token, Ownership Enforcement

**Date:** 2026-10-29 · **Status:** PROPOSED — for Product Owner review · **Nothing here is merged or deployed.**
**Missions:** NEM-011 (PR #11, implemented) · NEM-012 (IN PROGRESS) · NEM-013 (DRAFT) · NEM-014 (IN PROGRESS) · NEM-015 (IN PROGRESS)
**Decisions:** PO-021 (+ Amendment 1, B-1) / PO-022 / PO-023 (PR #12) · NEM-011 D1–D3

## Why order matters

- **Every push to `main` deploys production** (`cd.yml`). Merging NEM-011 alone would deploy it — which D1 forbids until the unlock flow exists.
- NEM-011 removes the de-facto acquisition path (the "+" bypass). NEM-012 provides the real one. NEM-015 retires direct per-title purchase (B-1). All three must reach customers **in the same deploy**, so the token flow opens as the other paths close.
- NEM-013 ends streaming of non-owned books. It must come **after** customers can acquire books, and after the transition decision and the Terms update.

## Dependency graph

```
NEM-014 (CI job) ──┐
                   ├─▶ Release A = NEM-011 + NEM-012 + NEM-015 ──▶ NEM-013 (flag: legacy → ownership)
NEM-011 (done) ────┤        ▲
NEM-012 (unlock) ──┤        │
NEM-015 (retire) ──┘        │
                    Validation environment (staging, O-1)
                    Reconciliation baseline (D2)
```

## Rollout order

| Step | What | Gate to proceed |
|---|---|---|
| 0 | NEM-012, NEM-014, NEM-015 implementation authorized (2026-10-29); merge the PO-021…023 record (PR #12) | PO approval |
| 1 | **NEM-014** — add the CI job **on the release branch** (stacked on `fix/nem-011-subscription-integrity`) so PR CI runs the real-database tests | Job green; revert-check fails as expected |
| 2 | **NEM-012** and **NEM-015** — build on the same release branch | Their acceptance criteria + tests green in CI |
| 3 | **Validate Release A** on staging with Stripe **test** mode (or, if staging is not available, record that validation was local + mocked E2E only) | PO sign-off on the validation report |
| 4 | **Reconciliation baseline** (read-only, [procedure](nem-011-ownership-reconciliation.md)) incl. §5 direct purchases + the Stripe open-session check | Counts recorded; no open per-title sessions, or they are allowed to complete |
| 5 | **Deploy Release A** — one merge to `main` (one deploy, ~10–25 s downtime); post-deploy checks from NEM-011 §14, NEM-012 §11, NEM-015 §11 | Explicit PO merge/deploy approval |
| 6 | Post-deploy reconciliation (+24 h) | G1/G2 counts not growing |
| 7 | **NEM-013** deploy with `CONTENT_ACCESS_MODE=legacy` | No behaviour change verified |
| 8 | Customer notice + ToS update; notice period | B-2 decided; legal sign-off |
| 9 | Switch `CONTENT_ACCESS_MODE=ownership` | B-3, B-10 decided; denial monitoring in place |

**Branching:** steps 1–2 commit to one release branch based on the NEM-011 branch. PR #11 then either becomes the release PR (retitled) or is closed in favour of a single release PR. Either way, **one** merge reaches `main`.

## Rollback

| Release | Rollback |
|---|---|
| A (NEM-011 + NEM-012 + NEM-015) | `git revert` the release merge → CD. No schema or data change; ownership rows created meanwhile stay valid (a revert would re-open per-title purchase — acceptable only as an emergency step) |
| NEM-013 | Set `CONTENT_ACCESS_MODE=legacy` (container recreate); full rollback = revert |
| NEM-014 | Revert the single CI job |

## Test requirements (summary)

| Mission | Must exist and pass |
|---|---|
| NEM-011 | Real-PostgreSQL defect tests (bypass, double spend × 5 rounds, same-book race, rollback, household, FIFO, cancellation) — **done, 16/16** |
| NEM-014 | Those tests running in CI on an ephemeral `postgres:16-alpine` service; a deliberate revert makes them fail |
| NEM-012 | API (balance for free accounts, 403 payload), integration unlock paths, web unit + Playwright E2E (`acquire → read`, no tokens, owned-book regression), mobile unit (paywall removal, acquisition states), en/es parity |
| NEM-015 | Endpoint returns 410; a Checkout Session created before retirement is still fulfilled by the webhook; no new `purchase` rows; existing `purchase` ownership still readable |
| NEM-013 | Full access matrix (user state × book state × endpoint) in both flag modes against real PostgreSQL; 403 compatibility; owned-book reader / Escucha Activa regression; mobile offline revalidation |

Coverage thresholds stay at 80%; no mission may lower them.

## Unresolved decisions

| # | Decision | Blocks |
|---|---|---|
| O-1 (NEM-012) | Validation environment — needs the unmerged staging work (NEM-006A/006C), which NEM-010 D1 also waits on | Step 3 |
| ~~B-1~~ | ~~Per-title purchase~~ — **decided: retired, token-only** | — |
| B-11 | Settlement basis for historical direct purchases (Stripe-sourced) | settlement, not the rollout |
| B-2 | Transition for subscribers reading non-owned books | Step 8 |
| B-3 | Household access to other members' acquisitions | Step 9 |
| B-5 | 90-day expiry for tokens bought by free accounts / gift tokens (copy on the unlock screen) | NEM-012 copy |
| B-10 | Historical bypass rows | Step 9 |
| O-2 (NEM-013) | Offline reading of downloaded non-owned books after cut-over | Step 9 |
| C-11 / C-16 | Plan copy and Terms of Service text (legal) | Step 8 |
| O-2 (NEM-014) | Make the integration job a required check | none (later) |
