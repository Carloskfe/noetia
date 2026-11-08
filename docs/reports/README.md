# Noetia reports and reporting protocol

**This file is Noetia's single authoritative reporting protocol.** Agent instructions (`CLAUDE.md`) and engineering-mission governance (`docs/engineering-missions/README.md`) refer here instead of repeating it.

| | |
|---|---|
| **Established** | Product Owner, 2026-11-02 (Permanent Agent Reporting Protocol, first published in Draft PR [#23](https://github.com/Carloskfe/noetia/pull/23)) |
| **Consolidated** | Product Owner authorization of 2026-11-07 (SA-003, *Reporting Governance Consolidation*) and the Product Owner directive *Mandatory Iteration Reporting, Documentation Traceability and Instruction Conflict Escalation* of the same date |
| **Amended** | **GOV-001**, Product Owner authorization *Reporting Governance Consolidation and Traceability* (2026-11-08): standing documentation publication permission (§5.0), concise-summary rule (§5.2), finding identifiers (§3), revision traceability (§2.4), merge controls (§5.4), retention and cleanup (§10) |
| **In force** | When this file is merged to `main`. Until then it is the proposed text in the GOV-001 Draft PR |
| **Supersedes** | Every other reporting-protocol text: this file and the reporting changes to `CLAUDE.md` / `docs/engineering-missions/README.md` in PR #36; this file and the *Agent Reporting Protocol* section of `CLAUDE.md` in PR #23; `REPORTING-PROTOCOL.md` in PR #16. See [§9](#9-relationship-to-other-governance) |

---

## 1. Purpose

Noetia keeps a continuous, auditable record of its development and decisions. Findings, decisions, and verification results must never exist only in a terminal conversation.

**Reporting is mandatory. Publication in the repository is subject to authorization.**

## 2. When a report is required

### 2.1 Every meaningful iteration

A **meaningful iteration** is an assigned unit of engineering, architecture, audit, research, security, or documentation work that produces any of:

- findings,
- changes,
- decisions,
- validation results, or
- a blocker.

Examples: audits and investigations, architecture and security reviews, legal and policy comparisons, bug investigations, implementation and testing work, production-readiness assessments, governance or documentation missions.

Individual commands, routine file reads, and simple acknowledgments do not independently require a report.

### 2.2 Blocked or incomplete work

An iteration that ends early, is blocked, or is interrupted produces a **partial report** stating the blocker, the work already completed, and what remains.

### 2.3 Read-only missions

A read-only restriction **does not remove the obligation to report**. It only changes the publication method ([§5.2](#52-when-repository-writes-are-not-authorized)).

### 2.4 One report per mission

A mission has **one** report. Each later iteration updates it, adding a dated entry to its revision history, rather than creating a duplicate report or PR. A separate report is justified only for a distinct mission, a distinct implementation stage with its own branch, or a separately assessed finding (§3).

**Revision traceability.** Every published iteration updates, together:
1. the report's revision history (revision number, date, change);
2. a **Revision N** section in the Draft PR description;
3. the commit SHA, stated in the agent's final response.

## 3. Location and naming

`docs/reports/YYYY-MM-DD-<MISSION-ID>-<short-description>.md`

- `YYYY-MM-DD` is the date the report was first created.
- `<MISSION-ID>` is the identifier the Product Owner approved (for example `NEM-016`, `NOF-004`, `SA-003`). If no identifier exists yet, propose one and ask; do not publish under an invented identifier.
- **Separately assessed findings** use the parent mission's identifier plus the finding label, for example `NEM-020-D6`. No new identifier is needed, and the parent mission's scope does not change. The two reports link to each other.
- Add every report to the [index](#index), newest first, with its PR(s) and status.

## 4. Required content

### 4.1 Unified structure

Every report uses these sections, in this order. A section that does not apply states **N/A** and why. It is never silently dropped.

| # | Section | Must contain |
|---|---|---|
| 1 | **Mission and objective** | Mission ID and title, mission type, authorization level, and the Product Owner instruction that authorized it |
| 2 | **Date and status** | Dates; lifecycle status (Draft · Approved · In progress · Review · Completed · Blocked · Cancelled); **delivery state** stated separately (Not merged · Merged · Deployed) |
| 3 | **Repository baseline** | Branch(es) and commit SHA(s) examined, and the base of any branch created |
| 4 | **Scope and exclusions** | What was in scope, what was excluded, and any restriction that applied |
| 5 | **Executive summary** | The conclusion, in a few lines |
| 6 | **Work completed** | What was actually done in this iteration |
| 7 | **Verified findings and evidence** | Findings with repository `file:line` references where practical |
| 8 | **External references** | Official URLs with access dates. Write "none" when none were used |
| 9 | **Risks** | Rated **Critical / High / Medium / Low** |
| 10 | **Decisions** | (a) Decisions made under existing authority; (b) decisions requiring Product Owner approval. Product Owner decisions are never mixed with engineering recommendations |
| 11 | **Recommendations** | Required corrections separated from optional improvements. A recommendation is not an approved instruction |
| 12 | **Changes made** | Files created or modified (paths and purpose); database, migrations, and backfills; configuration and secrets; external services (Stripe, providers, DNS); deployments; commit SHA(s). **Or an explicit statement that none were made** |
| 13 | **Tests and validation** | What was run and the results, including failures and limitations. Tests not run are stated as not run |
| 14 | **Deviations and discoveries** | Any difference from the approved scope, and out-of-scope findings |
| 15 | **Protected-systems confirmation** | What was explicitly **not** modified (reader / Escucha Activa, ownership, production data, billing, business-rule engines) |
| 16 | **Open questions and unresolved items** | Everything still undecided, unverified, or blocked |
| 17 | **Next recommended action** | A recommendation only. It is never executed automatically |

Implementation missions also complete the mission document's §18 completion report ([`MISSION-TEMPLATE.md`](../engineering-missions/MISSION-TEMPLATE.md)). The report and the mission document link to each other; neither replaces the [Definition of Done](../engineering-missions/DEFINITION-OF-DONE.md).

### 4.2 Evidence discipline

- Keep **verified facts**, **interpretations**, **assumptions**, and **unverified claims** visibly separate, for example with labels such as `[CODE]`, `[POLICY]`, `[UNMERGED]`, `[PROPOSED]`, `[ASSUMPTION]`, `[UNVERIFIED]`, `[OPEN]`.
- Never present an unexecuted test as passed, a proposed solution as implemented, a draft decision as approved, or an estimate as measured.
- Never invent a citation. A claim without a source is marked unverified.
- Legal conclusions are internal risk assessments, not legal certification.

## 5. Publication

### 5.0 Standing documentation publication permission

For every **explicitly authorized** assessment, investigation, audit, or mission iteration, documentation-only publication is permitted **unless the instruction expressly restricts it**. This permits only:

- creating or updating that work's report under `docs/reports/`;
- its index entry in this file;
- an isolated documentation branch created from `origin/main` in a separate `git worktree`, its commits and pushes;
- creating that branch's **Draft** PR and updating its description.

It does **not** authorize: application code, configuration, infrastructure, CI/CD, database, Stripe, or production changes; deployments; merges or pushes to `main`; closing PRs or deleting branches; or documentation outside that report and its index entry (including governance files).

An explicit instruction prohibiting repository changes (for example "do not modify files") **overrides** this permission; §5.2 then applies.

### 5.1 When repository documentation writes are authorized (explicitly or under §5.0)

**Read-only research, audit, and governance missions**
- Create a dedicated documentation branch from the authorized base, after checking existing branches and PRs so no pending work is duplicated or overwritten.
- Commit only the report, the index update, and any documentation the authorization names.
- Open a **Draft PR** and give its URL in the final response. Never merge.

**Implementation missions**
- Put the report in the authorized implementation branch and Draft PR, and link it from the PR description.
- Update the report when findings or test results change.

### 5.2 When repository writes are not authorized

- Deliver the **complete** report in the agent response.
- State its intended path under `docs/reports/`.
- Mark it: **PENDING PUBLICATION — PRODUCT OWNER AUTHORIZATION REQUIRED**.
- Preserve the content so it can be published later without redoing the work.
- Never claim the report exists in GitHub until it has been committed and verified.

Do not create a branch, commit, PR, or file **only** because this protocol requires a report.

**Concise summaries.** A request for a concise answer governs only the chat reply. It never replaces the complete report: the report is published under §5.0/§5.1, or delivered complete under this section with the banner and intended path. A concise reply without either is non-compliant.

### 5.3 Failure

If publication fails, say so explicitly and deliver the report in the response under §5.2.

### 5.4 Review and merge controls

A report PR stays a **Draft** until all of the following are recorded:

1. **Independent Product Architecture review**, with a verdict ([`REVIEW-CHECKLIST.md`](../engineering-missions/REVIEW-CHECKLIST.md)), recorded in the report or the PR.
2. **Product Owner acceptance**, recorded in the report.
3. A **separate, explicit Product Owner merge instruction identifying the PR** by number. Acceptance alone is not a merge instruction.

Because every push to `main` triggers the production deployment (`.github/workflows/cd.yml`), every proposed merge — including documentation-only merges — states:

- a **deployment impact assessment**: what the deploy rebuilds and restarts, expected downtime, and rollback;
- **confirmation that no conflicting deployment is underway** (`gh run list --workflow cd.yml --limit 5` shows none queued or in progress), taken immediately before merging.

## 6. Conflict escalation

If an instruction, mission brief, repository policy, agent rule, or prior decision appears to conflict with this protocol or another standing Product Owner requirement:

1. **Stop before taking the conflicting action.**
2. Notify the Product Owner, identifying:
   - the two conflicting instructions and their sources;
   - why they conflict;
   - the practical consequence of each interpretation;
   - the recommended resolution;
   - whether work can safely continue meanwhile.
3. Do not silently pick one interpretation. A newer instruction does not automatically override a standing governance requirement when the intended exception is unclear.

Mentioning a conflict in passing while proceeding is **not** escalation.

## 7. Authorization boundaries

- A reporting requirement never authorizes a repository write by itself. The only standing write permission is the documentation-only publication permission in §5.0.
- Commit, push, PR creation, merge, deployment, database changes, Stripe or payment changes, infrastructure or secret changes, and paid API calls each remain subject to their own authorization ([`engineering-missions/README.md` §Authorization levels](../engineering-missions/README.md#authorization-levels)).
- A report, an audit, or a recommendation does not authorize implementing it. A planning baseline does not authorize implementation.
- Local agent configuration (`.claude/settings.local.json`) is never committed unless a mission explicitly authorizes it.
- This protocol never authorizes a direct change to production, application code, or deployment configuration.

## 8. Safety

- Never publish credentials, secrets, tokens, personal customer data, or sensitive production information. Use counts, not customer records.
- Preserve Product Owner decisions as written, and list unresolved ones.
- Keep mission (`NEM-###`, `SA-###`, `NOF-###`) and decision (`PO-###`, `TT-##`) identifiers stable. A superseded decision is amended, never renumbered.

## 9. Relationship to other governance

| Document | Relationship |
|---|---|
| [`docs/engineering-missions/README.md`](../engineering-missions/README.md) | Governs missions: roles, lifecycle, authorization, and the implementation completion standard. Its reporting reference points here |
| [`DEFINITION-OF-DONE.md`](../engineering-missions/DEFINITION-OF-DONE.md) and [`MISSION-TEMPLATE.md`](../engineering-missions/MISSION-TEMPLATE.md) §18 | Unchanged and still required. Their reporting items (changed files, commit SHA, deviations, discoveries, protected-systems confirmation) are part of §4.1 |
| [`CLAUDE.md`](../../CLAUDE.md) | Agent instructions. Its Git Workflow commit/push rule applies only when those operations are authorized ([§7](#7-authorization-boundaries)) |
| PR [#36](https://github.com/Carloskfe/noetia/pull/36) | Contained the 2026-11-07 consolidation of this file, `CLAUDE.md`, and `docs/engineering-missions/README.md`. **GOV-001 moves that governance content here.** PR #36 is to keep only the SA-003 audit and annexes; its governance changes are to be removed in a later, separately approved revision (GOV-001 report §11) |
| PR [#16](https://github.com/Carloskfe/noetia/pull/16) (`REPORTING-PROTOCOL.md`, `REGISTRY.md`) | **Proposal, not in force, not merged.** Its useful requirements are included here: delivery state separate from lifecycle status, update at every checkpoint, explicit authorization gates, draft PRs, and stable identifiers. Its mission registry, if the Product Owner approves it, would index **missions** and link to reports here. It must not become a second reporting standard. Its rule that "detailed reports live once, in the mission document" is replaced by §4.1, where the mission document and the report link to each other |
| PR [#23](https://github.com/Carloskfe/noetia/pull/23) | Adds an earlier version of this file **and an *Agent Reporting Protocol* section in `CLAUDE.md`** together with the NOF-004 report. Both protocol texts are superseded. PR #23 is to keep only its report (its index row is already here); its `README.md` and `CLAUDE.md` changes are to be removed in a later, separately approved revision, and PR #24 (stacked on #23) restacked |

## 10. Retention and cleanup

- **Accepted reports are preserved permanently** in `docs/reports/` once merged.
- A superseded report is **never deleted**. Its index entry and its own status line say *Superseded by …* with a link.
- Temporary, superseded, or orphaned branches and PRs are proposed for closure in a **cleanup inventory** that states each item's dependencies (stacked PRs, deployed or staging use, unmerged reports). Nothing is closed or deleted without separate Product Owner approval of that item.
- Branches that may be in operational use (`staging-candidate/*`, `deploy/*`, `backup/*`, `nem-0xx-staging*`) are excluded from cleanup until their server use has been checked.

---

## Index

Newest first. **Location:** reports not yet on `main` are linked on their branch.

| Date | Mission | Report | PR(s) | Status |
|---|---|---|---|---|
| 2026-11-08 | GOV-001 | [Reporting governance reconciliation](2026-11-08-GOV-001-reporting-governance-reconciliation.md) | This PR (Draft) | **Conditionally approved** by Product Architecture 2026-11-08 (condition: reconcile #16, #23, #24, #36 first); PO acceptance pending; merge not granted. Not merged |
| 2026-11-08 | SA-002-T0 | [Architecture review of ADR-005 and ADR-006](https://github.com/Carloskfe/noetia/blob/docs/sa-002-t0-adr-005-006-review/docs/reports/2026-11-08-SA-002-T0-ADR-005-006-architecture-review.md), on its branch | [#41](https://github.com/Carloskfe/noetia/pull/41) (Draft, stacked on #40); Rev 2: [#42](https://github.com/Carloskfe/noetia/pull/42) (Draft, stacked on #41) | Both ADRs: accept with required corrections. Rev 2: PO accepted B-1…B-5; incorporated in ADR-005/006 rev 3 and NEM-019 rev 4; ADRs remain Proposed, NEM-019 DRAFT. Not merged |
| 2026-11-08 | NEM-020-D6 | [Live payment exposure assessment](https://github.com/Carloskfe/noetia/blob/docs/nem-020-d6-live-payment-exposure/docs/reports/2026-11-08-NEM-020-D6-live-payment-exposure-assessment.md), on its branch | [#38](https://github.com/Carloskfe/noetia/pull/38) (Draft) | Assessment accepted (PA 2026-11-08). **Contained** 2026-11-08 (Option A executed and verified by the PO; Rev 5); D6 **not closed** pending the durable payments control. Merge not granted. Not merged |
| 2026-11-07 | NEM-020 | [Pre-launch billing and commercial data inventory](https://github.com/Carloskfe/noetia/blob/docs/nem-020-pre-launch-billing-inventory/docs/reports/2026-11-07-NEM-020-pre-launch-billing-inventory.md) (Rev 3), on its branch | [#37](https://github.com/Carloskfe/noetia/pull/37) (Draft) | Partial: operator inventory outputs outstanding; D6 escalated. ADR-007 acceptance and NEM-021 BLOCKED. Not merged |
| 2026-11-07 | SA-003 | [Pricing, subscriptions and AI economics readiness audit](https://github.com/Carloskfe/noetia/blob/docs/sa-003-readiness-audit-reporting-governance/docs/reports/2026-11-07-SA-003-pricing-subscriptions-ai-economics-readiness-audit.md) (Rev 7), on its branch. Annexes: [A — NEM-020 mission draft](https://github.com/Carloskfe/noetia/blob/docs/sa-003-readiness-audit-reporting-governance/docs/reports/2026-11-07-SA-003-annex-A-NEM-020-mission-draft.md) · [B — ADR-007 draft](https://github.com/Carloskfe/noetia/blob/docs/sa-003-readiness-audit-reporting-governance/docs/reports/2026-11-07-SA-003-annex-B-ADR-007-draft.md) | Report PR: [#36](https://github.com/Carloskfe/noetia/pull/36) (Draft) | Rev 5 accepted as the working pre-launch recommendation; Q4 decided 2026-11-07 (coordinated launch of all three tiers); Rev 7 awaiting PO review. NEM-020 and ADR-007 are drafts, not approved. Not merged |
| 2026-11-06 | SA-002-T0 | [T0 decision closure and NEM-019 readiness](https://github.com/Carloskfe/noetia/blob/docs/t0-decision-closure/docs/reports/2026-11-06-SA-002-T0-decision-closure.md), on its branch | [#35](https://github.com/Carloskfe/noetia/pull/35) (Draft); Rev 2: [#40](https://github.com/Carloskfe/noetia/pull/40) (Draft, stacked on #35) | Rev 2 (2026-11-08): TT-02, TT-04, TT-05, TT-21 **decided** (PO-026, 027, 028, 030); TT-01, TT-12 open; PO-025, PO-029 drafts; ADR-005/006 rev 2 Proposed; NEM-019 rev 3 DRAFT. Not merged |
| 2026-11-06 | SA-002 | [Three-tier architecture reconciliation](https://github.com/Carloskfe/noetia/blob/docs/three-tier-architecture-reconciliation/docs/reports/2026-11-06-SA-002-three-tier-architecture-reconciliation.md), on its branch | [#34](https://github.com/Carloskfe/noetia/pull/34) (Draft) | Proposed; awaiting review |
| 2026-11-04 | NEM-016 | [Integrated staging candidate rc2](https://github.com/Carloskfe/noetia/blob/docs/nem-016-rc2-report/docs/reports/2026-11-04-NEM-016-integrated-staging-candidate-rc2.md), on its branch | [#33](https://github.com/Carloskfe/noetia/pull/33) (Draft) | Not merged or deployed |
| 2026-11-03 | NEM-016 | [Residual risks R1–R3](https://github.com/Carloskfe/noetia/blob/fix/nem-016-residual-risks/docs/reports/2026-11-03-NEM-016-residual-risks.md), on its branch | [#32](https://github.com/Carloskfe/noetia/pull/32) (Draft) | Not merged or deployed |
| 2026-11-03 | NEM-016 | [F1/F2 corrective](https://github.com/Carloskfe/noetia/blob/fix/nem-016-f1-f2-share-lifecycle/docs/reports/2026-11-03-NEM-016-F1-F2-corrective.md), on its branch | [#31](https://github.com/Carloskfe/noetia/pull/31) (Draft) | Not merged or deployed |
| 2026-11-03 | NEM-016 | [Staging acceptance harness](https://github.com/Carloskfe/noetia/blob/test/nem-016-acceptance-harness/docs/reports/2026-11-03-NEM-016-acceptance-harness.md), on its branch | [#30](https://github.com/Carloskfe/noetia/pull/30) (Draft) | Not merged |
| 2026-11-03 | NEM-016 | [Integrated staging candidate](https://github.com/Carloskfe/noetia/blob/docs/nem-016-integrated-staging-candidate/docs/reports/2026-11-03-NEM-016-integrated-staging-candidate.md), on its branch | [#29](https://github.com/Carloskfe/noetia/pull/29) (Draft) | Superseded by rc2 (#33) |
| 2026-11-03 | NEM-018 | [Shared proxy network hardening](https://github.com/Carloskfe/noetia/blob/infra/nem-018-shared-proxy-hardening/docs/reports/2026-11-03-NEM-018-shared-proxy-network-hardening.md), on its branch | [#28](https://github.com/Carloskfe/noetia/pull/28) (Draft) | Nothing applied |
| 2026-11-03 | NEM-017 | [Pre-deployment compatibility](https://github.com/Carloskfe/noetia/blob/docs/nem-017-predeploy-verification/docs/reports/2026-11-03-NEM-017-predeploy-compatibility.md) and [deploy prep / AutoGuildX DNS](https://github.com/Carloskfe/noetia/blob/docs/nem-017-predeploy-verification/docs/reports/2026-11-03-NEM-017-deploy-prep-and-autoguildx-dns.md), on their branch | [#27](https://github.com/Carloskfe/noetia/pull/27) (Draft) | Not merged |
| 2026-11-02 | NEM-017 | [S19 staging/production network isolation](https://github.com/Carloskfe/noetia/blob/infra/nem-017-s19-network-isolation/docs/reports/2026-11-02-NEM-017-s19-network-isolation.md), on its branch | [#26](https://github.com/Carloskfe/noetia/pull/26) (Draft) | Not merged |
| 2026-11-02 | NEM-016 | [SA-001 Stage 0: sharing security and integrity (implementation)](https://github.com/Carloskfe/noetia/blob/fix/nem-016-sa001-stage0-sharing-integrity/docs/reports/2026-11-02-NEM-016-sa001-stage0-sharing-integrity.md), on its branch | [#25](https://github.com/Carloskfe/noetia/pull/25) (Draft) | Implemented; not merged or deployed |
| 2026-11-02 | SA-001 | [Smart book sharing: architecture review and approved decisions](https://github.com/Carloskfe/noetia/blob/docs/sa-001-smart-book-sharing/docs/reports/2026-11-02-SA-001-smart-book-sharing.md), on its branch | [#24](https://github.com/Carloskfe/noetia/pull/24) (Draft, stacked on #23) | Decisions approved; Stage 0 in #25 |
| 2026-11-02 | NOF-004 | [Terms of Service legal benchmark audit](https://github.com/Carloskfe/noetia/blob/docs/nof-004-legal-benchmark-audit/docs/reports/2026-11-02-NOF-004-legal-benchmark-audit.md), on its branch | [#23](https://github.com/Carloskfe/noetia/pull/23) (Draft). Related: [#21](https://github.com/Carloskfe/noetia/pull/21), [#22](https://github.com/Carloskfe/noetia/pull/22) | Complete; awaiting PO review |

Index statuses were taken from PR state and titles on 2026-11-07. A row's PR is the authority if the two disagree.
