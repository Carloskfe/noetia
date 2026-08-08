# 20 — Hidden Opportunities

Existing capabilities that already exist in the codebase and could be leveraged (without new architecture). These are **observations**, not designs.

## Latent data assets

### O1 — Reader-persona pipeline (built, lightly used) — CONFIRMED
`user_personas` already computes engagement archetype, reading cadence, dominant themes (20-theme taxonomy), completion rate, social amplification, preferred platforms, top genres, avg session — nightly. **Reusable for:** personalized recommendations, cohort targeting, author-facing archetype analytics, premium "your reading identity" features. Admin recompute endpoints exist.

### O2 — General-purpose event stream (schema ready, under-emitted) — CONFIRMED
The `events` table (typed, jsonb payload, indexed) is a generic telemetry sink but only `fragment_created`/`fragment_shared` are emitted. **Reusable for:** funnel analytics, behavioral triggers, A/B measurement — by simply emitting more event types through the existing `EventsService.emit`.

### O3 — Fragment + quote-card + share infrastructure (viral loop) — CONFIRMED
Fragments → auto-themed → quote cards (image-gen, 4 platforms) → persisted `shares` with **`createdById`** and **`visitCount`** on public `/s/<id>` invite pages. **Reusable for:** referral attribution (the `createdById` groundwork is already persisted), growth analytics, and social acquisition — a near-complete viral loop.

### O4 — Reading state (progress + daily stats + streaks) — CONFIRMED
`reading_progress`, `reading_stats` (minutes/phrases/day), streaks, weekly goals. **Reusable for:** gamification, habit features, premium insights, re-engagement notifications (push infra exists).

## Latent platform capabilities

### O5 — The multimodal sync engine (crown jewel) — CONFIRMED
The phrase-level text↔audio alignment stack (splitter, Whisper parser, aligner with drift correction, diagnostics, gated re-seed, SRT/VTT support, quality gate) is a **reusable, self-contained engine**. **Reusable for:** any text+audio product — new content verticals, author-supplied audio, podcasts, language learning.

### O6 — Token ledger as a generic entitlement primitive — CONFIRMED
`token_ledger` (typed, expiring, poolable across linked users, redeemable per book) is a flexible consumable-currency system. **Reusable for:** any metered/premium capability, not just book unlocks.

### O7 — Real-time gateway + clubs (social live) — CONFIRMED
Socket.IO gateway + "Escucha Juntos" live co-listening + phrase-anchored discussions + polls + sessions. **Reusable for:** live author events, premium cohorts, synchronous experiences.

### O8 — Courtesy quotas + hosting tiers (B2B primitives) — CONFIRMED
`courtesy_token_quotas` (author/publisher/narrator) and `HostingTier` limits are the seeds of a **publisher/B2B tier** and contributor programs.

### O9 — Bilingual i18n + cross-platform auth — CONFIRMED
ES/EN across web+mobile with API-synced language, plus Google/Facebook/Apple OAuth on both platforms → low-friction market expansion.

### O10 — Causas Noetia (differentiation) — CONFIRMED
`causes` + per-payment allocation model is a built-in ESG/mission differentiator.

## Under-used endpoints/services — CONFIRMED
- `books/pending` review queue + author analytics — an author-experience surface with room to grow.
- Persona admin endpoints — not yet surfaced to authors as archetype insights.
- Event stream — emit points exist for far more than fragments.

## Summary
The most valuable latent assets are the **sync engine** (O5), the **persona pipeline** (O1), the **viral fragment/share loop** (O3), and the **token ledger** (O6). Each is already built and could underpin premium or expansion features with extension rather than new foundations.
