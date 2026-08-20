# RPO & RTO Recommendations

**NOF-003** · Recommendations, not approved policy — the acceptable-loss decision is the
Product Owner's (Q-DR-01).

## Recovery Point Objective — acceptable data loss

| Tier | Data | Recommended RPO | Today |
|---|---|---|---|
| **0** | Ownership (`user_books`), `token_ledger`, subscriptions, future creator obligations | **≤ 1 hour** | **~24 h**, same-server only |
| **1** | Users, fragments, notes, reading progress, clubs | **≤ 6 hours** | ~24 h |
| **2** | Author-uploaded text/audio, user images | **≤ 24 hours** *(from upload)* | **∞ — no backup** |
| **2** | Public-domain content | **≤ 7 days** (or accept rebuild) | ∞ — rebuildable |
| **3** | Search, Redis, metrics, generated cards | **No backup** — rebuild | n/a |

**Why Tier 0 is not ≤15 minutes:** that requires WAL archiving/PITR, which is a meaningful
operational step up. Given 16 users today, hourly logical dumps close most of the exposure at
a fraction of the complexity. **Revisit before commercial scale** — see
[cost-and-maturity-plan.md](cost-and-maturity-plan.md) Level 3.

**Why Tier 2 uploads matter more than their size suggests:** an author's master recording may
exist nowhere else. Losing it is not a Noetia inconvenience, it is a creator's asset.

## Recovery Time Objective — acceptable downtime

| Service | Recommended RTO | Rationale |
|---|---|---|
| Authentication | **≤ 4 h** | Nothing works without it |
| Reader (text) | **≤ 4 h** | The daily-active surface; product hierarchy #1 |
| Ownership/entitlement | **≤ 4 h** | Reading requires knowing what is owned |
| Escucha Activa (audio + sync) | **≤ 24 h** | Depends on 13 GB restore; text-only reading can serve meanwhile |
| Catalog browse/search | **≤ 24 h** | Meilisearch rebuilds in minutes once PostgreSQL is up |
| Payments/checkout | **≤ 48 h** | Revenue-affecting, not user-blocking; Stripe retains state |
| Creator tooling, clubs, sharing | **≤ 72 h** | Lower interaction frequency |
| Noetia+ | **Best effort** | Not implemented |

**Degraded service beats no service.** Restoring text reading in 4 hours while audio streams
back over 24 is a better outcome than a 24-hour blackout, and the architecture permits it —
`audioStreamKey` being unresolvable does not prevent text rendering.

## Honest statement of today's position

There is **no measured RTO**, because no restore has ever been performed. The figures above
are targets to design against, not observed capability. The first restore test
([restore-test-plan.md](restore-test-plan.md)) will produce the first real number, and it may
be considerably worse than these targets.
