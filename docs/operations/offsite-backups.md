# Encrypted Offsite Backups

Runbook for Noetia's automated, encrypted offsite copy of the production PostgreSQL and MinIO backups.

> **Status (recorded 2026-10-28)**
>
> | Item | Status |
> |------|--------|
> | PostgreSQL transfer + SHA-256 verification | ✅ Verified |
> | MinIO transfer + SHA-256 verification | ✅ Verified |
> | Re-verification of an existing backup (duplicate → `SKIP_VERIFIED`) | ✅ Verified |
> | Manual run of the systemd service (`systemctl --user start`) | ✅ Verified (2026-10-28 00:33, both archives `SKIP_VERIFIED`) |
> | Timer `enabled` and `active (waiting)`, next run 06:00 local | ✅ Verified |
> | **First unattended, timer-triggered run** | ⏳ **Not yet verified.** At the time of writing `systemctl --user list-timers` showed `LAST: -` |
> | Full restore drill (decrypt → restore into a scratch environment) | ⏳ Not yet performed / not recorded |
>
> Update this table once each pending item has evidence (see [§7 Verifying a run](#7-verifying-a-run)).

---

## 1. Architecture

```
Production VPS (Contabo, /opt/noetia)            Local Ubuntu VM (VirtualBox)             Windows host
──────────────────────────────────────           ─────────────────────────────            ────────────
cron → infra/server/backup-db.sh                 systemd --user timer (06:00 daily)
        /opt/backups/postgres/noetia_*.sql.gz      └─ noetia-offsite-backup.service
cron → infra/server/backup-minio.sh                     └─ ~/.local/bin/noetia-offsite-backup --all
        /opt/backups/minio/minio_*.tar.gz                    │
                                                             │ SSH (restricted backup account,
restricted backup account ◄──── forced-command ──────────────┘  forced-command allowlist)
  allowlist: <kind>-name, <kind>-hash:<file>,                │
             <kind>-get:<file>                               ▼
                                                   plaintext stream ─► age -r <recipient> ─► .partial
                                                   decrypt + sha256 == remote hash ─► mv to final
                                                   /media/sf_VMShare/Noetia-Backups/*.age ═══► VirtualBox
                                                                                              shared folder
```

Key properties:

- **Pull model.** The VM connects to production; production holds no credentials for the offsite destination.
- **Restricted account.** The VM authenticates as a dedicated backup user whose SSH key is bound to a forced command. Only an allowlist of commands is accepted — it cannot open a shell.
- **Filename pinning.** The VM first asks for the latest archive name, validates it against a strict regex, then requests the hash and the stream **for that exact filename**. A newer archive appearing mid-run cannot be swapped in.
- **Encrypted at rest offsite.** The stream is encrypted with [`age`](https://age-encryption.org/) as it arrives; plaintext is never written to the shared folder.
- **Verify before accept.** A file is only published under its final name after it has been decrypted and its SHA-256 matches the server's checksum, and the server's checksum is unchanged after the transfer.

## 2. Components and paths

### Production VPS

| Item | Path / value | Source |
|------|--------------|--------|
| PostgreSQL dump script | [`infra/server/backup-db.sh`](../../infra/server/backup-db.sh) | repo |
| PostgreSQL archives | `/opt/backups/postgres/noetia_YYYYMMDD_HHMMSS.sql.gz` | repo script |
| PostgreSQL schedule / retention | daily 2 AM; 7 daily + 4 weekly (Sunday) | [`docs/technical-baseline/04-database.md`](../technical-baseline/04-database.md) |
| MinIO archive script | [`infra/server/backup-minio.sh`](../../infra/server/backup-minio.sh) (tar of the `noetia_minio_data` volume) | repo |
| MinIO archives | `/opt/backups/minio/minio_YYYYMMDD_HHMMSS.tar.gz` | repo script |
| MinIO schedule / retention | weekly, Sunday 3 AM; 28 days | [`docs/technical-baseline/11-storage.md`](../technical-baseline/11-storage.md) |
| Restricted backup account + forced-command handler | **Not in the repository** — see [§10 Gaps](#10-documentation-gaps) | — |

The forced-command interface, as used by the client script:

| Command | Returns |
|---------|---------|
| `postgres-name` / `minio-name` | Filename of the latest archive of that kind |
| `postgres-hash:<file>` / `minio-hash:<file>` | SHA-256 hex digest of that archive |
| `postgres-get:<file>` / `minio-get:<file>` | Raw archive bytes on stdout |

### Local Ubuntu VM (offsite client)

| Item | Path |
|------|------|
| Backup script | `~/.local/bin/noetia-offsite-backup` (not version-controlled — see [§10](#10-documentation-gaps)) |
| Lock file | `~/.local/bin/noetia-offsite-backup.lock` |
| SSH private key (backup account) | `~/.ssh/noetia_backup_ed25519` |
| age identity (private key) | `~/.config/age/noetia-key.txt` |
| age identity, recovery copy (encrypted) | `~/.config/age/noetia-key-recovery.age` |
| systemd service | `~/.config/systemd/user/noetia-offsite-backup.service` |
| systemd timer | `~/.config/systemd/user/noetia-offsite-backup.timer` |
| Destination | `/media/sf_VMShare/Noetia-Backups/` (VirtualBox shared folder `VMShare`, readable from Windows) |

Destination filenames are the server filename plus `.age`, e.g. `noetia_20261028_020001.sql.gz.age`, `minio_20261025_030001.tar.gz.age`. Approximate sizes observed on 2026-10-28: PostgreSQL ≈ 12 MB, MinIO ≈ 12.8 GB per archive.

> **Secrets.** The SSH key, the age identity, and the passphrase for the recovery copy are **never** committed. The SSH target, port and age recipient (public key) are configured at the top of the script; production host details are in [`CLAUDE.md § Production Deployment`](../../CLAUDE.md#production-deployment).

## 3. Encryption

- Encryption: `age -r <recipient>`, where the recipient is the **public** key configured as `AGE_RECIPIENT` in the script. Anyone can encrypt to it; only the identity can decrypt.
- Decryption (verification and restore): `age -d -i ~/.config/age/noetia-key.txt`.
- **Losing the age identity makes every offsite backup unrecoverable.** Keep the recovery copy (`noetia-key-recovery.age`) and its passphrase somewhere that does not depend on this VM or the Windows host (e.g. the password manager that holds `.env.production`).
- Tooling verified with `age` 1.2.1.

## 4. Verification logic

For each kind (`postgres`, then `minio`), `noetia-offsite-backup` does:

1. **Preflight** — required tools present (`ssh age sha256sum flock gzip mktemp mv`), destination is a writable directory, SSH key and age identity readable. Takes an exclusive `flock`; a second concurrent run exits with `Another backup run is active`.
2. **Resolve name** — `<kind>-name`, validated against `^noetia_[0-9]{8}_[0-9]{6}\.sql\.gz$` or `^minio_[0-9]{8}_[0-9]{6}\.tar\.gz$`.
3. **If `<file>.age` already exists** — must be a regular file (not a symlink); it is decrypted and hashed and compared with `<kind>-hash:<file>`. Match → `SKIP_VERIFIED`. Mismatch or decrypt failure → error, nothing is overwritten.
4. **Otherwise transfer** —
   1. get the expected hash (`<kind>-hash:<file>`, must be 64 hex chars);
   2. stream `<kind>-get:<file>` through `age -r` into `.<file>.XXXXXXXX.partial` in the destination directory;
   3. decrypt the partial file and compare its SHA-256 with the expected hash;
   4. re-query the hash and require it to be unchanged (source did not change during transfer);
   5. refuse if the destination appeared meanwhile; otherwise `mv -T` the partial to its final name (the VirtualBox shared folder supports rename but not hard links) → `VERIFIED`.

On any failure the partial file is **kept** for inspection and the run exits non-zero.

## 5. systemd configuration

`~/.config/systemd/user/noetia-offsite-backup.service`

```ini
[Unit]
Description=Noetia encrypted offsite backup
ConditionPathIsDirectory=/media/sf_VMShare/Noetia-Backups

[Service]
Type=oneshot
ExecStart=%h/.local/bin/noetia-offsite-backup --all
TimeoutStartSec=12h
```

`~/.config/systemd/user/noetia-offsite-backup.timer`

```ini
[Unit]
Description=Daily Noetia encrypted offsite backup schedule

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true
Unit=noetia-offsite-backup.service

[Install]
WantedBy=timers.target
```

- `Persistent=true` — if the VM was off at 06:00, the run fires once at the next opportunity.
- `ConditionPathIsDirectory` — if the shared folder is not mounted, the run is **skipped, not failed** (see [§9](#9-known-limitations)).

## 6. Operational commands

Run on the Ubuntu VM as the backup user.

```bash
# Preflight + show the latest archive names on the server (no transfer)
noetia-offsite-backup --check

# Manual runs
noetia-offsite-backup --postgres
noetia-offsite-backup --minio
noetia-offsite-backup --all

# Same as the timer, via systemd
systemctl --user start noetia-offsite-backup.service

# Timer state
systemctl --user list-timers noetia-offsite-backup.timer
systemctl --user status noetia-offsite-backup.timer noetia-offsite-backup.service

# Logs
journalctl --user -u noetia-offsite-backup.service -n 50 --no-pager

# What is offsite
ls -lh /media/sf_VMShare/Noetia-Backups/
```

After editing a unit file: `systemctl --user daemon-reload`.

## 7. Verifying a run

A good run logs, for each kind, either `VERIFIED: <path>` or `SKIP_VERIFIED: <path>`, then `Finished noetia-offsite-backup.service`. Any `ERROR:` line means that archive was **not** accepted.

To confirm the first **unattended** run (the pending item above), after 06:00:

```bash
systemctl --user list-timers noetia-offsite-backup.timer   # LAST must show today's 06:00
journalctl --user -u noetia-offsite-backup.service --since today --no-pager
```

The journal entry should start at ~06:00 (not at a manually triggered time). Record the date in the status table at the top of this file.

## 8. Recovery

> Restores to production are destructive. Take a Contabo snapshot first, follow [`CLAUDE.md § Development Safety Rules`](../../CLAUDE.md#development-safety-rules), and rehearse on staging or a scratch container before touching production. These steps have **not yet been rehearsed end to end** (see the status table).

### 8.1 Decrypt and verify

On a machine holding the age identity:

```bash
age -d -i ~/.config/age/noetia-key.txt \
  /media/sf_VMShare/Noetia-Backups/noetia_YYYYMMDD_HHMMSS.sql.gz.age \
  > noetia_YYYYMMDD_HHMMSS.sql.gz
sha256sum noetia_YYYYMMDD_HHMMSS.sql.gz
gzip -t noetia_YYYYMMDD_HHMMSS.sql.gz        # integrity check

# MinIO
age -d -i ~/.config/age/noetia-key.txt \
  /media/sf_VMShare/Noetia-Backups/minio_YYYYMMDD_HHMMSS.tar.gz.age \
  > minio_YYYYMMDD_HHMMSS.tar.gz
tar tzf minio_YYYYMMDD_HHMMSS.tar.gz | head   # integrity / contents check
```

If the original identity is lost, decrypt the recovery copy first (`age -d noetia-key-recovery.age > noetia-key.txt` — prompts for its passphrase), then proceed.

Copy the decrypted archive to the target host with an administrative account. The restricted backup account only serves the allowlisted read commands and cannot be used to upload.

### 8.2 PostgreSQL

The archive is a plain gzip'd `pg_dump` (no `--clean`), so it must be loaded into an **empty** database:

```bash
gunzip -c noetia_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.server.yml \
  exec -T db psql -U noetia -d noetia
```

Then run the deployment verification in `CLAUDE.md` (last migrations, spot-test an endpoint).

### 8.3 MinIO

The archive is a tar of the root of the `noetia_minio_data` Docker volume (`tar czf … -C /data .`). Restore with MinIO stopped:

```bash
docker compose --env-file .env.production -f docker-compose.server.yml stop storage
docker run --rm -v noetia_minio_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/minio_YYYYMMDD_HHMMSS.tar.gz -C /data
docker compose --env-file .env.production -f docker-compose.server.yml start storage
```

Then verify per [`incident-response.md §5`](../incident-response.md#5-minio-unreachable--wrong-bucket-policy) (bucket policy: `books/` + `audio/` private, `images/` public).

## 9. Known limitations

- **Unattended run unverified** at the time of writing (see the status table).
- **User-session timer, lingering off.** `loginctl show-user` reported `Linger=no`, so the user's systemd instance, and its timer, only runs while that user is logged in to the VM. With the VM off or logged out, `Persistent=true` catches up **once** at the next login. Enabling lingering (`loginctl enable-linger`) is a possible follow-up; it has not been done.
- **Only the latest archive is fetched.** Each run copies the newest PostgreSQL and the newest MinIO archive. Dailies produced on days the VM did not run are not backfilled offsite. They remain on the VPS for the server-side retention window.
- **Silent skip when the share is unmounted.** `ConditionPathIsDirectory` makes systemd skip the run without an error.
- **No alerting.** Failures surface only in the user journal; nothing notifies an operator.
- **No offsite retention / pruning.** The script never deletes. MinIO archives are ~12.8 GB each, so the Windows host's free space must be watched manually.
- **Identity co-located with backups.** The age identity used for verification lives on the same VM/host that stores the encrypted backups. Losing that machine loses both, unless the recovery copy and its passphrase are kept elsewhere.
- **Full MinIO re-verification cost.** Each run decrypts and hashes the existing ~12.8 GB MinIO file to re-verify it (~45 s observed).

## 10. Documentation gaps

Information that was not available when this runbook was written. Fill these in rather than guessing:

1. **Server-side forced-command setup** — the handler script's path on the VPS, the `authorized_keys` options (e.g. `command=`, `restrict`), and how the backup account reads `/opt/backups/*`. This is not in the repository.
2. **Server-side cron entries** — the exact crontab lines invoking `backup-db.sh` / `backup-minio.sh`. Schedules above come from existing docs, not from the live crontab.
3. **Archive path discrepancy** — [`incident-response.md §4`](../incident-response.md#4-database-unreachable) says backups are at `/opt/noetia/backups/`, but `infra/server/backup-db.sh` writes to `/opt/backups/postgres`. Confirm which is current on the server.
4. **Client script under version control** — `~/.local/bin/noetia-offsite-backup` exists only on the VM, along with several `.pre-*` revisions of it. Consider committing it (e.g. under `infra/offsite/`) in a separate, reviewed change.
5. **Recovery-key escrow** — where `noetia-key-recovery.age` and its passphrase are stored off the VM.
6. **Original operational record** — the detailed runbook `noetia-offsite-backups-runbook.md` referenced when this task was assigned was not available. This document was written from the installed script, units and journal, so anything that existed only in that record should be merged in here.
7. **Restore drill** — no recorded end-to-end restore from an offsite archive.
