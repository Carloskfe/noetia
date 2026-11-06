# PO-029 — Eligible Research Corpus

**Status:** `DRAFT — NOT DECIDED`. Records preliminary ruling TT-12. Becomes `DECIDED` only when the Product Owner accepts this text.
**Domain:** Rights, AI, Catalogue · **Authority:** Product Owner · `LEGAL REVIEW REQUIRED`
**Date:** 2026-11-06 · **Source:** T0 ruling TT-12
**Implementation:** `NOT IMPLEMENTED` — `books` has no rights-status column (IG-04)

---

## Decision (proposed text)

1. The initial evaluation and pilot corpus uses **verified public-domain material**.
2. Subsequent commercial expansion prioritizes **explicit author or publisher opt-in**.
3. Verification of the **work, edition, translation, and relevant rights** is required before any AI processing.
4. `isFree` does not establish public-domain status.
5. **Default deny remains mandatory.**

## Normative rule

```
AI processing allowed(book, operation) =
      an authoritative rights record exists for this exact text version
  AND it covers the work, edition, translation, and relevant rights
  AND it permits the operation
otherwise DENY
```

Requirements and dependencies: [07-rights-verification-requirements](../../../architecture/three-tier-intelligence/07-rights-verification-requirements.md).

## Consistency with earlier policy

Consistent with PO-002 / ADR-002 and the NEM-007 Phase A permanent principle: *"Noetia must not infer copyright, rights-holder, narrator, or economic entitlement from implementation metadata that was not created for that purpose."* Also consistent with PO-016 (a recoverability classification, never a rights classification).

## Pending — not decided here

Legal evidence standard and who verifies (TT-26) · relevant jurisdictions (TT-26) · licensed default-permission matrix and contract language (D6) · which titles enter the pilot.

## Implementation boundary

No catalogue change, no ingestion, no backfill, and no AI processing is authorized.
