# 09 — NEM-019 Intelligence Control Plane: Technical Note

**Status:** Implemented on branch `feat/nem-019-intelligence-control-plane` (Draft PR #46). **Dark. Not merged, not deployed.** Revision 2 (2026-11-09) adds the Product Architecture review corrections **B-6** and **F-12** (§9). Awaiting Product Architecture re-review.
**Mission:** [NEM-019 revision 4](../../engineering-missions/APPROVED/NEM-019-tier-aware-intelligence-control-plane.md) · **Normative inputs:** ADR-005 rev 3, ADR-006 rev 3 (accepted 2026-11-08) · PO-025…028, PO-030 (decided) · PO-029 (draft).
**Report:** [`docs/reports/2026-11-09-NEM-019-implementation-report.md`](../../reports/2026-11-09-NEM-019-implementation-report.md)

This note describes what was built and the engineering choices made inside the mission's scope. It does not change any ADR or PO decision.

---

## 1. Shape

```
services/api/src/knowledge/
  knowledge.registration.ts   flag gate (imports nothing from knowledge/* statically)
  knowledge.module.ts         providers + port bindings (all "unknown"/empty)
  knowledge.types.ts          tiers, capabilities, denial codes, segment origins
  common/                     IntelligenceDenied, config, DB helper (statement timeout), metrics
  entitlement/                EntitlementService (resolver), QualifyingPlanPort, CapabilityGuard + @DeclareCapability
  rights/                     RightsService (default deny), OwnershipPort, TextIdentityPort
  metering/                   BudgetLedgerService, RateCardService, admission cache (Redis), reconciliation job
  sessions/                   SessionsService, TurnService, ContextBuilderService, ContextSourcePort, controller, DTOs
  ai/                         Gateway, Router (simulated-only), SimulatedProvider, model-path registry, sealed context
```

**Registration.** `app.module.ts` spreads `knowledgeModules()`, which returns `[]` unless `KNOWLEDGE_MODULE_ENABLED === 'true'` (exact string). When off, `knowledge.module.ts` is never `require`d, no provider is constructed, no metric is registered, and no `knowledge` route exists. `app.module.ts` is the only existing runtime file changed.

**No production adapters.** `QualifyingPlanPort`, `OwnershipPort`, and `TextIdentityPort` answer `unknown`; `ContextSourcePort` returns nothing. Even with the flag on, every request denies (`prerequisite_missing` first).

## 2. Entitlement resolver (ADR-005)

Deny-first, in this order: prerequisite port must answer `qualifying` (grants are not even read otherwise) → highest active `ai_grants` tier → latest active `ai_tier_policies` version must list the capability → `feature_flags` row `intelligence.<capability>` must be enabled and the user inside the deterministic rollout bucket. A **missing** flag denies. Client-supplied tier/limit/plan/budget fields are stripped by the global whitelist `ValidationPipe` and never read.

Routes declare a capability with `@DeclareCapability(capability, access)`. `use` resolves entitlement in `CapabilityGuard`; `history` (session read) needs only ownership, so a downgrade or premium end never hides history. Guards run before validation pipes, so an unentitled caller gets 403 before any 400.

## 3. Sessions and turn order (ADR-006)

- `ai_session_books` is the normalized set: unique `(sessionId, bookId)` and `(sessionId, position)`, `CHECK (position BETWEEN 1 AND 10)`, book FK `ON DELETE SET NULL` with title/author snapshots.
- Selection changes run in a short transaction with `SELECT … FOR UPDATE` on the session row; the tier limit comes from the resolver.
- The set hash is computed over **session-book row ids**, so deleting a catalogue book does not alter a locked set's hash.

**Turn order** (`TurnService.run`):

| Step | What | On failure |
|---|---|---|
| 1 | Resolve entitlement | Denied; no lock, no charge |
| 2 | Read set; over-limit → `read_only`; eligibility per book (ineligible books excluded and disclosed); fetch candidates; **Context Builder invariant** seals the context | Denied / `scope_violation`; no lock, no charge |
| 3 | Ledger reservation with namespaced key `turn:sha256(user:session:clientKey)` | Denied; no lock, no charge |
| 4 | Short `FOR UPDATE` tx: status still active, re-read set hash equals step-2 hash, record first-turn lock, `turnCount++` | Reservation released (idempotent); if the release cannot be written, a `provider = 'none'`, `units = 0` usage record is left so reconciliation releases it; no provider call |
| 5 | Gateway call outside any transaction (timeout enforced) | Lock stands |
| 6 | Record usage event; settle if usage is known | Unknown usage or ledger failure → reservation **held, unresolved** |

Because the context is built from the step-2 set and step 4 verifies the set is unchanged, a context violation never locks or charges, and a racing add surfaces as `set_changed` (released, not locked).

**Planner/tool arguments and cited books** are validated by the Gateway against the allowed set. A violation is detected after the provider call: usage is settled normally, segments are dropped, the turn returns `scope_violation`, and `intelligence_scope_violation_total` increments.

**Forks** carry generated context (`contextParentId`) only if every parent book is non-deleted, in the fork's set, and still eligible.

## 4. Rights (default deny; ADR-002/006; 07 §3)

Eligible ⇔ current `textHash` known (port) **and** a `book_ai_rights` row for that exact hash **and** `status = 'verified'` **and** every 07 §3 element present **and** every value well-formed (F-12) **and** the operation (`research_analysis`) listed **and** `reviewDate` not passed **and** the record is **attested by the verification authority** (F-12; no production adapter, so `unknown` denies) **and** an access basis: `public_domain` (no library entry needed) or, for `licensed`/`rights_holder_opt_in`, `OwnershipPort = entitled`. `isFree` and catalogue metadata are never read. No rights row exists for any real book.

Completeness interpretation (engineering, for review): public-domain records also require the author death date, and for translations the translator death date and translation date; licensed records may omit death dates (living authors) but a translation still needs translators.

## 5. Budget ledger (ADR-005 B-1, B-5)

- **Authority:** `ai_budget_ledger`, append-only, integer units, integer micro-USD cost from versioned `ai_rate_cards` (BigInt arithmetic).
- **Uniqueness:** partial unique indexes allow one `reservation`, one **resolution** (`settlement` *or* `release`), and one `expired_flag` per idempotency key; `compensation` entries are unrestricted and never edit prior rows. A replay, retry, race, or second reconciler cannot charge twice — enforced by the database, not only the code.
- **Admission** (`reserve`) runs under two transaction-scoped advisory locks taken in a fixed order: one **global** admission lock (B-6), then one per `user:capability`. Under them it rejects a replayed key as `duplicate_turn`, then checks the scope's unresolved bound (units and oldest age), the overall unresolved bound **including the new reservation's units** (exact capacity admitted, never exceeded), and the period allowance (settled + compensated + still-unresolved reserved units), then inserts with `ON CONFLICT DO NOTHING` (duplicate → `duplicate_turn`). Any error, unavailable Redis cache, missing policy, or unset overall bound → `budget_unavailable` **before** any provider call.
- **Redis** is optional and only caches "scope exhausted" for a short, namespaced, expiring key (`intelligence:admission:v1:<user>:<capability>`). It is cleared on settlement and can be lost without consequence. When bound and unavailable, admission is denied.
- **Reconciliation** (`reconcile`, run every 60 s by `ReconciliationJobService` only while the module is loaded): no-provider evidence → release; known reported usage → settle (with rate card from the usage event's provider and model key); otherwise held, and once expired, flagged exactly once and **never released to zero**.

## 6. Account deletion (B-2)

Every knowledge table that references `users(id)` (`ai_grants`, `ai_conversations`, `ai_budget_ledger`, `ai_usage_events`) uses `ON DELETE CASCADE`; `ai_session_books` cascades through its session; every other knowledge FK is `CASCADE` or `SET NULL`. `feature_flags` has no user targeting. The unchanged `UsersService.deleteAccount` deletes everything (integration test AC-15e). Retention of anonymized cost records remains an open PO/PA choice; `CASCADE` was chosen as the privacy-preserving option that satisfies AC-15e.

## 7. Model paths and context invariants (B-3)

`ai/model-paths.ts` registers every path to a model with its invariant and proving test. Today there is one: `research_session.turn` → `research_session_context` → `tests/unit/knowledge/sessions/turn.service.spec.ts`. The Gateway accepts only a context sealed for that path and invariant. Architecture tests fail if any file calls the Gateway without being registered, if a registered test is missing or does not name its invariant, or if anything other than a Context Builder calls `sealContext`.

## 8. Engineering choices for review

| # | Choice | Why |
|---|---|---|
| E1 | Tier comes only from `ai_grants` | Billing-derived premium entitlement is out of scope (Stripe, `subscriptions`); grants never bypass the prerequisite |
| E2 | Added `TextIdentityPort` (no adapter, `unknown`) | Book text lives in object storage with no hash column; stale-`textHash` denial needs a current hash |
| E3 | Added `ContextSourcePort` (empty) | No retrieval in scope; tests inject fixtures to prove the invariant |
| E4 | Raw parameterized SQL, no TypeORM entities in `knowledge/` | The app's `**/*.entity.ts` glob would load knowledge entities even while dark |
| E5 | Migrations numbered 069–072 | 068 is used by the unmerged NEM-016 branches |
| E6 | Usage/budget rows `ON DELETE CASCADE` | Open PO/PA retention choice; both options satisfy AC-15e |
| E7 | Missing feature flag denies; unset overall unresolved bound denies | Fail closed; no values invented |
| E8 | `reviewDate` in the past denies | 07 §4 lists `expired`; treated conservatively |
| E9 | Operation key `research_analysis`; capability `research_session` seeded for both tiers | ADR-002 leaves field names to implementation |
| E10 | Operational defaults: statement timeout 5 s, provider timeout 30 s, cache TTL 60 s, reconciliation every 60 s | Operational, not product or budget values; configurable by env |
| E11 | Integration tests in `tests/integration/` with `jest.integration.config.js`; not in `npm test` or CI | §3: CI must not change; the suite refuses non-local or non-`_test` databases |
| E12 | One global advisory lock serializes all budget admissions (B-6) | Simplest reliable mechanism on existing PostgreSQL; no new service. Throughput limit noted in §9 |
| E13 | `RightsVerificationAuthorityPort` with no adapter; well-formedness check (F-12) | A `verified` row is data, not authority; no authorized verification process exists yet |

## 9. Product Architecture review corrections (revision 2, 2026-11-09)

Both findings were approved by the Product Owner (*NEM-019 Product Architecture Review Corrections*). No ADR, PO decision, mission scope, or acceptance criterion was changed.

### B-6 — Global unresolved-budget concurrency

**Root cause (confirmed).** `reserve` serialized only per `user:capability` (`pg_advisory_xact_lock(hash(user:capability))`). The overall unresolved bound is shared by all users, so concurrent admissions for **different** users each read the same global total under READ COMMITTED and all inserted. Separately, the check was `existing > bound`, which ignored the new reservation's own units and admitted one reservation past the bound even without a race.

**Reproduction (before the fix).** 20 distinct users racing for global capacity 5 × 10 units → **16 admitted** (110 units over the bound); the sequential exact-capacity test also failed.

**Correction.**
1. A single global transaction-scoped advisory lock (`hashtextextended('intelligence:budget:global-admission:v1', 0)`) is taken **first**, then the existing per-scope lock, in a fixed order (no deadlock possible; advisory locks are re-entrant within a session). The global check and the reservation insert run inside that one transaction and the locks are released at commit, after the row is visible.
2. The check is now `existing + reserveUnitsPerTurn > bound` → deny. Exact capacity is admitted; one unit short is rejected.
3. A replayed idempotency key is now rejected as `duplicate_turn` **before** budget checks. The previous order could report a replay at the allowance boundary as `budget_exhausted` (never a double reservation, but a nondeterministic reason; found by the B-6 tests). The unique index stays as the backstop.

Redis is not involved; PostgreSQL remains the only authority. Per-scope limits, idempotency, settlement, reconciliation, and fail-closed behaviour are unchanged and re-tested.

**Evidence.** `ledger.int-spec` *B-6*: 20 distinct users for capacity 5 → exactly 5 admitted, total exactly at the bound; sequential exact-capacity admitted and over-capacity (and 9-units-free) rejected; per-user limits, duplicate keys, and settlement under the global lock. Passed on 5 consecutive runs of the ledger suite and 3 consecutive full integration runs. Unit tests assert the lock order (global → scope → overall check → insert) and the boundary arithmetic.

**Trade-off.** All admissions are now serialized through one lock. Each holds it only for the duration of one short admission transaction (statement timeout applies). This is adequate for the dark plane and early volumes; a sharded or counter-row design can replace it later without changing the ledger's authority.

### F-12 — Rights-verification trust boundary

**Who sets `book_ai_rights.status = 'verified'`? Nobody, by design of this mission.** Findings against the repository:

| Question | Finding |
|---|---|
| Application code that writes `book_ai_rights` | **None.** Only `SELECT` in `rights.service.ts`; architecture test now fails on any `INSERT`/`UPDATE`/`DELETE` |
| API route, admin endpoint, import, ingestion, or script | **None** (repository-wide search of `.ts/.js/.sql/.sh/.py`) |
| Migration or seed | Creates the empty table only (AC-12) |
| Database operation | **Possible.** API, migrations, scripts, and operators share one PostgreSQL role (`noetia`, owner); there is no separate grant or audit trail for this table. Any holder of those credentials could insert a `verified` row |

**Trust boundary (now enforced in code).**

```
metadata completeness  (isCompleteRecord: every 07 §3 element present)
        ⊂ well-formed  (isWellFormedRecord: coherent dates, plausible year, http(s) URLs, tokens)
        ⊂ attested     (RightsVerificationAuthorityPort: produced by the AUTHORIZED verification process)
        ⊂ AI-eligible  (+ verified status, current textHash, permitted operation, review date, access basis)
```

Completeness and well-formedness check **form only**; neither judges authenticity or legal sufficiency. Authority is a port with **no production adapter** (the authorized process — verifier, evidence standard, jurisdiction — is TT-26, open), so a directly written `verified` row grants nothing. Missing, malformed, unattested, revoked, expired, stale, or past-review records all deny. No real book is marked verified; no review workflow, legal engine, or admin interface was built.

**Production prerequisites (not in this mission).**
1. An authorized rights-verification process and its authority adapter (TT-26: evidence standard, named verifier, jurisdiction; `LEGAL REVIEW REQUIRED`).
2. Write control on `book_ai_rights`: a separate database role/grants or an append-only audit of status changes (infrastructure/DB-role change; needs its own authorization).
3. A `TextIdentityPort` adapter (current text hash from storage).

## 10. Running the tests

```bash
# Unit (part of npm test). On the dev VM keep workers capped (docs/operations/dev-vm-resources.md):
npx jest --maxWorkers=2 tests/unit/knowledge tests/unit/migrations

# Integration — disposable containers only
docker run -d --rm --name nem019-test-pg -e POSTGRES_USER=noetia -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nem019_test \
  -p 127.0.0.1:55432:5432 --memory=512m postgres:16-alpine
docker run -d --rm --name nem019-test-redis -p 127.0.0.1:56379:6379 --memory=128m redis:7-alpine
NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=nem019_test DB_USER=noetia DB_PASS=test \
  NEM019_REDIS_URL=redis://127.0.0.1:56379 npx jest -c jest.integration.config.js --runInBand
docker rm -f nem019-test-pg nem019-test-redis
```
