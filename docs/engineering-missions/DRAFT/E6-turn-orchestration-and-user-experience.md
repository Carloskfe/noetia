# NOETIA ENGINEERING MISSION — NEM-0XX (proposed NEM-024) (E6)
## Research-Turn Orchestration and Minimal Web Q&A Interface (dark, simulated provider only) — revision 4

**Status:** DRAFT — **never executable** (`DRAFT/`). It becomes executable only after:
1. prerequisite P-0 (NEM-022 status) — **satisfied 2026-11-10** (§3);
2. the PO decides the [decision packet](../../reports/2026-11-10-E6-product-owner-decision-packet.md);
3. the PA reviews this specification;
4. the PO approves it and gives an explicit execution instruction naming the mission.

**Identifier:** pending (D-5). NEM-024 verified unused on 2026-11-10; not reserved.
**Mission type:** IMPLEMENTATION (proposed)
**Implementation authorization:** NONE
**Schema changes:** ADDITIVE ONLY (proposed): one table, `ai_turns`; disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED (none needed)
**Production deployment:** NOT AUTHORIZED (staging and merge to `main` also not authorized)
**Product Owner approval:** REQUIRED

> **Revision 4** (PA review of PR #54 at `ccb3acc`: F-1 to F-5; [review package §9](../../reports/2026-11-10-E6-pa-final-review-package.md#9-responses-to-the-pa-review-of-ccb3acc-f-1-to-f-5)):
> - F-1: D-1(a) only (the superseded wording is removed); the capability probe is `GET /knowledge/sessions/capabilities` in `SessionsController`.
> - F-2: D-8(a) delivery is **best effort**, with no unseen-charge guarantee.
> - F-3: a **final eligibility check** runs immediately before provider invocation (§9.4).
> - F-4: W = 10 is a **candidate**; reader p95 delta ≤ 50 ms is the acceptance criterion (§9.5).
> - F-5: **lease-based, race-safe recovery** (§9.2 items 7–8).
>
> **Revision 3** (PO *"E6 Final Mission Review Preparation"*, 2026-11-10):
> - **D-1(a) APPROVED** by the PO: backend plus **one minimal web Q&A interface**. The web interface is now an explicit requirement (§5 item 13, §5.1, AC 14, checkpoint D), and the E6/E9 separation is explicit (§5.1).
> - **Proposed baselines (not approved):** D-2(C) book passages only, D-4(a) stateless model context with persistent history, D-6(a) web first, D-7(a) simulator and fixture-based dark development, D-9(a) disconnect does not cancel. The mission is written on these baselines; each still needs its decision.
> - The precise D-3 amendments, D-8, D-10, D-11, cancellation consistency, revocation during a turn, and the checkpoint plan are in the [PA final review package](../../reports/2026-11-10-E6-pa-final-review-package.md).
>
> **Revision 2** (PA review of PR #54 at `e73c277`, *"direction supported — revisions required"*):
> - R-1: the NEM-022 prerequisite is restated from evidence (§3).
> - R-2: the first implementation uses **book passages only** (D-2 C); user knowledge is a later, separately authorized step (§5.3, §6).
> - R-3: durable completion and idempotency are specified (§9.2).
> - R-4: cancellation, revocation, and citations are specified (§9.3, §9.4).
> - R-5: D-1 variants are kept distinct, and the concurrency limit is based on a measurement on a 1-vCPU / 512 MB container (§9.5).
>
> Sections that change with a packet option are marked **[D-x]**.

---

## 1. Context

NEM-019, NEM-021, NEM-022, and NEM-023 exist as **dark, unmerged** components. The research turn has:
- no question input;
- no retrieval wiring;
- no persisted conversation;
- no citation detail in the response;
- no streaming transport;
- no UI.

Evidence: [discovery report](../../reports/2026-11-10-E6-turn-orchestration-discovery-report.md), [11](../../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)–[14](../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md).

## 2. Objective

A (fixture) entitled user asks a question in a session with eligible books. The turn:
1. retrieves **book passages** from the selected eligible books;
2. passes the unchanged Context Builder invariant;
3. is answered through Gateway v2 + simulator;
4. returns validated segments with origin labels and citations;
5. is **durably recorded** with replay-safe idempotency.
6. is asked and read through **one minimal web Q&A interface** (D-1(a), approved), with E9 keeping all broader UX (§5.1).

All of this is dark, with default deny everywhere in the real module.

**Done** = every §11 criterion proven on disposable databases with fixture texts and simulated providers.

## 3. Dependencies

**P-0 — NEM-022 status: SATISFIED (recorded 2026-11-10).** The PO accepted NEM-022 at commit `f6a5cb7` after independent PA re-review; F-1, F-2, F-3 resolved ([NEM-022 report §20](../../reports/2026-11-09-NEM-022-gateway-simulator-v2-report.md#20-product-architecture-re-review-outcome-and-product-owner-acceptance-2026-11-10); register). E6 builds on that commit (an ancestor of this branch). NEM-022's open item, global API branch coverage 77.49% vs 80%, is **not waived**, and its intermittent-test monitoring note applies. *This satisfies only the prerequisite; it approves no E6 decision and does not approve this mission.*

<details><summary>Historical P-0 text (revision 2, before the acceptance was recorded)</summary>

**P-0 — NEM-022 status (prerequisite).**
- Repository records say NEM-022 is **not accepted**:
  - the mission and register say "returned for PA re-review" (2026-11-09);
  - report §19 says "NEM-022 is not accepted";
  - PR #51 has no review or comment.
- NEM-023 documents describe NEM-022 as "accepted" from commit `4018ce3` onward, without a recorded decision. Evidence: report §11 R-1.
- **E6 may execute only after the PA re-review outcome and the PO acceptance decision for NEM-022 are recorded in the repository, or after the PO explicitly authorizes E6 to build on the unaccepted NEM-022 head `f6a5cb7`.**

</details>

**Other dependencies:**
- Code: the NEM-019/021/022/023 branch stack (not `main`).
- Decisions: **D-1(a) approved**. Baselines D-2(C), D-4(a), D-6(a), D-7(a), D-9(a) proposed, not approved. Open: D-3, D-5, D-8, D-10, D-11 (packet §1).
- Not required: E3/E4 production adapters (fixture ports, D-7); paid providers; staging; CI changes.
- Test environment: local disposable PostgreSQL 16 / Redis / MinIO-compatible fixture; VM limits (`--maxWorkers=2`); for §9.5, the locally built production API image under `--cpus=1 --memory=512m`.

## 4. Source-of-truth references

ADR-003, ADR-005, ADR-006 · PO-026, PO-027, PO-028, PO-033 · NEM-019 technical note §1–§13 · NEM-021 settlement authority (ledger) · NEM-022 F-1/F-2/F-3 · NEM-023 Amendment 1, acceptance record (E-1, E-2), §17.1 (the 2 s limit is per statement) · three-tier 11–14.

## 5. In scope

1. **Turn input:** `TurnDto.question` (NFC, trimmed, 1–500 code points; matching E5 validation). The client `idempotencyKey` is unchanged. **[D-3]**
2. **Retrieval wiring:** inside the existing step 2 (after per-book eligibility, before reservation), `TurnService` calls `QueryContextSource.resolve(userId, eligible, question, …)`. Direct injection; `CONTEXT_SOURCE_PORT` stays `EmptyContextSource`, and its (empty) candidates are still merged. **[D-3]**
3. **User knowledge: not in this mission (D-2 C).**
   - Highlights and notes are neither read nor sent. `fragments` is untouched. NEM-019 AC-10/17 and AC-16/17 are unchanged.
   - Adding them later is a separate, explicitly authorized step (§6, [13 §3.5](../../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md#35-adding-user-knowledge-later-without-weakening-isolation)).
   - **[D-2 A]** would instead add one named, test-asserted read route; the scope is otherwise unchanged.
4. **Context budget:** passages ≤ the configured budget (E5 default 6,000 tokens), applied before `prepare`.
5. **Turn record:** additive migration `ai_turns`:
   - **Identity:** `id`, `sessionId` (FK `ai_conversations` ON DELETE CASCADE), `turnIndex`, `keyHash` (UNIQUE with `sessionId`).
   - **Content:** `question` (user content), `segments` (jsonb: validated segments with citations as **refs + anchors only, no excerpt text**), `exclusions` (jsonb).
   - **State:** `status`, `settlement`, `createdAt`, `completedAt`, **`attemptToken`** (uuid per request), **`leaseExpiresAt`** (recovery lease, §9.2 item 7).
   - No provider or model names. **No verbatim book text** (S2 principle preserved).
6. **Durable completion and idempotency** (§9.2).
7. **`TurnResult` v2:** `turnId`, `status`, `segments[] {origin, text, citations[] {ref, kind, bookId, anchor, excerpt|null, sourceState}}`, `exclusions {ineligible, unindexed, stale, unavailable, indexNotPermitted}`, `settlement`.
8. **Routes (all `JwtAuthGuard` + declared capability):**
   - `GET /knowledge/sessions/:id/turns` (history, paged);
   - `GET /knowledge/sessions/:id/turns/:turnId`;
   - `POST /knowledge/sessions/:id/turns/stream` (SSE body; events `stage`, Gateway `segment`/`delta` after validation, `terminal`);
   - `POST /knowledge/sessions/:id/turns/cancel` (body `{idempotencyKey}`; explicit cancellation, §9.3);
   - `GET /knowledge/sessions/capabilities` (tier, capabilities, limits; no budget values). **[D-3]**
9. **Module registration:** E5 providers (`IndexingPermission`, `LexicalRetrievalService`, `QueryContextSource`, `AnchorResolver`, `StorageBookText` via the existing `StorageModule`) registered in `KnowledgeModule`. Text-identity/authority ports stay **unbound**; `app.module.ts` unchanged.
10. **Concurrency guard** (§9.5).
11. **Recovery sweep** for interrupted turns, using the existing `@Interval` pattern (§9.2). No new infrastructure.
12. **Metrics (no content labels):** stage histograms (`entitlement`, `eligibility`, `retrieval`, `prepare`, `lock`, `provider`, `complete`), outcomes, replays, cancellations, guard rejections, event-loop lag.
13. **Minimal web Q&A interface (required; D-1(a) approved):** one route `app/(research)/research/[sessionId]` in `services/web`, per [14](../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md) and §5.1:
    - **Ask:** a question input; one persisted conversation per session, loaded from the history route.
    - **Session context:** selected-book chips with the lock indicator and exclusion disclosures.
    - **Turn states:** content-free stage states while the turn runs (no token-by-token text); explicit cancel, plus same-key recovery after a reload or disconnect; read-only and fork notices.
    - **Answers:** origin labels in text; a citation dialog with the verified excerpt or `sourceState`, plus an "Open book" link (link only; reader untouched).
    - **Errors:** each `code` mapped to en/es copy.
    - **Platform:** shown only when the capability probe allows it. Web only (D-6 a baseline). No new UI framework or service; reuses `apiFetch`, Tailwind, and the i18n providers.
14. Tests, technical-note section, migration entry, completion report.

### 5.1 E6 minimal interface vs E9 broader UX (boundary)

| Capability | E6 (this mission) | E9 (later) |
|---|---|---|
| Research Q&A screen for **one existing session** | ✅ Minimal: ask, states, answer, citations, cancel, errors | Polish, design system, advanced layouts |
| Session creation and book selection UI (3/10 picker, library multi-select) | ❌ Sessions are created through the API or a single "Research with Noetia+" entry from the book page *only if* PA allows a minimal entry (review package Q-10); otherwise a test fixture | ✅ |
| Session list, fork UI, session management | ❌ Only a fork **notice** with a link to the existing API action | ✅ |
| My Knowledge, Ask My Highlights, highlight search | ❌ (D-2 C baseline) | ✅ (after their own approvals) |
| Research Brief view and export | ❌ | ✅ (E7 + E9) |
| Capacity indicator, at-limit upsell | ❌ Only the `budget_exhausted` message | ✅ (TT-10, TT-11) |
| NoetiaX depth screens | ❌ | ✅ (E8 + E9) |
| Mobile | ❌ (D-6 a baseline) | ✅ if TT-20 approves |
| Reader deep links to exact positions | ❌ (link to the book only) | Later, with an approved `sync_maps` path |

E6 ships no navigation entry in the global app chrome unless the PA allows the minimal book-page entry. The screen is reachable by URL for a session created through the API, and is hidden when the capability probe denies.

## 6. Out of scope

- **User knowledge in any form:** My Knowledge highlights and notes in a session (later step after D-2 A/B authorization), Ask My Highlights (E6b, after TT-27), highlight search.
- Research Brief (E7) · NoetiaX depth (E8) · **all UX beyond the §5.1 minimal interface (E9)** · mobile (D-6 a baseline) · Expand/`broader` (TT-18).
- Conversation memory in model context (D-4 b).
- Reconstruction threshold enforcement (TT-13).
- Production adapters (E3, E4, ownership) · real or paid providers (TT-22) · embeddings, pgvector, caches · ranking changes (E-1 open) · reader changes or exact deep links · `fragments`/`sync_maps` access · staging, CI/CD, infrastructure, merge, deployment.

## 7. Product rules

- Book passages are the only `library` evidence.
- Exclusions are disclosed as facts.
- No model or provider names; `BOOK TOKEN ≠ AI USAGE`.
- Private to the account (PO-026 rule 6).
- The locked set changes only by fork (PO-027).

## 8. Protected systems

- Reader, Escucha Activa, ownership, `user_books`, tokens, Stripe, subscriptions, production data.
- **`fragments` and `sync_maps` (not accessed).**
- NEM-019:
  - the turn order and lock;
  - the Context Builder invariant;
  - default deny;
  - **all port bindings**;
  - **architecture tests AC-10/17 and AC-16/17 unchanged (D-2 C)**.
- NEM-021: contract v1 and **settlement authority**. E6 never writes reservation, settlement, release, or compensation rows directly; it uses only the Gateway API.
- NEM-022: the Gateway, including the fail-closed per-attempt streaming contract and the citation policy.
- NEM-023 retrieval behaviour.
- `app.module.ts`.

Only the D-3 items may change, exactly as authorized.

## 9. Technical requirements

### 9.1 Turn order (unchanged)

[1] entitlement → [2] set + eligibility + retrieval + Context Builder → [3] prepare/reserve → [4] lock transaction **(+ turn-record insert, §9.2)** → [5] provider outside any transaction → [6] per-attempt settlement (Gateway) → [7] completion write.

Retrieval failure **before** reservation → `turn_failed`, with no lock, no charge, and no record.

### 9.2 Durable completion and idempotency (R-3)

**States of `ai_turns.status`:**

| Status | Meaning |
|---|---|
| `accepted` | Turn passed preflight; the attempt was reserved; the session lock was taken |
| `completed` | Validated answer persisted |
| `failed` | Provider or validation failure; no answer |
| `cancelled` | Explicit cancel |
| `interrupted` | Set by recovery |

**Lifecycle:**
1. **Record creation:** the row is inserted with `status = 'accepted'`, a fresh `attemptToken`, and `leaseExpiresAt = now() + L` **inside the existing step-4 lock transaction** (with the lock and `turnCount` update). Preflight failures and step-4 failures (attempt released by the existing `releaseOrHold`) create **no** row.
2. **When a turn is durably completed:** when the single conditional `UPDATE … SET status = 'completed', segments = …, completedAt = now() WHERE id = $1 AND attemptToken = $2 AND status IN ('accepted', 'interrupted')` **commits** (item 7 explains `interrupted`). This happens after the Gateway's terminal event. By NEM-022 F-3, the attempt's usage is already settled, or held, in the NEM-021 ledger before any consumer-visible event. **Settlement and completion are separate facts:** the ledger is the only authority for charges, and `ai_turns` is only the conversation record.
3. **Order of response vs completion:** the server attempts the completion write **before** sending the terminal response or event, with one bounded retry.
4. **Persistence fails after settlement (D-8 a, proposed):**
   - the charge stands (ledger authority; E6 never compensates);
   - the server **attempts** to return the answer with `status: 'unrecorded'`. **Delivery is best effort:**
     - if the response or SSE terminal event is lost (network failure, tab closed, app backgrounded, proxy timeout), the answer is lost, because it exists only in that response;
     - **the user is then charged for an answer never seen**;
     - D-8 (a) avoids only *withholding* an answer the server still holds, and **does not prevent an unseen charge**;
   - the row stays `accepted` until recovery marks it `interrupted`;
   - a replay of the same key cannot reproduce the answer and returns `result_unavailable` (no provider call, no charge);
   - content-free metric `intelligence_turn_unrecorded_total`; the combined residual (record failed **and** response lost) is disclosed in the completion report.

   *Policy D-8.* The alternative (b) withholds the answer and returns an error: a certain unseen charge.
   - **Network failure with a recorded turn** (the ordinary case) is recoverable: the completion committed, so a same-key replay or `GET …/turns/:turnId` returns the stored result with no new charge. Under D-9 (a), a disconnect does not cancel.
5. **Duplicate requests (same `sessionId` + client key; the server key is `turnIdempotencyKey`):**

   | Time of duplicate | Detection | Response | Provider call | Charge |
   |---|---|---|---|---|
   | While the original is in preflight (before reservation) | None yet | Both may run preflight; the ledger's attempt-1 uniqueness admits **one** reservation, and the loser gets `duplicate_attempt` | The loser: none | The loser: none |
   | While the original is in flight (`accepted`) | Ledger duplicate + row `accepted` | `409 duplicate_turn` with `{turnId, status: 'accepted'}`; the client polls `GET …/turns/:turnId` | None | None |
   | After completion | Row `completed` | `200` with the stored `TurnResult` (replay) | None | None |
   | After `failed` / `cancelled` / `interrupted` | Row status | That stored status; the client asks again with a **new key** | None | None |
   | After a step-4 failure (released, no row) | Ledger duplicate, no row | `409 turn_failed` ("ask again"); a new key is required | None | None (released) |

   **Mechanism:** the NEM-021 ledger's unique attempt key (`turnKey:a1`) is the single gate against a second reservation and therefore a second provider call. `ai_turns` UNIQUE (`sessionId`, `keyHash`) is the single gate against two records. No exactly-once promise is made beyond these two constraints, and each one has a concurrency test (§12).
6. **Retries:**
   - **Gateway retries** (configured `maxProviderAttempts`, default 1) are separate attempts, each reserved and settled by the Gateway. E6 adds none.
   - **Client retries** with the same key never cause a new reservation or provider call (table above). A new question needs a new key, which is a new charge by design.
7. **Recovery (lease-based, race-safe; F-5):**
   - **Lease:** while a turn is in flight, its request renews `leaseExpiresAt = now() + L` every L/3 (proposed L = 30 s; Q-12) with `UPDATE … WHERE id = $1 AND attemptToken = $2 AND status = 'accepted'`.
   - **Bound:** renewal stops, and the request aborts its own call through the existing `AbortSignal`, at `T_max = providerTimeoutMs × maxProviderAttempts + Σ allowed retry delays + grace`. No lease outlives T_max + L.
   - **Sweep:** an `@Interval` job (existing knowledge-module pattern) runs `UPDATE ai_turns SET status = 'interrupted' WHERE status = 'accepted' AND leaseExpiresAt < now() - <grace> RETURNING id`.
     - A single atomic statement, safe with concurrent instances.
     - It **never** marks a turn whose lease is still being renewed.
     - It **never** touches the ledger: held attempts resolve through the existing NEM-021 reconciliation.
   - **Transitions:** every transition is a conditional single-statement update, so PostgreSQL row locking decides each race with exactly one terminal status. The only permitted overwrite is `interrupted → completed` by the **owning** `attemptToken` (Q-13): the answer is real and paid. `cancelled` and `failed` are never overwritten.

     | Transition | Condition |
     |---|---|
     | Complete | `status IN ('accepted', 'interrupted') AND attemptToken = owner` |
     | Cancel | `status = 'accepted'`; 0 rows → return the current status |
     | Final-check failure (§9.4) | `status = 'accepted' AND attemptToken = owner` |
   - **Crash:** no renewal, so the turn is `interrupted` within L + grace + sweep interval.
8. **Account and session deletion:**
   - `ai_turns` cascades from `ai_conversations`, which cascades from `users` (ADR-005 B-2); the existing `deleteAccount` path is unchanged.
   - Every in-flight conditional update (lease renewal, completion, cancel, failure) after deletion affects 0 rows and is a no-op, so nothing is resurrected (tested).
   - Ledger rows follow NEM-021 rules.
9. **Fork:** turns are not copied (stateless turns, D-4 a). The parent's history stays readable in the parent.

### 9.3 Cancellation (R-4)

| When | Trigger | Server action | Charge | Lock | Record |
|---|---|---|---|---|---|
| Before reservation (preflight) | Explicit cancel | Stop at the next stage boundary | None | None | None |
| After reservation, before the lock commits | Explicit cancel | `gateway.release(prepared)` (existing never-sent release; held if the release cannot be written) | None (released) | None | None |
| After the lock, before the provider call starts | Explicit cancel | Do not invoke; `gateway.release(prepared)` | None (released) | **Stands** (the turn was accepted; ADR-006) | `accepted → cancelled` (conditional) |
| During a provider attempt | Explicit cancel | `AbortSignal` → Gateway `client_abort`; no text released (F-1) | **Held** at the reserved amount until NEM-021 reconciliation settles it from evidence | Stands | `accepted → cancelled` (conditional) |
| After settlement (terminal reached) | Explicit cancel | No effect; completion proceeds | As settled | Stands | `completed` (viewable by replay or history) |
| Any time, including preflight | **Client disconnect or stream close** (network loss, tab close, app background) | **Never a cancellation** (D-9 a, proposed baseline): the turn continues to completion and is persisted, so a same-key replay returns it | As normal | — | As normal |

- Explicit cancel is `POST …/turns/cancel {idempotencyKey}`. It signals the in-flight request through an **in-process** registry (`Map<serverKey, AbortController>`).
- With more than one API instance this would need a shared channel. That is a known limitation and is not built now (single instance; no new infrastructure).
- The accepted Gateway streaming contract is unchanged.

### 9.4 Revocation and citations (R-4)

- **Revocation before generation:**
  - eligibility and index permission are evaluated in step 2 of **every** turn;
  - a revoked book is excluded and disclosed (`exclusions`); with none left → `no_eligible_books` (no charge, no record).
- **Final eligibility check (F-3), immediately before provider invocation:**
  - **Position:** after the step-4 lock transaction commits, and immediately before `gateway.invoke` / `gateway.stream`. No other awaited operation sits between the check's completion and the invoke (ordering test). No I/O is added inside the lock transaction.
  - **Two distinct authorizations, both fresh** (no cached decision from step 2 or from `QueryContextSource`'s per-request cache):
    1. user-level research rights: `RightsService.eligibility(user, b, 'research_analysis')` for **every** book in the sealed `allowedBookIds`;
    2. book-level indexing permission: `IndexingPermission.check(b)` for **every** book contributing `chunk` items.

    In both, the current text hash must equal the hash used in step 2.
  - **On failure:**
    - do **not** invoke;
    - call the existing `gateway.release(prepared)` (never-sent attempt) — **no charge**. If the release cannot be written, the attempt stays **held** and NEM-021 reconciliation resolves it from the no-provider evidence;
    - the record goes `accepted → failed` (internal reason `user_rights_changed` / `index_permission_changed`);
    - the lock stands (Q-7);
    - the client receives the existing `book_ineligible` code with an `exclusions` payload; asking again needs a new key, and the next turn excludes the book.
  - **No in-place rebuild:** a changed context would need a new reservation, and attempt key `turnKey:a1` cannot be reserved twice.
  - **Contracts unchanged:** the Gateway and ledger contracts are unchanged; only existing methods are used.
- **Revocation during the provider call:** not re-checked; the answer is delivered; history hides the excerpt (D-10).
- **After a stored answer:**
  - `ai_turns` stores **refs + anchors only**.
  - On every history read, each cited book is re-checked (user-level `RightsService.eligibility` **and** book-level `IndexingPermission.check`) and the excerpt is re-materialized through S2: current hash = anchor hash, then MinIO slice.
  - If the book is ineligible, stale, unavailable, or purged, the citation is returned with `excerpt: null` and `sourceState ∈ {revoked, stale, unavailable}`; the UI shows "source no longer available".
  - **Default: historical excerpts are not visible after revocation (D-10).** The stored answer text (generated content) remains, pending TT-14. No deletion.
- **Citation resolution failures at answer time:**
  - Gateway citations always reference sealed-context refs (F-1 drops anything else).
  - The excerpt is taken from the in-context passage (already verified in this turn).
  - If `AnchorResolver` returns null (a purge or text change racing the turn), the citation keeps the excerpt with `anchor: null`, `sourceState: 'position_unavailable'`.
  - A citation is never fabricated, re-pointed, or silently dropped. A segment whose citations all fail is still shown with its origin label as validated by the Gateway.

### 9.5 Concurrency guard and reader protection (R-5, measured)

Measurement (2026-11-10, discovery report §5.4):
- `node:20-alpine` under `--cpus=1 --memory=512m`, modelling the E5 S2 work per turn (parallel fetch held in memory, SHA-256, strict decode, slicing), ~2M-code-point books.
- The production API image idles at 73–102 MiB under the same cap.

| In-flight turns | 10-book turn median | Event-loop lag p99 | Peak RSS (model) | 3-book turn median | Lag p99 |
|---|---|---|---|---|---|
| 1 | 230 ms | 85 ms | 96 MB | 72 ms | 56 ms |
| 2 | 416 ms | 169 ms | 128 MB | 117 ms | 65 ms |
| 3 | 606 ms | 280 ms | 167 MB | 168 ms | 96 ms |
| 4 | 791 ms | 353 ms | 206 MB | 241 ms | 128 ms |

**Findings:**
- **CPU on the single event loop is the binding constraint, not memory.**
- Two simultaneous 10-book retrievals are **not** safe for reader latency: about 170 ms stalls.
- Even one 10-book retrieval stalls other requests by about 85 ms.

**Requirement:**
- A per-process **weighted** limit on in-flight retrieval work: `Σ selectedBooks of in-flight turns ≤ W`.
- **Candidate `W = 10`** (one NoetiaX 10-book turn, or up to three Noetia+ 3-book turns). **Not accepted until it passes the acceptance test below.**
- Over the limit → `503` (`budget_unavailable` class, `Retry-After`), **before reservation** (no charge). No queueing. The guard covers history excerpt re-materialization too (Q-5).

**Acceptance (F-4, proposed):**
- **Reader endpoint p95 delta ≤ 50 ms** under **sustained permitted retrieval load** at W, against idle, on the **production API image** under `--cpus=1 --memory=512m`.
- Setup: disposable PostgreSQL / Redis / MinIO; fixture 10 books × ~2M code points.
- Measure the p95 of `GET /books` and of the reader text endpoint over ≥ 1,000 requests each, idle vs continuous turns at the guard limit.
- Delta per endpoint; raw output in the report.
- **If it fails:** reduce W and retest in order **10 → 6 → 3**, recording each result. The accepted W is the largest passing value; **no value is assumed to pass**.
- **If the accepted W < 10:** 10-book (NoetiaX) turns can never be admitted, which conflicts with PO-027. **Stop and escalate to PA + PO (Q-11); not an engineering decision.** The measured ~85 ms lag p99 for one 10-book retrieval makes this plausible.
- **If W = 3 fails:** stop condition.

Not addressed here (out of scope; recorded for later approval):
- reducing the per-book synchronous block (a NEM-023 code change);
- worker threads;
- a separate API container (an infrastructure change).

### 9.6 Checkpoints

The checkpoints are independently reviewable, A → E, as specified in the [PA final review package §7](../../reports/2026-11-10-E6-pa-final-review-package.md#7-implementation-sequence--independently-reviewable-checkpoints):

| Checkpoint | Content |
|---|---|
| A | Turn wiring + record |
| B | Resilience: cancel, recovery, history, guard |
| C | Transport (SSE) + capability probe |
| D | **Minimal web Q&A (required)** |
| E | Verification: reader latency, E-1 tables, E-2 coverage, report |

Each ends green and PA-reviewed before the next starts.

### 9.7 Other

- **Streaming:** no text event before the Gateway's validated `segment` (F-1/F-3). `stage` events carry no content.
- **Privacy:** no question or answer text in logs, metrics, or errors.

## 10. Security / privacy / copyright

[13](../../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md):
- authorization layers;
- threats;
- failure modes;
- cancellation and revocation matrices.

Excerpts only; no verbatim book text stored in `ai_turns`; no full-text export.

## 11. Acceptance criteria (proposed)

1. **Turn order and lock unchanged:** every NEM-019/NEM-022 turn test passes unchanged. Retrieval failures occur before reservation (no lock, no charge, no record).
2. **Grounding:** `library` segments cite only chunk refs retrieved for this turn from eligible selected books. Answer-time excerpts equal `codePointSlice(source, charStart, charEnd)` under the current hash.
3. **No user content (D-2 C):** no `highlight`/`note` items; no `fragments` or `sync_maps` access (unchanged NEM-019 tests pass; a new test asserts E6 adds no path).
4. **Durable completion:** `completed` only after the completion write commits. Settlement rows are created only by the Gateway/ledger (architecture test: no E6 writes to ledger tables).
5. **Idempotency:** concurrent same-key requests yield **one** attempt-1 reservation, **one** provider invocation (spy), and **one** `ai_turns` row. A replay after completion returns the stored result without a reservation. Each duplicate-table row in §9.2 has a test.
6. **Persistence failure:** a simulated completion-write failure after settlement → the server attempts to return the answer with `status: 'unrecorded'` (best effort; a test with a dropped response proves the answer is not recoverable and the charge stands, as documented); the ledger is unchanged by E6; a replay returns `result_unavailable` without a provider call; recovery marks the row `interrupted`.
7. **Cancellation:** each §9.3 row is proven, including that a disconnect does not abort (D-9). No partial text appears on cancel.
8. **Revocation and citations:** §9.4 is proven, including the **final eligibility check** (each authorization failing independently → no invoke, release, no charge, `failed`, `book_ineligible`; release-write failure → held; ordering test proving no awaited operation between check and invoke) and the other §9.4 cases (exclusion before generation; history redaction after revocation; `position_unavailable` on a resolution failure). No excerpt text is in `ai_turns` (schema/content test).
9. **Deletion:** session and account deletion cascade `ai_turns`; an in-flight completion after deletion is a no-op; the migration runs up and down by name; position-independent migration tests pass unchanged.
10. **Dark defaults:** the real module denies every turn (unbound ports); the flag off → no routes; there are no production adapters and no provider SDK.
11. **Concurrency guard:** a request over W is rejected before reservation. **Reader p95 delta ≤ 50 ms** at the accepted W (candidate 10; reduction 10 → 6 → 3 on failure; W < 10 → escalation, Q-11), measured on the production image under the cap.
11a. **Recovery races (F-5):** integration tests on real PostgreSQL, barrier-synchronised where needed:
    1. a renewing turn is never interrupted;
    2. a crash → `interrupted` within L + grace + interval;
    3. recovery vs completion → exactly one final state, and the owning completion may record after `interrupted`;
    4. recovery vs cancel → exactly one state;
    5. cancel vs completion → exactly one state;
    6. renewal stops at T_max;
    7. deletion during flight → no-op.

    The ledger is untouched by E6 in all of them.
12. **Performance (E-1 carried, not waived):** stage histograms; end-to-end turn latency with the simulator on the NEM-023 sized fixture (3 and 10 books). No ranking change, no cache.
13. **Coverage (E-2 carried, not waived):** new and changed code ≥ 80% branches; the global API branch figure does not decrease.
14. **Minimal web Q&A interface (required):**
    - **Simulated end to end:** one Playwright flow on the local simulated stack (ask → stages → answer with citations → open the excerpt → cancel → reload recovery).
    - **Unit coverage:** Jest component tests for each state in [14 §3](../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md#3-states).
    - **Accessibility:** a `role="log"` region with polite announcements without partial text; the dialog focus trap; labels not colour-only.
    - **i18n:** en/es parity (the web i18n test).
    - **Visibility:** hidden when the probe denies.
    - **E9 boundary:** no E9-scope screen is introduced (§5.1). Reader suites are unchanged.
15. **Regression:** all NEM-019/021/022/023 suites pass unchanged (except D-3-authorized amendments, each in its own commit, verified green first).

## 12. Required tests

- **Unit:** turn wiring and failure points; completion and replay state machine; duplicate table; cancel registry; recovery sweep; `TurnResult` v2 and history redaction; guard weighting; SSE serializer; DTOs.
- **Integration:** disposable PostgreSQL + Redis + object-store fixture:
  - eligibility → retrieval → Context Builder → Gateway → ledger → `ai_turns`;
  - concurrent duplicates (barrier);
  - persistence-failure injection;
  - each cancellation row;
  - revocation between turns and after storage;
  - account deletion during an in-flight turn;
  - migration up/down.
- **Architecture:** no `fragments`/`sync_maps` access; bindings unchanged; no E6 writes to ledger tables; no content logging; no SDK/HTTP client; the model-path registry unchanged.
- **Load measurement:** guard and reader latency on the production image under `--cpus=1 --memory=512m`.

## 13. Observability

Stage histograms, outcome counters, `intelligence_turn_unrecorded_total`, guard rejections, event-loop lag. No content labels. No dashboards while dark.

## 14. Deployment / rollout

None. Branch + Draft PR only. Launch prerequisites (separate authorizations): E3/E4 adapters, TT-22, TT-11/13/14 values, NEM-023 RB-1..RB-7 and E-1 evaluation, billing (E10), merge order.

## 15. Documentation deliverables

Technical-note §14 (E6), migration entry, runbook notes (replay, cancellation, recovery, guard), completion report with raw outputs, latency and reader-impact tables.

## 16. Open decisions

**D-1(a) approved (2026-11-10).** All others are open (baselines proposed; packet §1; PA questions Q-4 to Q-13 in the review package (Q-1 to Q-3 closed or superseded)). Launch-time items (packet §3) are not required for this mission.

## 17. Stop conditions

- Any change to a protected item beyond the authorized D-3 items, or any other NEM-019/021/022/023 test needing change.
- Any need to read `fragments` or `sync_maps` (D-2 C).
- A real or paid provider, embeddings, pgvector, a cache, new infrastructure, staging/production access, or production credentials appearing necessary.
- The turn order, lock semantics, ledger authority, or Gateway streaming contract needing change.
- Exactly-once behaviour being claimed without the §9.2 constraints and tests.
- Reader p95 delta > 50 ms at W = 3 (no in-scope remedy), or an accepted W < 10 (product conflict with PO-027; escalate, Q-11).
- An undecided TT item needing to be assumed.

## 18. Completion report

Per the README standard: raw test output; latency, guard, and reader-impact tables; coverage (E-2); deviations; protected-systems confirmation.

## 19. Product Architecture review

`REVIEW-CHECKLIST.md`. Completion requires PA review and PO acceptance.
