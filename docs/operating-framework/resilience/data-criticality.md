# Data Criticality

**NOF-003** · Classification by recoverability. Every row cites repository evidence.

## IRREPLACEABLE — no other authoritative source exists

| Data | Where | Why irreplaceable |
|---|---|---|
| **`user_books` — permanent ownership** | PostgreSQL | Noetia's core promise (P2). No expiry column; no external record. **If PostgreSQL is lost, nobody can prove what any reader owns.** Stripe knows payments, not redemptions |
| **`token_ledger`** | PostgreSQL | Append-only issuance/redemption history. Determines balances, expiry, and every future creator obligation (PO-008/PO-010) |
| **Creator obligations** (future) | PostgreSQL | Financially material once NEM-008 exists. Reconstructable only if ledger + plan prices survive |
| **User accounts, OAuth links, password hashes** | PostgreSQL | Identity. Partially re-establishable via OAuth, not for email/password users |
| **Fragments, notes, reading progress, stats, clubs** | PostgreSQL | User-generated. Zero external source |
| **Author-uploaded book text and audio** | MinIO | Creator-supplied masters. Noetia may hold the only copy |
| **User-uploaded background images** | MinIO `images/backgrounds/user/` | User-generated |
| **`.env.production` secrets** | Host only | Not in Git, not backed up. Loss forces re-provisioning every integration |
| **Traefik `acme.json`** | Host only | Certificates — regenerable, so strictly *replaceable*, but only once DNS resolves to the new host |

## RECONSTRUCTABLE WITH COST

| Data | Cost to rebuild | Evidence |
|---|---|---|
| **Public-domain audio (~13 GB)** | Hours to days; unreliable — 3 titles already fail on archive.org 500s | NEM-006C mirror; `migrate-audio-to-minio.ts` |
| **Public-domain book text (24 MB)** | Minutes to hours via `seed-ingestion.js` | Gutenberg/Wikisource fetchers |
| **Sync maps (`sync_maps`)** | Minutes — **because the VTT corpus is in Git** | NEM-006C rebuilt 62 titles from committed VTTs. Without Git, this becomes Whisper GPU work: days |
| **Book covers** | Minutes via `seed-covers.js` | Open Library CDN + repo PNGs |
| **Generated share cards** | Regenerable on demand | image-gen service |
| **Future embeddings / semantic chunks** | Provider cost + time; re-embedding is already treated as a migration | ADR-004 |

**The VTT corpus is the difference between minutes and days.** 1,743 files, 66.5 MB, in Git.
Losing GitHub without a mirror converts sync-map recovery into full re-transcription.

## RECONSTRUCTABLE EASILY

| Data | Method |
|---|---|
| **Meilisearch indexes** | `node dist/ingestion/seed-search.js` — **demonstrated** in NEM-006C, 84 books |
| **Redis sessions, sync state, queues** | Regenerate on use; users re-login |
| **Prometheus/Grafana** | Metrics history lost; dashboards recreatable |
| **Docker images** | Rebuilt from Git |

## EXTERNALLY AUTHORITATIVE

| Provider | Authoritative for | Local reconciliation needed |
|---|---|---|
| **Stripe** | Payments, subscriptions, invoices | `stripe_processed_events` prevents double-processing; after any restore, local subscription state must be reconciled against Stripe or users may be wrongly billed or wrongly entitled |
| OAuth providers | Identity assertions | `provider`/`providerId` mapping is local and irreplaceable |
| Cloudflare | DNS | Documented, recreatable |

## The two questions that decide everything

**"Which books does User X permanently own?"** — answerable **only** from `user_books` in
PostgreSQL. No external system knows. A Stripe payment record proves money moved, not which
title a token was redeemed against. Ownership is therefore **Tier 0** data, and the current
same-server-only dump does not protect it against the failure that matters.

**"What is each creator owed?"** — requires `token_ledger` + redemption + plan price at
issuance (PO-010). NOF-002 §12 already flagged that `plans` is mutable across migrations,
so historical price recovery is at risk **even with a perfect backup**. Backup policy cannot
fix that; it is a schema concern for NEM-007/008.
