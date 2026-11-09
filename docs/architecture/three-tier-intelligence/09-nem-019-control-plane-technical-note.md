# 09 — NEM-019 Intelligence Control Plane: Technical Note

**Status:** Implemented on branch `feat/nem-019-intelligence-control-plane` (Draft PR). **Dark. Not merged, not deployed.** Awaiting Product Architecture review.
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

Eligible ⇔ current `textHash` known (port) **and** a `book_ai_rights` row for that exact hash **and** `status = 'verified'` **and** every 07 §3 element present **and** the operation (`research_analysis`) listed **and** `reviewDate` not passed **and** an access basis: `public_domain` (no library entry needed) or, for `licensed`/`rights_holder_opt_in`, `OwnershipPort = entitled`. `isFree` and catalogue metadata are never read. No rights row exists for any real book.

Completeness interpretation (engineering, for review): public-domain records also require the author death date, and for translations the translator death date and translation date; licensed records may omit death dates (living authors) but a translation still needs translators.

## 5. Budget ledger (ADR-005 B-1, B-5)

- **Authority:** `ai_budget_ledger`, append-only, integer units, integer micro-USD cost from versioned `ai_rate_cards` (BigInt arithmetic).
- **Uniqueness:** partial unique indexes allow one `reservation`, one **resolution** (`settlement` *or* `release`), and one `expired_flag` per idempotency key; `compensation` entries are unrestricted and never edit prior rows. A replay, retry, race, or second reconciler cannot charge twice — enforced by the database, not only the code.
- **Admission** (`reserve`) runs under `pg_advisory_xact_lock` per `user:capability`, checks the scope's unresolved bound (units and oldest age), the overall unresolved bound, and the period allowance (settled + compensated + still-unresolved reserved units), then inserts with `ON CONFLICT DO NOTHING` (duplicate → `duplicate_turn`). Any error, unavailable Redis cache, missing policy, or unset overall bound → `budget_unavailable` **before** any provider call.
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

## 9. Running the tests

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
