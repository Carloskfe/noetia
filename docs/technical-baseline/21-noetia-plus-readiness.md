# 21 — Noetia+ Readiness

This document does **not** design Noetia+. It assesses, structurally, how ready the current platform is to support an expansion/premium offering, based only on what exists in the code. "Noetia+" is treated as an unspecified next tier; specifics are **OUT OF SCOPE**.

## What existing architecture already supports it — CONFIRMED

| Need a premium tier typically has | Already present |
|-----------------------------------|-----------------|
| Tiered entitlements | `token_ledger` (typed/expiring/poolable), `Subscription` (plans, seats, status), `HostingTier`, `SubscriptionGuard` |
| Recurring billing + one-time purchases | Stripe checkout (subscription / token package / single book / gift), portal, webhooks |
| Personalization signals | `user_personas` (archetypes, themes, cadence, completion, genres) + nightly cron |
| Behavioral telemetry | `events` stream (generic), `reading_stats`, counters |
| Social/growth loop | fragments → quote cards → persisted `shares` (`createdById`, `visitCount`) → invite pages |
| Real-time/social | Socket.IO gateway, clubs, Escucha Juntos, discussions, polls |
| Multimodal content engine | full text↔audio sync pipeline + quality gate + diagnostics |
| Cross-platform reach | web + React Native mobile, ES/EN i18n, 3 OAuth providers |
| Access control | JWT + rotating refresh + guards |

**Assessment (INFERRED):** the platform already has the **primitives** for a premium tier — entitlement, billing, personalization, engagement, and content — without new foundational systems.

## What needs extension — INFERRED

1. **Entitlement gating granularity.** `SubscriptionGuard` gates coarse access; a feature-level entitlement map (which tier unlocks which capability) would need to be added on top of the existing token/subscription primitives.
2. **Recommendations surface.** Persona data is computed but there is **no recommendation service/endpoint** exposing it to readers or authors — this is the largest build-on-existing-data opportunity.
3. **Event emission breadth.** To power premium analytics/triggers, more event types must be emitted through the existing `EventsService` (schema already supports it).
4. **Payout/settlement.** No revenue-split engine — required if Noetia+ shares revenue with authors/narrators at scale (see [19](19-technical-debt.md) H3).
5. **Author-facing insights.** Persona/archetype aggregation per book (N-gated) is not yet surfaced.
6. **Release safety.** A staging environment and centralized RBAC would de-risk shipping a larger surface (see [19](19-technical-debt.md) H1/H2).

## What can be reused as-is — CONFIRMED
- The **sync engine** and reader (the core value) — extend content, not the engine.
- The **token ledger** as the entitlement currency.
- **Stripe** checkout/webhook plumbing (add products, not new billing code).
- **Auth/guards**, **i18n**, **storage/search**, **push notifications**, **clubs/real-time**.
- **Fragment/share** infrastructure for growth.

## What should remain untouched — INFERRED (risk-based)
- **Migrations & production schema** — additive only; never edit deployed migrations.
- **The alignment/sync-map data and pipeline** — reader-critical, recently stabilized; changes are high-blast-radius. Extend via new content, not by reworking the aligner.
- **Stripe webhook handler & token issuance** — revenue-critical; verify (C1/C2) before modifying.
- **Auth token model** — rotating refresh + guard stack is sound; extend roles, don't replace the mechanism.
- **Production data** — users, subscriptions, ledger, personas, sync maps: preserve absolutely.

## Readiness verdict — INFERRED
**Structurally ready for extension, not for reinvention.** A premium tier can be assembled largely from existing primitives (entitlements, billing, personas, events, content engine). The main *new* build is a **recommendation/insights surface** over already-computed persona/event data, plus **payout/settlement** if revenue-sharing is in scope. The main *risk reducers* to do first are the two must-verify billing items (C1/C2), a **staging environment**, and **centralized admin RBAC**.
