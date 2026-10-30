# Engineering Reporting & Chain of Command Protocol

**Status:** PROPOSAL — **ready for governance review**; not in force until the Product Owner approves it (governance change, §4).
**Relationship to existing governance:** extends [`README.md`](README.md) (roles, lifecycle, authorization levels). Where the two differ, `README.md` governs until this proposal is approved; differences are listed in §7.

## 1. Authority

| Role | Authority | Does not |
|---|---|---|
| **Product Owner** | Final authority for business policy, mission scope, production releases, budgets, exceptional changes | — |
| **Product Architecture** (ChatGPT) | Independent reviewer and adviser: inspects repository evidence, identifies risks, proposes missions, recommends decisions | Independently authorize changes |
| **Coding Agent** (Claude Code / implementation agent) | Executes explicitly authorized missions within their approved boundaries | Treat a recommendation, review, or passing test as authorization |

## 2. GitHub is the source of truth

[`REGISTRY.md`](REGISTRY.md) is the single index of missions. Each row holds:

- mission ID and title;
- **lifecycle status** — Draft / Approved / In Progress / Review / Completed / Blocked / Cancelled (`README.md` lifecycle);
- **delivery state** — Not merged / Merged / Deployed (facts about `main` and production, independent of acceptance);
- branch and PR links;
- one-line summary, test evidence link, risks/blockers, decisions pending, next recommended action.

Detailed reports live **once**: in the mission document (`docs/engineering-missions/<STATE>/NEM-###-*.md`, §18 Completion report) and in its PR description. The registry links to them; it does not repeat them.

**Update rule:** the Coding Agent updates the registry row, the mission document, and the PR description at every meaningful checkpoint (implementation complete, review requested, blocker found, merged, deployed).

## 3. Completion reporting

At each review checkpoint the mission document and PR state:

1. What was implemented.
2. What was tested, and the results (with links to CI runs).
3. What remains incomplete.
4. Any deviation from approved scope.
5. Security, billing, privacy, or customer-impact risks.
6. Decisions required from the Product Owner.
7. Whether the work is **implemented**, **merged**, or **deployed** — stated explicitly.

Passing tests are evidence, not production approval.

## 4. Authorization gates (explicit Product Owner approval required)

- New mission implementation, or material scope expansion.
- Database migrations and production data changes.
- Stripe or payment configuration changes.
- Production infrastructure or secret changes.
- Merging to a production-deploying branch (`main` deploys production via `cd.yml`).
- Production deployment and rollback.
- Changes to agent permissions or governance rules (including this protocol).

A GitHub PR approval, a technical recommendation, or a completed test does **not** grant merge or deployment authorization.

## 5. Safety

- Work awaiting review is opened as a **draft PR**.
- Never expose credentials or sensitive customer data in reports, PRs, logs, or chat. Share counts, not customer rows.
- Preserve auditability and historical ownership records.
- Never bypass required checks to make CI green; report the failure instead.
- Report blockers rather than silently changing scope.
- Keep mission (`NEM-###`) and decision (`PO-###`, `B-#`) identifiers stable; a superseded decision is amended, never renumbered.
- Local agent configuration (`.claude/settings.local.json`) is never part of a PR; permission changes follow §4.

## 6. Objective

The Product Owner and Product Architecture can understand current development status from GitHub alone — `REGISTRY.md`, mission documents, and PRs — without copying agent conversations.

## 7. Differences from `README.md` — Product Owner decision required

| # | Topic | `README.md` today | This proposal | Recommendation |
|---|---|---|---|---|
| P-1 | Status vocabulary | One lifecycle ending in COMPLETED (review **and** acceptance) | Adds Merged / Deployed | **Recommended (Product Architecture, 2026-10-30):** preserve the existing mission lifecycle unchanged and track merge / deployment separately as a **delivery state** (§2) — a mission can be Deployed but not yet Completed (awaiting acceptance) |
| P-2 | Product Architecture | Owns mission drafting and implementation review | Named reviewer/adviser (ChatGPT) without independent authorization | Consistent; adopt the explicit "does not authorize" wording |
| P-3 | Registry | None (missions filed by folder) | `REGISTRY.md` | Adopt; folders keep the documents, the registry indexes them |
