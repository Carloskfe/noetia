# Encrypted Offsite Backups

Runbook for Noetia's automated, encrypted offsite copy of the production PostgreSQL and MinIO backups.

> **Operating model — read first.** This is an *operator-assisted* backup, not a fully unattended one. It runs only while the Windows computer **and** the Ubuntu VM are powered on, and after every VM reboot a person must unlock the SSH key once (see [§6 Daily operating procedure](#6-daily-operating-procedure)). Everything after that unlock is automatic.

> **Status (recorded 2026-10-29)**
>
> | Item | Status |
> |------|--------|
> | PostgreSQL transfer + SHA-256 verification | ✅ Verified |
> | MinIO transfer + SHA-256 verification | ✅ Verified |
> | Re-verification of an existing backup (duplicate → `SKIP_VERIFIED`) | ✅ Verified |
> | Manual run of the systemd service (`systemctl --user start`) | ✅ Verified (2026-10-28 00:33) |
> | Unattended, timer-triggered run (key already unlocked) | ✅ Verified 2026-10-28 06:00:19 → 06:02:33, both archives `SKIP_VERIFIED` |
> | Timer `Persistent=true` catch-up right after a boot, key still locked | ❌ **Fails by design** — observed 2026-10-29 06:15:04, `Permission denied (publickey,password)`. This is why the startup catch-up service exists |
> | Startup catch-up after an Ubuntu reboot (`noetia-startup-catchup.service`) | ✅ Verified 2026-10-29 — see [§8.2](#82-reboot-recovery-test--2026-10-29) |
> | Startup catch-up retry after a failed backup (`Restart=on-failure`) | ⏳ Configured, not exercised |
> | Failure notifications | ⏳ Not implemented |
> | Full restore drill (decrypt → restore into a scratch environment) | ⏳ Not performed. Isolated MinIO restore test pending |
> | age identity recovery copy stored independently of the VM / Windows host | ⏳ Not verified |
>
> Update this table once each pending item has evidence (see [§8 Verifying a run](#8-verifying-a-run)).

---

## 1. Architecture

```
Production VPS (Contabo, /opt/noetia)            Local Ubuntu VM (VirtualBox)             Windows host
──────────────────────────────────────           ─────────────────────────────            ────────────
cron → infra/server/backup-db.sh                 systemd --user timer (06:00 daily)
        /opt/backups/postgres/noetia_*.sql.gz      └─ noetia-offsite-backup.service ───┐
cron → infra/server/backup-minio.sh              systemd --user, at boot (default.target)│
        /opt/backups/minio/minio_*.tar.gz          └─ noetia-startup-catchup.service    │
                                                        waits for key + share, then ─────┤
                                                   ~/.local/bin/noetia-offsite-backup --all  (flock: one run at a time)
                                                             │  key from ssh-agent at
                                                             │  /run/user/1000/openssh_agent
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
- **Idempotent.** A run that finds a valid `.age` copy already offsite re-verifies it and skips the transfer (`SKIP_VERIFIED`), so the timer and the startup catch-up can both run on the same day without duplicating work.
- **Two triggers, one script.** The 06:00 timer covers days the VM is already up with the key unlocked. The startup catch-up covers reboots, where the timer's own catch-up fires before anyone can unlock the key and fails (see [§5.3](#53-why-two-triggers)).

Schedules (server side): PostgreSQL dump daily ≈ 02:00, MinIO archive weekly on Sunday ≈ 03:00. Most days, therefore, the PostgreSQL copy is new and the MinIO copy is a `SKIP_VERIFIED` of the latest Sunday archive.

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
| Restricted backup account + forced-command handler | **Not in the repository** — see [§14 Gaps](#14-documentation-gaps) | — |

The forced-command interface, as used by the client script:

| Command | Returns |
|---------|---------|
| `postgres-name` / `minio-name` | Filename of the latest archive of that kind |
| `postgres-hash:<file>` / `minio-hash:<file>` | SHA-256 hex digest of that archive |
| `postgres-get:<file>` / `minio-get:<file>` | Raw archive bytes on stdout |

### Local Ubuntu VM (offsite client)

| Item | Path |
|------|------|
| Backup script | `~/.local/bin/noetia-offsite-backup` (not version-controlled — see [§14](#14-documentation-gaps)) |
| Lock file | `~/.local/bin/noetia-offsite-backup.lock` |
| Startup catch-up script | `~/.local/bin/noetia-startup-catchup` (not version-controlled) |
| SSH private key (backup account) | `~/.ssh/noetia_backup_ed25519` (Ed25519, passphrase-protected) |
| SSH agent socket | `/run/user/1000/openssh_agent` (`%t/openssh_agent`), provided by the distro's user unit `ssh-agent.socket`. This is a standalone OpenSSH agent, separate from the desktop keyring agent |
| age identity (private key) | `~/.config/age/noetia-key.txt` |
| age identity, recovery copy (encrypted) | `~/.config/age/noetia-key-recovery.age` |
| systemd service | `~/.config/systemd/user/noetia-offsite-backup.service` |
| systemd service drop-in | `~/.config/systemd/user/noetia-offsite-backup.service.d/override.conf` |
| systemd timer | `~/.config/systemd/user/noetia-offsite-backup.timer` |
| Startup catch-up service | `~/.config/systemd/user/noetia-startup-catchup.service` |
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

`~/.config/systemd/user/noetia-offsite-backup.service.d/override.conf`

```ini
[Service]
Environment=SSH_AUTH_SOCK=%t/openssh_agent
```

- The drop-in points the timer-driven run at the standalone agent, so the script can use the unlocked key. Without it, a timer run has no agent and fails authentication.
- `Persistent=true` — if the VM was off at 06:00, the run fires once at the next opportunity, which is typically seconds after boot (see [§5.3](#53-why-two-triggers)).
- `ConditionPathIsDirectory` — if the shared folder is not mounted, the run is **skipped, not failed** (see [§11](#11-known-limitations)).

### 5.1 Startup catch-up service

`~/.config/systemd/user/noetia-startup-catchup.service`

```ini
[Unit]
Description=Noetia startup encrypted backup catch-up
After=ssh-agent.socket

[Service]
Type=oneshot
ExecStart=%h/.local/bin/noetia-startup-catchup
TimeoutStartSec=infinity
Restart=on-failure
RestartSec=60

[Install]
WantedBy=default.target
```

Enabled (`systemctl --user enable`) under `default.target`, so it starts whenever the user's systemd manager starts. Lingering is enabled for the user (`loginctl show-user` → `Linger=yes`, checked 2026-10-29), so the manager, and this service, start at boot without a desktop login.

### 5.2 Startup catch-up script

`~/.local/bin/noetia-startup-catchup` (summary, not a copy; the file on the VM is authoritative):

1. Sets `SSH_AUTH_SOCK=$XDG_RUNTIME_DIR/openssh_agent`.
2. Every 10 s, checks all of:
   - `ssh-add -l -E sha256` lists the **expected fingerprint** of the backup key (pinned in the script). Any other key in the agent does not count;
   - `findmnt` reports the destination's filesystem as `vboxsf`. This stops a run from writing to an empty local directory when the share is not mounted;
   - the destination is a writable directory.
3. Once all are true, runs `noetia-offsite-backup --all` directly. The script uses `set -Eeuo pipefail`, so the backup script's exit status becomes the service's: non-zero → unit `failed` → `Restart=on-failure` starts it again after 60 s, and it waits for the prerequisites again.
4. On success, logs `Noetia: Backup service completed successfully.` and exits 0. It runs once per boot.

`TimeoutStartSec=infinity` means the service stays `activating` for as long as the key is locked. That is expected and is not an error.

### 5.3 Why two triggers

On 2026-10-29 the VM booted shortly after 06:00. The timer's `Persistent=true` catch-up fired at 06:15:04, before the key had been unlocked, and failed with `Permission denied (publickey,password)`. systemd records that as the day's run, so the timer will not try again until the next 06:00. `Persistent=true` on its own is therefore not enough when authentication is unavailable at boot. The startup catch-up service fills that gap: it waits for the operator's unlock rather than failing immediately.

Both triggers call the same script. Its `flock` prevents overlapping runs, and its skip-if-verified logic makes a second run on the same day cheap.

## 6. Daily operating procedure

1. Start the Windows computer, then the Ubuntu VM.
2. Unlock the backup key into the standalone agent (prompts for the key passphrase):

   ```bash
   SSH_AUTH_SOCK=/run/user/1000/openssh_agent ssh-add ~/.ssh/noetia_backup_ed25519
   ```

3. Nothing else is needed. Within ~10 s the startup catch-up detects the key and the share and runs the backup. To confirm:

   ```bash
   journalctl --user -u noetia-startup-catchup.service -b -n 40 --no-pager
   ```

   Look for `SSH key and backup storage ready`, a `VERIFIED` or `SKIP_VERIFIED` line per archive, and `Backup service completed successfully`.
4. Leave the VM running. While it stays up with the key in the agent, the 06:00 timer runs each day without further action.

The key stays decrypted in the agent's memory until the agent stops or the VM reboots (see [§10 Security assumptions](#10-security-assumptions)).

## 7. Operational commands

Run on the Ubuntu VM as the backup user. For manual runs from a shell, make sure the shell uses the standalone agent (`export SSH_AUTH_SOCK=/run/user/1000/openssh_agent`), or the script will not find the unlocked key.

```bash
# Unlock the key (after every reboot)
SSH_AUTH_SOCK=/run/user/1000/openssh_agent ssh-add ~/.ssh/noetia_backup_ed25519
# Is it unlocked? (lists the key's SHA-256 fingerprint)
SSH_AUTH_SOCK=/run/user/1000/openssh_agent ssh-add -l -E sha256

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

# Startup catch-up state (activating = waiting for the key/share; inactive = done)
systemctl --user status noetia-startup-catchup.service
systemctl --user is-enabled noetia-startup-catchup.service

# Logs
journalctl --user -u noetia-startup-catchup.service -b -n 40 --no-pager   # this boot
journalctl --user -u noetia-offsite-backup.service -n 40 --no-pager       # scheduled runs

# Shared folder mounted as vboxsf?
findmnt -n -o FSTYPE --target /media/sf_VMShare/Noetia-Backups            # must print: vboxsf

# What is offsite
ls -lh /media/sf_VMShare/Noetia-Backups/
```

After editing a unit file: `systemctl --user daemon-reload`.

## 8. Verifying a run

A good run logs, for each kind, either `VERIFIED: <path>` or `SKIP_VERIFIED: <path>`, then `Finished noetia-offsite-backup.service` (timer) or `Finished noetia-startup-catchup.service` (startup). Any `ERROR:` line, `Permission denied`, or `Failed with result` means that archive was **not** accepted.

### 8.1 Routine check

```bash
systemctl --user list-timers noetia-offsite-backup.timer   # LAST should be today's run
journalctl --user -u noetia-offsite-backup.service --since today --no-pager
journalctl --user -u noetia-startup-catchup.service -b --no-pager
ls -lh /media/sf_VMShare/Noetia-Backups/ | tail             # today's noetia_YYYYMMDD_*.sql.gz.age present
```

If the VM was rebooted today, the timer's entry may show a failed run near boot time (see [§5.3](#53-why-two-triggers)). That is expected as long as the startup catch-up's journal shows a completed run afterwards.

### 8.2 Reboot recovery test — 2026-10-29

End-to-end test of the startup catch-up after an Ubuntu reboot. Times are EDT, taken from `journalctl --user -u noetia-startup-catchup.service -b`.

| Time | Event |
|------|-------|
| 07:32:33 | VM booted. The service started automatically and logged `Waiting for backup prerequisites` |
| — | Operator unlocked the key manually with `ssh-add` (procedure in §6) |
| 07:34:02 | Service detected the expected key fingerprint and the mounted, writable `vboxsf` share |
| 07:34:06 | `SKIP_VERIFIED: …/noetia_20261029_020001.sql.gz.age` |
| 07:35:04 | `SKIP_VERIFIED: …/minio_20261025_030001.tar.gz.age` |
| 07:35:04 | `Backup service completed successfully`, systemd `Finished noetia-startup-catchup.service` |

Result: no manual service start was needed once the key was unlocked. Both archives were already offsite from the 06:22 manual run that morning, so the test exercised the verify path rather than a fresh transfer. Because the transfer path is the same script and was verified separately (2026-10-28, and `VERIFIED` at 2026-10-29 06:22), this is considered sufficient.

Earlier evidence:

- **2026-10-28 06:00:19**: first unattended timer run, both `SKIP_VERIFIED`, `Finished`.
- **2026-10-29 06:15:04**: timer catch-up after boot with the key locked, `Permission denied (publickey,password)`, `Failed with result 'exit-code'`. This was the motivating failure.

## 9. Troubleshooting

### 9.1 SSH authentication fails (`Permission denied (publickey…)`)

Typical cause: the key is not unlocked in the standalone agent, usually after a reboot.

```bash
SSH_AUTH_SOCK=/run/user/1000/openssh_agent ssh-add -l -E sha256
```

- `The agent has no identities` / `Could not open a connection` → unlock with the command in §6. If the socket is missing, check `systemctl --user status ssh-agent.socket`.
- A key is listed but not the backup key → add `~/.ssh/noetia_backup_ed25519`. The startup catch-up only proceeds when the pinned fingerprint is present.
- Key present but still denied → test with `noetia-offsite-backup --check` from a shell with `SSH_AUTH_SOCK` set as in §7. A failure there means the server side (restricted account, `authorized_keys`, firewall or port 222) needs an administrator. **Do not** change SSH auth, keys or firewall from this runbook; escalate per [`incident-response.md`](../incident-response.md).
- Timer runs denied while manual runs work → check the drop-in is loaded: `systemctl --user show noetia-offsite-backup.service -p Environment` must include `SSH_AUTH_SOCK=/run/user/1000/openssh_agent`.

If the timer's run for today already failed, no further timer run happens until tomorrow. Unlocking the key lets the startup catch-up proceed, provided it is still waiting (`activating`) in this boot. Otherwise start a run manually: `systemctl --user start noetia-offsite-backup.service`.

### 9.2 Shared folder missing or not writable

Symptoms: the startup catch-up stays `activating` with the key unlocked; the timer run is skipped by `ConditionPathIsDirectory` (journal shows the unit was skipped because a condition was not met); or a manual run fails preflight with `ERROR: Backup destination unavailable`.

```bash
findmnt -t vboxsf                                   # /media/sf_VMShare should be listed
ls -ld /media/sf_VMShare/Noetia-Backups
id                                                  # user must be in the vboxsf group
touch /media/sf_VMShare/Noetia-Backups/.w && rm /media/sf_VMShare/Noetia-Backups/.w
```

- Not mounted → in VirtualBox, check *Settings → Shared Folders* has `VMShare` set to auto-mount, that Guest Additions are installed and running, and that the Windows-side folder exists. Then reboot the VM or remount.
- Mounted but not writable → check group membership (`vboxsf`) and Windows-side permissions / free disk space.
- **Never** create `/media/sf_VMShare/Noetia-Backups` by hand on the VM's local disk to "fix" a missing mount. The startup check requires `vboxsf` precisely so backups cannot land on the VM's own disk.

### 9.3 Backup service fails

```bash
systemctl --user status noetia-offsite-backup.service noetia-startup-catchup.service
journalctl --user -u noetia-offsite-backup.service -n 80 --no-pager
journalctl --user -u noetia-startup-catchup.service -b -n 80 --no-pager
```

| Log line | Meaning / action |
|----------|------------------|
| `ERROR: Another backup run is active` | Another run (timer, startup or manual) holds the `flock`. The script exits non-zero, so a startup catch-up that hits this is retried 60 s later. Wait for the other run to finish |
| `ERROR: Required SSH or age key unavailable` / `ERROR: Backup destination unavailable` | Preflight failed. See §9.1 / §9.2 |
| `ERROR: Existing backup checksum mismatch` / `ERROR: Existing backup cannot be verified` | The offsite copy does not match the server, or cannot be decrypted. Nothing is overwritten. Inspect the file. Do not delete it until a good copy exists |
| `ERROR: Transfer failed; partial file retained: …` / `ERROR: Checksum mismatch: …` / `ERROR: Decryption/checksum failed: …` | The `.partial` is kept on purpose for inspection. Delete the `.<file>.*.partial` once the cause is understood, then rerun |
| `ERROR: Source archive changed during transfer` | The server rewrote the archive mid-run (e.g. overlapping with the 02:00/03:00 jobs). Rerun later |
| `ERROR: Invalid remote filename` / `ERROR: Invalid remote checksum` | Server returned unexpected output. Check the server-side backup jobs (§2, §14) |
| Startup catch-up repeatedly restarting | `Restart=on-failure` with `RestartSec=60` retries after every failure. The default start-rate limit is not reached at that interval, so it **keeps retrying until it succeeds or is stopped**. Fix the cause, or `systemctl --user stop noetia-startup-catchup.service` |

Before a manual rerun, run `noetia-offsite-backup --check` to confirm preflight and connectivity.

## 10. Security assumptions

- **Key at rest:** the backup SSH key is passphrase-protected on disk. The passphrase is entered interactively and never stored on the VM or in this repository.
- **Key in memory:** after `ssh-add`, the decrypted key lives in the standalone agent until the agent stops or the VM reboots (no lifetime is set). Anyone with code execution as the VM user during that window can use the key. The blast radius is limited to the restricted account's read-only allowlist.
- **Server-side restriction:** the backup account is bound to a forced-command allowlist on port 222 and cannot get a shell or upload. Its exact server-side configuration is not in the repository (§14).
- **Fingerprint pinning:** the startup catch-up only proceeds for the expected key fingerprint, not for any key that happens to be in the agent.
- **Mount check:** requiring `vboxsf` keeps encrypted output from being written to a local directory that merely has the right name.
- **Encryption:** only `age` ciphertext reaches the shared folder. The Windows host never sees plaintext archives. Plaintext exists transiently on the VM only inside the streaming pipeline and during verification (decrypt → hash, not written to disk).
- **Identity location:** the age identity used for verification is on the same VM. See §3 and §11.

## 11. Known limitations

- **Not unattended; depends on the Windows computer.** Backups cannot run while the Windows computer or the Ubuntu VM is powered off, or while the share is unavailable.
- **Manual unlock after every reboot.** Until someone runs `ssh-add`, nothing can authenticate. `Persistent=true` alone cannot cover this: its post-boot catch-up fails immediately and is not retried by the timer that day (§5.3).
- **No failure notifications.** Failures, a startup catch-up left waiting indefinitely, and silent skips surface only in the user journal. Nobody is alerted.
- **Silent skip when the share is unmounted** (timer path). `ConditionPathIsDirectory` makes systemd skip the timer run without an error. The startup catch-up instead waits.
- **Indefinite retry loop** (startup path). A persistent failure makes the startup catch-up retry every ~60 s for the rest of the boot (§9.3). Configured, but not exercised in testing.
- **Only the latest archive is fetched.** Each run copies the newest PostgreSQL and the newest MinIO archive. Dailies produced on days the VM did not run are not backfilled offsite. They remain on the VPS for the server-side retention window.
- **No offsite retention / pruning.** The script never deletes. MinIO archives are ~12.8 GB each, so the Windows host's free space must be watched manually. Retention and recovery objectives (RPO/RTO) are not yet defined.
- **Identity co-located with backups.** The age identity used for verification lives on the same VM/host that stores the encrypted backups. Losing that machine loses both, unless the recovery copy and its passphrase are kept elsewhere. That independent copy has **not yet been verified**.
- **No restore drill.** Neither a PostgreSQL nor an isolated MinIO restore from an offsite archive has been performed.
- **Full MinIO re-verification cost.** Each run decrypts and hashes the existing ~12.8 GB MinIO file to re-verify it (~1–2 min observed).

## 12. Recovery

> Restores to production are destructive. Take a Contabo snapshot first, follow [`CLAUDE.md § Development Safety Rules`](../../CLAUDE.md#development-safety-rules), and rehearse on staging or a scratch container before touching production. These steps have **not yet been rehearsed end to end**. In particular, no isolated MinIO restore test has been done (see the status table).

### 12.1 Decrypt and verify

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

### 12.2 PostgreSQL

The archive is a plain gzip'd `pg_dump` (no `--clean`), so it must be loaded into an **empty** database:

```bash
gunzip -c noetia_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.server.yml \
  exec -T db psql -U noetia -d noetia
```

Then run the deployment verification in `CLAUDE.md` (last migrations, spot-test an endpoint).

### 12.3 MinIO

The archive is a tar of the root of the `noetia_minio_data` Docker volume (`tar czf … -C /data .`). Restore with MinIO stopped:

```bash
docker compose --env-file .env.production -f docker-compose.server.yml stop storage
docker run --rm -v noetia_minio_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/minio_YYYYMMDD_HHMMSS.tar.gz -C /data
docker compose --env-file .env.production -f docker-compose.server.yml start storage
```

Then verify per [`incident-response.md §5`](../incident-response.md#5-minio-unreachable--wrong-bucket-policy) (bucket policy: `books/` + `audio/` private, `images/` public).

## 13. Proposed improvements (not implemented, not tested)

None of the following exists today. Each needs its own reviewed change. Most touch the backup scripts, units, auth or retention, which this runbook does not change.

1. **Failure notifications** — e.g. an `OnFailure=` unit on both services, plus an alert if no `VERIFIED`/`SKIP_VERIFIED` line is logged within N hours of 06:00 or of boot.
2. **Restore drills** — scheduled PostgreSQL restore into a scratch container, and a one-off **isolated MinIO restore** into a throwaway volume, with results recorded in the status table.
3. **Verify the age identity escrow** — confirm `noetia-key-recovery.age` and its passphrase are stored independently of the VM and Windows host, and test-decrypt from it.
4. **Define retention and RPO/RTO** — decide how many offsite PostgreSQL/MinIO copies to keep and implement pruning that cannot delete the last verified copy.
5. **Bound the startup retry loop** — e.g. `StartLimitIntervalSec=`/`StartLimitBurst=` so a persistent failure ends in a visible `failed` state instead of retrying forever.
6. **Reduce dependence on the Windows host** — a second offsite destination that does not require a desktop to be powered on.
7. **Version-control the client scripts and units** (sanitised) — see §14.

## 14. Documentation gaps

Information that was not available when this runbook was written. Fill these in rather than guessing:

1. **Server-side forced-command setup** — the handler script's path on the VPS, the `authorized_keys` options (e.g. `command=`, `restrict`), and how the backup account reads `/opt/backups/*`. This is not in the repository.
2. **Server-side cron entries** — the exact crontab lines invoking `backup-db.sh` / `backup-minio.sh`. Schedules above come from existing docs, not from the live crontab.
3. **Archive path discrepancy** — [`incident-response.md §4`](../incident-response.md#4-database-unreachable) says backups are at `/opt/noetia/backups/`, but `infra/server/backup-db.sh` writes to `/opt/backups/postgres`. Confirm which is current on the server.
4. **Client scripts and units under version control** — `~/.local/bin/noetia-offsite-backup` (plus several `.pre-*` revisions), `~/.local/bin/noetia-startup-catchup` and the three user units exist only on the VM. Consider committing sanitised copies (e.g. under `infra/offsite/`) in a separate, reviewed change.
5. **Recovery-key escrow** — where `noetia-key-recovery.age` and its passphrase are stored off the VM and the Windows host, and evidence that a test decryption from that copy works.
6. **Original operational record** — the detailed runbook `noetia-offsite-backups-runbook.md` referenced when this task was assigned was not available. This document was written from the installed script, units and journal, so anything that existed only in that record should be merged in here.
7. **Restore drill** — no recorded end-to-end restore from an offsite archive, PostgreSQL or MinIO.
8. **Recovery objectives** — no agreed RPO/RTO and no offsite retention policy. Current behaviour gives a PostgreSQL RPO of about one day *only while the VM is up and unlocked*. MinIO is weekly.
