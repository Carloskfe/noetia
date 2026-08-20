# Disaster Recovery Runbook

**NEM-009 · OPERATIONAL** · For an authorized operator who may not be the original engineer.

> **🔐 marks a step requiring Product Owner authorization (PO-018).**
> Containment is permitted without authorization; **restoration is not.**

**Canonical SSH port is 222 (PO-019).** Never open port 22 as permanent access.

---

## 0 · Before you touch anything

- Do not restore to "fix" an unclear problem. Establish what failed first.
- **Preserve evidence.** Do not delete volumes or logs — a corrupted volume is diagnosable.
- Note the time. Every later step depends on knowing the incident window.

## 1 · Classify

| Symptom | Scenario | Path |
|---|---|---|
| Container down, data intact | DR-01 | §2 restart |
| Service up, data wrong/missing | DR-03/DR-11 | 🔐 §5 restore |
| Volume gone | DR-02/DR-04/DR-05 | 🔐 §5 / §6 |
| Host unreachable, provider OK | DR-07 | §4 rebuild |
| Provider/account lost | DR-08 | §4 elsewhere |
| Suspected intrusion | DR-12/DR-13 | §3 contain **first** |

## 2 · Restart (non-destructive, no authorization needed)

```bash
cd /opt/noetia
docker compose --env-file .env.production -f docker-compose.server.yml ps
docker compose --env-file .env.production -f docker-compose.server.yml restart <service>
curl -o /dev/null -w "web:%{http_code}\n" https://noetia.app
curl -o /dev/null -w "api:%{http_code}\n" https://noetia.app/api/books
```

Named volumes survive restarts. If this resolves it, stop here and record the incident.

## 3 · Contain (permitted without authorization; do not restore yet)

Stop the damage, preserve the evidence: stop the offending service, block the source, revoke
exposed credentials at the **provider**, and **do not** delete data. Then escalate to the
Product Owner.

## 4 · Rebuild a clean host

```bash
# Provider console → new VPS, Ubuntu 24.04
# Provider may deliver SSH on 22: that is a TEMPORARY RECOVERY BOOTSTRAP only.
scp -P <port> infra/server/init.sh root@<new-host>:/root/
ssh -p <port> root@<new-host> 'bash /root/init.sh'
```

`init.sh` configures sshd for **222**, validates with `sshd -t`, opens UFW 222 *before*
restarting sshd, installs Docker and fail2ban, creates `/opt/*` and the `proxy` network.

**Prove port 222 from a SECOND terminal before closing your first session:**

```bash
ssh -p 222 root@<new-host> 'echo OK'
ufw delete allow 22/tcp     # only if a bootstrap on 22 was used
```

Then Traefik:

```bash
cd /opt/traefik && touch acme.json && chmod 600 acme.json && docker compose up -d
```

## 5 · 🔐 Restore secrets, then PostgreSQL

**Secrets first — a dump is inert without `DB_PASS`** ([secret-recovery.md](secret-recovery.md)).

```bash
git clone https://github.com/Carloskfe/noetia.git /opt/noetia
# place .env.production from the vault; chmod 600
git -C /opt/noetia check-ignore -v .env.production   # must match before any git add
```

Retrieve the newest verified recovery point, decrypt on the **workstation** holding the age
private key (never on the server), then **validate in isolation before going live**:

```bash
/opt/noetia/infra/server/restore-db.sh --file <dump> --project noetia_restore_test
```

Only once that reports `RESTORE VALIDATED` should the dump be restored into the real stack.

## 6 · 🔐 Restore MinIO

Irreplaceable classes from the off-site copy. Reconstructable public-domain content from
upstream using the manifest (PO-016):

```bash
docker compose --env-file .env.production -f docker-compose.server.yml exec -T api node dist/ingestion/seed-ingestion.js
# audio: seed-audio*.js — hours; 3 titles are known to fail upstream
```

## 7 · Validate before restoring traffic

Ownership and token counts reconcile (`restore-db.sh` reports these) · login works · an owned
book opens · Escucha Activa plays for one title · search returns results after reindex.

**If ownership counts do not reconcile, stop and escalate.** Serving a user a smaller library
silently is worse than staying down.

## 8 · Restore traffic

Cloudflare A records → new IP, **DNS-only (gray cloud)** — Traefik needs HTTP-01. Then confirm
certificates issue for `noetia.app` and `storage.noetia.app`.

## 9 · 🔐 Reconcile Stripe

[stripe-reconciliation.md](stripe-reconciliation.md). Produces a report; **moves no money**.

## 10 · Post-incident

Timeline · root cause · **measured RPO/RTO vs PO-014/PO-015** · corrective actions. Feed the
measured figures back into [rpo-rto.md](rpo-rto.md) — targets become capability only when
observed.

---

## Operational rules that have already cost time once

- **Never paste multi-line content into an SSH terminal** — 2-hour outage, 2026-05-12. Use `nano`.
- **Alpine healthchecks must use `127.0.0.1`**, not `localhost` (busybox resolves IPv6 `::1` → unhealthy → Traefik drops the route).
- **Next.js needs `HOSTNAME=0.0.0.0`** or Traefik returns 502.
- **`NEXT_PUBLIC_*` are baked at build time** — a rebuilt web image needs the right build args.
- **Traefik config is whitespace-sensitive**; `docker restart traefik` after edits.
- **`pg_restore -j` cannot read stdin** — restore from a file path, never a pipe.
