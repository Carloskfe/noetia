# Resilience — Required External Actions

**NEM-009** · Repository work is complete. These need operator or Product Owner access.
Governed by [PO-020](../decisions/product-owner/PO-020-zero-cost-resilience-constraint.md):
**nothing here costs money.**

**Never put secret values in Git, in a mission report, or in this file.**

> **Until §A4–A6 are done, every backup still lives on the production host, and loss of the
> VPS or the Contabo account remains unrecoverable.**

---

# A · REQUIRED NOW — $0.00

## A1 · Find out what is actually running

```bash
ls -la /opt/backups/postgres/ 2>/dev/null || echo "MISSING — backups have never run here"
crontab -l | grep -i backup   || echo "NO backup cron installed"
tail -20 /opt/backups/postgres/backup.log 2>/dev/null
```

Settles IG-DR-01. The scripts existing proves nothing about them running.

## A2 · Measure before scheduling hourly

```bash
cd /opt/noetia && git pull origin main     # once NEM-009 merges
/opt/noetia/infra/server/backup-db.sh --measure-only
```

Prints duration and size, keeping nothing. **If a dump takes more than a few seconds or visibly
loads the database, stop and report** — hourly logical dumps would then be the wrong tool and
Level 2/PITR is the answer, not a heavier schedule.

## A3 · Size the irreplaceable set

```bash
docker exec noetia-storage-1 du -sh /data/images 2>/dev/null
docker exec noetia-storage-1 du -sh /data/images/backgrounds/user 2>/dev/null || echo "no user uploads yet"
docker exec -i noetia-db-1 psql -U noetia -d noetia -tAc "SELECT COUNT(*) FROM books WHERE \"uploadedById\" IS NOT NULL;"
```

Expected today: **zero author uploads** (all 84 titles were ingested) and few or no user
backgrounds — so the irreplaceable set is likely tiny. That makes protecting it free now.

## A4 · Generate the encryption key — **on your own machine, never the server**

```bash
# ON YOUR WORKSTATION
sudo apt-get install -y age          # or: brew install age
age-keygen -o ~/noetia-backup-key.txt
```

- **Public key** (`age1…`) → the server.
- **Private key file** → your password manager / encrypted storage. **Never on the server, never in Git.**

This is the one credential no provider can reissue. Lose it and every encrypted backup becomes
permanently unreadable. Record *where it lives* in the DR runbook — never its value.

## A5 · Enable encryption on the server

```bash
sudo apt-get install -y age
sudo nano /opt/noetia/.env.backup      # nano — never paste multi-line into the shell
```

```
BACKUP_AGE_RECIPIENT=age1...          # PUBLIC key only
# BACKUP_REMOTE intentionally unset — zero-cost model is PULL, not push
```

```bash
sudo chmod 600 /opt/noetia/.env.backup
git -C /opt/noetia check-ignore -v .env.backup     # must match
/opt/noetia/infra/server/backup-offsite.sh --selftest
```

## A6 · Pull an independent copy — **the action that changes the risk profile**

```bash
# ON YOUR WORKSTATION
export NOETIA_SSH_HOST=<production-host>
/opt/noetia/infra/server/backup-pull.sh --status     # expect: UNBOUNDED
/opt/noetia/infra/server/backup-pull.sh
```

Roughly **1–2 GB** of workstation storage covers 30 encrypted recovery points at current
database size. Run it after each work session; a weekly cadence gives an independent RPO of
about 7 days, which is worlds better than unbounded.

## A7 · Install the schedule

```bash
crontab -e
```

```cron
# Noetia backups (NEM-009)
0  2 * * *  /opt/noetia/infra/server/backup-db.sh              >> /opt/backups/postgres/cron.log 2>&1
0  * * * *  /opt/noetia/infra/server/backup-db.sh --tier0      >> /opt/backups/postgres/cron.log 2>&1   # only after A2
30 3 * * *  /opt/noetia/infra/server/backup-minio.sh           >> /opt/backups/minio.log 2>&1
15 * * * *  /opt/noetia/infra/server/check-backups.sh --nagios >> /opt/backups/health.log 2>&1
```

Confirm it actually fired the next day — an installed cron is not a proven cron.

## A8 · First restore from a real backup

```bash
/opt/noetia/infra/server/restore-db.sh \
  --file /opt/backups/postgres/<newest>.dump \
  --project noetia_restore_test
```

Isolated container; touches no production service. Prints ownership and token integrity plus
**measured restore time — Noetia's first real recovery number.** Tear down with the command it
prints. Stronger still: decrypt a *pulled* copy on your workstation and restore that, which
proves the independent path end to end.

---

# B · OPTIONAL — $0.00

## B1 · Backup metrics in existing Grafana

One additive flag on the node-exporter already running (`docker-compose.server.yml`):

```yaml
      - '--collector.textfile.directory=/rootfs/opt/backups/metrics'
```

Then `docker compose ... up -d node-exporter`. Surfaces `noetia_backup_age_hours` and
`noetia_backup_offsite_age_hours` with no new service. **Alert on
`noetia_backup_offsite_age_hours == -1`** — it means no independent copy exists.

*NEM-009 did not modify production compose; this is deliberately yours to apply.*

## B2 · Second Git remote

Protects the 1,743-file VTT corpus if GitHub becomes unavailable (DR-14). Free tiers exist at
GitLab/Codeberg.

```bash
cd /opt/noetia && git remote add mirror <url> && git push --mirror mirror
```

**Confirm the mirror is private.** Never a blocker for database protection.

## B3 · Contabo snapshot before risky changes

3 slots already included. Useful, but **same provider** — it does not satisfy DR-08 and must
never be recorded as off-site.

## B4 · Store `.env.production` off-server

Age-encrypt with the A4 public key and keep it with the private key in your password manager.
Without it, a restore cannot start — the dump is inert without `DB_PASS`.

---

# C · DEFERRED — would require spend

**Not authorized under PO-020.** Listed so the gap is visible rather than forgotten.

| Item | ~Cost | Buys |
|---|---|---|
| Paid object storage (B2/R2/Wasabi) | $1–5/mo | Continuous independent RPO without manual pulls |
| Object lock / immutability | included above | Ransomware protection (DR-13) |
| Second VPS | $5–15/mo | Warm standby, lower RTO |
| Managed secret vault | $0–10/mo | Stronger secret custody |
| PITR / WAL archiving | storage | Tier-0 RPO ≤ 15 min |

The first row is the only one worth revisiting soon: ~$1–5/month removes the dependency on
someone remembering to run a pull.
