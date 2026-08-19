# NEM-005A — Semantic Retrieval Store Decision

| | |
|---|---|
| **Status** | COMPLETE |
| **Authorization** | Documentation |
| **Commits** | `9e682fb` *docs: record pgvector semantic retrieval decision* |
| **Produced** | PO-004 · [ADR-004](../../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md) |

## Scope
Decide the authoritative semantic vector store: **PostgreSQL + pgvector**, with
Meilisearch remaining lexical. Standalone vector databases rejected for the MVP on
operational-complexity grounds.

## Durable constraints established
Semantic chunks stay separate from Escucha Activa sync phrases · exact search before
approximate indexing · a mandatory Semantic Retrieval Interface so pgvector is an
implementation rather than a dependency.

## Related
Validated in staging by NEM-006A · production compatibility proof deferred to NEM-006B
