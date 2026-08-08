# 12 — Search & Recommendations

## Meilisearch × semantic — coexistence
Meilisearch stays the **lexical** engine (it already indexes `books`, is deployed, cheap, fast). Semantic retrieval (pgvector) is **added alongside**, not replacing it. Hybrid query flow:
```
query → intent/scope detection
      → lexical (Meili)  +  semantic (pgvector kNN)
      → fuse (Reciprocal Rank Fusion or weighted)
      → PERMISSION FILTER (content scope + per-book AI perms)   [05]
      → rerank (optional; cheap model or cross-encoder)
      → context builder → LLM → citations
```
**Validation of the mission's proposed flow:** it is sound and matches the repo. Two refinements: (1) permission filtering must be **both** a query-time join *and* a post-retrieval backstop ([05](05-content-permissions.md)); (2) for MVP single-book scope, semantic-only over that book's chunks is enough — hybrid+rerank earn their cost at library scale (Phase 2).

- **DISCOVER search** (`POST /plus/search`) returns permission-filtered results with citations and **no LLM** — a cheap, high-value feature.
- **Meili settings** already include `meetsStandard`/`isFree`/`language` filterables — reuse for scope filtering.

## Recommendation engine — deterministic first
Noetia already computes `user_personas` nightly (engagement archetype, reading cadence, completion rate, **20-theme** dominant themes, top genres, preferred platforms, social amplification) + `reading_stats` + fragment `themes[]`. **Recommendation:** build Phase-1 recommendations from this existing data with **deterministic scoring — no LLM cost**:

- **Signals (all already present):** dominant themes ↔ book categories/collections; top genres; completion rate (finish-likelihood); cadence (how much to surface); fragment themes (what resonates); not-yet-owned catalog filtered by the quality gate + language.
- **Method:** score candidate books by theme/genre affinity × novelty × quality-gate pass, exclude owned/culled, diversify. Cache per user (`plus-recommend` nightly job); invalidate on persona update.
- **LLM only later:** natural-language *explanations* ("why this book") and learning-path sequencing (Phase 2/3) — additive, not required for the core recommendation list.

This keeps DISCOVER's variable cost near zero at launch and only spends model budget where it adds clear value.

## Learning paths (Phase 3)
Sequence owned/eligible books + chunks toward a stated goal. Start deterministic (theme graph over owned library) + light LLM for ordering/rationale; persist as a `knowledge_asset`.

## Personalized reading recommendations vs. discovery of non-owned books
- **Owned/library:** full semantic + persona signals.
- **Non-owned:** only permitted metadata/preview/summary/approved embeddings ([05](05-content-permissions.md)) — recommendations of non-owned titles use catalog metadata + discoverability embeddings where the publisher allows, never full-text.

## ADR candidates
- **Hybrid fusion + rerank strategy** (RRF vs weighted; whether to rerank in MVP).
- **Deterministic-vs-LLM recommendation boundary.**
