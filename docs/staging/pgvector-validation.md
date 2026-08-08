# pgvector Staging Validation (B1 evidence)

NEM-006 was blocked (B1) because pgvector could not be safely validated against production first. This records the evidence that the ADR-004 architecture is compatible, produced in a **fully isolated** container (no production or dev data touched) during NEM-006A.

## Environment (production reference)
- Production PostgreSQL: **`postgres:16-alpine`**, running **PostgreSQL 16.13** (verified). Does **not** ship the `vector` extension.
- Production DB is **UNCHANGED** by NEM-006A. No image change, no `CREATE EXTENSION`, no schema.

## Validation (isolated `pgvector/pgvector:pg16` container)
Command: a throwaway `docker run --rm` container (no volume, removed after), separate from the prod/dev stacks.

| Check | Result |
|-------|--------|
| Image | `pgvector/pgvector:pg16` |
| PostgreSQL version | **16.14** (Debian) — same MAJOR version as production (16) |
| `vector` extension available | **yes — version 0.8.6** (`pg_available_extensions`) |
| `CREATE EXTENSION vector` | **success** (`pg_extension` shows `vector | 0.8.6`) |
| `vector(768)` column | **created** (768 = PO-005 `gemini-embedding-001` dimension) |
| Exact NN search (`ORDER BY e <-> $q LIMIT 1`) | **success** (exact L2 distance, no ANN index — per ADR-004 §17) |

**Conclusion:** the approved semantic-retrieval stack (PG16 + pgvector, exact search, 768-dim embeddings) works on a PG16 image and is architecturally compatible with production's major version. The staging DB uses `pgvector/pgvector:pg16` so future missions can validate the real migration + schema safely.

## What is NOT yet proven (deferred, needs Product Owner action)
**Production-volume / restore compatibility.** Production data was `initdb`'d by the **alpine** PG16.13 image; staging uses the **Debian** PG16.14 image. PostgreSQL data directories are compatible **within the same major version (16)**, so a production `pg_dump`/restore into staging is expected to work — but this must be *demonstrated* before any production pgvector path:

### Restore-compatibility test (run on staging, sanitized data only)
```bash
# 1. Take a production backup per existing safety procedures (snapshot + pg_dump).
# 2. SANITIZE it (see data-and-sanitization.md) — never load raw prod PII into staging.
# 3. Restore into the staging pgvector DB:
cat sanitized_prod_dump.sql | \
  docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml \
    exec -T db psql -U noetia -d noetia_staging
# 4. Run the full migration suite (rehearsal):
docker compose -p noetia_staging ... exec -T -e DB_HOST=db api npm run migration:run:prod
# 5. Then (future mission) test the additive `CREATE EXTENSION vector` migration + semantic schema.
```
A **schema-only** dump (`pg_dump --schema-only`) is sufficient to prove structural restore compatibility without any user data.

## Production path (future — NOT authorized here)
Enabling pgvector in **production** (resumed NEM-006 / NEM-006B) will require, per NEM-006 §6 and ADR-004:
- Contabo snapshot verified (Product Owner);
- swap the production DB image to a pgvector-enabled PG16 image, validated first on staging against a restored copy of the production volume;
- an **additive** `CREATE EXTENSION IF NOT EXISTS vector` migration (never editing a deployed migration);
- confirmation that existing tables/data mount intact in the new image;
- documented rollback.

None of the above is performed or authorized by NEM-006A.
