# 18 — Feature Flags & Rollout

**Mandatory.** Noetia+ must roll out progressively and every capability must be independently disable-able.

## Flag layers
1. **Master Noetia+ flag** — one switch that disables the entire `knowledge/*` surface. When off, all `/plus/*` routes return a clean "unavailable" and **the reader is completely unaffected** (the hard guarantee). Kill switch for incidents/cost.
2. **Capability flags** — per capability (`plus.ask_book`, `plus.ask_library`, `plus.compare`, `plus.create`, `plus.memory`, `plus.maps`, `plus.recommendations`, …). Disable one capability without touching others (e.g. turn off expensive `plus.compare` under budget pressure).
3. **User-level beta access** — `plus_capability_grants` (source `beta`) opts specific users into Noetia+ or specific capabilities before general availability.
4. **Admin override** — force-enable/disable per user for support/testing.
5. **Percentage rollout** — `feature_flags.rolloutPercent` (deterministic hash on `userId`) for gradual GA.

## Resolution order (deterministic)
```
master flag OFF                         → deny (all)
capability flag OFF                     → deny (that capability)
admin override (allow/deny)             → wins
user beta grant                         → allow
plan capability + active Noetia+ sub    → allow
percentage rollout bucket               → allow/deny
otherwise                               → deny (with upgrade prompt if entitlement-only gap)
```
Implemented once in the entitlement/flag service and consumed by `PlusEntitlementGuard` ([08](08-entitlements-and-subscription.md)) — **not** re-checked ad hoc in controllers.

## Storage & performance
`feature_flags` + `plus_capability_grants` ([09](09-data-model.md)), cached in Redis with short TTL + pub/sub invalidation so flips are near-instant without per-request DB hits.

## Why this matters for cost & safety
Flags are the primary **cost-control** and **incident** lever: a runaway model or budget breach is contained by flipping a capability or the master flag — no deploy required. They also enable **safe phased delivery** ([19](19-release-roadmap.md)): ship Phase 1 to beta users behind flags, expand by percentage, and gate each later phase independently.

## Admin surface (future, not built)
`/admin/plus/flags` (proper `AdminGuard`) to toggle flags, set rollout %, grant beta — [37]/[10](10-api-design.md).
