# SA-002-T0 — Product Architecture Review of ADR-005 and ADR-006

> **Revision 3 (2026-11-08): ADR-005 and ADR-006 revision 3 recorded as ACCEPTED** by PO authorization after the final consistency check (no material contradiction). NEM-019 revision 4 remains **DRAFT**.
>
> **Revision 2 (2026-11-08): the PO accepted B-1…B-5 and they are incorporated (ADR-005/006 rev 3, NEM-019 rev 4); see the Revision 2 section below.**
>
> **Verdicts: ADR-005 — ACCEPT WITH REQUIRED CORRECTIONS · ADR-006 — ACCEPT WITH REQUIRED CORRECTIONS.** Both directions are sound and compatible with ADR-001…004 and with the current code. **Five blockers** (B-1…B-5) must be corrected in the ADR text, and mirrored in NEM-019, before NEM-019 can be approved. All five are documentation corrections; none needs a Product Owner product decision.
>
> **NEM-019: NOT READY FOR APPROVAL** until B-1…B-5 are incorporated, the ADRs are formally accepted, and the earlier prerequisites are met (§6).
>
> **Status of the ADRs is unchanged: both remain Proposed.** This report changes no ADR, PO record, mission, or code. TT-27 is **not** decided here.

## Revision 2 — corrections incorporated (2026-11-08)

> **The PO accepted B-1…B-5** as required corrections (2026-11-08) and authorized a documentation-only revision, adding two requirements: durable settlement recovery (B-5) and an account-deletion integration test over every user-related AI table (B-2). They are incorporated in **ADR-005 revision 3, ADR-006 revision 3, and NEM-019 revision 4** (Draft PR stacked on PR #41). F-1…F-11 are recorded as phase gates in three-tier `05` and `06`. **ADRs remain Proposed; NEM-019 remains DRAFT.** PO-026, PO-027, PO-028, and PO-030 are unchanged. TT-01, TT-12, TT-27, premium pricing, and quantitative AI budgets remain unresolved.

| Blocker | ADR-005 rev 3 | ADR-006 rev 3 | NEM-019 rev 4 |
|---|---|---|---|
| **B-1** Budget authority; fail closed | Decision: *Budget authority*; Boundaries: *Failure* | — | §9 *Budget authority*; AC-15c; §12 Redis/ledger unavailable → denied |
| **B-2** Account deletion never blocked; no orphaned private content | Decision: *Account deletion*; Boundaries row | *Account deletion* paragraph | §9 foreign-key rules per table; §10; **AC-15e integration test over every user-related AI table**; AC-15f schema test; §16 retention option |
| **B-3** Context Builder invariant scoped to sessions; declared invariant per model path | — | *Source-scope isolation* | §9; AC-12a |
| **B-4** Eligibility = rights verification AND access basis | — | *Session book set* | §9; AC-11b |
| **B-5** Turn order; **durable, idempotent settlement and recovery; no duplicate charges; fail-closed admission while unresolved reservations threaten integrity; settlement never assumed** | Decision: *Durable settlement and recovery* | *Turn order* with failure table | §9 *Turn order*, *Durable settlement and recovery*; AC-15c, AC-15d; §12 |

**Revised NEM-019 readiness: READY FOR PRODUCT OWNER APPROVAL DECISION once the ADRs are formally accepted.** No review blocker remains open in the text. Remaining before approval: (1) human Product Architecture confirmation and formal acceptance of ADR-005/006 revision 3 (separate approval); (2) PO approval of NEM-019 revision 4 and its identifier; (3) PO ruling on whether draft PO-025 must be accepted first. Optional: the B-2 retention choice for anonymized cost records (either option satisfies AC-15e).

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-08 | Review: both ADRs accept with required corrections; five blockers; eleven follow-ups; six advisories (PR #41, `6bf4f53`) |
| 2 | 2026-11-08 | PO accepted B-1…B-5; corrections incorporated (this section); F-1…F-11 recorded in `05` and `06` |
| 3 | 2026-11-08 | PO *Final ADR Corrections and Architecture Acceptance*: NEM-019 §4 now cites ADR-005/006 revision 3; AC-15c separates admission-time from settlement-time ledger failure, consistent with AC-15d and ADR-005. **Final consistency check:** no material contradiction among ADR-005/006 rev 3, PO-026/027/028/030, NEM-019 rev 4, and ADR-001…004. Three wording clarifications made at acceptance (no change of substance): ADR-005 admission versus settlement ledger failure; ADR-006 step-4 release failure; ADR-006 Rights heading no longer implies draft PO-029 is decided. **ADR-005 and ADR-006 accepted 2026-11-08.** PO-030's implementation table still shows the ADRs as Proposed; it is a decision record and was not edited |

---

# Revision 1 — review (2026-11-08)

Evidence labels: **[CODE]** verified on `origin/main` `6a5e5c0` · **[CONFIG]** repository configuration on `main` · **[DOC]** stated in a reviewed document · **[PO]** decided Product Owner record · **[PROPOSED]** this review's recommendation.

---

## 1. Mission and objective

| | |
|---|---|
| Identifier | `SA-002-T0` (ADR-005/006 review). A separately assessed item of SA-002-T0, named under the reporting protocol's parent-identifier rule; no new identifier |
| Type | Architecture acceptance review (documentation only) |
| Authorization | PO, *Product Architecture Review: ADR-005 and ADR-006 — Formal Architecture Acceptance Review* (2026-11-08). Documentation and review only |
| Objective | Decide whether ADR-005 and ADR-006 (revision 2, PR #40) are consistent, secure, implementable, testable, and isolated from existing Noetia systems; give one verdict per ADR; classify findings; assess NEM-019 readiness |

**Independence disclosure.** Revision 2 of both ADRs was drafted by the same agent that wrote this review (SA-002-T0 Rev 2, PR #40). The review re-verified every claim against code and configuration rather than against the drafts, but it is **not independent in authorship**. A human Product Architecture reviewer should confirm the verdicts before formal acceptance.

## 2. Date and status

| | |
|---|---|
| Date | 2026-11-08 |
| Lifecycle status | **Review** |
| Delivery state | Not merged. Draft PR stacked on PR #40 → #35 → #34 |
| This report authorizes | **Nothing.** ADR acceptance requires a separate explicit approval |

## 3. Repository baseline

| Item | Value |
|---|---|
| ADRs reviewed | ADR-005 and ADR-006 revision 2 at `docs/sa-002-t0-rev2-po-approvals` `d1f9fc8` (PR #40) |
| Code and configuration | `origin/main` `6a5e5c0` |
| This branch | `docs/sa-002-t0-adr-005-006-review`, created from `d1f9fc8` |
| Also read | `CLAUDE.md`; `docs/engineering-missions/README.md`, `REVIEW-CHECKLIST.md`; PO-026, PO-027, PO-028, PO-030 (decided); PO-025, PO-029 (drafts); ADR-001…004; NEM-003 (`docs/noetia-plus/`); governance record `08`; NEM-019 revision 3; three-tier `03`, `05`, `07`; SA-003 conflicts C1–C14 (PR #36) |

## 4. Scope and exclusions

**In scope:** the review questions of the assignment (§3–§5 of the brief). **Excluded:** code, migrations, Stripe, infrastructure, CI/CD, deployment, production access, merging, executing NEM-019, changing ADR status, deciding TT-27 or any other Product Owner matter.

## 5. Executive summary

- **ADR-005** gives a single deny-first resolver, a prerequisite port that denies on `unknown`, versioned policies, capability-keyed budgets, and hard separation from tokens, ownership, and reader paths. Sound. **Missing:** which store is authoritative for budgets and what happens when the reservation store fails (B-1); how user-keyed AI data behaves on account deletion (B-2); the order of reservation, lock, and provider call (B-5).
- **ADR-006** gives a normalized, database-capped book set, a first-accepted-turn lock under a row lock, clean forks, default-deny rights, a separate Ask My Highlights path, and a Brief derived only from sessions. Sound. **Defects:** its "every path to a model" Context Builder invariant contradicts its own Ask My Highlights path (B-3); its ownership wording can be read as removing the ADR-002 entitlement requirement for licensed books (B-4); account deletion (B-2) and turn ordering (B-5) also apply.
- **Compatibility:** no dependency forces NEM-019 to modify a protected system, **provided** B-2 is adopted (cascading foreign keys). Account deletion is the one existing system the design could otherwise break.
- **Later-phase work** (follow-ups F-1…F-11) concentrates on Ask My Highlights copyright exposure (TT-27, unbounded `fragments.text`), cross-session reconstruction, Brief redaction after rights revocation, production adapters, and the fact that merging NEM-019's code would apply its migrations to production.

## 6. Verdicts and NEM-019 readiness

| Item | Verdict | Conditions |
|---|---|---|
| **ADR-005** | **ACCEPT WITH REQUIRED CORRECTIONS** | B-1, B-2, B-5 |
| **ADR-006** | **ACCEPT WITH REQUIRED CORRECTIONS** | B-2, B-3, B-4, B-5 |
| **NEM-019 (DRAFT rev 3)** | **NOT READY FOR APPROVAL** | B-1…B-5 incorporated in the ADRs and mirrored in NEM-019 §9, §10, §11; ADR-005/006 formally accepted; PO approval of the mission text and identifier; PO ruling on whether draft PO-025 must be accepted first |

## 7. Findings

### 7.1 Blockers (must be resolved before NEM-019 approval)

#### B-1 — Budget authority and failure semantics are not stated (ADR-005)

| | |
|---|---|
| File | `docs/architecture/adr/ADR-005-tier-entitlements-prerequisites-and-budget-boundaries.md`, Decision, line 19 |
| Evidence | ADR-005 says only "Reservation precedes any model call and settlement follows it." NEM-019 §9 adds "atomic Redis reservation, PostgreSQL ledger authoritative and rebuildable", and §12 lists a "Redis unavailable" test **with no expected outcome**. Production Redis [CONFIG] `infra/redis/redis.conf`: `appendonly yes`, `appendfsync everysec` (up to about one second of writes can be lost on crash), `maxmemory 256mb`, `maxmemory-policy noeviction` (writes fail when full). The same Redis holds authentication state (`services/api/src/auth/redis.provider.ts`) |
| Risk | Implementers choose fail-open or fail-closed; reservations lost on restart either over-admit or strand budget; an implementation that keeps state only in Redis becomes the authority by accident; budget keys without expiry can exhaust the 256 MB shared with authentication |
| Correction [PROPOSED] | Add to ADR-005 Decision, after line 19: *"**Budget authority.** The PostgreSQL ledger is the only authority for allowances, reservations, and settlements. Redis, if used, is an admission-control cache that can be rebuilt from the ledger. If the reservation store is unavailable, errors, or rejects a write, the request is **denied** before any model call (fail closed). Every reservation carries an idempotency key (one per turn), an owner, a capability, and an expiry; expired reservations are released by reconciliation from the ledger. Settlement records actual cost; any overage beyond the reservation is recorded, never silently dropped. Budget keys in a shared store are namespaced and always carry an expiry. No values are set here."* Mirror in NEM-019 §9 and give the §12 "Redis unavailable" case the expected result **denied, no provider call, no ledger change** |

#### B-2 — Account deletion is not addressed (ADR-005 and ADR-006)

| | |
|---|---|
| Files | ADR-005 Boundaries table (line 23 onward); ADR-006 Downgrade table (line 32 onward); NEM-019 §5.7, §8, §9 |
| Evidence | [CODE] `services/api/src/users/users.service.ts:54-69`: `deleteAccount` deletes `user_books`, `token_ledger`, `user_cause_preferences`, `courtesy_token_quotas`, `subscriptions`, `waitlist_entries`, then `this.repo.delete(userId)`, relying on `ON DELETE CASCADE` for the rest. Every user-owned table follows that convention (`1714000000006-CreateFragments.ts:10`, `…15-CreateUserBooksTable.ts:10`, `…40-CreateTokenLedgerAndCourtesy.ts:27`, `1748300000059-CreateUserPersonas.ts:7`). NEM-019 §8 allows changing **only** `app.module.ts` among existing runtime files, so `deleteAccount` cannot be extended. ADR-006 covers book deletion (`ON DELETE SET NULL` with a snapshot) but not user deletion |
| Risk | A `RESTRICT` or default (`NO ACTION`) foreign key from any `knowledge` table to `users` makes account deletion **fail** for anyone with AI data, breaking an existing protected flow. No foreign key leaves private conversations and highlights-derived content behind after deletion, contradicting PO-028 rule 6 |
| Correction [PROPOSED] | Add an invariant to both ADRs: *"**Account deletion is never blocked.** Every table keyed by a user references `users(id)`. Rows holding user content or user-derived data (sessions, session books via the session, conversations and messages, Briefs, grants) use `ON DELETE CASCADE`. Cost and usage records use `ON DELETE CASCADE` or `ON DELETE SET NULL` with no content; never `RESTRICT` or `NO ACTION`. No existing deletion code is changed."* Whether anonymized cost records are retained after deletion is a PO/PA choice (financial retention, PO-017, unmerged); NEM-019 may use either option. Add a NEM-019 acceptance criterion: *deleting a user who has sessions, conversations, grants, and ledger rows succeeds in the test database and leaves no row referencing that user's content* |

#### B-3 — The Context Builder invariant contradicts the Ask My Highlights path (ADR-006)

| | |
|---|---|
| File | ADR-006 line 43 versus lines 57-60 |
| Evidence | Line 43: "**Every path to a model** passes through a Context Builder invariant: all chunks, highlights, and notes must belong to a **selected**, currently eligible book." Lines 58-60: Ask My Highlights answers over the user's own highlights **across the whole personal library**, outside any session, under a separate "Highlight Context Builder invariant". Both cannot hold |
| Risk | An implementer either blocks Ask My Highlights (contradicting PO-028 rule 2) or weakens the session invariant to make room for it. NEM-019's stop condition "a rule … proves untestable or contradicts" could fire |
| Correction [PROPOSED] | Replace "Every path to a model" with *"Every **research-session** path to a model"*, and add: *"Every other path to a model has its own declared context invariant; Ask My Highlights uses the Highlight Context Builder invariant below. No path to a model may exist without a declared invariant and a test that proves it."* No change to PO-028 |

#### B-4 — Ownership wording can be read as dropping the ADR-002 entitlement requirement (ADR-006)

| | |
|---|---|
| File | ADR-006 line 19 |
| Evidence | Line 19: "**Eligibility is independent of ownership** … ownership never makes a book eligible." PO-027 rule 8 requires copyright and edition eligibility to be verified *independently of ownership*. It does not remove entitlement: ADR-002 [POLICY] requires "entitlement check → content AI-rights check", and AI use of licensed content is for books the user "has legitimately unlocked … subject to Noetia's rights agreement". Three-tier `03` eligibility table says "Non-owned licensed → not selectable for full-text analysis", but ADR-006 does not |
| Risk | A rights resolver that admits a verified *licensed* book for a user who does not own it, which is an ADR-002 violation. NEM-019 AC-11 tests the converse (owned without a rights record is denied) but not this case |
| Correction [PROPOSED] | Replace the line with: *"**Eligibility = rights verification AND access basis.** Rights are verified independently of ownership (PO-027 rule 8): ownership never makes a book AI-eligible. The access basis is either a verified public-domain edition, which needs no library entry (rule 4), or the user's entitlement to a licensed book under ADR-002. A verified licensed book the user is not entitled to is not selectable for full-text analysis."* Add NEM-019 AC: *a verified licensed fixture not owned by the user is denied; the same fixture owned (simulated port) is allowed* |

#### B-5 — Order of entitlement, reservation, lock, and provider call is unspecified (ADR-005 and ADR-006)

| | |
|---|---|
| Files | ADR-006 lines 20 and 24; ADR-005 line 19; NEM-019 §9 and AC-4, AC-5, AC-15 |
| Evidence | ADR-006: the set locks at the "first **accepted** analysis turn"; "a turn rejected in preflight does not lock"; "no provider call while holding the lock". ADR-005: "reservation precedes any model call". Neither says whether the budget reservation is part of preflight, nor what happens to a reservation when the lock transaction fails |
| Risk | Different but plausible orders give different results under the concurrency tests: for example, a set locked by a turn later rejected for budget, or a reservation leaked when the lock transaction aborts |
| Correction [PROPOSED] | Add to ADR-006 Transaction safety: *"**Turn order.** (1) resolve entitlement and tier policy; (2) validate the book set and each book's eligibility; (3) reserve budget with the turn's idempotency key; (4) in one short transaction with `SELECT … FOR UPDATE` on the session, re-read the set and its hash and, on the first turn, record the lock; commit; (5) call the provider outside any transaction; (6) settle. A failure at 1–3 rejects the turn in preflight: no lock, no charge. A failure at 4 releases the reservation. A failure at 5 or 6 keeps the lock and settles actual cost (zero if none was incurred)."* Mirror in NEM-019 §9 |

### 7.2 Follow-ups (required before a later phase)

| # | Finding | Evidence | Required before |
|---|---|---|---|
| F-1 | **Ask My Highlights copyright exposure (TT-27, not decided here).** Saved quotations may hold copyrighted text of any length: `create-fragment.dto.ts` has only `@IsString()` on `text`, with no length limit, and `fragments.text` is `text` [CODE]. Highlight answers could reproduce or transform large passages across the library. ADR-006 must, once TT-27 is decided, add: a bound on highlight context per request (value set later, TT-13); output-side reconstruction checks (ADR-002) on every highlight answer; per-book permission handling per TT-27; and no highlight generation for books whose rights forbid AI processing until TT-27 says otherwise | `services/api/src/fragments/dto/create-fragment.dto.ts:7-8`; `fragment.entity.ts:38-39`; ADR-006 lines 50, 57-65 | Ask My Highlights phase |
| F-2 | **Cross-session reconstruction.** ADR-006 says reconstruction safeguards apply "across sessions and exports" but names no mechanism. Required: cumulative per-(user, book) accounting of quoted and reproduced spans, recorded without content, checked before output; thresholds per TT-13 | ADR-006 Guardrails; ADR-002 anti-reconstruction | T5 |
| F-3 | **Brief immutability versus rights revocation.** ADR-006 makes Brief versions immutable, while `05` TT-14's recommended default removes quoted text on revocation. Required: immutable content record with **render-time redaction** of revoked quotations and a disclosed tombstone, rather than rewriting history | ADR-006 line 77; `05` TT-14 | T6 |
| F-4 | **Qualifying-plan adapter.** Must map Individual, Duo, Family subscriptions (PO-026) plus decided TT-15 rules. Reconcile with SA-003's household baseline and the ADR-007 draft (C1–C8), which would retire `linkedUserIds` | ADR-005 lines 17, 28; SA-003 C1–C8 | Adapter mission / T8 |
| F-5 | **Ownership adapter.** A `user_books` row is not proof of ownership: `POST /library/:bookId` adds any published book with `purchaseType` defaulting to `'free'` | `library.service.ts:18`; `user-book.entity.ts:28-29`; NEM-013 | T5 |
| F-6 | **"Dark" applies to routes, not to schema.** CD runs every migration in `services/api/src/migrations/` on each push to `main` (`.github/workflows/cd.yml:50`; `data-source.ts` migrations glob). Merging NEM-019's output would create its ten tables in production even with the module off. Merge needs its own deployment authorization, snapshot, and §5.4 checks | `cd.yml:49-50`; `services/api/src/data-source.ts` | Any merge of NEM-019 code |
| F-7 | **Shared Redis capacity.** Budget keys share 256 MB `noeviction` Redis with authentication. Before real traffic: key namespace, mandatory expiry, a memory budget, and monitoring; a separate Redis would be an infrastructure change needing authorization | `redis.conf`; `auth/redis.provider.ts:10` | T4/T5 |
| F-8 | **Policy-version change during a session.** ADR-005 makes policies versioned; ADR-006 handles tier downgrade but not a lowered limit in a new policy version. Rule needed: sessions record the policy version at lock, and a lowered limit is treated like a downgrade | ADR-005 line 15; ADR-006 lines 30-40 | First production policy change |
| F-9 | **AI data outside analytics.** PO-028 rule 6 keeps conversations private. State that AI conversation and highlight-answer content never enters the events stream, persona pipeline, author analytics, or admin views without a separate policy | PO-028 rule 6; `1748300000057-CreateEventsTable.ts`; persona pipeline | T5 |
| F-10 | **Test evidence.** CI on `main` has no PostgreSQL service (`.github/workflows/ci.yml`); the real-database job exists only on Release A (NEM-014). NEM-019's concurrency proofs will run on a disposable local database, so its completion report must include the raw test output | `ci.yml`; `services/api/jest.config.js` (unit only) | NEM-019 review |
| F-11 | **SA-003 conflicts C1–C14** against ADR-005, PO-026, NEM-019, and three-tier `04`/`05`/`06` remain open (PR #36) | SA-003 report §R5/R7 | Before the three-tier stack merges |

### 7.3 Advisory

| # | Finding |
|---|---|
| A-1 | Entities load by glob (`app.module.ts`: `entities: [__dirname + '/**/*.entity{.ts,.js}']`, plus `autoLoadEntities: true`), so `knowledge` entities register in the DataSource even when `KnowledgeModule` is not imported. That is metadata only, with no routes and no queries. Word NEM-019 AC-1 as "no `knowledge` provider, controller, or route is instantiated" |
| A-2 | Conditional registration is feasible without new dependencies: `@nestjs/config` 3.3.0 provides `ConditionalModule.registerWhen` (local install). `prom-client`'s global `register` lets `knowledge` add metrics without changing `MetricsModule`; `AuthModule` exports `JwtAuthGuard` but not its Redis client, so `knowledge` needs its own Redis provider |
| A-3 | ADR-006 extends ADR-003's origin labels with `user_content`. Add an "Extended by ADR-006" note to the ADR index rather than editing ADR-003 |
| A-4 | Express ADR-005's household rule in terms of a normalized household-membership input, not the `linkedUserIds` column, which the ADR-007 draft would retire |
| A-5 | Add a route-specific rate limit for `knowledge` routes beyond the global throttle (120 per minute per IP, `app.module.ts`) before any real traffic |
| A-6 | Deep links from citations of public-domain books not in the library must go through the existing content guard; three-tier `03` states this, and ADR-006 could reference it |

## 8. Architecture invariants to preserve

| # | Invariant | Source |
|---|---|---|
| I-1 | One resolver decides tier; feature code never reads plans, subscriptions, or Stripe | ADR-005 |
| I-2 | Deny first; `unknown` denies; flags only restrict; grants never bypass the prerequisite | ADR-005; PO-026 |
| I-3 | Premium requires an active Individual, Duo, or Family subscription; premium state never writes to a book plan; cancelling premium never cancels the book plan | PO-026 |
| I-4 | `BOOK TOKEN ≠ AI USAGE`: no shared table, foreign key, import, or code path | PO-001; PO-026 rule 5; ADR-005 |
| I-5 | Reader, content guard, and library never call `knowledge/*`; premium state never changes book access; ownership is permanent | ADR-005; PO-021 |
| I-6 | Data keyed by individual user; household membership shares nothing automatically | PO-026 rule 6; PO-028 rule 6 |
| I-7 | Limits from policy only, enforced server-side, capped in the database (positions 1–10); every selected book counts | PO-027; ADR-006 |
| I-8 | Eligibility = verified rights AND access basis (verified public domain, or entitlement to a licensed book); default deny; metadata is never evidence | PO-027 rule 8; ADR-002; ADR-006 (with B-4) |
| I-9 | Lock at the first accepted turn; fixed turn order; no provider call under a lock | ADR-006 (with B-5) |
| I-10 | Forks carry generated context only when the parent's books are a subset and rights permit | ADR-006 |
| I-11 | Downgrade, revocation, and catalogue removal never delete history; book deletion is never blocked | ADR-006 |
| I-12 | Every path to a model has a declared, tested context invariant; session paths admit only selected eligible books; Ask My Highlights admits only the requester's own rows and never book text or chunks | ADR-006 (with B-3); PO-028 rules 1, 5 |
| I-13 | Budget authority is the PostgreSQL ledger; reservation-store failure denies | ADR-005 (with B-1) |
| I-14 | Account deletion is never blocked; user content cascades | Existing convention (with B-2) |
| I-15 | No model name in customer-visible output; no book text, prompts, notes, or PII in logs or metrics | ADR-001; NEM-019 §10 |

## 9. Compatibility with ADR-001…004 and existing systems

| Item | Assessment |
|---|---|
| ADR-001 (provider abstraction, routing, COGS bands) | **Compatible.** Gateway and Router interfaces with a simulated provider; micro-USD rate cards; COGS reported per tier |
| ADR-002 (permission before retrieval, rights classes, anti-reconstruction) | **Compatible with B-4.** Default deny and per-turn re-evaluation strengthen it; cross-session reconstruction is F-2 |
| ADR-003 (This Book / My Knowledge / Expand; no invisible blending) | **Compatible.** Session scope is a second axis, not a fourth mode; `user_content` extends origin labels (A-3) |
| ADR-004 (pgvector, exact search, chunks separate from sync phrases) | **Compatible.** Explicit allowed sets bound exact search; NEM-019 does no retrieval |
| Subscriptions and Stripe | **Isolated.** No adapter; no import; billing out of scope. Current cancellation acts on the only Stripe subscription (T0 hazard), which is a T8 concern |
| Tokens | **Isolated** by architecture tests (NEM-019 AC-16, AC-17) |
| Ownership, `user_books`, `fragments` | **Untouched.** Ownership port has no adapter; `fragments` is read-only in later phases |
| Account deletion | **Compatible only with B-2** |
| Book deletion | **Compatible:** `ON DELETE SET NULL` with snapshot |
| Redis | Usable with its own provider and namespace; capacity is F-7 |
| Metrics, authentication | Usable without modifying either module (A-2) |
| Migrations and CD | Additive and reversible; **merge equals production schema change** (F-6) |
| Reader and Escucha Activa | **Untouched**; no import path |

**Dependency check.** With B-2 adopted, nothing in ADR-005 or ADR-006 forces NEM-019 to modify a protected system or exceed its scope: the only existing runtime file it changes remains `app.module.ts`.

## 10. Remaining Product Owner decisions, by phase

| Phase | Decisions |
|---|---|
| T1 NEM-019 (dark) | Approval of the mission text and identifier; whether draft PO-025 must be accepted first; optionally, whether anonymized cost records survive account deletion (B-2) |
| T2 Evaluation | TT-12 launch corpus; TT-26 evidence standard; TT-07 NoetiaX depth criteria |
| T3 Semantic foundation | Infrastructure authorization (NEM-006B production pgvector proof) |
| T4 Real Gateway | TT-22 provider data handling and disclosures; provider credentials |
| T5 Noetia+ beta | TT-13 thresholds; TT-14 retention; TT-23 pilot; **TT-27** and TT-25 if Ask My Highlights is included |
| T6 Brief MVP | TT-17 formats; TT-08 depth; TT-14 revocation treatment (F-3) |
| T7 NoetiaX beta | TT-07 |
| T8 Billing | TT-16 prices and Stripe architecture; TT-15 linked members and states; TT-09/10/11 budget values and resets; TT-01 token expiry; Q4 launch gate |
| T9 Release, mobile | TT-20; TT-22; Q4 |

## 11. Recommended corrective actions

1. **Incorporate B-1…B-5** into ADR-005 and ADR-006 (revision 3) using the proposed text in §7.1, and mirror them in NEM-019 §9, §10, §11, and §12 (revision 4). Documentation only; requires authorization to edit PR #40's files.
2. **Product Architecture (human) confirms** the verdicts, given the independence disclosure in §1.
3. **Separate explicit approval** to change ADR-005 and ADR-006 to Accepted.
4. Record F-1…F-11 in three-tier `05` and the roadmap as phase gates.
5. Then the PO decides NEM-019 approval and the PO-025 question.

## 12. Changes made

| Item | Change |
|---|---|
| Files | `docs/reports/2026-11-08-SA-002-T0-ADR-005-006-architecture-review.md` (**new**, this report) |
| ADRs, PO records, NEM-019, three-tier documents | **None.** Corrections are proposed only |
| Code, database, migrations, Stripe, infrastructure, CI/CD, deployment, production | **None** |

## 13. Tests and validation

Documentation review; no code was run. Verified on `origin/main` `6a5e5c0`: `users.service.ts:54-69`; foreign-key conventions across migrations `000`–`067`; `fragments` DTO and entity; `book.entity.ts` (no rights columns; `pendingRights` exists only in the ingestion catalogue); TypeORM configuration in `app.module.ts` and `data-source.ts`; `cd.yml` migration step; `ci.yml` (no PostgreSQL service); `jest.config.js`; `redis.conf`; `auth/redis.provider.ts`; `metrics.module.ts`; `auth.module.ts` exports; `@nestjs/config` 3.3.0 `ConditionalModule.registerWhen` (local install); the ten proposed table names are unused on `main`, and `services/api/src/knowledge/` does not exist.

## 14. Deviations and discoveries

- Independence limitation (§1).
- Discovery: CI on `main` cannot run NEM-019's integration tests (F-10).
- Discovery: merging NEM-019's output is a production schema change despite the module being off (F-6).

## 15. Protected-systems confirmation and authorization boundaries

Not modified: reader and Escucha Activa; ownership and `user_books`; `fragments`; tokens; subscriptions, Stripe, and billing code; account deletion; business-rule engines; production and staging; infrastructure; CI/CD; ADR-001…006 text and status; PO records; NEM-019; PRs #34, #35, #40, and all others. No merge. NEM-019 not executed. TT-27 not decided.

## 16. Open questions and unresolved items

| # | Item | Owner |
|---|---|---|
| 1 | Authorization to incorporate B-1…B-5 into ADR-005/006 and NEM-019 | PO |
| 2 | Human Product Architecture confirmation of the verdicts | Product Architecture |
| 3 | Retention of anonymized cost records after account deletion (B-2 option) | PO / Product Architecture |
| 4 | TT-27 (not decided here) | PO / Legal |
| 5 | Formal acceptance of ADR-005 and ADR-006 after corrections | PO + Product Architecture |

## 17. Next recommended action

Authorize a documentation-only revision of PR #40 that applies B-1…B-5 to ADR-005, ADR-006, and NEM-019; then a human Product Architecture confirmation and a separate acceptance decision. *Recommendation only.*
