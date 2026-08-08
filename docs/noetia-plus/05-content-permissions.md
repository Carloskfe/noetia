# 05 — Content Permissions (Permission-Aware Retrieval)

**Mandatory.** Noetia+ must never treat the catalog as universally queryable. Rights are enforced **before** any content enters model context.

> **RATIFIED by PO-002 / [ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md) (NEM-005).** Two clarifications the ADR makes binding: (1) **public-domain status is per specific text/translation/edition** — a work being public-domain does NOT automatically make a modern translation/edition public-domain; verify the exact edition before full AI processing. (2) **User ownership does NOT by itself grant Noetia unrestricted AI rights** over copyrighted content — the OWNED scope's AI operations are **subject to Noetia's rights agreement with the applicable rights holder.** Permission is enforced *before* retrieval, not by filtering afterward.

## Content scopes
Every retrievable unit resolves to exactly one scope for a given user:

| Scope | Trigger | Allowed AI use |
|-------|---------|----------------|
| **OWNED** | user has a `user_books` row for the book (any `purchaseType`) | full text retrieval + grounding, within per-book AI-permission limits |
| **PUBLIC_DOMAIN** | `book.isFree` + public-domain status | full Noetia-controlled use (embed, retrieve, ground) |
| **LICENSED_PREVIEW** | published, not owned by this user, publisher-permitted | only metadata, description, publisher-authorized previews/snippets, approved semantic representation — **never full text** |
| **RESTRICTED** | not permitted (publisher opt-out, or unknown rights) | **no AI retrieval at all** |

Scope is **per (user, book)** — ownership is user-specific; publisher permission is book-specific; the effective scope is the **intersection** (most restrictive wins).

## Where enforcement lives (single choke point)
A **`ContentScopeResolver`** in `knowledge/retrieval`:
1. Retrieval returns candidate chunks (lexical + semantic) with their `bookId`.
2. Resolver batch-computes scope for `(userId, bookId)` using `user_books` (ownership) ∩ per-book AI permissions (publisher) ∩ book status.
3. Chunks whose scope forbids the requested operation are **dropped before context assembly**. RESTRICTED never appears; LICENSED_PREVIEW is truncated to permitted representations.
4. The Context Builder only ever sees permitted content.

This is enforced in the **orchestrator path**, not scattered across features — every capability goes through it. It is defense-in-depth alongside DB-level filtering: the pgvector/Meili queries themselves also filter by an ownership/permission join, so restricted content is never even *retrieved* when avoidable, and the resolver is the backstop.

## Per-book AI permissions (publisher controls — design, not built)
A per-book permission set (entity in [09](09-data-model.md), authored via the author/publisher system — [12-author-system in NEM-001]):

- `semanticIndexingAllowed`
- `qaAllowed`
- `summaryAllowed`
- `crossBookComparisonAllowed`
- `quoteGenerationAllowed`
- `groundingAllowed` (may content be used to ground generated output)
- `discoverabilityEmbeddingsAllowed` (embeddings for non-owned discoverability)
- `trainingAllowed` (**default OFF** — see below)
- `maxQuotePolicy` (per-book quotation ceiling ref — [14](14-security-and-copyright.md))

**Defaults (recommended, subject to Product/Legal — [20](20-open-product-decisions.md)):**
- **Public-domain & Noetia-owned:** all AI operations allowed by default.
- **Author/publisher-uploaded licensed content:** conservative defaults — indexing/Q&A/summary for **owners only**, comparison/quote per publisher opt-in, discoverability embeddings opt-in.
- **Training/model-improvement:** **OFF by default for all licensed content.** Licensed content must not train a general-purpose model without explicit authorization (mission §11). This is a hard default.

## Opt-in/opt-out without a rewrite
Permissions are **data**, resolved at query time — so a publisher toggling a flag changes behavior immediately with no code change. New permission types are additive columns/flags. The resolver reads the current permission snapshot; embeddings created under a now-revoked permission are excluded at retrieval time (and can be purged by a job) rather than requiring re-architecture.

## Interaction with entitlements
Content permission (can this *content* be used by AI?) is **orthogonal** to user entitlement (is this *user* allowed the feature?) — [08](08-entitlements-and-subscription.md). Both must pass. Ownership (permanent) is one input to content scope; it is **not** the Noetia+ subscription.

## ADR candidates
- **Permission architecture** (resolver choke point + per-book flags + intersection semantics).
- **Default permission matrix** for licensed content (Product/Legal decision).
