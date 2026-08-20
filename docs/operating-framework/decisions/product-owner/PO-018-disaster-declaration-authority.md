# PO-018 — Disaster Declaration Authority

**Status:** `DECIDED` · **Domain:** Governance, Operations · **Recorded by:** NEM-009
**Resolves:** Q-DR-05

**The Product Owner may formally declare a Noetia disaster.**

Technical operators may perform immediately necessary **non-destructive containment** where
delay risks further damage — for example stopping a service that is corrupting data, or
blocking an attacking source.

**Destructive recovery, failover, replacement, or restoration requires Product Owner
authorization**, unless a future approved emergency-delegation policy provides otherwise.

## Why the line sits here

Restoring a database is as consequential as any production mutation: it discards everything
written since the recovery point. In a real incident the pressure is to act fast, which is
exactly when an unauthorised restore destroys data the incident had not touched. Containment
buys time; restoration is a decision.

The DR runbook marks every step requiring authorization.
