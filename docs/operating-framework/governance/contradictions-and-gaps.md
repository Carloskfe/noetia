# Contradictions & Gaps Register

**v0.1** · NOF-001 · Sources disagree, or no decision exists. **Nothing here has been
resolved** — resolution requires the authority named in each entry.

Severity: **CRITICAL** (money, rights, or user trust at stake) · **HIGH** (blocks
coherence or a near-term mission) · **MEDIUM** (should be settled before GA) ·
**LOW** (tidy-up).

---

## C-01 — Annual subscription prices disagree · CRITICAL · Product Owner + Finance

| Source | Individual | Duo | Family |
|---|---|---|---|
| [`docs/PRD.md:197-199`](../../PRD.md) | **$83.99** | **$129.99** | **$179.99** |
| [`docs/business/en/01-business-plan.md:166-168`](../../business/en/01-business-plan.md) | **$89.99** | **$139.99** | **$189.99** |

Two authoritative documents state different annual prices for every plan — a $6–$10
difference per plan per year. Monthly prices agree ($8.99 / $13.99 / $18.99), so this is
isolated to annual billing.

**Why it matters:** annual plans are configured as Stripe price IDs. Whichever number is
wrong is either already live and mispriced, or will be entered wrong at setup. This
cannot be resolved by reading code — the Spanish business plan carries the same figures
as the English one, so both agree with each other and disagree with the PRD.

**Needs:** a Product Owner ruling on the authoritative annual price, then a single
source of truth referenced by both documents.

---

## C-02 — Family plan seat count disagrees · HIGH · Product Owner

| Source | Seats |
|---|---|
| [`docs/PRD.md:199`](../../PRD.md) | up to **6 users** |
| [`docs/business/en/01-business-plan.md:168`](../../business/en/01-business-plan.md) | **5 users** |

**Why it matters:** the seat limit is an enforcement rule against `linkedUserIds`, and it
is a marketing claim. Shipping "up to 6" while enforcing 5 is a support and trust problem.

**Needs:** Product Owner ruling; then verify what the subscription service actually
enforces.

---

## C-03 — The economic split has no implementation · CRITICAL · Product Owner + Engineering + Accounting

The revenue split is documented — 45% Noetia · 36% author/publisher · 9% narrator ·
2.22% Causas Noetia · 7.78% marketing ([`01-business-plan.md:183-187`](../../business/en/01-business-plan.md)) —
but [`technical-baseline/09-token-economy.md:40`](../../technical-baseline/09-token-economy.md)
records that **no payout or settlement engine exists in the codebase**, and payout
computation is `UNKNOWN` at the code level.

**Why it matters:** Noetia is accruing obligations to authors and narrators with no
system computing them. The longer this runs, the harder the first reconciliation becomes.
This is the single largest gap between documented business model and implemented reality.

**Needs:** Product Owner + Engineering to scope a payouts mission; Accounting review of
how obligations are recognized in the interim. `ACCOUNTING REVIEW REQUIRED`.

---

## C-04 — "45% royalty" means two different things · HIGH · Product Owner

[`01-business-plan.md:429`](../../business/en/01-business-plan.md) markets "45% royalty —
highest in the category," while `:183` assigns **45% to Noetia operating revenue**. The
reconciliation appears at `:224-225`: a self-narrating author receives 36% + 9% = 45%.

So "45%" denotes Noetia's share in one place and the author-narrator combined share in
another. Both can be true, but the collision is a live misreading risk in a document
shown to authors.

**Needs:** Product Owner to fix the terminology; then a single labelled table in the
Economic Framework.

---

## C-05 — Engineering Missions are not filed in the repository · HIGH · Product Owner + Product Architecture

`docs/engineering-missions/{APPROVED,IN-PROGRESS,COMPLETED}/` contain only `.gitkeep`.
Every mission issued to date — NEM-002, NEM-003, NEM-005, NEM-006, NEM-006A, NEM-006C,
NOF-001 — exists as an instruction and as its resulting commits, never as a governance
artifact.

**Why it matters:** the governance model in
[`engineering-missions/README.md`](../../engineering-missions/README.md) treats an
approved mission as bounded authorization. If missions are not filed, that authorization
is unauditable after the fact, and the Decision Registry must cite implementation
(Level 6) where it should cite approved missions (Level 4).

**Needs:** Product Owner ruling on whether missions get filed retroactively, and a
standing rule that future missions are committed when approved.

---

## C-06 — Promotional token expiry is inferred, not confirmed · MEDIUM · Product Owner

`TOKEN_EXPIRY_DAYS = 90` is a code constant ([`09-token-economy.md:10`](../../technical-baseline/09-token-economy.md)).
Promotional tokens are described as 30 days, but the baseline marks this `INFERRED` — the
caller is presumed to pass a different `expiryDays`.

**Needs:** confirm the intended promotional and courtesy expiry windows, then assert them
in code rather than relying on call sites.

---

## C-07 — Peer-to-peer token gifting: documented, not implemented · MEDIUM · Product Owner

[`09-token-economy.md:42-43`](../../technical-baseline/09-token-economy.md) records that
gift *cards* (Stripe purchase, emailed claim token) are implemented, while peer-to-peer
gifting from an existing balance appears only in project notes.

**Needs:** confirm whether peer gifting is committed roadmap or an idea; classify as
PLANNED or drop it from the business narrative.

---

## C-08 — Staging cannot validate Escucha Activa · HIGH · Engineering *(in progress)*

Recorded as a known limitation at NEM-006A acceptance. NEM-006C was authorized to close
it and its tooling is committed, but the full-catalog run has not yet executed.

**Status:** actively being addressed. Listed so the framework does not present staging as
a complete pre-production mirror before that is true.

---

## C-09 — "Product Bible" terminology is superseded · LOW · Documentation

[`PRODUCT-DECISIONS.md:5`](../../noetia-plus/PRODUCT-DECISIONS.md) anticipates migration
into a "formal Product Bible." NOF-001 §2 retires that term in favour of Project Charter
and the Operating Framework.

**Needs:** no decision — a future documentation pass updates the forward reference.
Historical documents are not renamed.

---

## C-10 — Free-library sunset has no dated decision · MEDIUM · Product Owner

`CLAUDE.md` states new free-library titles stop after "6–12 months" and that the hero
placement is replaced once 50+ author titles exist. Neither the start date of that window
nor the trigger's owner is recorded anywhere.

**Why it matters:** it is a stated product commitment with no way to tell whether it has
come due.

**Needs:** Product Owner to convert this to an absolute date or an explicit metric trigger.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 2 (C-01, C-03) |
| HIGH | 4 (C-02, C-04, C-05, C-08) |
| MEDIUM | 3 (C-06, C-07, C-10) |
| LOW | 1 (C-09) |

Review markers raised: `ACCOUNTING REVIEW REQUIRED` (C-03).
