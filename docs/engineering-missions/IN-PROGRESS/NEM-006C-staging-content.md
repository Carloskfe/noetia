# NEM-006C — Full-Catalog Reader-Validatable Staging Content

| | |
|---|---|
| **Status** | **IN PROGRESS** |
| **Authorization** | LIMITED IMPLEMENTATION · staging only · production read-only where explicitly permitted |
| **Branch** | `nem-006c-staging-content` (not merged) |
| **Commits** | `b16aec7` implementation · `b39fd7f` MinIO addressing fix · `ccccf25` mirror diagnostics · `4f8907c` staging MinIO OOM fix |
| **Produced** | `scripts/seed-staging-content.sh` · `staging-content.service.ts` · `stage-content.ts` · [`docs/staging/content-seeding.md`](../../staging/content-seeding.md) |

## Scope
Make staging capable of exercising Escucha Activa across the full eligible catalog: mirror
public-domain audio read-only from production, reconstruct sync maps from the committed VTT
corpus, and produce a per-title reconciliation report. **Whisper is never re-run.**

## Progress
- Dry run: **83 of 85 titles resolved a transcript**; `The Call of the Wild` has no
  committed VTT; `Magnifica Humanitas` excluded as rights-pending.
- Audio mirror: in progress. Two failures diagnosed and fixed — `mc` rejected the staging
  hostname (underscore in the compose project name), then staging MinIO was OOM-killed by
  a 192 MB limit set in NEM-006A.

## Target
Parity with production's **66 of 84** titles passing the ≥90% sync quality gate. Titles
below the gate are reported as `SYNC_BELOW_GATE`, not hidden — the mission exposes catalog
debt rather than concealing it.

## Isolation
Production is a read source only. The seeder fails closed unless `APP_ENV`, `DB_NAME`, and
`MINIO_PUBLIC_URL` independently confirm staging.
