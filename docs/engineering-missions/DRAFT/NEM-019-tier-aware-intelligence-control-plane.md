# NOETIA ENGINEERING MISSION — NEM-019
## Tier-Aware Intelligence Control Plane (Dark, No AI Provider)

**Status:** DRAFT (number provisional; TT-21)
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED (once approved; **none while DRAFT**)
**Schema changes:** ADDITIVE ONLY (once approved)
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED
**Product Owner approval:** REQUIRED

> Reminder: **APPROVED ≠ EXECUTE.** Even after Product Owner approval, this mission is executed only on an explicit Product Owner instruction naming it (e.g. "Execute NEM-019 according to the approved mission").

---

## 1. Context
The Product Owner defined three tiers on 2026-11-06: Noetia, Noetia+ (3 books per analysis session), and NoetiaX (10 books). The reconciliation in `docs/architecture/three-tier-intelligence/` found that the approved architecture can absorb this, but three things carry the most risk and depend on no model or price: **server-side limit enforcement, tier resolution, and budget accounting**. Building them first, with no provider, makes those guarantees testable at zero AI cost.

## 2. Objective
Deliver a dark, fully tested control plane inside `services/api/src/knowledge/` that can resolve a user's tier, create a research session within the tier's book limit, and reserve and settle an internal budget, using a fake model provider only. **Done** means every guarantee in §11 is proven by tests. No customer can reach it.

## 3. Dependencies
- Product Owner rulings: **TT-04** (limit semantics), **TT-05** (My Knowledge and highlights), **TT-21** (authority and numbering), and confirmation under **TT-02** that the prerequisite step is a configurable rule.
- Product Architecture acceptance of the three-tier package, and of ADR-005/006 or equivalent.
- Not required: provider credentials, pgvector, Stripe changes, prices, or budget values.
- Coordination: NEM-011 changes `library.service.ts`. This mission only reads `user_books` and does not depend on its merge, because eligibility is default-deny.

## 4. Source-of-truth references
PO scope update 2026-11-06 · PO-001…004 · ADR-001…004 · PO-005 (configuration only) · PO-021, PO-022 and the 2026-10-30 direction · `docs/architecture/three-tier-intelligence/01`–`06` · NEM-003 `03`, `08`, `09`, `18` as historical design · Code: `subscriptions/*`, `library/*`, `app.module.ts`.

## 5. In scope
Only under `services/api`:
1. `src/knowledge/entitlement/`: `EffectiveEntitlement` resolver, versioned policies, grants, flags, declarative capability guard. Tier comes from **grants only** in this mission.
2. `src/knowledge/sessions/`: session creation, book selection, limit enforcement, first-turn lock, fork, re-evaluation, turn stub.
3. `src/knowledge/rights/`: eligibility resolver, **default deny**. No rights data is seeded for real books.
4. `src/knowledge/metering/`: usage events, budget ledger, reserve and settle, reconciliation of expired reservations, rate-card model with test data only.
5. `src/knowledge/ai/`: Gateway interface, Router interface, and a **fake provider** in test code and dark config.
6. Registering `KnowledgeModule` in `app.module.ts`, master flag default **off**; routes return a clean "unavailable" when off.
7. Additive TypeORM migrations for: `ai_tier_policies`, `ai_grants`, `feature_flags`, `ai_conversations`, `ai_session_books`, `ai_budget_policies`, `ai_budget_ledger`, `ai_usage_events`, `ai_rate_cards`, `book_ai_rights`.
8. Seed: approved book limits **3** and **10** in tier policy. Budget values are test placeholders, clearly marked and disabled outside test.
9. Tests under `tests/unit/knowledge/**`, integration tests on real PostgreSQL where locking matters.
10. Technical documentation and the completion report.

## 6. Out of scope
- Any real AI provider, SDK, credential, or network call to a provider.
- pgvector, embeddings, `book_chunks`, retrieval implementation, Meilisearch changes.
- Stripe, `plans`, `subscriptions`, webhooks, `token_ledger`, `token_packages`, `SubscriptionGuard`, or checkout.
- Reader, Escucha Activa, sync maps, `fragments`, ownership writes, library behaviour.
- Web and mobile UI, i18n, pricing pages, ToS. Worker, queues, BullMQ.
- Research Brief generation, deep analysis, position maps.
- Any budget value, model price, or subscription price presented as real.
- CI/CD, Docker, infrastructure, merging to `main`, deploying anywhere.
- Changes to NEM-003, ADRs, or PO records. "Not mentioned" is not "authorized".

## 7. Product rules
- Noetia+ maximum 3 books per analysis session; NoetiaX maximum 10.
- "Basic" never appears in customer-visible errors or copy.
- `BOOK TOKEN ≠ AI USAGE`: no code path links them.
- Book ownership is never read from, or changed by, premium status.
- Limits and budgets are configuration; a limit change is a new policy version.
- Limit semantics per TT-04 and TT-05 as ruled. **If unruled, this mission is BLOCKED.**
- No model name in any customer-visible response.

## 8. Protected systems
Must remain untouched and undegraded: Escucha Activa and the sync pipeline; reader; permanent ownership paths; `user_books` writes; tokens and Stripe; production data. This mission is authorized to touch only `app.module.ts` among existing runtime files, to register the module. Anything else is a stop condition.

## 9. Technical requirements
- Follow the [limit enforcement layers](../../architecture/three-tier-intelligence/03-research-architecture.md#3-server-side-enforcement-of-book-limits): normalized table, unique constraints, row lock in a transaction, `CHECK (position BETWEEN 1 AND 10)`, lock on first turn, per-turn re-evaluation, non-empty allowed set in the retrieval contract, Context Builder invariant (with a stub).
- Resolver per [04 §2](../../architecture/three-tier-intelligence/04-entitlements-and-budgets.md#2-tier-capability-model), including the corrected order: flags and rollout can only restrict.
- Reservation: atomic in Redis; PostgreSQL ledger is authoritative; rebuildable; idempotency key per request; failed call charges nothing; abort settles actual; expired reservations reconciled.
- Neutral naming: `intelligence`, not `plus`.
- Monetary estimates in integer micro-USD. Resource units are integers.
- Uses a small dedicated database pool and statement timeout for `knowledge/*`.
- Unknown state fails closed for AI, with no effect on other modules.

## 10. Security / privacy / copyright
- All routes need `JwtAuthGuard` plus a declared capability; a test fails if a route has neither.
- All data keyed by individual `userId`; `linkedUserIds` grants nothing.
- Client-supplied limit, tier, budget, or rights fields are ignored.
- Default deny for AI eligibility, including all real catalogue books. `isFree` is not rights evidence.
- No book text, prompts, or notes in logs. No PII in fixtures. `HttpException` with safe messages.
- Not legal advice; no quotation threshold is decided here.

## 11. Acceptance criteria
1. With the flag off, all `knowledge` routes return "unavailable" and existing suites pass unchanged.
2. A Noetia+ grant cannot create or extend a session past 3 books; NoetiaX cannot pass 10; the database rejects position 11 directly.
3. Parallel additions at the limit never exceed it.
4. Books cannot change after the first turn; a fork produces a new session.
5. A downgrade makes an over-limit session return `session_requires_narrowing`, with history readable.
6. An ineligible book is rejected with a typed reason; all real books are ineligible by default.
7. A reservation cannot exceed the budget under concurrency; settlement and failure paths match [04](../../architecture/three-tier-intelligence/04-entitlements-and-budgets.md#4-resource-budgets).
8. Architecture tests prove reader, library, and token modules do not import `knowledge/*`, and `knowledge/*` does not import token entities or redemption.
9. Buying or holding book tokens changes no budget in any test scenario.
10. No provider SDK appears in `package.json`, and no outbound provider call exists.
11. Migrations are additive and reversible in a disposable database; no existing table is altered.

## 12. Required tests
**Unit** (`tests/unit/knowledge/**`, ≥ 80%): every public method, happy path, edge, and failure.
**Integration** (real PostgreSQL, NEM-014 pattern): row locks, constraints, migrations up and down.
**Named negative cases:**
- fourth book on Noetia+; eleventh book on any tier; parallel adds at the limit
- duplicate book IDs; forged `limit`, `tier`, or `budget` in the body
- add after lock; session access by another user; household member access
- flag off; rollout bucket cannot grant; grant expired; prerequisite rule denies
- reservation race; double submit; provider failure; aborted stream; Redis unavailable
- planner stub naming an unselected book; note from an unselected book reaching context
- module disabled while reader, library, and token suites run

## 13. Observability
Add Prometheus metrics (no content): `intelligence_resolver_denied_total{reason}`, `intelligence_session_limit_rejected_total{tier}`, `intelligence_budget_reserved_total`, `intelligence_budget_rejected_total{tier}`, `intelligence_reservation_expired_total`. No dashboard changes; no alerts needed while dark.

## 14. Deployment / rollout
**No deployment.** Work stays on a branch and Draft PR; pushing to `main` deploys production, so this is **not merged** without separate approval. A later staging or production deployment needs its own authorization, including the migrations. Rollback today means closing the PR. Any later rollback would disable the master flag; tables are additive and can stay.

## 15. Documentation deliverables
`docs/noetia-plus` is unchanged. Create: a technical note on the control plane; ADR-005 and ADR-006 drafts if not already accepted; a report at `docs/reports/`; migration entries in `docs/database-migrations.md`.

## 16. Open decisions
| Decision | Question | Why it matters | Blocks? |
|---|---|---|---|
| TT-04 | Limit semantics | Defines what is enforced | **Yes** |
| TT-05 | My Knowledge and highlights | Defines scope filters | **Yes** |
| TT-21 | Authority, numbering, NEM-006 | Governance | **Yes** |
| TT-02 | Prerequisite | The rule stays configurable; default **deny without a grant** | Only the confirmation |
| TT-09, 11 | Budget values and reset | Test placeholders are used; shape is configurable | No |
| TT-12 | Launch corpus | Default deny makes it irrelevant here | No |

Details and recommended defaults are in [05](../../architecture/three-tier-intelligence/05-open-decisions.md).

## 17. Stop conditions
STOP and mark BLOCKED if:
- any change appears necessary outside §5, especially to the reader, Stripe, tokens, ownership, `SubscriptionGuard`, CI/CD, or Docker;
- a real provider or spend seems necessary;
- an existing table must be altered, or a deployed migration edited;
- any test requires a production connection;
- the module cannot be disabled without affecting another module;
- TT-04 or TT-05 rulings conflict with ADR-003;
- a limit or budget value would need inventing beyond marked test placeholders.

## 18. Completion report
At REVIEW, per the README standard: Mission · Status · Changed Files · Database · Tests · Verification · Deployment · Deviations · Risks · Discoveries · Protected Systems Confirmation · Commit (SHA) · Recommended Next Step. Also a `docs/reports/` report per the reporting protocol, linked from the Draft PR.

## 19. Product Architecture review
**Reviewer:** Product Architecture, using `REVIEW-CHECKLIST.md`. **Verdict:** ______ (APPROVE / APPROVE WITH FOLLOW-UP / REJECT-REMEDIATE). Completion requires review and Product Owner acceptance.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
