# PO-015 — Recovery Time Objectives

**Status:** `DECIDED` (target objectives) · **Domain:** Operations · **Recorded by:** NEM-009

| Service | RTO |
|---|---|
| Authentication + permanent library/ownership + core reader | **≤ 4 hours** |
| Escucha Activa | **≤ 24 hours** |
| Payments | **≤ 48 hours** |

**Objectives, not service guarantees.** Recovery testing determines actual capability.

The split is deliberate and the architecture supports it: book text is ~24 MB while audio is
~13 GB, so text reading can return inside 4 hours while audio streams back over the following
day. An unresolvable `audioStreamKey` does not prevent text rendering — degraded service beats
no service.

This objective is why PostgreSQL backups use **custom format**: `pg_restore -j` restores in
parallel, and a single-threaded plain-SQL restore would jeopardise the 4-hour target at scale.
