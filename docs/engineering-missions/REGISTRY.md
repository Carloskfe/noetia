# Engineering Mission Registry

**Index only** — details live in each mission document and its PR ([protocol](REPORTING-PROTOCOL.md) §2). **Last updated:** 2026-10-30 (staging readiness) by the Coding Agent.
**Lifecycle** (`README.md`): Draft · Approved · In Progress · Review · Completed · Blocked · Cancelled. **Delivery:** Not merged · Merged · Deployed.

> Several mission documents are not yet on `main`: they live on the branch or PR shown. "Merged" means present on `main`; because every push to `main` deploys production, code merged to `main` has gone through CD, but **Deployed** is only claimed where a deploy was verified.

## Active

| ID | Title | Lifecycle | Delivery | Branch / PR | Evidence | Blockers / risks | PO decisions pending | Next action |
|---|---|---|---|---|---|---|---|---|
| NEM-011 | P0 subscription integrity — acquisition bypass + atomic redemption | Review | Not merged | `fix/nem-011-subscription-integrity` · [#11](https://github.com/Carloskfe/noetia/pull/11) (in Release A [#14](https://github.com/Carloskfe/noetia/pull/14)) | Mission §12, §18; real-DB integration in CI; revert check (closed #15) | Deploy gated on NEM-012 (D1) and staging validation | B-10 (historical bypass rows) | Ships only inside Release A |
| NEM-012 | Unlock with token — web + mobile acquisition | Review | Not merged | `release/acquisition-a` · [#14](https://github.com/Carloskfe/noetia/pull/14) (draft) | Mission §18; `docs/operations/release-a-validation.md` | Staging + Stripe test-mode validation not run; offline downloaded copies (NEM-013 O-2) | B-5 (expiry copy) | Operator runs the staging plan |
| NEM-014 | PostgreSQL integration tests in CI | Review | Not merged | [#14](https://github.com/Carloskfe/noetia/pull/14) | 21/21 in CI; revert check failed 9/18 as designed | — | Make the job a required check (O-2) | Review |
| NEM-015 | Retire direct title purchase | Review | Not merged | [#14](https://github.com/Carloskfe/noetia/pull/14) | Mission §15a, §18 | Stripe read-only pending/async/failed-delivery check | B-11 (historical purchase settlement) | Operator runs the reconciliation + Stripe check |
| — | **Release A** (NEM-011 + 012 + 014 + 015) | Blocked | Not merged | [#14](https://github.com/Carloskfe/noetia/pull/14) (draft) | [validation](../operations/release-a-validation.md) · [staging plan](../operations/release-a-staging-validation-plan.md) · [recovery](../operations/release-a-recovery-plan.md) | Staging W1–W11/M1–M4, behind plan §0 gate 1 (NEM-006A build fix — verified by local builds) and gate 2 (shared `api`/`storage` hostnames with production — read-only measurement, possibly production-affecting); reconciliation baseline; PR reviews; #11 must not merge alone | Approval of the staging-only execution phase (plan §6); merge method (merge commit, not squash); deployment approval | Await PO approval of the staging phase |
| NEM-013 | Ownership-based entitlement enforcement (end of all-access streaming) | Draft | Not merged | [#13](https://github.com/Carloskfe/noetia/pull/13) / [#14](https://github.com/Carloskfe/noetia/pull/14) | — | Depends on Release A deployed, ToS update, notice period | B-2, B-3, B-10, O-2 | Await PO |
| NEM-010 | Near-zero-downtime production deploys | Draft | Not merged | [#10](https://github.com/Carloskfe/noetia/pull/10) | Measurements in the mission | Staging baseline (D1) | D1, D3 (migration ordering) | Await PO |
| NEM-009 | Backup, restore & DR (level 1) | In Progress (partial) | Not merged | `nem-009-resilience-impl` | Mission record on branch | Activation blocked on external actions | — | Per mission |
| NEM-006C | Full-catalog reader-validatable staging content | In Progress | Not merged | `nem-006c-staging-content` | Mission record on `nem-009-resilience-impl` | Needed for staging validation of Release A | Whether to merge staging infrastructure | Await PO |
| NEM-006A | Permanent staging environment foundation | Review (awaiting Product Architecture) | Not merged | `nem-006a-staging` | Mission record on `nem-009-resilience-impl` | — | Arm staging auto-deploy (not armed) | Review |

## Decisions recorded (Product Owner)

| ID | Title | Where | Delivery |
|---|---|---|---|
| PO-021 (+ Amendment 1 / B-1) | Token-based acquisition; per-title purchase discontinued | [#12](https://github.com/Carloskfe/noetia/pull/12) | Not merged |
| PO-022 | Independent Noetia+ subscription | [#12](https://github.com/Carloskfe/noetia/pull/12) | Not merged |
| PO-023 | Subscription-free acquisition | [#12](https://github.com/Carloskfe/noetia/pull/12) | Not merged |
| PO-005 … PO-020 | AI, pricing, economics, resilience | `nem-009-resilience-impl` | Not merged |
| PO-001 … PO-004 | Noetia+ / AI foundations | `docs/noetia-plus/PRODUCT-DECISIONS.md` | Merged |

Open business decisions: **B-2, B-3, B-5, B-10, B-11** (see the [impact assessment](../architecture/impact-assessments/PO-021-023-acquisition-and-noetia-plus.md) §7, PR #12).

## Historical / other

| ID | Title | Lifecycle | Delivery | Note |
|---|---|---|---|---|
| NEM-001 | Technical baseline | Completed | Merged (docs) | Record on `nem-009-resilience-impl` |
| NEM-002 (+002A) | Production safety & business-critical verification | Completed | Merged | Remediation commit `a3b9b36` on `main` |
| NEM-003 | Noetia+ product & technical design | Completed | Merged (docs) | Design only |
| NEM-004 | Engineering mission governance | Completed | Merged (docs) | — |
| NEM-005 / 005A | Product decisions & ADRs / pgvector decision | Completed | Merged (docs) | — |
| NEM-006 | Noetia+ implementation | Paused | — | No implementation commits exist |
| NEM-006B | — | Unknown | — | Referenced in documents; **no mission file found** |
| NEM-007 | Creator attribution / economics | Phase A recorded decisions PO-011…013; Phase B blocked | — | **No mission file found** |
| NEM-008 | Creator settlement | Reserved | — | **No mission file found** |
| Unnumbered | PRs #2–#9 (CI repair, deploy downtime fixes) | — | Merged | PRs #5–#7 = PO-accepted governance exception (NEM-010 §1.4) |
