# Product Owner Question Register

**v0.1** · NOF-001 · Questions only the Product Owner can answer, prioritized so the
important ones are not buried among the tidy-ups.

- **P0** — blocks framework coherence; the framework cannot state a position without it
- **P1** — important before general availability or commercial use
- **P2** — can remain open for now

Answering a P0 typically resolves a CRITICAL or HIGH entry in the
[contradiction register](contradictions-and-gaps.md).

---

## P0 — All resolved

Questions are preserved, not deleted — they are decision history. Each now names the
decision that settled it.

### Q-01 · Which annual prices are correct? — **RESOLVED by [PO-006](../decisions/product-owner/PO-006-canonical-subscription-pricing.md)**
Canonical: $8.99 / $13.99 / $18.99 monthly · **$83.99 / $129.99 / $179.99 annual**. The
business plan's $89.99 / $139.99 / $189.99 are `SUPERSEDED BY PO-006`. Stripe
configuration remains unverified → IG-01.

<details><summary>Original question</summary>

→ C-01

The PRD says $83.99 / $129.99 / $179.99. The business plan says $89.99 / $139.99 /
$189.99. Monthly prices agree; only annual disagrees.

**Why it matters:** the Economic Framework cannot state Noetia's pricing without picking
one, and picking one is a business decision, not an editorial one. Whichever is wrong is
either live in Stripe today or about to be entered.

</details>

### Q-02 · How are creator obligations tracked until a payout engine exists? — **RESOLVED by [PO-008](../decisions/product-owner/PO-008-creator-obligation-accrual.md)**
The obligation is created **at redemption**; absence of a settlement engine does not defer
it. Lifecycle EARNED → PENDING → PAYABLE → PAID with ADJUSTED/REVERSED.
`ACCOUNTING REVIEW REQUIRED`. The engineering gap stays open → IG-02.

<details><summary>Original question</summary>

→ C-03

The 45/36/9/2.22/7.78 split is documented, but no payout or settlement code exists.
Revenue is being collected now.

**Why it matters:** this is the largest documented-vs-implemented gap in the project, and
it accrues. The framework must state either "obligations are tracked by X" or "obligations
are not yet tracked" — and the second sentence has consequences that deserve your explicit
acknowledgement rather than my inference. Likely needs accountant input.

</details>

### Q-03 · Does "45%" mean Noetia's share or the creator share? — **RESOLVED by [PO-007](../decisions/product-owner/PO-007-canonical-revenue-allocation.md)**
Both, and never interchangeably. Noetia 45%; creator 45% **only** when author/publisher
(36%) and narrator (9%) are combined, as in a self-narrated title. "45%" must never appear
without naming whose share it is.

<details><summary>Original question</summary>

→ C-04

Used both ways in the same document, including in author-facing marketing copy.

**Why it matters:** the Economic Framework and the Creator Framework will each state a
split. If the vocabulary is ambiguous, both inherit the ambiguity, and authors read one
of them.

</details>

### Q-04 · Should Engineering Missions be filed retroactively? — **RESOLVED by [PO-009](../decisions/product-owner/PO-009-engineering-mission-traceability.md)**
Yes, where reconstructable with reasonable confidence, marked
`HISTORICAL / PRE-GOVERNANCE BACKFILL` and
`RECONSTRUCTED SUMMARY` where the original prompt is not repository-resident. Future
missions are committed at approval time.

<details><summary>Original question</summary>

→ C-05

Every mission to date exists only as an instruction plus its commits.

**Why it matters:** the Decision Registry's mission tier currently cites commits instead
of approved missions. Either the missions get filed, or the framework must state that
mission authorization is not auditable after the fact.

</details>

---

## P1 — Important before GA or commercial use

### Q-05 · Family plan: 5 seats or 6?
→ C-02. A marketing claim and an enforcement rule that currently disagree.

### Q-06 · What are the intended promotional and courtesy token expiry windows?
→ C-06. 90 days is asserted in code for paid tokens; 30 days for promotional is inferred
from project notes and enforced only by whatever the caller passes.

### Q-07 · Is peer-to-peer token gifting committed, or an idea?
→ C-07. It appears in the business narrative but only gift cards are implemented.

### Q-08 · When does the free-library sunset actually trigger?
→ C-10. "6–12 months" with no start date, and "50+ author titles" with no owner watching
the count.

### Q-09 · Beyond "not a content publisher," what else is Noetia not trying to become?
`PRD.md` states one anti-goal clearly and calls it fundamental: **Noetia is not a content
publisher** — the catalog is built by authors, publishers, and companies. That is
recorded in the charter as DECIDED.

The charter asks a broader question that no source answers. Candidates visible in the
evidence but never stated as anti-goals: a general-purpose AI assistant, a social
network, a rental-only library, a DRM-free store.

**Why it matters:** anti-goals are the most durable part of a charter — they stop a
future contributor from cheerfully building the wrong thing. One anti-goal is a good
start; it is not a boundary.

---

## P2 — Can remain open

### Q-10 · Final customer-facing names for the three intelligence modes
Currently *This Book* / *My Knowledge* / *Expand*, explicitly marked as future UX in
PO-003.

### Q-11 · Final retail price for Noetia+
PO-001 states intent (~$5.99–$9.99, interest ~$7.99–$8.99) and explicitly does not set it.

### Q-12 · Quotation thresholds for AI features
PO-002 deliberately declines to claim a universal word count. Flagged
`LEGAL REVIEW REQUIRED` there, and it stays open here.

### Q-13 · Does the Latin America / US-Hispanic focus exclude other markets?
Strategic emphasis is well documented; whether it is a priority or a boundary is not
stated. NOF-001 §10 explicitly forbids assuming exclusion.

---

## Summary

| Priority | Open | Resolved |
|---|---|---|
| P0 | **0** | 4 (PO-006 … PO-009) |
| P1 | 5 | 0 |
| P2 | 4 | 0 |

No P0 question remains open. Resolving them moved the Economic, Creator, and Business
Model frameworks from `CONFLICTING` to `DECIDED` — though two **implementation gaps**
(IG-01 Stripe verification, IG-02 settlement engine) remain open and are tracked
separately, because a settled policy is not a shipped system.
