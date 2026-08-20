# State Inventory

**NOF-003** · Every stateful component, its canonical source, and whether anything protects it.
Evidence is repository-based; production figures marked `NEEDS OPERATOR` were not measured.

## Docker named volumes (production)

From `docker-compose.server.yml:16-22`:

| Volume | Contents | Backed up today? |
|---|---|---|
| `postgres_data` | All relational state | **Partially** — logical dump, same server |
| `minio_data` | Books, audio, images | **No** |
| `redis_data` | Sessions, queues, social tokens | **No** |
| `meilisearch_data` | Search indexes | **No** (reconstructable) |
| `prometheus_data` | Metrics history | **No** |
| `grafana_data` | Dashboards, users | **No** |

## PostgreSQL — the system of record

Holds: users · `user_books` (permanent ownership) · `token_ledger` · subscriptions ·
`plans` · books metadata · `sync_maps` · fragments and notes · reading progress and stats ·
clubs · shares · gift cards · courtesy quotas · `stripe_processed_events` · migrations ·
future semantic chunks and embeddings (ADR-004).

Known scale: 84 books, 16 users, 67 migrations. **Database size: `NEEDS OPERATOR`.**

Protection: `infra/server/backup-db.sh` — `pg_dump | gzip` to `/opt/backups/postgres`,
7 daily + 4 weekly Sunday. Same server. Unencrypted. Not referenced by any document. Cron
installation is **not** in `init.sh`, so whether it runs at all is **unverifiable from the
repository**.

## MinIO — object storage

| Prefix | Contents | Measured | Recoverability |
|---|---|---|---|
| `audio/books/` | Concatenated MP3 per title | **13 GB** | Public-domain: re-downloadable from LibriVox/archive.org, slowly and unreliably (3 titles already fail on 500s). **Author-uploaded audio: irreplaceable.** |
| `books/` | Book text | **24 MB** | Public-domain: re-fetchable from Gutenberg/Wikisource. **Author-uploaded: irreplaceable.** |
| `images/` | Share cards, backgrounds, user uploads | `NEEDS OPERATOR` | Generated cards regenerable; **user-uploaded backgrounds irreplaceable** |

**No backup of any kind.** Object keys are title slugs (`audio-source-resolver.ts`), so a
rebuild is possible for public-domain content but not for creator content.

## Redis

Sessions, refresh tokens, phrase-sync state, BullMQ queues, and AES-256-CBC encrypted social
OAuth tokens. Loss forces re-login and re-linking of social accounts — disruptive, not
destructive. **Acceptable to lose**, provided that is a stated decision rather than an
oversight.

## Meilisearch

Fully reconstructable — `node dist/ingestion/seed-search.js` rebuilt all 84 books during
NEM-006C ("Indexing 84 published books… Done."). **Demonstrated, not assumed.**

## Git repository (GitHub)

Protects source, migrations, `docker-compose*.yml`, `infra/`, docs, and the **1,743 VTT
transcription files (66.5 MB)** — the expensive Whisper GPU output. Single remote,
`github.com/Carloskfe/noetia`; no mirror.

## Secrets — the largest single gap

`.env.production` on the host, `.env.staging` on the host, Traefik `acme.json`.

**Neither `.env.production` nor `.env.staging` is gitignored** — `git check-ignore` confirms
no rule matches; `.gitignore:13-15` covers only `.env`, `.env.local`, `.env.*.local`. Since
`/opt/noetia` is itself a git checkout holding `.env.production`, a `git add .` there would
stage live production secrets. `CLAUDE.md:499` instructs operators to "confirm with
`.gitignore`", which would wrongly appear to confirm safety.

Secret classes needed to rebuild (names only): `JWT_SECRET` · `DB_PASS` · `MINIO_ACCESS_KEY`/
`MINIO_SECRET_KEY` · `MEILI_MASTER_KEY` · `SOCIAL_TOKEN_SECRET` · Stripe keys and webhook
secret · SMTP/Resend credentials · OAuth client secrets (Google, Facebook, Apple) ·
`DEPLOY_SSH_KEY` (GitHub secret) · future AI provider keys.

**No backup, no escrow, no documented recovery path.** If the host disk is lost, these are
gone and every integration must be re-provisioned from provider consoles.

## Host state outside Docker

`/opt/traefik/traefik.yml` (in repo) · `/opt/traefik/acme.json` (**not** in repo —
certificates; regenerable via Let's Encrypt if DNS resolves) · UFW rules · fail2ban ·
sshd config on **port 222** · cron entries · the `proxy` Docker network · `/opt/noetia`,
`/opt/noetia-staging`, `/opt/autoguildx` checkouts.

**`init.sh` reconstruction gap:** it opens UFW `22/tcp` (line 37) while production SSH runs
on **222** (`CLAUDE.md:371`). A rebuild from `init.sh` plus a port-222 sshd would be firewalled
out. It also does not install the backup cron.

## External authoritative state

| Provider | Holds | Noetia's local record |
|---|---|---|
| Stripe | Customers, subscriptions, invoices, payments | `stripe_processed_events`, subscription rows — reconciliation needed after any restore |
| Cloudflare | DNS | Records documented; recreatable |
| Contabo | VPS, 3 snapshot slots | **Same account = same failure domain** |
| GitHub | Repository, Actions secrets | Single remote |
| Resend | Email delivery | No canonical state |
| Google/Facebook/Apple | OAuth identities | `provider`/`providerId` in PostgreSQL |

## Commands for the operator (read-only)

```bash
# PostgreSQL size and row counts
docker exec -i noetia-db-1 psql -U noetia -d noetia -c "SELECT pg_size_pretty(pg_database_size('noetia'));"
docker exec -i noetia-db-1 psql -U noetia -d noetia -c "SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM user_books) owned, (SELECT COUNT(*) FROM token_ledger) tokens;"

# MinIO totals including images/
docker exec noetia-storage-1 du -sh /data/audio /data/books /data/images

# Does the backup actually run, and is it recent?
ls -la /opt/backups/postgres/ 2>/dev/null || echo "MISSING — backup has never run at this path"
ls -la /opt/noetia/backups/ 2>/dev/null || echo "MISSING — path named in incident-response.md does not exist"
crontab -l 2>/dev/null | grep -i backup || echo "NO backup cron installed for root"
tail -5 /opt/backups/postgres/backup.log 2>/dev/null

# Free disk for restore headroom
df -h /
```

Until these run, backup **existence** is repository-inferred and its **execution unproven**.
