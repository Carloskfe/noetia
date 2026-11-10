# NOETIA ENGINEERING MISSION — NEM-0XX (proposed NEM-024) (E6)
## Research-Turn Orchestration and Minimal Q&A Experience (dark, simulated provider only)

**Status:** DRAFT — **never executable** (`DRAFT/`). Prepared under PO *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). It becomes executable only after the PO decides the [decision packet](../../reports/2026-11-10-E6-product-owner-decision-packet.md), the PA reviews this specification, the PO approves it, and the PO gives an explicit execution instruction naming the mission.
**Identifier:** pending (D-5). NEM-024 verified unused on 2026-11-10; not reserved.
**Mission type:** IMPLEMENTATION (proposed)
**Implementation authorization:** NONE
**Schema changes:** ADDITIVE ONLY (proposed): one table, `ai_turns`; disposable test databases only
**Infrastructure changes:** NOT AUTHORIZED (none needed)
**Production deployment:** NOT AUTHORIZED (staging and merge to `main` also not authorized)
**Product Owner approval:** REQUIRED

> **Written assuming the recommended packet options:** D-1(a), D-2 A, D-3 (1)–(6) with direct injection, D-4(a), D-6(a), D-7(a). Sections that change under other options are marked **[D-x]**. Prerequisite **B-A**: NEM-022 acceptance recorded.

---

## 1. Context

The control plane (NEM-019), contract and cost ledger (NEM-021), Gateway v2 (NEM-022), and lexical retrieval (NEM-023) exist as **dark, unmerged** components. The research turn runs end to end only with fixture context. There is:
- no question input;
- no retrieval wiring;
- no persisted conversation;
- no citation detail in the response;
- no streaming transport;
- no UI.

Evidence: [discovery report](../../reports/2026-11-10-E6-turn-orchestration-discovery-report.md), [11](../../architecture/three-tier-intelligence/11-e6-turn-lifecycle-and-boundaries.md)–[14](../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md).

## 2. Objective

A user with a (fixture) eligible tier, in a session with eligible books, asks a question. The turn:
1. retrieves passages from the selected eligible books (and, with D-2 A, their own highlights and notes on those books);
2. passes the unchanged Context Builder invariant;
3. is answered through the accepted Gateway v2 + simulator;
4. returns validated segments with origin labels and **resolvable citations**;
5. is persisted, replay-safe, and viewable in a minimal web screen.

All of this runs dark, with default deny everywhere in the real module.

**Done** = every §11 criterion proven on disposable databases with fixture texts and simulated providers.

## 3. Dependencies

- **B-A:** NEM-022 acceptance recorded (currently "returned for re-review").
- Code: NEM-019, NEM-021, NEM-022, NEM-023 branch stack (not `main`).
- Decisions: D-1 to D-7 (packet).
- Not required: E3/E4 production adapters (fixture ports, D-7); paid providers; staging; CI changes.
- Test environment: local disposable PostgreSQL 16 / Redis / MinIO-compatible fixture; VM limits (`--maxWorkers=2`).

## 4. Source-of-truth references

ADR-003, ADR-005, ADR-006 · PO-026, PO-027, PO-028, PO-033 · NEM-019 technical note §1–§13 · NEM-022 F-1/F-3 · NEM-023 Amendment 1 and acceptance record (E-1, E-2) · three-tier 11–14.

## 5. In scope

1. **Turn input:** `TurnDto.question` (NFC, trimmed, 1–500 code points; matching E5 validation). The client `idempotencyKey` is unchanged. **[D-3]**
2. **Retrieval wiring:** inside the existing step 2 (after per-book eligibility, before reservation), `TurnService` calls `QueryContextSource.resolve(userId, eligible, question, {topK, budgetTokens})`. Direct injection; `CONTEXT_SOURCE_PORT` stays `EmptyContextSource`, and its candidates are still merged (always empty). **[D-3]**
3. **My Knowledge in session [D-2 A]:** `knowledge/user-content/user-highlight-source.ts`:
   - one capped `SELECT` of the requester's `fragments` rows for the eligible selected books;
   - items `highlight` (text) and `note` (note) with `userId`;
   - the architecture-test exception is exactly as approved.
   - **Under D-2 C this item is removed.**
4. **Context budget allocator:** total context budget = passages + user content (proposed defaults: 6,000 + 1,500 tokens; engineering configuration, PA-reviewed). Applied before `prepare`, using the conservative estimate (`ceil(bytes/3)`).
5. **Turn persistence:**
   - additive migration `ai_turns`: session FK CASCADE, `turnIndex`, `keyHash` unique per session, `question`, `segments` (jsonb: validated segments + citations), `exclusions`, `outcome` (`completed` / `failed` / `cancelled`), `settlement`, `createdAt`;
   - no provider or model names.
6. **Replay:** the same client key on the same session returns the stored turn (200), with no new reservation. A key still in flight returns `duplicate_turn` (409).
7. **`TurnResult` v2:** `turnId`, `segments[] {origin, text, citations[] {ref, kind, bookId, anchor, excerpt}}`, `exclusions {ineligible, unindexed, stale, unavailable, indexNotPermitted}`, `settlement`.
   - `excerpt` is the verified passage text that was in context (chunks) or the user's own text (highlights/notes).
   - `anchor` comes from `AnchorResolver`.
8. **Routes (all `JwtAuthGuard` + declared capability):**
   - `GET /knowledge/sessions/:id/turns` (history);
   - `POST /knowledge/sessions/:id/turns/stream` (SSE body; events `stage`, Gateway `segment`/`delta` after validation, `terminal`);
   - `GET /knowledge/me` (tier, capabilities, limits; **no budget values**).
   - Request close → `AbortSignal` to the Gateway.
9. **Module registration:**
   - E5 providers registered in `KnowledgeModule`: `IndexingPermission`, `LexicalRetrievalService`, `QueryContextSource`, `AnchorResolver`, plus `StorageBookText` via the existing `StorageModule`;
   - text-identity/authority ports stay **unbound** (deny);
   - `app.module.ts` unchanged.
10. **Metrics (no content labels):** turn stage duration histograms (`entitlement`, `eligibility`, `retrieval`, `user_content`, `prepare`, `lock`, `provider`, `persist`), outcomes, replay count, cancellations.
11. **Web MVP [D-1 a]:**
    - `/research/[sessionId]` screen per [14](../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md) §2–§6: book chips with lock and exclusions, conversation, origin labels, citation chips + excerpt dialog + "Open book" (link only), stage states, cancel, errors mapped from `code`;
    - en/es strings (web parity test);
    - hidden unless `GET /knowledge/me` succeeds.
12. **Tests, technical-note section, migration entry, completion report.**

## 6. Out of scope

- Ask My Highlights (E6b, after TT-27) · highlight search · Research Brief (E7) · NoetiaX depth (E8) · remaining UI (E9) · mobile (D-6) · Expand/`broader` (TT-18).
- Conversation memory in model context (D-4 b).
- Reconstruction thresholds enforcement (TT-13); optional span recording only if the PA asks for it.
- Production adapters (E3, E4, ownership) · real or paid providers (TT-22) · embeddings, pgvector, caches · ranking changes (E-1 stays open) · reader changes or exact deep links (`sync_maps`) · `fragments`/`sync_maps` schema · staging, CI/CD, infrastructure, merge, deployment.

## 7. Product rules

- Book passages are the only `library` evidence.
- Highlights and notes are `user_content` and **never** book evidence.
- Exclusions are disclosed as facts.
- No model or provider names; `BOOK TOKEN ≠ AI USAGE`.
- Private to the account; no household sharing (PO-026 rule 6).
- The locked set changes only by fork (PO-027).

## 8. Protected systems

- Reader, Escucha Activa, ownership, `user_books`, tokens, Stripe, subscriptions, production data.
- `fragments` and `sync_maps`: schema unchanged. `fragments` is read only through the D-2 route.
- NEM-019:
  - the turn order and lock;
  - the Context Builder invariant;
  - default deny;
  - **port bindings, including `CONTEXT_SOURCE_PORT → EmptyContextSource` and `TEXT_IDENTITY_PORT → UnboundTextIdentityPort`**.
- NEM-021 frozen contract v1 and ledger.
- NEM-022:
  - the Gateway;
  - the fail-closed per-attempt streaming;
  - the citation policy.
- NEM-023 retrieval behaviour.
- `app.module.ts`.
- Only the D-3 items may change, exactly as authorized.

## 9. Technical requirements

- **Turn order unchanged:** [1] entitlement → [2] set + eligibility + retrieval + user content + Context Builder → [3] prepare/reserve → [4] lock transaction → [5] provider outside any transaction → [6] per-attempt settlement → persist.
- Retrieval or user-content failure **before** reservation → `turn_failed` with no lock and no charge.
- Persistence after a successful answer must not fail the response; a persistence failure is a content-free event (documented gap in replay).
- Streaming: no text event before the Gateway's validated `segment` (F-1/F-3). `stage` events carry no content.
- Privacy: no question, highlight, note, or answer text in logs, metrics, or errors.
- **Concurrency guard (reader priority, CLAUDE.md product hierarchy):** a per-process cap on concurrent turn retrievals (proposed 2; configuration), so S2 hashing and slicing on the 1-vCPU / 512 MB API container cannot starve reader requests. Over the cap → `budget_unavailable`-class 503 with retry-after. Value PA-reviewed.

## 10. Security / privacy / copyright

See [13](../../architecture/three-tier-intelligence/13-e6-security-rights-and-failure-modes.md):
- authorization layers;
- trust rules for highlights;
- threats (prompt injection, extraction, fabricated quotations, cross-user);
- the failure-mode table.

Excerpts only; no full-text export; private storage only.

## 11. Acceptance criteria (proposed)

1. **Turn order and lock unchanged:** every NEM-019/NEM-022 turn test passes unchanged; new tests prove retrieval and user-content failures happen before reservation (no lock, no charge).
2. **Grounding:** `library` segments cite only chunk refs retrieved for this turn from eligible selected books. Each citation's `excerpt` equals `codePointSlice(source, charStart, charEnd)` under the current hash, and `anchor` resolves.
3. **User content [D-2 A]:**
   - only the requester's rows, only for eligible selected books, capped;
   - always `user_content`, never `library`;
   - another user's or household member's rows are never included (adversarial tests).
   - The architecture exception test passes; no other `fragments` access exists.
4. **Rights per turn:** a book revoked between turns is excluded and disclosed; with no eligible book → `no_eligible_books` with no charge. Index-permission revocation → `indexNotPermitted`.
5. **Replay and idempotency:** the same key returns the stored turn with no second reservation; concurrent duplicates produce one turn and one reservation.
6. **Streaming:** no `delta`/`segment` before validation and settlement. Client abort → `client_abort` held, the turn persisted as `cancelled`, no partial text. SSE `stage` events contain no content.
7. **Budgets:** the context allocator keeps passage + user-content tokens ≤ the configured budget. NEM-021 reservations are bounded accordingly; `budget_exhausted` and `budget_unavailable` deny before any provider call.
8. **Persistence and deletion:** `ai_turns` cascades on session and user deletion (the existing `deleteAccount` path is unchanged); the migration runs up and down by name; position-independent NEM-019/021 migration tests pass unchanged.
9. **Dark defaults:**
   - with the real module bindings, every turn is denied (unbound ports);
   - the flag off → no routes;
   - architecture tests prove there are no production adapters and no provider SDK.
10. **Web MVP [D-1 a]:**
    - simulated end-to-end flow (Jest + Playwright on the local stack);
    - accessibility checks (log region, dialog focus, labels not colour-only);
    - en/es parity;
    - reader suites unchanged with the flag on and off.
11. **Performance (E-1 carried, not waived):**
    - stage histograms recorded;
    - the report gives end-to-end turn latency with the simulator on the NEM-023 sized fixture (3 and 10 books), excluding and including the provider stage;
    - the concurrency guard is proven.
    - No ranking change, no cache.
12. **Coverage (E-2 carried, not waived):** new and changed code ≥ 80% branches; the global API branch figure does not decrease. E-2 stays open unless separately decided.
13. **Regression:** all NEM-019, NEM-021, NEM-022, NEM-023 unit and integration suites pass unchanged (except the D-2/D-3-authorized amendments, each in its own commit, verified green first). Only local disposable services are used.

## 12. Required tests

- **Unit:** turn wiring (order, failure points), allocator, user-content source (with mocks), persistence and replay, `TurnResult` v2 mapping, SSE serializer, metrics, controller DTO validation.
- **Integration:** disposable PostgreSQL + Redis + object-store fixture; eligibility → retrieval → Context Builder → Gateway → ledger → `ai_turns`; revocation between turns; replay and concurrency; abort; migration up/down; cascade.
- **Architecture:** D-2 exception exactness; no new path to `fragments`; bindings unchanged; no content logging; no SDK/HTTP client; the model-path registry.
- **Web:** component tests + one Playwright flow against the simulated stack.

## 13. Observability

Stage histograms and outcome counters (no content labels). No dashboards while dark.

## 14. Deployment / rollout

None. Branch + Draft PR only. Launch prerequisites (separate authorizations): E3/E4 adapters, TT-22, TT-11/13/14 values, NEM-023 RB-1..RB-7 and E-1 evaluation, billing (E10), merge order of the stack.

## 15. Documentation deliverables

Technical-note §14 (E6), migration entry, runbook notes (replay, cancellation, concurrency guard), completion report with raw outputs and latency tables.

## 16. Open decisions

D-1 to D-7 (packet §1). Launch-time items (packet §3) are not required for this mission.

## 17. Stop conditions

- Any change to a protected item beyond the authorized D-2/D-3 items, or any other NEM-019/021/022/023 test needing change.
- A real or paid provider, embeddings, pgvector, a cache, new infrastructure, staging/production access, or production credentials appearing necessary.
- The turn order or lock semantics needing change.
- Streaming requiring release of unvalidated text.
- User content requiring anything beyond the requester's own rows on eligible selected books.
- Retrieval needing ranking changes to meet a criterion.
- An undecided TT item needing to be assumed.

## 18. Completion report

Per the README standard: raw test output; latency tables (E-1 context); coverage (E-2 context); deviations; protected-systems confirmation.

## 19. Product Architecture review

`REVIEW-CHECKLIST.md`. Completion requires PA review and PO acceptance.
