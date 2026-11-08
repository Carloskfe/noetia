# T0 Amendment Drafts — PO-021 through PO-024

**Status:** `DRAFT — AWAITING PRODUCT OWNER REVIEW`. Nothing here has been applied.
**Date:** 2026-11-06 · **Follows the pattern of:** PO-021 Amendment 1, and PR #18's amendment drafts.

> PO-021, PO-022, and PO-023 exist only on PR #12, and PO-024 only on PR #17. Those files are **not edited** by this document. On approval, each amendment is appended to its record. Nothing is overwritten or silently superseded.

---

## Summary

| Record | Action proposed | Why |
|---|---|---|
| **PO-021** | **No amendment** | TT-02 and TT-05 leave ownership-based access intact |
| <a name="po-022-amendment-1"></a>**PO-022** | **Amendment 1** | Independence replaced by the prerequisite, for both tiers |
| <a name="po-023-amendment-1"></a>**PO-023** | **Amendment 1** | Rules 6–8 and Consequences |
| **PO-024** | **Confirmation 1**; no rule changes | TT-01 preserves it; one conflicting line in its impact assessment corrected |

---

## PO-022 Amendment 1 — Premium tiers require a book plan (draft)

**Title change:** "Independent Noetia+ Subscription" → "Premium Subscription Tiers".

| Current text | Amended text |
|---|---|
| Noetia+ is a **separate, independently purchasable subscription** for premium platform services | Noetia+ and NoetiaX are **premium tiers** that require an **active qualifying Noetia book subscription** ([PO-026](../decisions/product-owner/PO-026-premium-subscription-prerequisite.md)) |
| is purchasable **independently** of the Individual, Duo, and Family book-token plans | is **not available as a standalone subscription** to a free account or a token-package-only customer |
| does **not** require a book-token subscription | *(deleted)* |
| has its **own subscription entitlement** | has its **own entitlement**, which ends according to a future approved lifecycle policy when the qualifying book plan ends |
| has its **own** billing lifecycle, pricing, and cancellation handling | has its **own pricing**. **Cancelling a premium tier does not cancel the book plan.** Billing structure and lifecycle are pending |

**Unchanged:** does not unlock paid books; not required to access acquired books; owned books, notes, highlights, bookmarks, and fragments survive any cancellation; the whole "Economic separation" section, including `BOOK TOKEN ≠ AI USAGE`.

**Still pending:** feature catalogue, AI limits, price, trial, household rules, Causas and Marketing on premium payments, plus: which plans qualify, linked-member eligibility, qualifying states, end timing, refunds.

## PO-023 Amendment 1 — Premium tiers leave the subscription-free path (draft)

| Rule | Current text | Amended text |
|---|---|---|
| 6 | Individual, Duo, Family, and Noetia+ subscriptions are **optional** | Individual, Duo, and Family subscriptions are **optional**. Noetia+ and NoetiaX are optional tiers available **only with an active qualifying book subscription** |
| 7 | Customers may subscribe to **Noetia+ without** a book-token plan | **Deleted.** Free accounts and token-package-only customers cannot purchase or maintain a premium tier |
| 8 | Customers may hold Noetia+ and a book-token subscription simultaneously, with **independent** entitlements and cancellation | A customer with a qualifying book subscription may add a premium tier. **Cancelling the premium tier does not cancel the book plan.** When the book plan ends, the premium entitlement ends per a future lifecycle policy |

**Consequences (replaces the first bullet):** a user can be in any combination of free account · book plan · book plan + one premium tier · owned books. A premium tier requires a book plan. Owned books never require anything.

**Unchanged:** rules 1–5. **Pending item resolved:** "whether the 90-day paid-token expiry applies to tokens bought by free accounts" was answered by PO-024 and is confirmed below.

## PO-024 Confirmation 1 — Token expiration preserved (draft)

**No rule changes.** Text to append:

> *Confirmed by Product Owner ruling TT-01 (2026-11-06).* PO-024's differentiated rules govern. The statement in the 2026-11-06 scope update that purchased tokens expire after 90 days does not amend this record. Premium tiers do not change any token rule.

**Correction to the [PO-024 impact assessment](../../architecture/impact-assessments/PO-024-token-expiry-cancellation-gifting.md) §6 (PR #17):**

| Current text | Proposed text |
|---|---|
| "a Noetia+-only customer may buy, hold, gift (packages) and redeem tokens like a free account (PO-023)" | "premium status changes no token right. Under PO-026 no premium-only customer exists; a former book-plan customer keeps issued tokens per rules 6–10" |

**Items PO-024 itself leaves open.** These are not resolved by TT-01. They block the token remediation missions, not NEM-019.

| Item | Question |
|---|---|
| **Effective date** | PO-024 carries a decision date (2026-10-30) but **no effective date** |
| Q-14 | Do tokens already issued at 90 days extend to six months? |
| Q-4 | Redemption order. Today's FIFO can spend a six-month token before a 90-day one |
| Q-12 | Definition of "six calendar months" and time zone |
| Q-2, Q-3 | Are gift-card tokens "gifted tokens"? Gift date; refresh abuse |
| Rule 1 | Names only Individual. Confirm rules 2–7 also cover Duo and Family subscription tokens |
| Q-13 | Promotional and courtesy tokens (30 days today): not addressed by PO-024 |

---

## Corrections to the PO-021–023 impact assessment (PR #12)

| Item | Current | Proposed note |
|---|---|---|
| Title | "Independent Noetia+" | "Superseded in part by PO-026" |
| C-08, §4 | Separate Subscription and row with `productLine = 'plus'` | The recommendation rested on independence. Structure is open (TT-16). `productLine` still applies. The value set must allow two tiers |
| C-09 | `PlusEntitlementGuard` scope | Still valid in substance; the resolver must also evaluate the prerequisite and cover both tiers |
| §3 "Independent Noetia+" column, Mobile | Noetia+ entry point | Applies to both tiers |
| §6 step 7 | Noetia+ billing "M-F" | Add NoetiaX and PO-026 |

## Relationship to PR #18's drafts

PR #18's direction (approved 2026-10-30) is preserved. If this document is accepted, it replaces PR #18's amendment *wording*.

| Point | PR #18 draft | This draft |
|---|---|---|
| Scope | Noetia+ | Noetia+ **and NoetiaX** |
| Name of the prerequisite | "basic subscription" | "qualifying book subscription"; "Basic" never customer-facing |
| Title | "Noetia+ Premium Add-on" | "Premium Subscription Tiers" (avoids deciding the billing form) |
| Entitlement end | "must also end" | Same, "according to a future approved lifecycle policy" (TT-02 wording) |
| Unit economics | $6.00, 10%: planning only | Unchanged, **planning only**; no NoetiaX figure exists |

## Proposed addition to `docs/noetia-plus/PRODUCT-DECISIONS.md`

> **Update 2026-11-08 (SA-002-T0 Rev 2).** PO-026, PO-027, PO-028, and the new PO-030 are **decided** and are entered in `PRODUCT-DECISIONS.md` in a "Three-tier decisions" section, using the approved wording. The lines below are the **superseded T0 proposal**, kept as written; in particular PO-028 is no longer "search" only. PO-025 and PO-029 remain drafts. The PO-022/PO-023 Amendment 1 texts in this file still await acceptance.

Not applied here. PR #12 adds a "Later decisions" section to the same file; add these lines to it on adoption:

```markdown
- **PO-025** — Three-tier product structure (Noetia, Noetia+, NoetiaX).
- **PO-026** — Premium tiers require a qualifying book subscription; amends PO-022 and PO-023.
- **PO-027** — Research session limits: 3 and 10 selected books; lock at the first analysis turn.
- **PO-028** — Generated analysis limited to selected books; separate search over own highlights.
- **PO-029** — Research corpus: verified public domain first, then explicit opt-in; default deny.
```

## Proposed Decision Registry rows

For `docs/operating-framework/15-decision-registry.md` once it reaches `main`. Status changes to `DECIDED` only on acceptance.

> **Update 2026-11-08.** When applied: PO-026, PO-027, PO-028 → `DECIDED` (2026-11-08); add `| PO-030 | PO | Three-tier architecture governance | DECIDED | Governance | PO-030 | Documentation only |`; ADR-006 title adds "and Research Briefs". PO-025, PO-029 stay `DRAFT`.

```
| PO-025 | PO | Three-tier product structure | DRAFT | Product, Business | PO-025 | NOT IMPLEMENTED |
| PO-026 | PO | Premium subscription prerequisite | DRAFT | Business, Billing | PO-026 | NOT IMPLEMENTED |
| PO-027 | PO | Research session book limits | DRAFT | Product, AI | PO-027 | NOT IMPLEMENTED |
| PO-028 | PO | My Knowledge and highlight boundary | DRAFT | AI, Rights, Privacy | PO-028 | NOT IMPLEMENTED |
| PO-029 | PO | Eligible research corpus | DRAFT | Rights, AI | PO-029 | NOT IMPLEMENTED · LEGAL REVIEW REQUIRED |
| ADR-005 | ADR | Tier entitlements, prerequisites, budget boundaries | PROPOSED | Architecture | ADR-005 | NOT IMPLEMENTED |
| ADR-006 | ADR | Research sessions, limits, source-scope isolation | PROPOSED | Architecture | ADR-006 | NOT IMPLEMENTED |
```

## Adoption order

1. PO accepts the texts here and PO-025…029; statuses change.
2. Product Architecture accepts ADR-005 and ADR-006.
3. Records reach `main` together with PO-005…024. **Every push to `main` deploys production, including documentation**, so this should be one grouped, separately approved merge.

**A mission may cite a decision before merge,** as has been done with PO-021…024, provided the decision is accepted and its branch is named.
