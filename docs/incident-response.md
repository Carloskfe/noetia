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

**Backups:** daily cron runs at 2 AM, 7-day rolling retention. Backup files are at `/opt/noetia/backups/` on the host.

---

## 5. MinIO unreachable / wrong bucket policy

**Symptom:** Cover images or share images not loading; 403 on presigned URLs; API logs show `S3ServiceException`.

```bash
# Is MinIO up?
docker ps | grep noetia-storage

# Can the api reach it?
docker compose --env-file .env.production -f docker-compose.server.yml exec -T api \
  wget -qO- http://storage:9000/minio/health/live

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
| Migration fails with `relation "X" already exists` | Migration was partially applied — check `typeorm_migrations` table, remove the stuck row, retry |
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
