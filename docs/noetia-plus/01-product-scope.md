# 01 — Product Scope

## Definition
Noetia+ is a **recurring premium intelligence layer** around a user's permanent Noetia library. It turns owned books + reading behavior + highlights/notes into a growing, queryable personal knowledge system, grounded primarily in content the user is entitled to.

**Noetia Brain** = the flagship AI capability inside Noetia+ (grounded Q&A, synthesis, memory). Naming is provisional-but-preferred; not redesigned here.

## The transformation
```
BOOK → READ/LISTEN → HIGHLIGHT/NOTE → KNOWLEDGE → CONNECT → UNDERSTAND → REMEMBER → CREATE → SHARE
```
Noetia already covers BOOK → HIGHLIGHT/NOTE (reader, Escucha Activa, fragments, notes, shares). Noetia+ adds KNOWLEDGE → … → SHARE.

## Core philosophy (must be reinforced by architecture)
> **Books are permanent. Intelligence is the subscription.**

- **Ownership** (`user_books`, permanent) and **Noetia+ entitlement** (recurring) are **separate axes** (see [08](08-entitlements-and-subscription.md)).
- A user who cancels Noetia+ keeps every owned book: text, audio, progress, fragments, notes, bookmarks. Only *intelligence services* switch off.
- Noetia+ must never gate owned-book reading behind a recurring payment.

## The five pillars (scope, not commitments)

| Pillar | Essence | Primary grounding |
|--------|---------|-------------------|
| **DISCOVER** | Semantic search across owned books, highlights, notes, public domain; recommendations; learning paths | owned + public-domain + permitted metadata |
| **UNDERSTAND** | Ask across owned/selected books; compare authors/ideas; agreements/contradictions; summarize highlights; knowledge maps | owned + selected + highlights |
| **CREATE** | Draft posts/articles/essays/outlines/speeches; flashcards; quizzes — traceable to sources | owned knowledge + highlights |
| **REMEMBER** | Resurface forgotten highlights; spaced review; resurface related past reading | fragments + reading history |
| **GROW** | Reading/listening analytics; consistency; interests; intellectual development over time | stats + personas |

## Source-Aware Intelligence (PO-003 / ADR-003) — RESOLVED
Noetia Brain is **source-aware**: it may use broader model knowledge where the selected mode permits, but Noetia-derived and general knowledge are **never invisibly blended**, and external knowledge is **never attributed to a book**. Three approved modes (final names = future UX): **This Book** (tightly grounded in the selected book), **My Knowledge** (owned books + highlights + notes + authorized/public-domain Noetia sources — the core experience), **Expand** (broader/general/authorized-external knowledge, provenance distinguishable). See [ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md).

**Differentiation (product direction, not final marketing):** not "generic chatbot + books" — differentiation comes from the permanent personal library, synchronized reading/listening, highlights/notes, knowledge accumulation, source-aware intelligence, provenance, intellectual memory, and creation grounded in what the user has actually read: *"Ask what you've read. Connect what you've learned. Know where every idea came from."*

## Explicit non-goals
- **Not a generic chatbot.** Answers are grounded in the user's entitled content by default; broader knowledge is used only in modes that permit it, always with distinguishable provenance ([ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md) — resolves the former open decision).
- Not a replacement for the reader — it is a layer beside it.
- Not a rights-agnostic librarian — retrieval is permission-aware ([05](05-content-permissions.md)).

## Recommended MVP boundary
**MVP = Phase 0 (infra) + Phase 1 (Ask).** Concretely:
- **Ask This Book** and **Ask My Highlights**, with **citations that deep-link into the reader**.
- Deterministic **recommendations** from existing persona/stats data (no/low LLM cost) as an early DISCOVER win.
- Everything else (library-wide synthesis, compare, memory, create, maps) is post-MVP.

Rationale: Ask-This-Book is the smallest capability that (a) proves the whole stack (entitlement → permission-aware retrieval → provider abstraction → citations → metering), (b) is naturally single-book scoped (cheapest context, easiest permissions), and (c) delivers obvious user value on day one. Recommendations piggyback on data that already exists, giving a second visible feature at near-zero variable cost.

## Success criteria for the design (from §48)
The 13 questions in §48 of the mission are answered across these docs; the [EXECUTIVE_SUMMARY](EXECUTIVE_SUMMARY.md) maps each to its answer.
