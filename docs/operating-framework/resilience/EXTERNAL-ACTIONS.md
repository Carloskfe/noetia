# Resilience — Required External Actions

**NEM-009** · Repository-side work is complete. The actions below need Product Owner or
operator access and **cannot** be performed from the repository. Until they are done, backups
remain **on the production host only** — the scenario worth insuring against (DR-07/08/13) is
still unmitigated.

**Never put secret values in Git, in a mission report, or in this file.**

---

## 1. Verify what is actually running · no cost

```bash
ls -la /opt/backups/postgres/ 2>/dev/null || echo "MISSING — backups have never run here"
ls -la /opt/noetia/backups/   2>/dev/null || echo "MISSING — the path named in incident-response.md"
crontab -l | grep -i backup   || echo "NO backup cron installed"
tail -20 /opt/backups/postgres/backup.log 2>/dev/null
```

Resolves IG-DR-01 and confirms which side of C-DR-01 reflects reality.

## 2. Install the schedule · no cost

```bash
cd /opt/noetia && git pull origin main   # once NEM-009 is merged
crontab -e
```

```cron
# Noetia backups (NEM-009)
0  2 * * *   /opt/noetia/infra/server/backup-db.sh        >> /opt/backups/postgres/cron.log 2>&1
0  * * * *   /opt/noetia/infra/server/backup-db.sh --tier0 >> /opt/backups/postgres/cron.log 2>&1
30 3 * * *   /opt/noetia/infra/server/backup-minio.sh      >> /opt/backups/minio.log 2>&1
15 * * * *   /opt/noetia/infra/server/check-backups.sh --nagios >> /opt/backups/health.log 2>&1
```

**Before enabling the hourly Tier-0 line**, measure impact (NEM-009 §7):

```bash
/opt/noetia/infra/server/backup-db.sh --measure-only
```

If a dump takes more than a few seconds or visibly loads the database, **stop** and report —
hourly logical dumps would be the wrong tool and Level 2 / PITR should be considered instead.

## 3. Choose an off-site destination · ~$1–5/month · **Product Owner decision**

Requirements — not a product recommendation:

- **outside the Contabo account** (that is the entire point);
- S3-compatible, so `rclone` works without custom code;
- supports **versioning or object lock** (ransomware, DR-13);
- supports **append-only / restricted credentials** so a host compromise cannot delete history;
- ~20 GB initially.

Candidates meeting these: Backblaze B2, Cloudflare R2, Wasabi, Hetzner Storage Box.

**STOP before provisioning anything paid.** The NEM-009 guardrail is **$10/month incremental**;
20 GB at commodity rates is roughly $0.10–$2/month, so this should sit far inside it.

## 4. Create the backup credential · least privilege

Create a credential that can **write and list, but not delete**. If the provider supports
object lock or immutability on a bucket, enable it for weekly recovery points.

A backup credential must never be a production admin credential (NEM-009 §10).

## 5. Generate the encryption key · **the private key must not live on the server**

```bash
apt-get install -y age rclone
age-keygen -o noetia-backup-key.txt        # RUN THIS ON YOUR WORKSTATION, NOT THE SERVER
```

- **Public key** → the server, in `.env.backup` as `BACKUP_AGE_RECIPIENT`.
- **Private key** → your password manager / vault, **never** on the server and **never** in Git.

The server can then encrypt backups it cannot itself read. A host compromise yields no ability
to decrypt historical backups.

**A backup whose key is unrecoverable is not a backup.** Record where the private key lives in
the DR runbook — the location, never the value.

Verify the tooling round-trips before relying on it:

```bash
/opt/noetia/infra/server/backup-offsite.sh --selftest
```

## 6. Create `/opt/noetia/.env.backup` · use `nano`, never a multi-line paste

```
BACKUP_AGE_RECIPIENT=age1...      # PUBLIC key only
BACKUP_REMOTE=b2:noetia-backups/postgres
```

Then `chmod 600 /opt/noetia/.env.backup` and configure `rclone config` for the remote.

`.env.backup` matches the `.env.*` ignore rule added by NEM-009 — verify with
`git check-ignore -v .env.backup`.

## 7. Second Git remote · free · **Product Owner action**

Protects the 1,743-file VTT corpus and all infrastructure definitions if GitHub becomes
unavailable (DR-14). Create an empty repository with a second provider, then:

```bash
cd /opt/noetia
git remote add mirror <url>
git push --mirror mirror
```

Add to cron weekly. **Confirm the mirror repository is private.**

## 8. Store secrets off-server · **Product Owner action**

`.env.production` currently exists **only** on the host. Its loss blocks every restore — the
database dump is inert without `DB_PASS`.

Store a copy in the password manager already used for production credentials, and record its
location in the DR runbook. Inventory of what must be recoverable (names only) is in
[state-inventory.md](state-inventory.md).

## 9. First real restore test · after 1–8

```bash
/opt/noetia/infra/server/restore-db.sh \
  --file /opt/backups/postgres/<newest>.dump \
  --project noetia_restore_test
```

Runs in an isolated container, touches no production service, and prints **measured** restore
time plus ownership and token integrity. Tear down afterwards with the command it prints.

This produces Noetia's first real recovery measurement. Until it runs against a production
dump, the RPO/RTO figures in [rpo-rto.md](rpo-rto.md) remain targets.
