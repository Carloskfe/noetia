# Product Framework

**v0.1** · NOF-001 · The major product systems and how they relate.

`CURRENT` = live in production · `PLANNED` = approved direction, not built ·
`FUTURE` = designed or discussed, not committed.

---

## System map

```
                    Catalog ──── Books ──┬── Text ──────┐
                       │                 └── Audio ─────┤
                       │                                ├── Escucha Activa
                    Library ◄── Tokens ◄── Subscriptions│
                       │          ▲                     │
                       │          └── Gift cards        │
                       ▼                                ▼
                   Fragments ──────────────────── Quote cards ── Sharing
                       │
                       ▼
                 Clubs · Noetia+ (planned)
```

## Reader-facing systems

| System | State | Notes |
|---|---|---|
| **Catalog** | CURRENT | Discovery, search, collections. Gated at ≥90% sync coverage for ingested titles (CODE-04) |
| **Books** — text | CURRENT | Text in MinIO; phrases in `sync_maps.phrases` |
| **Books** — audio | CURRENT | MP3 in MinIO, keyed by title slug; served via presigned URLs |
| **Escucha Activa** | CURRENT | Phrase-level sync; the product's centre. 66 of 84 titles meet the quality gate |
| **Library** | CURRENT | `user_books`, permanent access (P2) |
| **Fragments** | CURRENT | Highlights as first-class objects; theme-tagged for personas |
| **Quote cards** | CURRENT | Four platform formats, WYSIWYG preview, image-gen service |
| **Sharing** | CURRENT | Per-share invite page at `/s/<id>` with OG tags; book-first CTA |
| **Notes** | CURRENT | `fragments.note` |
| **Reading stats** | CURRENT | Heartbeat, 7-day chart, streak, weekly goals |
| **Clubs** (Clubes de Lectura) | FUTURE | Specified in project memory; **not represented in the documentation corpus** |
| **Mobile** | CURRENT | React Native, offline sync, OTA for JS-only changes |

## Commerce systems

| System | State | Notes |
|---|---|---|
| **Subscriptions** | CURRENT | Individual / Duo / Family; pricing per [PO-006](decisions/product-owner/PO-006-canonical-subscription-pricing.md) |
| **Tokens** | CURRENT | Append-only ledger; 90-day expiry; shared Duo/Family pool, separate libraries |
| **Gift cards** | CURRENT | Stripe purchase → emailed claim token |
| **Peer token gifting** | FUTURE | Documented in project notes only → C-07 |
| **Causas Noetia** | CURRENT (surface) / PLANNED (settlement) | 2.22% allocation decided (PO-007); no engine computes it → IG-02 |
| **Creator payouts** | PLANNED | Policy decided (PO-008); **not implemented** → IG-02 |

## Creator systems

| System | State | Notes |
|---|---|---|
| **Author/publisher upload** | CURRENT | Text, audio, cover, SRT/VTT; bypasses the ≥90% gate |
| **Author analytics** | CURRENT | Scoped to own titles |
| **Courtesy tokens** | CURRENT | Quotas by role (author/publisher/narrator) |
| **Narrator tooling** | FUTURE | Narrator is an economic party (PO-007) with no dedicated surface |

## Platform systems

| System | State |
|---|---|
| Admin, moderation, ingestion tooling | CURRENT |
| Search (Meilisearch, lexical) | CURRENT |
| Persona pipeline (events → themes → personas, opt-out) | CURRENT |
| Staging environment | CURRENT (NEM-006A) |
| Observability (Prometheus/Grafana/Sentry) | CURRENT |

## Noetia+ — PLANNED

Designed across 25 documents; **no component is implemented**. Governed by
PO-001…PO-005 and ADR-001…004.

| Capability | Description |
|---|---|
| **Ask This Book** | Grounded Q&A within one book |
| **My Knowledge** | Across owned books, highlights, notes — the core experience |
| **Expand** | Broader knowledge with distinguishable provenance |
| **Noetia Brain** | The intelligence layer as a whole |
| **Memory & knowledge assets** | Durable user knowledge artifacts |

Mode names are explicitly provisional (PO-003) → Q-10.

## The free library

`CURRENT — with a stated sunset.` ~84 public-domain titles as a beta acquisition tool,
explicitly **not the business** ([`CLAUDE.md`](../../CLAUDE.md)). New titles stop after
6–12 months; hero placement is replaced once 50+ author titles exist.

Neither trigger has a date or an owner → C-10, Q-08.

## Notable absence

**No accessibility system, policy, or commitment appears anywhere** in 96 documents. For a
product built on switching between reading and listening — inherently valuable to users
with visual or reading differences — this is a conspicuous gap. Recorded, not invented.
