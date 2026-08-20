# Failure Model

**NOF-003** · Scenarios and, more importantly, the **failure domains** that determine whether
a copy survives.

## Failure domains

A copy protects only against failures inside a domain it does not share.

| Copy location | Survives app deletion | Survives volume loss | Survives server loss | Survives account loss | Survives ransomware |
|---|---|---|---|---|---|
| Same Docker volume | ✗ | ✗ | ✗ | ✗ | ✗ |
| **`/opt/backups/postgres` (current)** | ✓ | ✓ | **✗** | **✗** | **✗** |
| Contabo snapshot | ✓ | ✓ | ✓ | **✗** | ~ |
| **Independent off-site store** | ✓ | ✓ | ✓ | ✓ | ✓ *(if immutable)* |
| GitHub | ✓ | ✓ | ✓ | ✓ *(different account)* | ✓ |

**Noetia's only data backup shares a disk with production.** A Contabo snapshot is a
different domain from the volume but the same domain as the account — it is not an off-site
backup.

## Scenarios

| ID | Scenario | Current outcome |
|---|---|---|
| DR-01 | Container destroyed | **Recoverable** — `docker compose up -d`, volumes persist |
| DR-02 | Volume corrupted | Postgres: dump restores (untested). MinIO: **total content loss** |
| DR-03 | PostgreSQL logical corruption | Depends on when noticed; up to 24h loss, older dumps may already carry the corruption |
| DR-04 | `postgres_data` lost | Restore from latest dump — **up to 24h of ownership and token history lost, and the restore has never been tested** |
| DR-05 | `minio_data` lost | **Author uploads and user images gone permanently.** Public-domain content re-ingestable over hours/days |
| DR-06 | `/opt/noetia` deleted | Recoverable from Git — **except `.env.production`, which exists nowhere else** |
| DR-07 | **VPS destroyed** | **Catastrophic.** Backups die with it. Recovery limited to a Contabo snapshot, if one is recent |
| DR-08 | **Contabo account lost** | **Total loss.** No copy exists outside the account |
| DR-09 | Destructive deployment | `cd.yml` filters `name=noetia-`; volumes survive `up -d --build`. Moderate risk |
| DR-10 | Bad migration | Forward-only; corrective migration or restore. Snapshot advised pre-migration (already policy) |
| DR-11 | **Slow corruption before discovery** | **Worst case.** 7 daily + 4 weekly Sundays gives ~28 days of history; corruption older than that is in every copy |
| DR-12 | Credentials compromised | Secrets rotatable (`secrets-rotation.md`), but **`.env.production` is not gitignored**, widening exposure |
| DR-13 | **Ransomware with host access** | **Backups encrypted too** — same filesystem, no immutability |
| DR-14 | GitHub unavailable/compromised | Source recoverable from local clones; **VTT corpus at risk** without a mirror; `DEPLOY_SSH_KEY` compromise implies server access |
| DR-15 | Provider outage (Stripe/Resend/OAuth) | Degraded, not data loss |
| DR-16 | Stripe/local disagreement | Reconciliation required after any restore — no documented procedure |
| DR-17 | Operator error | The `nano`/multi-line-paste rule exists because this already caused a 2-hour outage |
| **DR-18** | **Backup silently not running** | **Unknown today.** Cron is not installed by `init.sh`; nothing alerts on absence |
| **DR-19** | **Rebuild locked out by firewall** | `init.sh` opens UFW 22; SSH runs on 222 → new host unreachable |

DR-18 and DR-19 were added from repository evidence and are not in the mission's original list.

## Ranked risk

1. **DR-07 / DR-08 — server or account loss.** The only backup dies with the server. Highest
   impact, no mitigation.
2. **DR-05 — MinIO loss.** 13 GB plus irreplaceable creator uploads, zero backup.
3. **DR-18 — silent backup failure.** Undetectable; converts every other scenario into total loss.
4. **DR-11 — slow corruption.** ~28-day horizon, no integrity checking.
5. **DR-13 — ransomware.** No immutability or off-host copy.
6. **DR-06/DR-12 — secret loss or exposure.** Not backed up; not gitignored.
7. **DR-19 — reconstruction lockout.** Turns a recoverable event into a prolonged one.
