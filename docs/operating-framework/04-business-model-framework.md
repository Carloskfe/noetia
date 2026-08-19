# Business Model Framework

**v0.1** · NOF-001 · How Noetia earns, and what a customer receives for paying.

---

## Shape of the model

Subscription issues **tokens**; a token is redeemed for **permanent access** to one book.
Noetia is therefore neither a rental library nor a pure storefront: recurring revenue
funds a stream of permanent acquisitions.

```
Subscription ──issues──> Tokens ──redeemed──> Permanent book access
     │                      ▲                        │
     │                      └── purchased packages   └── stays after cancellation
     └── plan tier sets tokens per cycle                 (P2 / 06-user-rights)
```

## Plans and pricing

**DECIDED — [PO-006](decisions/product-owner/PO-006-canonical-subscription-pricing.md)**

| Plan | Monthly | Annual | Users | Tokens per cycle |
|---|---|---|---|---|
| Individual | $8.99 | $83.99 | 1 | 1 |
| Duo | $13.99 | $129.99 | 2 | 2 (shared pool) |
| Family | $18.99 | $179.99 | **5 or 6 — CONFLICTING** | 3 (shared pool) |

Business-plan annual figures ($89.99 / $139.99 / $189.99) are `SUPERSEDED BY PO-006`.

`CONFLICTING — Product Owner decision required (C-02, Q-05):` the PRD says up to 6 users,
the business plan says 5. **The framework deliberately does not adopt whichever value the
code enforces** — that would convert an implementation detail into policy.

`IG-01:` Stripe price IDs have not been verified against PO-006.

## Token mechanics

**IMPLEMENTED** — `token_ledger` is append-only; each token is a row with type
(`paid | promotional | courtesy`), status (`active | redeemed | expired`), and expiry.

| Rule | Status |
|---|---|
| Paid token expiry: **90 days** (`TOKEN_EXPIRY_DAYS`) | IMPLEMENTED |
| Promotional expiry: 30 days | INFERRED — passed by caller, not asserted → C-06 |
| Redemption takes the **oldest active** token | IMPLEMENTED |
| Duo/Family draw from the **owner's shared pool** | IMPLEMENTED (`linkedUserIds`) |
| Members keep **separate libraries** | IMPLEMENTED |
| Additional token packages purchasable | IMPLEMENTED |
| Free-library titles need no token | IMPLEMENTED |

**Tokens expire; ownership does not.** That asymmetry is the model's core promise — see
[06-user-rights-and-ownership](06-user-rights-and-ownership.md).

## Other revenue and giving

| Stream | State |
|---|---|
| **Gift cards** | IMPLEMENTED — Stripe purchase, emailed claim token, bounded expiry |
| **Peer token gifting** | FUTURE — project notes only → C-07 |
| **Causas Noetia** | 2.22% of every payment (PO-007) — decided, **not computed** → IG-02 |
| **Noetia+ subscription** | PLANNED — recurring AI capability tier; price unset (Q-11) |

## Noetia+ economics

**DECIDED as guardrails (PO-001), not as billing rules:**

- Pricing intent ~$5.99–$9.99/mo (interest ~$7.99–$8.99); **final price unset**.
- Normal-user AI/infra COGS target **≤ ~$1.50/mo**.
- COGS bands: Excellent ≤15% · Healthy 15–25% · Caution 25–35% · Intervention >35%.
- **`BOOK TOKEN ≠ AI USAGE`** — never merged into one customer-facing unit.

## Trials, referrals, free tier

`OPEN` — the business plan references referral concepts and free access; no approved
mechanics were found. Waitlist and single-use `upload_codes` exist in code, but their
commercial semantics are `INFERRED`.

## Related

[05-economic-framework](05-economic-framework.md) ·
[06-user-rights-and-ownership](06-user-rights-and-ownership.md) ·
[07-creator-and-rights-framework](07-creator-and-rights-framework.md)
