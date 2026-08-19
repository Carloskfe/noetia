# Documentation Inventory

**v0.1** · NOF-001 · 96 markdown documents across `docs/`, classified by authority and
mapped to a canonical destination in the Operating Framework.

**Nothing is deleted or moved by NOF-001.** "Canonical destination" means *which framework
document should carry the durable statement*; the source file remains where it is.

Classification: **CURRENT** (accurate today) · **REFERENCE** (detailed procedure the
framework should link, not absorb) · **HISTORICAL** (accurate when written; superseded in
part) · **SUPERSEDED** (replaced).

---

## Level 1–3 — Decisions and architecture (highest authority)

| Document | Purpose | Status | Canonical destination |
|---|---|---|---|
| `noetia-plus/PRODUCT-DECISIONS.md` | PO-001…PO-004, the only formal PO decision record | CURRENT | 08-ai-governance · 15-decision-registry |
| `architecture/adr/ADR-001…004` | Provider abstraction · permission-aware content · source-aware hybrid · pgvector | CURRENT | 08-ai-governance · 09-architecture |
| `architecture/adr/README.md` | ADR index and process | CURRENT | 10-engineering-operating-model |
| `engineering-missions/README.md` | Mission governance, bounded authorization, stop conditions | CURRENT | 10-engineering-operating-model |
| `engineering-missions/DEFINITION-OF-DONE.md` | Completion bar for missions | CURRENT | 10-engineering-operating-model |
| `engineering-missions/REVIEW-CHECKLIST.md` | Product Architecture review checklist | CURRENT | 10-engineering-operating-model |
| `engineering-missions/MISSION-TEMPLATE.md` | Mission authoring template | CURRENT | 10-engineering-operating-model |

> **Gap:** `APPROVED/`, `IN-PROGRESS/`, `COMPLETED/` are empty. No mission is filed. → C-05

---

## Level 5 — Product and business documentation

| Document | Purpose | Status | Canonical destination |
|---|---|---|---|
| `PRD.md` | Product vision, features, pricing table, roadmap | CURRENT (conflicts) | 00-charter · 03-product · 04-business |
| `TASKS.md` (853 ln) | Sprint tracker and backlog | CURRENT | 13-roadmap (link only) |
| `business/en/01-business-plan.md` | Business model, pricing, revenue split, market | CURRENT (conflicts) | 04-business · 05-economic · 07-creator |
| `business/en/02-pm-documentation.md` | Project management approach | HISTORICAL | 10-engineering-operating-model |
| `business/en/03-technical-architecture.md` | Architecture narrative | HISTORICAL — superseded by technical-baseline | 09-architecture (link) |
| `business/en/04-development-process.md` | Development process | HISTORICAL — predates mission governance | 10-engineering-operating-model |
| `business/en/05-market-intelligence-appendix.md` | Market data and sources | REFERENCE | 01-strategic-direction |
| `business/es/01…05` | Spanish mirrors of the above | CURRENT | same as English counterparts |

> **Note:** the ES and EN business plans agree with each other and disagree with `PRD.md`
> on annual pricing and Family seats. → C-01, C-02

---

## Noetia+ design corpus (25 documents)

Produced by NEM-003; the most complete design set in the repository.

| Document(s) | Purpose | Status | Canonical destination |
|---|---|---|---|
| `README.md`, `EXECUTIVE_SUMMARY.md` | Scope and summary of the Noetia+ design | CURRENT | 03-product · 08-ai-governance |
| `01-product-scope.md` … `03-bounded-context-design.md` | Product scope, integration surface, bounded contexts | CURRENT (design) | 03-product · 09-architecture |
| `04-rag-and-retrieval.md`, `05-content-permissions.md` | Retrieval and permission-aware access | CURRENT (design) | 08-ai-governance |
| `06-ai-provider-architecture.md`, `07-cost-and-usage-model.md` | Provider abstraction, COGS model | CURRENT (design) | 08-ai-governance · 05-economic |
| `08-entitlements-and-subscription.md` | Noetia+ entitlement model | CURRENT (design) | 04-business · 06-user-rights |
| `09-data-model.md` … `13-memory-and-knowledge-assets.md` | Data, API, jobs, search, memory engine | CURRENT (design) | 09-architecture |
| `14-security-and-copyright.md`, `15-privacy.md` | Copyright protection, privacy | CURRENT (design) | 12-security-privacy · 07-creator |
| `16-observability.md` … `18-feature-flags-rollout.md` | Observability, UX architecture, rollout | CURRENT (design) | 09-architecture · 11-operations |
| `19-release-roadmap.md`, `22-implementation-epics.md` | Sequencing and epics | CURRENT (design) | 13-roadmap |
| `20-open-product-decisions.md` | Explicitly unresolved product decisions | CURRENT | governance/product-owner-questions |
| `21-risk-register.md` | Noetia+ risk register | CURRENT | governance/contradictions-and-gaps |

> All Noetia+ documents describe a **designed, not implemented** system. The framework
> must label them `PLANNED`, never `IMPLEMENTED`.

---

## Technical baseline (23 documents)

The repository's most epistemically careful corpus — already marks
`CONFIRMED` / `INFERRED` / `UNKNOWN`. The framework adopts that convention.

| Document(s) | Purpose | Status | Canonical destination |
|---|---|---|---|
| `README.md`, `EXECUTIVE_SUMMARY.md` | Baseline index and summary | CURRENT | 09-architecture |
| `01-repository.md` … `05-api.md` | Repo, architecture, domain model, DB, API | CURRENT | 09-architecture |
| `06-reader.md` | Reader and Escucha Activa | CURRENT | 02-principles · 03-product |
| `07-authentication.md`, `16-security.md` | AuthN/AuthZ, security posture | CURRENT | 12-security-privacy |
| `08-subscriptions.md`, `09-token-economy.md` | Subscriptions, token ledger, redemption | CURRENT | 04-business · 05-economic · 06-user-rights |
| `10-search.md`, `11-storage.md` | Meilisearch, MinIO | CURRENT | 09-architecture |
| `12-author-system.md` | Author/publisher system | CURRENT | 07-creator |
| `13-admin-system.md`, `15-analytics.md` | Admin, events, personas | CURRENT | 03-product · 12-security-privacy |
| `14-mobile.md` | Mobile app | CURRENT | 03-product · 09-architecture |
| `17-observability.md`, `18-testing.md` | Monitoring, test strategy | CURRENT | 09-architecture · 10-engineering |
| `19-technical-debt.md` | Prioritized debt — **records the missing payout engine** | CURRENT | governance/contradictions-and-gaps |
| `20-opportunities.md`, `21-noetia-plus-readiness.md` | Opportunities, Noetia+ readiness | CURRENT | 13-roadmap |

---

## Operations and safety (REFERENCE — link, do not absorb)

| Document | Purpose | Canonical destination |
|---|---|---|
| `production-safety/README.md` + `01…06` | NEM-002 production safety findings and remediation | 11-operations · 12-security-privacy |
| `staging/README.md`, `RUNBOOK.md`, `EXTERNAL-ACTIONS.md` | Staging architecture and operations | 11-operations |
| `staging/data-and-sanitization.md` | No production PII in staging | 12-security-privacy |
| `staging/pgvector-validation.md`, `promotion-checklist.md` | pgvector evidence, promotion gate | 09-architecture · 10-engineering |
| `incident-response.md` | Traefik, container, DB, MinIO playbooks | 11-operations |
| `database-migrations.md` | Migration history and golden rules | 09-architecture · 11-operations |
| `secrets-rotation.md` | Secret rotation policy | 12-security-privacy |
| `grafana-monitoring.md` | Monitoring and access | 11-operations |
| `stripe-setup.md` | Stripe products and webhooks | 04-business · 11-operations |
| `sync-procedures.md`, `whisper-sync-troubleshooting.md` (1188 ln) | Whisper pipeline and diagnosis | 11-operations |
| `persona-pipeline.md` | Events → themes → personas | 03-product · 12-security-privacy |
| `upload-guide.md` | Author file specifications | 07-creator |
| `eas-build.md`, `app-store-submission.md` | Mobile build and submission | 11-operations |
| `store-listings/apple-app-privacy.md`, `google-play-data-safety.md` | Store privacy declarations | 12-security-privacy |

> `whisper-sync-troubleshooting.md` is explicitly a living document (CLAUDE.md) —
> the framework links it and must never absorb or freeze it.

---

## Findings

1. **Charter-level intent exists but is scattered and thin.** `PRD.md` states a vision
   ("knowledge is not only consumed but expressed") and one strong anti-goal ("Noetia is
   not a content publisher — the catalog is built by authors, publishers and companies"),
   and `CLAUDE.md` states the reader-first product hierarchy. What is missing is the
   *human problem* Noetia addresses and the commitments that should survive individual
   features → Q-09.
2. **Mission tier is unfiled** → C-05. Level 4 evidence is unavailable to the registry.
3. **Only one PO decision file exists**, covering Noetia+ (PO-001…004). Monetization,
   ownership, and token rules — the most consequential business decisions — have **no
   equivalent record**, living in the business plan and project memory instead.
4. **The business plan is doing three jobs**: strategy, pricing policy, and creator terms.
   Splitting those is why C-01 and C-04 went unnoticed.
5. **Duplication is low; contradiction is the real problem.** The corpus is not bloated —
   it disagrees with itself in a small number of high-consequence places.
6. **No document is recommended for deletion.** Four are HISTORICAL and should be labelled
   as such rather than removed.
