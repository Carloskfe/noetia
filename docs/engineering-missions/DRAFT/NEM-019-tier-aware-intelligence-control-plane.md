# NOETIA ENGINEERING MISSION — NEM-019
## Tier-Aware Intelligence Control Plane (Dark, Simulated Providers Only)

**Status:** DRAFT (revision 2, after T0; identifier verified unused, not yet assigned)
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED (once approved; **none while DRAFT**)
**Schema changes:** ADDITIVE ONLY, applied to disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED (staging also NOT AUTHORIZED)
**Product Owner approval:** REQUIRED

> Reminder: **APPROVED ≠ EXECUTE.** Even after Product Owner approval, this mission is executed only on an explicit Product Owner instruction naming it (e.g. "Execute NEM-019 according to the approved mission").

---

## 1. Context
The Product Owner defined three tiers and issued preliminary rulings TT-01, 02, 04, 05, 12, and 21 (T0). Three things carry the most risk and depend on no model or price: **server-side limit enforcement, tier resolution, and budget accounting**. Building them first with simulated dependencies makes those guarantees testable at zero AI cost. This mission does not resume NEM-006, which stays PAUSED.

## 2. Objective
Deliver a dark, fully tested control plane in `services/api/src/knowledge/` that can resolve a tier, create a research session within its book limit, lock and fork sessions, deny unverified rights, and reserve and settle an internal budget, using **simulated** model, plan, and ownership dependencies. **Done** means every guarantee in §11 is proven by tests. No customer can reach it, and it is never deployed under this mission.

## 3. Dependencies
**Required before approval:**
- Product Owner acceptance of PO-025…PO-029, the PO-022 and PO-023 amendments, and PO-024 Confirmation 1.
- Product Architecture acceptance of ADR-005 and ADR-006.

**Not required:** provider credentials, pgvector, Stripe, `subscriptions` access, tokens, prices, budget values, NEM-006B, NEM-011, NEM-013, NEM-014, staging, rights backfill, or Terms changes.

**Test environment:** real-PostgreSQL tests run against a disposable local database. The NEM-014 CI job exists only on Release A, not on `main`, and CI changes are out of scope. CI must not be weakened or changed to accommodate this mission.

## 4. Source-of-truth references
PO-025…029 · ADR-005, ADR-006 · PO-001…004 · ADR-001…004 · PO-021…024 · `docs/architecture/three-tier-intelligence/` · NEM-003 `03`, `08`, `09`, `18` as historical design · Code: `app.module.ts`, `migrations/`.

## 5. In scope
Only under `services/api`:
1. `src/knowledge/entitlement/`: resolver, versioned policies, grants, flags, declarative capability guard, and `QualifyingPlanPort` (ADR-005). **No production adapter:** with none bound, the port answers `unknown`, so everything denies.
2. `src/knowledge/sessions/`: creation, selection, limit enforcement, first-turn lock, fork, downgrade behaviour, and a turn stub that runs the Context Builder invariant over fixtures. No retrieval.
3. `src/knowledge/rights/`: eligibility resolver with **default deny**, and `OwnershipPort` (no production adapter; answers `unknown`).
4. `src/knowledge/metering/`: usage events, budget ledger, reserve and settle, reconciliation of expired reservations, rate-card model.
5. `src/knowledge/ai/`: Gateway and Router interfaces, plus a **simulated provider** only.
6. Conditional registration of `KnowledgeModule` in `app.module.ts`, gated by an environment flag **default off**. When off, the module is not loaded and **no route exists**.
7. Additive TypeORM migrations for: `ai_tier_policies`, `ai_grants`, `feature_flags`, `ai_conversations`, `ai_session_books`, `ai_budget_policies`, `ai_budget_ledger`, `ai_usage_events`, `ai_rate_cards`, `book_ai_rights`.
8. Seed: limits **3** and **10** in tier policy. Budget values exist only as marked test fixtures. **`book_ai_rights` has no real-book rows.**
9. Tests under `tests/unit/knowledge/**`, plus integration tests against disposable PostgreSQL and Redis.
10. A technical note, `docs/database-migrations.md` entries, and the completion report.

## 6. Out of scope
- **Premium billing:** Stripe, `plans`, `subscriptions`, webhooks, checkout, `SubscriptionGuard`.
- **Book tokens:** `token_ledger`, `token_packages`, redemption, expiry.
- **AI retrieval:** pgvector, embeddings, `book_chunks`, Meilisearch, real retrieval.
- **Real AI providers:** any SDK, credential, network call, or spend.
- **Research Brief generation,** deep analysis, position maps, synthesis.
- **Highlight search (PO-028):** later phase.
- Reader, Escucha Activa, sync maps, `fragments` or its write paths, `user_books`, library.
- Web and mobile UI, i18n, pricing, Terms. Worker, BullMQ.
- Catalogue changes, ingestion, rights backfill.
- Any budget value, price, or limit beyond 3 and 10 presented as real.
- CI/CD, Docker, infrastructure; merging to `main`; deploying to staging or production; running migrations on any shared database.
- Changes to NEM-003, ADR-001…004, or PO records. "Not mentioned" is not "authorized".

## 7. Product rules
- Noetia+ maximum 3 selected books; NoetiaX maximum 10 (PO-027).
- The set locks at the first analysis turn; changes need a new or forked session (PO-027).
- Both tiers require a qualifying book subscription (PO-026). **Grants never bypass this.** `unknown` denies.
- No plan, state, or linked member is assumed to qualify (TT-15).
- Generated analysis is limited to selected books (PO-028).
- Default deny; `isFree` and other metadata are never rights evidence (PO-029).
- `BOOK TOKEN ≠ AI USAGE`. No model name in any customer-visible response. "Basic" never appears in customer-visible text.

## 8. Protected systems
Must remain untouched and undegraded: Escucha Activa and sync; reader; ownership paths; `user_books` and `fragments`; tokens and Stripe; production data. **`app.module.ts` is the only existing runtime file this mission may change,** for §5.6. Anything else is a stop condition.

## 9. Technical requirements
- **Limits:** normalized `ai_session_books`; unique on (session, book) and (session, position); `CHECK (position BETWEEN 1 AND 10)`; tier limit from the resolver only.
- **Transactions:** selection and lock run in a short transaction with `SELECT … FOR UPDATE` on the session row. No simulated or real provider call inside it. Each turn reads the set and its hash after the lock.
- **Lock point:** the first accepted analysis turn. A preflight rejection does not lock. A provider failure after acceptance does.
- **Fork:** new session with a parent reference. Generated context carries only if the parent's books are a subset of the fork's and rights permit.
- **Downgrade:** per ADR-006 table. History is never deleted.
- **Book deletion:** `ai_session_books` must not block or fail existing book deletion. Keep a metadata snapshot with `ON DELETE SET NULL`.
- **Resolver:** per ADR-005; deny-first; flags and rollout can only restrict; caches only for performance, never as authority.
- **Rights record** carries every element in [07 §3](../../architecture/three-tier-intelligence/07-rights-verification-requirements.md#3-what-must-be-verified), including `textHash`. Only `verified` allows processing.
- **Context Builder invariant:** all chunks, highlights, and notes must belong to a selected, eligible book, or the turn aborts and a metric fires. Fixtures only.
- **Origins:** segment types include `library`, `synthesis`, `broader`, `user_content`.
- **Budgets:** atomic Redis reservation, PostgreSQL ledger authoritative and rebuildable; idempotency key; failed call charges nothing; abort settles actual. Integer micro-USD and integer units.
- Neutral naming: `intelligence`, not `plus`. Unknown state fails closed for AI, with no effect on other modules.
- The dedicated database pool is **deferred** to the first retrieval mission. A statement timeout applies to `knowledge/*` transactions here.

## 10. Security / privacy / copyright
- All routes need `JwtAuthGuard` and a declared capability; a test fails if a route has neither.
- All data keyed by individual `userId`; `linkedUserIds` grants nothing.
- Client-supplied limit, tier, budget, plan, or rights fields are ignored.
- No book text, prompts, notes, or PII in logs or fixtures. Fixtures use invented titles.
- Safe `HttpException` messages. Not legal advice; no quotation threshold is decided here.

## 11. Acceptance criteria
**Dark and inaccessible**
1. With the flag off, the module does not load, no `knowledge` route exists, and all existing suites pass unchanged.
2. With the flag on in tests, a real user still gets `prerequisite_missing` because no plan adapter exists.

**Limits and sessions**
3. Noetia+ cannot exceed 3 books, NoetiaX cannot exceed 10, and the database rejects position 11 directly.
4. Parallel additions at the limit never exceed it; add versus first turn never yields a set that differs from the lock.
5. Books cannot change after the first turn; a fork is required; parallel first turns yield one lock and one set.
6. A NoetiaX → Noetia+ downgrade with more than 3 books makes the session `read_only`, offers a fork, and preserves all history.
7. A fork from a larger set carries no generated context from excluded books.
8. Deleting a book in the test database succeeds and leaves session history readable.

**Prerequisite (PO-026)**
9. Free-account and token-package-only fixtures are denied, even with a grant. A linked-member fixture is denied.
10. `unknown` denies. There is no write path from premium state to any book plan.

**Rights (PO-029)**
11. `isFree = true` with no record is denied. Partial, stale-`textHash`, and revoked records are denied. An owned book with no rights record is denied.
12. Migrations and seeds insert no rights record for a real book.

**Source scope (PO-028)**
13. A highlight, note, or chunk from an unselected book cannot reach the context stub. A violation aborts the turn.
14. A simulated planner naming an unselected book is rejected.

**Budget and isolation**
15. A reservation cannot exceed the budget under concurrency; settlement and failure paths behave as specified.
16. Architecture tests prove: reader, library, token, and subscription modules do not import `knowledge/*`; `knowledge/*` does not import token, subscription, plan, or Stripe code.
17. Token scenarios change no budget, because no shared code path exists.

**Cost and reversibility**
18. No provider SDK appears in `package.json`, and no outbound provider call exists.
19. Migrations run up and down on a disposable database; no existing table is altered. Removing the module registration and reverting the migrations restores the prior state.

## 12. Required tests
**Unit** (`tests/unit/knowledge/**`, ≥ 80%): every public method; happy path, edge, and failure.
**Integration** (disposable PostgreSQL and Redis): locks, constraints, reservations, migrations up and down.
**Named negative and concurrency cases:**
- fourth book on Noetia+; eleventh book on any tier; duplicate IDs; forged `limit`, `tier`, `budget`, or `plan`
- N parallel adds at the limit; add racing the first turn; parallel first turns; parallel forks
- add after lock; downgrade during an active turn; upgrade with a locked set
- other user's session; household member access
- flag off; rollout cannot grant; expired grant; grant without a qualifying plan
- reservation race; double submit; simulated provider failure; aborted stream; Redis unavailable
- all rights cases in AC-11; highlight, note, and planner cases in AC-13 and AC-14
- module disabled while reader, library, and token suites run

## 13. Observability
Prometheus metrics, no content: `intelligence_resolver_denied_total{reason}`, `intelligence_session_limit_rejected_total{tier}`, `intelligence_scope_violation_total`, `intelligence_budget_reserved_total`, `intelligence_budget_rejected_total{tier}`, `intelligence_reservation_expired_total`. No dashboards or alerts while dark.

## 14. Deployment / rollout
**No deployment, staging or production.** Work stays on a branch and Draft PR, and is **not merged**: pushing to `main` deploys production. A later deployment needs its own authorization, including migrations. Rollback today means closing the PR.

## 15. Documentation deliverables
Technical note on the control plane; migration entries; a `docs/reports/` report. ADRs are not edited unless a deviation is approved.

## 16. Open decisions
**No open Product Owner decision blocks execution once §3 is satisfied.**

| Decision | How this mission stays safe without it |
|---|---|
| TT-15 Qualifying plans, linked members, states | Port has no adapter; `unknown` denies |
| TT-16 Billing and lifecycle | Stripe out of scope |
| TT-09, 11 Budget values, reset date | Marked test fixtures; shape is configurable |
| TT-14 Retention | History preserved; no purge logic |
| TT-23 Pilot participants | Grants never bypass; no pilot exists here |
| TT-24, 25 Highlight generation and search | Not built; generation stays session-bound |
| TT-26 Evidence standard, verifier | No real rights record is created |
| PO-024 open items | Tokens out of scope |

Details: [05](../../architecture/three-tier-intelligence/05-open-decisions.md).

## 17. Stop conditions
STOP and mark BLOCKED if:
- a change appears necessary outside §5, especially to the reader, Stripe, tokens, ownership, `fragments`, `SubscriptionGuard`, CI/CD, or Docker;
- a real provider, spend, or access to a shared database seems necessary;
- an existing table must be altered, or a deployed migration edited;
- the module cannot stay unloaded without affecting another module;
- a rule in PO-025…029 proves untestable or contradicts ADR-003;
- a value would need inventing beyond marked test fixtures;
- any accepted decision text differs from what §7 assumes.

## 18. Completion report
At REVIEW, per the README standard: Mission · Status · Changed Files · Database · Tests · Verification · Deployment · Deviations · Risks · Discoveries · Protected Systems Confirmation · Commit (SHA) · Recommended Next Step. Also a `docs/reports/` report, linked from the Draft PR.

## 19. Product Architecture review
**Reviewer:** Product Architecture, using `REVIEW-CHECKLIST.md`. **Verdict:** ______ (APPROVE / APPROVE WITH FOLLOW-UP / REJECT-REMEDIATE). Completion requires review and Product Owner acceptance.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
