# PO-017 — Financial / Creator Retention

**Status:** `DECIDED` (boundary only) · **Domain:** Economics, Operations · **Recorded by:** NEM-009
`ACCOUNTING / LEGAL REVIEW REQUIRED`

**No final long-term legal retention period is established by engineering.**

Creator, settlement, and supporting financial records must eventually comply with applicable
accounting and legal requirements — a determination that belongs to professional review, not
to an engineering mission.

**Operational backup retention may be set independently for recovery purposes**, and is:
hourly 48 h · daily 30 d · weekly 12 weeks
([retention-policy.md](../../resilience/retention-policy.md)).

The distinction matters: operational retention answers *"can we recover from an incident?"*
Legal retention answers *"how long must we be able to produce these records?"* The second is
unanswered and must not be inferred from the first. It also interacts with erasure obligations
(IG-DR-11) — longer retention is not automatically safer.
