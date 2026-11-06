# PO-025 — Three-Tier Product Structure

**Status:** `DRAFT — NOT DECIDED`. Records the Product Owner scope update of 2026-11-06 as modified by preliminary ruling TT-01. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** Product, Business · **Authority:** Product Owner
**Date:** 2026-11-06 · **Source:** Product Owner scope update; T0 ruling TT-01
**Implementation:** `NOT IMPLEMENTED` — no intelligence code exists on any branch

---

## Decision (proposed text)

1. The customer-facing structure is **Noetia**, **Noetia+**, and **NoetiaX**.
2. **Noetia** is the existing multimodal reading and social-sharing platform.
3. **Noetia+** is source-aware, interactive AI intelligence and research.
4. **NoetiaX** is advanced source-aware intelligence, with deeper cross-book reasoning and research. It must be **qualitatively deeper**, not merely a larger book limit. Its precise capabilities require specification and separate approval.
5. Both premium tiers support interactive in-app conversation and Research Brief export. A Research Brief is an artifact of a session and does not replace the interactive experience.
6. The customer-facing label **"Basic" is not used.**

## Commercial invariants (proposed text)

| # | Invariant |
|---|---|
| 1 | Token package prices remain $9.99 / $24.99 / $39.99 / $74.99 |
| 2 | Token expiration follows **[PO-024](PO-024-token-expiration-cancellation-gifting.md)**. There is no universal 90-day rule |
| 3 | Acquired books remain permanently owned |
| 4 | Both premium tiers may purchase additional tokens at unchanged prices |
| 5 | Book tokens never increase AI usage allowances |
| 6 | AI consumption uses separate monthly internal resource budgets and fair-use controls |
| 7 | Premium subscription prices are **not** set by this record |

**Correction recorded.** The 2026-11-06 scope update stated that purchased tokens expire after 90 days. Ruling TT-01 preserves PO-024 instead, so that sentence is **not** carried into this record.

## Related records

Prerequisite: [PO-026](PO-026-premium-subscription-prerequisite.md) · Limits: [PO-027](PO-027-research-session-book-limits.md) · Highlights: [PO-028](PO-028-my-knowledge-and-highlight-boundary.md) · Corpus: [PO-029](PO-029-eligible-research-corpus.md) · PO-001…004 · ADR-001…004.

## Pending — not decided here

Prices · budget values · NoetiaX depth capabilities (TT-07) · Noetia+ contradiction depth (TT-08) · whether a premium tier includes tokens of its own (TT-16) · tier placement of other NEM-003 capabilities (TT-19).

## Implementation boundary

Authorizes no implementation, Stripe product, migration, or deployment.
