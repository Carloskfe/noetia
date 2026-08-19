# User Rights & Ownership

**v0.1** · NOF-001 · What a reader keeps, and what they merely rent.
`LEGAL REVIEW REQUIRED` before this becomes customer-facing terms.

---

## The central distinction

| | Subscription benefit | Redeemed book |
|---|---|---|
| What it is | Access to the service and a token allowance | Access to one specific title |
| Duration | While the subscription is active | **Does not expire** |
| On cancellation | Stops | **Retained** |
| Expires unused | Tokens expire at 90 days | N/A |

**Tokens expire. Ownership does not.** This asymmetry is the model's core promise and
Noetia's difference from a rental library.

## Status of "permanent ownership"

`IMPLEMENTED — NOT FORMALLY DECIDED`

`user_books(userId, bookId, purchaseType)` records access and **has no expiry column**.
Access, once granted, does not lapse — including when a subscription ends. Nothing revokes
it.

Per the continuation authorization §11, this framework **does not promote that to policy
merely because the schema behaves that way.** What can be stated on the evidence:

| Statement | Status |
|---|---|
| Redeemed books are **intended** to remain available after a subscription stops | DECIDED — business plan and product design |
| Book tokens and subscription access are **separate concepts** | DECIDED — [PO-006](decisions/product-owner/PO-006-canonical-subscription-pricing.md), token ledger design |
| Duo/Family share a token pool but keep **separate libraries** | IMPLEMENTED (`linkedUserIds`) and consistent with approved design |
| Permanence is a **formal, revocation-proof commitment to the user** | `OPEN` — no PO decision found |

`OPEN — Product Owner decision required (new, P1):` intent is documented; a decision
record is not. Until one exists, permanence is guaranteed by an absent database column and
nothing else. Of every position in this framework, this is the one most likely to be
violated accidentally by a future feature.

Recorded as a question rather than invented as PO-010, per §11.

## Plan mechanics

| Plan | Users | Tokens | Pool | Libraries |
|---|---|---|---|---|
| Individual | 1 | 1/cycle | own | own |
| Duo | 2 | 2/cycle | **shared** | **separate** |
| Family | **5 or 6 — CONFLICTING** | 3/cycle | **shared** | **separate** |

`CONFLICTING (C-02, Q-05):` Family seat count unresolved and deliberately not inferred
from code.

Redemption takes the oldest active token; if a member has none, it resolves to the
subscription owner's pool.

## Token classes

| Type | Expiry | Creator allocation |
|---|---|---|
| `paid` | 90 days (`TOKEN_EXPIRY_DAYS`) | Yes — qualifying (PO-007/008) |
| `promotional` | 30 days — `INFERRED` → C-06 | No |
| `courtesy` | Per issuance | No |

Expired tokens flip lazily on read (`expireStaleTokens`).

## What happens on cancellation

**INFERRED from schema, not from stated policy:**

1. Token issuance stops at the cycle boundary.
2. Existing active tokens — `OPEN`: whether they survive cancellation until their 90-day
   expiry is not documented.
3. Redeemed books remain in the library.
4. For Duo/Family, member removal at the cycle boundary — `INFERRED`.

`OPEN (P1):` the cancellation path deserves an explicit decision, since it is exactly
where a user's expectations and the system's behavior could silently diverge.

## Review markers

`LEGAL REVIEW REQUIRED` — "ownership" terminology, permanence commitments, cancellation
terms, token expiry disclosure, shared-pool rights between Duo/Family members. Product
policy here is **not** legal advice, and "own" is a word with consequences.
