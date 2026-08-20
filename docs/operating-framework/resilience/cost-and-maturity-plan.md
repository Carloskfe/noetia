# Cost & Maturity Plan

**NOF-003** · Staged resilience. Costs are estimates from **known** data volumes; anything
unmeasured is marked and requires operator commands.

## Known versus unknown

| Quantity | Value | Source |
|---|---|---|
| MinIO `audio/` | **13 GB** | measured (NEM-006C) |
| MinIO `books/` | **24 MB** | measured |
| MinIO `images/` | `NEEDS OPERATOR` | not measured |
| PostgreSQL size | `NEEDS OPERATOR` | 84 books, 16 users, 67 migrations — small, likely <500 MB |
| VTT corpus | 66.5 MB, 1,743 files | measured, in Git |
| Host disk free | 208 GB of 387 GB | measured |
| Compressed dump size | `NEEDS OPERATOR` | `ls -la /opt/backups/postgres/` |

Commands are in [state-inventory.md](state-inventory.md). **Volumes were not invented.**

## Maturity levels

### Level 0 — where Noetia is
PostgreSQL dumps on the production host. No off-site copy, no encryption, no monitoring, no
restore test, no MinIO backup, no secret backup. **Survives container and volume loss; does
not survive the server.**

### Level 1 — Minimum Safe · *recommended immediately*
- Fix `.gitignore` for `.env.production`/`.env.staging` — **near-zero cost** (IG-DR-02)
- Verify the backup cron exists and runs; reconcile the path contradiction (IG-DR-01, C-DR-01)
- Push encrypted dumps **off-site** (IG-DR-04)
- Back up irreplaceable MinIO prefixes off-site (IG-DR-03)
- Store secrets in an off-server vault (IG-DR-05)
- Document a restore procedure (IG-DR-06)

**Estimated storage: ~15–20 GB off-site.** At commodity object-storage rates (~$0.005–0.02/GB/mo)
that is roughly **$1–5/month**, plus egress only when restoring. The dominant cost is
engineering time, not storage.

### Level 2 — Verified Recovery · *before commercial launch*
Monitoring and alerting on backup age and failure (IG-DR-07) · monthly restore smoke test ·
quarterly full rehearsal with measured RTO · agreed RPO/RTO · corrected `init.sh` (IG-DR-09) ·
Git mirror (IG-DR-10). **Cost: Level 1 storage plus engineering time.**

### Level 3 — Financial-Grade · *when creator obligations exist (NEM-008)*
PITR/WAL archiving for Tier 0 · immutable/object-locked recovery points · Stripe reconciliation
procedure (IG-DR-08) · longer retention for financial reconstruction. Justified by PO-008:
once obligations accrue, ledger loss is a financial liability, not an inconvenience.

### Level 4 — High Availability
**Not recommended.** Multi-region active-active is architecture inflation at 16 users. A small
product can have excellent recoverability without it — **recoverability and availability are
different problems**, and Noetia should buy the first well before considering the second.

## Recommended sequence

Level 1 now — it is cheap, and it converts "total loss on server failure" into "recoverable."
Level 2 before commercial launch, because unverified recovery is indistinguishable from no
recovery until tested. Level 3 when NEM-008 makes the ledger financially material. Level 4 on
evidence of need, not ambition.

The single highest-value item is not the most expensive: **`.gitignore` is one line** and
currently exposes every production secret to an accidental `git add .`.
