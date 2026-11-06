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
