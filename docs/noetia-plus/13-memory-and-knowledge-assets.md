# 13 — Memory Engine & Knowledge Assets

## Memory Engine — resurface forgotten highlights (low-cost first)
The signals already exist in production data — **no LLM needed for v1**:

| Signal | Source (existing) |
|--------|-------------------|
| time since highlight | `fragments.createdAt` |
| topic | `fragments.themes[]` (20-theme tagger) |
| book completion | `reading_progress.phraseIndex` vs last phrase; `reading_stats` |
| user interest | `user_personas.dominantThemes`, `topGenres` |
| engagement / reread | reading progress + events |
| importance | length / has-note (`fragments.note`) / share history (`shares`) |

**v1 (deterministic):** a nightly `plus-memory` job scores each fragment for "worth resurfacing now" = f(age since last surfaced, theme-match to current interests, importance, not-recently-seen) and stores a small per-user resurface queue. `GET /plus/memory/resurface` reads it. **Spaced-repetition-compatible:** track a `lastSurfacedAt` + simple interval schedule (no LLM). "Resurface related past reading when you hit a similar concept" reuses semantic similarity (pgvector) between the current context and past fragments.

**v2 (optional LLM):** synthesize *why* a highlight matters now, or cluster themes — additive, budgeted.

## Knowledge Assets — model recommendation

**Question (mission §15): extend Fragment, new KnowledgeAsset, multiple entities, or other?**

**Recommendation: create a NEW first-class `knowledge_assets` entity. Do NOT overload `fragments`.**

Rationale:
- `fragments` is **reader-critical** production data (highlights/notes, phrase-anchored, feeds sharing + persona tagging). Overloading it with AI artifacts adds migration risk and semantic confusion to a hot, load-bearing table — exactly the risk the mission warns against.
- Fragments and AI artifacts have **different lifecycles, privacy, and shapes**: a highlight is a user-authored span in a book; an AI summary/comparison/map/draft is a *derived, multi-source, regenerable* artifact.
- **Relationship, not identity:** a `knowledge_asset` **references** its sources (fragmentIds, bookIds, chunkIds). Fragments remain the raw material; assets are the produced knowledge. This keeps the transformation `HIGHLIGHT → KNOWLEDGE → CREATE` explicit in the model.

**Shape (single polymorphic entity — see [09](09-data-model.md)):** `type ∈ {summary, comparison, knowledge_map, learning_path, flashcard_set, quiz, article_draft, presentation_draft, saved_answer}`, `payload jsonb` (type-specific), `sourceRefs jsonb`, `title`, `visibility`, `conversationId?`, timestamps, soft delete. One table with a `type` discriminator + jsonb payload keeps migrations minimal while supporting many asset types (mirrors how `events`/`user_personas` already use jsonb). If a specific asset type later needs heavy relational querying, it can graduate to its own table (ADR), but **start with one polymorphic entity**.

**Not MVP:** knowledge assets arrive with Phase 2 (comparisons) and Phase 4 (creation). MVP's "saved AI answer" can be deferred or be the *first* asset type. Highlights/notes stay as `fragments` throughout.

## Knowledge Graph ("knowledge map") — simplest first
**Do NOT introduce a graph database.** A knowledge map v1 = a **generated graph document** (nodes = concepts/themes/books/fragments; edges = co-occurrence / semantic similarity / shared themes) computed from existing data + embeddings and stored as a `knowledge_asset` (jsonb) or `knowledge_graph_edges` adjacency rows in Postgres. This covers visualization and traversal for the foreseeable product. Neo4j/graph-DB is a **future ADR** only if graph queries become a bottleneck — unlikely at MVP/early scale.

## ADR candidates
- **KnowledgeAsset model** (single polymorphic entity — recommended).
- **Knowledge-graph representation** (Postgres adjacency/jsonb first).
