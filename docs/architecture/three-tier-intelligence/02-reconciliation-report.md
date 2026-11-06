# 02 — Reconciliation Report: NEM-003, ADRs, and PO Decisions

**Status:** PROPOSED for review. NEM-003 stays a **historical design record**: no NEM-003 file, ADR, or decision record is changed by this package. Code citations were verified against `origin/main` at `6a5e5c0`.

---

## 1. Decisions preserved unchanged

| Decision | Status here |
|---|---|
| PO-001 / ADR-001: provider-agnostic Gateway, dynamic routing, no model in the promise, `BOOK TOKEN ≠ AI USAGE` | Preserved and reused |
| PO-002 / ADR-002: permission before retrieval, rights classes, title-level controls, no training default, anti-reconstruction, no universal fair-use number | Preserved and reused |
| PO-003 / ADR-003: This Book / My Knowledge / Expand, no invisible blending, provenance | Preserved; three modes remain three (extensions in §4) |
| PO-004 / ADR-004: PostgreSQL + pgvector, exact search first, Semantic Retrieval Interface, chunks separate from sync phrases | Preserved; a bounded book set helps exact search stay cheap |
| PO-005 (unmerged branch): initial provider configuration | Preserved as configuration; no model name appears in tier design |
| NEM-003 `knowledge/` context in the monolith, Orchestrator as the single enforcement point, BullMQ in the existing worker, flags, metering, `knowledge_assets` | Reused |
| Reader Stability First; Permanent Book Ownership; Personal Libraries Remain Personal | Preserved as hard constraints |

## 2. Conflicts raised for Product Owner review

None of these is resolved here. Each has a decision entry in [05](05-open-decisions.md). **T0 update:** C-1, C-2, C-3, and C-6 received preliminary rulings; C-10 stays as it was. See the status table below this one.

| # | Conflict | Sources | Severity | Decision |
|---|---|---|---|---|
| **C-1** | **Token expiry.** The 2026-11-06 invariant says purchased tokens expire after 90 days. PO-024 rule 9 (DECIDED 2026-10-30, unmerged PR #17) says 3/5/10-token packages expire after **six calendar months**. Code, ToS, and pricing copy all say 90 days today. | Assignment; PO-024 rules 8–9; `subscriptions.service.ts:27`; `terms-of-service.ts:31,128` | **High:** financial, customer-facing | TT-01 |
| **C-2** | **Premium prerequisite.** Three positions exist: PO-022/023 records (independent, standalone); the approved direction of 2026-10-30 (Noetia+ requires an active book plan, amendment wording not applied); the 2026-11-06 scope (silent, and bans "Basic" as a label). Nothing covers NoetiaX. | PR #12; PR #18 | **High:** eligibility, billing | TT-02, TT-03 |
| **C-3** | **Session limits versus My Knowledge.** ADR-003 defines My Knowledge as the user's whole accumulated library. A 3- or 10-book cap on analysis cannot coexist with unbounded library-wide analysis. **Ask My Highlights** (NEM-003 MVP) has the same issue, since highlights can span any number of books. | ADR-003; NEM-003 01, 09, 19 | **High:** defines the tier boundary | TT-04, TT-05 |
| **C-4** | **Advanced workloads in Noetia+.** ADR-001 classes cross-book synthesis and contradiction analysis as advanced reasoning, "used selectively". Under the new scope, every Noetia+ session is cross-book and every Brief reports agreements and contradictions. | ADR-001; PO-001 | **High:** cost | TT-08 |
| **C-5** | **Economics written for one tier.** The ~$1.50 COGS target and the $5.99–$9.99 band assume a single Noetia+. No target exists for NoetiaX. Whether the COGS band is measured on gross or net revenue is also open (PR #18 Q-E11). | PO-001; PR #18 | **High:** cost | TT-09 |
| **C-6** | **Rights may leave little to analyse.** ADR-002 requires verifying the specific edition before treating a text as public domain, and `books` has **no** rights, edition, translator, or AI-permission fields (only `isFree`). NEM-003's recommended default makes cross-book comparison **opt-in** for licensed titles. Applied strictly, the launch corpus for multi-book sessions could be close to empty. The PRD also sets the free library to be demoted once 50+ author titles exist, so public-domain books alone cannot be the long-term corpus. | ADR-002; NEM-003 05, D6; `book.entity.ts` | **High:** launch feasibility, legal | TT-12 |
| **C-7** | **Visible units versus internal budgets.** NEM-003 D10 recommended showing named units ("standard requests / deep analyses / creation jobs") and `/plus/usage/me` exposes them. The assignment specifies *internal* resource budgets and fair-use controls. | NEM-003 07, 10, D10 | Medium | TT-10 |
| **C-8** | **Stripe structure.** The PO-021–023 impact assessment recommends two Subscriptions *because of* independence. PR #18 favours one Subscription with two line items after the dependency direction. Three tiers add tier swaps. Still open (Q-E14). | PR #12 §4; PR #18 §9 | Medium | TT-16 |
| **C-9** | **Retention.** NEM-003 D5 is still open, and Briefs add durable, exportable artifacts. Rights revocation after export is undefined. | NEM-003 D5, 08, 15 | Medium | TT-14 |
| **C-10** | **Relationship to NEM-006.** NEM-006 (Noetia+ implementation) is PAUSED with no commits and no repository-resident scope. Its prerequisites overlap the roadmap here. | `nem-007-creator-rights`: NEM-006 record | Medium: governance | TT-21 |
| **C-11** | **Legal surfaces are silent on AI.** The Terms and Privacy Policy on `main` do not mention AI or AI processing, and sending book text and user notes to external providers needs disclosure review. | `services/web/lib/legal/*` (no match for AI terms) | Medium: legal | TT-22 |

### T0 status of these conflicts

| Conflict | T0 ruling | Remaining |
|---|---|---|
| C-1 Token expiry | PO-024 preserved | Code, ToS, and copy remain at 90 days, so remediation is needed; PO-024's own open items |
| C-2 Prerequisite | Both tiers require a qualifying book subscription (PO-026) | Qualifying plans, linked members, states, and lifecycle |
| C-3 Limits versus My Knowledge | Analysis bound to selected books; separate highlight search (PO-028) | Generation over highlights alone (TT-24); semantic search (TT-25) |
| C-6 Rights | Verified public domain first, then opt-in; default deny (PO-029) | Evidence standard, verifier, jurisdiction (TT-26) |
| C-10 NEM-006 | No change ordered: **stays PAUSED** | Disposition is not needed for NEM-019 |
| C-4, C-5, C-7, C-8, C-9, C-11 | Not addressed by T0 | Open; none blocks NEM-019 |

## 3. Current code versus the design

These are facts about `main`. They are not criticisms of NEM-003, which flagged several of them.

| # | Fact | Evidence | Consequence |
|---|---|---|---|
| F-1 | **No intelligence code exists on any branch**: no `knowledge/` module, AI SDK, or `book_chunks` | Tree check across all remote refs | Everything in this package is greenfield and additive |
| F-2 | One subscription per user | `1714000000009-CreateSubscriptions.ts:20`; upsert `subscriptions.service.ts:531` | A second Stripe subscription **overwrites** the book-plan row |
| F-3 | Webhooks read only the first line and item | `webhooks.service.ts:130,176` | A two-item subscription is misread |
| F-4 | Every paid invoice issues tokens from `plan.tokensPerCycle`, which defaults to 1 | `webhooks.service.ts:141`; `subscriptions.service.ts:303`; `plan.entity.ts:23-24` | A premium plan row could mint book tokens, breaking a commercial invariant |
| F-5 | `GET /subscriptions/plans` returns every plan, and the pricing page renders every row for the interval | `plans.service.ts` `findAll`; `pricing/page.tsx:55` | A premium plan row becomes publicly purchasable immediately, with no gating |
| F-6 | Any active subscription row grants access to all paid books | `subscription.guard.ts:13,41` | A premium subscriber would unlock the catalogue, contradicting PO-021/022. NEM-013 is unbuilt |
| F-7 | `POST /library/:bookId` adds any published book, recording `purchaseType` as its default `'free'` | `library.service.ts:19`; `user-book.entity.ts:29` | **A `user_books` row is not yet proof of ownership.** The fix (NEM-011) is unmerged, and B-10 (historical bypass rows) is open. AI eligibility must not rely on row existence alone |
| F-8 | `removeBook` deletes ownership rows | `library.service.ts:28` | A selected book can lose eligibility during a session, so eligibility is re-checked every turn |
| F-9 | No `?phrase=` deep link in the reader | No match under `services/web` | Citation deep links need a small change to a **protected system**, which needs explicit authorization |
| F-10 | Books without a sync map fall back to text in the reader | `reader/[id]/page.tsx:182` | Phrase ranges are not always available, so citations cannot depend on them alone |
| F-11 | API has no BullMQ dependency; worker runs two queues on 0.5 CPU / 256 MB | `services/api/package.json`; `worker/src/index.ts`; `docker-compose.server.yml:169-188` | Producer gap confirmed (NEM-003 02). Deep runs need capacity review |
| F-12 | Production uses `postgres:16-alpine`, limited to 1 CPU / 512 MB; pgvector exists only in the staging compose file | `docker-compose.server.yml:197-218`; `docker-compose.staging.yml` on `nem-006a-staging` | ADR-004's infrastructure safety steps are all outstanding. Vector load shares the reader's database |
| F-13 | Token packages are live at 999 / 2499 / 3999 / 7499 cents; purchase needs only login and confirmed email | Public `GET /api/subscriptions/token-packages` (2026-11-06); `subscriptions.controller.ts:48-50` | **Invariant holds**, with no tier check to add. Stripe prices were not checked |
| F-14 | Mobile gates the app on subscription status | `mobile/src/api/subscriptions.ts:24-26` | Tier design must not rely on this; PO-021 requires its removal |
| F-15 | `DELETE /users/me` does not cancel Stripe (NOF-004 audit; not re-verified here) | PR #23 | Premium billing could continue after account deletion |
| F-16 | Author hosting has an unrelated tier called `basic`, shown as "Básico" and printed raw in an error | `author/page.tsx:20`; `books.service.ts:91` | Not a premium label, but likely to be confused with one. Reported, not changed (TT-03) |
| F-17 | `POST /fragments` accepts any `text` for any `bookId` with no length limit or source check; `PATCH` can rewrite it; source positions are never stored | `create-fragment.dto.ts`; `fragments.service.ts:23-31,51-56`; SA-001 §5.4 | **`fragments.text` is an assertion, not evidence** (PO-028) |
| F-18 | Cancellation sets `cancel_at_period_end` on the user's single Stripe subscription | `subscriptions.service.ts:482-490` | With shared billing, cancelling a premium tier could cancel the book plan, contradicting PO-026 |
| F-19 | Every subscription checkout hard-codes a 14-day trial | `subscriptions.service.ts:207-216` | A premium plan would inherit it; trial policy is undecided |
| F-20 | The NEM-014 integration-test job is on Release A, not `main` | `.github/workflows/ci.yml` on each ref | NEM-019 uses a disposable local database |

**Hazard summary (F-2, F-4, F-5, F-6, F-18, F-19).** On current code, adding one premium plan row would at once list it publicly with a free trial, mint book tokens, unlock all paid books, and overwrite the user's book-plan row, and cancelling it could cancel the book plan. **No premium plan may be added before the product-line work (impact assessment M-C, M-D) and NEM-013.**

## 4. Necessary extensions to approved architecture

These extend ADRs without changing their decisions. Each needs review; formal acceptance could take the form of new ADRs (TT-21).

| # | Extension | Why | Touches |
|---|---|---|---|
| X-1 | **Scope has two independent axes**: source *mode* (ADR-003) and session *book set* (new). No fourth mode | Resolves C-3 without redefining modes | ADR-003 |
| X-2 | **Origin label is required**, not "where useful": `library`, `broader`, `synthesis`, or `user_content` on every answer segment | Cross-book synthesis is neither purely a book's claim nor external knowledge, and a user's words must never be attributed to an author (PO-028) | ADR-003 |
| X-3 | **Citation anchor = `textHash` + character range.** Phrase range becomes a derived, re-resolvable value | Sync maps have been re-seeded (60 production books in 2026), so stored phrase ranges in durable Briefs can go stale | ADR-003, ADR-004 |
| X-4 | **Rights metadata on books**: rights class, edition/translation verification, title-level AI operations | ADR-002 requires it and the schema has none (C-6) | ADR-002 |
| X-5 | **Reconstruction ledger spans sessions and exports**, per (user, book) | Sessions and Briefs otherwise offer an easy way around per-turn limits | ADR-002 |
| X-6 | **Shared derived artifacts are rights-governed**: per-book maps are subject to title permissions and purged on revocation | Needed for NoetiaX cost; not considered by ADR-002 | ADR-002, NEM-003 15 |
| X-7 | **Budget ledger with reservations**, alongside `ai_usage_events` | NEM-003's event log records usage after the fact and cannot prevent overspend under concurrency | NEM-003 07, 09 |
| X-8 | **Prerequisite rule in the entitlement resolver** | NEM-003 08 checks only the Noetia+ subscription (PR #18 C-5) | NEM-003 08 |

## 5. NEM-003 elements superseded *if* this package is approved

The original files stay as written. This table is the proposed reading guide.

| NEM-003 element | Proposed successor | Basis |
|---|---|---|
| 01: "Noetia+" as the only premium layer | Noetia+ and NoetiaX | `PO` |
| 01, 19: MVP is Ask This Book + Ask My Highlights; cross-book is Phase 2 | Selected-book research session is the first premium experience; one-book session is the smallest case | `PO` journey |
| 08: "a Noetia+ subscription is just another `Subscription`/`Plan`" | Product-line model; already disproved by F-2 (PR #12 C-08) | Verified code |
| 08, 02: `PlusEntitlementGuard` composed on `SubscriptionGuard` | Independent resolver; never touches the content guard (PR #12 C-09) | PO-021 |
| 09: `ai_conversations.sourceRefs` jsonb holds selected books | Normalized child table, so limits are enforceable | [03 §3](03-research-architecture.md#3-server-side-enforcement-of-book-limits) |
| 10, 18, 09: `/plus/*`, `plus.*`, `plus-*`, `PlusEntitlementGuard` | Neutral `intelligence` naming, since "plus" would misname NoetiaX. Nothing is built, so renaming costs nothing | Naming only |
| 13: `knowledge_assets.type` list | Add `research_brief` (additive) | [03 §6](03-research-architecture.md#6-research-brief) |

## 6. Defects found in NEM-003 and related documents

Reported only; history is not rewritten.

| # | Where | Issue | Proposed handling |
|---|---|---|---|
| H-1 | `EXECUTIVE_SUMMARY.md` §4, `16-observability.md`, `20` D1 | COGS bands 15/30/45 contradict PO-001's 15/25/35 | **PO-001 governs** (also PR #18 X-2, Q-E10). All tier design here uses 15/25/35 |
| H-2 | `18-feature-flags-rollout.md` resolution order | "Plan capability → allow" comes *before* the rollout bucket, so rollout cannot restrict paying users, and "bucket → allow" could admit a user with no entitlement | Rollout must be a gate in addition to entitlement ([04 §2](04-entitlements-and-budgets.md#2-tier-capability-model)) |
| H-3 | `05-content-permissions.md` `PUBLIC_DOMAIN` trigger: `book.isFree` + status | `isFree` governs catalogue readiness and the sync gate, not rights (Creator & Rights Framework; corrected from the first version of this table). ADR-002 requires edition-level verification | Never rights evidence (PO-029) |
| H-4 | `05` OWNED scope: "any `purchaseType`" | Unsafe while bypass rows exist (F-7) | Depends on NEM-011 and B-10 |
| H-5 | `09`: storing `snippet` in `ai_messages.citations` | Durable verbatim text outside rights control | Store only anchors, resolve text at display, and store quotes separately under policy |
| H-6 | `19`, `22` | Do not mention the unmerged PO-005 or the NEM-006 prerequisites | Covered by [06](06-implementation-roadmap.md) |
| H-7 | `docs/PRD.md` | No mention of premium tiers; still lists Pay-per-Title and "Family 3 tokens, 6 users" (code and production: 4 tokens, 5 profiles). Lines 279 and 297 plan to gate Escucha Activa behind a subscription after beta, which must never become a *premium-tier* gate or remove it from owned books (Governance README) | PRD update after PO approval; not done here |
| H-8 | Repository state | PO-005…PO-024 exist only on unmerged branches or PRs, so `main`'s `PRODUCT-DECISIONS.md` is an incomplete view of policy | TT-21 |

## 7. Verdict

**Compatible, with conditions.** The approved architecture absorbs three tiers without replacing any ADR: a session book set, a tier-aware resolver, and separate budgets all fit the Orchestrator design. What it cannot do is resolve the conflicts in §2, especially C-1 to C-6, which are product, financial, and legal decisions. On current code, billing cannot safely carry a premium plan at all until the prerequisite missions land.
