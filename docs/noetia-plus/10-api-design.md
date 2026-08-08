# 10 — API Design

Proposed surface (no controllers implemented). All under `/plus/*`, all behind `JwtAuthGuard`; feature routes add `PlusEntitlementGuard` + `@RequiresCapability(...)` ([08](08-entitlements-and-subscription.md)). Errors use the existing `HttpException` convention with a typed `error` code so the UI can react (e.g. upgrade prompt).

## Conventions
- **Auth:** JWT (existing). **Entitlement:** capability per route. **Rate limiting:** existing `ThrottlerGuard` for cheap routes; **fair-use metering** (Redis counters + `ai_usage_events`) for AI routes, returning `429 plus_limit_reached` with a soft/hard distinction.
- **Async:** long jobs return `202 { jobId }` + status polling / push; interactive Q&A **streams** (SSE) or returns a full result.
- **i18n:** requests may carry a language hint; responses honor it ([30]).

## MVP endpoints

> **Modes (PO-003 / [ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md)):** the `scope` parameter carries the approved Source-Aware modes — `this_book` = **This Book** (tightly grounded), `library`/`highlights`/`selected` = **My Knowledge**, and an `expand` flag/scope = **Expand** (broader/general knowledge). Responses must keep provenance distinguishable (*from your library* vs *broader context*) and never attribute external knowledge to a book.

### Ask (Q&A) — Phase 1
| Method | Path | Cap | Sync? | Notes |
|--------|------|-----|-------|-------|
| POST | `/plus/ask` | `plus.ask_book` (or scope-specific) | **stream** | Body `{ scope, sourceRefs, question, conversationId? }`. Creates/continues a conversation; returns streamed answer + `citations[]` + `usage`. Errors: `402 plus_required`, `403 capability_denied`, `429 plus_limit_reached`, `422 no_sources`, `409 book_not_indexed`. |
| GET | `/plus/conversations` | `plus.core` | sync | List (title, scope, updatedAt), paginated, user-scoped. |
| GET | `/plus/conversations/:id` | `plus.core` | sync | Messages + citations; 404 if not owner. |
| DELETE | `/plus/conversations/:id` | `plus.core` | sync | Soft-delete → purge job. |
| PATCH | `/plus/conversations/:id` | `plus.core` | sync | Rename. |

### Citations / deep-link — Phase 1
| GET | `/plus/citations/:id/resolve` | `plus.core` | sync | Returns `{ bookId, phraseIndexStart, phraseIndexEnd }` → web/mobile open `/reader/:bookId?phrase=<start>`. (Reader honors a new `?phrase=` param — tiny EXTEND, reuses `seekToPhrase`.) |

### Recommendations (deterministic-first) — Phase 1
| GET | `/plus/recommendations` | `plus.core` | sync | From `user_personas` + `reading_stats` + fragment themes; cached. Low/zero LLM cost ([12](12-search-and-recommendations.md)). |
| POST | `/plus/recommendations/:bookId/feedback` | `plus.core` | sync | dismiss/like → improves signal; emits event. |

### Semantic search — Phase 1/2
| POST | `/plus/search` | `plus.ask_book`/`plus.ask_library` | sync | Body `{ scope, query }` → permission-filtered hybrid results (chunks + citations), **no LLM** (retrieval only) — cheap DISCOVER. |

### Usage (transparency, no raw tokens) — Phase 1
| GET | `/plus/usage/me` | `plus.core` | sync | User-facing units ("standard requests / deep analyses / creation jobs" used vs. allowance) — **not** raw tokens ([07](07-cost-and-usage-model.md)). |

## Phase 2+ endpoints (designed, not MVP)
| POST | `/plus/compare` | `plus.compare` | async `202` | Cross-book comparison / contradictions → `knowledge_asset`. |
| POST | `/plus/summarize/highlights` | `plus.core` | sync/async | Summarize fragments. |
| POST | `/plus/knowledge-map` | `plus.maps` | async | Build/refresh a map → asset. |
| POST | `/plus/create/{post\|article\|outline\|flashcards\|quiz}` | `plus.create` | async | Traceable generation → asset; large outputs to MinIO. |
| GET | `/plus/memory/resurface` | `plus.memory` | sync | Forgotten highlights to review ([13](13-memory-and-knowledge-assets.md)). |
| GET | `/plus/assets` / `GET|DELETE /plus/assets/:id` | `plus.core` | sync | Knowledge-asset CRUD (Phase 4). |
| GET | `/plus/grow` | `plus.core` | sync | GROW analytics (reuses stats/personas). |

## Admin (future, not implemented) — [37]
`/admin/plus/*`: flags, provider/model/budget config, per-user beta, per-book AI permissions, usage visibility, request audit. Guarded by a proper `AdminGuard` (the centralization recommended in NEM-002A), **not** inline checks.

## Error taxonomy (typed `error` codes)
`plus_required` (402), `capability_denied` (403), `plus_limit_reached` (429, soft/hard), `book_not_indexed` (409), `no_sources` (422), `content_restricted` (403), `provider_unavailable` (503, degrade), `budget_exceeded` (503, ops). All map to graceful UI states — none affect the reader.

## Rate limiting & abuse
- Cheap/sync routes: existing throttler (120/60s).
- AI routes: per-user fair-use counters (Redis) + global budget guard; bot/scrape protection + oversized-prompt rejection ([14](14-security-and-copyright.md)).
