# PO-020 — Zero-Cost Resilience Constraint

**Status:** `DECIDED` · **Domain:** Operations, Economics · **Recorded by:** NEM-009 (zero-cost continuation)

At Noetia's current stage, backup and disaster-recovery improvements **must not create
additional recurring infrastructure or service expense.**

```
Authorized incremental recurring cost:  $0.00 / month
```

**A current-stage operating constraint, not a permanent architectural principle.**

## Prohibited

Purchasing storage · provisioning paid backup services · upgrading Contabo · subscribing to a
secret-management product · buying another VPS · activating anything that auto-converts to paid ·
entering payment credentials for backup infrastructure · creating hidden variable-cost exposure.

Free **trials**, introductory credits, and promotional storage are excluded as foundations
(NEM-009 §23) — a backup strategy that expires is not a backup strategy. A legitimate
*indefinite* free tier may be evaluated with quotas documented.

## The rule that protects honesty

> If adequate protection cannot be achieved for $0, **preserve the implementation gap as OPEN.**

Never weaken an RPO/RTO target, or redefine "off-site", merely to declare a mission complete.
`PARTIAL` at $0 is an acceptable and truthful outcome; a `COMPLETE` obtained by reclassifying
a same-host copy as independent protection is not.

## What this does not relax

The $0 constraint **does not authorize weaker security** (NEM-009 §22). SSH port 222,
encryption before data leaves production, least privilege, `.env` Git protection, production
isolation, and the prohibition on user data in Git all stand. A free option requiring any of
those compromises is rejected rather than accepted.

## Consequence for reporting

Because the strongest zero-cost independent copy depends on Product-Owner-controlled hardware
that may not be online continuously, **RPO must be reported as two numbers** — local and
independent — never one ambiguous figure (NEM-009 §10, §18).

## Related

[PO-014](PO-014-recovery-point-objectives.md) · [PO-015](PO-015-recovery-time-objectives.md) ·
[zero-cost-architecture.md](../../resilience/zero-cost-architecture.md)
