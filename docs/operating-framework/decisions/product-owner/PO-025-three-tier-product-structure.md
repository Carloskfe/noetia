# PO-025 — Three-Tier Product Structure

**Status:** `DECIDED` — approved by the Product Owner on **2026-11-08** (*PO-025 Reconciliation and NEM-019 Governance Closure*), after correction of its token-expiration wording and a contradiction check against accepted ADR-005/006 and decided PO-026, PO-027, PO-028, PO-030. Supersedes the 2026-11-06 draft, preserved below.
**Domain:** Product, Business · **Authority:** Product Owner
**Date:** 2026-11-08 (draft 2026-11-06) · **Source:** Product Owner scope update of 2026-11-06, as corrected on 2026-11-08
**Implementation:** `NOT IMPLEMENTED` — no intelligence code exists on any branch

---

## Decision (approved text, 2026-11-08)

1. The customer-facing structure is **Noetia**, **Noetia+**, and **NoetiaX**.
2. **Noetia** is the multimodal reading and social platform.
3. **Noetia+** is interactive, source-aware research.
4. **NoetiaX** is **qualitatively deeper** research, **not simply a larger book limit**. Its capabilities require specification and separate approval (TT-07).
5. Both premium tiers offer **interactive conversations** and **session-derived Research Briefs**. A Brief comes from a session and does not replace the conversation (ADR-006).
6. Premium requires a qualifying book subscription under **[PO-026](PO-026-premium-subscription-prerequisite.md)**.
7. Acquired books remain **permanently owned**.
8. **Book tokens and AI resource budgets remain separate.**
9. The customer-facing label **"Basic" is not used** (PO scope update, 2026-11-06).

## Not decided by this record

| Item | Status |
|---|---|
| **Token expiration — TT-01** | **OPEN.** See below |
| Premium prices | Not decided (TT-16). Planning figures elsewhere (SA-003, PR #36) are not decided prices |
| Quantitative AI budgets, reset policy | Not decided (TT-09, TT-11). The scope update calls for separate monthly internal budgets and fair-use controls; values and reset timing are open |
| Additional token entitlements for premium tiers | **None decided.** Whether a premium tier includes tokens of its own is open (TT-16) |
| NoetiaX depth; Noetia+ contradiction depth | TT-07, TT-08 |
| Tier placement of other NEM-003 capabilities | TT-19 |

### Token expiration — TT-01 remains OPEN

- **This record does not decide token expiration.**
- **PO-024** (PR #17, unmerged) proposes differentiated rules, including **six calendar months** for 3-, 5-, and 10-token packages. That policy is **neither implemented nor finally approved**, and the T0 preliminary ruling that would have preserved it was not adopted.
- **Current production behaviour is unchanged by this record** [CODE, `main` `6a5e5c0`]: paid tokens expire **90 days** after issuance (`services/api/src/subscriptions/subscriptions.service.ts:27,71`), and the Terms of Service state 90 days (`services/web/lib/legal/terms-of-service.ts:31,128`).
- The 2026-11-06 scope-update sentence "purchased tokens expire after 90 days" is not carried into this record as a decision either.

## Existing commercial facts referenced (not decided here)

| Fact | Source |
|---|---|
| Token package prices $9.99 / $24.99 / $39.99 / $74.99, unchanged for premium tiers | PO scope update, 2026-11-06; verified on the public endpoint (three-tier `05` Part A) |
| Both premium tiers may buy additional tokens at those prices; this grants **no** additional token entitlement | Same |

## Related records

Prerequisite: [PO-026](PO-026-premium-subscription-prerequisite.md) · Limits: [PO-027](PO-027-research-session-book-limits.md) · Highlights: [PO-028](PO-028-my-knowledge-and-highlight-boundary.md) · Governance: [PO-030](PO-030-three-tier-architecture-governance.md) · Corpus: [PO-029](PO-029-eligible-research-corpus.md) (draft) · ADR-005, ADR-006 (accepted) · PO-001…004 · ADR-001…004.

## Implementation boundary

Authorizes no implementation, Stripe product, price, migration, or deployment.

---

## Historical: draft text of 2026-11-06 (superseded, preserved unchanged)

**Status:** `DRAFT — NOT DECIDED`. Records the Product Owner scope update of 2026-11-06 as modified by preliminary ruling TT-01. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** Product, Business · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** Product Owner scope update; T0 ruling TT-01
**Implementation:** `NOT IMPLEMENTED` — no intelligence code exists on any branch

---

### Decision (proposed text)

1. The customer-facing structure is **Noetia**, **Noetia+**, and **NoetiaX**.
2. **Noetia** is the existing multimodal reading and social-sharing platform.
3. **Noetia+** is source-aware, interactive AI intelligence and research.
4. **NoetiaX** is advanced source-aware intelligence, with deeper cross-book reasoning and research. It must be **qualitatively deeper**, not merely a larger book limit. Its precise capabilities require specification and separate approval.
5. Both premium tiers support interactive in-app conversation and Research Brief export. A Research Brief is an artifact of a session and does not replace the interactive experience.
6. The customer-facing label **"Basic" is not used.**

### Commercial invariants (proposed text)

| # | Invariant |
|---|---|
| 1 | Token package prices remain $9.99 / $24.99 / $39.99 / $74.99 |
| 2 | Token expiration follows **[PO-024](PO-024-token-expiration-cancellation-gifting.md)**. There is no universal 90-day rule |
| 3 | Acquired books remain permanently owned |
| 4 | Both premium tiers may purchase additional tokens at unchanged prices |
| 5 | Book tokens never increase AI usage allowances |
| 6 | AI consumption uses separate monthly internal resource budgets and fair-use controls |
| 7 | Premium subscription prices are **not** set by this record |

**Correction recorded.** The 2026-11-06 scope update stated that purchased tokens expire after 90 days. Ruling TT-01 preserves PO-024 instead, so that sentence is **not** carried into this record.

### Related records

Prerequisite: [PO-026](PO-026-premium-subscription-prerequisite.md) · Limits: [PO-027](PO-027-research-session-book-limits.md) · Highlights: [PO-028](PO-028-my-knowledge-and-highlight-boundary.md) · Corpus: [PO-029](PO-029-eligible-research-corpus.md) · PO-001…004 · ADR-001…004.

### Pending — not decided here

Prices · budget values · NoetiaX depth capabilities (TT-07) · Noetia+ contradiction depth (TT-08) · whether a premium tier includes tokens of its own (TT-16) · tier placement of other NEM-003 capabilities (TT-19).

### Implementation boundary

Authorizes no implementation, Stripe product, migration, or deployment.
