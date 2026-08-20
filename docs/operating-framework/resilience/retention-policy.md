# Retention Policy

**NOF-003** · Recommendations. Not approved policy.

## Current

`backup-db.sh` keeps 7 daily plus 4 weekly (Sunday) — roughly a **28-day** horizon, PostgreSQL
only, on the production host.

`incident-response.md:126` describes something different: `/opt/noetia/backups/` with "7-day
rolling retention". **The two disagree on both path and schedule** (C-DR-01). An operator
following the documentation during an incident would look in a directory that does not exist.

## Recommended

| Recovery point | Keep | Rationale |
|---|---|---|
| Hourly (Tier 0) | 48 hours | Meets RPO ≤1 h for ownership and tokens |
| Daily | 30 days | Covers slow-corruption discovery (DR-11) |
| Weekly | 12 weeks | Quarterly reference |
| Monthly | 12 months | Annual comparison; creator-obligation reconstruction |
| Yearly | **Undecided** | Do not adopt multi-year retention without a stated legal or accounting basis — Q-DR-04 |

30 days of dailies rather than 7 is deliberate: **28 days is a thin margin for detecting
corruption that a user has not yet reported**, and dumps of an 84-book, 16-user database are
small. Retention cost is negligible at current scale; the constraint is privacy, not storage.

## MinIO retention

Different shape entirely — object versioning plus lifecycle rules, not periodic snapshots.
Recommended: version irreplaceable prefixes (`books/`, author audio, `images/backgrounds/user/`)
with 90-day non-current expiry. Public-domain audio may reasonably be excluded from off-site
retention if rebuild remains documented and proven (Q-DR-03).

## Privacy interaction — unresolved

Backup retention and the right to erasure conflict directly:

- deleting a user's active data does **not** remove them from historical backups;
- immutable backups make targeted deletion **impossible by design**;
- the usual resolution is documented backup expiry (deletion propagates as recovery points age
  out) plus a commitment not to restore deleted users from an old backup without cause.

Noetia has **no data-retention or deletion policy at all** — no account-deletion flow, export
mechanism, or retention window appears anywhere in the corpus. This predates NOF-003 and is
larger than backups.

`PRIVACY / LEGAL REVIEW REQUIRED`. Recorded as **IG-DR-11**; the broader policy gap belongs to
a future privacy mission, not to backup design.
