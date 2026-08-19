# Product Principles

**v0.1** · NOF-001 · Durable principles **already supported by evidence**. NOF-001 §11
listed candidates to verify, not to declare — each below carries what was actually found.

A principle marked `IMPLEMENTED, not stated` is a position Noetia holds in code without
having decided it. Those are the interesting ones: they are either unrecorded decisions
worth promoting, or accidents worth correcting. Both need a Product Owner, not an editor.

---

## P1 — Reading and listening are one experience

**DECIDED · IMPLEMENTED**

Phrase-level synchronization with seamless switching is the product's first stated
capability ([`PRD.md`](../PRD.md)) and is implemented across web and mobile readers
([`technical-baseline/06-reader.md`](../technical-baseline/06-reader.md)). *Escucha
Activa* is a proper noun in the project's own style guide — a named experience, not a
feature toggle.

**Consequence:** anything that degrades synchronization quality is a product regression,
not a technical one. The ≥90% coverage gate (P4) exists to enforce exactly this.

---

## P2 — A redeemed book belongs to the reader

**IMPLEMENTED, not stated as policy** → CODE-03

`user_books` records access with `purchaseType ∈ free | token | courtesy | purchase` and
**carries no expiry column** ([`09-token-economy.md`](../technical-baseline/09-token-economy.md)).
Access, once granted, does not lapse — including when a subscription ends.

Tokens expire (90 days). **Ownership does not.** That asymmetry is the heart of Noetia's
difference from a rental library, and it is currently guaranteed only by the absence of a
database column.

**Recommended:** promote to an explicit Product Owner decision. Of every position in this
framework, this is the one most likely to be violated accidentally by a future feature.

---

## P3 — Ownership is separate from subscription benefits

**PARTIALLY DECIDED**

Subscriptions issue tokens per cycle; tokens are redeemed for permanent book access;
Duo/Family share a token pool but keep **separate libraries** (`linkedUserIds` resolution
in redemption → CODE-02). Cancelling a subscription stops future token issuance; it does
not reach into a library.

`OPEN:` the cancellation path is inferred from schema, not from a stated policy. See
[06-user-rights-and-ownership](06-user-rights-and-ownership.md).

---

## P4 — Only offer a title Noetia can deliver cleanly

**IMPLEMENTED as a code rule** → CODE-04

`books.service.ts` hides any ingested title lacking a Whisper sync map at ≥90% coverage.
Author uploads bypass the gate — authors manage quality through their own review flow.

This is a **product policy living in a service class**. Its origin is documented: showing
a title that then fails in front of the reader was treated as worse than not showing it
at all.

**Consequence:** staging inherits it. NEM-006C surfaces titles below the gate as
`SYNC_BELOW_GATE` rather than hiding the debt.

---

## P5 — Creators participate in the economics

**DECIDED in documentation · NOT IMPLEMENTED** → C-03

The split (45 / 36 / 9 / 2.22 / 7.78) is documented in the business plan, including the
self-narrating author case. No payout or settlement engine exists.

The principle is real and load-bearing — it appears in author-facing marketing. Its
implementation is absent. The framework records both.

---

## P6 — Reading is expressed socially

**DECIDED · IMPLEMENTED**

Fragments → quote cards → platform-specific sharing, with a public invite page per share.
This is the "Share" in *Read. Listen. Capture. Share.* and the mechanism behind the
vision's "social identity behavior."

---

## P7 — AI augments ownership; it never substitutes for the work

**DECIDED (PO-002 / ADR-002) · NOT IMPLEMENTED**

> Noetia Brain may help a user *understand* a copyrighted work but must not function to
> *reconstruct or substitute for* it.

Stated as a **permanent principle** — the strongest available language, and one of the
few explicitly framed to outlive implementation choices. Entitlement and content-AI
rights are enforced *before* protected content enters model context.

---

## P8 — Provenance over blending

**DECIDED (PO-003 / ADR-003) · NOT IMPLEMENTED**

Noetia-derived knowledge and general model knowledge must never be invisibly blended.
Grounded claims cite Book → Author → Chapter → chunk → reader location. External
knowledge is never attributed to a book.

**Consequence:** "where did this idea come from?" must remain answerable. That constrains
retrieval architecture permanently, independent of which model is in use.

---

## P9 — No model name is part of the customer promise

**DECIDED (PO-001 / ADR-001) · NOT IMPLEMENTED**

Users buy Noetia intelligence capabilities, not a particular external model. Provider and
model choices are **current configuration decisions**, never project principles.

---

## P10 — The reader comes first

**DECIDED**

The product hierarchy — reader, then creator, then free library — is the tie-breaker when
work competes. See [00-project-charter](00-project-charter.md).

---

## Candidates NOT established as principles

NOF-001 §11 listed these; the evidence does not support declaring them durable:

| Candidate | Finding |
|---|---|
| One-time book acquisition | Supported, but as a *mechanism* of P2/P3, not a separate principle |
| Accessibility | No accessibility policy, standard, or commitment found anywhere in `docs/` |
| Knowledge development | Designed in Noetia+ (`13-memory-and-knowledge-assets`), not yet a commitment |
| Social reading / clubs | Specified in project memory; not represented in the documentation corpus |

Accessibility is the notable absence: for a product whose core is switching between
reading and listening, no accessibility position is recorded. Flagged for a future NOF
mission rather than invented here.
