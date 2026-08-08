# 17 — Observability

## Error tracking — CONFIRMED
- **Sentry** wired in all three runtimes:
  - API: `@sentry/nestjs` + `@sentry/profiling-node` (`instrument.ts` calls `Sentry.init`).
  - Web: `@sentry/nextjs` (`sentry.client/server/edge.config.ts`).
- Activation is env-gated: the SDK **no-ops when the DSN is unset** (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`). Whether DSNs are set in production is **UNKNOWN** from code.

## Metrics — CONFIRMED (`metrics` module)
- **Prometheus** exposition via `prom-client`:
  - `collectDefaultMetrics()` (process/node metrics).
  - Custom middleware records `http_requests_total` (Counter) and `http_request_duration_seconds` (Histogram), labeled per route/method/status.
- Exposed at `GET /metrics`.
- Scraped by the `prometheus` service; host metrics via `node-exporter`; container metrics via `cadvisor`.

## Dashboards & alerting — CONFIRMED
- **Grafana** (`monitor` service) for dashboards, reachable via **Tailscale** (`100.84.48.16:3001`), not a public port. Docs: `docs/grafana-monitoring.md`.
- Alerting uses an `or vector(0)` pattern to avoid false-positive `DatasourceNoData` alerts (per CLAUDE.md). Specific alert rules were **not** enumerated here → **INFERRED** limited alerting exists.

## Health checks — CONFIRMED
- API `GET /health` (`health` module).
- Container healthchecks defined in compose; production note: Alpine healthchecks must use `127.0.0.1` (busybox `wget` resolves `localhost` to IPv6 and fails) — a documented gotcha.
- Next.js requires `HOSTNAME=0.0.0.0` in prod to bind all interfaces (else Traefik 502) — documented.

## Logging — CONFIRMED / INFERRED
- NestJS built-in `Logger` used throughout (e.g. webhook signature failures, event-emit failures, alignment logs). Structured/JSON logging is **INFERRED not configured** (default Nest logger format).
- No centralized log aggregation stack (no ELK/Loki in compose). Logs are per-container via Docker (`docker compose logs`). **CONFIRMED absence** of a log pipeline.

## Incident tooling — CONFIRMED
- `docs/incident-response.md` — 8 production playbooks (Traefik 502/404, OOM, DB, MinIO, SSL, CI/CD, Grafana).
- `docs/secrets-rotation.md` — rotation procedures.

## Gaps — INFERRED
- No distributed tracing (Sentry performance is available but tracing spans across services not evidenced).
- No uptime/synthetic monitoring on the public endpoints observed in-repo (an external probe is a backlog item — e.g. alert when port 222/SSH or the site stops answering).
- Logs are ephemeral (no retention/aggregation) — a gap for post-incident forensics.
