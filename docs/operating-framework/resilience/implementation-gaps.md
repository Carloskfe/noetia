# Implementation Gaps — Resilience

**NOF-003**, updated by **NEM-009**. A gap closes only when the protection is implemented
**and verified** — documentation alone never closes one.

**Status after NEM-009 zero-cost continuation:** 2 RESOLVED · 3 PROCEDURE READY ·
5 MITIGATED-PENDING-OPERATOR · 2 OPEN — ZERO-COST CONSTRAINT.

Under [PO-020](../decisions/product-owner/PO-020-zero-cost-resilience-constraint.md), a gap
that $0 cannot close stays **OPEN**. No gap here was reclassified to make the mission look
finished, and **no provider/account-loss protection is marked resolved, because no independent
copy exists yet.**

| ID | Gap | Severity | Owner |
|---|---|---|---|
| **IG-DR-01** | Backup execution unverified | **OPEN** — tooling + cron spec + `check-backups.sh` delivered; **requires operator to install cron and confirm** (EXTERNAL-ACTIONS §1–2) | Operations |
| **IG-DR-02** | Secret files not gitignored | ✅ **RESOLVED** — `.gitignore` now `.env.*` with `!*.example`; verified by `git check-ignore` for `.env.production`, `.env.staging`, `.env`. Git history confirmed clean — **no credential rotation required** | Engineering |
| **IG-DR-03** | No MinIO backup | **OPEN** — `backup-minio.sh` delivered (sequential per NEM-006C; irreplaceable classes only per PO-016); **needs off-site destination** | Engineering |
| **IG-DR-04** | No off-site copy | **MITIGATED — PENDING OPERATOR.** A $0 independent path now exists end to end: encrypt on the server with a public key, PULL ciphertext to PO-controlled storage (`backup-pull.sh`). **Still the highest remaining risk** until §A4–A6 are run — no copy exists today | Operations |
| **IG-DR-05** | No secret backup | **MITIGATED — PENDING OPERATOR.** $0 path: age-encrypt `.env.production` and keep it with the private key in an existing password manager (§B4). No vault purchase | Operations |
| **IG-DR-06** | No restore procedure; never tested | ✅ **RESOLVED (tooling)** — `restore-db.sh` written **and executed**: isolated restore validated 67 migrations, 16 users, 48 ownership rows, 0 orphans; production-name guard verified. **Still to do: run it against a real production dump** | Engineering |
| **IG-DR-07** | No backup monitoring | **MITIGATED — PENDING OPERATOR.** `check-backups.sh` now emits Prometheus textfile metrics for the node-exporter **already deployed** — zero new services. Needs cron + one additive flag (§A7, §B1) | Operations |
| **IG-DR-08** | No Stripe reconciliation procedure | ✅ **RESOLVED (procedure)** — [stripe-reconciliation.md](stripe-reconciliation.md); no correction authorized. `ACCOUNTING REVIEW REQUIRED` stands |
| **IG-DR-09** | `init.sh` reconstruction defects | ✅ **RESOLVED** — `init.sh` now configures sshd Port 222, validates with `sshd -t`, opens UFW 222 **before** restarting sshd, and requires a proven second session (PO-019). Backup cron documented in EXTERNAL-ACTIONS §2 | Operations |
| **IG-DR-10** | Single Git remote | **OPEN** — free mirrors exist (§B2); deliberately not a blocker for database protection | Engineering |
| **IG-DR-11** | **No data retention/deletion policy**, so backup retention cannot be reconciled with erasure | MEDIUM | Product + `PRIVACY/LEGAL REVIEW` |
| **IG-DR-12** | Backups unencrypted | **MITIGATED — PENDING OPERATOR.** age encryption with the **private key never on the server**, so host compromise yields no ability to read historical backups. Needs key generation (§A4) |

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

## Not achievable at $0 — recorded, not hidden

| Gap | Why $0 cannot close it | Status |
|---|---|---|
| **Continuous independent RPO** | Requires an always-on external endpoint; the pull model depends on the operator running it | `OPEN — ZERO-COST CONSTRAINT` |
| **Immutable / object-locked backups** | Requires a provider offering object lock (DR-13) | `OPEN — ZERO-COST CONSTRAINT` |

Both are closed by ~$1–5/month of object storage, deferred under PO-020 and listed in
EXTERNAL-ACTIONS §C.

## Product Owner questions

**Q-DR-01 · P1** — What is acceptable data loss for ownership and token history? NOF-003
recommends ≤1 hour; today's exposure is ~24 hours on the same server.

**Q-DR-02 · P1** — What is acceptable downtime? NOF-003 recommends ≤4 h for reader and auth,
≤24 h for Escucha Activa.

**Q-DR-03 · P2** — Should the ~13 GB of public-domain audio be replicated off-site, or is
documented re-ingestion acceptable? Materially affects storage cost and RTO.

**Q-DR-04 · P2** — Is long-term (multi-year) retention required for creator-obligation
reconstruction? Interacts with PO-008 and with erasure obligations.

**Q-DR-05 · RESOLVED — [PO-018](../decisions/product-owner/PO-018-disaster-declaration-authority.md).**
The Product Owner declares; operators may contain non-destructively; restoration requires
authorization.

**Q-DR-01/02 · RESOLVED — [PO-014](../decisions/product-owner/PO-014-recovery-point-objectives.md) /
[PO-015](../decisions/product-owner/PO-015-recovery-time-objectives.md).**

**Q-DR-03 · RESOLVED — [PO-016](../decisions/product-owner/PO-016-reconstructable-content.md).**
Public-domain audio is not replicated; a manifest covers it.

**Q-DR-04 · OPEN — [PO-017](../decisions/product-owner/PO-017-financial-retention.md)** defers
long-term financial retention to `ACCOUNTING / LEGAL REVIEW`.
