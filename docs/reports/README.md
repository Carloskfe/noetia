# Noetia reports and reporting protocol

**This file is Noetia's single authoritative reporting protocol.** Agent instructions (`CLAUDE.md`) and engineering-mission governance (`docs/engineering-missions/README.md`) refer here instead of repeating it.

| | |
|---|---|
| **Established** | Product Owner, 2026-11-02 (Permanent Agent Reporting Protocol, first published in Draft PR [#23](https://github.com/Carloskfe/noetia/pull/23)) |
| **Consolidated** | Product Owner authorization of 2026-11-07 (SA-003, *Reporting Governance Consolidation*) and the Product Owner directive *Mandatory Iteration Reporting, Documentation Traceability and Instruction Conflict Escalation* of the same date |
| **In force** | When this file is merged to `main`. Until then it is the proposed text in its Draft PR |
| **Supersedes** | The protocol text of this file in PR #23 (that PR also adds an earlier version of this file; see [§9](#9-relationship-to-other-governance)) |

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

A mission has **one** report. Each later iteration updates it, adding a dated entry to its revision history, rather than creating a duplicate report or PR. A separate report is justified only for a distinct mission or a distinct implementation stage with its own branch.

## 3. Location and naming

`docs/reports/YYYY-MM-DD-<MISSION-ID>-<short-description>.md`

- `YYYY-MM-DD` is the date the report was first created.
- `<MISSION-ID>` is the identifier the Product Owner approved (for example `NEM-016`, `NOF-004`, `SA-003`). If no identifier exists yet, propose one and ask; do not publish under an invented identifier.
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

### 5.1 When repository documentation writes are authorized

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

### 5.3 Failure

If publication fails, say so explicitly and deliver the report in the response under §5.2.

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

- A reporting requirement never authorizes a repository write by itself.
- Commit, push, PR creation, merge, deployment, database changes, Stripe or payment changes, infrastructure or secret changes, and paid API calls each remain subject to their own authorization ([`engineering-missions/README.md` §Authorization levels](../engineering-missions/README.md#authorization-levels)).
- A report, an audit, or a recommendation does not authorize implementing it. A planning baseline does not authorize implementation.
- Local agent configuration (`.claude/settings.local.json`) is never committed unless a mission explicitly authorizes it.

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
| PR [#16](https://github.com/Carloskfe/noetia/pull/16) (`REPORTING-PROTOCOL.md`, `REGISTRY.md`) | **Proposal, not in force, not merged.** Its useful requirements are included here: delivery state separate from lifecycle status, update at every checkpoint, explicit authorization gates, draft PRs, and stable identifiers. Its mission registry, if the Product Owner approves it, would index **missions** and link to reports here. It must not become a second reporting standard. Its rule that "detailed reports live once, in the mission document" is replaced by §4.1, where the mission document and the report link to each other |
| PR [#23](https://github.com/Carloskfe/noetia/pull/23) | Adds an earlier version of this file together with the NOF-004 report. When both PRs are merged, this version governs; PR #23's copy needs a rebase that keeps its index row and drops its protocol text |

---

## Index

Newest first. **Location:** reports not yet on `main` are linked on their branch.

| Date | Mission | Report | PR(s) | Status |
|---|---|---|---|---|
| 2026-11-07 | SA-003 | [Pricing, subscriptions and AI economics readiness audit](2026-11-07-SA-003-pricing-subscriptions-ai-economics-readiness-audit.md) | Report PR: this Draft PR | Complete; awaiting PO review. Not merged |
| 2026-11-06 | SA-002-T0 | [T0 decision closure and NEM-019 readiness](https://github.com/Carloskfe/noetia/blob/docs/t0-decision-closure/docs/reports/2026-11-06-SA-002-T0-decision-closure.md), on its branch | [#35](https://github.com/Carloskfe/noetia/pull/35) (Draft) | Awaiting PO acceptance of PO-025…029 |
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
