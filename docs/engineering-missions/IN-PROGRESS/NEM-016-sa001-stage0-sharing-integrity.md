# NOETIA ENGINEERING MISSION — NEM-016
## SA-001 Stage 0: sharing security and integrity corrections

**Status:** IN PROGRESS → awaiting REVIEW. Rev 3 (pre-merge verification) is complete. Rev 5: staging execution **NO-GO** until S19 is remediated (report §16.6); merge blocked. Draft PR #25 is open and not merged.
**Mission type:** REMEDIATION
**Implementation authorization:** FULL-WITHIN-SCOPE (implementation, tests, Draft PR)
**Schema changes:** ADDITIVE ONLY (migration 068: three nullable columns, two indexes, one outbox table; never deployed)
**Infrastructure changes:** NOT AUTHORIZED (none made)
**Production deployment:** NOT AUTHORIZED. No merge, no deploy, no production migration.
**Product Owner approval:** GRANTED 2026-11-02 ("SA-001 Stage 0 — Authorized for implementation, testing, and Draft PR preparation")

> **APPROVED ≠ EXECUTE.** This mission was executed on the explicit PO instruction "Begin the authorized Stage 0 mission." It ends at REVIEW.

---

## 1. Context
The SA-001 architecture review (Draft PR #24, `docs/reports/2026-11-02-SA-001-smart-book-sharing.md`) found sharing defects that must be fixed before any SA-001 feature work (decision **SA-001-D12**):
- S1, S2, S3, S8, S12–S15
- G8, G9, G10
- C1

The PO then approved the C1 quotation-integrity policy.

## 2. Objective
Close those findings on the existing sharing surfaces without adding SA-001 features.

## 3. Dependencies
- SA-001 decisions D01–D13
- C1 policy (recorded in PR #24)
- No other mission

## 4. Source-of-truth references
- SA-001 report rev 2 and its C1 section (PR #24)
- `CLAUDE.md`
- `docs/engineering-missions/README.md`
- Code: `services/api/src/{sharing,social,fragments,users,books,storage}`, `services/image-gen/templates/base.py`, `services/web/{components/ShareModal.tsx,lib/share-utils.ts}`, `services/mobile/src/components/ShareSheet.tsx`

## 5. In scope

| Finding | Correction |
|---|---|
| S1 | Fragment ownership enforced before sharing |
| S3 / G9 | Share revocation (`DELETE /shares/:id`), revoke on fragment delete, hard delete on account deletion, card-image cleanup |
| G10 | Mobile: "Open image" opens the PNG; the Android share message contains the link |
| G8 | One live share per creator and card configuration (hash plus partial unique index) |
| S12 | Background images: inline raster data or allow-listed preset URLs only (API), plus a scheme/path/redirect/size gate in image-gen |
| S13 | Social publish accepts only the caller's own live card URLs; the bytes are read from storage, never fetched over HTTP |
| S14 | Shares refused, and public pages 404, for unpublished or quality-gated books |
| S15 / S8 | Request DTO with limits; per-user rate limits (Redis) |
| S2 / C1 | Card text must be a faithful excerpt of the book source (Stage 0 guardrail) |

## 6. Out of scope
- the public book page
- the new sharing UX
- the reflection-sharing experience
- the full quotation editor with `[…]` source ranges (design only, see the report)
- the rights policy (D06)
- analytics
- native links
- auth throttling fixes (S16, S17: reported, not changed)

## 7. Product rules
- D05 and the C1 policy
- D07 (permanent links, revocable)
- D09 (generator design preserved)
- D13 (sharing in every tier; no entitlement changes)

## 8. Protected systems
None touched:
- reader and Escucha Activa
- sync pipeline
- ownership and entitlement paths
- Stripe
- production data

`books.service.ts` `findAll` was refactored to use the shared quality-gate SQL, with identical semantics; its tests are unchanged and pass.

## 9–13. Requirements, security, acceptance, tests, observability
See the report, §5 and §9.

Observability:
- `fragment_shared` now carries `reused`.
- Warnings are logged for failed card-image cleanup and for the rate limiter failing open. They contain storage keys only, no PII.

## 14. Deployment / rollout
**Not authorized.** Report §8 covers:
- migration 068 (additive, guarded down)
- code-rollback caveats
- optional env vars
- OTA eligibility of the mobile change

## 15. Documentation deliverables
- this record
- `docs/reports/2026-11-02-NEM-016-sa001-stage0-sharing-integrity.md`
- the C1 resolution and the NEM-016 index row in PR #24

## 16. Open decisions
Report §10 (rev 2 adds the C1 thresholds, legacy combined fragments, the deploy approach and S18). Rev 1 items:
- legacy-share audit and clean-up
- orphan shares of deleted accounts
- rate-limit values
- the S16/S17 throttling fix mission
- ellipsis design approval

## 17. Stop conditions
None triggered:
- no approved policy changed
- no user data overwritten or deleted outside the authorized lifecycle (revocation and account deletion)
- the migration is additive and reversible
- no architecture change beyond Stage 0
- no merge, deploy, Stripe or production change

## 18. Completion report
The report linked above.

**Rev 2 (2026-11-02):** the PO authorized "Review, corrections within the previously approved Stage 0 scope, tests, and documentation". No merge, deployment, production migration, production data change or irreversible clean-up. Report §13 covers:
- fail-closed renderer validation
- the C1 reconciliation
- the transactional outbox
- the 068 readiness assessment
- the read-only legacy audit tool
- new finding S18

**Rev 3 (2026-11-02):** the PO authorized "Code cleanup, testing, staging preparation, and read-only legacy-share audit". Report §14 covers:
- removing the dead image-gen code, with static checks
- `[…]` canonicalization of every accepted marker form
- the portable read-only audit; the production audit was **not run** (no read-only access) and the exact procedure is documented
- the staging checklist, with data-impact flags
- the deployment-sequencing assessment, recommending migrate-first

**Rev 4 (2026-11-02):** staging preparation only. Report §15 covers:
- the infrastructure assessment
- new finding S19, possible DNS-alias collision on the shared `proxy` network
- the CC0 fixture `docs/staging/fixtures/nem-016-quote-fixture.txt`, with verified expected results
- the migration-first staging procedure
- the acceptance matrix A1–A18

Nothing was executed on staging or production.

**Rev 5 (2026-11-02):** S19 read-only investigation.
- Host SSH was denied, so there were no live checks.
- A local reproduction confirmed cross-environment DNS fall-through in both directions.
- Remediation proposed: a dedicated `proxy_staging` network.
- Staging NO-GO. No infrastructure was changed.

## 19. Product Architecture review
Pending. Verdict: —

> **STOP. Do not begin another mission without explicit Product Owner authorization.**
