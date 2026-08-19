# Project Charter

**v0.1** · NOF-001 · Consolidated from existing evidence. Nothing here is invented; gaps
are marked `OPEN`.

---

## Why Noetia exists

**PARTIALLY DECIDED** — a vision is recorded; the human problem behind it is not.

> To become the leading platform where knowledge is not only consumed but expressed —
> turning reading into a social identity behavior.
> — [`PRD.md`](../PRD.md) *Vision*

The product's summary of itself is four verbs: **Read. Listen. Capture. Share.**

`OPEN — Product Owner decision required (Q-09):` the charter question "what human problem
does Noetia address?" has no recorded answer. The vision states an ambition and a
behavior, not the reader's underlying need. This is the most important gap in the charter.

---

## What Noetia is

**DECIDED** — a multimodal reading platform that synchronizes text and audio at the
phrase level, allowing seamless switching between reading and listening, and that turns
highlights into shareable visual content ([`PRD.md`](../PRD.md)).

Three capabilities carry the value proposition:

1. **Synchronized reading and listening** — phrase-level, seamless switching (*Escucha Activa*)
2. **Frictionless knowledge capture** — fragments and highlights
3. **Instant social content creation** — branded quote cards

---

## What Noetia is not

**DECIDED** — and the PRD calls this distinction fundamental to every product decision:

> **Noetia is not a content publisher.** Noetia is a distribution and reading platform.
> The catalog is built by authors, publishers, and companies — not by Noetia.

This has direct consequences that appear throughout the framework: authors are a supply
chain rather than a cost centre; the free library is an acquisition tool rather than the
business; creator economics are a first-class concern rather than an afterthought.

`OPEN (Q-09):` no further anti-goals are recorded.

---

## Who Noetia is principally for

**DECIDED, with an ordering rule.** [`CLAUDE.md`](../../CLAUDE.md) states a product
hierarchy that governs engineering priority:

| Priority | Constituency | Rationale |
|---|---|---|
| 1 | **Readers** | The daily active user. Reading must be fast, correct, reliable before anything else ships |
| 2 | **Authors, publishers, companies** | The content supply chain. Upload, sync, review, analytics are business-critical infrastructure |
| 3 | **Free library** | ~40 public-domain titles as a beta acquisition tool — explicitly *not* the business |

The hierarchy is explicitly **about frequency of interaction, not importance**: authors
matter as much as readers; readers simply interact daily while authors upload
occasionally.

This is the clearest durable commitment in the project and the strongest candidate for
formal promotion from `CLAUDE.md` (a developer guide) to charter status → DOC-08.

---

## Commitments that should survive individual features

Candidates supported by evidence. Each is elaborated in
[02-product-principles](02-product-principles.md); the charter records only that they
appear to be load-bearing.

| Commitment | Status | Evidence |
|---|---|---|
| Reading and listening are one experience, not two modes | DECIDED | PRD, Escucha Activa across reader/mobile |
| A redeemed book stays in the reader's library | IMPLEMENTED, never stated as policy | `user_books` has no expiry → CODE-03 |
| Never offer a title Noetia cannot deliver cleanly | IMPLEMENTED as a code rule | ≥90% sync gate in `books.service.ts` → CODE-04 |
| Creators participate in the economics | DECIDED in documentation, unimplemented | revenue split → C-03 |
| AI augments ownership; it does not substitute for the work | DECIDED | PO-002 |
| Noetia-derived and general knowledge are never blended invisibly | DECIDED | PO-003 |

---

## What future contributors should not casually violate

Drawn from existing governance rather than invented here:

- **The product hierarchy.** A change that degrades the reader experience to serve an
  occasional flow inverts the stated order.
- **Permanent ownership.** Redeemed books are not rentals. Nothing should introduce
  expiry to `user_books` without an explicit Product Owner decision.
- **Protected systems.** Escucha Activa, ownership, production data, and business-rule
  engines require explicit authorization to touch ([`engineering-missions/README.md`](../engineering-missions/README.md)).
- **Bounded authorization.** An approved mission authorizes its own scope and nothing
  else; approval is not blanket repository permission.
- **Rights before retrieval.** Entitlement and content-AI rights are enforced *before*
  protected content reaches a model (PO-002).

---

## Open charter questions

| Question | Priority | Register |
|---|---|---|
| What human problem does Noetia address? | P1 | Q-09 |
| What else is Noetia not trying to become? | P1 | Q-09 |
| Is the LatAm / US-Hispanic focus a priority or a boundary? | P2 | Q-13 |

---

## Sources

[`PRD.md`](../PRD.md) · [`CLAUDE.md`](../../CLAUDE.md) ·
[`business/en/01-business-plan.md`](../business/en/01-business-plan.md) ·
[`noetia-plus/PRODUCT-DECISIONS.md`](../noetia-plus/PRODUCT-DECISIONS.md) ·
[`engineering-missions/README.md`](../engineering-missions/README.md)
