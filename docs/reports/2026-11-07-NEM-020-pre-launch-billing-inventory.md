# NEM-020 — Pre-Launch Billing and Commercial Data Inventory: completion report (partial)

> **Status: PARTIAL (Rev 3, 2026-11-08) — preliminary production checks recorded; inventory outputs still outstanding.** Execution: **Appendix D** (Rev 3, supersedes the hand-pasted commands in Appendix C).
>
> **Readiness: ADR-007 acceptance — BLOCKED · NEM-021 — BLOCKED** (§17).
> - **CRITICAL (D6): production runs a *live* Stripe key, and `main` has a checkout that needs no login and no configured Stripe price** (`POST /gifts/checkout`, $9.99 / $24.99). Real charges appear possible today, contrary to Q4 (coordinated launch) and the pre-launch premise. No charge has been found. Containment is a production change and needs a separate Product Owner decision (§16, item 8).
> - Production identity, read-only session, migration head, and Part A/B checksums: **confirmed by the PO** (§7.3).
> - Production Q1–Q14 outputs, staging, webhook-secret status, and most of the Stripe checklist: **not yet received**.
> - A key-mode checker copy relayed through a chat tool was **silently corrupted** (D5). Appendix D fetches payloads from a pinned commit and verifies them, so nothing is hand-copied.
> - **Stripe mode verdict: key = live (PO-attested); webhook and price-ID modes UNDETERMINED.**

Evidence labels: **[VERIFIED]** run and observed in this iteration · **[CODE]** read from `origin/main` · **[DOC]** stated in repository documentation, not re-verified · **[BLOCKED]** not accessible · **[PROPOSED]** recommendation only.

---

## 1. Mission and objective

| | |
|---|---|
| **Mission** | NEM-020 — Pre-Launch Billing and Commercial Data Inventory |
| **Type** | VERIFICATION (read-only) |
| **Specification** | SA-003 Annex A, Draft PR [#36](https://github.com/Carloskfe/noetia/pull/36) (`docs/reports/2026-11-07-SA-003-annex-A-NEM-020-mission-draft.md` at `6a11e7f`) |
| **Authorization** | Product Owner, *NEM-020 Execution Authorization* (2026-11-07), items 1–5 |
| **Objective** | Aggregate-only inventory of billing and commercial data and Stripe objects, by mode, so ADR-007, NEM-021, and NEM-022 can decide what to preserve, migrate, archive, or retire — without writing anything |

Authorized: (1) validate the SQL on a disposable local database; (2) aggregate-only read-only production and staging inventory **where authorized access already exists**; (3) Stripe configuration and counts **through an authorized operator**; (4) the treatment matrix; (5) this report in a documentation-only Draft PR.

Safety conditions in force: no production writes, migrations, or configuration changes; no Stripe writes; no credentials, identifiers, or personal data disclosed; no elevated privileges or new credentials; operator instructions where read-only access is unavailable; stop on live paid subscriptions or live charges; no code change, merge, or deployment.

## 2. Date and status

| | |
|---|---|
| **Dates** | Executed and reported 2026-11-07; Rev 3 2026-11-08 |
| **Lifecycle status** | **In progress (partial)** — preliminary production checks recorded; inventory outputs await the operator (Appendix D); live-key exposure escalated (D6) |
| **Delivery state** | **Not merged.** Nothing deployed |
| **This report authorizes** | **Nothing.** The treatment matrix is a recommendation |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-07 | Local validation (V-1, V-2, V-4); access assessment; operator runbook; Stripe checklist; conditional treatment matrix. Production, staging, and Stripe results pending |
| 2 | 2026-11-07 | Phase 2 authorization (*NEM-020 Phase 2: Operator-Assisted Inventory*): Q12–Q14 approved; payloads and checksums re-verified from the pushed branch; session guard `default_transaction_read_only=on` added and validated; environment and identity gates; Appendix C execution sequence. Still no production, staging, or Stripe data |
| 3 | 2026-11-08 | PO preliminary evidence recorded (§7.3); D5 key-checker transcription corruption diagnosed; **D6 CRITICAL live checkout exposure** escalated; Appendix D pinned-commit fetch-and-verify procedure (validated locally); risks, decisions, and next actions updated. Inventory outputs still not received |

## 3. Repository baseline

| Item | Value |
|---|---|
| Schema baseline | `origin/main` `6a5e5c0` (migrations `000`–`067`, 68 files; head `ReconcilePlanDisplayPrices1748300000067`) |
| Specification | `docs/sa-003-readiness-audit-reporting-governance` `6a11e7f` (PR #36), Annex A |
| This branch | `docs/nem-020-pre-launch-billing-inventory`, created from `origin/main` `6a5e5c0` |
| Validation worktree | Detached `origin/main` `6a5e5c0`, scratch only, not committed |

## 4. Scope and exclusions

**In scope:** Annex A §5 items 1–6. **Excluded (Annex A §6):** any write, DDL, migration, `VACUUM`/`ANALYZE`; any Stripe create/update/cancel/refund/webhook change; exporting rows or identifiers; code, environment, or container changes; deciding retirement.

**Restrictions applied this iteration:**
- Access is used only **where authorized read-only access already exists**. None exists for Claude (§7.2), so no production or staging session was opened and no SSH connection was attempted.
- No new credentials or roles were created (a read-only database role or restricted Stripe key would be a new credential).

## 5. Executive summary

- **The inventory SQL is valid and safely read-only** [VERIFIED]. On a disposable PostgreSQL 16 database with migrations `000`–`067`: all Q1–Q11 queries ran without error (V-1), two passes in one session matched (V-2), and an `INSERT` inside the `READ ONLY` transaction was rejected (V-4).
- **Production, staging, and Stripe were not read** [BLOCKED]. Claude has no read-only database role, no general SSH access (the only key on this machine is the restricted offsite-backup key), and no Stripe access. Per the safety conditions, operator instructions are prepared instead (Appendices A and B).
- **Stripe mode verdict: UNDETERMINED.** Repository evidence only: CLAUDE.md says Stripe keys are "not yet in `.env.production`" [DOC]; Release A was validated with a test key (PR #14) [DOC].
- **Two safety discoveries:** (D1) the documented key-mode check in `docs/production-safety/02-stripe-mode-verification.md` §A **prints the raw secret line** if the key is quoted or a restricted `rk_` key [VERIFIED with fake values]; a safe replacement is in Appendix A. (D2) `stripe_processed_events` stores no mode, so Q9 cannot prove "no live webhook traffic"; Stripe Dashboard S5/S6 are the authoritative evidence.
- **Rev 3 — production preliminary checks** (PO-attested, 2026-11-08): database `noetia` / user `noetia`, read-only session on, 68 migrations, head `…067`; Part A/B checksums pass; Stripe key **live** in the environment file and the running API; Dashboard shows no payments or subscriptions; PO confirms no collections to date.
- **Rev 3 — CRITICAL (D6):** with a live key, `POST /gifts/checkout` (no authentication, inline price) and per-title purchase (inline `books.priceCents`) can create real Stripe charges now. Plan checkout can too if `plans.stripePriceId` holds real live IDs (Q1).
- **Rev 3 — D5:** the key-mode checker copy the operator first used had a one-character corruption from a chat relay; the committed payload is correct.
- **Three legacy commercial objects are outside Q1–Q11:** `subscriptions.tokenBalance` (pre-ledger credits), `books.priceCents` (per-title checkout), and Causas / gift-card checkout references. Supplementary queries Q12–Q14 are validated but **require Product Owner approval** before an operator runs them.

## 6. Work completed

1. Extracted Q1–Q11 verbatim from Annex A §9.1 (SHA-256 `2ebe975b…8b5712`).
2. Started a disposable PostgreSQL 16.13 container (`tmpfs`, `127.0.0.1` only), applied migrations `000`–`067` from `origin/main` `6a5e5c0`, and ran V-1, V-2, V-4, plus a fixture run with synthetic rows.
3. Assessed available access without connecting to any server (§7.2).
4. Built operator scripts: Part A (approved Q1–Q11, run twice in one read-only session, with session timeouts) and Part B (supplementary Q12–Q14, pending approval). Both validated end-to-end through the exact operator pipeline (single-line `base64` → `gunzip` → `psql -f -`).
5. Built and tested a non-disclosing Stripe key-mode check against five fake environment files.
6. Prepared the per-mode Stripe Dashboard checklist (S1–S8) and the conditional treatment matrix.
7. Removed the disposable database and the validation worktree.

## 7. Verified findings and evidence

### 7.1 Local validation results [VERIFIED]

| Check | Result | Evidence |
|---|---|---|
| **V-1** syntax and schema | **Pass.** Q1–Q11 ran with `ON_ERROR_STOP=1`, exit 0, on 68 applied migrations | Disposable DB; migration head `ReconcilePlanDisplayPrices1748300000067` |
| V-1 with data | **Pass.** With synthetic rows (8 users, 3 subscriptions, 2 ledger rows, 6 `user_books`), grouping, `FILTER`, and `cardinality("linkedUserIds")` returned the expected counts | Fixture script, disposable DB only |
| **V-2** repeatability | **Pass.** Pass 1 and pass 2 inside one `READ ONLY` session were identical | Part A output diff |
| **V-3** migration head | **Local only.** Q11 returns `067 / 066 / 065`. Production and staging not yet run | — |
| **V-4** negative write | **Pass.** `INSERT` inside `BEGIN TRANSACTION READ ONLY` → `ERROR: cannot execute INSERT in a read-only transaction` | Disposable DB |
| Session guard | `SHOW transaction_read_only` → `on` at the start of Part A and Part B | Part A/B output |
| No residual writes | Row counts unchanged after every read-only run | Disposable DB |

**Baseline schema facts useful to the matrix** [VERIFIED on the migrated disposable DB; seed values, not production values]:
- `plans`: 6 seeded rows (Individual, Dual Reader, Family × month/year). All `stripePriceId` values are placeholders (`price_changeme`, `price_family_*_placeholder`) → Q1 reports `placeholder`.
- `token_packages`: 4 seeded rows (1, 3, 5, 10 tokens), all `price_token_*_placeholder`.
- `stripe_processed_events` columns: `eventId`, `type`, `processedAt` — **no mode column** (D2).
- `subscriptions` also carries `tokenBalance`, `nextTokenIssuanceAt`, `stripeEventId`; `books` carries `priceCents`; `gift_cards` carries `stripeSessionId` and `claimToken` — not covered by Q1–Q11.

### 7.2 Access assessment

Rev 3: unchanged. Claude still has no read-only access; all production and staging evidence comes from the operator.

| Target | Authorized read-only access for Claude? | Evidence | Treatment |
|---|---|---|---|
| Production database | **No** | No read-only role exists; creating one is a new credential (prohibited). Only SSH key on this machine is `noetia_backup_ed25519` (offsite-backup, restricted); using it for queries would exceed its purpose. A root SSH session is write-capable, which Annex A §3.2 excludes | Operator runs Appendix A |
| Staging database | **No** | Same host and same constraints | Operator runs Appendix A |
| Production / staging key mode (S1) | **No** | Requires server access | Operator runs Appendix A, A.2 |
| Stripe test and live (S2–S8) | **No** | Claude has no Stripe access and must never receive a secret (Annex A §3.3) | Operator follows Appendix B |
| Offsite backups on this machine | Not used | Restoring a production backup locally would move personal data off the server and was not authorized | Not recommended |

No connection to production, staging, or Stripe was attempted.

### 7.3 Inventory results

Rev 3 label: **[PO]** attested by the Product Owner as operator, 2026-11-08; not observed by Claude.

| Item | Production | Staging | Status |
|---|---|---|---|
| Step 2 identity | `noetia` / `noetia`, read-only on, 68 migrations, head `ReconcilePlanDisplayPrices1748300000067` **[PO]** | — | Prod **done**; staging pending |
| Container health | DB healthy **[PO]** | DB healthy **[PO]** | Done |
| No deploy / migration in progress (OC-2) | None detected **[PO]** | — | Done |
| Part A / Part B checksums | Pass **[PO]** | (same session) | Done |
| Key-mode checker checksum | **Failed on first copy** (D5) | — | Re-run from Appendix D |
| S1 key mode | **live**, env file and running API **[PO]** | — | Re-confirm with the verified checker (D5) |
| S1 webhook secret | — | — | **Unknown** (the corrupted copy broke exactly this test) |
| Q1–Q11 output | — | — | **Not received** |
| Q12–Q14 output | — | — | **Not received** |
| S5 / S6a | "No payments or subscriptions shown"; no collections ever **[PO]** | n/a | Mode not stated; record live and test separately |
| S2–S4, S6b, S7, S8 | — | n/a | **Not received** |

### 7.4 Stripe mode verdict (doc 02 decision matrix)

**Rev 3: key = live (PO-attested) / webhook = ? / price IDs = ? — UNDETERMINED overall.**
- CLAUDE.md §Infrastructure ("Keys not yet in `.env.production`") is **out of date** [DOC contradicted by PO evidence].
- Webhook mode needs S2 (live endpoint present?) and S1 webhook-secret status. Price-ID mode needs Q1 (`placeholder` vs real IDs) and S3 live.
- Zero live subscriptions and zero collections (PO) satisfy the pre-launch premise, so **no stop condition has triggered**. The live key creates an exposure (D6), not evidence of a charge.

### 7.5 Discoveries

- **D1 — doc 02 §A can disclose the secret** [VERIFIED with fake values]. Its `sed` only matches `sk_live_`/`sk_test_`. For a quoted value or a restricted key (`rk_…`) it prints the **raw line**, including the secret. The replacement in Appendix A.2 prints only `live` / `test` / `empty` / `absent` / `unrecognized`, notes restricted keys and duplicate lines, and was tested on five fake files.
- **D2 — Q9 cannot show mode.** `stripe_processed_events` stores no `livemode`. Q9 shows only whether webhook traffic was processed and when.
- **D3 — legacy objects outside Q1–Q11.** `subscriptions.tokenBalance` is the pre-ledger `creditsRemaining` column (migration `038`), still on the entity (`subscription.entity.ts:59`) while balances are now computed from the ledger (`subscriptions.service.ts:326,340`) [CODE]. Any non-zero value may represent historical token rights (PO-024). `books.priceCents` drives a single-title Stripe checkout (`subscriptions.service.ts:236-244`) [CODE]. Q12–Q14 size these.
- **D5 — chat-relay corruption of the key checker (Rev 3)** [VERIFIED]. The operator's decoded checker hashed to `90551c89…82fd2c` instead of `91aadfae…5e719`. A search over single-character substitutions of the committed payload found exactly one match: base64 position 406, `3` → `n`, which decodes `ws=(w~` as `ws=(v~`. The webhook-secret result was therefore wrong; the key-mode logic was unaffected. **The committed payload is correct.** Cause: the commands passed through a chat tool before reaching the terminal. Appendix D removes hand copying.
- **D6 — CRITICAL: live charges possible before launch (Rev 3)** [CODE, `origin/main` `6a5e5c0`, combined with PO-attested live key].

  | Path | Auth | Price source | Live exposure |
  |---|---|---|---|
  | `POST /gifts/checkout` (`gifts.controller.ts:9`, `gifts.service.ts:62-71`) | **None** (only the global `ThrottlerGuard`) | Inline `price_data`: 999 / 2499 cents | **Any visitor, now** |
  | `POST /subscriptions/books/:bookId/purchase` (`subscriptions.service.ts:236-244`) | JWT + confirmed email | Inline `books.priceCents` | If any published book has `priceCents > 0` (Q13) |
  | `POST /subscriptions/checkout` (`subscriptions.service.ts:211-214`) | JWT + confirmed email | `plans.stripePriceId` | If those IDs are real live prices (Q1) |
  | `POST /subscriptions/tokens/purchase` (`subscriptions.service.ts:260`) | JWT + confirmed email | `token_packages.stripePriceId`, placeholders rejected | Low (Q7) |

  This contradicts Q4 (no tier sells before the coordinated launch, SA-003 Rev 7) and would place real charges on a system with no refund, dispute, or reconciliation process (SA-003). It is not a stop condition, because no live charge exists. Containment (remove or replace the live key, or disable the routes) is a production configuration or code change **outside this mission**; it needs a separate PO decision (§16, item 8).
- **D4 — the report index is not on `main`.** `docs/reports/README.md` exists only in PRs #23 and #36. Creating it here would conflict with both, so this PR does not add an index row (§14).

## 8. External references

None. No external page was used in this iteration.

## 9. Risks

| Rating | Risk | Mitigation |
|---|---|---|
| **High** | Running doc 02 §A as written could print the production secret key to a terminal or screen share (D1) | Use Appendix A.2 only; correct doc 02 in a later authorized change |
| **Critical** | A live charge from an unauthenticated gift checkout, or a per-title purchase, before the coordinated launch (D6) | PO containment decision (§16 item 8); operator checks live Checkout Sessions and Payments (Appendix D, Step 6) |
| **High** | Webhook and price-ID modes unknown, so NEM-021/022 cannot be planned against confirmed facts | Operator completes Appendix D |
| **High** | Commands or payloads corrupted in transit through a chat tool (D5) | Appendix D: fetch from pinned commit, fail closed on checksum mismatch |
| Medium | Operator transcription errors in counts | Part A runs twice per session (V-2); operator returns raw aggregate output, not retyped |
| Medium | CLAUDE.md states Stripe keys are not in production (stale) | Correct in a later authorized documentation change |
| Medium | Legacy token rights in `subscriptions.tokenBalance` overlooked if Q12 is not approved | PO decision 2 |
| Medium | Staging migration head may differ from production (staging was seeded from a mission branch) | Q11 recorded per environment; stop condition |
| Low | Production query load | Small aggregate queries; `statement_timeout 30s`, `lock_timeout 5s` |

## 10. Decisions

**(a) Made under existing authority:**
- Production, staging, and Stripe items treated as **blocked** and handed to the operator, because Claude has no authorized read-only access and creating one is prohibited.
- Session timeouts added before the approved queries in the operator script (`SET` only; the Q1–Q11 text is unchanged).
- The Annex A SQL was run **twice in one session** in the operator script, to meet V-2 in a single command.
- Counts below 5 will be reported as `<5` in the published update, except the counts Annex A §9.1 exempts.
- Rev 3: PO-attested preliminary checks recorded as **[PO]**, distinct from **[VERIFIED]**.
- Rev 3: D6 escalated without any containment action; containment is outside the mission.

**(b) Requiring Product Owner approval:** see §16.

## 11. Recommendations

### 11.1 Treatment matrix (conditional; recommendation only) [PROPOSED]

Inventory facts are pending; each row states the recommendation **if** the facts confirm the pre-launch premise (no live subscriptions, no live charges). Any contrary fact triggers the stop condition instead.

| Object | Inventory facts | Recommended treatment | Rationale |
|---|---|---|---|
| `plans` rows | Q1 | **Retire** after the NEM-021 catalog is live; keep read-only while any row references them (NEM-023 retires) | ADR-007 draft Decision 1: one price authority |
| `subscriptions` rows | Q2, Q3; S5 | If S5 live = 0: **archive** all rows (test/dev) before NEM-023; **migrate nothing billable** | ADR-007 Option B replaces the one-row-per-user model |
| `subscriptions.tokenBalance` | Q12 | If all 0: **retire** with the table. If any non-zero: **PO decision** before any drop (possible token rights) | PO-024 |
| `users.stripeCustomerId` | Q4; S1, S4 | If test-mode only: **archive** the mapping, and do **not** carry test customers into live mode | Test-mode IDs do not exist in live mode |
| `token_ledger` | Q5 | **Preserve**. Report `active_past_expiry` to the PO; do not change statuses in this mission | PO-024; issued token rights |
| `user_books` | Q6 | **Preserve**. Legacy `purchase` and bypass rows go to the PO (Rev 5 Q1) | PO-021; permanent ownership |
| `token_packages` | Q7; S3 | **Migrate the shape** into the catalog as one-time prices (NEM-021); retire placeholder price IDs | One price authority |
| `books.priceCents` | Q13 | **PO decision**: keep per-title sale as a catalog product or retire the path | Catalog scope (open) |
| `gift_cards` | Q8, Q14 | **Preserve** unredeemed and claimed rows (token rights); archive checkout references after reconciliation | PO-024 |
| `stripe_processed_events` | Q9 | **Archive** at the live-mode cutover; the new design must record mode | D2; ADR-007 Decision 6 |
| `subscription_invites` | Q10 | **Archive** at cutover; `household_memberships` replaces them | ADR-007 Decision 3 |
| `courtesy_token_quotas` | Q10 | **Preserve**; outside the billing rebuild | Author/narrator/publisher policy |
| `user_cause_preferences` | Q14 | **Preserve** | Causas Noetia product rule |
| Stripe test-mode objects | S2–S7 test | **Leave in place** for NEM-022 testing; archive unused test products later. Do not use "delete all test data" without a PO decision | Test evidence |
| Stripe live-mode objects | S2–S7 live | If none: nothing to do. If products/prices exist with no charges: **archive**, recreate through catalog lookup keys | ADR-007 Decision 1 |
| Webhook endpoints | S2, S8 | **Recreate with a pinned API version** in NEM-022; no change now | SA-003 V-register (API version) |
| Customer Portal | S7 | Plan switching should be **off** until NEM-022; no change now | ADR-007 Decision 4 |

### 11.2 Required corrections
0. **Urgent, separate from this mission:** PO decision on D6 containment. Recommended: remove the live key from production (or replace it with a test key) until the M10 gate review, since nothing should sell before M11; the alternative is a code change disabling the inline-price routes.
1. Complete Appendix D (operator).
2. Correct `docs/production-safety/02-stripe-mode-verification.md` §A (D1) in a later authorized documentation change. Not changed here; it is outside this mission's deliverables.

### 11.3 Optional
- Add the index row to `docs/reports/README.md` once a reports index exists on `main` (D4).

## 12. Changes made

| Item | Change |
|---|---|
| Files | `docs/reports/2026-11-07-NEM-020-pre-launch-billing-inventory.md` (**new**, this report; Rev 3 edits this file only) |
| Database, migrations, backfills | **None** on production or staging. A disposable local container received migrations `000`–`067` and synthetic fixtures, then was destroyed |
| Configuration and secrets | **None** |
| External services (Stripe, providers, DNS) | **None.** No Stripe access |
| Deployments | **None** |
| Servers | **No connection** to production or staging by Claude. Rev 3 evidence was gathered by the PO as operator |

## 13. Tests and validation

| Run | Result |
|---|---|
| Migrations `000`–`067` on disposable DB | Pass (68 applied) |
| V-1 Q1–Q11, empty and with fixtures | Pass |
| V-2 two passes in one session | Pass (identical) |
| V-4 `INSERT` in `READ ONLY` | Pass (rejected) |
| Operator pipeline (`base64` → `gunzip` → `psql -f -`) | Pass (byte-identical output) |
| Part B (Q12–Q14) syntax | Pass |
| Key-mode check on 5 fake env files | Pass (no secret printed); doc 02 §A printed a fake secret (D1) |
| Rev 3: Appendix D fetch from pinned commit | Pass: all three payloads match; a wrong expected hash is rejected and the variable is cleared |
| Rev 3: Appendix D command shapes on disposable DB (`000`–`067`) | Pass: prod-shape (`docker compose exec -T -e PGOPTIONS…`) and staging-shape (`docker exec -i -e PGOPTIONS…`) Part A and B exit 0, no errors, end `ROLLBACK`, identical output |
| Rev 3: D5 diagnosis | Single substitution `3`→`n` at base64 position 406 reproduces `90551c89…` exactly |
| V-3 on production / staging | **Not run** (blocked) |
| Production, staging, Stripe inventory | **Not run** (blocked) |

No unit tests: no code was written.

## 14. Deviations and discoveries

- **Deviation 1 — no index row.** Annex A §15 asks for an index row; `docs/reports/README.md` is not on `main` (D4). Adding it here would duplicate PRs #23 and #36.
- **Deviation 2 — session timeouts** added to the operator script (§10a). The approved query text is unchanged.
- **Deviation 3 — supplementary queries Q12–Q14** prepared outside the approved set; **not run** anywhere except the disposable database, pending PO approval.
- Discoveries D1–D4 (§7.5).

## 15. Protected-systems confirmation

Not modified: reader / Escucha Activa; book ownership (`user_books`); token ledger; production and staging data; billing code and Stripe configuration; business-rule engines; infrastructure; application code. The existing local dev stack (`noetia-*` containers) was not touched.

## 16. Open questions and unresolved items

| # | Item | Owner |
|---|---|---|
| 1 | Operator execution of Appendix A (production, staging) and Appendix B (Stripe, both modes) | PO / operator |
| 2 | ~~Approve or reject supplementary queries Q12–Q14~~ **Approved 2026-11-07 (Phase 2)** | PO |
| 3 | Whether staging is included (Annex A §16) — prepared as included | PO |
| 4 | Small-count threshold (5 proposed) | PO |
| 5 | Where the report index row should live (D4) | PO |
| 6 | Authorization to correct doc 02 §A (D1) | PO |
| 7 | Canonical placement of the NEM-020 mission document (still SA-003 Annex A) | PO |
| 8 | **D6 containment (urgent):** remove/replace the live key, disable inline-price checkout routes, or accept the risk until M11. Needs its own authorization; not part of NEM-020 | PO |
| 9 | Correct CLAUDE.md §Infrastructure (Stripe keys are in production) — separate documentation authorization | PO |
| 10 | Operator execution of Appendix D (key mode re-run, Q1–Q14 prod, staging, Stripe both modes) | PO / operator |

## 17. Next recommended action

1. **PO decides D6 containment** (§16 item 8). This does not block the read-only inventory, which can proceed in parallel.
2. The operator runs **Appendix D** and returns the raw aggregate output, the filled Appendix B checklist (live and test separately), and the attestation.
3. If any stop condition triggers, stop and notify the Product Owner; do not continue.
4. Otherwise Claude adds Rev 4: results with small-count suppression, the doc 02 verdict, and the final treatment matrix. ADR-007 acceptance and NEM-021 stay BLOCKED until then; independent review (ChatGPT) precedes either decision.

*Recommendation only.*

---

## Appendix A — Operator runbook: database inventory and key mode

> **Rev 2:** A.1 and A.2 remain valid. **A.3 and A.4 are superseded by Appendix C**, which adds environment gates and the session read-only guard.

**Rules.** Read-only. Each command is **one line**; never paste multi-line text into the SSH terminal (CLAUDE.md, 2026-05-12 outage). No file is written on the server. Do not paste any secret anywhere. If a command prints anything that looks like a key, stop.

**Stop immediately and notify the Product Owner if:** `transaction_read_only` is not `on`; any `ERROR` appears; Q11's head differs from `ReconcilePlanDisplayPrices1748300000067` (record it, then stop); a key line is printed raw; or any step would need a write.

### A.1 Integrity check (any machine)

Each payload must decode to the expected SHA-256 before use:

| Payload | Expected SHA-256 of decoded script |
|---|---|
| Part A (approved Q1–Q11, twice) | `47006ae346c39cbbf30a1e9745bc0998ee74184914b6a117f86d34202d872c64` |
| Part B (supplementary Q12–Q14 — **only if approved**) | `4dee07a517dd1225b0ae4ae977a02a353cc90ef5ea467b142c7d909949906e67` |
| Key-mode check (A.2) | `91aadfae43e4e76adfea1bc0bd7c4fdfb60b4e2f32f8e7c7d6e7006db7c5e719` |

```bash
echo "$PARTA" | base64 -d | gunzip | sha256sum
```
(`$PARTA` = the Part A payload below, pasted as a single line in place of the variable.)

**Part A payload (single line):**
```
H4sIAAAAAAACA+1W3W7iRhS+5ymOkCKcCiKSdNtu0qzkEGeXLoEEk25XqmRN7AFGsT1ezxhCX6jv0SfrmR/bOLDb9rISXDGemTPf+c53fno9GHt3vf5ZH+5JLsG9AJJlOV/RCL4UNGdUwMNp7+H0FBzf7fX75+CmKX0BF/768+3J6XEX8iIFuWYhBZbCZOxBTknU42m8AUGFYDwF59fe2fFJy/dmICSRNKGpDCRLKC8kXEHnvC86l3o75uHz9s4btXHtvR+OYTZ1x747mA0nY5h67g2+NfqMtz5MPoHMSSpIKPGxQD0fqOcvW61eD9FDFuPuBcR0QcINhESSmC8KCmJJMgpOShL0kqQRkIQXqcT/OYWUS8hoLnhKYojwzjECHHmDGajzXXRW0nxF4i60zbUBOiXauEzIy33O5yymein5M03FPc0HmzCm7W4LzG/g+h58+uCNoS1kzjJ6nyOJw6gNo+FHDzqZWgZHHXDHNztHxpOZPXaE3oV0yeOI5ked0nj923f753el+XBJ0gXGowMzhaQTc/4sFIVx09RenEMfxo+jEUymO1sYutIkTTK5aVrzRr5ysAbeAQ9huj4YVCwKtE5at9PJnQkfPnLjTeH68yv6bZDPQBRPIkQMSgMCnjZaaYXo6sAu+RoSkm5Qm3Oa0xTFSsDXkBsXyxCXdweTx/HM+e5YQcv5WtTB0xvWa3/LAjqvT6+ZXAZmO8AXXl1Ei7fD0QwdcpDZqYeizCOGSmNy47Rjlj7T6FHQfBgJNPcO+rVNsxkkNHlCdRqGmr6/n04e7xVTxouaObO2jJ3vMqaIBmfFiPmniL7EPIACkTRTIDsxUchO6jQQJzus7QEnWiPvdga/TDCjTWAzTGRlKELRiJO2+qgUVHlx2j3rntdO6KX14XsNTYASEUsXdUzDQkieIOoq3iXyr/BvIzmw90p1Y5Yphe9EtLS/G1Y8KDkWmMAg0wzovxbyG9D1AItRtEB8yLrcIGAlUhsuh75kLMf6u8JChCVthbvIm+T4DRmPi/Jz76mQvYwI2dM3NlV0lMXuv9XwDhUWBmawecYWIINKuBLLB4pi7Rxri+ZMoGAEBkZl/244dtpMiIJGeOv44gIlRNWdOcvxtNnpwp372/5jMalOGZlr5gLLXKWPbW9rmWx/tdT/AHydYiSWLFO8k/BLwQRTsjQxcDL0T4lZfxLsD5TUJRaaMC4ibBC2fUgmYwpZkWPpxP5Wkd4uP83QVnsP7fbLzdCfDcfqQqET3JQLLZFWpZbgSdXh2sem8a1ksK79aFWVkfCZLBCs86rLvWpepikNVNtq7zQwE9L/2KdMbLBbfbsZbNf8PS1hq/18qyOYxypnKzq23bLM/AQLNpe6vm51hdd1vslHs36p+4G5v12TGhXJPvYW0fIQhx7MXluJ6EqxWuW5Q1cs0v2Hz2FNn5bosJpe5nMWmlbF1PyxoK+SuYTUNVlVPVNnjE2kPTu2R5jKVe0HFlkjj5r5Uw5QfSywqEoVNkyHFZN2XAp5keP/DU6KWPLEV5vnThsISiv/2KqsyZzHDRL8x7uyZpig6SQqK4rexSnsQcEyW7gKNEpDRoncytbgr9Go52osalVScQoJW+SmQixx0MRE4ynWs0SAXGKuhUuaEP03NKOkbkAo2EYCGkYqS9tlC0df9D3J4MbzB5hhd8MZYLv7nYZLDldXV743mGBi3Lu+j6vDhHuYcA8T7mHCPUy4hwn3MOEeJtzDhHuYcP+nE+50Mhpdu4OPl62/AWux6gqUFgAA
```

**Part B payload (single line; run only if the Product Owner approves Q12–Q14):**
```
H4sIAAAAAAACA41STW+bQBC9+1c8cQmuTOR8VKpqtRImpLGKwQGsKCe0hom9Mix0d0maf98Fk8RVWrUcOOzM+5g34zgI/aUzPZ9ixaTG/DOS9WoV+Es/TN34Hj9akpwUbs/Onduzy1PErUAUBvfgD9A7wkrWRZtrRE+CJFjTyPrR9JtSdTpK/BRKM00VCZ1pXlHdanzBycVUncz6clnn++PKx64w978tQqSxGyauly6iELHvXvW6BnUT3UFLJhTLNa9FJokVWS3K59nIcTqnKGnL8mc0JB3VblQuedN1Qtd7EtiwkomckNdlWwnYjSSnpGJr/Fu5pIJrFVPFuOBia00gSbCKCnCBim8l65mmF5/Gxn/geym8aB2m9ocxrhdB6sew72782IfVq80PYha+YjqGm6AzlD1xvcsGHxND4AZ+4vl2sl7av8PGkwE2NGeqrSYjHL6/CQv6qdOOZaFU26FcbWGRIIxShOsg6Al7C11nxocuXMfREseBqSHRiz5KzXVJUMz8GqZ3sDd1vVenjeQ5eWbBCoXkw/KhTHglDZhEG0IT+I7yvdnzP5N7o3zLrX8rsl5z8r9IuOEVLK5W7abkakeFdczVvLweJu+ph4kv4bFWMWVa6YHMCeRmLiYKbPmDdnImi9dpcNRh53XbBdFd4+uU9rtpO7VWkcxyI0LZkUZv793r68b/TNV5yjpPCkMMqg88IaXMFhfF++2/QQ63+DLMbBRHQTB3ve+z0S/HVpJeHQQAAA==
```

**Key-mode check payload (single line):**
```
QkVHSU57RlM9Ij0ifSAvXlNUUklQRV9TRUNSRVRfS0VZPS97dj1zdWJzdHIoJDAsMTkpOyBnc3ViKC9bIidcciBdLywiIix2KTsgbisrOyBtPSh2fi9eKHNrfHJrKV9saXZlXy8pPyJsaXZlIjoodn4vXihza3xyaylfdGVzdF8vKT8idGVzdCI6KHY9PSIiKT8iZW1wdHkiOiJ1bnJlY29nbml6ZWQiOyBrPSh2fi9ecmtfLyk/IiAocmVzdHJpY3RlZCBrZXkpIjoiIjsgcHJpbnQgIlNUUklQRSBNT0RFOiAiIG0ga30gL15TVFJJUEVfV0VCSE9PS19TRUNSRVQ9L3t3PXN1YnN0cigkMCwyMyk7IGdzdWIoL1siJ1xyIF0vLCIiLHcpOyB3cz0od34vXndoc2VjXy8pPyJwcmVzZW50Ijoodz09IiIpPyJlbXB0eSI6InVucmVjb2duaXplZCJ9IEVORHtpZighbikgcHJpbnQgIlNUUklQRSBNT0RFOiBhYnNlbnQiOyBpZihuPjEpIHByaW50ICJXQVJOSU5HOiAiIG4gIiBTVFJJUEVfU0VDUkVUX0tFWSBsaW5lcyAobGFzdCBvbmUgd2lucykiOyBwcmludCAiV0VCSE9PSyBTRUNSRVQ6ICIgKHdzPT0iIj8iYWJzZW50Ijp3cyl9
```

Below, `<PARTA>`, `<PARTB>`, and `<KEYCHECK>` mean "paste that payload here", on the same line.

### A.2 Key mode (S1) — prints only a mode word

Production, environment file:
```bash
cd /opt/noetia && awk "$(echo <KEYCHECK> | base64 -d)" .env.production
```
Production, running API container (catches a file that differs from what is running):
```bash
cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml exec -T api sh -c 'printf "STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET"' | awk "$(echo <KEYCHECK> | base64 -d)"
```
Staging, environment file:
```bash
cd /opt/noetia-staging && awk "$(echo <KEYCHECK> | base64 -d)" .env.staging
```
Expected output: `STRIPE MODE: live|test|empty|absent|unrecognized` (optionally `(restricted key)`) and `WEBHOOK SECRET: present|empty|absent|unrecognized`. Nothing else.

### A.3 Database inventory — production

```bash
cd /opt/noetia && echo <PARTA> | base64 -d | gunzip | docker compose --env-file .env.production -f docker-compose.server.yml exec -T db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f -
```
Only if Part B is approved:
```bash
cd /opt/noetia && echo <PARTB> | base64 -d | gunzip | docker compose --env-file .env.production -f docker-compose.server.yml exec -T db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f -
```

### A.4 Database inventory — staging

Uses the staging database container's own `POSTGRES_USER` / `POSTGRES_DB` (no password is printed):
```bash
docker exec -i "$(docker ps --format '{{.Names}}' | grep -m1 -E '^noetia_staging-db')" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -P pager=off -f -' < <(echo <PARTA> | base64 -d | gunzip)
```
If no `noetia_staging-db` container exists, record "staging database not present" and skip.

### A.5 What to return

The full terminal output of A.2–A.4 (aggregates only: plan names, statuses, counts, dates, migration names). It contains no identifiers by design. Do **not** return the payloads, environment files, or any other output.

## Appendix B — Operator checklist: Stripe Dashboard (read-only)

**Rules.** View only. Do not create, edit, archive, cancel, refund, or export anything; do not enable or disable webhooks; do not create API keys. Record counts and yes/no only — no IDs, names, emails, or per-customer amounts. Fill in **test mode** and **live mode** separately (Dashboard mode toggle).

**Stop immediately and notify the Product Owner if** live mode shows any subscription that is `active`, `trialing`, or `past_due`, or any succeeded live charge.

| # | Item | Where | Test mode | Live mode |
|---|---|---|---|---|
| S1 | Key mode (from A.2) and webhook secret present | Appendix A.2 | — | — |
| S2a | Webhook endpoints: count | Developers → Webhooks | | |
| S2b | For each: host only (`noetia.app` / `staging.noetia.app` / other), API version, number of enabled events, enabled yes/no | same | | |
| S3a | Products: active / archived | Product catalog | | |
| S3b | Prices: recurring / one-time; active / archived; currencies | same | | |
| S4 | Customers: count | Customers | | |
| S5 | Subscriptions by status: active, trialing, past_due, canceled, other | Subscriptions | | |
| S6a | Payments: succeeded charges count | Payments | | |
| S6b | Refunds count; disputes count | Payments | | |
| S7 | Customer Portal enabled? Cancel allowed? Plan switching allowed? | Settings → Billing → Customer portal | | |
| S8 | Account default API version | Developers (Workbench / API version) | | |

Operator attestation to return with the checklist: *"No Stripe write action was taken, and no secret was displayed or shared."*

## Appendix C — Phase 2 operator execution sequence (Rev 2)

> **Rev 3:** the gates and C.1 confirmations remain valid. The **commands** are superseded by **Appendix D**, which removes hand-pasted payloads (D5).

Authorized by the Product Owner, *NEM-020 Phase 2: Operator-Assisted Inventory* (2026-11-07). **Supersedes the commands in A.3 and A.4**, which lack the session guard. A.1 payloads, checksums, and the A.2 key-mode check are unchanged and re-verified (§C.0).

### C.0 Review performed before release (Rev 2) [VERIFIED]

- The three payloads published in this report were decoded from the **pushed** branch and match their SHA-256 values (A.1).
- Static scan of both decoded SQL scripts: no `INSERT`, `UPDATE`, `DELETE`, DDL, `GRANT`, `COPY`, `VACUUM`, `LOCK`, `DO`, `CALL`, `SET ROLE`, `nextval`, or admin function. Only `SET statement_timeout` / `SET lock_timeout`.
- Key-mode awk program: no `system()`, `getline`, pipe, or redirect (the single `>` is the comparison `n>1`).
- **Second safeguard added: `PGOPTIONS='-c default_transaction_read_only=on'`.** On a disposable database (migrations `000`–`067`) and through the exact `docker compose … exec -T -e …` command shape: identity check returns `ro_default = on`; an `INSERT` and a `CREATE TABLE` **outside** an explicit transaction both fail with `cannot execute … in a read-only transaction`; Part A and Part B run with exit 0 and no errors under the guard.
- **Read-only role:** none is known to exist, and creating one is prohibited. The guard plus `BEGIN TRANSACTION READ ONLY` prevents accidental writes. It is **not** a security boundary: the `noetia` role is a superuser in the local image and could re-enable writes. Only the approved, checksummed scripts are run.

### C.1 Operator confirmations (answer before Step 1)

| # | Confirmation |
|---|---|
| OC-1 | I am the authorized operator, with my own existing access. No credential was created or shared for this |
| OC-2 | No deploy, migration, or CD run is in progress (`gh run list --limit 3` shows none running) |
| OC-3 | I will paste each command as **one line**, and return only the outputs listed |
| OC-4 | I will stop at any gate failure and report it |

### C.2 Sequence and gates

`<PARTA>`, `<PARTB>`, `<KEYCHECK>`: the A.1 payloads, pasted in place on the same line. `G` below means exactly `-e PGOPTIONS='-c default_transaction_read_only=on'`.

| Step | Where | Command (one line) | Gate (stop if not met) |
|---|---|---|---|
| 1 Env check, prod | server | `hostname; cd /opt/noetia && pwd && git rev-parse --short HEAD && docker compose --env-file .env.production -f docker-compose.server.yml ps db --format '{{.Name}} {{.Status}}'` | `/opt/noetia`; db container `Up`/healthy |
| 2 DB identity, prod | server | `cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -tA -c "SELECT current_database(), current_user, current_setting('default_transaction_read_only'), (SELECT count(*) FROM migrations), (SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1);"` | `noetia\|noetia\|on\|68\|ReconcilePlanDisplayPrices1748300000067` |
| 3 Checksums | server | `echo <PARTA> \| base64 -d \| gunzip \| sha256sum; echo <PARTB> \| base64 -d \| gunzip \| sha256sum; echo <KEYCHECK> \| base64 -d \| sha256sum` | Exactly the three A.1 values |
| 4 Key mode, prod | server | A.2 production commands (file and running container) | Output is only mode words |
| 5 Inventory A, prod | server | `cd /opt/noetia && echo <PARTA> \| base64 -d \| gunzip \| docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f -` | `transaction_read_only = on`; no `ERROR`; ends `ROLLBACK` |
| 6 Inventory B, prod | server | Same as Step 5 with `<PARTB>` | Same |
| 7 Env check, staging | server | `cd /opt/noetia-staging && pwd && docker ps --format '{{.Names}} {{.Status}}' \| grep -E '^noetia_staging-db'` | One `noetia_staging-db…` container `Up`. None → record "no staging DB", skip 8–10 |
| 8 DB identity, staging | server | `docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$(docker ps --format '{{.Names}}' \| grep -m1 -E '^noetia_staging-db')" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "SHOW default_transaction_read_only;" -c "SELECT current_database(), current_user, (SELECT count(*) FROM migrations), (SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1);"'` | First line `on`. Record database, user, count, and head (a head other than `…067` is recorded and reported, then stop) |
| 9 Key mode, staging | server | `cd /opt/noetia-staging && awk "$(echo <KEYCHECK> \| base64 -d)" .env.staging` | Mode words only |
| 10 Inventory A+B, staging | server | `docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$(docker ps --format '{{.Names}}' \| grep -m1 -E '^noetia_staging-db')" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -P pager=off -f -' < <(echo <PARTA> \| base64 -d \| gunzip)` then the same with `<PARTB>` | Same as Step 5 |
| 11 Stripe test mode | Dashboard | Appendix B, test column | View only |
| 12 Stripe live mode | Dashboard | Appendix B, live column | **Stop** on any live `active`/`trialing`/`past_due` subscription or succeeded live charge |

(In the table, `\|` is a literal `|`.)

### C.3 Return

Outputs of Steps 1–10 (aggregates, mode words, container names, migration names only), the filled Appendix B checklist, and the attestation: *"No write, restart, configuration change, or Stripe write was performed, and no secret was displayed or shared."*

## Appendix D — Pinned-commit fetch-and-verify sequence (Rev 3)

**Why.** A payload relayed through a chat tool was silently corrupted (D5). The repository is public, so the server fetches each payload directly from GitHub at the **immutable** commit `b705fd58c3362accd06808878c062d7b9f4cfe2f` (Rev 2; payloads unchanged since) and checks its SHA-256 in the same command. A corrupted download, a wrong URL, or a mistyped hash fails closed: the variable is cleared and every later command is skipped. Nothing is written to disk on the server. Validated locally (§13).

**Rules.** Copy commands from this report on GitHub or directly from the Claude Code terminal — **never through a chat tool**. Results may be shared with reviewers. Run one line at a time in one SSH session. C.1 confirmations apply. Stop on `MISMATCH`, any `ERROR`, any output other than mode words from the key checker, or any C.2 gate failure.

**1. Session setup and verification**
```bash
U="https://raw.githubusercontent.com/Carloskfe/noetia/b705fd58c3362accd06808878c062d7b9f4cfe2f/docs/reports/2026-11-07-NEM-020-pre-launch-billing-inventory.md"
get(){ curl -fsSL "$U" | awk -v L="$1" 'index($0,"**"L)==1{getline;getline;print;exit}'; }
K=$(get "Key-mode check payload" | base64 -d); [ "$(printf %s "$K" | sha256sum | cut -c1-64)" = 91aadfae43e4e76adfea1bc0bd7c4fdfb60b4e2f32f8e7c7d6e7006db7c5e719 ] && echo KEYCHECK OK || { echo KEYCHECK MISMATCH - STOP; unset K; }
PA=$(get "Part A payload" | base64 -d | gunzip); [ "$(printf '%s\n' "$PA" | sha256sum | cut -c1-64)" = 47006ae346c39cbbf30a1e9745bc0998ee74184914b6a117f86d34202d872c64 ] && echo PARTA OK || { echo PARTA MISMATCH - STOP; unset PA; }
PB=$(get "Part B payload" | base64 -d | gunzip); [ "$(printf '%s\n' "$PB" | sha256sum | cut -c1-64)" = 4dee07a517dd1225b0ae4ae977a02a353cc90ef5ea467b142c7d909949906e67 ] && echo PARTB OK || { echo PARTB MISMATCH - STOP; unset PB; }
```
Gate: three `OK` lines.

**2. Production key mode** (mode words only)
```bash
[ -n "$K" ] && cd /opt/noetia && awk "$K" .env.production
[ -n "$K" ] && cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml exec -T api sh -c 'printf "STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET"' | awk "$K"
```

**3. Production inventory** (identity first; gate `noetia|noetia|on|68|ReconcilePlanDisplayPrices1748300000067`)
```bash
cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -tA -c "SELECT current_database(), current_user, current_setting('default_transaction_read_only'), (SELECT count(*) FROM migrations), (SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1);"
[ -n "$PA" ] && cd /opt/noetia && printf '%s\n' "$PA" | docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f -
[ -n "$PB" ] && cd /opt/noetia && printf '%s\n' "$PB" | docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f -
```
Gate: `transaction_read_only = on` at the top, no `ERROR`, ends `ROLLBACK`. **Stop** if Q2 shows `with_stripe_sub` > 0 on any active/trialing/past_due row, or Q9 shows payment event types (e.g. `checkout.session.completed`, `invoice.paid`, `charge.succeeded`).

**4. Staging** (identity gate as C.2 Step 8)
```bash
C=$(docker ps --format '{{.Names}}' | grep -m1 -E '^noetia_staging-db'); echo "staging db: ${C:-NONE}"
[ -n "$C" ] && docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "SHOW default_transaction_read_only;" -c "SELECT current_database(), current_user, (SELECT count(*) FROM migrations), (SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1);"'
[ -n "$K" ] && awk "$K" /opt/noetia-staging/.env.staging
[ -n "$C" ] && [ -n "$PA" ] && printf '%s\n' "$PA" | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -P pager=off -f -'
[ -n "$C" ] && [ -n "$PB" ] && printf '%s\n' "$PB" | docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -P pager=off -f -'
```

**5. Clean up:** `unset K PA PB U C; unset -f get`

**6. Stripe Dashboard** — Appendix B, **live mode first** (D6), then test mode, each value labelled with its mode. In live mode also record the count of **Checkout Sessions** (Payments → Checkout sessions, if shown) by status, with no IDs. Stop conditions as Appendix B.

**Return:** outputs of Steps 1–4, the filled checklist, and the C.3 attestation.
