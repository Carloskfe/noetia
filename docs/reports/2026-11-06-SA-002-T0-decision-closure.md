# SA-002-T0: Product Decision Closure and NEM-019 Readiness

**Status labels used here**

| Label | Meaning |
|---|---|
| **[CODE]** | Current behaviour, verified on `origin/main` at `6a5e5c0` |
| **[POLICY]** | Accepted and merged on `main` |
| **[UNMERGED]** | Recorded as decided, but only on a branch or PR |
| **[RULING]** | Preliminary T0 ruling, drafted here and not yet an accepted record |
| **[PROPOSED]** | Architecture proposal |
| **[OPEN]** | Unresolved decision |

## Revision 2 — Product Owner approvals (2026-11-08)

> **Status: REVIEW — documentation only; nothing merged or executed.** The Product Owner approved TT-02, TT-04, TT-05, and TT-21 on 2026-11-08. This revision records them, reconciles the three-tier package, ADR-005/006, and NEM-019, and assesses readiness. Revision 1 (2026-11-06, below) is preserved unchanged as the historical T0 record.
>
> **NEM-019 verdict: READY FOR PRODUCT ARCHITECTURE REVIEW, NOT READY FOR APPROVAL.** No open Product Owner *product* decision blocks it. Before approval it still needs ADR-005/006 acceptance, mission-text and identifier approval, and a ruling on draft PO-025 (§R2.10).

### R2.1 Mission and objective

| | |
|---|---|
| Assignment | *Product Architecture Decision Reconciliation — Three-Tier Architecture Governance and NEM-019 Preparation* |
| Identifier | `SA-002-T0`, Revision 2 (chosen by the PO on 2026-11-08: revise the existing T0 report; no new identifier) |
| Authorization | **DOCUMENTATION ONLY.** PO decisions approved; engineering implementation **not** authorized |
| Objective | Record TT-02, TT-04, TT-05, TT-21; prepare ADR-005/006; update the open-decision register; reconcile NEM-019; record the NEM-006 supersession; report readiness |

### R2.2 Date and status

2026-11-08. **Review.** Delivery: **not merged**. Draft PR stacked on PR #35 (`docs/t0-decision-closure` `b05a213`), which is stacked on PR #34.

### R2.3 Repository baseline

| Item | Value |
|---|---|
| `main` | `6a5e5c0` |
| Base of this branch | `docs/t0-decision-closure` `b05a213` (PR #35) ← `docs/three-tier-architecture-reconciliation` `223fabd` (PR #34) |
| This branch | `docs/sa-002-t0-rev2-po-approvals` |
| Also examined | `CLAUDE.md`; `docs/engineering-missions/README.md`; `docs/PRD.md`; `docs/noetia-plus/` (NEM-003, `PRODUCT-DECISIONS.md`); `docs/architecture/adr/`; NEM-006 on `nem-009-resilience-impl` (identical on `nem-007-creator-rights`, `nof-001-operating-framework`, `nof-003-resilience`); `15-decision-registry.md` (NOF-001, same branches); PRs #12, #17, #18 (PO-021…024, amendments); PR #36 (SA-003 conflicts C1–C14, ADR-007 draft); PR #39 (GOV-001 protocol and index) |

### R2.4 Scope and exclusions

**In scope:** the six deliverables of the assignment. **Excluded:** application and mobile code, migrations, Stripe, production and staging, Docker, CI/CD, secrets, merging, executing NEM-019 or any mission. Files owned by PRs #34/#35 are changed **only in this stacked PR**; #34 and #35 themselves are not modified.

### R2.5 Executive summary

- **Four decisions recorded as `DECIDED`:** TT-02 → PO-026, TT-04 → PO-027, TT-05 → PO-028, TT-21 → PO-030 (new; identifier verified unused). Each record preserves its 2026-11-06 preliminary text.
- **TT-05 changes the T0 reading:** Ask My Highlights may now **answer** questions over the user's own highlights library-wide (T0 allowed search only). The PO confirmed the rule text governs despite the "Option A" label. TT-24 is resolved; a new question, **TT-27** (book permissions for saved quotations in highlight answers), is opened.
- **TT-01 and TT-12 stay open**; their T0 preliminary rulings are not adopted. PO-025 and PO-029 remain drafts.
- **ADR-005 and ADR-006 revised (revision 2), still Proposed.** ADR-006 now covers the Research Brief, as TT-21 rule 4 requires.
- **NEM-006 formally superseded**, its record preserved ([08](../architecture/three-tier-intelligence/08-architecture-governance-record.md)); NEM-003 recorded as historical.
- **NEM-019 revision 3, still DRAFT.** Ready for Product Architecture review.

### R2.6 Work completed

1. Preliminary review of the sources in R2.3, and an identifier scan on every remote branch: PO-025…029, ADR-005/006 used only by the #34/#35 drafts (and references in #36, #39); **ADR-007 taken** by SA-003 Annex B; **PO-030 unused**; NEM-019 used only for this mission.
2. Two PO clarifications obtained (TT-05 label; report identifier).
3. Records, ADRs, register, three-tier documents, and NEM-019 updated (R2.12).

### R2.7 Verified findings and evidence

**Mapping of approved decisions to authoritative records**

| Decision | Authoritative record | Register entry | Architecture | Mission |
|---|---|---|---|---|
| **TT-02** Premium prerequisite | [PO-026](../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md) `DECIDED` | `docs/noetia-plus/PRODUCT-DECISIONS.md` | ADR-005 rev 2 | NEM-019 §7, AC-9 |
| **TT-04** Session limits | [PO-027](../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md) `DECIDED` | same | ADR-006 rev 2; three-tier `03` | NEM-019 §7, AC-3, AC-11a |
| **TT-05** My Knowledge / Ask My Highlights | [PO-028](../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md) `DECIDED` | same | ADR-006 rev 2 (highlight path); ADR-005 rev 2 (capability budgets); three-tier `01`, `03` | NEM-019 §6, §7, AC-15a |
| **TT-21** Governance | [PO-030](../operating-framework/decisions/product-owner/PO-030-three-tier-architecture-governance.md) `DECIDED` | same | ADR README; [08](../architecture/three-tier-intelligence/08-architecture-governance-record.md) | NEM-019 status (not approved) |

**Authoritative register.** `docs/noetia-plus/PRODUCT-DECISIONS.md` is the only decision register on `main` and states it is canonical until a Product Bible exists; the approvals are entered there. The full records live in `docs/operating-framework/decisions/product-owner/`, which is not on `main` (it arrives with PR #35 and the operating-framework branches). NOF-001's `15-decision-registry.md` exists only on branches without a PR and is not updated here (R2.16).

**ADR status.** ADR-005 and ADR-006: **Proposed (revision 2)**, ready for Product Architecture review. Not accepted.

**NEM-006 status.** **Superseded** (PO-030). The mission file is not on `main` and was not edited; NEM-006A/B/C are separate and **not** superseded.

### R2.8 External references

None.

### R2.9 Risks

| Rating | Risk | Mitigation |
|---|---|---|
| High | Ask My Highlights sends saved quotations to a model across any number of books; `fragments.text` is client-supplied | Highlight Context Builder invariant (ADR-006); TT-27 before the phase is built; TT-22 disclosure |
| High | Merging the three-tier stack without the SA-003 conflicts (C1–C14) resolved leaves contradictory household and roadmap text | R2.15 sequence |
| Medium | PO records link into a directory that is not on `main` | Merge #35 (which creates it) before or with this PR |
| Medium | Two decision registers (`PRODUCT-DECISIONS.md`, NOF-001 registry) | PO decision R2.16 item 7 |
| Low | Merging documentation deploys production (`cd.yml`) | Grouped, separately approved merge with the GOV-001 §5.4 checks |

### R2.10 Decisions

**(a) Under existing authority:** stacked on #35 rather than editing #34/#35; TT-21 recorded as PO-030; preliminary texts preserved in each record; ADR-006 extended to Research Briefs from three-tier `03 §6` (no new design); NEM-019 Ask My Highlights kept **out of scope** (later phase), with only the budget-policy shape made capability-keyed; the Ask My Highlights row in `01` set to "Undecided" for all tiers (it previously marked Noetia+ and NoetiaX ✓ while tier placement was open).

**(b) Requiring Product Owner approval:** see R2.16.

### R2.11 Recommendations

**Required before NEM-019 approval:** Product Architecture acceptance of ADR-005/006 rev 2; PO approval of NEM-019 rev 3 and its identifier; PO ruling on whether draft PO-025 must be accepted first.

**Recommended (not blocking NEM-019):** accept the PO-022/PO-023 Amendment 1 texts so PR #12's records stop contradicting PO-026; decide TT-27 before the Ask My Highlights phase; resolve SA-003 C1–C14 before the stack merges.

### R2.12 Changes made

| File | Change |
|---|---|
| `docs/operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md` | `DECIDED` (TT-02); open items; relationships; preliminary text preserved |
| `…/PO-027-research-session-book-limits.md` | `DECIDED` (TT-04); preliminary text preserved |
| `…/PO-028-my-knowledge-and-highlight-boundary.md` | `DECIDED` (TT-05); label note; change table; TT-27; preliminary text preserved |
| `…/PO-030-three-tier-architecture-governance.md` | **New**, `DECIDED` (TT-21) |
| `docs/noetia-plus/PRODUCT-DECISIONS.md` | Register section for PO-026, 027, 028, 030 and the remaining open items |
| `docs/architecture/adr/ADR-005-…md` | Revision 2 (PO-026, PO-028 rule 4); still Proposed |
| `docs/architecture/adr/ADR-006-…md` | Revision 2 (PO-027, PO-028 highlight path, Research Brief); still Proposed |
| `docs/architecture/adr/README.md` | Index status for ADR-005/006 |
| `docs/architecture/three-tier-intelligence/05-open-decisions.md` | Approved versus open: TT-02/04/05/21 decided; TT-01/12 open; TT-15 partly decided; TT-24 resolved; TT-27 added |
| `docs/architecture/three-tier-intelligence/01-capability-matrix.md`, `02-reconciliation-report.md`, `03-research-architecture.md`, `06-implementation-roadmap.md` (T0 status row only), `README.md` | Rows and paragraphs contradicted by the approvals updated; superseded text preserved where it stated a ruling |
| `docs/architecture/three-tier-intelligence/08-architecture-governance-record.md` | **New**: NEM-003 historical status; NEM-006 supersession |
| `docs/engineering-missions/DRAFT/NEM-019-tier-aware-intelligence-control-plane.md` | Revision 3; still DRAFT |
| `docs/operating-framework/analysis/t0-po-021-024-amendment-drafts.md` | Dated update notes on the T0 register and registry proposals (superseded lines preserved) |
| `docs/reports/2026-11-06-SA-002-T0-decision-closure.md` | This revision |
| Code, database, migrations, Stripe, infrastructure, CI/CD, deployment, production data | **None** |

### R2.13 Tests and validation

Documentation only; no code tests. Checked: every relative link added by this revision resolves within this branch; identifier scan (R2.6); diff against the base contains only documentation files.

### R2.14 Deviations and discoveries

- **Deviation:** report published as a revision of `SA-002-T0`, per the PO's choice, rather than a new report.
- **Discovery:** the NEM-006 file sits in `COMPLETED/` although its status is PAUSED (now superseded).
- **Discovery:** the TT-05 "Option A" label does not match the repository's option table (resolved by PO confirmation).
- **Discovery:** the roadmap (`06`) does not yet place Ask My Highlights in a phase.

### R2.15 Protected-systems confirmation and integration sequence

Not modified: reader and Escucha Activa; ownership and `user_books`; `fragments`; tokens; Stripe and billing code; business-rule engines; production and staging; infrastructure; CI/CD; NEM-003 documents; ADR-001…004; PO-001…004 text; PRs #34, #35 and every other PR.

**Proposed safe integration sequence** (each merge needs Product Architecture review, PO acceptance, a PO merge instruction naming the PR, and the GOV-001 §5.4 deployment checks):

1. Product Architecture review of this PR; PO acceptance.
2. Fold into PR #35 (merge this branch into `docs/t0-decision-closure`), so #34 → #35 remain one reviewable stack. Alternatively keep it stacked; GitHub retargets it when #35 merges.
3. Resolve SA-003 conflicts C1–C14 against the stack (they concern NEM-019, ADR-005, PO-026, `04`, `05`, `06`) once the PO decides TT-15 and the ADR-007 household model.
4. GOV-001 (#39) first, so `docs/reports/README.md` exists on `main`; then #34 + #35 (+ this) as **one grouped documentation merge**.
5. PR #12 afterwards: it also edits `PRODUCT-DECISIONS.md` and adds PO-021…023 to the same directory; merge `main` into it and keep both register sections.
6. When the operating-framework branches gain a PR: add PO-021…030 rows to `15-decision-registry.md` and the NEM-006 superseded banner.

### R2.16 Open questions and decisions requiring the Product Owner

| # | Item | Phase it blocks |
|---|---|---|
| 1 | Whether draft PO-025 must be accepted before NEM-019 approval | NEM-019 approval |
| 2 | TT-15: linked-member eligibility and qualifying states. **Contradiction:** SA-003 Rev 5's working baseline (household members eligible; 72-hour grace; ADR-007 draft) versus PO-026, which names subscription types only and forbids inventing states or grace | Adapter mission; T8 billing |
| 3 | TT-27: book AI permissions for saved quotations in Ask My Highlights | Ask My Highlights phase |
| 4 | PO-022 / PO-023 Amendment 1 texts (PR #12 independence wording contradicts PO-026) | Records consistency; T8 |
| 5 | Three-tier `06` roadmap versus Q4 coordinated launch and SA-003 Rev 5 (C10, C13, C14) | T8, T9 |
| 6 | Placement of Ask My Highlights in the roadmap; tier placement (TT-25) | T5–T7 |
| 7 | Long-term canonical register: `PRODUCT-DECISIONS.md` or NOF-001 `15-decision-registry.md` | Governance |
| 8 | Location of the NEM-006 file (`COMPLETED/`) after supersession | Governance |

**Remaining blockers by phase** (unchanged items from `05` included):

| Phase | Blockers |
|---|---|
| T1 NEM-019 (dark control plane) | ADR-005/006 acceptance; NEM-019 approval and identifier; item 1. **Not** TT-01 or TT-12 |
| T2 Evaluation | TT-12 launch corpus; TT-26 evidence standard; TT-07 NoetiaX depth criteria |
| T3 Semantic foundation | NEM-006B (production pgvector restore proof); infrastructure authorization |
| T4 Real Gateway | TT-22 provider data handling and disclosures; provider credentials (PO-005) |
| T5 Noetia+ closed beta | TT-13 thresholds; TT-14 retention; TT-22; TT-23 pilot; TT-25/27 if Ask My Highlights is included |
| T6 Brief MVP | TT-17 export format; TT-08 agreements depth |
| T7 NoetiaX closed beta | TT-07 depth and evaluation criteria |
| T8 Billing | TT-16 prices and Stripe architecture; TT-15; TT-09/10/11 budget values and resets; TT-01 token expiry; Q4 gate |
| T9 Release and mobile | TT-20 mobile; legal disclosures (TT-22); Q4 coordinated launch |

### R2.17 Next recommended action

Product Architecture reviews this PR (ADR-005/006 rev 2 and NEM-019 rev 3 first); the PO rules on R2.16 items 1–2. **NEM-019 is not approved or executed by this revision.** *Recommendation only.*

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-06 | T0 decision closure (below), preserved unchanged |
| 2 | 2026-11-08 | Product Owner approvals of TT-02, TT-04, TT-05, TT-21 recorded and reconciled (this section) |

---

# Revision 1 — T0 decision closure (2026-11-06, historical)

## 1. Mission and objective

Reconcile six preliminary Product Owner rulings (TT-01, 02, 04, 05, 12, 21) with the repository and governance, prepare records and amendments, and determine whether NEM-019 can go to Product Architecture. `SA-002-T0` extends the provisional ID `SA-002`. Authorization: documentation only.

## 2. Date and status

2026-11-06. **Complete; awaiting Product Owner and Product Architecture review.** Nothing is accepted, merged, or deployed.

## 3. Scope and exclusions

**In scope:** decision reconciliation, draft PO records and amendments, draft ADR-005 and ADR-006, targeted updates to the three-tier documents, revised NEM-019.

**Excluded:** application code, tests, infrastructure, schema, billing, Terms and other legal pages, catalogue, customer data, deployment, and execution of NEM-019.

**Reviewed:** `CLAUDE.md`; `docs/PRD.md`; `docs/noetia-plus/`; the three-tier package; NEM-019; PO-005…024 (branches `nem-009-resilience-impl`, PR #12, #17); PR #18 amendment drafts; ADR-001…004; governance README and template; reporting protocol (PR #23); SA-001 report (PR #24); Creator & Rights Framework; subscription, token, gift, library, fragment, rights, and ingestion code on `main` and Release A (PR #14).

## 4. Executive summary

### Verdict: **READY WITH EXPLICIT FOLLOW-UPS**

NEM-019 can be submitted for Product Architecture approval. **No remaining Product Owner product decision blocks it.** Each open question is held safe by a default-deny port, an out-of-scope exclusion, or a test fixture (NEM-019 §16). It is not plain "READY" because the six rulings are not yet accepted records, and §3 of the mission makes acceptance a precondition.

### Follow-ups required before NEM-019 approval

| # | Follow-up | Owner |
|---|---|---|
| FU-1 | Accept or edit PO-025…029, PO-022 and PO-023 Amendment 1, and PO-024 Confirmation 1 | Product Owner |
| FU-2 | Accept or edit ADR-005 and ADR-006 | Product Architecture |
| FU-3 | Confirm that `NEM-019` is the assigned number and approve the mission text | Product Owner |

### What the review found

1. **TT-01:** nothing in production implements PO-024's six-month rule. Code, Terms, and pricing copy all say 90 days. Customers are today promised 90 days, consistent with the code, so the gap is unbuilt policy. PO-024 also has **no effective date**.
2. **TT-02:** PO-022 and PO-023 still state independence, and PR #18's drafts cover only Noetia+ and use "basic". Replacement drafts are ready. **New hazard:** existing cancellation would cancel the book plan.
3. **TT-04:** enforceable as ruled. One design consequence needs review: a fork must **not** carry generated history from books it excludes.
4. **TT-05:** the ruling permits *search*, not generation. My earlier suggestion to allow Ask My Highlights generation outside the limit is not adopted. **New finding:** `fragments.text` is client-supplied and editable, so a saved quotation is an assertion rather than evidence.
5. **TT-12:** today **no book is eligible**. That is the correct result under default deny, not a defect.
6. **TT-21:** identifiers PO-025…029, ADR-005, ADR-006, and NEM-019 are unused on every remote ref. NEM-006 was not addressed and **stays PAUSED**.

**Self-corrections from the earlier package:** `isFree` was wrongly called a pricing flag; it governs catalogue readiness and the sync gate. The recommendation to cancel NEM-006 is withdrawn pending a PO decision. NEM-019 now uses simulated plan and ownership ports, removes a dedicated database pool, and unloads the module entirely when off.

## 5. Verified findings: decision by decision

### TT-01 — Token expiration

**1. Ruling.** Preserve PO-024's differentiated rules. No universal 90-day rule.

**2. Sources.** PO-024 and its impact assessment [UNMERGED, PR #17]. Terms [CODE]. PRD [POLICY, stale].

**3. Current behaviour and differences.**

| Token | PO-024 [UNMERGED] | Code [CODE] | Terms [CODE] | Web copy [CODE] | PRD |
|---|---|---|---|---|---|
| Subscription | 90 days from own issuance; not giftable | 90 days (`subscriptions.service.ts:27,71`) | 90 days (`terms-of-service.ts:31,128`) | "90 days to use it" (`en.ts:352`) | 90 days |
| 1-token purchase | **Exactly 90 days**; giftable | 90 days | 90 days | "expire 90 days after purchase" (`en.ts:371`, `es.ts:373`) | 90 days |
| 3/5/10 package | **Six calendar months**; giftable | **90 days** (`:276-285`) | **90 days** | **90 days** | **90 days** (`PRD.md:203`) |
| Gifted (peer) | 90 days from gift date; no re-gift | Not implemented | Silent | — | — |
| Gift card | Open (Q-2) | 90 days from claim (`gifts.service.ts:14,136`) | Silent | "Valid for 90 days from today" (`en.ts:810`) | — |
| Promotional, courtesy | Not addressed (Q-13) | 30 days (`:28-29`) | — | — | 30 days |

**Exceptions:** rule 8 is an explicit decision. Rule 11 gives gifted tokens 90 days regardless of origin. **Existing rights:** no rule changes tokens already issued; Q-14 is open. **Effective date:** none stated; record date 2026-10-30.

The ledger has no `source` field (`token-ledger.entity.ts`), so package origin is available only in free-text `reason`. A one-line constant cannot implement PO-024.

**4. Conflicts.** The 11-06 invariant (resolved by this ruling). PRD 203. Terms. Web copy `en.ts:371`, `es.ts:373`. Unit test `subscriptions.service.spec.ts:623` encodes 90 days. `docs/business/es` plan documents. PR #34 (now corrected). Draft PR #22 corrects annual prices only, and its Terms still say 90 days. NOF-004 row 14 records the 90-day Terms.

**5. Amendments.** [PO-024 Confirmation 1](../operating-framework/analysis/t0-po-021-024-amendment-drafts.md); correction to its impact assessment §6; PO-025 invariant 2.

**Remediation, documented only:** PR #17's M-2 (provenance), M-3 (source-aware expiry and order), M-5 (copy and legal), under the existing benchmark-and-approval process, in that order. Terms must not promise six months before code delivers it.

**6. Dependencies.** M-1…M-5; NOF-004 Terms work (#21, #22).

**7. Remaining questions.** Effective date; Q-14 (the NOF-004 audit counted 0 purchases on 2026-11-01; re-check read-only before relying on it); Q-4 (FIFO can spend a six-month token before a 90-day token); Q-12; Q-2, Q-3; whether rules 2–7 cover Duo and Family, as rule 1 names only Individual.

**8. Blocks.** **Not NEM-019** (tokens are out of scope). Blocks token copy, Terms, and M-3.

### TT-02 — Premium prerequisite

**1. Ruling.** Both tiers require an active qualifying book subscription. No standalone tier. Premium cancellation never cancels the book plan. Book plan ending ends premium under a future lifecycle policy. Ownership and token rights preserved. Household and states stay open.

**2. Sources.** PO-022, PO-023 [UNMERGED, PR #12]. 10-30 direction and drafts [UNMERGED, PR #18]. NEM-003 `08` [POLICY-adjacent, historical].

**3. Current behaviour.** No premium product exists. <a name="billing-hazards"></a>

### Billing hazards

| Hazard | `main` [CODE] | Release A (PR #14) | Blocks |
|---|---|---|---|
| **Accidental token issuance:** every paid invoice issues `tokensPerCycle`, default 1 | `webhooks.service.ts:141`; `plan.entity.ts:23-24` | Unchanged (`:187`) | T8 |
| **Catalogue unlocking:** any active row unlocks paid books | `subscription.guard.ts:41` | Unchanged; adds payload only. NEM-013 draft | T8 |
| **Subscription replacement:** upsert on `userId` | `subscriptions.service.ts:531` | Unchanged (`:549`) | T8 |
| **Cancellation cascade (new):** cancel applies to the only Stripe subscription | `subscriptions.service.ts:482-490` | Unchanged (`:504`) | T8 |
| **Unconditional trial (new):** 14 days on every checkout | `subscriptions.service.ts:216` | — | T8 |
| **Public listing:** all plan rows returned and rendered | `plans.service.ts`; `pricing/page.tsx:55` | Unchanged | T8 |
| **First item only:** other lines ignored | `webhooks.service.ts:130,176` | Unchanged (`:176,222`) | T8 |
| **Prerequisite absent:** checkout has no eligibility check | `subscriptions.service.ts:207-209` | — | T8 |
| Ownership bypass: any published book can be added | `library.service.ts:19` | **Fixed** (`:23`) | T5 |

**None affects NEM-019,** which touches none of these paths and has a test proving no such import exists.

**4. Conflicts.** PO-022 ("separate, independently purchasable"; "does not require"). PO-023 rules 6–8. PR #12 impact assessment (C-08, §4 reasoning). PR #17 impact assessment §6 ("Noetia+-only customer"). PR #18 wording. NEM-003 `08` quadrant table and resolution, which remain historical.

**5. Amendments.** [PO-026](../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md); [PO-022 and PO-023 Amendment 1](../operating-framework/analysis/t0-po-021-024-amendment-drafts.md); ADR-005.

**6. Dependencies.** M-C, M-D, NEM-013 (T8). None for NEM-019.

**7. Remaining questions.** TT-15 (which plans qualify, linked members, states). TT-16 (structure, end timing, refunds). TT-23 (pilot participants).

**8. Blocks.** Not NEM-019: `QualifyingPlanPort` answers `unknown`, which denies. Blocks T8. TT-23 blocks T5.

### TT-04 — Session limits

**1. Ruling.** 3 and 10 selected books; lock at the first analysis turn; change by new or forked session.

**2. Sources.** [PO-027](../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md), [ADR-006](../architecture/adr/ADR-006-research-sessions-book-limits-and-source-scope.md) [RULING, PROPOSED]. Three-tier `03` [PROPOSED].

**3. Current behaviour.** None; no sessions exist [CODE].

**4. Conflicts.** NEM-003 `09` (jsonb `sourceRefs`) cannot enforce a limit; remains historical.

**5. Proposed design [PROPOSED].**

| Topic | Proposal |
|---|---|
| Enforcement | Normalized table; unique constraints; `CHECK` position 1–10; limit from resolver |
| Transaction safety | Short transaction with a row lock; no provider call under lock; each turn reads set and hash after lock |
| Lock point | First **accepted** analysis turn. Preflight rejection does not lock; provider failure afterwards does |
| Concurrency tests | Parallel adds at the limit; add racing first turn; parallel first turns; parallel forks; downgrade during a turn |
| Downgrade | At or under the new limit: active, higher-tier capabilities off. Over: `read_only`, offer fork |
| History | Immutable; never deleted by downgrade; book deletion is not blocked |
| Fork | Carries generated context **only if** parent's books ⊆ fork's books |

**6. Dependencies.** None beyond acceptance.

**7. Remaining questions.** Retention after cancellation (TT-14). Session counts (TT-06). Fork context rule and lock point need Product Architecture confirmation.

**8. Blocks.** Nothing.

### TT-05 — My Knowledge and highlights

**1. Ruling.** Generated analysis limited to selected books. Separate search over own highlights permitted outside the limit, with no retrieval of unselected full text and no bypass of publisher permissions.

**2. Sources.** ADR-003, ADR-002 [POLICY]. [PO-028](../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md) [RULING]. SA-001 C1 quotation-integrity policy [UNMERGED].

**3. Current behaviour [CODE].** Fragments are listed only per user and book (`books.controller.ts:212-215`). No highlight search exists, and fragments are not in the search index. `POST /fragments` takes any text for any `bookId`, and `PATCH` can rewrite it (`create-fragment.dto.ts`; `fragments.service.ts:23-31,51-56`). `startPhraseIndex` and `endPhraseIndex` are never populated (SA-001 §5.4). NEM-016 (PR #25) verifies text only at share time.

**4. Conflicts.** ADR-003's My Knowledge wording is wider than a session; reconciled as session scope without changing the mode. NEM-003's Ask My Highlights generates across books and is not permitted outside a session by this reading. NEM-003 `13` treats highlights as trusted raw material.

**Exact trust boundary:** see the table in PO-028. In short: a **note** belongs to the user; a **saved quotation** is an unverified claim about publisher text, so it inherits the book's restrictions but not its authority; **publisher text** is reachable only through a selected book and rights checks; and a user's words are labelled `user_content`, a proposed extension to ADR-003's origin labels.

**5. Amendments.** PO-028; ADR-006; three-tier `03`.

**6. Dependencies.** TT-22 before notes reach a provider. NEM-016 for verified quotation (later).

**7. Remaining questions.** TT-24, TT-25.

**8. Blocks.** Not NEM-019. Search is a later phase, while the invariant is tested with fixtures.

### TT-12 — Eligible corpus

**1. Ruling.** Verified public domain for evaluation and pilot; explicit opt-in next; verification of work, edition, translation, and rights; `isFree` insufficient; default deny.

**2. Sources.** ADR-002 [POLICY]. Creator & Rights Framework, IG-04, PO-016 [UNMERGED]. [PO-029](../operating-framework/decisions/product-owner/PO-029-eligible-research-corpus.md) [RULING]. [Requirements](../architecture/three-tier-intelligence/07-rights-verification-requirements.md) [PROPOSED].

**3. Current behaviour [CODE].** No rights fields on `books`. Ingestion sets `isFree: true` (`ingestion.service.ts:68`). `pendingRights` is not persisted. The catalogue has 86 entries, some of them translations chosen for sync fit (`catalogue.ts:353-367`).

**4. Conflicts.** NEM-003 `05` uses `isFree` as a trigger (historical). No conflict with existing policy: the ruling matches the permanent NEM-007 Phase A principle.

**5. Amendments.** PO-029; `07`; NEM-019 AC-11, AC-12.

**6. Dependencies.** TT-26; IG-04, NEM-007 Phase B for backfill; opt-in terms; provider review.

**7. Remaining questions.** TT-26 and D6. Legal evidence standard: `LEGAL REVIEW REQUIRED`.

**8. Blocks.** Not NEM-019, which creates an empty table. TT-26 blocks T2 corpus sign-off.

### TT-21 — Governance

**1. Ruling.** Draft new PO records and ADR-005/006, using verified identifiers. NEM-003 unchanged. Amendments prepared, with nothing overwritten or merged.

**2. Sources.** Governance README; ADR README; registry on `nem-009-resilience-impl`; PO-021 Amendment 1 pattern.

**3. State of authority.** PO-001…004 and ADR-001…004 are on `main`. PO-005…024 are on unmerged branches. `docs/operating-framework/` and `docs/reports/README.md` are not on `main`, so some links here resolve only after those branches merge.

**Identifier check:** zero hits for PO-025…030, ADR-005, ADR-006, NEM-019, and NEM-020 on all remote refs and PR titles, outside PR #34's own proposals.

**4. Conflicts.**

| Mission | Status | Relationship |
|---|---|---|
| **NEM-003** | Completed, historical | Unchanged; verified by diff |
| **NEM-006** | **PAUSED**, no commits, scope not repository-resident | Not addressed by the ruling, so it stays as is. NEM-019 **does not resume it**. Its prerequisites (NEM-006B, NEM-006C, credentials, evaluation) apply to T2–T4, not NEM-019 |
| **NEM-019** | DRAFT | New, independent |

**5. Amendments.** All listed in the [amendment drafts](../operating-framework/analysis/t0-po-021-024-amendment-drafts.md), including adoption order. PO-021 needs none.

**6. Dependencies.** PR #12, #17, and #18 remain open. This PR edits none of their files.

**7. Remaining questions.** Eventual disposition of NEM-006. Reconciling with PR #16's registry. **Every push to `main` deploys production, including documentation** (`cd.yml`), so adoption should be one grouped, separately approved merge.

**8. Blocks.** Nothing beyond FU-1…FU-3.

### NEM-019 readiness

| Requirement | Result | Evidence in the revised draft |
|---|---|---|
| Dark and inaccessible | ✓ | §5.6 module unloaded by default; AC-1, AC-2; no merge |
| Simulated providers only | ✓ | §5.5; §6 |
| No real AI cost | ✓ | AC-18 |
| Independent of Stripe and tokens | ✓ | §6; AC-16, AC-17 |
| Default deny for unverified rights | ✓ | §5.3; AC-11, AC-12 |
| Reversible | ✓ | AC-19; §14 |
| Isolated from reader | ✓ | §8; AC-1, AC-16 |
| No staging or production deployment | ✓ | Header; §14 |
| Not expanded | ✓ | No billing, retrieval, providers, Briefs, or highlight search |

**Changes made:** dependencies and rulings; `QualifyingPlanPort` and `OwnershipPort` replace reading live tables, removing the NEM-011 coordination; grants no longer bypass the prerequisite; module unloaded rather than flag-gated routes; test environment corrected because NEM-014 CI is not on `main`; dedicated pool deferred; book-deletion, fork, downgrade, and rights criteria added.

### Facts, interpretations, assumptions

**Interpretations:** "search" in TT-05 excludes generation (TT-24 asks for confirmation). A no-charge pilot is not addressed by TT-02 (TT-23). An unaddressed NEM-006 stays paused.

**Unverified:** prod counts (from the NOF-004 audit, 2026-11-01); PR #14 behaviour beyond the diffed files; Stripe behaviour; legal conclusions on public-domain status.

## 6. External references

None consulted. No request was made to production in this mission.

## 7. Risks

| Level | Risk |
|---|---|
| **Critical** | Premium billing added before the hazards above are fixed |
| **High** | Token package buyers receive 90 days while PO-024 says six months, if PO-024 is announced before remediation |
| **High** | Saved quotations treated as trustworthy book text, leading to false attribution or a route around rights |
| **High** | Public-domain assumptions wrong for a translation or jurisdiction |
| **Medium** | Preliminary rulings treated as decided before acceptance |
| **Medium** | Authority spread across unmerged branches; stacked PR depends on PR #34 |
| **Low** | Forks losing context creates some user friction |

## 8. Recommendations

**Required:** FU-1 to FU-3. Do not change token copy or Terms ahead of M-3. No premium plan before T8 prerequisites.

**Optional:** close TT-24 and TT-23 early, since the answers shape T5. Add a fragments length limit in a separate mission: an observation only, outside this scope.

## 9. Tests and verification performed

No test suite was run, because no code changed. Performed: diff check that only `docs/` files changed; NEM-003 and ADR-001…004 byte-unchanged against `origin/main`; identifier search across all remote refs and PR titles; code citations checked on `origin/main` and Release A; relative-link check, with targets on other branches listed in the PR.

**Limitations:** no production, Stripe, or staging access; no legal review; PR #17 and #12 read as of their current heads.

## 10. Open questions and Product Owner decisions required

**Acceptance:** FU-1 and FU-3. **Before later phases:** TT-15, 16, 23, 24, 25, 26, PO-024's open items, and the remaining entries in [05](../architecture/three-tier-intelligence/05-open-decisions.md).

## 11. Changes made

**No application changes.** Documentation only. New: this report; PO-025…029; amendment drafts; ADR-005, ADR-006; `07-rights-verification-requirements.md`. Edited: NEM-019; three-tier `README`, `01`–`06`; ADR `README` index.

Report index: `docs/reports/README.md` is not on `main`, so it is not edited. Proposed row:

```
| 2026-11-06 | SA-002-T0 | [T0 decision closure and NEM-019 readiness](2026-11-06-SA-002-T0-decision-closure.md) | Report PR: Draft, stacked on [#34](https://github.com/Carloskfe/noetia/pull/34) | Complete; awaiting review |
```

## 12. Next recommended action

**Product Owner and Product Architecture review of this package.** After acceptance, the recommended next mission is **NEM-019**, only on an explicit instruction naming it. Separately, the PO may wish to schedule PR #17's M-1 and M-2. Work stops here.
