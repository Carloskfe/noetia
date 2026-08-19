# Engineering Operating Model

**v0.1** · NOF-001 · How work becomes production at Noetia.

---

## The path

```
idea → research → Product Owner decision → architecture decision (when required)
     → Engineering Mission → branch → staging → validation → review → production
```

No step is decorative. The two that get skipped under pressure — **explicit authorization**
and **Product Architecture review** — are the two the model most insists on.

## Instruments

| Instrument | What it is | Authority |
|---|---|---|
| **PO decision** | A product/business/governance ruling (PO-001…PO-009) | Product Owner |
| **ADR** | An architecture decision with context and consequences | Product Architecture |
| **NEM** | An Engineering Mission — bounded authorization to change the repository | Product Owner approval |
| **NOF** | An Operating Framework mission — institutional documentation | Product Owner approval |

## Bounded authorization

The rule that governs everything else:

> An **APPROVED** mission is **bounded authorization only** — never blanket repository
> permission. **Never execute a mission merely because it exists or is approved.**
> Execution requires an explicit Product Owner instruction naming the mission.

In practice:

1. Read the mission.
2. **Validate its assumptions against the current repository** before implementing —
   missions are written against a remembered codebase, not the current one.
3. If requirements conflict with code, approved policy, security, financial rules,
   ownership principles, or protected systems — **STOP and ask.** Do not silently choose.
4. Do only what the mission authorizes.
5. **STOP for Product Architecture review** when done. A commit, a passing test, or a
   successful deploy does not complete a mission.

This has repeatedly paid for itself: NEM-006A's assumption validation caught a staging web
bundle that would have read and written **production** data.

## Protected systems

Explicit authorization required: **Escucha Activa / the reader · permanent book ownership ·
production data · business-rule engines.** These are where an error is expensive or
irreversible.

## Mission records

**DECIDED — [PO-009](decisions/product-owner/PO-009-engineering-mission-traceability.md).**
A mission is a durable governance record, not a chat instruction. Approved missions are
committed **at approval time**. Historical missions are backfilled where reconstructable,
marked `HISTORICAL / PRE-GOVERNANCE BACKFILL` and, where the original prompt is not
repository-resident, `RECONSTRUCTED SUMMARY`.

Records live in [`docs/engineering-missions/`](../engineering-missions/) under
`DRAFT/` → `APPROVED/` → `IN-PROGRESS/` → `COMPLETED/`.

## Definition of Done

Per [`DEFINITION-OF-DONE.md`](../engineering-missions/DEFINITION-OF-DONE.md), plus
standing repository rules:

- Every service file created or modified has a corresponding test under `tests/unit/`
  mirroring `src/`; coverage ≥80%; all external dependencies mocked.
- Migrations, where applicable, are additive and idempotent.
- Documentation updated in the same change — i18n keys in lockstep across `en`/`es`.
- Small, focused commits; `<type>: <description>`; push after every commit.
- Staging validated before production, where the change reaches infrastructure.
- **Product Architecture review** before merge.

## Git and delivery

Mission branches (`nem-006c-staging-content`, `nof-001-operating-framework`), never `main`
directly. Push to `main` auto-deploys production via `cd.yml`; the `staging` branch
auto-deploys staging via `cd-staging.yml` — **arming that branch is a deliberate act**, not
a side effect of creating it.

## What the model is defending against

- Executing an approved-but-not-instructed mission.
- Treating implementation as decision (`CODE` positions becoming policy by default).
- Scope drift inside an authorized mission.
- "It deployed, therefore it's done."
- Changes to production data or protected systems without an explicit, named authorization.

## Related

[`engineering-missions/README.md`](../engineering-missions/README.md) ·
[REVIEW-CHECKLIST](../engineering-missions/REVIEW-CHECKLIST.md) ·
[15-decision-registry](15-decision-registry.md) · [09-architecture-framework](09-architecture-framework.md)
