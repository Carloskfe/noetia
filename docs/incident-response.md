# Incident Response Playbook

Quick-reference for the most common production incidents on the Noetia stack. SSH in first:
```bash
ssh -p 222 root@84.247.140.175
cd /opt/noetia
```

---

## 1. Traefik 502 / 404

**Symptom:** `https://noetia.app` or `https://noetia.app/api/*` returns 502 or 404.

**Diagnosis — in order:**

```bash
# 1. Are containers healthy?
docker ps
# Look for (healthy) vs (unhealthy) or (starting). Unhealthy = Traefik drops the route.

# 2. Check health details on the unhealthy container
docker inspect <container> --format "{{.State.Health.Status}}"
docker inspect <container> --format '{{range .State.Health.Log}}Exit={{.ExitCode}} Output={{.Output}}{{"\n"}}{{end}}'

# 3. Can Traefik reach the container directly?
docker exec traefik wget -qO- http://<container_ip>:3000   # web
docker exec traefik wget -qO- http://<container_ip>:4000/health  # api

# 4. Is the container on the proxy network?
docker network inspect proxy | grep -A3 '"Name": "noetia'
```

**Known root causes:**
- **Next.js binds to wrong interface** — needs `HOSTNAME: "0.0.0.0"` in compose (already set in `docker-compose.server.yml`; verify if containers were recreated outside compose)
- **Alpine wget resolves `localhost` as `::1`** — healthchecks must use `127.0.0.1`, not `localhost`; a failing healthcheck marks container unhealthy → Traefik drops it
- **Traefik config corrupted** — see §2 below

**Fix container binds:**
```bash
docker compose --env-file .env.production -f docker-compose.server.yml up -d --force-recreate web api
```

---

## 2. Traefik config corrupted

**Symptom:** Traefik container is down or logs show YAML parse errors.

**⚠️ Never paste multi-line content via SSH** — the terminal corrupts line breaks. Use nano or base64.

```bash
# Check what's wrong
docker logs traefik --tail 20

# Edit safely
nano /opt/traefik/traefik.yml
# Ctrl+K to delete lines, paste content, Ctrl+O to save, Ctrl+X to exit

# Or base64 (immune to newline corruption — generate on local, apply on server)
# Local: python3 -c "import base64; print(base64.b64encode(open('file').read().encode()).decode())"
echo <BASE64> | base64 -d > /opt/traefik/traefik.yml

# If indentation is broken (extra spaces):
sed -i 's/^  //' /opt/traefik/traefik.yml

# Restart
docker restart traefik
docker logs traefik --tail 10
```

Traefik config is at `/opt/traefik/traefik.yml`. Must have exact 2-space YAML indentation.

---

## 3. Container crash loop / OOM

**Symptom:** Container restarts repeatedly; Grafana alerts on "Container Restarted".

```bash
# Which container?
docker ps -a | grep -E "Restarting|Exited"

# Last 50 log lines before the crash
docker logs noetia-api-1 --tail 50
docker logs noetia-web-1 --tail 50

# OOM check
docker inspect noetia-api-1 | grep -i oom
dmesg | grep -i "oom\|killed" | tail -20

# Memory pressure
free -h
docker stats --no-stream
```

**Fix — OOM on api:** the NestJS container has no memory limit set in dev but has resource constraints in `docker-compose.server.yml`. If the host is under pressure:
```bash
# Free up space
docker system prune -f
# Check disk
df -h
```

---

## 4. Database unreachable

**Symptom:** API logs show `ECONNREFUSED` or `connection refused` to PostgreSQL.

```bash
# Is the db container running?
docker ps | grep noetia-db

# Can the api reach it?
docker compose --env-file .env.production -f docker-compose.server.yml exec -T api \
  node -e "require('pg').Pool({host:'db',port:5432,user:'noetia',password:'...',database:'noetia'}).query('SELECT 1').then(()=>console.log('OK')).catch(console.error)"

# DB logs
docker logs noetia-db-1 --tail 30

# Restart db (data is on a named volume — safe to restart)
docker compose --env-file .env.production -f docker-compose.server.yml restart db
```

**Backups:** daily cron runs at 2 AM, 7-day rolling retention. Backup files are at `/opt/noetia/backups/` on the host. Encrypted offsite copies and restore steps: [`operations/offsite-backups.md`](operations/offsite-backups.md). The offsite copy is operator-assisted, not unattended: it needs the Windows host + Ubuntu VM running and the SSH key unlocked after each VM reboot. Before relying on it in an incident, confirm the latest `.age` file date. For offsite-job failures (SSH denied, share missing, service failing) see its [§9 Troubleshooting](operations/offsite-backups.md#9-troubleshooting).

---

## 5. MinIO unreachable / wrong bucket policy

**Symptom:** Cover images or share images not loading; 403 on presigned URLs; API logs show `S3ServiceException`.

```bash
# Is MinIO up?
docker ps | grep noetia-storage

# Can the api reach it? (through the S-ALT alias the api's S3 client actually uses — see §10)
docker compose --env-file .env.production -f docker-compose.server.yml exec -T api \
  wget -qO- http://noetia-storage.internal:9000/minio/health/live

# Check bucket policies (images must be public)
# Access MinIO console via SSH tunnel on your local machine:
# ssh -p 222 -L 9001:localhost:9001 root@84.247.140.175
# Then open http://localhost:9001 and check Buckets → images → Access Policy → public
```

**Bucket policy rule:** `books/` and `audio/` must be **private** (presigned URLs only). `images/` must be **public** (direct download for share cards). If the policy was accidentally reset, re-apply via the MinIO console or MC CLI.

---

## 6. SSL certificate not renewing

**Symptom:** Browser shows "certificate expired"; `https://noetia.app` shows TLS error.

Traefik handles Let's Encrypt renewal automatically via `acme.json`. Renewal happens ~30 days before expiry.

```bash
# Check cert expiry
echo | openssl s_client -connect noetia.app:443 -servername noetia.app 2>/dev/null | \
  openssl x509 -noout -dates

# Check Traefik ACME logs
docker logs traefik 2>&1 | grep -i "acme\|certif\|renew" | tail -20

# Force renewal (Traefik will retry on restart if close to expiry)
docker restart traefik
```

If `acme.json` is corrupted (should never happen but can):
```bash
# ⚠️ This deletes all certs — Traefik will re-request them on restart (~30s)
rm /opt/traefik/acme.json && touch /opt/traefik/acme.json && chmod 600 /opt/traefik/acme.json
docker restart traefik
```

**Prerequisite:** Cloudflare DNS must be gray-cloud (DNS-only) for HTTP-01 challenge to work. Do not enable Cloudflare proxy (orange cloud) on `noetia.app` or `storage.noetia.app`.

---

## 7. Auto-deploy (CI/CD) failing

**Symptom:** GitHub Actions workflow fails; changes pushed to `main` are not deployed.

Check the Actions tab on GitHub for the specific error. Common causes:

| Error | Fix |
|-------|-----|
| `Permission denied (publickey)` | `DEPLOY_SSH_KEY` secret expired or rotated — re-add at `/root/.ssh/deploy_key` and update GitHub secret |
| `docker compose: command not found` | Docker or compose plugin version issue on server — check `docker compose version` |
| Migration fails with `relation "X" already exists` | Migration was partially applied — check `migrations` table, remove the stuck row, retry |
| Container exits immediately after build | Check `docker logs <container>` for startup errors; often a missing env var |

Manual deploy (same steps as CI):
```bash
ssh -p 222 root@84.247.140.175
cd /opt/noetia
git pull origin main
docker compose --env-file .env.production -f docker-compose.server.yml up -d --build
docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e DB_HOST=db api npm run migration:run:prod
```

---

## 8. Grafana unreachable

See [`docs/grafana-monitoring.md`](grafana-monitoring.md) — full troubleshooting, password reset procedure, and incident history.

Quick check:
```bash
# On your device — is Tailscale running?
tailscale status

# Is Grafana up?
docker ps | grep noetia-monitor
```

URL: `http://100.84.48.16:3001` (Tailscale only — not reachable via public IP or SSH tunnel).

---

## 9. SSH refused / total SSH lockout (sshd disabled)

**Symptom:** `ssh -p 222 root@84.247.140.175` returns **`Connection refused`** on 222 *and* 22, while the **site stays up** (containers auto-restart independently of sshd). CI/CD auto-deploy also silently fails (it SSHes in). `Connection refused` (not `timeout`) = host reachable, **no sshd listener**.

**Confirmed root cause (2026-07-15 incident, 30-hour lockout):** an **automatic `openssh-server` upgrade** (`apt-daily`, ~06:12) **disabled `ssh.service`** to hand off to Ubuntu 24.04's socket-activation model — but `ssh.socket` was already `disabled`, so *neither* unit came up. A reboot does **not** fix it (disabled at boot).

### Recover — via Contabo VNC console (the only way in when sshd is down)
1. **Contabo panel** → your VPS → **VNC**: *enable* it (off by default; enabling **requires a reboot** — use the panel's **Restart** button, all containers are `restart: unless-stopped` so the site recovers on its own). Cycling VNC off→on clears a stale/refusing listener.
2. **VNC host is NOT the server IP** — it's Contabo's console host **`161.97.77.108`** (server public IP is `84.247.140.175`), on the panel's port (e.g. `63041`) with the panel's VNC password.
3. Connect from your machine: `sudo apt install -y tigervnc-viewer` then `xtigervncviewer 161.97.77.108::<PORT>` (**double colon** = raw port). First connect may drop with `End of stream` — retry 2–3×.
4. At the console, log in as `root` with the **OS root password** (not the VNC password), then bring sshd back:
   ```bash
   systemctl enable --now ssh    # start now + enable on boot
   ss -tlnp | grep ssh           # confirm listening on :222
   ```

### Permanent fix (prevents recurrence) — mask the socket
```bash
systemctl mask ssh.socket                      # hard-override: upgrades can't hand off to it
systemctl is-enabled ssh.service ssh.socket    # expect: enabled / masked
```
`ssh.service` runs standalone and binds :222 from `sshd_config`; `disable` alone is not enough (a package preset can flip it back — that's what caused the incident). Applied 2026-07-15.

### Diagnose why it happened (if it recurs despite the mask)
```bash
journalctl -u ssh --no-pager | grep -iE 'stopp|start|deactiv' | tail -20   # when sshd went down
zgrep -iE 'openssh' /var/log/apt/history.log* 2>/dev/null | grep -i upgrade  # was openssh upgraded then?
```

---

## 10. Internal alias (S-ALT) missing: `/api/*` or share pages 500, storage errors

**Background.** `api`, `web` and `storage` sit on two networks: `noetia_noetia_net` (ours) and the shared
`proxy` network, where AutoGuildX (and any future project) also advertises generic names such as `api`.
Docker answers a name from whichever attached network has it, so while our api was stopped or being
recreated, `http://api:4000` from `web` reached **AutoGuildX's api**, carrying the reader's token, cookies and
request body (S19). Internal callers therefore use only project-unique aliases declared on `noetia_net`:

| Caller | Setting (literal in `docker-compose.server.yml`) | Alias owner |
|---|---|---|
| web `/api/*` rewrite (baked at build) | `build.args.INTERNAL_API_URL=http://noetia-api.internal:4000` | `api` |
| web share page SSR `/s/[id]` (runtime) | `environment.INTERNAL_API_URL=http://noetia-api.internal:4000` | `api` |
| api S3 client (uploads, `getText`, ingestion) | `environment.MINIO_ENDPOINT=noetia-storage.internal` | `storage` |

The `.internal` suffix is reserved and never resolves in public DNS, so a missing alias fails closed
(`ENOTFOUND`), whereas a bare name like `noetia-api` would be forwarded to the host resolver and can be
answered by Tailscale MagicDNS (search domain `tail52ba4d.ts.net`). Presigned and public storage URLs still
use `MINIO_PUBLIC_URL` (`https://storage.noetia.app`) and are unaffected.

**Symptom:** `/api/*` returns 500 from Next (not 502 from Traefik) while `noetia.app/api/health` via
Traefik is fine; or `/s/<id>` share pages 500; or reader audio/text fails with S3 errors. **CD can be green
while this happens** — `up --wait` only checks container healthchecks.

**Diagnosis (read-only):**
```bash
# 1. Aliases present, on noetia_net only? Expect noetia-api.internal on api, noetia-storage.internal on storage.
for c in noetia-api-1 noetia-storage-1 noetia-web-1; do docker inspect -f '{{.Name}}{{range $k,$v := .NetworkSettings.Networks}} | {{$k}}: {{join $v.DNSNames ","}}{{end}}' $c; done
# 2. Resolution from the callers (expect an IP on noetia_noetia_net, never ENOTFOUND)
docker exec noetia-web-1 node -e "require('dns').lookup('noetia-api.internal',(e,a)=>console.log(e?e.code:a))"
docker exec noetia-api-1 node -e "require('dns').lookup('noetia-storage.internal',(e,a)=>console.log(e?e.code:a))"
# 3. Values in effect (runtime env + the rewrite baked into the image)
docker exec noetia-web-1 printenv INTERNAL_API_URL
docker exec noetia-web-1 sh -c "grep -o '\"destination\":\"http[^\"]*\"' .next/routes-manifest.json"
docker exec noetia-api-1 printenv MINIO_ENDPOINT
```

**Known root causes and fixes:**
- **Container recreated outside compose** (`docker run`, Portainer, manual `docker network connect`) — aliases
  only exist when compose creates the container. Recreate through compose:
  `docker compose --env-file .env.production -f docker-compose.server.yml up -d --no-deps api storage web`
- **Image built without the compose build arg** (e.g. `docker build` by hand) — the Dockerfile default is the
  alias too, so this only happens with an explicit `--build-arg INTERNAL_API_URL=...`. Rebuild with compose.
- **Never "fix" an outage by pointing `INTERNAL_API_URL`/`MINIO_ENDPOINT` back at `api`/`storage`** — that
  re-opens S19 (credentials can reach another project's api). If the aliases cannot be restored, roll back
  by reverting the S-ALT PR through the normal merge → CD path; that returns to the previous (exposed) state.

**What S-ALT does not cover** (see `infra/tests/s-alt/README.md`): AutoGuildX → Noetia when *AutoGuildX's*
api is down (their generic `api` lookup can still reach ours), and raw container-name / IP reachability on
the shared `proxy` network. Those need network separation (PR #62 / NEM-018).

