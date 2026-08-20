# Implementation Gaps — Resilience

**NOF-003**, updated by **NEM-009**. A gap closes only when the protection is implemented
**and verified** — documentation alone never closes one.

**Status after NEM-009:** 2 RESOLVED · 4 REPOSITORY-COMPLETE (blocked on an external action) ·
6 still open.

| ID | Gap | Severity | Owner |
|---|---|---|---|
| **IG-DR-01** | Backup execution unverified | **OPEN** — tooling + cron spec + `check-backups.sh` delivered; **requires operator to install cron and confirm** (EXTERNAL-ACTIONS §1–2) | Operations |
| **IG-DR-02** | Secret files not gitignored | ✅ **RESOLVED** — `.gitignore` now `.env.*` with `!*.example`; verified by `git check-ignore` for `.env.production`, `.env.staging`, `.env`. Git history confirmed clean — **no credential rotation required** | Engineering |
| **IG-DR-03** | No MinIO backup | **OPEN** — `backup-minio.sh` delivered (sequential per NEM-006C; irreplaceable classes only per PO-016); **needs off-site destination** | Engineering |
| **IG-DR-04** | No off-site copy | **OPEN — HIGHEST REMAINING RISK.** `backup-offsite.sh` delivered and inert until configured; **requires Product Owner to select and provision a destination** (EXTERNAL-ACTIONS §3–6) | Operations |
| **IG-DR-05** | No secret backup | **OPEN** — [secret-recovery.md](secret-recovery.md) delivered; **requires operator to store `.env.production` off-server** (EXTERNAL-ACTIONS §8) | Operations |
| **IG-DR-06** | No restore procedure; never tested | ✅ **RESOLVED (tooling)** — `restore-db.sh` written **and executed**: isolated restore validated 67 migrations, 16 users, 48 ownership rows, 0 orphans; production-name guard verified. **Still to do: run it against a real production dump** | Engineering |
| **IG-DR-07** | No backup monitoring | **OPEN** — `check-backups.sh` delivered (age, size-shrink, failure, off-site status); **needs cron + alert wiring** | Operations |
| **IG-DR-08** | No Stripe reconciliation procedure | ✅ **RESOLVED (procedure)** — [stripe-reconciliation.md](stripe-reconciliation.md); no correction authorized. `ACCOUNTING REVIEW REQUIRED` stands |
| **IG-DR-09** | `init.sh` reconstruction defects | ✅ **RESOLVED** — `init.sh` now configures sshd Port 222, validates with `sshd -t`, opens UFW 222 **before** restarting sshd, and requires a proven second session (PO-019). Backup cron documented in EXTERNAL-ACTIONS §2 | Operations |
| **IG-DR-10** | **Single Git remote.** VTT corpus and infra definitions have no mirror | MEDIUM | Engineering |
| **IG-DR-11** | **No data retention/deletion policy**, so backup retention cannot be reconciled with erasure | MEDIUM | Product + `PRIVACY/LEGAL REVIEW` |
| **IG-DR-12** | Backups unencrypted | **OPEN** — age encryption implemented in `backup-offsite.sh` with `--selftest`; **requires key generation off-server** (EXTERNAL-ACTIONS §5) |

## Contradiction

**C-DR-01 · RESOLVED (canonical path declared) — NEM-009.** The canonical backup location is
**`/opt/backups/postgres`**, asserted in `backup-db.sh` and used by every NEM-009 tool.
`incident-response.md` has been corrected. Historical wording is superseded, not rewritten
away. **Existing backups were not moved or deleted** — the operator confirms actual on-disk
state via EXTERNAL-ACTIONS §1.

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
