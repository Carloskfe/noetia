# Noetia — Executive Summary

**Mission:** NEM-001 Repository Archaeology & Technical Baseline
**Audience:** CEO · Chief Product Officer · Lead Architect · Lead Engineer
**Nature:** Factual baseline from source code. No redesign, no implementation. Labels: CONFIRMED / INFERRED / UNKNOWN.

---

## 1. Current maturity

**Noetia is a functionally mature, production-live platform — not a prototype.** (CONFIRMED)

It is a bilingual (ES/EN) multimodal reading platform whose differentiator is **Escucha Activa** — phrase-level synchronized reading + audio. The stack is a **modular monolith**: a NestJS API (24 feature modules), a Next.js web app, a React Native/Expo mobile app, a Python image service, and a BullMQ worker, on PostgreSQL 16 / Redis / Meilisearch / MinIO, deployed to a single Contabo VPS behind Traefik with GitHub Actions CI/CD.

Breadth of **shipped, code-backed** capability is high:
- Auth (JWT + rotating refresh + Google/Facebook/Apple OAuth), email confirmation, password reset.
- Catalog, free library (ingested), author uploads with review/publish, hosting-tier limits.
- The reader: paged + scroll, Escucha Activa sync, highlights (auto-themed), notes, offline (mobile).
- Quote-card generation + social sharing with public invite pages and visit tracking.
- Stripe subscriptions (Individual/Duo/Family, shared token pools), one-time book purchases, token packages, gift cards; signature-verified webhooks.
- A 90-day **token ledger** entitlement system with courtesy quotas for contributors.
- Reading clubs with real-time "Escucha Juntos" co-listening, discussions, polls, sessions.
- A first-party analytics stack: event stream, daily reading stats/streaks, and a **nightly persona pipeline** (archetypes, cadence, 20-theme taxonomy).
- 66 ordered DB migrations; ~122 unit-test spec files across services with an 80% CI coverage gate; Sentry + Prometheus + Grafana wired.

**Engineering discipline is real** (CONFIRMED): migrations-only schema changes, mirrored unit tests, documented incident/rotation playbooks, nightly DB + weekly object backups.

---

## 2. Greatest strengths

1. **The sync engine is a genuine, reusable asset.** (CONFIRMED) A self-contained text↔audio alignment pipeline — splitter, Whisper parser, drift-corrected aligner, quality gate (≥90%), diagnostics, gated re-seed — recently hardened and verified in production. It is the crown jewel and is content-agnostic.
2. **Clean bounded-context modularity.** (CONFIRMED) Each domain is a NestJS module with its own controller/service/entities/DTOs; shared infrastructure (storage, events, search) is injected. Easy to reason about and extend.
3. **A complete monetization spine.** (CONFIRMED) Stripe + a flexible, expiring, poolable **token ledger** already model subscriptions, one-time purchases, gifts, and contributor grants — a rare thing to have fully wired at this stage.
4. **Latent personalization + growth data.** (CONFIRMED) Personas are already computed nightly, and the fragment→quote-card→share→invite-page loop already persists referral attribution (`createdById`) and visit counts. The data to power recommendations and viral growth largely **already exists**.
5. **Cross-platform + international from day one.** (CONFIRMED) Web + mobile, ES/EN, three OAuth providers, offline mobile sync.

---

## 3. Greatest risks

**Two must-verify items (do first):**
- **Annual-plan monthly token issuance may not be scheduled** (INFERRED, CRITICAL). The issuance method exists but no cron/trigger was found — potential paying-customer entitlement bug.
- **Stripe live-vs-test mode is unconfirmed from code** (UNKNOWN, CRITICAL). Must be verified before any billing change.

**Structural / operational risks (CONFIRMED):**
- **No staging environment.** Every push to `main` rebuilds and redeploys production with a brief downtime window. High release risk for a platform with live payments.
- **Decentralized admin authorization.** `isAdmin` is checked inline per controller with no central `AdminGuard` — a new admin route can ship without protection (privilege-escalation risk).
- **No revenue-split/payout engine.** The business model implies author/narrator/causes splits; there is no settlement code. A scaling blocker for a paid author catalog.
- **Defense-in-depth gaps.** No `helmet`/CSP/HSTS at the API; no admin audit log; no log aggregation; in-code default secrets as env fallbacks.
- **Single-node datastores.** One Postgres + one MinIO; durability rests on VPS disk + periodic backups (RPO/RTO bounded by backup cadence).

None of these are architectural dead-ends; all are **hardening and process**, not rebuilds. Full register in [19-technical-debt.md](19-technical-debt.md).

---

## 4. Highest-leverage opportunities

1. **Expose the personas you already compute.** (CONFIRMED data, no surface) A recommendation/insights service over `user_personas` + `events` is the single biggest "build on existing data" win — for readers (recommendations) and authors (archetype analytics).
2. **Widen the event stream.** (CONFIRMED) The generic `events` sink is emitted for only two event types today; richer emission unlocks funnels, triggers, and premium analytics with no new infrastructure.
3. **Complete the growth loop.** (CONFIRMED) Referral attribution groundwork already exists on `shares` — activating it turns the sharing feature into a measurable acquisition channel.
4. **Reuse the sync engine for new content verticals.** (CONFIRMED) Any text+audio product (author audio, language learning, podcasts) can ride the existing pipeline.
5. **Token ledger as a universal entitlement currency.** (CONFIRMED) Premium capabilities beyond book unlocks can be metered through the ledger as-is.

---

## 5. Engineering readiness for Noetia+

**Verdict: structurally ready for extension, not reinvention.** (INFERRED)

The primitives a premium/expansion tier needs — tiered **entitlements** (token ledger + subscriptions + `SubscriptionGuard`), **billing** (Stripe), **personalization** (personas), **telemetry** (events/stats), **content engine** (sync), **real-time/social** (clubs gateway), **cross-platform reach** — are **already built** (CONFIRMED). Noetia+ can be assembled largely by composing these, not by laying new foundations.

**What to build (extend existing):** a recommendation/insights surface over persona+event data; feature-level entitlement mapping on top of tiers; broader event emission; and — if revenue-sharing is in scope — a payout/settlement engine (the one genuinely new system).

**What to protect (do not disturb):** production data and migrations (additive only); the alignment/sync-map pipeline (reader-critical, high blast radius); the Stripe webhook + token issuance path (revenue-critical — verify C1/C2 first); the auth token model.

**Do-first risk reducers:** (1) verify token issuance + Stripe mode; (2) stand up a staging environment; (3) centralize admin RBAC. With those in place, the platform is a strong, well-organized base to build Noetia+ on.

---

*Full detail in the numbered baseline documents `01`–`21` and `README.md`. Source code is the source of truth; where documentation conflicted with code, the code was followed.*
