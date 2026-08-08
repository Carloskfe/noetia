# 09 — Data Model

**No migrations are created in this mission.** Proposed entities only. Each is tagged **REUSE / EXTEND / NEW / FUTURE** and marked **MVP?**. Naming follows the repo convention (snake_case tables, camelCase-quoted columns, UUID PKs, TypeORM).

## Reuse (no change)
`user_books` (ownership → content scope), `user_personas`, `reading_stats`, `reading_progress`, `fragments`, `events`, `subscriptions`, `plans`, `sync_maps` (read-only for citations), `books`. See [02](02-current-integration-surface.md).

## EXTEND (small, additive)
- **`books`** — *optional* add `aiIndexStatus` (`none|indexing|indexed|error`) + `aiIndexedVersion` for quick "is this Ask-able?" checks. Alternatively keep status only on `book_chunks`. **MVP: nice-to-have**, not required.
- **`plans`** — add a Noetia+ plan row + feature-set mapping (data, not schema; see [08](08-entitlements-and-subscription.md)). **MVP: yes** (one plan).

## NEW entities

### `book_chunks` — NEW, **MVP: yes**
- **Purpose:** semantic RAG unit (distinct from sync phrases — [04](04-rag-and-retrieval.md)).
- **Fields:** `id` uuid PK; `bookId` uuid FK; `chunkIndex` int; `text` text; `charStart/charEnd` int; `phraseIndexStart/phraseIndexEnd` int (deep-link to reader); `chapter`/`section` varchar null; `language` varchar; `tokenCount` int; `textHash` varchar (content version); `embedding` vector(N) *(pgvector)*; `embeddingModel`/`embeddingVersion` varchar; `contentScopeCache` varchar null; `createdAt`.
- **Indexes:** `(bookId, chunkIndex)`; pgvector HNSW/IVFFlat on `embedding`; `textHash`.
- **Relationships:** many→1 `books`.
- **Lifecycle:** created by `plus-embed` job on ingest/first-use; re-created on `textHash`/model-version change; deleted with book (CASCADE).
- **Privacy:** content-derived (book text) — governed by content permissions, **not** user-private.
- **Volume:** ~50–500 chunks/book × catalog (low thousands of books) → low millions of rows; well within pgvector on the VPS.
- **Retention:** lifetime of book/version.

### `ai_conversations` — NEW, **MVP: yes**
- **Purpose:** a Noetia+ chat session with a fixed scope.
- **Fields:** `id` uuid PK; `userId` uuid FK; `scope` varchar (`this_book|selected|library|highlights|public`); `sourceRefs` jsonb (bookIds / fragmentIds in scope); `title` varchar null (auto-generated); `createdAt`; `updatedAt`; `deletedAt` timestamptz null (soft delete).
- **Indexes:** `(userId, updatedAt)`.
- **Relationships:** 1→many `ai_messages`.
- **Lifecycle:** created on first message; title generated (Cheap model); user-deletable (soft then purge).
- **Privacy:** **user-private** (highest sensitivity — intellectual behavior). Never shared across Duo/Family ([15](15-privacy.md)).
- **Volume:** moderate (per active Noetia+ user). **Retention:** until user deletes; post-cancellation retention is an [OPEN DECISION](20-open-product-decisions.md).

### `ai_messages` — NEW, **MVP: yes**
- **Purpose:** one turn in a conversation.
- **Fields:** `id` uuid PK; `conversationId` uuid FK; `role` varchar (`user|assistant|system`); `content` text; `citations` jsonb (`[{bookId, chunkId, phraseIndexStart, phraseIndexEnd, snippet}]`); `usageEventId` uuid null (→ metering); `createdAt`.
- **Indexes:** `(conversationId, createdAt)`.
- **Privacy:** user-private. **Volume:** high per active user. **Retention:** with conversation.

### `ai_usage_events` — NEW, **MVP: yes**
- **Purpose:** AI service-consumption accounting — **separate from `token_ledger`** (mission §19).
- **Fields:** `id` uuid PK; `userId`; `subscriptionId` null; `feature` varchar; `provider` varchar; `model` varchar; `taskClass` varchar; `inputTokens` int; `outputTokens` int; `embeddingsCount` int; `retrievalCount` int; `durationMs` int; `estCostMicros` bigint (integer micro-USD, config-priced); `cacheHit` bool; `success` bool; `errorCode` varchar null; `createdAt`.
- **Indexes:** `(userId, createdAt)`; `(feature, createdAt)`; `(createdAt)`.
- **Relationships:** optional → `ai_messages`.
- **Privacy:** user-scoped metadata (no content stored — token *counts*, not text). **Volume:** one row per AI call (high) → candidate for monthly rollup + retention window. **Retention:** raw ~90 days then aggregate (recommended; [OPEN DECISION](20-open-product-decisions.md)).

### `book_ai_permissions` — NEW, **MVP: yes (resolver) / publisher UI FUTURE**
- **Purpose:** per-book publisher AI controls ([05](05-content-permissions.md)).
- **Fields:** `bookId` uuid PK/FK; `semanticIndexingAllowed`, `qaAllowed`, `summaryAllowed`, `crossBookComparisonAllowed`, `quoteGenerationAllowed`, `groundingAllowed`, `discoverabilityEmbeddingsAllowed`, `trainingAllowed` (default **false** for licensed), `maxQuotePolicyRef` varchar null; `updatedById`; `updatedAt`.
- **Lifecycle:** defaulted by content class (public-domain → permissive; licensed → conservative); editable by publisher/admin (UI is FUTURE).
- **Privacy:** content-governance (not user data). **Volume:** 1/book. **Retention:** lifetime.
- **MVP note:** the **resolver + sane defaults** are MVP; the **publisher-facing editor** is FUTURE. MVP can default by `isFree`/ownership without a per-book editor.

### `plus_capability_grants` (or reuse a flags table) — NEW, **MVP: yes**
- **Purpose:** user-level Noetia+ capability overrides / beta access ([08](08-entitlements-and-subscription.md), [18](18-feature-flags-rollout.md)).
- **Fields:** `id`; `userId`; `capability` varchar; `enabled` bool; `source` varchar (`plan|beta|admin`); `createdAt`.
- **Privacy:** user-scoped. **Volume:** low. **Retention:** while relevant.

### `feature_flags` — NEW, **MVP: yes**
- **Purpose:** master + capability flags, % rollout ([18](18-feature-flags-rollout.md)).
- **Fields:** `key` varchar PK; `enabled` bool; `rolloutPercent` int; `payload` jsonb null; `updatedAt`.
- **Privacy:** ops config. **Volume:** tiny.

## FUTURE entities (keep architecturally possible; NOT MVP)
- **`knowledge_assets`** — polymorphic AI artifacts (summary/comparison/map/learning-path/flashcard-set/quiz/draft/saved-answer). Fields: `id, userId, type, title, payload jsonb, sourceRefs jsonb, conversationId null, visibility, createdAt, deletedAt`. **Recommendation: create as a NEW first-class entity when Phase 2/4 lands — do NOT overload `fragments`** ([13](13-memory-and-knowledge-assets.md)). FUTURE.
- **`knowledge_graph_edges`** — adjacency (`userId, fromRef, toRef, relation, weight, source`) — Postgres-relational first, no graph DB ([13](13-memory-and-knowledge-assets.md)). FUTURE.
- **`learning_paths`**, **`intellectual_timeline`** — FUTURE.
- **`ai_credit_ledger`** (optional add-on packs) — only if AI-credit add-ons are approved; **separate** from `token_ledger`. FUTURE.

## Necessity summary (MVP)
**Truly required for MVP (Ask This Book / Ask My Highlights + recs):** `book_chunks`, `ai_conversations`, `ai_messages`, `ai_usage_events`, `book_ai_permissions` (resolver+defaults), `plus_capability_grants`, `feature_flags`, one Noetia+ `plans` row, pgvector extension. Everything else is FUTURE.
