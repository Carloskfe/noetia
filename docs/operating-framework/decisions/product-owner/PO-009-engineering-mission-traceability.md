# PO-009 — Engineering Mission Traceability

**Status:** `DECIDED` · **Domain:** Governance · **Authority:** Product Owner
**Resolves:** decision half of [C-05](../../governance/contradictions-and-gaps.md) · Q-04
**Implementation:** backfill performed by NOF-001 — see [`docs/engineering-missions/`](../../../engineering-missions/)

---

## Principle

> Historical Engineering Missions must be backfilled into the repository as durable
> governance records **where the approved mission content and execution evidence can be
> reconstructed with reasonable confidence.**

Missions are bounded authorization. Authorization that leaves no record cannot be audited
after the fact.

## What a backfilled record preserves

mission ID · title · original/approved scope where recoverable · authorization level ·
status · related PO decisions · related ADRs · implementation commits · Product
Architecture review result · blockers and deviations · superseding or follow-up missions

## Honesty constraints

**Do not rewrite history to look like the present.** The governance format was created by
NEM-004; missions before it did not follow it. Those records are marked:

`HISTORICAL / PRE-GOVERNANCE BACKFILL`

**Do not invent wording.** Where the original approved prompt is not repository-resident:

`RECONSTRUCTED SUMMARY — original approved prompt not repository-resident`

with the evidence cited (commits, produced documentation). A reconstructed summary is
Level 6 evidence describing a Level 4 artifact, and is labelled as such.

## Standing rule going forward

A mission approved from now on is **committed when approved**, not reconstructed later.
The record is created at authorization time and updated at completion.

## Related

[10-engineering-operating-model](../../10-engineering-operating-model.md) ·
[`engineering-missions/README.md`](../../../engineering-missions/README.md) ·
[15-decision-registry](../../15-decision-registry.md)
