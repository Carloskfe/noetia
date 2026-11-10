# E6 — Turn Orchestration and User Experience: Architecture Discovery Report

**Status:** DRAFT **revision 2** — **documentation-only discovery**. Revised after the PA review of PR #54 (`e73c277`, *"direction supported — revisions required"*); responses in **§11**. PO authorization: *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). **Authorizes no implementation.**
**Branch:** `docs/e6-turn-orchestration-discovery`, from the NEM-023 accepted head `6c4b08e` (ancestry: NEM-023 → E5 docs → NEM-022 → NEM-021 → NEM-019; the P0 packet branch is also an ancestor). **Nothing in this stack is merged into `main`.**
**Delivery state:** Draft documentation PR only · no code, tests, migrations, or infrastructure changed · no production data accessed · no provider used.

## Deliverables

| # | Document |
|---|---|
| 1 | This report |
| 2 | [11 — turn lifecycle and component boundaries](../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md) |
| 3 | [12 — interface and dependency inventory](../architecture/three-tier-intelligence/12-e6-interface-and-dependency-inventory.md) |
| 4 | [13 — security, rights, and failure modes](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md) |
| 5 | [14 — minimal web/mobile UX proposal](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md) |
| 6 | [DRAFT mission — E6 research-turn orchestration](../engineering-missions/DRAFT/E6-turn-orchestration-and-user-experience.md) |
| 7 | [PO decision packet](2026-11-10-E6-product-owner-decision-packet.md) |

---

## 1. Baseline verified (source, tests, migrations, register)

| Item | Verified state |
|---|---|
| NEM-019 | COMPLETED, PO-accepted (register). Code: `src/knowledge/{entitlement,rights,sessions,metering,ai}`. Migrations 069–072. Draft PR #46 |
| NEM-021 | COMPLETED — ACCEPTED. Contract v1 frozen; cost ledger; migrations 073–074. Draft PR #50 |
| **NEM-022** | **COMPLETED — ACCEPTED (PO, 2026-11-10)** at `f6a5cb7` after PA re-review (report §20); open: global branch coverage 77.49% vs 80%; intermittent-test monitoring note. *At revision 2 it was not recorded as accepted (§11 R-1).* Gateway v2, simulator v2, provider contract suite. Draft PR #51 |
| NEM-023 | ACCEPTED WITH OPEN EXCEPTIONS **E-1** (p95 594 ms vs 150 ms) and **E-2** (branch coverage 78.75% vs 80%). Amendment 1: book passages only; chapter/phrase metadata NULL. Migration 075. Draft PR #53 |
| PO-026 / PO-027 / PO-028 / PO-033 | Decided: book-plan prerequisite; 3/10 book limit, locked at the first turn; My Knowledge vs Ask My Highlights; E5 decisions. PO-029 still DRAFT |
| ADR-005 / ADR-006 | Accepted rev 3: deny-first resolver; ledger authority; turn order B-5; Context Builder invariants; trust boundary; Highlight Context Builder for AMH |
| P0 packet (Draft PR #48) | E6 = sessions, conversations, My Knowledge, Ask My Highlights, F-2, F-9. E9 = frontend. Decision inputs TT-08/11/13/14/18/19/27. **DRAFT, not decided** |
| Apps | **No intelligence UI** on web (Next.js 14) or mobile (Expo 51 / React Native 0.74). Web `apiFetch` uses a Bearer token from `localStorage` plus a refresh cookie; mobile uses a Bearer token |
| Turn code today | `POST /knowledge/sessions/:id/turns` takes **only `idempotencyKey`**. `TurnService.run` has **no question**. Context comes from `ContextSourcePort` (bound to `EmptyContextSource`). The response drops citations. `invoke` (not `stream`) is used. A reused key returns `duplicate_turn` 409 |
| Gateway streaming | **Per-attempt release:** text events are emitted only after citation and scope validation **and settlement** (NEM-022 F-1/F-3). There is no token-by-token streaming by design |
| Production API container | `cpus: 1.0`, `memory: 512M` (`docker-compose.server.yml`); global throttler 120 requests/min |
| Mission numbering | NEM-024 unused across the register, all remote branches, and PRs #24–#53 → **available, not reserved** (D-5) |

## 2. Turn lifecycle (summary of 11)

Proposed order (ADR-006 B-5 preserved):
1. entitlement;
2. set + per-book eligibility + **retrieval** (book passages only; own highlights only after a later D-2 A/B step) + Context Builder;
3. Gateway prepare/reserve;
4. lock transaction;
5. provider call;
6. per-attempt settlement;
7. **persist** + respond.

| Implemented (dark, unmerged) | Missing |
|---|---|
| Entitlement, prerequisite port, limits, lock, fork, read-only; user eligibility; Context Builder; Gateway prepare/invoke/stream/release; citation policy; per-attempt cost ledger, reconciliation; E5 retrieval, index permission, anchors | Question input; retrieval wiring; user-content source; context budget allocator; turn persistence and replay; `TurnResult` v2 with citations; history, stream, cancel, and capability-probe routes; abort propagation; stage metrics; any UI |

Production adapters for qualifying plan (E4), text identity and verification authority (E3), and ownership are absent. With them unbound, the real module denies everything. E6 can be built dark on fixture ports (D-7).

## 3. User knowledge (summary of 13 §3)

- E5 retrieves book passages only.
- `fragments` holds user assertions (text is client-supplied and editable). Accepted NEM-019 tests forbid any `knowledge/*` access to `fragments`.
- **Every route needs an explicit exception** (D-2).

**Recommended for the first implementation (revision 2): D-2 C, book passages only.** It requires no change to accepted NEM-019 protections. My Knowledge (D-2 A or B) and Ask My Highlights are added later as separately authorized steps with isolation tests first ([13 §3.5](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation)). When added, highlights enter only as `highlight`/`note` items under the existing Context Builder owner check, and the Gateway keeps them `user_content`, **never book evidence**.

Ask My Highlights (library-wide) is a separate model path with its own invariant and budget, gated on TT-27 (E6b). Highlight search (no AI) is not a knowledge path. The three remain distinct: **My Knowledge** (in session), **Ask My Highlights**, and **highlight search**.

## 4. UX (summary of 14)

**Web MVP:** one research screen with:
- locked book chips with exclusions;
- a persisted conversation;
- origin labels in text;
- numbered citations opening a verified-excerpt dialog with "Open book" (link only);
- stage indicators ("Comprobando… / Buscando pasajes… / Redactando…"), with no fake typing;
- cancel;
- `code` → en/es copy;
- a budget-exhausted hard stop;
- same-key retry (replay).

**Accessibility:** `role="log"`, polite live announcements without partial text, citation buttons, a dialog focus trap, labels not colour-only, reduced motion.

**Mobile, if D-6:** non-streaming (React Native 0.74 has no stream body), bottom-sheet excerpts, same-key retry after backgrounding, no store purchase UI.

**Stage-1 limitation:** citations cannot jump to an exact reader position. The reader is phrase-indexed, and chapter and phrase data are NULL (NEM-023 Amendment 1).

## 5. Performance and cost

### 5.1 E-1 and E-2 carried forward — not waived

| Exception | Implication for E6 | E6 obligation |
|---|---|---|
| **E-1** retrieval p95 594 ms (10 × largest book, synthetic) vs 150 ms | Retrieval sits **inside the preflight**, before reservation, and because streaming is per attempt it is fully part of time-to-answer. On the sized fixture, server-side overhead excluding the provider is dominated by retrieval: p95 ≈ 0.6–0.7 s for 10 books. Three-book Noetia+ sessions touch fewer and smaller objects. That is a likely improvement, **not measured** | Stage histograms; an end-to-end table for 3 and 10 books with the simulator; no ranking change, cap, or cache |
| **E-2** global branches 78.75% vs 80% | E6 adds code; it must not lower the figure | New and changed code ≥ 80% branches; no global decrease; E-2 closure only by separate decision |

### 5.2 End-to-end latency (expected composition; to be measured by E6)

| Stage | Basis | Estimate |
|---|---|---|
| Entitlement + session gate | 2–4 indexed queries | ≈ 5–15 ms |
| Per-book eligibility | `TextIdentityPort` + rights row + attestation per book | **Depends on E3** (see R-2); with fixture ports ≈ 2–5 ms per book |
| Index-permission re-check (E5) | The same per book | As above (a second identity lookup per book) |
| Retrieval (E5) | Measured: SQL ranking 2–650 ms by term frequency; S2 per result book 7 ms GET + 8.5 ms hash/decode | p50 ≈ 190 ms, p95 ≈ 590 ms (10 books) |
| Highlights (only in a later D-2 A/B step; not in the first implementation) | One capped indexed query (`fragments` by user/book) | ≈ 5–20 ms (not measured) |
| Prepare + reservation | Token count + ledger transaction with advisory locks | ≈ 10–40 ms (NEM-021/022 integration ranges) |
| Lock transaction | One `FOR UPDATE` | ≈ 5 ms |
| Provider | Simulator: milliseconds. Real providers are **not measured**; there is no paid AI | — |
| Settlement + persist | Ledger rows + one insert | ≈ 10–20 ms |

**There is no end-to-end latency guarantee today.** The 2 s limit is per SQL statement (NEM-023 §17.1).

### 5.3 Token budgets

Per turn:
- passages ≤ 6,000 tokens (E5 default);
- user content proposed ≤ 1,500 tokens;
- template + question;
- `maxOutputTokens` 1,024 (`turnMaxOutputTokens` default).

NEM-021 reserves the **worst case** before the call, so the allocator must cap context **before** `prepare`. The conservative estimate (`ceil(bytes/3)`) over-counts relative to the simulator, so reservations stay bounded. No budget values exist (TT-09). The fixture policies are test-only.

### 5.4 Concurrency, memory, CPU — measured (revision 2, R-5)

**Method** (2026-11-10; scripts in the agent scratchpad, not committed; synthetic data; disposable local containers removed afterwards):

1. **Production API idle footprint:** the API production image (`--target production`, `node:20-alpine`, Node 20.20.2) was built locally and booted against disposable PostgreSQL and Redis under `--cpus=1 --memory=512m`. RSS was **102 MiB** (knowledge flag off) and **73 MiB** (flag on), cold with no traffic. *For comparison, the dev container (ts-node) shows 362 MiB.*
2. **E5 S2 per-turn work:** modelled in plain Node under the same cap. All result books' bytes are held in parallel (as `LexicalRetrievalService` does), then SHA-256, strict UTF-8 decode, and one code-point slicing pass, over ~2M-code-point texts. Measured turn latency, peak RSS, and **event-loop lag** (the delay imposed on every other request in the process, including the reader API).

| In-flight turns | 10-book: turn median / max | lag p99 | peak RSS | 3-book: turn median | lag p99 | peak RSS |
|---|---|---|---|---|---|---|
| 1 | 230 / 258 ms | **85 ms** | 96 MB | 72 ms | 56 ms | 77 MB |
| 2 | 416 / 439 ms | **169 ms** | 128 MB | 117 ms | 65 ms | 110 MB |
| 3 | 606 / 661 ms | 280 ms | 167 MB | 168 ms | 96 ms | 125 MB |
| 4 | 791 / 844 ms | 353 ms | 206 MB | 241 ms | 128 ms | 102 MB |
| 6 | 1,205 / 1,352 ms | 578 ms | 284 MB | 367 ms | 205 ms | 120 MB |

**Findings:**
- **Memory is not the binding constraint.** About +38–40 MB per concurrent 10-book turn, against ~400 MB of headroom over the idle API. *Revision 1's estimate of ≈ 60 MB per turn overstated it.*
- **CPU on the single event loop is the binding constraint.** One 10-book retrieval already delays other requests by about 85 ms (p99). Two simultaneous ones delay them by about 170 ms.
- **Revision 1's "2 concurrent retrievals" was not safe** for reader latency (product hierarchy #1).
- **Correction:** a **weighted** guard, Σ selected books in flight ≤ **W = 10** (one 10-book turn, or three 3-book turns at lag p99 ≈ 96 ms), rejecting before reservation (mission §9.5, D-11).
- Not measured here: real MinIO latency, PostgreSQL ranking (separate container, its own 1 vCPU), production traffic. The reader-latency delta at W must be measured on the production image in Checkpoint D against a PA threshold (D-11).
- Remedies that would reduce the per-book synchronous block (NEM-023 code), worker threads, or a separate API container are **out of scope** (protected code or infrastructure) and recorded for later approval only.

### 5.5 Cost

- No paid provider: simulator only (TT-22 blocks real data reaching providers).
- No embeddings, pgvector, caches, or new services.
- Storage: `ai_turns` holds questions and validated answers; size is linear in turns, a few KB per turn.
- Operational complexity: no new jobs. The existing 60 s reconciliation covers held attempts, including cancelled turns.

## 6. Architectural risks and blockers

| ID | Type | Description | Mitigation / owner |
|---|---|---|---|
| B-A / P-0 | **Resolved 2026-11-10** | NEM-022 acceptance was not recorded at revision 2 | PO acceptance recorded at `f6a5cb7` after PA re-review (NEM-022 report §20). Its coverage shortfall (77.49%) is carried, not waived |
| B-B | Resolved by recommendation (decision open) | Highlights cannot be read without an exception to accepted NEM-019 tests | D-2 C (first implementation without user knowledge); A/B later |
| **B-C** | Blocker (decision) | The turn input, response, port wiring, and routes are accepted dark surfaces | D-3 explicit authorization; direct injection keeps the pinned port binding unchanged |
| R-1 | High | E-1 latency inside preflight, plus per-attempt streaming, gives a slow time-to-answer for large sessions | Measure; stage UI; no workaround (no cache or cap per the PA) |
| **R-2** | High (E3 design) | If E3's `TextIdentityPort` hashes the full MinIO object on every call, each book is fetched and hashed **up to three times per turn**: user eligibility, index permission, and S2 retrieval. That multiplies E-1's S2 cost | E3 should derive the hash once per text version (e.g. at upload or ingestion, with a verified re-check), not per call. **Record as an E3 design requirement** |
| R-3 | High | Reader starvation on the shared 1-vCPU / 512 MB API process (**measured**: ~85 ms lag p99 per in-flight 10-book retrieval) | Weighted guard W = 10 (D-11); reader-delta measurement in Checkpoint D |
| R-4 | Medium | `websearch` AND semantics produce "no passages" for long natural questions | Disclosure copy + input hint. Query rewriting (`or`) would be a retrieval behaviour change and needs its own approval |
| R-5 | Medium | P0 packet scope (E6 backend, E9 UI) vs this instruction (E6 + UX) | D-1 |
| R-6 | Medium | Revoked-book excerpts persisted in `ai_turns` | Render-time "source unavailable"; TT-14 before launch |
| R-7 | Medium | Cancelled or failed provider attempts stay **held** at the reserved amount until reconciliation, so users may briefly see reduced capacity | Disclose in the UI; existing reconciliation |
| R-8 | Low | A completion-write failure after settlement breaks replay for that key | D-8 (a): the answer is delivered best effort with the `unrecorded` marker; the row stays provisional until its fence, then `interrupted` (terminal); replay never reproduces the answer; ledger untouched (F-2, F-6) |
| R-10 | Medium → reduced | Revocation between step 2 and the provider call | **Final eligibility check** immediately before invocation (review package §6, F-3). Remaining window: during the provider call only (history hides the excerpt) |
| R-11 | Low | Explicit cancel uses an in-process registry, so it would not reach another API instance | Single instance today; a shared channel only if scaled out (launch item) |
| R-9 | Low | The dev nginx proxy may buffer SSE | `X-Accel-Buffering: no` response header (no infrastructure change); Traefik streams |

## 7. Product Owner decisions required (packet revision 2)

| ID | Decision |
|---|---|
| P-0 | NEM-022 status: **satisfied 2026-11-10** (packet §0) |
| D-1 | Scope: **APPROVED (a), PO 2026-11-10**: backend + one minimal web Q&A interface (E9 keeps the broader UX) |
| D-2 | User knowledge: **C recommended now** (passages only); A/B later |
| D-3 | Authorize the accepted-surface amendments (direct injection; no binding change) |
| D-4 | Stateless turns (a) |
| D-5 | Reserve NEM-024 |
| D-6 | Web first (a) |
| D-7 | Dark on fixture ports before E3/E4 (a) |
| D-8 | Delivery when the record write fails after settlement: (a) deliver as `unrecorded` |
| D-9 | Disconnect is not cancel (a) |
| D-10 | Historical excerpts hidden after revocation (a), pending TT-14 |
| D-11 | Weighted concurrency W = 10 and the PA's reader-latency threshold |

## 8. Recommended implementation sequence (after decisions and approval)

0. Record NEM-022 acceptance (B-A); the PO decides D-1 to D-7; PA review → PO approval of the mission.
1. **Checkpoint A — backend wiring (passages only, D-2 C):**
   - any D-3-authorized test amendments, each in its own commit, verified green first;
   - question input; retrieval wiring by direct injection; context budget;
   - `ai_turns` migration with durable completion, the duplicate table, and replay;
   - `TurnResult` v2 (refs + anchors; excerpts from the in-context passages).
2. **Checkpoint B — transport and resilience:** SSE stream endpoint (per-attempt events + `stage`), explicit cancel registry (disconnect ≠ cancel), recovery sweep, history with excerpt re-materialization and `sourceState`, `GET /knowledge/sessions/capabilities`, weighted guard, stage metrics.
3. **Checkpoint C — minimal web Q&A interface (required; D-1(a) approved).** Research screen, citation dialog, states, en/es, accessibility; a Playwright flow on the simulated stack.
4. **Checkpoint D — verification:**
   - integration: duplicates under a barrier, persistence-failure injection, each cancellation row, revocation, deletion during flight;
   - latency tables for 3/10 books (E-1);
   - reader-latency delta at W on the production image under the cap (D-11);
   - coverage (E-2);
   - completion report.
5. **Later, each separately authorized:** isolation tests → D-2 A/B exception → My Knowledge; then **E6b** Ask My Highlights (after TT-27); E3/E4 adapters (R-2 requirement); E7 Brief; E9 breadth; mobile (after TT-20).

## 9. Conflicts with accepted architecture (documented, not changed)

| Conflict | Accepted item | Options (packet) |
|---|---|---|
| Reading highlights from `knowledge/` | NEM-019 AC-10/17, AC-16/17 | D-2 C now (no change); A / B later |
| Turn needs the question and citations | NEM-019 `TurnDto`, `TurnResult`, `TurnService` | D-3 |
| Retrieval via `ContextSourcePort` | NEM-019 port signature + F-12 binding test | D-3 (5): direct injection (no binding change) vs port extension |
| "Streaming" UX expectation | NEM-022 F-1/F-3 per-attempt release | Keep; stage UI. Any token-level streaming needs a separate PA decision on F-1 |
| UI ownership | P0 packet E9 | D-1 |

## 10. Restrictions honoured

Documentation only. No application code, tests, migrations, CI/CD, or infrastructure changed. No production data or credentials. No provider. No E6 implementation. No accepted contract modified. No open PO decision resolved by assumption. No existing PR or branch altered.

## 11. Revision 2 — responses to the PA review of `e73c277`

### R-1 — NEM-022 acceptance

| Part | Content |
|---|---|
| Finding | Every repository record says NEM-022 is **not accepted**:<br>• mission status "returned for PA re-review" (2026-11-09);<br>• register row;<br>• report §19 "NEM-022 is not accepted";<br>• branch head `f6a5cb7` "returned for re-review", no later commit;<br>• PR #51 with no reviews or comments;<br>• no PO record accepting the implementation (PO-032 approves only the specification).<br>Separately, the E5 discovery documents (`4018ce3`, carried into NEM-023) describe NEM-022 as "accepted", with no decision record. The agent's session notes attribute that wording to the PO's E5 discovery instruction, which is not stored in the repository. **Whether acceptance was granted outside the repository cannot be verified; it is not inferred, and no acceptance record was created** |
| Correction | B-A restated as **P-0** with evidence (packet §0; mission §3; inventory 12 §4). The NEM-023 wording "NEM-022 accepted" is flagged for correction or backing when P-0 is resolved (not edited here: outside this branch's E6 scope) |
| Evidence | `docs/engineering-missions/APPROVED/NEM-022-…md` line 4; `docs/engineering-missions/README.md` row NEM-022; `docs/reports/2026-11-09-NEM-022-gateway-simulator-v2-report.md` line 500; `git log origin/feat/nem-022-gateway-simulator-v2` (head `f6a5cb7`); `gh api …/pulls/51/reviews` and `…/issues/51/comments` (empty); `git log -S "NEM-022 accepted"` → first `4018ce3` |
| Remaining decision | P-0: (i) record the PA re-review outcome + PO acceptance, or (ii) explicitly authorize E6 on the unaccepted head |

### R-2 — Highlights and notes boundary

| Part | Content |
|---|---|
| Finding | D-2 A is narrow, but it amends an accepted NEM-019 protection in the same mission that first wires turns. D-2 C delivers a complete research turn with no change to any accepted protection |
| Correction | Recommendation changed to **D-2 C for the first implementation**. The mission now excludes all `fragments` access, and NEM-019 AC-10/17 and AC-16/17 stay unchanged. A and B remain open as later options. New [13 §3.5](../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation) defines how My Knowledge and Ask My Highlights can be added later without weakening isolation: isolation tests first; an explicit exception, never relocation; positive test constraints; unchanged Context Builder and origin rules; AMH as a separate model path after TT-27; no cross-path conversation reuse |
| Evidence | `tests/unit/knowledge/architecture.spec.ts` (AC-10/17 table regex includes `fragments`; AC-16/17 import regex); `context-builder.service.ts` (owner check exists); `citation-policy.ts` (`user_content` rules); ADR-006 trust boundary; PO-028 |
| Remaining decision | D-2 (PA + PO): C now (recommended), or A/B now |

### R-3 — Durable completion and idempotency

| Part | Content |
|---|---|
| Finding | Revision 1 left persistence failure as a "documented gap", did not define the completion point, and implied replay without a mechanism |
| Correction | *(Revision 2 text; superseded in part by F-2 and F-6: `result_unavailable` and the overwritable `interrupted` were replaced by best-effort delivery and the fenced terminal state machine, review package §2 and §7.)* Mission §9.2 now specifies:<br>• the status set and the row insert inside the step-4 lock transaction;<br>• **durable completion = the commit of the completion update**;<br>• a persistence failure after settlement (charge stands; answer delivered as `unrecorded`; replay → `result_unavailable`; recovery → `interrupted`);<br>• a duplicate table for during-preflight, in-flight, completed, failed, and released cases;<br>• the two concrete gates: NEM-021 ledger attempt-1 uniqueness (no second reservation or provider call) and `ai_turns` UNIQUE (no second record);<br>• recovery via an `@Interval` sweep that never writes ledger rows;<br>• deletion cascade with a no-op late completion.<br>**No exactly-once claim** beyond those constraints, and each has a concurrency test (AC 5–6, 9). NEM-021 remains the sole settlement authority (AC 4 architecture test) |
| Evidence | `turn.service.ts` (`turnIdempotencyKey`, step 4 transaction, `releaseOrHold`); `cost-ledger.service.ts` (`duplicate_attempt` → `duplicate_turn`); `ai-gateway.service.ts` F-3 settle-before-yield; `cost-reconciliation-job.service.ts` `@Interval` 60 s; migration 070 cascades |
| Remaining decision | D-8 (answer delivery when the record write fails after settlement) |

### R-4 — Cancellation, revocation, and citations

| Part | Content |
|---|---|
| Finding | Revision 1 treated "client disconnect" as an abort and did not distinguish cancellation stages, post-storage revocation, or citation failures |
| Correction | Mission §9.3 and 13 §5.1 add a cancellation matrix:<br>• before reservation: no charge;<br>• after reservation, before the lock: release;<br>• after the lock, before the provider: release, lock stands, `cancelled`;<br>• during the provider: `client_abort`, held until reconciliation;<br>• after settlement: no effect.<br>**Disconnect is not a cancel** (D-9 a); explicit cancel uses an endpoint plus an in-process registry. Mission §9.4 and 13 §2 and §5.2 cover revocation before generation (excluded and disclosed; residual window documented) versus after storage. `ai_turns` stores **refs + anchors only**, and excerpts are re-materialized with an eligibility re-check, so historical excerpts are hidden after revocation by default (D-10 a), with TT-14 final. Citation failures get safe states (`position_unavailable`, `revoked`, `stale`, `unavailable`), with nothing fabricated or dropped. The Gateway streaming contract is unchanged |
| Evidence | `ai-gateway.service.ts` (`release` for never-sent attempts; `AbortSignal`; F-1 per-attempt release); NEM-023 S2 rules (no verbatim text in PostgreSQL); `anchor-resolver.ts` (null when stale); ADR-006 revocation row |
| Remaining decisions | D-9 (disconnect), D-10 (historical excerpts, dark default) |

### R-5 — Product scope and resources

| Part | Content |
|---|---|
| Finding | D-1 (a)/(b) were blended in the mission. The "2 concurrent retrievals" guard was assumed, not measured |
| Correction | *(Revision 2; superseded by the PO approval of D-1(a) on 2026-11-10: the web interface is now required.)* At revision 2, D-1 (a) and (b) were kept distinct; the mission marked the D-1(a)-only items (scope 13, AC 14, Checkpoint C). Measured on 1 vCPU / 512 MB (§5.4): memory is not binding (+~40 MB per 10-book turn; production image idle 73–102 MiB), while event-loop CPU is (lag p99 85 ms at one 10-book turn, 169 ms at two). Guard changed to **weighted W = 10** before reservation, with a reader-latency acceptance against a PA threshold (D-11). E-1 and E-2 remain unresolved. No infrastructure, cache, provider, or ranking change |
| Evidence | §5.4 tables; `docker-compose.server.yml` api `cpus: "1.0"`, `memory: 512M`; locally built production image measurement |
| Remaining decisions | ~~D-1~~ (approved (a)); D-11 (W candidate and reader-latency acceptance) |

### Update 2026-11-10 — P-0 satisfied

The PO recorded NEM-022's acceptance at `f6a5cb7` after PA re-review (NEM-022 report §20). R-1's remaining decision is therefore **resolved**. NEM-023's wording was reconciled without changing its status. **No E6 decision and no E6 mission approval follows from this update.**

### Update 2026-11-10 — PA finding F-6 (of `4e2c041`)

- `interrupted` is **terminal**, and no terminal state ever changes.
- Recovery is fenced by a database-time `fenceAt`: owner and cancel writes require `now() < fenceAt`, and finalization requires `now() >= fenceAt`.
- Lazy finalization runs in every read.
- One provisional turn per session (partial unique index).
- Twelve deterministic race tests (R1–R12).
- No new table or service.
- See review package revision 3 §7, mission revision 5 §9.2, and packet revision 5.

### Update 2026-11-10 — PA review F-1 to F-5 (of `ccb3acc`)

The corrections are recorded in review package revision 2 §9, mission revision 4, and packet revision 4:
- F-1: D-1(a) only; the probe is `GET /knowledge/sessions/capabilities`.
- F-2: D-8 best-effort delivery, with no unseen-charge guarantee.
- F-3: a final eligibility check before invocation.
- F-4: W = 10 is a candidate, with reader p95 delta ≤ 50 ms as the criterion and the reduction 10 → 6 → 3.
- F-5: race-safe recovery (lease-based; replaced by the fence after F-6, see below).

### Update 2026-11-10 — D-1(a) approved; final PA review package

The PO approved **D-1(a)**. D-2(C), D-4(a), D-6(a), D-7(a), and D-9(a) are **proposed baselines, not approved**. The final PA review package ([2026-11-10-E6-pa-final-review-package.md](2026-11-10-E6-pa-final-review-package.md)) covers:
- D-3 (precise, additive amendments; **no protected-test amendment under the baseline design**);
- D-8, D-10, D-11;
- cancellation consistency;
- revocation during an active turn;
- checkpoints A–E;
- PA questions Q-1 to Q-10.

NEM-022 acceptance and NEM-023 E-1/E-2 are preserved.

**STOP for independent Product Architecture re-review before any implementation authorization.**
