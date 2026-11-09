# NOETIA ENGINEERING MISSION — NEM-019
## Tier-Aware Intelligence Control Plane (Dark, Simulated Providers Only)

**Status:** **REVIEW** — executed under explicit Product Owner execution authorization (*Clarification: Execute NEM-019*, 2026-11-09); implementation in a Draft PR, **not merged, not deployed**; awaiting Product Architecture review. Specification unchanged: revision 4 (including the 2026-11-08 amendments), approved 2026-11-08. Identifier `NEM-019` (reserved 2026-11-08).
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED to §5 — **activated 2026-11-09** by explicit Product Owner instruction naming NEM-019
**Schema changes:** ADDITIVE ONLY, applied to disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED (staging also NOT AUTHORIZED)
**Product Owner approval:** **GRANTED 2026-11-08** (revision 4, including the 2026-11-08 amendments)

> Reminder: **APPROVED ≠ EXECUTE.** Even after Product Owner approval, this mission is executed only on an explicit Product Owner instruction naming it (e.g. "Execute NEM-019 according to the approved mission").

---

> **Execution (2026-11-09).** The Product Owner explicitly authorized execution of NEM-019 according to approved revision 4. Implementation, tests, technical note ([09](../../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md)), and the [implementation report](../../reports/2026-11-09-NEM-019-implementation-report.md) are in a Draft PR. Status **REVIEW**: completion requires Product Architecture review and Product Owner acceptance. No scope, acceptance criterion, or restriction in this document was changed.
>
> **Product Owner approval (2026-11-08).** *Formal Product Owner Approval of NEM-019*: revision 4, including the 2026-11-08 amendments, is **APPROVED** as the engineering specification for the initial tier-aware intelligence control plane, following PO-025…028 and PO-030 (decided), ADR-005/006 revision 3 (accepted), corrections B-1…B-5, and identifier reservation. **Approval is not execution.** Every restriction in this document remains binding. Moved from `DRAFT/` to `APPROVED/`; scope (§5–§6) and acceptance criteria (§11–§12) are unchanged by the approval.
>
> **Revision 4 amendment 2 (2026-11-08).** Identifier `NEM-019` reserved by the PO for this mission; PO-025 decided (TT-01 kept open). §3, §4, §17 updated. *(At the time: still DRAFT.)*
>
> **Revision 4 amendment (2026-11-08).** ADR-005 and ADR-006 revision 3 were **accepted** on 2026-11-08. §3 and §4 updated; AC-15c distinguishes admission-time from settlement-time ledger failure. *(At the time: DRAFT, not approved.)*
>
> **Revision 4 (2026-11-08).** Architecture review corrections B-1…B-5 (review PR #41, accepted by the PO) are incorporated in §3, §9, §10, §11, §12, and §16, together with the PO's added requirements on settlement recovery and the account-deletion test. PO-026, PO-027, PO-028, and PO-030 are unchanged.
>
> **Revision 3 (2026-11-08).** TT-02, TT-04, TT-05, and TT-21 are **decided** (PO-026, PO-027, PO-028, PO-030). §1, §3, §4, §6, §7, §11, §12, §16, and §17 are updated; nothing else changes. Under PO-030 rule 7 this mission is **not** approved or executed by that decision.

## 1. Context
The Product Owner defined three tiers and issued preliminary rulings TT-01, 02, 04, 05, 12, and 21 (T0). On 2026-11-08 the PO **decided** TT-02, TT-04, TT-05, and TT-21; TT-01 and TT-12 remain open and are **not prerequisites** for this dark control plane. Three things carry the most risk and depend on no model or price: **server-side limit enforcement, tier resolution, and budget accounting**. Building them first with simulated dependencies makes those guarantees testable at zero AI cost. This mission does not resume NEM-006, which is **formally superseded** (PO-030), and inherits no authorization from it.

## 2. Objective
Deliver a dark, fully tested control plane in `services/api/src/knowledge/` that can resolve a tier, create a research session within its book limit, lock and fork sessions, deny unverified rights, and reserve and settle an internal budget, using **simulated** model, plan, and ownership dependencies. **Done** means every guarantee in §11 is proven by tests. No customer can reach it, and it is never deployed under this mission.

## 3. Dependencies
**Satisfied (2026-11-08):** PO-025, PO-026, PO-027, PO-028, PO-030 decided; **ADR-005 and ADR-006 revision 3 accepted**; **identifier `NEM-019` reserved**.

**Approval:** **granted by the Product Owner on 2026-11-08** (revision 4). No further prerequisite for approval remains.

**Not required before approval (PO, 2026-11-08):** TT-01 (PO-024 Confirmation 1) and TT-12 (draft PO-029). Both must be resolved before their dependent commercial or content-release phases. The PO-022 and PO-023 amendment texts are record follow-ups to PO-026, not inputs to this mission.

**Not required:** provider credentials, pgvector, Stripe, `subscriptions` access, tokens, prices, budget values, NEM-006B, NEM-011, NEM-013, NEM-014, staging, rights backfill, or Terms changes.

**Test environment:** real-PostgreSQL tests run against a disposable local database. The NEM-014 CI job exists only on Release A, not on `main`, and CI changes are out of scope. CI must not be weakened or changed to accommodate this mission.

## 4. Source-of-truth references
PO-025, PO-026, PO-027, PO-028, PO-030 (decided) · PO-029 (draft) · ADR-005, ADR-006 (**accepted 2026-11-08, revision 3**) · PO-001…004 · ADR-001…004 · PO-021…024 · `docs/architecture/three-tier-intelligence/` · NEM-003 `03`, `08`, `09`, `18` as historical design · Code: `app.module.ts`, `migrations/`.

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
- **Ask My Highlights (PO-028):** search and answers over own highlights are a later phase. This mission only makes the budget-policy shape capability-keyed (§7) so that phase can have its own controls.
- Reader, Escucha Activa, sync maps, `fragments` or its write paths, `user_books`, library.
- Web and mobile UI, i18n, pricing, Terms. Worker, BullMQ.
- Catalogue changes, ingestion, rights backfill.
- Any budget value, price, or limit beyond 3 and 10 presented as real.
- CI/CD, Docker, infrastructure; merging to `main`; deploying to staging or production; running migrations on any shared database.
- Changes to NEM-003, ADR-001…004, or PO records. "Not mentioned" is not "authorized".

## 7. Product rules
- Noetia+ maximum 3 selected books; NoetiaX maximum 10, **enforced server-side** (PO-027).
- **Every selected book counts**, including public domain. A verified, AI-eligible public-domain edition is selectable **without** a library entry; eligibility is determined **independently of ownership** (PO-027).
- The set locks at the first analysis turn; changes need a new or forked session (PO-027).
- Both tiers require an active **Individual, Duo, or Family** book subscription, as an add-on (PO-026). **Grants never bypass this.** `unknown` denies. Premium state never writes to a book plan.
- No **linked member** and no subscription **state** is assumed to qualify (TT-15); the port has no production adapter.
- Household membership shares no sessions, highlights, or conversations (PO-026 rule 6).
- Full-book research is limited to selected books (PO-028 rule 1). Budget policies are keyed by tier **and capability**, so highlight-based intelligence can have its own controls later (PO-028 rule 4); no values.
- Default deny; `isFree` and other metadata are never rights evidence (ADR-006; draft PO-029). No real-book rights record is created.
- `BOOK TOKEN ≠ AI USAGE`. No model name in any customer-visible response. "Basic" never appears in customer-visible text.

## 8. Protected systems
Must remain untouched and undegraded: Escucha Activa and sync; reader; ownership paths; `user_books` and `fragments`; tokens and Stripe; production data. **`app.module.ts` is the only existing runtime file this mission may change,** for §5.6. Anything else is a stop condition.

## 9. Technical requirements
- **Limits:** normalized `ai_session_books`; unique on (session, book) and (session, position); `CHECK (position BETWEEN 1 AND 10)`; tier limit from the resolver only.
- **Turn order (B-5; ADR-006):** entitlement → book set and eligibility → ledger reservation with the turn's idempotency key → short lock transaction (`SELECT … FOR UPDATE`; first-turn lock) → provider call outside any transaction → durable settlement. Failure at the first three steps: no lock, no charge. Failure in the lock transaction: reservation released idempotently. Failure during or after the provider call: the lock stands and settlement follows the recovery rules below.
- **Transactions:** selection and lock run in a short transaction with `SELECT … FOR UPDATE` on the session row. No simulated or real provider call inside it. Each turn reads the set and its hash after the lock.
- **Lock point:** the first accepted analysis turn. A preflight rejection does not lock. A provider failure after acceptance does.
- **Fork:** new session with a parent reference. Generated context carries only if the parent's books are a subset of the fork's and rights permit.
- **Downgrade:** per ADR-006 table. History is never deleted.
- **Book deletion:** `ai_session_books` must not block or fail existing book deletion. Keep a metadata snapshot with `ON DELETE SET NULL`.
- **Resolver:** per ADR-005; deny-first; flags and rollout can only restrict; caches only for performance, never as authority.
- **Rights record** carries every element in [07 §3](../../architecture/three-tier-intelligence/07-rights-verification-requirements.md#3-what-must-be-verified), including `textHash`. Only `verified` allows processing.
- **Context Builder invariant (B-3):** on research-session paths, all chunks, highlights, and notes must belong to a selected, eligible book, or the turn aborts and a metric fires. **Every path to a model** that this mission creates (including the simulated-provider turn stub) declares its context invariant and has a test proving it. Fixtures only.
- **Eligibility (B-4):** verified rights **and** an access basis: a verified public-domain edition (no library entry needed) or, for a licensed book, entitlement through `OwnershipPort` (no production adapter; `unknown` denies).
- **Origins:** segment types include `library`, `synthesis`, `broader`, `user_content`.
- **Budget authority (B-1):** the PostgreSQL ledger is the only authority; Redis, if used, is a rebuildable admission cache with namespaced, expiring keys and is never the sole record of a reservation. Reservation store or ledger unavailable, erroring, or rejecting a write → **deny before any provider call**. Integer micro-USD and integer units.
- **Durable settlement and recovery (B-5; ADR-005):**
  - the reservation is written to the ledger before the provider call; settlement is a separate entry keyed by the same idempotency key under a uniqueness constraint, so retries and replays **never charge twice**;
  - **settlement is never assumed**: after a provider success, failure, timeout, or abort, record reported usage; if usage is unknown or the ledger is unavailable, keep the reservation **held and unresolved** at its reserved amount; never release it to zero automatically;
  - a reconciliation job retries settlement idempotently from durable records; corrections are compensating entries, never edits;
  - expired reservations are flagged and reconciled, not silently released;
  - **admission fails closed** in a scope (user and capability, or overall) while unresolved reservations exceed configured bounds; bounds are configuration, **no values** are set (test fixtures only).
- **Account deletion (B-2):** every table keyed by a user references `users(id)`: content and user-derived rows (`ai_conversations`, `ai_session_books` through the session, `ai_grants`) `ON DELETE CASCADE`; usage and budget rows (`ai_usage_events`, `ai_budget_ledger`) `ON DELETE CASCADE` or `ON DELETE SET NULL` with no content; `feature_flags` per-user targeting, if any, `ON DELETE CASCADE`. Never `RESTRICT` or `NO ACTION`. `users.service.ts` is **not** changed.
- Neutral naming: `intelligence`, not `plus`. Unknown state fails closed for AI, with no effect on other modules.
- The dedicated database pool is **deferred** to the first retrieval mission. A statement timeout applies to `knowledge/*` transactions here.

## 10. Security / privacy / copyright
- All routes need `JwtAuthGuard` and a declared capability; a test fails if a route has neither.
- All data keyed by individual `userId`; `linkedUserIds` grants nothing.
- Account deletion is never blocked and leaves no orphaned private content (B-2).
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
9. Free-account and token-package-only fixtures are denied, even with a grant. Individual, Duo, and Family subscriber fixtures are allowed **only** when the simulated port answers `qualifying`. A linked-member fixture is denied (TT-15 open).
10. `unknown` denies. There is no write path from premium state to any book plan.

**Rights and selection (PO-027; ADR-006; draft PO-029)**
11. `isFree = true` with no record is denied. Partial, stale-`textHash`, and revoked records are denied. An owned book with no rights record is denied.
11a. A **verified public-domain fixture** that is not in the user's library can be selected, and it **counts** toward the limit (a fourth such book on Noetia+ is rejected). An unverified public-domain fixture cannot be selected.
11b. A verified **licensed** fixture the user is not entitled to (simulated `OwnershipPort` answers `not_entitled` or `unknown`) is denied; the same fixture with entitlement is allowed (B-4).
12. Migrations and seeds insert no rights record for a real book.

**Source scope (PO-028)**
12a. Every path to a model created by this mission has a declared context invariant and a test proving it; a path without one fails an architecture test (B-3).
13. A highlight, note, or chunk from an unselected book cannot reach the context stub. A violation aborts the turn.
14. A simulated planner naming an unselected book is rejected.

**Budget and isolation**
15. A reservation cannot exceed the budget under concurrency; settlement and failure paths behave as specified.
15a. Budget policies resolve by tier **and capability**; a reservation for one capability cannot draw on another's fixture budget.
15b. A household-member fixture cannot read another member's session or conversation.
15c. **Budget authority and turn order (B-1, B-5).** **Admission-time failure:** if the reservation store or the ledger is unavailable, errors, or rejects a write during admission, the turn is **denied before any provider call**: no new reservation, no session lock, no charge. **Settlement-time ledger failure:** if the ledger is unavailable when settling a turn whose provider call has started, the existing reservation is **preserved as unresolved**; settlement is **not** assumed and the reservation is **not** released; durable, idempotent reconciliation settles it later with no duplicate charge (AC-15d). A failure in the lock transaction releases the reservation, or keeps it held until reconciliation releases it if the release cannot be written; no provider call is made. A budget rejection never locks the set.
15d. **Settlement recovery (B-5):** a simulated provider failure, timeout, or abort with unknown usage leaves the reservation held and unresolved; a ledger outage at settlement leaves it held; reconciliation later settles it exactly once; replaying the same idempotency key, retrying settlement, or running reconciliation twice never produces a duplicate charge; expired reservations are flagged, not released to zero; while unresolved reservations exceed the fixture bound, new admissions in that scope are denied.

**Account deletion (B-2)**
15e. **Integration test** on a disposable database: create a user with rows in **every** user-related AI table this mission adds (`ai_grants`, `ai_conversations`, `ai_session_books`, `ai_usage_events`, `ai_budget_ledger`, and `feature_flags` if it targets users), then run the existing account-deletion path unchanged. Deletion **succeeds**; no row with that user's content remains; usage and budget rows are either deleted or anonymized with no content; no foreign-key error.
15f. A schema test enumerates every foreign key from a `knowledge` table to `users` and fails unless each is `ON DELETE CASCADE` or `ON DELETE SET NULL`, so a table added later cannot block deletion silently.
16. Architecture tests prove: reader, library, token, and subscription modules do not import `knowledge/*`; `knowledge/*` does not import token, subscription, plan, or Stripe code.
17. Token scenarios change no budget, because no shared code path exists.

**Cost and reversibility**
18. No provider SDK appears in `package.json`, and no outbound provider call exists.
19. Migrations run up and down on a disposable database; no existing table is altered. Removing the module registration and reverting the migrations restores the prior state.

## 12. Required tests
**Unit** (`tests/unit/knowledge/**`, ≥ 80%): every public method; happy path, edge, and failure.
**Integration** (disposable PostgreSQL and Redis): locks, constraints, reservations, migrations up and down.
**Named negative and concurrency cases:**
- fourth book on Noetia+ (including a fourth public-domain book); eleventh book on any tier; duplicate IDs; forged `limit`, `tier`, `budget`, `plan`, or `owned`
- N parallel adds at the limit; add racing the first turn; parallel first turns; parallel forks
- add after lock; downgrade during an active turn; upgrade with a locked set
- other user's session; household member access
- flag off; rollout cannot grant; expired grant; grant without a qualifying plan
- reservation race; double submit; simulated provider failure; aborted stream; **Redis unavailable → denied**; **ledger unavailable at admission → denied**; ledger unavailable at settlement → held; unknown usage → held; reconciliation replay → no duplicate; unresolved bound exceeded → admission denied
- lock-transaction failure releases the reservation; budget rejection does not lock
- account deletion with rows in every user-related AI table (AC-15e); foreign-key rule schema test (AC-15f)
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
| TT-15 Linked members, states (subscription types decided by PO-026) | Port has no adapter; `unknown` denies |
| TT-16 Billing and lifecycle | Stripe out of scope |
| TT-09, 11 Budget values, reset date | Marked test fixtures; shape is configurable |
| TT-14 Retention | History preserved; no purge logic |
| TT-23 Pilot participants | Grants never bypass; no pilot exists here |
| TT-25, 27 Semantic highlight search; saved-quotation permissions (TT-24 resolved by PO-028) | Ask My Highlights not built; session generation stays session-bound |
| TT-01 Token expiry; TT-12 launch corpus | Tokens out of scope; no real rights record |
| Retention of anonymized cost records after account deletion (B-2 option; PO/PA) | Either `CASCADE` or `SET NULL` without content satisfies AC-15e |
| Unresolved-reservation bounds and reservation expiry values | Configurable; test fixtures only |
| TT-26 Evidence standard, verifier | No real rights record is created |
| PO-024 open items | Tokens out of scope |

Details: [05](../../architecture/three-tier-intelligence/05-open-decisions.md).

## 17. Stop conditions
STOP and mark BLOCKED if:
- a change appears necessary outside §5, especially to the reader, Stripe, tokens, ownership, `fragments`, `SubscriptionGuard`, CI/CD, or Docker;
- a real provider, spend, or access to a shared database seems necessary;
- an existing table must be altered, or a deployed migration edited;
- the module cannot stay unloaded without affecting another module;
- a rule in PO-025…028 or PO-030 (decided), or PO-029 (draft), proves untestable or contradicts ADR-003;
- a value would need inventing beyond marked test fixtures;
- any accepted decision text differs from what §7 assumes.

## 18. Completion report
At REVIEW, per the README standard: Mission · Status · Changed Files · Database · Tests · Verification · Deployment · Deviations · Risks · Discoveries · Protected Systems Confirmation · Commit (SHA) · Recommended Next Step. Also a `docs/reports/` report, linked from the Draft PR.

## 19. Product Architecture review
**Reviewer:** Product Architecture, using `REVIEW-CHECKLIST.md`. **Verdict:** ______ (APPROVE / APPROVE WITH FOLLOW-UP / REJECT-REMEDIATE). Completion requires review and Product Owner acceptance.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
