# PO-024 — Token Expiration, Subscription Cancellation, and Gifting

**Status:** `DECIDED` · **Domain:** Business, Token economy, Billing · **Authority:** Product Owner
**Date:** 2026-10-30
**Resolves:** PO-023 open item **B-5** (expiry of tokens bought without a subscription), and the open questions of the 2026-05-20 token-gifting backlog note
**Implementation:** `PARTIAL` — subscription-token expiry and cancellation behave as decided; package expiry, giftability, peer gifting and lineage are not implemented. See the [impact assessment](../../../architecture/impact-assessments/PO-024-token-expiry-cancellation-gifting.md)

---

## Decision

### Subscription tokens
1. Individual subscriptions issue **one token per monthly allocation**.
2. Subscription-issued tokens are **not giftable**.
3. Each token expires **90 days after its own issuance**.
4. Unused tokens **accumulate** while valid; renewal does **not** reset any token's expiry.
5. Cancellation stops future automatic renewals **at the end of the current paid billing cycle**.
6. Previously issued tokens remain usable until their individual expiry dates.
7. Books acquired by token redemption remain permanently accessible after cancellation ([PO-021](PO-021-token-based-book-acquisition.md)).

### Purchased tokens
8. A standalone **1-token** purchase is **giftable**; it expires **90 days** after issuance (the current PRD rule, retained — see the open question on consistency).
9. Purchased **3-, 5- and 10-token** packages are **giftable**; their tokens expire **six calendar months** after issuance.

### Gifted tokens
10. Only a **valid, eligible** token can be gifted.
11. A gifted token expires **90 days after the gift date**.
12. A gifted token **cannot be gifted again**.
13. Gifting must not duplicate balances or permit double redemption.
14. An **auditable record** links original issuance → gift → recipient → redemption.

### Book ownership
15. One redeemed token acquires one book.
16. Acquired books remain accessible regardless of subscription cancellation or token expiration.

## Relationship to earlier statements

| Earlier statement | Status under PO-024 |
|---|---|
| `docs/PRD.md` § Token Mechanics — "Paid tokens expire 90 days after issuance" (all paid tokens) | **Amended for 3/5/10 packages** (six calendar months); unchanged for subscription and 1-token tokens. Amendment text proposed in the impact assessment §2 — not applied here |
| Terms of Service — "Tokens are valid for 90 days from issuance" | Requires legal update (impact assessment §2) |
| Informal rule confirmed 2026-05-20 (not a decision record) — "all tokens, including unitary purchases, expire after 90 days" | **Superseded** for 3/5/10 packages |
| 2026-05-20 gifting backlog open question — "does a transferred token keep its expiry?" | **Resolved:** a gifted token expires 90 days after the gift date |
| [PO-023](PO-023-subscription-free-book-acquisition.md) B-5 | **Resolved** by items 8–9: the same rules apply with or without a subscription |
| [PO-022](PO-022-independent-noetia-plus-subscription.md) | Unaffected: Noetia+ issues no book tokens; AI usage never consumes them |

## Open — not decided here
Listed with options in the impact assessment §6 (Q-1 … Q-15). The most material: whether gift-card tokens are "gifted tokens"; the gifted-expiry cap; the redemption order with mixed expiries; household pool access after cancellation; refunds after gifting; and how existing package tokens are treated.

## Implementation boundary
Documentation only. Implementation requires approved missions (impact assessment §7); no code, migration, Stripe, or data change is authorized by this record.

## Related
[PO-021](PO-021-token-based-book-acquisition.md) · [PO-022](PO-022-independent-noetia-plus-subscription.md) · [PO-023](PO-023-subscription-free-book-acquisition.md) · PO-007 / PO-008 / PO-010 / PO-012 (creator economics, on `nem-009-resilience-impl`)
