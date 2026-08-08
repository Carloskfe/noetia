# 21 — Risk Register

Severity = impact × likelihood for a production platform. Each: risk · impact · likelihood · mitigation (all mitigations are *designed*, not built).

## CRITICAL
| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| R1 | **AI COGS exceeds revenue** (heavy tail, context bloat, wrong tier) | margin loss; unsustainable at < $10 | Med | Model router (Cheap/Mid default), context caps, caching, fair-use hard caps, **global budget guard + kill switch**, live COGS/revenue telemetry & alert bands ([07](07-cost-and-usage-model.md), [16](16-observability.md)) |
| R2 | **Copyright extraction / rights breach** (whole-book reconstruction, licensed leakage, training on licensed content) | legal exposure; publisher trust | Med | Permission-aware retrieval, per-book AI perms, quotation policy, sequential-extraction detection, training-OFF default, full text never in context for non-owned ([05](05-content-permissions.md), [14](14-security-and-copyright.md)) |
| R3 | **Reader regression from Noetia+** (coupling, shared resource contention) | breaks the core product | Low (by design) | Hard architectural boundary: one-way dependency, async isolation, master kill switch, no reader-path AI calls, separate resource envelope ([03](03-bounded-context-design.md), [18](18-feature-flags-rollout.md)) |

## HIGH
| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| R4 | **User-to-user / Duo-Family data leakage** | severe privacy breach | Low-Med | Per-`userId` scoping everywhere, user-keyed caches, entitlement≠data-visibility, deletion cascades ([15](15-privacy.md)) |
| R5 | **Prompt injection via book/notes content** | manipulated answers, policy bypass | Med | Data-region isolation, system-prompt contract, no content-granted authority, per-user note scope ([14](14-security-and-copyright.md)) |
| R6 | **Hallucination / wrong citations** erodes trust | product credibility | Med | Grounded-only mode ([D3](20-open-product-decisions.md)), citations verified against chunks, "no sources" refusal, eval harness gate before GA |
| R7 | **Entitlement bypass** (owned≠subscription confusion, missing check) | revenue leakage / free access | Low-Med | Declarative `@RequiresCapability` + one guard (no scattered checks — NEM-002A lesson), central resolution ([08](08-entitlements-and-subscription.md)) |
| R8 | **Vendor lock-in / provider price shock** | strategic + cost risk | Med | Gateway + adapters + config routing; swappable provider/model ([06](06-ai-provider-architecture.md)) |

## MEDIUM
| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| R9 | **pgvector scale ceiling** (catalog-wide semantic growth) | retrieval latency | Low-Med | HNSW index, scoped queries (owned/one-book first); retrieval interface allows external vector swap if needed ([04](04-rag-and-retrieval.md)) |
| R10 | **Embedding backlog / infra pressure on small VPS** | delayed Ask availability | Med | Async, batched, concurrency-capped; graceful "not indexed yet"; staging validates load ([11](11-background-processing.md)) |
| R11 | **Multilingual quality** (ES/EN, cross-language) | poor Spanish-first UX | Med | One multilingual embedding model; eval sets for ES/EN + cross-language before GA ([04](04-rag-and-retrieval.md), eval) |
| R12 | **Storage growth** (conversations, usage events, embeddings) | DB size/backup cost | Med | Retention windows + rollups ([D11](20-open-product-decisions.md)); soft-delete purge jobs |
| R13 | **Cache leakage of private context** | privacy breach | Low | Strict user-keyed caches; book-level vs user-private separation ([15](15-privacy.md)) |
| R14 | **Cost/scrape abuse via AI endpoints** | cost + data exfil | Med | Fair-use, throttling, bot protection, oversized-prompt rejection, budget guard ([14](14-security-and-copyright.md)) |

## LOW
| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R15 | Feature-flag misconfig disables/enables wrongly | UX/cost blip | Deterministic resolution order, admin audit, cache invalidation ([18](18-feature-flags-rollout.md)) |
| R16 | Deep-link `?phrase=` param edge cases | citation opens wrong spot | Reuse existing `seekToPhrase` bounds; no-op when absent ([17](17-web-mobile-ux.md)) |
| R17 | Provider outage | Noetia+ unavailable | Degrade gracefully; reader unaffected; multi-provider option ([35 in 14/16]) |

## Residual risk after mitigation
Highest residual: **R1 (cost)** and **R2 (copyright)** — both are as much *product/legal policy* as engineering, hence the open decisions ([20](20-open-product-decisions.md)). Engineering can bound them technically (budget guard, permission architecture) but not *set the policy*.
