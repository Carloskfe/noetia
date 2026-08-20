# Implementation Gaps — Resilience

**NOF-003** · Registered so they cannot hide in prose. **None is resolved.**

| ID | Gap | Severity | Owner |
|---|---|---|---|
| **IG-DR-01** | **Backup execution unverified.** Cron is not installed by `init.sh` and nothing alerts on absence — whether any backup has ever run is unknown from the repository | **CRITICAL** | Operations |
| **IG-DR-02** | **`.env.production`/`.env.staging` not gitignored**, inside a git checkout, while `CLAUDE.md:499` tells operators to verify via `.gitignore` | **CRITICAL** | Engineering |
| **IG-DR-03** | **No MinIO backup.** ~13 GB audio plus irreplaceable author uploads and user images | **CRITICAL** | Engineering |
| **IG-DR-04** | **No off-site copy.** All backups share the failure domain they insure against (DR-07/08/13) | **CRITICAL** | Operations |
| **IG-DR-05** | **No secret backup.** `.env.production` exists only on the host; its loss blocks every restore | **CRITICAL** | Operations |
| **IG-DR-06** | **No restore procedure and no restore ever tested.** Recovery capability is unproven | **CRITICAL** | Engineering |
| **IG-DR-07** | **No backup monitoring** — silent failure is undetectable (DR-18) | HIGH | Operations |
| **IG-DR-08** | **No Stripe reconciliation procedure** after restore — users could be mis-entitled or mis-billed | HIGH | Engineering + `ACCOUNTING REVIEW` |
| **IG-DR-09** | **`init.sh` reconstruction defects** — opens UFW 22 while SSH runs on 222 (lockout); omits backup cron | HIGH | Operations |
| **IG-DR-10** | **Single Git remote.** VTT corpus and infra definitions have no mirror | MEDIUM | Engineering |
| **IG-DR-11** | **No data retention/deletion policy**, so backup retention cannot be reconciled with erasure | MEDIUM | Product + `PRIVACY/LEGAL REVIEW` |
| **IG-DR-12** | **Backups unencrypted** — full user dataset in plaintext on the host | HIGH | Engineering |

## Contradiction

**C-DR-01 · MEDIUM** — `incident-response.md:126` documents `/opt/noetia/backups/` with 7-day
retention; `infra/server/backup-db.sh` uses `/opt/backups/postgres` with 7 daily + 4 weekly.
**Both path and schedule disagree.** An operator following the documentation during an incident
would search an empty directory. Neither source is confirmed against the running server.

## Correction to an earlier NOF finding

NOF-001's operations pass reported that *"no routine production backup schedule, retention
policy, or verified restore drill is recorded anywhere in the corpus."*

That was **partly wrong** and is corrected here: `infra/server/backup-db.sh` exists and defines
both a schedule and a retention policy. It is undocumented, unreferenced by any framework
document, and contradicted by the one document that mentions backups — which is why it was
missed. The remainder of the finding stands: **no verified restore drill exists**, and the
backup does not leave the failure domain.

## Product Owner questions

**Q-DR-01 · P1** — What is acceptable data loss for ownership and token history? NOF-003
recommends ≤1 hour; today's exposure is ~24 hours on the same server.

**Q-DR-02 · P1** — What is acceptable downtime? NOF-003 recommends ≤4 h for reader and auth,
≤24 h for Escucha Activa.

**Q-DR-03 · P2** — Should the ~13 GB of public-domain audio be replicated off-site, or is
documented re-ingestion acceptable? Materially affects storage cost and RTO.

**Q-DR-04 · P2** — Is long-term (multi-year) retention required for creator-obligation
reconstruction? Interacts with PO-008 and with erasure obligations.

**Q-DR-05 · P1** — Who is authorized to declare a disaster and execute a destructive restore?
Undefined today.
