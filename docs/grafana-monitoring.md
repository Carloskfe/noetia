# Grafana Monitoring — Operations Guide

## Access

Grafana is accessible **only via Tailscale** — it is not exposed to the public internet.

| Property | Value |
|----------|-------|
| URL | `http://100.84.48.16:3001` |
| Username | `admin` |
| Password | stored in `.env.production` as `GRAFANA_ADMIN_PASSWORD` |
| Network | Tailscale private network only |

**Requirement:** Tailscale must be running on your device before you can access this URL.

---

## Architecture

```
Your browser
     │  (Tailscale private network)
     ▼
100.84.48.16:3001  ←── Grafana 11.3.0 (Docker)
                              │
                        Prometheus 
                        (internal Docker network)
                              │
                   ┌──────────┼──────────┐
                cadvisor  node-exporter  noetia-api
```

Grafana is bound to the server's Tailscale IP (`100.84.48.16`). It is NOT reachable via the public IP (`84.247.140.175`), localhost, or any SSH tunnel.

---

## Tailscale Setup

If you need to access Grafana from a new device:

1. Install Tailscale: [tailscale.com/download](https://tailscale.com/download)
2. Log in with the Noetia Tailscale account
3. Open `http://100.84.48.16:3001` in your browser

Tailscale devices in the network:
- `vmi3291506` — Contabo production server (`100.84.48.16`)
- Local Linux VM
- Windows host

---

## Alert Rules

Three alert rules are provisioned via `infra/grafana/provisioning/alerting/rules.yml`. They evaluate every minute.

| Rule | Condition | Severity | Action |
|------|-----------|----------|--------|
| High API Error Rate | 5xx rate > 5% for 5 min | Critical | `docker logs noetia-api-1 --tail 50` |
| High Disk Usage | Disk > 80% | Warning | `docker system prune` or expand storage |
| Container Restarted | Any noetia container restarted in last 10 min | Warning | `docker ps` to identify which one |

Alert notifications are sent to `carloskfe@gmail.com` via Resend SMTP (`alerts@noetia.app`).

### Modifying alert rules

Edit `infra/grafana/provisioning/alerting/rules.yml`, commit, push, then restart Grafana:

```bash
cd /opt/noetia && git pull
docker compose --env-file .env.production -f docker-compose.server.yml restart monitor
```

**Important:** Never use Go template syntax (`{{.Field}}`) in alert `description` or `summary` fields — Grafana's template engine will try to evaluate them and log errors every minute. Use plain text instead.

---

## Prometheus Scrape Targets

Three targets are scraped every 15 seconds:

| Target | What it monitors |
|--------|-----------------|
| `cadvisor` | Docker container CPU, memory, restart counts |
| `node-exporter` | Host disk, memory, CPU, network |
| `noetia-api` | HTTP request counts and latencies (`/api/metrics`) |

Check target health:
```bash
docker exec noetia-prometheus-1 wget -qO- 'http://localhost:9090/api/v1/targets' | python3 -m json.tool | grep -E '"health"|"scrapePool"'
```

All three should show `"health": "up"`.

---

## Password Management

**CRITICAL:** `GF_SECURITY_ADMIN_PASSWORD` in `.env.production` is only read on Grafana's very first boot. Changing it later has no effect on the running instance.

### To reset the admin password:

```bash
docker compose --env-file .env.production -f docker-compose.server.yml exec -T monitor grafana cli admin reset-admin-password 'NEW_PASSWORD'
```

Always use single quotes to prevent shell interpretation of special characters.

After resetting, update `.env.production` on the server to keep it in sync:
```bash
nano /opt/noetia/.env.production
# Update: GRAFANA_ADMIN_PASSWORD=NEW_PASSWORD
```

---

## Troubleshooting

### Can't reach http://100.84.48.16:3001
1. Check Tailscale is running: `tailscale status` on your device
2. Check Grafana container is up: `docker ps | grep monitor`
3. Check Grafana is bound to Tailscale IP: `docker inspect noetia-monitor-1 | grep -A5 Ports`

### Login fails (wrong password)
Reset via CLI — see Password Management above.

### Alert emails stopped arriving
1. Check Grafana SMTP config is loaded: `docker logs noetia-monitor-1 | grep smtp`
2. Verify Resend API key is valid in `.env.production`
3. Check alert rules are in Normal/Pending/Firing state in Grafana UI

### DatasourceNoData alerts firing (false positives)
This means a Prometheus query returned no data. All alert rules use `or vector(0)` to prevent this. If it recurs, check:
```bash
docker exec noetia-prometheus-1 wget -qO- 'http://localhost:9090/api/v1/targets' | python3 -m json.tool | grep health
```

### Grafana logs template errors
The alert `description` field contains Go template syntax (`{{.Field}}`). Replace with plain text in `infra/grafana/provisioning/alerting/rules.yml`.

---

## Incident History

| Date | Issue | Resolution |
|------|-------|------------|
| 2026-05-21 to 2026-05-22 | 28-hour outage — admin password unknown, browser login broken | Password reset via CLI; workaround via cookie injection |
| 2026-05-22 | `DatasourceNoData` false positive alerts | Added `or vector(0)` to alert PromQL queries |
| 2026-05-22 | Template error in Container Restarted alert every minute | Removed `{{.Names}} {{.Status}}` Go template from description |
| 2026-05-24 | Browser login permanently broken via SSH tunnel | Switched to Tailscale; bound Grafana to Tailscale IP `100.84.48.16` |
