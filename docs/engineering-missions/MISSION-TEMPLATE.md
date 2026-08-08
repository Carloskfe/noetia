<!--
Copy this file to start a new mission. New missions begin in DRAFT/ and move
through the lifecycle (DRAFT → APPROVED → IN-PROGRESS → COMPLETED) per README.md.
Fill the header, then every section. Delete guidance comments before approval.
-->

# NOETIA ENGINEERING MISSION — NEM-###
## <Mission Title>

**Status:** DRAFT
**Mission type:** DISCOVERY | DESIGN | IMPLEMENTATION | REMEDIATION | INFRASTRUCTURE | REVIEW | GOVERNANCE
**Implementation authorization:** NONE | DOCUMENTATION ONLY | LIMITED | FULL-WITHIN-SCOPE
**Schema changes:** NOT AUTHORIZED | ADDITIVE ONLY | SPECIFICALLY AUTHORIZED
**Infrastructure changes:** NOT AUTHORIZED | SPECIFICALLY AUTHORIZED
**Production deployment:** NOT AUTHORIZED | AUTHORIZED AFTER TESTS | AUTHORIZED WITH CONDITIONS
**Product Owner approval:** REQUIRED

> Reminder: **APPROVED ≠ EXECUTE.** Even after Product Owner approval, this mission is executed only on an explicit Product Owner instruction naming it (e.g. "Execute NEM-### according to the approved mission").

---

## 1. Context
Why this mission exists; the product/business situation it serves; what changed to prompt it.

## 2. Objective
The single, bounded outcome. What "done" produces. Keep it narrow.

## 3. Dependencies
Prior missions, decisions, data, or infrastructure this relies on. What must be true before starting.

## 4. Source-of-truth references
Product Owner decisions, Product Bible / ADRs, prior missions, baseline docs, and code paths that govern this work (per the README source-of-truth hierarchy).

## 5. In scope
Exactly what may change. Enumerate components/files/areas explicitly for LIMITED authorization.

## 6. Out of scope
Explicitly what must NOT change — especially protected systems and adjacent temptations. "Not mentioned" is not "authorized".

## 7. Product rules
The product/business rules this work must honor (pricing, ownership, tokens, entitlements, rights, etc.). If a needed rule is undefined, it is an **Open decision** (§16), not an engineering guess.

## 8. Protected systems
Systems that must remain untouched/undegraded (default set: Escucha Activa / sync pipeline, reader, permanent ownership paths, production data, business-rule engines). Note any that this mission is *authorized* to touch.

## 9. Technical requirements
Concrete engineering requirements, constraints, patterns to follow, and non-functional needs (performance, isolation, idempotency, etc.).

## 10. Security / privacy / copyright
Auth/authz expectations, data-isolation and privacy requirements, secret handling, and any copyright/rights constraints.

## 11. Acceptance criteria
Objective, checkable conditions that define success. Written so Product Architecture can verify them.

## 12. Required tests
Unit / integration / regression / negative cases that must exist and pass. Name the critical negative cases explicitly.

## 13. Observability
Metrics/logs/traces/events to add or preserve; dashboards/alerts affected. "None" is a valid, explicit answer.

## 14. Deployment / rollout
Deployment authorization, sequencing, flags, staging expectations, verification steps, and rollback path. Distinguish commit from deployment.

## 15. Documentation deliverables
Docs to create/update (technical docs, ADRs, Product Bible impact, baseline reconciliation).

## 16. Open decisions
Material product/legal/pricing decisions this mission needs but cannot make. For each: question · why it matters · options · technical consequence · recommended default (if engineering has one). **These block execution where material (README ambiguity rule).**

## 17. Stop conditions
Explicit conditions under which Claude must STOP and ask / mark BLOCKED (per README BLOCKED + ambiguity rules), beyond the standard ones.

## 18. Completion report
The report Claude produces at REVIEW, following the README Completion Report Standard: Mission · Status · Changed Files · Database · Tests · Verification · Deployment · Deviations · Risks · Discoveries · Protected Systems Confirmation · Commit (SHA) · Recommended Next Step.

## 19. Product Architecture review
Reviewer, review checklist reference (`REVIEW-CHECKLIST.md`), and the verdict field (APPROVE / APPROVE WITH FOLLOW-UP / REJECT-REMEDIATE). Completion requires review + Product Owner acceptance.

---

> **STOP after completing authorized work. Do not begin another mission without explicit Product Owner authorization.**
