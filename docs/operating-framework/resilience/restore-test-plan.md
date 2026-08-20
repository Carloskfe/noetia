# Restore Test Plan

**NOF-003** · What a restore must prove. **No test has ever been run.**

## Principle

> "PostgreSQL started" is not verification.

A restore is proven only when the data it holds is demonstrably correct and the product
demonstrably works on it.

## Where to test

**Not production.** **Not the permanent staging environment** — staging is itself a validated
asset (NEM-006A/NEM-006C) and casually overwriting it destroys work.

Recommended: a **temporary isolated environment** — a throwaway compose project with its own
volumes, torn down after the test. Staging's isolation contract is the model to copy: distinct
project name, distinct volumes, no shared network with production.

## Verification criteria

### Tier 0 — must pass or the restore has failed

| Check | Method |
|---|---|
| Migration head matches | `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1` |
| **Ownership row count reconciles** | `SELECT COUNT(*) FROM user_books` vs pre-incident figure |
| **Token ledger reconciles** | Count by status; no negative or impossible balances |
| Users present | `SELECT COUNT(*) FROM users` |
| Foreign keys intact | No orphaned `user_books.bookId` or `token_ledger.userId` |
| Subscriptions coherent | Active subscriptions have plans and owners |

### Tier 1 — product function

| Check | Method |
|---|---|
| Authentication works | Log in as a seeded test user |
| Entitlement resolves | An owned book opens; an unowned one does not |
| Book text loads | `textFileKey` resolves from object storage |
| **Escucha Activa works** | Audio plays and highlighting tracks for ≥1 title |
| Search returns results | After reindex |
| Fragments survive | A known fragment is present with its note |

### Tier 2 — integrity

Object references resolve (no `audioStreamKey` pointing at a missing object) · counts
reconcile per table against the pre-incident snapshot · **`pgvector` extension present and
`vector` columns intact** once ADR-004 reaches production.

## Cadence

| Test | Frequency | Depth |
|---|---|---|
| Automated integrity | Every backup | Non-empty, `gunzip -t`, expected table count |
| Restore smoke | Monthly | Restore to throwaway env; Tier 0 checks |
| Full DR rehearsal | Quarterly, and before major infra change | Rebuild from nothing; Tier 0+1+2; **measure actual RTO** |

## What the first test will produce

The first full rehearsal is also the first real measurement of Noetia's recovery capability.
Until it runs, every figure in [rpo-rto.md](rpo-rto.md) is a target rather than a
demonstrated property, and the honest posture statement remains: **recovery is unproven.**

It is entirely possible the first attempt fails — an unreadable dump, a missing secret, an
`init.sh` firewall lockout. That is the point of testing, and finding out during a rehearsal
costs nothing but time.
