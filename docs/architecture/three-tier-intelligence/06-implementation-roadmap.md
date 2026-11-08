# 06 — Architecture and Implementation Roadmap

**Status:** PROPOSED; updated after T0. **No phase is authorized.** Each needs its own approved mission and an explicit Product Owner execution instruction. Reader work keeps priority whenever it competes with these phases (Product Hierarchy).

---

## 1. Reuse

| Asset | Approved by | How it is used |
|---|---|---|
| AI Gateway + Model Router + provider abstraction | ADR-001 | All model calls; tier never selects a model name |
| PO-005 configuration | PO-005 | Initial routes, not a customer promise |
| PostgreSQL + pgvector + Semantic Retrieval Interface | ADR-004 | Exact search over ≤ 10 books: a naturally small candidate set |
| Rights classes, title-level controls, anti-reconstruction | ADR-002 | Permission pipeline; default deny |
| Modes and provenance | ADR-003 | Session turns; origin labels |
| `knowledge/` context, Orchestrator, one-way dependency | NEM-003 03 | Unchanged |
| BullMQ + existing worker | NEM-003 11 | Embedding, per-book artifacts, deep runs, Briefs, rollups; thin API producer added |
| Redis, MinIO (private prefix), Sentry, Prometheus, Grafana, i18n | Existing | As designed |
| `plans`, `subscriptions`, Stripe webhook idempotency | Existing | After M-C and M-D only |

**No new service or datastore.** Capacity (`db` 512 MB, `worker` 256 MB) is a review item; any change needs infrastructure authorization, and PO-020's zero-cost constraint currently covers resilience work only.

## 2. Prerequisites outside this roadmap

Existing missions; their scope is unchanged.

| Prerequisite | State | Needed before | Why |
|---|---|---|---|
| NEM-011, NEM-012, NEM-015 (Release A) | Draft PR #14 | T5 | Trustworthy ownership; token acquisition |
| B-10 (historical bypass rows) | Open | T5 | AI eligibility |
| NEM-013 (end all-access streaming) | Draft | T8 | Premium must not unlock books |
| M-C (product lines), M-D (billing foundation) | Proposed in PR #12 | T8 | F-2 to F-6 |
| NEM-017 and staging isolation (S19) | Draft PR #26 | T3 | Staging must be safe to use |
| NEM-006B (PG16 + pgvector restore proof), NEM-006C | Open | T3 production step | ADR-004 infrastructure safety |
| Rights metadata (NEM-007 Phase B) | Blocked | Licensed titles in T5+ | ADR-002 |
| Provider data-handling review; credentials | Open | T4 | PO-005 |
| TT-22 Terms and Privacy updates | Open | T5 | Real users, real data |
| PO-024 remediation (M-1…M-5 in PR #17) | Not started | Independent; should precede token copy or ToS changes | Code, ToS, and copy still say 90 days |

## 3. Phases

```
T0 Decisions ─▶ T1 Control plane (dark) ─▶ T2 Evaluation ─▶ T3 Semantic foundation
                                                                   │
              T4 Gateway + shadow measurement ◀────────────────────┘
                   │
                   ▼
              T5 Noetia+ closed beta ─▶ T6 Brief MVP ─▶ T7 NoetiaX closed beta
                                                              │
                     Calibrated values and prices (PO) ◀──────┘
                              │
                              ▼
                         T8 Billing ─▶ T9 Progressive release, mobile
```

### T0 — Decision closure

| | |
|---|---|
| **Scope** | PO rules on P0 decisions; records and ADRs updated (documentation only) |
| **Depends on** | This package |
| **Status** | Preliminary rulings received; PO-025…029 and ADR-005/006 drafted. **2026-11-08:** TT-02, TT-04, TT-05, TT-21 **decided** (PO-026, PO-027, PO-028, PO-030); ADR-005/006 revision 2 **Proposed**; TT-01 and TT-12 open (not T1 prerequisites). Ask My Highlights (PO-028) is not yet placed in a phase |
| **Acceptance** | PO accepts the records and amendments; Product Architecture accepts the ADRs |
| **Tests** | None |
| **Cost safeguard** | None needed: no spend |

### T1 — Tier-aware control plane, dark (draft: [NEM-019](../../engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md))

| | |
|---|---|
| **Scope** | Resolver, versioned tier policies, grants, flags, session and book-limit enforcement, budget ledger with reservations, Gateway interface with a **fake provider only**, default-deny eligibility |
| **Excludes** | Real providers, retrieval, pgvector, Stripe, tokens, reader, UI, Briefs, staging, production |
| **Depends on** | T0 acceptance only. No billing, provider, or staging dependency; uses simulated ports |
| **Acceptance** | All limit layers tested against races and forged input; token isolation proven by architecture tests; reader unaffected with module off |
| **Tests** | Unit (≥ 80%), real-PostgreSQL integration for locks, architecture boundary tests |
| **Cost safeguard** | **Zero AI spend is structural**: no adapter exists |

### T2 — Evaluation methodology and benchmark

| | |
|---|---|
| **Scope** | Corpus of verified public-domain books; ES, EN, cross-language question sets; metrics for citation accuracy, grounding, origin labelling, extraction refusal; **same-books depth benchmark** |
| **Depends on** | TT-07 criteria; rights verification and TT-26 ([07](07-rights-verification-requirements.md)) |
| **Acceptance** | Approved thresholds; no quality claim is "unfalsifiable" (AI Governance Framework gap closed) |
| **Tests** | Harness tests with stubbed outputs |
| **Cost safeguard** | Runs have an explicit spend limit approved in advance |

### T3 — Semantic foundation

| | |
|---|---|
| **Scope** | pgvector, `book_chunks`, chunking with anchors (X-3), embedding jobs, API producer, retrieval interface, rights metadata (X-4). Staging first |
| **Depends on** | T1, staging isolation; infrastructure authorization; production step needs NEM-006B |
| **Acceptance** | Retrieval within the allowed set only; exact-search latency measured at 1, 3, and 10 books; reader p95 unchanged during embedding |
| **Tests** | Permission joins, idempotent re-embed, anchor survival across a sync re-seed, restricted never retrieved |
| **Cost safeguard** | Embedding budget cap; verified-corpus only; off-peak; low concurrency |

### T4 — Real Gateway and shadow cost measurement

| | |
|---|---|
| **Scope** | Provider adapter(s) per PO-005 on staging; rate cards with **verified** prices; workload cost measured on the benchmark |
| **Depends on** | T2, T3; provider review; credentials |
| **Acceptance** | Normalized usage for each call; per-workload cost distribution reported at 1, 3, and 10 books; eval thresholds pass |
| **Tests** | Adapter contract, failure translation, cost calculation, fallback |
| **Cost safeguard** | Global staging cap; no real users; kill switch tested |

### T5 — Noetia+ interactive sessions, closed beta

| | |
|---|---|
| **Scope** | Journey steps 1–4 for 1–3 books, web first; citations; modes; provisional technical caps; grants only, **no billing** |
| **Depends on** | T4; Release A; B-10; TT-08, 10, 11, 13, 22, 23, 24 |
| **Acceptance** | Eval thresholds met; citations resolve; COGS measured per user; **AI outage has no reader impact**, verified |
| **Tests** | All [03 §3](03-research-architecture.md#3-server-side-enforcement-of-book-limits) negatives; reconstruction scenarios; injection; household isolation; degradation stages |
| **Cost safeguard** | Small grant list; provisional budgets; tier cap; alerts from first user |

### T6 — Synthesis and Research Brief MVP

| | |
|---|---|
| **Scope** | Synthesis, Brief schema, immutable versions, generated limitations, one export format (TT-17), private storage |
| **Depends on** | T5; TT-14, 17 |
| **Acceptance** | Every required section; each finding traceable; no Brief without a session; export uses no AI |
| **Tests** | Schema, failed-citation handling, exposure ledger across exports, access control |
| **Cost safeguard** | Generation has a ceiling; regeneration uses budget |

### T7 — NoetiaX depth, closed beta

| | |
|---|---|
| **Scope** | Approved TT-07 capabilities; up to 10 books; per-book artifacts; background runs |
| **Depends on** | T6; TT-07, 09 |
| **Acceptance** | **Depth benchmark passes on identical books**; cost by book count measured; artifact reuse measured; shallow output never presented as deep |
| **Tests** | Planner scope limits, resume after API restart, run ceiling, artifact purge on revocation, 45-pair prohibition |
| **Cost safeguard** | Run and session ceilings; advanced cap; separate NoetiaX cap; queue under pressure |

### T8 — Billing integration

| | |
|---|---|
| **Scope** | Premium products and prices, checkout, cascade rules, tier swaps, webhooks to entitlement. **PO-approved values only** |
| **Depends on** | M-C, M-D, NEM-013; TT-09, 15, 16; calibrated budgets; ToS |
| **Acceptance** | Premium invoices issue **no tokens**; no catalogue access gained; token prices unchanged; ownership untouched on cancel; Stripe test-mode validation |
| **Tests** | Each F-2 to F-6 hazard as a regression test; dunning, cancellation, upgrade, downgrade; idempotency |
| **Cost safeguard** | Rollout bucket; per-tier COGS dashboard reviewed before each expansion |

### T9 — Progressive release and mobile

| | |
|---|---|
| **Scope** | Percentage rollout; mobile path (TT-20); PRD update |
| **Acceptance** | Per-tier COGS within the approved band at each step; reader metrics unchanged |
| **Cost safeguard** | Automatic stop rules on bands and reader regression |

## 4. Cross-phase test requirements

| Category | Requirement |
|---|---|
| **Reader regression** | Reader, audio, and sync suites pass; AI disabled and AI failing cases both tested |
| **Ownership** | Owned-book access unaffected by any tier state |
| **Token independence** | No code path links AI budgets and tokens |
| **Isolation** | No cross-user or cross-household data in retrieval, cache, or Briefs |
| **Rights** | Default deny; revocation takes effect at the next turn |
| **Mocking** | No test calls a real provider; real-PostgreSQL integration where locking matters (NEM-014 precedent) |
| **Testing standard** | Mirrored `tests/unit/`; ≥ 80% coverage for touched services |

## 5. Main risks

| Risk | Severity | Mitigation |
|---|---|---|
| Premium billing added before prerequisites: tokens minted, catalogue unlocked, plan overwritten | **Critical** | T8 gated; regression tests for F-2 to F-6 |
| AI cost above revenue, especially NoetiaX heavy users | **Critical** | Reservation, hard budgets, tier caps, no value set without measurement |
| Reconstruction through sessions or Briefs | **High** | Cross-session ledger; thresholds by Product/Legal; residual risks stated |
| Reader regression from a shared database or API process | **High** | Dedicated pool, admission control, worker isolation, stop rules |
| Empty launch corpus | **High** | TT-12; verified public-domain first |
| NoetiaX perceived as only "10 books" | **High** | Depth benchmark as an acceptance gate |
| Provider terms or prices change | Medium | Gateway, rate cards, alerts |
| Governance drift among unmerged decisions | Medium | TT-21 |
