# PO-014 — Recovery Point Objectives

**Status:** `DECIDED` (target objectives) · **Domain:** Operations · **Recorded by:** NEM-009

| Tier | Data | RPO |
|---|---|---|
| **0** | Ownership, tokens, financially material state | **≤ 1 hour** |
| **1** | User state | **≤ 6 hours** |
| **2** | Irreplaceable creator/user content | **≤ 24 hours** |
| **3** | Reliably reconstructable derivatives | **No independent backup** where reconstruction is *demonstrated* |

Tier 3 requires demonstration, not assumption. Meilisearch qualifies — NEM-006C rebuilt all
84 books from PostgreSQL. Public-domain audio qualifies under [PO-016](PO-016-reconstructable-content.md)
provided the manifest holds.

**These are targets, not current capability.** Measured capability is reported by
`restore-db.sh` and recorded in [rpo-rto.md](../../resilience/rpo-rto.md).
