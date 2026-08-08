# Noetia Engineering Mission Governance

This directory is the permanent governance framework for all Noetia engineering work. It defines how approved product intent becomes bounded, reviewable technical work — and, just as importantly, what is **not** authorized.

> **Central rule:** *Product decisions precede engineering decisions. Engineering Missions convert approved product intent into bounded, reviewable technical work. Code does not expand its own mandate.*

An **Engineering Mission (NEM-###)** is a **bounded authorization** — never blanket repository permission.

Established by **NEM-004** (the transition mission). Governance applies fully to every mission created **after** NEM-004. NEM-001–003 are valid **legacy / pre-governance** records (see [§ Historical missions](#historical-missions)).

---

## Contents of this directory

| File / dir | Purpose |
|------------|---------|
| `README.md` | This framework (roles, lifecycle, authorization, principles). |
| `MISSION-TEMPLATE.md` | Required starting point for every new mission. |
| `REVIEW-CHECKLIST.md` | Product Architecture's post-mission review checklist. |
| `DEFINITION-OF-DONE.md` | When a mission is truly complete. |
| `DRAFT/` | Missions under discussion — **never executable**. |
| `APPROVED/` | Product-Owner-accepted specs — **approval ≠ execute**. |
| `IN-PROGRESS/` | Missions with an explicit execution instruction. |
| `COMPLETED/` | Missions accepted after review. |

---

## Roles

**Product Owner** — final authority for product decisions, business rules, engineering authorization, pricing, user rights, ownership rules, financial decisions, risk acceptance, mission approval, and final acceptance. No mission may expand beyond Product Owner authorization.

**Product Architecture** — owns product architecture, business-model translation, the Product Bible, architecture requirements, mission drafting, acceptance criteria, ADR proposals, and implementation review. May prepare approved documentation. Does **not** implement application code unless separately and explicitly authorized.

**Claude Code / Implementation Agent** — performs repository analysis, implementation, testing, migrations, authorized infrastructure work, technical documentation, implementation reports, and identifying conflicts/blockers. Does **not** independently make product policy.

---

## Mission lifecycle

```
DRAFT → APPROVED → IN PROGRESS → REVIEW → COMPLETED
                 (exceptional: BLOCKED, CANCELLED)
```

### DRAFT
Under discussion; may change; **not authorized for execution.** Claude must **never** execute a DRAFT mission.

### APPROVED
The Product Owner has accepted the specification. **APPROVED DOES NOT MEAN EXECUTE AUTOMATICALLY.** A mission sitting in `APPROVED/` does **not** authorize autonomous work. Execution requires an **explicit Product Owner instruction naming the mission**, e.g.:
> `Execute NEM-005 according to the approved mission.`

Without that instruction: **DO NOT EXECUTE.**

### IN PROGRESS
Entered only after explicit execution authorization. Before modifying anything, Claude performs the **pre-execution check**:
1. read the entire mission;
2. inspect relevant current code;
3. verify assumptions;
4. identify protected systems;
5. identify required migrations;
6. identify required infrastructure changes;
7. verify authorization level;
8. identify contradictions or missing material decisions.

If everything is sufficiently clear → proceed. If not → **STOP and ask the Product Owner.**

### BLOCKED
Entered when safe execution requires a decision outside Claude's authorized engineering judgment (product policy, pricing, ownership, security, privacy, copyright, financial, architecture conflict, production-data risk, an unexpectedly-required protected-system change, or mission/code contradictions). Claude explains **what is blocked, why, the options, and the technical consequences** — then waits.

### REVIEW
When authorized work is complete, Claude **stops**. Product Architecture reviews implementation, architecture, migrations, APIs, tests, documentation, scope adherence, Product Bible alignment, and deviations (see `REVIEW-CHECKLIST.md`). Claude must **not** automatically start another mission.

### COMPLETED
Reached only after review **and** acceptance. A commit alone, passing tests alone, or a deployment alone does **not** complete a mission. See `DEFINITION-OF-DONE.md`.

### Mission queue rule (mandatory)
Multiple missions in `APPROVED/` (NEM-005, NEM-006, …) are **not** a queue to auto-execute in order. **APPROVED ≠ AUTOMATIC EXECUTION.** Every mission requires its own explicit execution instruction.

---

## Authorization levels

| Level | Meaning |
|-------|---------|
| **NONE** | Analysis / design only. No application implementation. |
| **DOCUMENTATION ONLY** | Documentation may change. Application code may not. |
| **LIMITED IMPLEMENTATION** | Only the explicitly listed components may change. |
| **FULL-WITHIN-SCOPE** | Claude may make engineering decisions necessary to accomplish the mission, **only inside the explicitly approved scope.** Not repository-wide permission. |

### Schema authorization
Every mission states one of: `NOT AUTHORIZED` · `ADDITIVE ONLY` · `SPECIFICALLY AUTHORIZED`. **Never modify a previously deployed migration** — write a new one.

### Infrastructure authorization
Every mission states `NOT AUTHORIZED` or `SPECIFICALLY AUTHORIZED`. Claude must **not** infer infrastructure authorization from application-implementation authorization.

### Deployment authorization
Every mission states deployment expectations (`NOT AUTHORIZED` · `AUTHORIZED AFTER TESTS` · `AUTHORIZED WITH CONDITIONS`). **A successful commit is not a successful deployment.**

---

## Source-of-truth hierarchy

1. **Product Owner decision** — final authority.
2. **Approved Product Bible / ADR** — intended product & architecture behavior.
3. **Approved Engineering Mission** — authorized scope for the current work.
4. **Current production code** — truth about the current implementation.
5. **Technical baseline documentation** — reference, subject to verification against code.
6. **Historical planning documents / conversations** — context only when superseded.

If current code conflicts with approved product policy: **STOP, report the conflict, do not silently choose one.**

---

## Ambiguity rule

Claude must **stop and request clarification** if ambiguity materially affects: product behavior · money · pricing · Stripe · subscriptions · book tokens · token expiration · royalties · author/narrator/publisher compensation · permanent book ownership · user rights · privacy · security · copyright · AI permissions · AI provider data handling · AI cost exposure · production data · migrations · infrastructure · Escucha Activa · reader behavior · synchronization · architecture boundaries.

Normal engineering judgment is fine for low-level implementation details that do **not** materially affect those areas. **Do not invent product policy.**

---

## Protected Noetia principles (permanent)

**Reader Stability First.** Escucha Activa and synchronized text/audio are core production assets. New features must not degrade synchronization, playback, reading, progress, offline access, or reader performance.

**Permanent Book Ownership.** A legitimately unlocked premium book stays in the user's library. Cancellation of recurring services must not remove text, synchronized audio, reading/listening progress, highlights, notes, or the permanent entitlement.
> **Books are permanent. Intelligence is the subscription.**

**Personal Libraries Remain Personal.** Duo/Family may share token pools but do **not** automatically share libraries, highlights, notes, AI conversations, reading history, or intellectual profiles. A book redeemed by one user belongs to that user unless an approved future policy explicitly changes it.

**Production Data Preservation.** Protect users, books, audio, sync maps, subscriptions, tokens, `user_books`, fragments, notes, clubs, analytics, personas, and Stripe records.

**Additive Database Evolution.** Never edit a previously deployed migration. Use new TypeORM migrations; prefer additive changes.

**No Silent Business-Rule Changes.** Engineering must not independently modify pricing, subscription structure, token economics, token expiration, royalty splits, the Causas Noetia percentage, ownership, Noetia+ entitlement rules, or publisher rights.

---

## Repository hygiene

Every mission preserves: focused commits · no unrelated files · no accidental local configuration · no secrets · no production credentials · no customer PII in documentation · no unrelated refactoring.

**`settings.local.json` must not be staged/committed unless a mission specifically authorizes it.**

---

## Current production-deployment warning

`main` currently participates **directly** in production deployment, so even a documentation commit may trigger the usual rebuild/redeploy. Until a staging / release-gating strategy exists (designed in NEM-002):
- minimize unnecessary pushes;
- group documentation changes;
- distinguish **commit success** from **deployment success**;
- treat production-impacting changes carefully.

CI/CD must not be modified except by a mission that specifically authorizes it.

---

## Completion report standard

Every implementation mission report contains: **Mission** (id + title) · **Status** · **Changed Files** (paths + purpose) · **Database** (migrations/backfills) · **Tests** (added/changed + results) · **Verification** (build/lint/type/runtime) · **Deployment** (whether + result) · **Deviations** · **Risks** · **Discoveries** (out-of-scope findings) · **Protected Systems Confirmation** (explicitly state what was NOT modified) · **Commit** (SHA) · **Recommended Next Step** (recommendation only — do not auto-execute).

---

## <a name="historical-missions"></a>Historical missions (legacy / pre-governance)

These predate this framework. They are **valid historical records** and are **not** rewritten to conform to the template, nor moved.

| Mission | Type | Location | Status |
|---------|------|----------|--------|
| NEM-001 | Repository Archaeology & Technical Baseline | `docs/technical-baseline/` | Completed (legacy) |
| NEM-002 | Production Safety & Business-Critical Verification | `docs/production-safety/` | Completed (legacy) |
| NEM-002A | Business-Critical Safety Remediation | committed (`admin/tokens` fix + webhook idempotency) | Completed (legacy) |
| NEM-003 | Noetia+ Product & Technical Integration Design | `docs/noetia-plus/` | Completed (legacy); awaits Product Architecture review + product decisions |
| NEM-004 | Engineering Governance Foundation | `docs/engineering-missions/` (this dir) | Completed (transition mission) |

NEM-003 is **not** to be rewritten, moved, reinterpreted, or implemented under this mission.

---

## For Claude Code
See the root `CLAUDE.md` § *Engineering Mission Governance*. In short: **never execute a mission because it exists or is approved** — execution needs an explicit Product Owner instruction naming it; validate assumptions against the repository first; STOP and ask on any conflict with product policy, security, financial rules, ownership, or protected systems; and STOP for review after authorized work.
