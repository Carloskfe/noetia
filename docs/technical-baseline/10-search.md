# 10 — Search

Engine: **Meilisearch v1.7** (`getmeili/meilisearch`), self-hosted, internal-only (no external port). Module: `services/api/src/search`.

## Index — CONFIRMED (`search.service.ts`, `search.module.ts`)
- Single index: **`books`** (client `client.index('books')`, provided as `MEILI_INDEX`).
- Index settings applied on init:
  - `searchableAttributes: ['title', 'author', 'description']`
  - `filterableAttributes: ['category', 'isFree', 'isPublished', 'language', 'meetsStandard']`
  - `sortableAttributes: ['createdAt']`
- Primary key: `id` (book UUID).
- Connection: `MEILI_HOST` (default `http://search:7700`), `MEILI_MASTER_KEY`. **CONFIRMED** (names only).

## Document shape — CONFIRMED
`toDoc(book, meetsStandard)` maps a `Book` to the search document, including a computed **`meetsStandard`** flag (the ≥90% sync-quality gate). Below-standard titles are indexed with `meetsStandard=false` and filtered out of user-facing search — the same gate used by discovery/collections.

## Pipeline — CONFIRMED
- `indexBook(book)` — upsert one document (`addDocuments([...], { primaryKey: 'id' })`).
- `indexAll(books)` — bulk index (used by the `seed-search` ingestion CLI; re-run after deploy/reseed).
- `removeBook` / delete path — **INFERRED** present (index maintenance) but not line-verified.
- **Indexing trigger:** primarily via the ingestion CLI and explicit calls; whether every book create/update/publish path calls `indexBook` automatically is **INFERRED / partially UNKNOWN** — search is re-seeded after catalog changes.

## Query API — CONFIRMED
- `GET /search?q=&category=&isFree=` → `SearchService.search(q, { category, isFree })`.
- Executes `index.search(q, { filter: … })` combining the requested filters with the `meetsStandard`/`isPublished` gate. Exact filter string construction **INFERRED**.

## Languages — CONFIRMED / INFERRED
- Catalog is bilingual (ES/EN); `language` is a filterable attribute.
- Meilisearch handles tokenization/typo-tolerance per its defaults. **INFERRED:** no custom per-language analyzer configuration beyond defaults.
- **Known limitation (documented):** search is case-insensitive but **not accent-insensitive** by default (`galdos` ≠ `Galdós`) unless normalized; a Postgres `unaccent` path exists for the `/books?search=` typeahead but Meili accent-folding is a noted follow-up.

## Book typeahead (separate path) — CONFIRMED
`GET /books?search=` performs a Postgres case-insensitive ILIKE on title/author behind the quality gate (powers the club book-picker typeahead) — this is **distinct** from Meilisearch and does not use the index.

## Ranking — INFERRED
Uses Meilisearch default ranking rules (words, typo, proximity, attribute, exactness) plus `createdAt` sortability; no custom `rankingRules` were set in `updateSettings` (only searchable/filterable/sortable were configured). **CONFIRMED** absence of custom ranking rules in the observed settings call.

## Limitations — INFERRED
- Single index (`books`); no fragment/full-text-content search index (fragments and book *body text* are not indexed for search).
- Master key auth only; no per-tenant scoping (single-tenant platform).
