# NOF-003 — Backup, Restore & Disaster Recovery Framework

| | |
|---|---|
| **Status** | COMPLETE (documentation) — awaiting Product Architecture review |
| **Series** | NOF — Operating Framework |
| **Authorization** | DOCUMENTATION ONLY — no implementation, no production access |
| **Branch** | `nof-003-resilience` (from `nem-007-creator-rights`; not merged) |
| **Produced** | [`docs/operating-framework/resilience/`](../../operating-framework/resilience/README.md) — 13 documents |

## Scope
Discovery, risk analysis, policy design and implementation planning for Noetia's backup,
restore and disaster-recovery posture. No backup job, cron, storage, encryption or restore was
created or executed; production was not accessed.

## Posture found
**Level 0 — partially protected, entirely unverified.** A PostgreSQL backup script exists and
is undocumented; nothing else is protected at all.

## Findings
- Backups never leave the failure domain they insure against (same VPS).
- `.env.production`/`.env.staging` are **not gitignored**, inside a git checkout, while
  `CLAUDE.md` tells operators to verify via `.gitignore`.
- `incident-response.md` documents a backup path and retention that both disagree with the
  actual script (C-DR-01).
- MinIO — ~13 GB audio plus irreplaceable creator uploads — has no backup.
- `init.sh` opens UFW 22 while SSH runs on 222: a clean rebuild locks the operator out.
- Corrects a NOF-001 finding that claimed no backup schedule existed anywhere.

## Registered
IG-DR-01 … IG-DR-12 (6 CRITICAL, 4 HIGH, 2 MEDIUM) · C-DR-01 · Q-DR-01 … Q-DR-05.

## Recommends
**NEM-009 — Backup, Restore & Disaster Recovery Implementation**, scoped to Level 1 first.
