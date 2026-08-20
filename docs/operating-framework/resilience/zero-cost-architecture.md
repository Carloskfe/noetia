# Zero-Cost Resilience Architecture

**NEM-009 (zero-cost continuation)** · Governed by [PO-020](../decisions/product-owner/PO-020-zero-cost-resilience-constraint.md).

> Maximum truthful resilience at **$0.00/month**. Where $0 cannot buy real protection, the
> gap stays **OPEN** rather than being reclassified.

## Failure-domain honesty

| Copy | Domain | Survives volume loss | Survives VPS loss | Survives Contabo account loss | Cost |
|---|---|---|---|---|---|
| `/opt/backups/postgres` | same filesystem | ✓ | ✗ | ✗ | $0 |
| Contabo snapshot (3 slots included) | same provider | ✓ | ✓ | **✗** | $0 |
| **Encrypted copy pulled to PO workstation** | **independent** | ✓ | **✓** | **✓** | **$0** |
| GitHub (source/VTT only — **never data**) | independent | ✓ | ✓ | ✓ | $0 |
| Paid object storage | independent | ✓ | ✓ | ✓ | ~$1–5/mo — **deferred** |

**Only one $0 option genuinely survives account loss: a copy on Product-Owner-controlled
hardware.** Contabo snapshots are a real and useful layer, but they are *same-provider* and
must never be labelled off-site.

## The chosen model: PULL, not push

```
production                              PO workstation (or any PO-controlled machine)
──────────                              ────────────────────────────────────────────
backup-db.sh        (hourly/daily)
    ↓ verified custom-format dump
backup-offsite.sh   encrypt with age  →  /opt/backups/postgres/encrypted/*.age
                                            ↑
                              backup-pull.sh  ── rsync over SSH:222 ──┘
                                            ↓
                                    ~/noetia-backups/postgres/*.age
                                    (age PRIVATE key lives here only)
```

**Why pull beats push, beyond cost.** A push model requires production to hold credentials
that can write — and usually delete — the external copies. An attacker with the host then
destroys production *and* its backups in one action (DR-13). Pulling inverts the trust:
production holds no credential for the workstation and cannot reach those files at all.

`rsync --ignore-existing` adds a second property: a compromised production host cannot
overwrite good local recovery points with poisoned ones.

**Encryption before departure.** Ciphertext is produced on the server with a *public* key; the
**private key never touches the server**. Production therefore cannot read its own historical
backups — so host compromise is not automatically data disclosure.

## Two RPOs, always reported separately

Because the workstation is not online continuously, one number would be a lie:

| | Meaning | Target |
|---|---|---|
| **Local RPO** | Loss while the VPS is alive | ≤ 1 h (hourly Tier-0 dumps) |
| **Independent RPO** | Loss if the VPS or account disappears | = time since the last successful pull |

`backup-pull.sh --status` reports the independent figure and prints **`UNBOUNDED`** in red when
no external copy exists. `check-backups.sh` exports it as
`noetia_backup_offsite_age_hours`, using `-1` for "none exists" so a missing copy can never be
mistaken for a fresh one.

A 14-point encrypted spool is retained on the server, so a workstation offline for up to two
weeks still catches up without gaps.

## MinIO at $0

Do **not** copy the ~13 GB of public-domain audio. Under
[PO-016](../decisions/product-owner/PO-016-reconstructable-content.md) it is reconstructable
and covered by a manifest instead.

Protect only the **irreplaceable** set — author-uploaded masters and user-generated images.
**That set is probably near-zero today**: every one of the 84 catalogue titles was ingested
(`uploadedById IS NULL`), and user background uploads may not exist yet. That is precisely why
protecting it now is free and why it stops being free later. Exact size:
EXTERNAL-ACTIONS §A3.

## Monitoring at $0

`check-backups.sh` writes Prometheus textfile metrics consumed by the **node-exporter already
deployed**. No new service, no new cost — one additive flag on an existing container.

```
noetia_backup_age_hours            age of newest local backup
noetia_backup_size_bytes           size (shrink = possible truncation)
noetia_backup_count                recovery points on disk
noetia_backup_offsite_age_hours    independent RPO; -1 = none exists
```

The alert that matters most is `noetia_backup_offsite_age_hours == -1`: it means every backup
still shares a disk with production.

## Secrets at $0

No vault purchase. `.env.production` is age-encrypted with the same public key and stored on
PO-controlled storage, alongside the private key in an existing password manager. Recovery is
a documented procedure ([secret-recovery.md](secret-recovery.md)); **the age private key is the
one credential that cannot be reissued from any provider console.**

## What $0 cannot buy — stated plainly

| Capability | Why not free | Status |
|---|---|---|
| **Continuous independent RPO** | Needs an always-on external endpoint | `OPEN — ZERO-COST CONSTRAINT` |
| **Immutable / object-locked backups** | Needs a provider with object lock | `OPEN — ZERO-COST CONSTRAINT` |
| **Automated geographic redundancy** | Needs paid storage | Deferred |
| **PITR / WAL archiving** | Level 2; also needs durable WAL storage | Out of scope |

Achievable at $0: **loss of the VPS or the Contabo account becomes survivable**, provided the
operator runs the pull regularly. That is the single largest improvement available, and it
costs nothing but discipline.
