# PO-006 — Canonical Subscription Pricing

**Status:** `DECIDED` · **Domain:** Business · **Authority:** Product Owner
**Resolves:** [C-01](../../governance/contradictions-and-gaps.md) · Q-01
**Implementation:** `UNVERIFIED` — Stripe configuration has **not** been checked against this policy

---

## Canonical prices

| Plan | Monthly | Annual |
|---|---|---|
| Individual | **$8.99** | **$83.99** |
| Duo | **$13.99** | **$129.99** |
| Family | **$18.99** | **$179.99** |

These are authoritative for all Noetia documentation, marketing, and configuration.

## What this supersedes

[`docs/business/en/01-business-plan.md:166-168`](../../../business/en/01-business-plan.md)
and its Spanish counterpart state annual prices of **$89.99 / $139.99 / $189.99**. Those
values are:

`SUPERSEDED BY PO-006`

The historical text is **not rewritten**. It remains as evidence of what was believed at
the time; this decision records which figure governs. Monthly prices were never in
dispute — both sources already agreed.

## Implementation is a separate question

**Do not assume Stripe matches this policy.** Annual plans are configured as Stripe price
IDs (`STRIPE_PRICE_*`), and no verification has been performed. Whichever value is
currently live may be the superseded one.

Recorded as an implementation gap:
[IG-01](../../governance/contradictions-and-gaps.md#implementation-gaps). Verification is
an operations task requiring production Stripe access — outside NOF-001's
documentation-only authorization.

## Related

- [04-business-model-framework](../../04-business-model-framework.md) — plan structure
- [05-economic-framework](../../05-economic-framework.md) — how plan revenue becomes token value
- `docs/stripe-setup.md` — where the price IDs are configured
