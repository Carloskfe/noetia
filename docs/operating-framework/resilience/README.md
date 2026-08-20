# Resilience, Backup & Disaster Recovery

**NOF-003 · v0.1 · DISCOVERY AND POLICY DESIGN ONLY — nothing here is implemented.**

## Resilience principle

> **Backup without tested restoration is an unverified recovery assumption.**

Data is protected only when all seven hold: the copy exists · it is independent of
production's failure domain · integrity can be verified · retention is defined · access is
controlled · the restore procedure is documented · **restoration has actually been tested.**

Noetia currently satisfies **one to three** of these for PostgreSQL, and **none** for
everything else.

## Posture: **Level 0 → Level 1 in progress** (NEM-009)

**Repository-side complete.** Backup, off-site, MinIO, monitoring and restore tooling exist;
`.gitignore` and `init.sh` defects are fixed; an isolated restore has been **executed and
validated**. **Activation requires operator action** — see [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md).

Until §3–§6 of that document are done, **backups still live only on the production host.**

### Original NOF-003 assessment

A PostgreSQL backup script exists (`infra/server/backup-db.sh`) and is more than nothing.
It is also same-server only, PostgreSQL only, unencrypted, unmonitored, undocumented, and
has never been restore-tested. No object storage, secret, or infrastructure state is backed
up at all.

**A total server loss today would destroy every book, every audio file, every user upload,
and every production secret, and leave a PostgreSQL dump on the same lost disk.**

## Contents

| Document | Purpose |
|---|---|
| [state-inventory.md](state-inventory.md) | Every stateful system and where it actually lives |
| [data-criticality.md](data-criticality.md) | Irreplaceable vs reconstructable, with evidence |
| [failure-model.md](failure-model.md) | DR-01…DR-19 scenarios and failure domains |
| [rpo-rto.md](rpo-rto.md) | Recommended objectives by criticality tier |
| [backup-architecture.md](backup-architecture.md) | Recommended protection per system |
| [restore-strategy.md](restore-strategy.md) | Recovery order and dependencies |
| [disaster-recovery-runbook-design.md](disaster-recovery-runbook-design.md) | Runbook structure for an operator who is not the author |
| [backup-security.md](backup-security.md) | Encryption, credentials, immutability |
| [retention-policy.md](retention-policy.md) | Recommended schedules and privacy interaction |
| [restore-test-plan.md](restore-test-plan.md) | What a restore must prove |
| [cost-and-maturity-plan.md](cost-and-maturity-plan.md) | Staged levels with costs |
| [implementation-gaps.md](implementation-gaps.md) | IG-DR-01…IG-DR-12 with NEM-009 status |
| [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md) | **What the operator must do to activate protection** |
| [DR-RUNBOOK.md](DR-RUNBOOK.md) | Operational disaster recovery runbook |
| [secret-recovery.md](secret-recovery.md) | Credential recovery (names only) |
| [stripe-reconciliation.md](stripe-reconciliation.md) | Post-restore payment reconciliation |

## The five findings that matter most

1. **Backups never leave the failure domain.** `backup-db.sh` writes to `/opt/backups/postgres`
   on the same VPS whose loss is the scenario worth insuring against.
2. **`.env.production` is not gitignored** — and `/opt/noetia` is a git checkout containing it.
   `CLAUDE.md` tells operators to verify via `.gitignore`, which offers no such protection.
3. **The one document mentioning backups gives the wrong path and wrong retention.**
   `incident-response.md:126` says `/opt/noetia/backups/` with 7-day retention; the script uses
   `/opt/backups/postgres` with 7 daily + 4 weekly.
4. **MinIO is entirely unprotected** — ~13 GB of audio plus all user uploads and generated images.
5. **Rebuilding from `init.sh` would lock you out.** It opens UFW port 22; production SSH runs
   on 222.

## Scope

NOF-003 is documentation-only. No backup job, cron, storage, encryption, or restore was
created or executed. Production was not accessed. Commands requiring the server are listed
for operator execution in [state-inventory.md](state-inventory.md) and
[cost-and-maturity-plan.md](cost-and-maturity-plan.md).
