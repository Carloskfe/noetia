# Dev VM resource limits

The local development machine (also the offsite-backup VM, see
[offsite-backups.md](offsite-backups.md)) is a **VirtualBox Ubuntu VM with
limited RAM**. When it runs out, `systemd-oomd` kills the **whole desktop
session or terminal**, and the Claude Code / shell session in it dies too.
This page records the measured limits and the rules for staying under them.

Measured 2026-11-09.

## 1. Hardware budget

| Resource | Value | Notes |
|----------|-------|-------|
| vCPU | 6 | Jest defaults to 5 workers (cores − 1). That default is unsafe here |
| RAM | 7.2 GiB | ~2.8 GiB used at idle → **~4.5 GiB available** |
| Swap | 4 GiB file (`/swap.img`) | Swapping causes memory pressure, which triggers oomd |
| Disk | 135 GB, ~62 GB free | Not a constraint |
| `/tmp` | tmpfs, 3.7 GiB | **Counts against RAM.** Don't write large files there; use the project or scratchpad dirs on disk |

### Idle baseline (~2.8 GiB)

| Consumer | Approx. RSS |
|----------|-------------|
| Docker stack: 14 containers (Noetia + AutoGuildX) | ~1.4 GiB total. Largest: `noetia-api` 320 MB, `autoguildx-pgadmin` 235 MB, `noetia-worker` 170 MB, `noetia-monitor` 160 MB |
| GNOME Shell + desktop | ~0.6 GiB |
| Host `mysqld` (not Noetia) | ~260 MB |
| Claude Code process | ~300 MB **each**. Every subagent adds another one |

## 2. What kills the session

`systemd-oomd` (config: `/etc/systemd/oomd.conf`, Ubuntu defaults) kills the
largest cgroup under `user@1000.service` when **memory pressure stays above 50%
for more than 20 s**. Everything started from the terminal (jest, tsc,
`next build`, Claude Code itself) runs in that slice. A spike in memory use there
kills GNOME Shell or the terminal scope, not just the process that caused it.

Observed kills: 2026-11-08 18:53 (GNOME Shell) and 18:59 (terminal scope);
2026-11-09 08:00 and 08:15 (GNOME Shell). Check for new ones with:

```bash
journalctl -u systemd-oomd --since "-1 day" --no-pager | grep Killed
journalctl --user --since "-1 day" --no-pager | grep -i oom
```

## 3. Measured cost of common workloads

| Workload | Extra RAM | Pressure | Result |
|----------|-----------|----------|--------|
| `api` full suite, `jest --maxWorkers=2` (69 suites, 948 tests, ~40 s) | **~1.75 GiB** peak | <0.4% | ✅ safe |
| `api` full suite, default 5 workers | ~4+ GiB (projected: ~0.85 GiB per ts-jest worker) | swapping | ❌ more than is available → oomd kill |

## 4. Rules (humans and AI agents)

1. **Always cap Jest workers:** `npx jest --maxWorkers=2` (or `npm test -- --maxWorkers=2`).
   For one or a few spec files, use `--runInBand`. Run only the targeted
   specs while iterating, and the full suite once at the end.
2. **One heavy job at a time.** Never run two test suites, a `tsc`, a
   `next build` or a `docker compose build` concurrently. That includes
   parallel tool calls from an agent.
3. **Cap the TypeScript heap:** `NODE_OPTIONS=--max-old-space-size=1536 npx tsc --noEmit`.
4. **Docker builds one service at a time:** `docker compose build <service>`
   (or `COMPOSE_PARALLEL_LIMIT=1`). Avoid a bare `docker compose up -d --build`
   that rebuilds everything at once.
5. **No more than one subagent at a time.** Each one is another ~300 MB
   Claude process plus whatever it runs.
6. **Check headroom before heavy work:** `free -m` → `available` should be
   **≥ 2500 MB**. If it isn't, free memory first (step 7).
7. **Free memory when needed.** The non-Noetia containers are optional for
   Noetia work:
   ```bash
   docker stop autoguildx-pgadmin-1 autoguildx-web-1 autoguildx-api-1 autoguildx-postgres-1  # ~400 MB
   docker stop noetia-monitor-1                                                             # ~160 MB (Grafana)
   ```
   They have `restart: unless-stopped`, so they stay stopped until you start
   them again (`docker start <name>`) or run `compose up`.
8. **Don't use `/tmp` for big files.** It is RAM-backed (tmpfs).

## 5. Increasing the limits

If you need more headroom, raise the VM's RAM in VirtualBox (VM powered off →
Settings → System → Base Memory). 10–12 GiB would allow `--maxWorkers=3–4`.
Re-measure after any change and update this page.
