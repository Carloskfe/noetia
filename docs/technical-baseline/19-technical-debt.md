# 19 — Technical Debt (Prioritized)

Prioritized register. Each item: **Why**, **Impact**, **Recommendation**. Severity reflects risk to a live platform with production users, data, and payments. Items depending on runtime facts not visible in code are labeled INFERRED/UNKNOWN.

## CRITICAL

### C1 — Annual-plan monthly token issuance may not be scheduled — INFERRED
- **Why:** `issueMonthlyTokensForAnnualPlans()` exists, but the only `@Cron` found is the 2 AM persona job. No scheduler invoking monthly token issuance was located.
- **Impact:** annual subscribers might not automatically receive monthly `tokensPerCycle` — a direct entitlement/billing-correctness defect.
- **Recommendation:** confirm the trigger (cron/queue/external). If missing, this is a paying-customer bug to fix first. **Verify before anything else.**

### C2 — Stripe live-vs-test mode unconfirmed — UNKNOWN
- **Why:** keys are env-provided; mode not determinable from code.
- **Impact:** if prod is on test keys, real revenue isn't captured; if a new agent assumes one mode, refunds/charges could be mishandled.
- **Recommendation:** verify `.env.production` Stripe keys and webhook endpoint mode before touching billing.

## HIGH

### H1 — No staging environment; every `main` push rebuilds & redeploys prod — CONFIRMED
- **Why:** CD deploys `main` → prod with `up -d --build`; force-removes containers, brief API downtime; `/app/transcriptions` wiped each deploy.
- **Impact:** no pre-prod validation; doc/code commits both bounce production; risk of user-facing downtime on routine changes.
- **Recommendation:** add a staging target (or blue-green / rolling) and gate prod on it.

### H2 — Decentralized admin authorization — CONFIRMED
- **Why:** `isAdmin` checked inline per controller; no `AdminGuard`.
- **Impact:** a new admin route can silently ship without the check → privilege escalation.
- **Recommendation:** introduce a single `AdminGuard`/`@Roles` decorator; audit existing admin routes for coverage.

### H3 — No revenue-split / payout engine — CONFIRMED absence
- **Why:** business model defines author/narrator/causes splits; code has `causes` + `courtesy_token_quotas` but no settlement/payout computation.
- **Impact:** author/narrator payouts and Causas allocations are not automated — a scaling blocker as the author catalog grows.
- **Recommendation:** design a settlement ledger before onboarding paid authors at volume. *(Feature gap more than debt, but high-leverage.)*

### H4 — Webhook idempotency not verified — INFERRED
- **Why:** `stripeEventId` column exists; dedup logic not confirmed line-by-line.
- **Impact:** Stripe retries could double-issue tokens/books if not guarded.
- **Recommendation:** confirm/strengthen idempotent event handling.

## MEDIUM

### M1 — No HTTP security headers (helmet/CSP/HSTS) at the API — CONFIRMED
- **Impact:** weaker defense-in-depth (clickjacking, MIME sniffing). **Recommendation:** add helmet or confirm equivalent Traefik headers.

### M2 — Search index freshness — INFERRED
- **Why:** indexing is largely CLI-driven; automatic re-index on every book create/update/publish is not confirmed.
- **Impact:** search can drift from catalog until a manual `seed-search`. **Recommendation:** ensure book mutations trigger `indexBook`/remove.

### M3 — No admin action audit log — CONFIRMED absence. **Impact:** no forensic trail for privileged operations. **Recommendation:** add an append-only admin-audit table.

### M4 — In-code default secrets fallbacks — CONFIRMED. **Impact:** a single unset prod env var silently uses a weak default (`changeme*`, `minioadmin`). **Recommendation:** fail-fast on missing critical env vars in production.

### M5 — No log aggregation / retention — CONFIRMED. **Impact:** post-incident forensics limited to ephemeral container logs. **Recommendation:** add Loki or shipped logs.

### M6 — Single-node datastore durability — CONFIRMED. **Why:** one Postgres + one MinIO node; durability rests on VPS disk + periodic backups. **Impact:** RPO/RTO bounded by backup cadence. **Recommendation:** consider managed/replicated Postgres and offsite object backups as usage grows.

### M7 — Committed VTTs ≠ served sync maps; `transcriptions/` ephemeral in container — CONFIRMED. **Impact:** the repo's VTTs are not a faithful record of live maps; re-copy needed each deploy for sync tooling. **Recommendation:** reconcile source-of-truth for sync inputs.

### M8 — Worker under-tested — CONFIRMED (2 specs). **Recommendation:** raise coverage for async jobs (image render, share export).

## LOW

- **L1 — Reader `phraseAt` is O(n) per audio tick** (CONFIRMED). Fine at current phrase counts; revisit if books grow much larger.
- **L2 — Documentation drift** (CONFIRMED): CLAUDE.md says "REST/GraphQL" but the API is REST-only; the same doc's "20-theme" claim is accurate. Reconcile docs to code.
- **L3 — No CDN in front of public `images/`** (INFERRED). Latency/cost optimization.
- **L4 — Stray repo artifacts** (`prueba.txt`, `reports/`) (CONFIRMED). Housekeeping.
- **L5 — Presigned-URL TTL coupling** (CONFIRMED): 15-min audio URLs require reader refresh logic; a longer TTL or signed-cookie approach would reduce coupling.

## Summary
The platform is **functionally mature**; most debt is **operational hardening** (staging, RBAC centralization, audit/logging, index freshness) rather than architectural. The two must-verify items (**C1 token issuance**, **C2 Stripe mode**) are correctness/revenue risks that should be confirmed immediately.
