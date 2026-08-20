# PO-016 — Public-Domain / Reconstructable Content

**Status:** `DECIDED` · **Domain:** Operations · **Recorded by:** NEM-009

Noetia prioritises independent backup of **irreplaceable** content. Full off-site replication
of all reconstructable public-domain audio is **not initially required**.

The recovery architecture must preserve enough source metadata to reconstruct excluded content
reliably — implemented as the manifest produced by `infra/server/backup-minio.sh --manifest`.

**Revisitable:** if reconstruction proves unreliable or operationally excessive, this decision
may be reversed. Evidence already suggests caution — three titles fail on archive.org 500s
(NEM-006C), so reconstruction is *not* a guarantee for every object. The manifest records the
authoritative source per object so failures are visible rather than discovered during a
disaster.

**This is a recoverability classification, never a rights classification.** Public-domain
status is a legal determination governed by
[PO-002 / the Creator & Rights Framework](../../07-creator-and-rights-framework.md); nothing
here may be read as evidence of rights.
