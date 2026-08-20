# Restore Strategy

**NOF-003** · Recovery order derived from dependencies. **Never executed.**

## Dependency-derived recovery order

```
1  Infrastructure    host, Docker, proxy network, Traefik, DNS
2  Secrets           .env.production — nothing starts without it
3  PostgreSQL        system of record
4  Authentication    API up; users can log in
5  Ownership/tokens  entitlement resolvable (already in PostgreSQL)
6  Catalog + text    reader works — MinIO books/ (24 MB, fast)
7  Search            seed-search.js, minutes
8  Audio             MinIO audio/ (13 GB, slow) — Escucha Activa returns
9  Payments          Stripe reconciliation
10 Social/clubs/sharing
11 Noetia+           not implemented
```

**Secrets rank second, above the database.** This is the ordering most likely to be
discovered the hard way: a perfect PostgreSQL dump is inert without `DB_PASS`, and no copy of
it exists outside the host today.

**Steps 6 and 8 are deliberately split.** Text is 24 MB and audio is 13 GB. Restoring text
first returns the reader within the 4-hour RTO while audio streams back over the following
day. Degraded reading beats no reading.

## Procedure sketch — PostgreSQL

Not a runbook; the runbook is [disaster-recovery-runbook-design.md](disaster-recovery-runbook-design.md).

```
1. Provision host, install Docker, recreate proxy network, start Traefik
2. Restore .env.production from off-site vault      ← does not exist today
3. git clone → /opt/noetia
4. docker compose up -d db
5. gunzip -c noetia_TIMESTAMP.sql.gz | psql -U noetia -d noetia
   (or pg_restore -j N for custom-format dumps)
6. Verify migration count matches the expected head
7. Start api, verify /health
8. Run restore-test-plan.md verification
9. Start web; point DNS; confirm TLS issues
```

Step 5 has **never been executed against a real dump.** Its duration is unknown.

## MinIO

No backup exists, so today "restore" means **re-ingestion**:

```
seed-ingestion.js     text from Gutenberg/Wikisource
seed-covers.js        covers
seed-audio*.js        audio from LibriVox — hours, 3 titles known to fail
```

**Author-uploaded content cannot be re-ingested.** For those titles, restore is impossible
until MinIO backup exists (**IG-DR-03**).

## Sync maps

Rebuildable from the committed VTT corpus — NEM-006C proved it end to end, reconstructing
62 titles in a single run. This is the strongest recovery capability Noetia currently has,
and it is a direct consequence of the VTTs living in Git.

## Stripe reconciliation

After any restore, local subscription and token state may lag Stripe. Required:

- compare local subscriptions against Stripe for status and period end;
- replay or verify webhook events after the restore point (`stripe_processed_events`
  provides idempotency);
- confirm no user is charged for a subscription the restore rolled back, and none lost
  entitlement they paid for.

**No documented reconciliation procedure exists** (**IG-DR-08**). `ACCOUNTING REVIEW
REQUIRED` for how a restore-window discrepancy is corrected.

## Ownership integrity — the non-negotiable check

Because ownership is irreplaceable and unverifiable externally, a restore is not complete
until `user_books` row counts and per-user ownership reconcile against the pre-incident
figure. If they cannot, **users must be told** what was lost rather than silently served a
smaller library. `LEGAL REVIEW REQUIRED` for notification obligations.
