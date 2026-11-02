# Agent reports

Every substantial piece of Claude Code (coding-agent) work on Noetia leaves a Markdown report in this folder. Important findings must not exist only in a terminal conversation.

**Status:** established by Product Owner instruction on 2026-11-02 (Permanent Agent Reporting Protocol).
**Relationship to PR #16:** [PR #16](https://github.com/Carloskfe/noetia/pull/16) proposes `docs/engineering-missions/REPORTING-PROTOCOL.md` and `REGISTRY.md`. It is still open and not in force. This folder holds **reports**; the PR #16 registry, if approved, would index **missions** and could link here. How the two fit together is a Product Owner decision. Until then, `docs/engineering-missions/README.md` governs missions, and this protocol governs reports.

---

## Protocol

### 1. When a report is required

Every substantial mission produces a report:
- audits and investigations
- architecture and security reviews
- legal and policy comparisons
- bug investigations
- implementation and testing work
- production-readiness assessments

### 2. Location and naming

`docs/reports/YYYY-MM-DD-<mission-id>-<short-description>.md`, for example `2026-11-02-NOF-004-legal-benchmark-audit.md`.

Add every report to the [index](#index) below, newest first, with its associated PR(s).

### 3. Required structure

1. Mission and objective
2. Date and status
3. Scope and exclusions
4. Executive summary
5. Verified findings, with repository file references and line numbers where practical
6. External references, with official URLs and access dates
7. Risks: Critical / High / Medium / Low
8. Recommendations, separating required corrections from optional improvements
9. Tests and verification performed, including failures and limitations
10. Open questions and Product Owner decisions required
11. Changes made, or an explicit statement that no application changes were made
12. Next recommended action

Keep **facts**, **interpretations** and **unverified assumptions** clearly separate. Never describe a proposed change as approved or deployed unless that actually happened.

### 4. Publishing on GitHub

**Read-only research missions**
- Write the report on a dedicated documentation branch.
- Commit the report and the index update.
- Open a **Draft PR** containing only the report and documentation-index changes.
- Give the Draft PR URL in the final response. Do not merge.

**Implementation missions**
- Put the report in the authorized implementation branch and Draft PR.
- Link it from the PR description.
- Update the report when findings or test results change.
- Do not merge or deploy without explicit Product Owner authorization.

Update an existing mission report rather than creating duplicate reports or PRs.

### 5. Governance restrictions

- A report does not authorize implementing its recommendations.
- Never merge, deploy, change production or Stripe, or write to databases without explicit authorization.
- Never publish credentials, personal customer data, secrets or sensitive production information. Use counts, not customer records.
- Legal conclusions are internal risk assessments, not legal certification.
- Preserve Product Owner decisions and list unresolved ones.
- If publishing to GitHub fails, say so explicitly. Never claim a report is available when it isn't.

---

## Index

| Date | Mission | Report | PR(s) | Status |
|---|---|---|---|---|
| 2026-11-02 | NOF-004 | [Terms of Service legal benchmark audit (Amazon, Kindle, Google Play, NY and US law)](2026-11-02-NOF-004-legal-benchmark-audit.md) | Report PR: [#23](https://github.com/Carloskfe/noetia/pull/23) (Draft). Related: [#21](https://github.com/Carloskfe/noetia/pull/21), [#22](https://github.com/Carloskfe/noetia/pull/22) (Draft, untouched) | Complete; awaiting PO review |
