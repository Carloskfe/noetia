# NEM-019 — Implementation Report

**Mission:** NEM-019 — Tier-Aware Intelligence Control Plane (Dark, Simulated Providers Only), revision 4 (approved 2026-11-08)
**Authorization:** Product Owner, *Clarification: Execute NEM-019* (2026-11-09) — LIMITED to §5; schema ADDITIVE ONLY on disposable test databases; infrastructure, staging, and production NOT AUTHORIZED
**Status:** **COMPLETED — implementation accepted by the Product Owner on 2026-11-09** for its approved scope only (§0.1). **Not merged. Not deployed. Not authorized for production.**
**Branch:** `feat/nem-019-intelligence-control-plane`, stacked on `docs/nem-019-approval` (PR #45 → #44 → #43 → #42 → #41 → #40 → #35 → #34)
**Commits:** `97a2a7a` (migrations) · `d8ef627` (module + tests) · `d04f310` (docs) · `47c5ef5` (report) · revision 2: `dd5a49b` (B-6) · `8d74085` (F-12) · `9d23ff1` (docs) · acceptance record: the documentation commit that follows `9d23ff1`
**Technical note:** [09-nem-019-control-plane-technical-note.md](../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md)

---

## 0. Revision 2 — Product Architecture review corrections (2026-11-09)

Authorized by the Product Owner (*NEM-019 Product Architecture Review Corrections*: B-6 and F-12). Same branch, same Draft PR #46. **No approved product decision, ADR, PO record, mission scope, or acceptance criterion was changed.** Full write-up: [technical note §9](../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md#9-product-architecture-review-corrections-revision-2-2026-11-09).

### 0.1 Product Owner acceptance (2026-11-09)

**Decision recorded** (*NEM-019 Product Owner Acceptance*): the implementation is **accepted for its approved scope**, a dark, default-disabled intelligence control plane using simulated AI providers only. The independent Product Architecture review accepted both corrective findings, B-6 and F-12. The acceptance applies **only** to the implementation reviewed in Draft PR #46, including revision 2.

**Pre-acceptance verification (2026-11-09):**
- PR #46 head is `9d23ff1`, the reviewed revision-2 head. There are no commits after it, no uncommitted changes, it is a Draft, open, and unmerged.
- The base `docs/nem-019-approval` (#45) is unchanged at `73666e6` and is an ancestor of the branch.
- The only change after acceptance is the documentation commit that records this decision.

**Acceptance ≠ production authorization.** Each of the following still needs its own explicit Product Owner authorization:

| Not authorized | Note |
|---|---|
| Merging PR #46 or any dependency PR (#45 → #34) | F-6: CD runs every migration on each push to `main`, so a merge creates the ten tables in production. Needs a deployment authorization, a snapshot, and GOV-001 §5.4 checks |
| Applying migrations 069–072 to any shared database (dev, staging, production) | Verified only on disposable databases |
| Enabling `KnowledgeModule` (`KNOWLEDGE_MODULE_ENABLED=true`) anywhere | Routes would exist; they still deny everything while every port is unbound |
| Binding any production adapter | `QualifyingPlanPort` (after TT-15), `OwnershipPort`, `TextIdentityPort`, `RightsVerificationAuthorityPort` (after TT-26) |
| Real AI provider, credentials, or AI expenditure | Simulated provider only; the router refuses non-simulated providers |
| Stripe, subscription, or book-token changes | Out of scope; untouched |
| The next engineering mission | Requires separate authorization |

**Remaining production prerequisites** (none are satisfied by this acceptance):
1. An authorized rights-verification process and its authority adapter (TT-26: evidence standard, named verifier, jurisdiction; `LEGAL REVIEW REQUIRED`) (F-12).
2. Write control or an append-only audit on `book_ai_rights`: a separate DB role/grants. This is an infrastructure change (F-12).
3. A `TextIdentityPort` adapter (current text hash from object storage).
4. A `QualifyingPlanPort` adapter mapping real Individual/Duo/Family subscriptions, linked members, and states (TT-15, TT-16).
5. Approved budget values, reset period, and the overall unresolved bound (TT-09, TT-11). Today only marked test fixtures exist, and an unset overall bound denies.
6. An operator runbook for ledger compensation and for held/expired reservations (risk 1).
7. A deployment plan for migrations 069–072 under F-6, plus a re-check of migration order against NEM-016's 068.
8. A CI path for PostgreSQL-backed proofs (F-10: CI on `main` has no PostgreSQL; integration proofs ran locally, and raw output is in Appendix A).
9. Resolution of the SA-003 conflicts C1–C14 before the three-tier stack merges (F-11).
10. The global branch-coverage gate, which already failed before NEM-019 (Discovery 1).

**Product Owner decisions that remain OPEN** (not closed by this acceptance):
- TT-01 (token expiry) and TT-12 (launch corpus; PO-029 is still a draft).
- TT-15 (linked members and states) and TT-16 (billing and lifecycle).
- TT-09 and TT-11 (budget values and reset).
- TT-14 (retention).
- TT-23 (pilot participants).
- TT-25 and TT-27 (semantic highlight search; saved-quotation permissions).
- TT-26 (evidence standard and verifier).
- PO-024 open items.
- Retention of anonymized cost records after account deletion (B-2; the implementation uses `CASCADE`, E6).

**No approved product decision, ADR, PO record, mission scope, or acceptance criterion was changed** by recording this acceptance. PO-030 and the 2026-11-06 reports are not edited; a redirect stub at the old `APPROVED/` path keeps their links working.

### B-6 — global unresolved-budget concurrency: CONFIRMED and CORRECTED
- **Root cause:** admission was serialized only per `user:capability`, but the overall unresolved bound is shared, so concurrent admissions for different users read the same total and all inserted. The check also ignored the new reservation's own units (`existing > bound`).
- **Reproduced before the fix:** 20 distinct users racing for capacity 5 → **16 admitted** (110 units over the bound). The exact-capacity test also failed.
- **Correction:** one global PostgreSQL transaction-scoped advisory lock taken first, then the per-scope lock (fixed order, no deadlock). The check is now `existing + new > bound` → deny. A replayed key is reported as `duplicate_turn` before budget checks (this fixes a nondeterministic denial reason found by the new tests; it never caused a double reservation). No Redis authority, no new service, no new dependency.
- **Evidence:** the multi-user race test admits exactly 5 and the total lands exactly on the bound. Exact capacity is admitted, while over-capacity and 9-of-10-free are rejected. Per-user limits, idempotency and settlement were re-verified under the global lock. Results: 5/5 consecutive ledger-suite runs and 3/3 full integration runs. Unit tests assert the lock order and the boundary arithmetic.
- **Trade-off:** all admissions are serialized through one short-held lock. This is acceptable for the dark plane and early volumes, and is noted as a risk.

### F-12 — rights-verification trust boundary: INVESTIGATED; GAP CLOSED IN CODE; PRODUCTION PREREQUISITE IDENTIFIED
- **Who sets `status = 'verified'`:** no component. No application code, API, admin route, import, ingestion, script or seed writes `book_ai_rights`; only `rights.service.ts` reads it.
- **Gap found:** a direct database write by anyone holding the shared `noetia` role (API, migrations, scripts and operators share it, with no separate grant or audit) could create a complete `verified` row. Before this revision, that row would have granted eligibility once a `TextIdentityPort` adapter existed. Malformed values (verification in the future, review before verification, non-URL evidence, `javascript:` links, implausible years) also passed the completeness check.
- **Correction (fail closed, no new mechanism invented):**
  - Eligibility now additionally requires `isWellFormedRecord` (form only).
  - It also requires attestation by a new `RightsVerificationAuthorityPort`, with **no production adapter** (`unknown` → deny, reason `not_attested`).
  - An architecture test fails if any application code writes `book_ai_rights`, and another asserts that every rights and entitlement port is bound to its deny adapter.
- **Evidence:** unit tests cover 14 malformed cases, attestation `not_attested`/`unknown`/throwing, and the production default denying a complete verified row. Integration tests show that a directly inserted `verified` row (even `isFree` and owned) is denied under the production default; that an unattested or malformed row is denied; and that withdrawn attestation excludes the book from the next turn, with the exclusion disclosed.
- **Production prerequisites (unchanged scope; separate authorization needed):**
  1. An authorized verification process and its authority adapter (TT-26; legal review).
  2. Write control or an audit trail on `book_ai_rights` (DB role/grants: infrastructure).
  3. A `TextIdentityPort` adapter.

  No real book was marked verified. No review workflow, legal engine or admin interface was built.

### Updated results (revision 2)
| Check | Result |
|---|---|
| Full api unit suite | **1182 / 1182 passed** (87 suites) |
| New unit tests (`tests/unit/knowledge/**` + 4 migration specs) | 249 passed · `src/knowledge/**`: Statements 98.8% · Branches 94.7% · Functions 94.4% · Lines 98.9% |
| Integration (disposable PG 16 + Redis 7) | **56 / 56 passed**, 3 consecutive full runs (ledger suite 5 consecutive runs) |
| `tsc` (src + tests) / `eslint src/knowledge` | 0 errors / 0 errors, 0 warnings |
| Global branch-coverage gate | Still fails, **pre-existing**: 73.76% (68.83% without NEM-019) |
| Acceptance criteria | **All still verified**; none failed or unverified. AC-11 and AC-15/15c/15d evidence strengthened |
| Real AI provider, AI spend, production entitlement/ownership/rights adapter | **None introduced.** All ports still bind deny adapters; simulated provider only |

---

## 1. Pre-execution check (README §IN PROGRESS)

| Check | Result |
|---|---|
| Entire mission read | Yes (revision 4, all 19 sections) |
| Relevant code inspected | `app.module.ts`, `data-source.ts`, migrations 000–067, `users.service.ts` `deleteAccount`, `books.service.ts` `remove`, `book.entity.ts`, `jwt-auth.guard.ts`, `redis.provider.ts`, metrics module, jest config |
| Assumptions verified | ADR-005/006 rev 3 and decided PO-026/027/028/030 match §7 (3/10 limits, public domain counts, add-on prerequisite, household privacy). All 68 existing migrations apply cleanly to an empty PostgreSQL 16 |
| Protected systems | Escucha Activa/sync, reader, ownership, `user_books`, `fragments`, tokens, Stripe, production data — none touched |
| Migrations | Four additive migrations; 068 is used by unmerged NEM-016 branches, so 069–072 were used |
| Infrastructure | None required. Two throwaway local containers for tests (removed at the end) |
| Authorization level | LIMITED, as stated |
| Contradictions | **None material.** Engineering choices E1–E11 (technical note §8) are listed for review |

## 2. Changed files (65 files, +5002 / −3)

| Path | Purpose |
|---|---|
| `services/api/src/app.module.ts` | **Only existing runtime file changed** (+3 lines): spreads `knowledgeModules()` (default off) |
| `services/api/src/knowledge/**` (27 files) | Entitlement, rights, metering, sessions, AI gateway/router/simulated provider, module, registration |
| `services/api/src/migrations/1748300000069…072-*.ts` | Additive migrations (§3) |
| `services/api/tests/unit/knowledge/**` (17 files) | Unit, architecture, and registration/HTTP tests |
| `services/api/tests/unit/migrations/1748300000069…072-*.spec.ts` | Migration unit tests |
| `services/api/tests/integration/knowledge/**` (5 files) | Integration tests against disposable PostgreSQL + Redis |
| `services/api/jest.integration.config.js` | Separate config for integration tests; not used by `npm test` or CI |
| `docs/architecture/three-tier-intelligence/09-…technical-note.md` (+ README row) | Technical note |
| `docs/database-migrations.md` | Entries 069–072 |
| `docs/engineering-missions/APPROVED/NEM-019-….md` (moved to `COMPLETED/` on acceptance), `docs/engineering-missions/README.md` | Status → REVIEW, execution note. **No scope, AC, or restriction text changed** |
| `docs/reports/2026-11-09-NEM-019-implementation-report.md` | This report |

No `package.json`, lockfile, Dockerfile, CI, compose, Traefik, or `.env` change. No new dependency.

## 3. Database

Migrations `069 CreateIntelligenceEntitlement`, `070 CreateIntelligenceSessions`, `071 CreateBookAiRights`, `072 CreateIntelligenceMetering` create the ten tables listed in §5.7. Seeds: only `ai_tier_policies` (Noetia+ 3, NoetiaX 10, idempotent). No budget, rate-card, or rights row. **Run only on the disposable database** `nem019_test` (local container). Not run on dev, staging, or production. No backfill.

## 4. Tests

| Suite | Result |
|---|---|
| New unit tests (`tests/unit/knowledge/**`, 4 migration specs) | **221 passed** |
| Full api unit suite (`npx jest --maxWorkers=2 --coverage`) | **1154 passed, 87 suites, 0 failed** (948 pre-existing tests unchanged and passing) |
| Integration (`jest.integration.config.js`, disposable PG 16 + Redis 7) | **50 passed**, run three times consecutively with identical results |
| Coverage of `src/knowledge/**` (all files, unit only) | Statements 98.9% · Branches 95.5% · Functions 94.2% · Lines 98.8% |
| Global coverage gate | **Branches 73.19% < 80% — FAILS, pre-existing.** Without NEM-019 the same gate is 68.83% (measured on the same tree, knowledge excluded). NEM-019 raises it; it does not cause it. See Discoveries |

## 5. Acceptance criteria

Legend: **V** = verified by an automated test named below · **V\*** = verified with a stated limitation.

| AC | Result | Evidence |
|---|---|---|
| 1 Flag off: module not loaded, no route, existing suites pass | **V** | `knowledge.registration.spec`: module file never `require`d; `POST/GET /knowledge/sessions` → 404; 948 pre-existing tests pass |
| 2 Flag on: real user gets `prerequisite_missing` | **V** | `knowledge.registration.spec`: all five `use` routes → 403 `prerequisite_missing` with the default bindings |
| 3 Max 3 / max 10; DB rejects position 11 | **V** | `sessions.int-spec` limits; `a-schema-migrations.int-spec` CHECK rejects 11 and 0 |
| 4 Parallel adds never exceed; add vs first turn consistent | **V\*** | `sessions.int-spec`: 8 parallel adds → exactly 3; add-vs-turn race ×5 asserts the locked hash always equals the stored set. Limitation: a race test cannot force both interleavings on every run; the unit test forces the "add wins" interleaving deterministically (`set_changed`) |
| 5 No change after first turn; fork required; parallel first turns → one lock | **V** | `sessions.int-spec`: add/remove after lock → `session_locked`; 5 parallel first turns → one lock, one hash, `turnCount` 5 |
| 6 NoetiaX → Noetia+ over 3: `read_only`, fork offer, history kept | **V** | `sessions.int-spec` downgrade; also downgrade during an active turn |
| 7 Fork from a larger set carries no generated context | **V** | `sessions.int-spec` and unit fork cases (subset carries; superset/ineligible/deleted does not) |
| 8 Book deletion succeeds; history readable | **V** | `sessions.int-spec`: `Repository<Book>.remove` (same call as `BooksService.remove`) succeeds; snapshot title shown, lock intact, next turn runs |
| 9 Free / token-only denied even with grant; Individual/Duo/Family only when `qualifying`; linked member denied | **V** | `entitlement.service.spec` fixture port; `sessions.int-spec` free user with NoetiaX grant |
| 10 `unknown` denies; no write path to any book plan | **V** | Unit: unbound port denies; `architecture.spec`: no knowledge SQL touches `plans`, `subscriptions`, `token_*`, `user_books`, `fragments` |
| 11 `isFree` without record, partial, stale hash, revoked, owned-without-record denied | **V** | `rights.service.spec` + `sessions.int-spec` (each case on real rows) |
| 11a Verified PD selectable without library entry and counts; unverified PD denied | **V** | `sessions.int-spec`: 3 PD books with zero `user_books` rows; 4th rejected; unverified denied |
| 11b Licensed: denied when `not_entitled`/`unknown`, allowed when entitled | **V** | `sessions.int-spec` + unit |
| 12 No rights record for a real book from migrations/seeds | **V** | Migration unit test (no INSERT); integration: 0 rows straight after a fresh up-migration |
| 12a Every model path has a declared invariant and a proving test; missing one fails | **V** | `architecture.spec`: registry check, unregistered-caller check (with self-test), `sealContext` restricted to Context Builders; Gateway rejects unsealed/mismatched contexts |
| 13 Unselected highlight/note/chunk cannot reach context; violation aborts | **V** | `turn.service.spec` + `context-builder.service.spec`: no reservation, no lock, no provider call, metric fires |
| 14 Planner naming an unselected book rejected | **V** | `model-gateway.service.spec`, `turn.service.spec` (usage settled once, turn rejected, metric) |
| 15 Reservation cannot exceed budget under concurrency; settlement/failure paths | **V** | `ledger.int-spec`: 20 concurrent reserves at allowance 50/10 → exactly 5 |
| 15a Budgets by tier **and** capability; no cross-capability draw | **V** | `ledger.int-spec` |
| 15b Household member cannot read another member's session | **V** | `sessions.int-spec` isolation (get, add, fork, turn → `not_found`) |
| 15c Admission-time failure denies before provider (no reservation/lock/charge); settlement-time failure keeps reservation unresolved; lock-tx failure releases; budget rejection never locks | **V** | `ledger.int-spec`: ledger down at admission → no row; **real Redis client on a closed port** → denied, provider not called, not locked; lock-tx failure → `reservation` + `release`, provider not called; budget rejection → unlocked. Unit: release-failure leaves `provider='none'` evidence |
| 15d Unknown usage held; ledger outage held; reconciled exactly once; replay/retry/double reconcile never duplicate; expired flagged not released; bound exceeded denies | **V** | `ledger.int-spec`: outage → held → reconcile ×2 → one settlement (`28` micro-USD); 3 concurrent reconcilers → one; settle/settle/release race → one; expired → one `expired_flag`, still counted; scope and overall bounds deny; **DB unique index itself refuses a second resolution** |
| 15e Account deletion with rows in every user-related AI table | **V** | `account-deletion.int-spec`: unchanged `UsersService.deleteAccount` (email stubbed) succeeds; 0 rows left in `ai_grants`, `ai_conversations`, `ai_session_books`, `ai_usage_events`, `ai_budget_ledger` (including a held reservation and a fork); `feature_flags` has no user column |
| 15f Schema test: every knowledge→users FK is CASCADE or SET NULL | **V** | `a-schema-migrations.int-spec` (4 FKs, all CASCADE; every other knowledge FK CASCADE/SET NULL) |
| 16 Reader/library/token/subscription don't import knowledge; knowledge doesn't import token/subscription/plan/Stripe | **V** | `architecture.spec` |
| 17 Token scenarios change no budget | **V** | `ledger.int-spec`: a real `token_ledger` issue + redeem leaves the user's ledger untouched; architecture test |
| 18 No provider SDK; no outbound provider call | **V** | `architecture.spec` (package.json, HTTP clients, `fetch`); router refuses non-simulated providers |
| 19 Migrations up/down; no existing table altered; reverting restores prior state | **V\*** | `a-schema-migrations.int-spec`: schema snapshot of all non-new tables and constraints identical before, after revert, and after re-run. Limitation: "removing the module registration" was verified as flag-off (module not loaded), not by deleting the line; the line is a single spread in `app.module.ts` |

**Failed criteria: none. Unverified criteria: none.** The two V\* limitations are stated above. §13 metrics: the six counters are registered and incremented without content labels (`common.spec`).

## 6. Verification

- `tsc --noEmit -p tsconfig.test.json` (src + tests): **0 errors**
- `eslint src/knowledge/**`: **0 errors, 0 warnings** (migrations are ignored by the repo's eslint config)
- `nest build` was not run separately; it uses the same `tsc` configuration
- Runtime: the module was booted in a Nest test application with the flag on and off (HTTP over an ephemeral local port)

## 7. Deployment

**None.** Nothing was merged or pushed to `main`; no staging or production action; no migration on any shared database.

## 8. Deviations

None from scope or acceptance criteria. Engineering choices within scope (all fail closed) are E1–E11 in the [technical note §8](../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md#8-engineering-choices-for-review). The ones Product Architecture should look at first:

- **E1** tier comes only from `ai_grants` (billing entitlement is a later mission);
- **E2** an extra `TextIdentityPort` (no adapter) to support stale-`textHash` denial;
- **E6** usage/budget rows use `ON DELETE CASCADE` (the open retention choice);
- **E8** a passed `reviewDate` denies;
- the rights **completeness interpretation** (technical note §4).

## 9. Risks

1. **Same-database evidence.** Usage evidence and the ledger share PostgreSQL. A total outage at settlement loses the usage record, and the reservation stays held, then flagged, indefinitely. That follows ADR-005 (never released to zero), but an operator procedure for compensating entries is needed before launch.
2. **Admission cache staleness.** An "exhausted" marker can deny for up to its TTL (default 60 s) after the allowance frees up. This is conservative.
3. **Enabling the flag in any shared environment** would expose routes (still deny-all, because no adapters are bound). It needs its own authorization, as do the migrations.
4. **Race tests** prove invariants but cannot force every interleaving on every run (AC-4 note).
5. **Migration numbering** depends on NEM-016 keeping 068. If either branch is renumbered, re-check the order before any deployment.
6. **Admission throughput (B-6):** one global advisory lock serializes every budget admission. It is held only for one short transaction, but it is a single point of contention at scale.
7. **Rights authority (F-12):** until an authorized verification process and write control on `book_ai_rights` exist, rights depend on the authority port staying unbound (deny). Binding a permissive adapter would make any directly written row authoritative.

## 10. Discoveries (out of scope; not acted on)

1. **Global api branch-coverage gate already fails on the base branch** (68.83% < 80%). `npm run test:cov` exits non-zero without NEM-019. Recommend a separate remediation mission or a threshold review.
2. **`services/api/node_modules` is not ignored** in this worktree's git status (`?? services/api/node_modules`). It was not committed. Worth checking `.gitignore` for nested `node_modules`.
3. **`docs/database-migrations.md` history stops at 063.** Migrations 064–067 (already on `main`) are undocumented. Only 069–072 were added here.
4. **`supertest` is not a dependency**, so HTTP-level tests used Node's built-in `fetch`.

## 11. Protected systems confirmation

**Not modified:** Escucha Activa, sync maps and their services, reader (`app/(reader)`, `PagedReader`, phrase rendering), `books`, `library`, `fragments` and write paths, `user_books`, tokens (`token_ledger`, `token_packages`, redemption, expiry), Stripe, `plans`, `subscriptions`, webhooks, checkout, `SubscriptionGuard`, `users.service.ts`, web, mobile, worker, image-gen, i18n, pricing, Terms, catalogue/ingestion, NEM-003, ADR-001…006, PO records, CI/CD, Docker, compose, Traefik, infrastructure, staging, production. No provider SDK, credential, network call, or spend. No production data accessed.

## 12. Test-resource cleanup

The disposable containers `nem019-test-pg` and `nem019-test-redis` (started only for this mission, bound to 127.0.0.1, no named volumes) are removed after the final run. No shared or production Docker resource was touched. See the PR description for the confirmation.

## 13. Recommended next step (recommendation only — not started)

1. Product Architecture review of this Draft PR against `REVIEW-CHECKLIST.md`, with particular attention to E1, E2, E6, E8, and the rights completeness interpretation.
2. A PO decision on anonymized cost-record retention after account deletion (CASCADE vs SET NULL).
3. Later missions, each separately authorized: the `QualifyingPlanPort` adapter (after TT-15), `OwnershipPort`/`TextIdentityPort` adapters, a ledger compensation runbook, and deployment of migrations 069–072.


---

## Appendix A — Raw test output (F-10)

These are verbatim summary lines captured from the runs during this mission. Integration runs used the disposable containers `nem019-test-pg` (PostgreSQL 16) and `nem019-test-redis` (Redis 7) on 127.0.0.1; both were removed afterwards. The full per-test output was not retained. Re-run with the commands in [technical note §10](../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md#10-running-the-tests).

**B-6 reproduction, before the fix** (`ledger.int-spec -t "B-6"`):
```
✕ 20 distinct users racing for capacity 5 → exactly 5 admitted; total lands exactly on the bound, never over
✕ exact capacity is admitted; one unit over is rejected (sequential boundary)
✓ per-user scope limits, idempotency, and settlement still hold under the global lock
Expected length: 5
Received length: 16
Tests:       2 failed, 21 skipped, 1 passed, 24 total
```

**Revision 2, final** (head `9d23ff1`):
```
# npx jest --maxWorkers=2 --coverage --silent          (full api unit suite)
All files                       |   92.38 |    73.76 |      90 |   93.44 |
Jest: "global" coverage threshold for branches (80%) not met: 73.76%
Test Suites: 87 passed, 87 total
Tests:       1182 passed, 1182 total

# npx jest --maxWorkers=2 tests/unit/knowledge tests/unit/migrations
Tests:       249 passed, 249 total

# coverage of src/knowledge/** (unit only)
All files                       |   98.83 |    94.71 |   94.44 |    98.9 |

# npx jest -c jest.integration.config.js --runInBand    (three consecutive runs)
Tests:       56 passed, 56 total
Tests:       56 passed, 56 total
Tests:       56 passed, 56 total

# ledger suite after the B-6 fix (five consecutive runs)
Tests:       24 passed, 24 total   (×5)

# npx tsc --noEmit -p tsconfig.test.json ; npx eslint "src/knowledge/**/*.ts"
tsc exit 0
eslint exit 0
```

**Baseline for the coverage discovery** (same tree, knowledge excluded):
```
All files                       |   90.46 |    68.83 |   87.56 |    91.8 |
Jest: "global" coverage threshold for branches (80%) not met: 68.83%
Tests:       948 passed, 948 total
```
