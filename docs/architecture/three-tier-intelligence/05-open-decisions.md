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
| Noetia+ requires an active book plan; cancelling Noetia+ does not cancel it; ending it ends Noetia+ | PO direction 2026-10-30 | Direction approved; records **not** amended (PR #18). See TT-02 |
| Final premium prices are **not** authorized | Assignment | — |

### T0 preliminary rulings (2026-11-06)

Drafted as PO-025…029 and amendment drafts. **These are not authoritative records until the Product Owner accepts the text.** Summaries are in Part B.

**Corrected:** the earlier statement that purchased tokens expire after 90 days does not stand. PO-024 governs (TT-01).

---

## Part B — Open decisions

**Priority:** **Ruled** received a T0 preliminary ruling · **P1** blocks that phase's build · **P2** can wait. **No open item below blocks NEM-019.**

### Product definition

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-01** | **Ruled** | Purchased-token expiry | — | — | — | **Preliminary ruling: preserve PO-024; no universal 90-day rule.** Remediation: [report](../../reports/2026-11-06-SA-002-T0-decision-closure.md) |
| **TT-02** | **Ruled** | Premium prerequisite | — | — | — | **Preliminary ruling: both tiers require a qualifying book subscription; no standalone tier** ([PO-026](../../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md)). Household and states stay open (TT-15) |
| **TT-03** | P1 | **What does "Noetia" include, and how is the prerequisite worded without "Basic"?** Also, should the author hosting label "Básico" change? | Prevents "Basic" returning through copy | (a) "Noetia" = platform, including free accounts and plans; prerequisite named as "an Individual, Duo or Family plan". (b) A new name for the paid base | Copy, legal text, i18n | **(a)**. Author label: separate cleanup, no urgency |
| **TT-04** | **Ruled** | Limit semantics | — | — | — | **Preliminary ruling: 3 and 10; lock at the first analysis turn; change by new or forked session** ([PO-027](../../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md)) |
| **TT-05** | **Ruled** | My Knowledge and highlights | — | — | — | **Preliminary ruling: analysis bound to selected books; separate search over own highlights** ([PO-028](../../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md)). Earlier option (b) not adopted (TT-24) |
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
| **TT-15** | P1 | **Household and subscription state.** Do Duo and Family qualify? Linked members? Per-member budgets? `trialing`, `canceling`, `past_due`? (D8, Q-E7) | Eligibility, privacy, cost | Per item | Resolver rules | **Per member; own entitlement required; data never shared** |
| **TT-16** | P1 | **Prices and billing.** Prices (D1, Q-E13); one Subscription or two (Q-E14); annual; trial; tier swap and proration; refunds; cross-line coupons (Q-E12) | Not authorized here | See [04 §3](04-entitlements-and-budgets.md#3-compatibility-verification) | Billing mission | One Subscription with line items under TT-02(a). **No price proposed** |

### Rights, legal, and retention

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-12** | **Ruled** | Launch corpus | — | — | — | **Preliminary ruling: verified public domain first, then explicit opt-in; default deny** ([PO-029](../../operating-framework/decisions/product-owner/PO-029-eligible-research-corpus.md)). Evidence standard is TT-26 |
| **TT-13** | P1 | **Quotation and reconstruction thresholds** (D4), including Briefs | Legal exposure; thresholds are not safe harbours | Configurable per book, turn, session, and Brief | Engineering enforces what is set | Conservative placeholder; Product/Legal to set |
| **TT-14** | P1 | **Retention** after cancel or downgrade (D5), export rights, and Brief treatment after rights revocation | Ownership philosophy versus rights | Read-only retain; delete; export window | Storage, privacy | **Retain read-only with export; delete on account deletion; revocation removes quoted text but keeps the user's own work.** Legal review |
| **TT-17** | P2 | **Brief export format(s) and sharing** | [03 §6](03-research-architecture.md#6-research-brief) | In-app, Markdown, PDF, DOCX, link | Effort, rights | **None selected, per the assignment** |
| **TT-20** | P2 | **Mobile**: parity timing; how premium is sold in apps; store commission | PR #18 calls store billing the largest unmodelled risk | Web-only purchase; store billing | Economics; policy review | Web first, then decide after policy review |
| **TT-22** | P1 | **Terms and Privacy updates** for AI processing, provider disclosure, opt-outs, tier terms | Legal surfaces are silent on AI | — | Required before any real user data reaches a provider | Update before the closed beta, under the existing benchmark-and-approval process |

### Raised by T0

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-23** | P1 (T5) | May a no-charge pilot participant without a book plan use a grant? | PO-026 has no pilot exception, and grants do not bypass it | (a) Participants hold a qualifying plan. (b) An explicit, time-boxed pilot exception | (a) Needs real plans before the pilot. (b) Needs its own decision | Decide before T5 |
| **TT-24** | P1 (T5) | Is generation over highlights alone permitted outside a session? | PO-028 permits *search*. NEM-003's Ask My Highlights generates | (a) No. (b) Yes, under book permissions | (b) sends saved quotations to providers across any number of books | **(a)**: current reading of the ruling; confirm |
| **TT-25** | P2 | Semantic highlight search? Which tier has highlight search? | Semantic search sends notes and quotations to a provider | Lexical only; semantic gated by title rights and privacy disclosure | Privacy, rights | Lexical first; tier undecided |
| **TT-26** | P1 (T2) | Legal evidence standard, named verifier, and jurisdictions for rights verification | Public-domain status varies by country; markets span the Americas and Spain | Per [07](07-rights-verification-requirements.md) | Blocks evaluation corpus sign-off | Legal review |

### Governance

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-21** | **Ruled** | Governance | — | — | — | **Preliminary ruling: draft new PO records and ADR-005/006; NEM-003 unchanged; amendments prepared for review.** NEM-006 was not addressed, so it **stays PAUSED**. The earlier recommendation to cancel it is withdrawn pending a PO decision |

---

## Decisions needed for the draft mission

**No open product decision blocks NEM-019.** It needs acceptance of the drafted PO-025…029 and amendments, and of ADR-005/006. Every open item above is held safe by a default-deny port, an out-of-scope exclusion, or a test fixture ([NEM-019 §16](../../engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md)).
