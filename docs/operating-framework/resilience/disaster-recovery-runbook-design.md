# Disaster Recovery Runbook — Design

**NOF-003** · The structure a future runbook must have. **The runbook itself is
implementation work and is not written here.**

## Design requirement

> An authorized operator who is **not** the original engineer must be able to recover Noetia
> using only the runbook and the credential vault.

Today that is impossible: no restore procedure is documented anywhere, the only document
mentioning backups gives the wrong path, and the secrets required to start anything exist
solely on the machine being recovered.

## Required sections

**1. Incident classification** — DR-01…DR-19 mapped to severity, with the boundary between
"recover in place" and "declare disaster and rebuild."

**2. Authority to declare** — who declares, who may execute destructive recovery, who must be
informed. Absent today.

**3. Prerequisites** — Contabo console access · domain registrar · Cloudflare · GitHub ·
credential vault · Stripe dashboard. Each with **where the credential lives**, never the value.

**4. Infrastructure recreation** — provision VPS · run corrected `init.sh` · **verify SSH port
matches sshd (currently a known mismatch)** · create `proxy` network · start Traefik ·
`acme.json` permissions 600.

**5. Data restoration** — in the order in
[restore-strategy.md](restore-strategy.md): secrets → PostgreSQL → MinIO → derived state.

**6. Verification** — the criteria in [restore-test-plan.md](restore-test-plan.md). Explicitly:
*"PostgreSQL started" is not verification.*

**7. DNS and traffic** — Cloudflare A records to the new IP, **gray cloud** (Traefik needs
HTTP-01), then confirm certificate issuance for `noetia.app` and `storage.noetia.app`.

**8. Rollback** — what to do when the restore itself fails or proves corrupt: fall back to an
older recovery point, and the maximum number of attempts before escalating.

**9. Communications** — user notification, creator notification if obligation data is
affected, and a status channel. `LEGAL REVIEW REQUIRED` for breach/loss notification duties.

**10. Post-incident review** — timeline, root cause, actual RPO/RTO achieved versus target,
and corrective actions. Feed measured figures back into [rpo-rto.md](rpo-rto.md).

## Hard-won operational rules the runbook must carry

Drawn from documented incidents:

- **Never paste multi-line content into an SSH terminal** — caused a 2-hour outage 2026-05-12.
  Use `nano` or single-line `base64`.
- **Alpine healthchecks must use `127.0.0.1`**, not `localhost` — `busybox wget` resolves IPv6
  `::1`, the container is marked unhealthy, and Traefik drops the route.
- **Next.js requires `HOSTNAME=0.0.0.0`** or Traefik gets a 502.
- **`NEXT_PUBLIC_*` are baked at build time** — a rebuilt web image must carry the right build
  args or it will point at the wrong environment.
- **Traefik config is whitespace-sensitive**; restart Traefik after any edit.

These are exactly the details a substitute operator would not know, and each has already cost
time once.
