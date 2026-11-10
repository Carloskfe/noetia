# E6 — Turn Orchestration and User Experience: Architecture Discovery Report

**Status:** DRAFT — **documentation-only discovery**. PO authorization: *"E6 Turn Orchestration Discovery — documentation-only"* (2026-11-10). **Authorizes no implementation.**
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
| **NEM-022** | **"PA re-review F-3 addressed — returned for re-review" (2026-11-09); no acceptance record** in the repository. Gateway v2 (`ai-gateway.service.ts`), simulator v2, provider contract suite. Draft PR #51 |
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
2. set + per-book eligibility + **retrieval** + **own highlights (D-2)** + Context Builder;
3. Gateway prepare/reserve;
4. lock transaction;
5. provider call;
6. per-attempt settlement;
7. **persist** + respond.

| Implemented (dark, unmerged) | Missing |
|---|---|
| Entitlement, prerequisite port, limits, lock, fork, read-only; user eligibility; Context Builder; Gateway prepare/invoke/stream/release; citation policy; per-attempt cost ledger, reconciliation; E5 retrieval, index permission, anchors | Question input; retrieval wiring; user-content source; context budget allocator; turn persistence and replay; `TurnResult` v2 with citations; history, stream, and `me` routes; abort propagation; stage metrics; any UI |

Production adapters for qualifying plan (E4), text identity and verification authority (E3), and ownership are absent. With them unbound, the real module denies everything. E6 can be built dark on fixture ports (D-7).

## 3. User knowledge (summary of 13 §3)

- E5 retrieves book passages only.
- `fragments` holds user assertions (text is client-supplied and editable). Accepted NEM-019 tests forbid any `knowledge/*` access to `fragments`.
- **Every route needs an explicit exception** (D-2).

**Recommended (D-2 A):** one named `SELECT` of the requester's own rows on eligible selected books, asserted by test. Highlights and notes enter as `highlight`/`note` items under the existing Context Builder owner check. The Gateway keeps them `user_content`, **never book evidence**.

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
| Highlights (D-2 A) | One capped indexed query (`fragments` by user/book) | ≈ 5–20 ms (not measured) |
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

### 5.4 Concurrency, memory, CPU (existing resources only)

- **Memory:** an S2 retrieval holds each result book's bytes plus the decoded string, roughly 3 × the object size transiently. For 2 MB objects that is ≈ 6 MB per book, so ≈ 60 MB for a 10-book turn. On the 512 MB API container (Node baseline ≈ 150–250 MB), a handful of concurrent 10-book turns approaches the limit.
- **CPU:** hashing, decoding, and code-point slicing are synchronous, ≈ 10–20 ms per book, ≈ 100–200 ms per 10-book turn **on the event loop of a 1-vCPU container shared with the reader API**. Under load this delays reader requests, which conflicts with **product hierarchy #1 (reader first)**.
- **Mitigation without new infrastructure** (proposed in the DRAFT §9): a per-process cap on concurrent turn retrievals (default 2, PA-reviewed). Over the cap → 503 with retry-after. Measure it under the E6 integration load test. Worker threads or a separate API container are larger changes; the latter is an infrastructure change, not proposed.
- **Database:** turns add short transactions; ranking is the expensive statement (E-1). There is no new connection pool (NEM-019 deferred that to a retrieval mission; still not needed at pilot scale, to be revisited with measurements).

### 5.5 Cost

- No paid provider: simulator only (TT-22 blocks real data reaching providers).
- No embeddings, pgvector, caches, or new services.
- Storage: `ai_turns` holds questions and validated answers; size is linear in turns, a few KB per turn.
- Operational complexity: no new jobs. The existing 60 s reconciliation covers held attempts, including cancelled turns.

## 6. Architectural risks and blockers

| ID | Type | Description | Mitigation / owner |
|---|---|---|---|
| **B-A** | Blocker | NEM-022 acceptance is not recorded; E6 depends on its behaviour | Record the PA re-review outcome and PO acceptance first |
| **B-B** | Blocker (decision) | Highlights cannot be read without an exception to accepted NEM-019 tests | D-2 (A recommended; C = defer) |
| **B-C** | Blocker (decision) | The turn input, response, port wiring, and routes are accepted dark surfaces | D-3 explicit authorization; direct injection keeps the pinned port binding unchanged |
| R-1 | High | E-1 latency inside preflight, plus per-attempt streaming, gives a slow time-to-answer for large sessions | Measure; stage UI; no workaround (no cache or cap per the PA) |
| **R-2** | High (E3 design) | If E3's `TextIdentityPort` hashes the full MinIO object on every call, each book is fetched and hashed **up to three times per turn**: user eligibility, index permission, and S2 retrieval. That multiplies E-1's S2 cost | E3 should derive the hash once per text version (e.g. at upload or ingestion, with a verified re-check), not per call. **Record as an E3 design requirement** |
| R-3 | High | Reader starvation on the shared 1-vCPU / 512 MB API process | Concurrency guard (DRAFT §9); measurement |
| R-4 | Medium | `websearch` AND semantics produce "no passages" for long natural questions | Disclosure copy + input hint. Query rewriting (`or`) would be a retrieval behaviour change and needs its own approval |
| R-5 | Medium | P0 packet scope (E6 backend, E9 UI) vs this instruction (E6 + UX) | D-1 |
| R-6 | Medium | Revoked-book excerpts persisted in `ai_turns` | Render-time "source unavailable"; TT-14 before launch |
| R-7 | Medium | Cancelled or failed provider attempts stay **held** at the reserved amount until reconciliation, so users may briefly see reduced capacity | Disclose in the UI; existing reconciliation |
| R-8 | Low | Persistence failure after an answer breaks replay for that key | Content-free event; documented |
| R-9 | Low | The dev nginx proxy may buffer SSE | `X-Accel-Buffering: no` response header (no infrastructure change); Traefik streams |

## 7. Product Owner decisions required (packet)

| ID | Decision |
|---|---|
| D-1 | E6 scope: backend + minimal web screen; AMH later (E6b); full UI in E9 — **recommended (a)** |
| D-2 | Highlight read route (PA + PO exception) — **recommended A** |
| D-3 | Authorize the accepted-surface amendments: question, wiring, `TurnResult` v2, routes, providers — **recommended, with direct injection** |
| D-4 | Stateless turns for the MVP — **recommended (a)** |
| D-5 | Reserve NEM-024 |
| D-6 | Web first (TT-20) — **recommended (a)** |
| D-7 | Build dark on fixture ports before E3/E4 — **recommended (a)** |

Launch-time items (TT-10/11/13/14/18/19/22/25/27) are listed in the packet §3 and are **not** required before implementation.

## 8. Recommended implementation sequence (after decisions and approval)

0. Record NEM-022 acceptance (B-A); the PO decides D-1 to D-7; PA review → PO approval of the mission.
1. **Checkpoint A — backend wiring:**
   - any D-2/D-3-authorized test amendments, each in its own commit, verified green first;
   - question input; retrieval wiring by direct injection; user-content source (D-2 A); allocator;
   - `ai_turns` migration + persistence + replay;
   - `TurnResult` v2 with citations and exclusions.
2. **Checkpoint B — transport and resilience:** SSE stream endpoint (per-attempt events + `stage`), abort propagation, `GET …/turns`, `GET /knowledge/me`, concurrency guard, stage metrics.
3. **Checkpoint C — web MVP:** research screen, citation dialog, states, en/es, accessibility; a Playwright flow on the simulated stack.
4. **Checkpoint D — verification:** integration (revocation between turns, replay, concurrency, abort, cascade), latency tables for 3/10 books (E-1 context), coverage (E-2 context), completion report.
5. Later and separate: **E6b** Ask My Highlights (after TT-27), E3/E4 adapters (with the R-2 requirement), E7 Brief, E9 breadth, mobile (after TT-20).

## 9. Conflicts with accepted architecture (documented, not changed)

| Conflict | Accepted item | Options (packet) |
|---|---|---|
| Reading highlights from `knowledge/` | NEM-019 AC-10/17, AC-16/17 | D-2 A / B / C |
| Turn needs the question and citations | NEM-019 `TurnDto`, `TurnResult`, `TurnService` | D-3 |
| Retrieval via `ContextSourcePort` | NEM-019 port signature + F-12 binding test | D-3 (5): direct injection (no binding change) vs port extension |
| "Streaming" UX expectation | NEM-022 F-1/F-3 per-attempt release | Keep; stage UI. Any token-level streaming needs a separate PA decision on F-1 |
| UI ownership | P0 packet E9 | D-1 |

## 10. Restrictions honoured

Documentation only. No application code, tests, migrations, CI/CD, or infrastructure changed. No production data or credentials. No provider. No E6 implementation. No accepted contract modified. No open PO decision resolved by assumption. No existing PR or branch altered.

**STOP for independent Product Architecture review before any implementation authorization.**
