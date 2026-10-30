# Release A — Emergency Recovery Plan

**Principle:** recovery must **never** reopen the NEM-011 ownership bypass, the non-atomic redemption, or the NEM-015 per-title purchase endpoint. A full `git revert` of the Release A merge would do all three, so it is **not** a recovery option — it is a last resort that needs explicit Product Owner approval at the time.

## 1. Recovery tiers

| Tier | Trigger (examples) | Action | What stays in force |
|---|---|---|---|
| **R1 — mobile only** | Mobile acquisition UI misbehaves | Republish the previous EAS OTA update (`eas update --branch <prod> --republish …` per `docs/eas-build.md`). Server untouched | Everything server-side. Note: the previous mobile bundle restores the app-level paywall (it never called the bypass) |
| **R2 — NEM-012 rollback (verified)** | Web or API acquisition UX defect affecting readers | Revert **only** the NEM-012 code commits (§2) in one PR → normal CI → merge with PO approval → CD | NEM-011 (bypass closed, atomic redemption), NEM-014 (CI), NEM-015 (410 + payment-aware webhook) |
| **R3 — targeted forward fix** | A defect inside NEM-011 or NEM-015 code | Fix forward in a new PR that keeps the integration suite green (the CI job fails any change that reopens the bypass or double spend) | — |
| **R4 — stop the bleeding without code** | Redemption errors at scale | Communicate; investigate with logs. There is no server flag to disable redemption today (proposal: §4) | All of Release A |

## 2. R2 procedure — drilled 2026-10-30

Revert, in this order, on a branch from `main` after Release A is merged:

```
git revert --no-edit <mobile fix 5363b6f> <mobile 2afe429> <web 6dfd033> <api 1232673>
```
**Merge requirement:** Release A must reach `main` as a **merge commit, not a squash** (earlier PRs in this repository were squash-merged). A squash collapses NEM-011/012/014/015 into one commit and R2 is no longer a clean, per-mission revert. With a merge commit, the SHAs above are those on `release/acquisition-a` and remain valid on `main`.

Two expected conflicts, both resolved the same way every time:

| File | Resolution |
|---|---|
| `services/web/tests/e2e/highlight-to-share.spec.ts` | Keep the current version (its extra `/library/ids` + onboarding mocks are harmless) |
| `services/api/tests/integration/subscriptions/ownership-integrity.int-spec.ts` | Keep the current file **minus section 4** ("Subscription-free acquisition"); keep sections 1–3 and 5 |

**Drill result** (local, temporary branch, never pushed): reverts applied with exactly those two conflicts; afterwards NEM-011 (`acquisition_required`, `skip_locked`) and NEM-015 (`title_purchase_discontinued`, `async_payment_succeeded`) were still present; **api integration 19/19, api unit 946/946, web unit 303/303, mobile unit 179/179**, typecheck clean in all three.

**Customer effect of R2:** reading unchanged; the unlock UI disappears (token buyers lose the UI redemption path again until a fix ships); free accounts can no longer reach the mobile app until R1/fix; "+" stays free-only (NEM-011).

## 3. Data

Release A changes **no schema and no data**. Rows it creates (`user_books` with `purchaseType` `token` / `free`, redeemed `token_ledger` rows) are valid under every tier — recovery never deletes or edits them. The read-only reconciliation (`nem-011-ownership-reconciliation.md`) is re-run after any recovery.

## 4. Proposals for faster recovery (not implemented — need approval)

1. **Required CI check:** make `api — integration tests (PostgreSQL)` a required status on `main`, so no revert or fix that reopens the bypass can merge (NEM-014 O-2).
2. **Server-side acquisition-UI flag** (e.g. `ACQUISITION_UI_ENABLED` read by `GET /subscriptions/me`), letting web/mobile hide the unlock UI without a deploy — a small follow-up mission.
3. **Redemption circuit breaker** — an env flag that answers `503 redemption_paused` (never falls back to non-atomic code) for incidents in the transaction path.
