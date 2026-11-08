# GOV-001 — Reporting Governance Consolidation and Traceability

> **Status: REVIEW — governance text consolidated in this Draft PR; nothing merged.** Awaiting independent Product Architecture review and Product Owner acceptance.
>
> - **One authoritative protocol:** `docs/reports/README.md`, with concise references in `CLAUDE.md` and `docs/engineering-missions/README.md`. It supersedes the protocol texts in PRs #16, #23, and #36.
> - **Amendments approved by the PO (2026-11-08):** standing documentation-only publication permission (§5.0), concise-summary rule (§5.2), finding identifiers such as `NEM-020-D6` (§3), revision traceability (§2.4), review and merge controls with deployment-impact checks (§5.4), retention and cleanup (§10).
> - **No merges, PR closures, restacks, or branch deletions** were made. PRs #16, #23, #24, and #36 are untouched; their reconciliation is a plan (§11.2) awaiting review.
> - Pending assessment published: **NEM-020-D6** in Draft PR [#38](https://github.com/Carloskfe/noetia/pull/38).

Evidence labels: **[REPO]** observed in the repository or on GitHub · **[UNMERGED]** text in an open PR, not in force · **[PROPOSED]** recommendation only.

---

Draft PR: [#39](https://github.com/Carloskfe/noetia/pull/39).

## 1. Mission and objective

| | |
|---|---|
| **Identifier** | GOV-001 — Reporting Governance Consolidation and Traceability |
| **Type** | Governance / documentation |
| **Authorization** | Product Owner, *Product Owner Authorization — GOV-001* (2026-11-08), approving the nine decisions of the *Reporting Governance Reconciliation — Assessment Only* (2026-11-08). Level: **DOCUMENTATION ONLY** |
| **Objective** | One authoritative reporting protocol; standing documentation-only publication permission; consistent Draft PR reporting and revisions; Product Architecture review and PO acceptance before merging; retention and cleanup rules; no production, code, or deployment-configuration change |

## 2. Date and status

| | |
|---|---|
| **Dates** | Assessment 2026-11-08 (delivered in chat, pending publication); executed and published 2026-11-08 |
| **Lifecycle status** | **Review** |
| **Delivery state** | **Not merged.** Nothing deployed. The protocol is in force only once merged (README header) |
| **This report authorizes** | **Nothing** beyond what the PO authorization already states |

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-08 | Reconciliation assessment published; governance consolidated; reconciliation plan and cleanup inventory prepared |

## 3. Repository baseline

| Item | Value |
|---|---|
| Base | `origin/main` `6a5e5c0850a73a9de432be87d5be647bd138dbe7` |
| This branch | `docs/gov-001-reporting-governance`, created from that base in a separate worktree |
| Governance source | PR #36 `docs/sa-003-readiness-audit-reporting-governance` `6a11e7f` (its `docs/reports/README.md`, `CLAUDE.md`, `docs/engineering-missions/README.md`; verified to be based on `6a5e5c0`) |
| Also examined | PR #23 `docs/nof-004-legal-benchmark-audit`; PR #24 `docs/sa-001-smart-book-sharing`; PR #16 `docs/reporting-protocol`; PR #37 `0e5cbcb`; `.github/workflows/cd.yml` on `main` |

## 4. Scope and exclusions

**In scope:** authorization items 1–9.

**Excluded:** application code, databases, production, Stripe, CI/CD, deployment; merges; closing, modifying, or restacking PRs #16, #23, #24, #36 (or any other); deleting branches; NEM-020 scope (#37 unchanged).

## 5. Executive summary

- **Why D6 was delivered only in chat:** the agent did not apply the proposed protocol's §5.2 (no *PENDING PUBLICATION* banner, no intended path) and did not escalate two conflicts (§7.2). Contributing causes: no protocol on `main`; no identifier for a finding assessed outside its mission; no standing publication permission.
- **Ten conflicts or gaps** were found (§7.3). This PR resolves the protocol-text ones; the rest need the follow-up revisions in §11.2.
- **Merging documentation deploys production** (`cd.yml` runs on every push to `main`, no path filter), so every merge now needs a deployment-impact assessment (§5.4 of the protocol).
- **Recommended merge sequence:** this PR first; then the trimmed #23 → restacked #24 → trimmed #36; then reports as accepted (§17).

## 6. Work completed

1. Compared the protocol texts in PRs #16, #23, #36 and the governance on `main` (`CLAUDE.md`, `docs/engineering-missions/README.md`, `DEFINITION-OF-DONE.md`, `cd.yml`).
2. Created this branch from `origin/main` and copied PR #36's governance files (protocol, `CLAUDE.md`, missions README), leaving PR #36 itself unchanged.
3. Applied the approved amendments (§12).
4. Extended the index with GOV-001, NEM-020-D6, and NEM-020, and converted the SA-003 links to branch links.
5. Published NEM-020-D6 in its own Draft PR (#38).
6. Inventoried open PRs, stacking, governance-file overlap, and branches without PRs (§7.4, §7.5).
7. Test-merged this branch locally against every open PR that touches a governance file (§13).

## 7. Verified findings and evidence

### 7.1 Why the D6 assessment existed only in chat [REPO]

| # | Cause |
|---|---|
| 1 | **Agent error.** The D6 brief authorized a read-only assessment without repository writes and excluded changes to NEM-020's scope. PR #36 §5.2 then required the complete report in chat, its intended path, and the *PENDING PUBLICATION* banner. A concise summary was delivered without either |
| 2 | **No protocol on `main`.** PRs #23 and #36 are Drafts. `main`'s `CLAUDE.md` Git Workflow says to commit and push after every unit of work, the opposite of PR #36 §7 |
| 3 | **No identifier** for a finding assessed outside its mission; PR #36 §3 forbade inventing one |
| 4 | **No standing publication permission**; every assessment needed an explicit write grant |

### 7.2 Conflicts not escalated (agent)

- "Return a concise assessment" (brief) versus "deliver the complete report" (PR #36 §5.2).
- PR #23's `CLAUDE.md` rule (read-only research is always published as a Draft PR) versus PR #36 §5.2 (publish only when authorized).

### 7.3 Conflicts and gaps

| # | Conflict or gap | Sources | Resolution |
|---|---|---|---|
| R1 | Commit and push always versus only when authorized | `main` `CLAUDE.md` Git Workflow vs PR #36 §7 [UNMERGED] | **Resolved here** (PR #36's Git Workflow wording carried over) |
| R2 | Read-only research always opens a Draft PR versus publish only when authorized | PR #23 `CLAUDE.md` *Agent Reporting Protocol* section vs PR #36 §5.2. PR #36 §9 covered only PR #23's README copy, not its `CLAUDE.md` section | **Text resolved here** (§5.0 standing permission; §9 now names the `CLAUDE.md` section). PR #23 still contains it → §11.2 step 2 |
| R3 | 12 sections versus 17 | PR #23 vs PR #36 §4.1 | **Resolved**: 17 sections, PO-approved |
| R4 | "Reports live once, in the mission document" | PR #16 `REPORTING-PROTOCOL.md` [UNMERGED]. PR #16 is **not** marked Draft on GitHub despite its title | Superseded in §9; closure needs approval → §11.2 step 5 |
| R5 | Three PRs add `docs/reports/README.md` | #23, #24 (stacked), #36, and now this PR | Merge order and trimming → §11.2 |
| R6 | Concise brief versus complete report | Briefs vs §5.2 | **Resolved** (§5.2 concise-summary rule) |
| R7 | No index on `main` | All report branches; NEM-020 D4 | **Resolved on merge** of this PR |
| R8 | No explicit merge gate for reports | PR #36 said only "never merge"; `DEFINITION-OF-DONE.md` covers missions | **Resolved** (§5.4) |
| R9 | A documentation merge is a production deploy | `.github/workflows/cd.yml`: `on: push: branches: [main]`, no path filter | **Controlled** (§5.4 deployment-impact check). A docs path filter would be a CI/CD mission (not authorized) |
| R10 | No retention or cleanup rule | — | **Resolved** (§10); inventory in §7.5 |

### 7.4 Governance-file overlap among open PRs [REPO]

| PR | Files overlapping this PR | Base | Expected interaction |
|---|---|---|---|
| #36 | `CLAUDE.md`, `docs/engineering-missions/README.md`, `docs/reports/README.md` | `main` | Superseded content. Conflicts on all three after this PR merges → trim (§11.2 step 4) |
| #23 | `CLAUDE.md`, `docs/reports/README.md` | `main` | Superseded protocol text. Add/add conflict on README; `CLAUDE.md` section to remove (§11.2 step 2) |
| #24 | `docs/reports/README.md` (two index rows, already present here) | `docs/nof-004-legal-benchmark-audit` (#23) | Restack after #23 is trimmed (§11.2 step 3) |
| #16 | `docs/engineering-missions/README.md` (+2 lines), `REGISTRY.md`, `REPORTING-PROTOCOL.md` | `main` | Superseded; close only with approval (§11.2 step 5) |
| #14 | `CLAUDE.md` (Testing section only) | `main` | Different region; see §13 |
| #10, #11, #13, #25–#28, #31–#35 | Files under `docs/engineering-missions/DRAFT|IN-PROGRESS/` only | various | No overlap with this PR |

### 7.5 Cleanup inventory (no action taken) [PROPOSED]

**Branches without a PR** (`origin`):

| Branch | Last commit | Commits ahead of `main` | Dependency | Recommendation |
|---|---|---|---|---|
| `backup/2026-07-15-sync-auth-search` | 2026-07-14 | 0 (fully merged) | Backup by name | Keep (backup); deletion only with explicit approval |
| `deploy/nem-017-on-006c` | 2026-11-03 | 20 | Possibly what staging runs | **Keep** until staging use is checked |
| `nem-006a-staging` | 2026-08-19 | 4 | **Base of PR #26** | **Keep** |
| `nem-006c-staging-content` | 2026-08-20 | 16 | Staging content (NEM-006C) | Keep until staging use is checked |
| `staging-candidate/nem-016` | 2026-11-03 | 38 | **Base of PRs #29 and #33** | **Keep** |
| `staging-candidate/nem-016-rc2` | 2026-11-03 | 47 | rc2 candidate (NEM-016) | **Keep** |
| `nem-007-creator-rights` | 2026-08-19 | 5 | None found | Review with PO: unmerged mission work |
| `nem-009-resilience-impl` | 2026-08-20 | 8 | None found | Review with PO |
| `nof-001-operating-framework` | 2026-08-19 | 4 | None found | Review with PO |
| `nof-003-resilience` | 2026-08-20 | 6 | None found | Review with PO |

**PRs:**

| PR | Observation | Dependency | Recommendation |
|---|---|---|---|
| #29 | Superseded by rc2 (#33), per the index | **Base of #30** (stack #30 → #31 → #32) | Do not close until the stack is rebased or #33 accepted |
| #16 | Superseded by this protocol; **not** a Draft | None | Mark Draft now; close as superseded (keep the registry idea as a separate decision) |
| #10, #11, #12, #13 | Open, **not** marked Draft | — | Mark Draft or confirm they are merge candidates |
| #15 | Closed; branch already deleted | — | Nothing to do |

## 8. External references

None.

## 9. Risks

| Rating | Risk | Mitigation |
|---|---|---|
| **High** | #16 and #23's `CLAUDE.md` section merge **without conflict** (§13), so a reviewer would get no warning before a competing protocol lands | Trim #23 and close #16 before either is considered for merge |
| High | Merging #23 or #36 as they stand reintroduces competing protocol text (R2, R5) | Merge this PR first; trim #23 and #36 before they merge (§11.2) |
| High | A documentation merge triggers a production deploy and could interrupt a running deploy (R9) | §5.4 deployment-impact check and `gh run list` confirmation |
| Medium | Non-draft PRs (#10–#13, #16) are easy to merge by accident | Mark Draft (approval needed) |
| Medium | Index links point at branches; they break when a branch is deleted or merged | §10 retention; update index rows when reports merge |
| Low | The identifier "GOV-001" resembles the SA-001 decision label `SA-001-GOV-001` (PR #24) | Different namespaces; noted only |

## 10. Decisions

**(a) Made under existing authority:**
- The GOV-001 report is in this governance PR (one report per mission, in its own branch). NEM-020-D6 has its own Draft PR (#38).
- The NEM-020-D6 index entry is in this PR, not in #38, because `docs/reports/README.md` is not on `main`; adding it in #38 would create a fourth add/add conflict.
- SA-003 index links converted to branch links, since the reports are not in this PR.
- PR #36 §9's description of PR #23 corrected to include its `CLAUDE.md` section (R2).

**(b) Requiring Product Owner approval:** the follow-up revisions in §11.2 (one approval per PR), cleanup items in §7.5, and each merge (§17).

## 11. Recommendations

### 11.1 Required
- Product Architecture review of this PR, then PO acceptance.

### 11.2 Reconciliation plan for PRs #16, #23, #24, #36 [PROPOSED; not executed]

| Step | PR | Change | Preserves | Depends on |
|---|---|---|---|---|
| 1 | This PR | Merge (with §5.4 check) | Protocol, index of all reports | PA review, PO acceptance, PO merge instruction |
| 2 | #23 | New commit removing its `docs/reports/README.md` and its `CLAUDE.md` *Agent Reporting Protocol* section; keep `docs/reports/2026-11-02-NOF-004-legal-benchmark-audit.md` | NOF-004 report; its index row (already here) | Step 1 merged (or rebase onto this branch) |
| 3 | #24 | Rebase onto `main` (after #23 merges) or onto trimmed #23; drop its `README.md` rows (already here) | SA-001 report and decisions | Step 2 |
| 4 | #36 | New commit removing its `docs/reports/README.md`, `CLAUDE.md`, and `docs/engineering-missions/README.md` changes; keep the SA-003 report and annexes A and B | SA-003 Rev 1–7, annexes, PO decisions (Q4 etc.) | Step 1 |
| 5 | #16 | Mark Draft; then close as superseded. Its mission registry (`REGISTRY.md`) becomes a separate PO decision | Content stays in the closed PR | PO approval |

Each step is a separate, reviewable revision. No history is rewritten on shared branches; trimming is done with new commits.

### 11.3 Optional
- A CI/CD mission to skip production deploys for documentation-only merges (R9).
- Mark #10–#13 as Draft.

## 12. Changes made

| File | Change |
|---|---|
| `docs/reports/README.md` (**new on `main`**) | Protocol from PR #36 plus: header (*Amended* by GOV-001; *Supersedes* all other protocol texts); §2.4 revision traceability; §3 finding identifiers; **§5.0 standing documentation publication permission**; §5.1 heading; §5.2 concise-summary rule; **§5.4 review and merge controls** with deployment-impact check; §7 standing-permission and no-direct-change statements; §9 rows for #36 and a corrected #23 row; **§10 retention and cleanup**; index rows for GOV-001, NEM-020-D6, NEM-020; SA-003 links as branch links |
| `CLAUDE.md` | PR #36's Git Workflow and reference-table changes, plus a concise *Reporting* reference: single standard, standing permission and its limits, pending-publication rule, merge controls, conflict escalation |
| `docs/engineering-missions/README.md` | PR #36's pointer and directory row, plus references to §5.0, §5.4, §10 and "no other reporting standard" |
| `docs/reports/2026-11-08-GOV-001-reporting-governance-reconciliation.md` (**new**) | This report |
| Code, database, configuration, CI/CD, Stripe, production | **None** |
| Other PRs and branches | **None.** #16, #23, #24, #36, #37 unchanged; nothing merged, closed, or deleted |

Also published under GOV-001 §7: Draft PR [#38](https://github.com/Carloskfe/noetia/pull/38) (`docs/nem-020-d6-live-payment-exposure`, commit `a4a2766`, one new report file).

## 13. Tests and validation

| Check | Result |
|---|---|
| Diff against `origin/main` `6a5e5c0` | Exactly the four files in §12 |
| Index branch links (19) | All targets exist on their branches |
| Relative links and internal anchors | All resolve |
| Local test merge with #14 | Clean (its `CLAUDE.md` change is in the Testing section) |
| Local test merge with #16 | **Clean — `REPORTING-PROTOCOL.md` would land silently** |
| Local test merge with #23 | Conflict in `docs/reports/README.md` only — **its `CLAUDE.md` protocol section would merge silently** |
| Local test merge with #24 | Conflict in `docs/reports/README.md` |
| Local test merge with #36 | Conflict in `CLAUDE.md`, `docs/engineering-missions/README.md`, `docs/reports/README.md` |

Test merges ran in a temporary detached worktree, were aborted, and the worktree was removed. Nothing was pushed to any other branch.

## 14. Deviations and discoveries

- Discovery: PR #36 §9 omitted PR #23's `CLAUDE.md` section (R2); corrected here.
- Discovery: PR #16 is not a Draft (R4); #10–#13 likewise.
- Discovery: `docs/reports/README.md` would be added by four PRs (R5).
- No deviation from the authorization.

## 15. Protected-systems confirmation

Not modified: reader / Escucha Activa; ownership; token ledger; production and staging data; billing code; Stripe; business-rule engines; infrastructure; CI/CD; deployment configuration; application code; any other PR or branch.

## 16. Open questions and unresolved items

| # | Item | Owner |
|---|---|---|
| 1 | Product Architecture review of this PR | Product Architecture |
| 2 | Approve each reconciliation step (§11.2) | PO |
| 3 | Cleanup items (§7.5), including the staging-use check of branches | PO |
| 4 | Whether to mark #10–#13 and #16 as Draft | PO |
| 5 | Whether a CI/CD mission should exempt documentation-only merges from deployment | PO |

## 17. Next recommended action

**Recommended merge sequence** (each needs PA review, PO acceptance, a PO merge instruction naming the PR, a deployment-impact assessment, and a `gh run list` check):

1. **This PR** — documentation only; CD will rebuild and restart services as on any push to `main`.
2. **#23**, after the step 2 trim.
3. **#24**, restacked.
4. **#36**, after the step 4 trim and SA-003 acceptance.
5. Reports as accepted: **#38** (NEM-020-D6), **#37** (NEM-020, after Rev 4), and the others in the index. Their index rows switch from branch links to relative links in the same merge.
6. **#16**: close as superseded, with approval; not merged.

*Recommendation only.*
