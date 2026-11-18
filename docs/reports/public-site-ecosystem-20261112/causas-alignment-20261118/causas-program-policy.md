# Causas Noetia — Program Policy (PO decisions of 2026-11-18)

**Status:** `DECIDED` by the Product Owner on 2026-11-18 (*NOETIA — PR #59 Causas and Premium Public-Language Alignment*). Recorded here for independent Product Architecture review.
**Recorded by:** Claude Code, on PR #59's branch `feat/public-ecosystem-site-20261112`. Documentation of decided policy only.
**Identifier:** none allocated. The PO governance tree (`docs/operating-framework/decisions/product-owner/`, where PO-053 lives) is not on this branch or on `main`, so numbering is left to PA rather than guessed.
**Relationship to PO-053:** extends it. PO-053 rules 2–6 (one cause, 100% to the chosen cause, equal split across all three when none is chosen, no other options, deterministic) are **kept unchanged**. This record replaces PO-053's base ("2.22% of each qualifying payment") and its approved public wording ("We commit 2.22% of every payment…"), and resolves PO-053 open points OP-1 (in part) and OP-4 (in part).

## 1. Decided rules

| # | Rule |
|---|---|
| C-1 | Noetia allocates **2.22% of eligible payment receipts after payment-processing fees** ("eligible net receipts"). |
| C-2 | Allocations are **calculated and settled monthly**. |
| C-3 | Payments **refunded before the monthly settlement are excluded**. |
| C-4 | For refunds **after** settlement, Noetia **absorbs** the already-disbursed contribution cost. The disbursement is not reversed and the customer's refund is not reduced. |
| C-5 | Beneficiaries will be **independent third-party charitable organizations**, not causes operated by Noetia. |
| C-6 | **No partnership agreement has been signed.** No current partnership or completed donation may be stated or implied. |
| C-7 | PO-053 preserved: one chosen cause, or an equal split across all three when none is selected. |

## 2. Public-language rules

| # | Rule | Where applied |
|---|---|---|
| L-1 | Concise, future-oriented language ("planned", "we plan to", "will"). No present-tense "we commit / supports / donates". | Every Causas surface (see report §2) |
| L-2 | Disclose that the program is **planned**. | Status badge on `/` and `/causas`; text on every surface |
| L-3 | Disclose that the **2.22% is calculated on eligible net receipts after payment-processing fees**. | `/`, `/causas`, `/pricing`, CauseSelector, About, Milestones, Company footnote |
| L-4 | Disclose that **charitable partnerships are pending**. | `/`, `/causas` (disclosure box), `/pricing`, CauseSelector, About, Milestones, Company, account billing |
| L-5 | Keep calculation detail, monthly settlement and refund rules **off the homepage**. Put them in a **linked, clearly labelled draft** of program terms. | `/causas/terms` (draft banner, `noindex`), linked from `/causas`; homepage test forbids settlement/refund wording |
| L-6 | Never present the draft program terms as legally approved. | Banner "Draft for legal review — not in effect" in both languages; bracketed open points; report and mirror headers |

## 3. Noetia+ / NoetiaX (retained, unchanged)

The approved descriptions are kept verbatim and are now also checked in Spanish:
- Noetia+: up to **3** eligible books selected **per session**; NoetiaX: up to **10**;
- "Will require an active Noetia subscription." / "Requerirá una suscripción Noetia activa.";
- **Coming Soon / Próximamente** label, with no link, button, price or date;
- the disclaimer that the descriptions "may change" / "pueden cambiar".

## 4. Open points (not decided)

They appear as bracketed items in the draft terms. Engineering must not implement allocation logic until they are decided.

| # | Point | Note |
|---|---|---|
| OP-A | **Which payments are eligible:** subscriptions, token packs, gifts; trials; Duo/Family | Carries forward PO-053 OP-1 |
| OP-B | **Taxes:** whether collected sales tax/VAT is excluded from "net receipts" alongside processing fees | Accounting and legal |
| OP-C | **Chargebacks and disputes:** treat like refunds (C-3/C-4) or otherwise | Not covered by C-3/C-4 |
| OP-D | **Cut-off dates and settlement timing** within the monthly cycle | Needed before C-2 can be implemented |
| OP-E | **Effective date of a cause change:** next payment, next cycle, or next settlement | PO-053 is silent on this |
| OP-F | **Beneficiary withdrawal:** reallocation if an organization stops participating or loses charitable status | Affects C-7 |
| OP-G | **Reporting:** whether and how often program reports are published | Public copy makes no reporting promise |
| OP-H | **Changes and termination:** notice period and process | Counsel to draft |
| OP-I | **Revenue split on the Company page:** the published split (45 / 36 / 9 / 2.22 / 7.78) adds to 100%. Causas now uses a net-of-fees base; the other shares' base is not stated | Numbers unchanged; Causas is footnoted only. PO/PA to confirm whether the split is presented consistently |
| OP-J | **Legacy preference records** (PO-053 OP-2) | Unchanged; handled in PR #59 §8 |
| OP-K | **App-store commissions** (Apple/Google, 15–30%) on mobile purchases: are they "payment-processing fees" for C-1? | Large effect on the base; the draft terms say only "payment-processing fees" |

## 5. Not authorized by this record

- Any change to financial calculations, allocation, ledger, payout, Stripe or payment code (none was made).
- Any change to the Terms of Service (§3 still describes "2.22% of every payment… selected by Noetia"; see report §5, LQ-6).
- Naming beneficiaries, or creating agreements or donation records.
- Merging or deploying PR #59; touching PR #60 or PR #62.
