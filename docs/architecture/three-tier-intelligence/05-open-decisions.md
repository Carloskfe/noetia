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

**Stated by this assignment but in conflict:** "Purchased book tokens expire after 90 days" versus PO-024 rule 9 → TT-01.

---

## Part B — Open decisions

**Priority:** **P0** blocks the draft mission or a commercial invariant · **P1** blocks that phase's build · **P2** can wait.

### Product definition

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-01** | P0 | **Purchased-token expiry: 90 days for all, or PO-024?** | PO-024 rule 9 says six calendar months for 3/5/10 packages; the 2026-11-06 invariant says 90 days. Money and customer promises | (a) 11-06 supersedes rule 9: 90 days for all purchased tokens. (b) PO-024 stands; "90 days" was shorthand | (a) Matches code, ToS, and copy; PR #17 and M-3 need amending; rules 8 and 11 unaffected. (b) Code, ToS, and copy must change | **None. PO ruling required.** Tier architecture works either way |
| **TT-02** | P0 | **Eligibility: does the 10-30 dependency stand, and does it cover NoetiaX?** | Determines who can buy, billing structure, and addressable market | (a) Both tiers require an active book plan. (b) Noetia+ add-on; NoetiaX standalone or includes tokens. (c) Both standalone (original PO-022) | (a) Simple, consistent. (b) Mixed resolver and token rules. (c) Reverses the 10-30 direction | **(a)**, preserving the approved direction. The resolver supports all three |
| **TT-03** | P1 | **What does "Noetia" include, and how is the prerequisite worded without "Basic"?** Also, should the author hosting label "Básico" change? | Prevents "Basic" returning through copy | (a) "Noetia" = platform, including free accounts and plans; prerequisite named as "an Individual, Duo or Family plan". (b) A new name for the paid base | Copy, legal text, i18n | **(a)**. Author label: separate cleanup, no urgency |
| **TT-04** | P0 | **Limit semantics.** Are books locked after the first turn? Do free-library books count? Do verified public-domain books need adding to the library first? | Defines what "3" and "10" mean | Lock versus editable; count all versus paid only | Editable sets make the limit meaningless | **Lock at the first analysis turn, changes by fork; every full-text book counts; verified public-domain books need no acquisition** |
| **TT-05** | P0 | **My Knowledge and Ask My Highlights versus the limit** | ADR-003 describes the whole library; limits cap analysis | (a) Analysis bound to selected books; library-wide retrieval without generation stays for discovery; highlights on selected books only. (b) (a) plus Ask My Highlights over the user's own highlight text, outside the limit. (c) Library-wide analysis outside limits | (c) removes the tier boundary and cost control | **(b)** |
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
| **TT-12** | P0 | **What can be analysed at launch?** Who verifies editions and translations? Licensed default matrix, especially cross-book comparison (D6)? | With no rights data, default-deny leaves **no eligible books** (C-6) | Verified public domain first; author opt-in campaign; contract update | Determines whether beta is meaningful | **Verify only a small public-domain set for evaluation and beta (the free library is not the business, so verification effort stays minimal); make author opt-in the path to the real corpus.** Legal review |
| **TT-13** | P1 | **Quotation and reconstruction thresholds** (D4), including Briefs | Legal exposure; thresholds are not safe harbours | Configurable per book, turn, session, and Brief | Engineering enforces what is set | Conservative placeholder; Product/Legal to set |
| **TT-14** | P1 | **Retention** after cancel or downgrade (D5), export rights, and Brief treatment after rights revocation | Ownership philosophy versus rights | Read-only retain; delete; export window | Storage, privacy | **Retain read-only with export; delete on account deletion; revocation removes quoted text but keeps the user's own work.** Legal review |
| **TT-17** | P2 | **Brief export format(s) and sharing** | [03 §6](03-research-architecture.md#6-research-brief) | In-app, Markdown, PDF, DOCX, link | Effort, rights | **None selected, per the assignment** |
| **TT-20** | P2 | **Mobile**: parity timing; how premium is sold in apps; store commission | PR #18 calls store billing the largest unmodelled risk | Web-only purchase; store billing | Economics; policy review | Web first, then decide after policy review |
| **TT-22** | P1 | **Terms and Privacy updates** for AI processing, provider disclosure, opt-outs, tier terms | Legal surfaces are silent on AI | — | Required before any real user data reaches a provider | Update before the closed beta, under the existing benchmark-and-approval process |

### Governance

| ID | Pri | Question | Why it matters | Options | Consequence | Recommended default |
|---|---|---|---|---|---|---|
| **TT-21** | P0 | **How is this adopted?** Relationship to paused NEM-006; ADR form for X-1…X-8; mission and assignment IDs (`SA-002`, `NEM-019` are provisional); merging PO-005…PO-024 | Source-of-truth hierarchy | Add to `PRODUCT-DECISIONS.md` as PO-025+; new ADR-005 (tier entitlements and budgets), ADR-006 (research sessions and Briefs); NEM-006 stays paused or cancelled | Clean authority chain | **Record as PO-025+ and two new ADRs; NEM-006 cancelled or superseded by explicit decision; NEM-003 untouched** |

---

## Decisions needed for the draft mission

**NEM-019 needs only:** TT-04, TT-05, TT-21, plus a TT-02 confirmation that the resolver's prerequisite step exists as a configurable rule. TT-01 and TT-12 do not block NEM-019, but TT-01 is a commercial invariant conflict that should be closed regardless.
