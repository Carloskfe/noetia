# NEM-009 — Backup, Restore & Disaster Recovery Implementation (Level 1)

| | |
|---|---|
| **Status** | **PARTIAL** — repository-side complete; activation blocked on external actions |
| **Source framework** | NOF-003 |
| **Branch** | `nem-009-resilience-impl` (not merged) |
| **Produced** | PO-014…PO-019 · 4 new scripts · corrected `init.sh`, `backup-db.sh`, `.gitignore` · DR runbook · EXTERNAL-ACTIONS |

## Delivered
`.gitignore` secret protection (verified) · `init.sh` SSH 222 + safe ordering (PO-019) ·
custom-format verified backups · off-site encryption tooling (inert until configured) ·
MinIO backup for irreplaceable classes · backup health monitoring · **isolated restore
executed and validated** · DR runbook · secret recovery · Stripe reconciliation.

## Zero-cost continuation (PO-020)
Constraint: **$0.00/month**. Delivered a genuinely independent $0 path — encrypt on the server
with a public key, **pull** ciphertext to Product-Owner-controlled storage (`backup-pull.sh`),
private key never on the server. Pull beats push: production holds no credential able to delete
the external copies. Monitoring reuses the deployed node-exporter. RPO is now reported as two
numbers, local and independent, because one would overstate protection.

Not achievable at $0 and left **OPEN**: continuous independent RPO, and immutable/object-locked
backups. Both cost ~$1–5/month and are deferred, not hidden.

## Not delivered — requires operator/Product Owner
Cron installation · encryption key generation · **the first pull (no independent copy exists
yet)** · secrets stored off-server · Git mirror · restore against a real production dump.

**Until the off-site destination exists, backups remain on the production host and DR-07/08/13
are unmitigated.**

## Notable
A bug was found by testing rather than review: `pg_restore -j` cannot read stdin, so the
original restore path would have failed during a real disaster. Fixed and re-verified.
