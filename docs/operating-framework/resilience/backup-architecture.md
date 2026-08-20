# Backup Architecture

**NOF-003** · Recommended design. **Not implemented.**

## Principle

Every protected dataset needs at least one copy **outside the Contabo account**. That single
requirement is what today's design lacks, and it is what distinguishes an inconvenience from
an extinction event.

## PostgreSQL

**Current:** `infra/server/backup-db.sh` — `pg_dump | gzip` → `/opt/backups/postgres`,
7 daily + 4 weekly. Same server. Unencrypted. Unmonitored. Undocumented. Never restore-tested.
Cron not installed by `init.sh`.

**Recommended, staged:**

| Stage | Change | Addresses |
|---|---|---|
| **A** | Keep the script; **push each dump off-site** after it runs | DR-07, DR-08, DR-13 |
| **B** | Encrypt before upload | Dumps contain PII, hashes, ownership |
| **C** | Verify: non-zero, `gunzip -t`, expected table count | DR-11, DR-18 |
| **D** | Alert on failure **and on absence** | DR-18 |
| **E** | Increase Tier-0 frequency to hourly | RPO ≤1 h |
| **F** | Evaluate PITR/WAL archiving before commercial scale | Tier-0 ≤15 min |

Use **custom format** (`pg_dump -Fc`) rather than plain SQL: it supports selective restore and
parallel `pg_restore`, which matters when the objective is a 4-hour RTO.

**pgvector note:** once ADR-004 lands in production, dumps must be taken with the extension
present and restored into an image that has it. `pgvector/pgvector:pg16` is already staging's
image; production is still `postgres:16-alpine`. **NEM-006B owns that compatibility proof** —
this document only records the dependency.

## MinIO

**Current: nothing.**

**Recommended:**

1. **Separate the irreplaceable from the rebuildable.** Author uploads and user images are
   Tier 2 and must be backed up. Public-domain audio is large and rebuildable — a lower tier.
2. **`mc mirror` to independent object storage**, incremental by etag. NEM-006C demonstrated
   the mechanics and the pitfalls: run it **sequentially**, not with default concurrency, and
   remember `--limit-*` flags corrupt multipart transfers.
3. **Enable versioning** on the destination to survive overwrite-based corruption.
4. Consider **not** replicating the 13 GB of public-domain audio off-site, provided
   re-ingestion is documented and periodically proven. That is a cost decision (Q-DR-03).

## Git / repository

Protects source, migrations, infra definitions, docs, and the **1,743-file VTT corpus** — the
asset that keeps sync-map recovery at minutes rather than days.

**Recommended:** a second remote (mirror) so GitHub is not a single point of failure, plus a
periodic bundle stored with the off-site backups. `git clone --mirror` on a schedule is
sufficient; nothing exotic is warranted.

## Secrets

**Current: no backup, and not gitignored.**

**Recommended, in order:**
1. **Fix `.gitignore` immediately** to cover `.env.production` and `.env.staging`
   (**IG-DR-02** — the cheapest high-value fix in this document).
2. Store secrets in a password manager or encrypted vault **outside the server** — the
   existing practice of keeping `.env.production` in a password manager should be verified and
   made explicit policy.
3. Maintain a **secret inventory by name** (already drafted in
   [state-inventory.md](state-inventory.md)) so a rebuild knows what must be re-provisioned.
4. Never include decrypted secrets in a data backup.

## Redis, Meilisearch, monitoring

**No backup.** Redis is ephemeral by design (users re-login); Meilisearch rebuilds from
PostgreSQL in minutes, demonstrated in NEM-006C; metrics history is not worth protecting.
Record these as **deliberate decisions**, so a future engineer does not read the absence as an
oversight.

## Infrastructure as recoverable state

`docker-compose.server.yml`, `traefik.yml`, and `init.sh` are in Git. **Not** captured:
`acme.json`, UFW rules as actually applied, sshd port 222, cron entries, and the `proxy`
network. `init.sh` should be corrected (**IG-DR-09**) so a clean-VPS rebuild reproduces the
real configuration rather than a divergent one.
