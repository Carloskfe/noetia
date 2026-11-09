# 05 — Decisions: Approved versus Open

This document keeps approved decisions and open questions strictly apart. **A recommendation is not a decision.** Nothing in Part B is assumed in any mission until the Product Owner rules.

---

## Part A — Approved decisions (not reopened here)

| Decision | Source | Record state |
|---|---|---|
| Three customer-facing tiers: Noetia, Noetia+, NoetiaX | PO scope update, 2026-11-06 | This assignment |
| Noetia+ maximum 3 books per analysis session; NoetiaX maximum 10 | Same | This assignment |
| No customer-facing label "Basic" | Same | This assignment |
| Both premium tiers: interactive conversation and Research Brief export; Brief does not replace the conversation | Same | This assignment |
| NoetiaX is qualitatively deeper, not only a larger limit | Same | This assignment |
| Token package prices $9.99 / $24.99 / $39.99 / $74.99, unchanged for premium tiers | Same | Verified on the public endpoint |
| Acquired books stay permanently owned | Same; PO-021 | PO-021 unmerged (PR #12) |
| Book tokens never increase AI allowances; separate monthly budgets and fair use | Same; PO-001 | Merged (PO-001) |
| Provider-agnostic Gateway, routing, no model promise, COGS guideline ≤ ~$1.50 and bands 15/25/35 | PO-001, ADR-001 | Merged |
| Permission before retrieval, rights classes, no training default, anti-reconstruction | PO-002, ADR-002 | Merged |
| This Book / My Knowledge / Expand; no invisible blending | PO-003, ADR-003 | Merged |
| PostgreSQL + pgvector, exact search first, retrieval interface | PO-004, ADR-004 | Merged |
| Initial provider configuration (revisable) | PO-005 | Unmerged (`nem-009-resilience-impl`) |
| Subscriptions never unlock paid books; acquisition by token only | PO-021 + Amendment 1 | Unmerged (PR #12) |
| Noetia+ requires an active book plan; cancelling Noetia+ does not cancel it; ending it ends Noetia+ | PO direction 2026-10-30 | Direction approved; **extended to both tiers and decided as PO-026 (2026-11-08)** |
| Final premium prices are **not** authorized | Assignment | — |
| **TT-02** Premium prerequisite: active Individual, Duo, or Family subscription; add-on; cancel/end rules; ownership; tokens ≠ AI budgets; no automatic household sharing | **PO, 2026-11-08** | **DECIDED** → [PO-026](../../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md) |
| **TT-04** Session limits 3 / 10; every selected book counts, including public domain; verified public-domain editions selectable without the library; lock at first turn; new or forked session to change; server-side; eligibility independent of ownership | **PO, 2026-11-08** | **DECIDED** → [PO-027](../../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md) |
| **TT-05** Full-book research bound to selected books; **Ask My Highlights searches and answers over own highlights library-wide**, outside the limit, with its own usage controls; no route to full-book retrieval; private; modes preserved | **PO, 2026-11-08** ("Option A"; rule text governs) | **DECIDED** → [PO-028](../../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md) |
| **PO-025** Three-tier structure (Noetia, Noetia+, NoetiaX; qualitative depth; conversations and session-derived Briefs; PO-026 prerequisite; permanent ownership; tokens ≠ AI budgets). Token expiration **not** decided (TT-01 open) | **PO, 2026-11-08** | **DECIDED** → [PO-025](../../operating-framework/decisions/product-owner/PO-025-three-tier-product-structure.md) |
| **ADR-005 and ADR-006** (revision 3) | **PO authorization after independent Product Architecture review, 2026-11-08** | **ACCEPTED** → [ADR-005](../adr/ADR-005-tier-entitlements-prerequisites-and-budget-boundaries.md), [ADR-006](../adr/ADR-006-research-sessions-book-limits-and-source-scope.md) |
| **TT-21** NEM-003 historical; **NEM-006 formally superseded**; ADR-005 and ADR-006 prepared; register updated; NEM-019 reconciled but not approved | **PO, 2026-11-08** | **DECIDED** → [PO-030](../../operating-framework/decisions/product-owner/PO-030-three-tier-architecture-governance.md); [08](08-architecture-governance-record.md) |

### T0 preliminary rulings (2026-11-06)

Drafted as PO-025…029 and amendment drafts. **Updated 2026-11-08:** TT-02, TT-04, TT-05, and TT-21 are now **decided** (above). **TT-01 and TT-12 remain open**: their T0 preliminary rulings were not adopted as decisions. PO-025 (three-tier structure) was **decided on 2026-11-08** with TT-01 kept open; PO-029 (eligible corpus) remains a **draft, not decided**. TT-01 and TT-12 do not block the dark NEM-019 control plane but must be resolved before their dependent commercial or content-release phases.

**Corrected (T0):** the earlier statement that purchased tokens expire after 90 days was not adopted. **Updated 2026-11-08:** neither is PO-024; **TT-01 is OPEN**. Current behaviour (90 days in code and Terms) is unchanged; PO-024's six-month proposal is neither implemented nor approved.

---

## Part B — Open decisions

**Priority:** **DECIDED** / **RESOLVED** settled by the PO on 2026-11-08 · **OPEN** a T0 preliminary ruling exists but was not adopted · **Ruled** received a T0 preliminary ruling · **P1** blocks that phase's build · **P2** can wait. **No open item below blocks NEM-019.**

### Product definition

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-01** | **OPEN** (P1 before token and commercial phases) | Purchased-token expiry conflict | Code, Terms, and copy say 90 days; PO-024 says otherwise | — | Commercial invariant | T0 preliminary ruling (preserve PO-024; no universal 90-day rule) **not adopted as a decision**. Remediation analysis: [report](../../reports/2026-11-06-SA-002-T0-decision-closure.md). Not a prerequisite for dark NEM-019 |
| **TT-02** | **DECIDED 2026-11-08** | Premium prerequisite | — | — | — | Active Individual, Duo, or Family subscription; add-on ([PO-026](../../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md)). Linked members and states stay open (TT-15) |
| **TT-03** | P1 | **What does "Noetia" include, and how is the prerequisite worded without "Basic"?** Also, should the author hosting label "Básico" change? | Prevents "Basic" returning through copy | (a) "Noetia" = platform, including free accounts and plans; prerequisite named as "an Individual, Duo or Family plan". (b) A new name for the paid base | Copy, legal text, i18n | **(a)**. Author label: separate cleanup, no urgency |
| **TT-04** | **DECIDED 2026-11-08** | Limit semantics | — | — | — | 3 and 10; every selected book counts, including public domain; verified public-domain editions selectable without the library; lock at first turn; new or forked session; server-side; eligibility independent of ownership ([PO-027](../../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md)) |
| **TT-05** | **DECIDED 2026-11-08** | My Knowledge and highlights | — | — | — | Full-book research bound to selected books; Ask My Highlights **searches and answers** over own highlights library-wide, with its own usage controls ([PO-028](../../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md)). This matches option (b) of the original table; the PO confirmed the rule text governs |
| **TT-06** | P2 | Monthly session count, beyond budgets? | Visible limits versus simplicity | None / hidden / visible | Budget already bounds cost | **None** at first |
| **TT-07** | P1 | **What is NoetiaX's depth?** Which of DX-1…DX-8, and which benchmark criteria prove it? | `PO` requires qualitative depth, and it defines the value of the tier | Any subset | Build cost, run cost | **DX-1, 2, 4, 7**, with the same-books benchmark as acceptance |
| **TT-08** | P1 | **How deep is Noetia+ on agreements and contradictions?** | ADR-001 classes this as advanced; it is in every Brief | (a) Standard class only, passage-level, labelled accordingly. (b) Capped advanced use. (c) Advanced by default | (c) likely breaks the ~$1.50 guideline | **(a) or (b), by evaluation** |
| **TT-18** | P1 | **Expand at launch** | ADR-003 allows future web research | (a) Model knowledge only. (b) With web | (b) adds cost, sources, and rights surface | **(a)** |
| **TT-19** | P2 | **Other NEM-003 capabilities by tier; name of "Noetia Brain"; mode names** | Scope and copy | Per item | Roadmap | Keep unassigned until the research path is proven |

### Economics and billing

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-09** | P1 | **COGS targets per tier.** Does ~$1.50 apply to Noetia+ only? What for NoetiaX? Band denominator (Q-E11)? Causas and Marketing on premium (W-3, B-6)? Creator share of premium revenue? | Sets budget bounds; the ToS promises Causas on "every payment" | Per item | Budgets and prices depend on them | Apply bands **per tier**; set NoetiaX target after measurement. No default on Causas or creator share |
| **TT-10** | P1 | **What do customers see?** | NEM-003 D10 suggested named units; the assignment says internal budgets | (a) Plain "monthly capacity" indicator. (b) Named units. (c) Hidden until near the limit | Transparency versus flexibility; possibly consumer-law relevance | **(a)**; never tokens or dollars |
| **TT-11** | P1 | **Reset date, and what happens at the limit** | Experience; revenue | Upgrade prompt, wait, read-only; add-on credits (D12) | Add-ons need a separate ledger, never book tokens | **Billing-anchored reset; read-only plus upgrade prompt; no add-ons at launch** |
| **TT-15** | P1 (**partly decided**) | **Household and subscription state.** ~~Do Duo and Family qualify?~~ **Yes, as subscription types (PO-026).** Still open: do **linked members** (not the subscriber) qualify? Per-member budgets? Which states count (`trialing`, `canceling`, `past_due`)? (D8, Q-E7) | Eligibility, privacy, cost | Per item | Resolver rules | **Per member; own entitlement required; data never shared** (data sharing now decided: none automatic, PO-026 rule 6). SA-003 Rev 5's working baseline (members eligible; 72-hour grace) is a recommendation, not a decision |
| **TT-16** | P1 | **Prices and billing.** Prices (D1, Q-E13); one Subscription or two (Q-E14); annual; trial; tier swap and proration; refunds; cross-line coupons (Q-E12) | Not authorized here | See [04 §3](04-entitlements-and-budgets.md#3-compatibility-verification) | Billing mission | One Subscription with line items under TT-02(a). **No price proposed** |

### Rights, legal, and retention

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-12** | **OPEN** (P1 before content release) | Verified AI-eligible launch corpus and rights | Default deny leaves no eligible book today | — | Content release | T0 preliminary ruling (verified public domain first, then explicit opt-in; default deny; draft [PO-029](../../operating-framework/decisions/product-owner/PO-029-eligible-research-corpus.md)) **not adopted as a decision**. Evidence standard is TT-26. Not a prerequisite for dark NEM-019, which seeds no real rights record |
| **TT-13** | P1 | **Quotation and reconstruction thresholds** (D4), including Briefs | Legal exposure; thresholds are not safe harbours | Configurable per book, turn, session, and Brief | Engineering enforces what is set | Conservative placeholder; Product/Legal to set |
| **TT-14** | P1 | **Retention** after cancel or downgrade (D5), export rights, and Brief treatment after rights revocation | Ownership philosophy versus rights | Read-only retain; delete; export window | Storage, privacy | **Retain read-only with export; delete on account deletion; revocation removes quoted text but keeps the user's own work.** Legal review |
| **TT-17** | P2 | **Brief export format(s) and sharing** | [03 §6](03-research-architecture.md#6-research-brief) | In-app, Markdown, PDF, DOCX, link | Effort, rights | **None selected, per the assignment** |
| **TT-20** | P2 | **Mobile**: parity timing; how premium is sold in apps; store commission | PR #18 calls store billing the largest unmodelled risk | Web-only purchase; store billing | Economics; policy review | Web first, then decide after policy review |
| **TT-22** | P1 | **Terms and Privacy updates** for AI processing, provider disclosure, opt-outs, tier terms | Legal surfaces are silent on AI | — | Required before any real user data reaches a provider | Update before the closed beta, under the existing benchmark-and-approval process |

### Raised by T0

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-23** | P1 (T5) | May a no-charge pilot participant without a book plan use a grant? | PO-026 has no pilot exception, and grants do not bypass it | (a) Participants hold a qualifying plan. (b) An explicit, time-boxed pilot exception | (a) Needs real plans before the pilot. (b) Needs its own decision | Decide before T5 |
| **TT-24** | **RESOLVED 2026-11-08** | Is generation over highlights alone permitted outside a session? | — | — | — | **Yes**: PO-028 rule 2 permits search **and answers** over own highlights library-wide. Whether book permissions apply is split out as TT-27 |
| **TT-25** | P2 | Semantic highlight search? Which tier has highlight search? | Semantic search sends notes and quotations to a provider | Lexical only; semantic gated by title rights and privacy disclosure | Privacy, rights | Lexical first; tier undecided |
| **TT-26** | P1 (T2) | Legal evidence standard, named verifier, and jurisdictions for rights verification | Public-domain status varies by country; markets span the Americas and Spain | Per [07](07-rights-verification-requirements.md) | Blocks evaluation corpus sign-off | Legal review |

### Raised by the 2026-11-08 approvals

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-27** | P1 (before Ask My Highlights) | How do **book AI permissions** apply when saved-quotation text (`fragments.text`) is sent to a model in Ask My Highlights, for books not selected in any session or with restrictive AI rights? | PO-028 rule 2 permits answers library-wide; rule 5 forbids an indirect route to full-book retrieval; a saved quotation is client-supplied and may be genuine publisher text | (a) Apply each book's AI permissions to its saved quotations, excluding restricted books. (b) Treat all saved quotations as user content. (c) Notes only for restricted books | (b) weakens rule 5 and publisher controls | **(a)** — recommendation only; Product/Legal decision |

### Governance

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-21** | **DECIDED 2026-11-08** | Governance | — | — | — | NEM-003 historical; **NEM-006 formally superseded**, record preserved; ADR-005 and ADR-006 prepared (Proposed); register updated; NEM-019 reconciled, **not approved or executed** ([PO-030](../../operating-framework/decisions/product-owner/PO-030-three-tier-architecture-governance.md); [08](08-architecture-governance-record.md)) |

---

### Architecture follow-ups from the ADR-005/006 review (2026-11-08)

Source: [architecture review](../../reports/2026-11-08-SA-002-T0-ADR-005-006-architecture-review.md) §7.2 (PR #41). The PO accepted blockers B-1…B-5, now incorporated in ADR-005/006 revision 3 and NEM-019 revision 4. The items below are **Product Architecture requirements for later phases, not Product Owner decisions**. Where one depends on an open decision, that decision stays open.

| ID | Follow-up | Gate (phase) | Depends on open decision |
|---|---|---|---|
| **F-1** | Ask My Highlights copyright controls: bound on highlight context per request; output reconstruction checks (ADR-002) on every highlight answer; per-book permission handling; no highlight generation for books whose rights forbid AI processing until TT-27 is decided. `fragments.text` has no length limit | Ask My Highlights phase | **TT-27**, TT-13 |
| **F-2** | Cross-session reconstruction: cumulative per-(user, book) accounting of quoted and reproduced spans, without content, checked before output | T5 | TT-13 |
| **F-3** | Brief immutability versus rights revocation: immutable record with render-time redaction and a disclosed tombstone | T6 | TT-14 |
| **F-4** | Qualifying-plan adapter: Individual, Duo, Family (PO-026) plus decided TT-15 rules; reconcile with SA-003 household baseline and ADR-007 draft (C1–C8) | Adapter mission / T8 | TT-15, TT-16 |
| **F-5** | Ownership adapter: a `user_books` row is not proof of ownership (`library.service.ts:18`, default `'free'`) | T5 | NEM-013 |
| **F-6** | "Dark" covers routes, not schema: CD runs every migration on each push to `main`, so merging NEM-019's code creates its tables in production; needs its own deployment authorization, snapshot, and GOV-001 §5.4 checks | Any merge of NEM-019 output | — |
| **F-7** | Shared Redis capacity (256 MB, `noeviction`, shared with authentication): key namespace, expiry, memory budget, monitoring; a separate Redis would need infrastructure authorization | T4/T5 | — |
| **F-8** | Policy-version change during a session: record policy version at lock; a lowered limit is treated like a downgrade | First production policy change | — |
| **F-9** | AI conversation and highlight-answer content never enters events, persona pipeline, author analytics, or admin views without a separate policy | T5 | — |
| **F-10** | CI on `main` has no PostgreSQL; NEM-019 concurrency and deletion proofs run on a disposable local database, so its completion report includes raw test output | NEM-019 review | — |
| **F-11** | SA-003 conflicts C1–C14 against ADR-005, PO-026, NEM-019, `04`, `05`, `06` (PR #36) | Before the three-tier stack merges | TT-15, Q4 roadmap |

**Also open from B-2 (PO / Product Architecture):** whether anonymized cost records are retained after account deletion. NEM-019 is safe either way.

## Decisions needed for the draft mission

**No open product decision blocks NEM-019** (updated 2026-11-08). PO-026, PO-027, PO-028, and PO-030 are decided. ADR-005 and ADR-006 revision 3 are **accepted** (2026-11-08). PO-025 is decided and the identifier `NEM-019` is reserved (2026-11-08). **NEM-019 revision 4 was APPROVED by the PO on 2026-11-08, executed on PO instruction 2026-11-09, and its implementation ACCEPTED by the PO on 2026-11-09 (Draft PR #46, including B-6 and F-12).** Acceptance is not merge, deployment, or production authorization; F-6 still applies to any merge. Every decision listed open above **remains open**. TT-01 and TT-12 are explicitly **not** prerequisites for the dark control plane. Every open item above is held safe by a default-deny port, an out-of-scope exclusion, or a test fixture ([NEM-019 §16](../../engineering-missions/COMPLETED/NEM-019-tier-aware-intelligence-control-plane.md)).
