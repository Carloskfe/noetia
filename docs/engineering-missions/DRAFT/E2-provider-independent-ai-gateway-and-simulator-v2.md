# NOETIA ENGINEERING MISSION — E2 (proposed identifier NEM-022)
## Provider-Independent AI Gateway and Simulator v2

**Status:** DRAFT — drafted under [PO-031](../../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md) (drafting only). **Not approved. Not authorized for execution.**
**Proposed identifier:** `NEM-022`, verified unused on 2026-11-09. **Not reserved.**
**Mission type:** IMPLEMENTATION
**Implementation authorization:** LIMITED to §5 — *proposed*; active only after PO approval **and** a separate explicit execution instruction
**Schema changes:** NOT AUTHORIZED (E2 needs none; if a schema need appears it is a stop condition)
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED (staging also NOT AUTHORIZED; merge to `main` NOT AUTHORIZED)
**Product Owner approval:** REQUIRED

> **No live-provider connection of any kind is permitted in this mission:** no SDK, credential, endpoint, or network call. The router refuses every non-simulated provider.

> **Revision 2 (2026-11-09):** aligned with E1 Revision 2:
> - errors and outcomes use the single shared model in E1 §9.3 (F-3);
> - all pricing and rounding comes only from E1's contract functions (F-2);
> - end-to-end criteria assert E1's admission invariant and overrun rules, not an absolute dollar ceiling (F-1).

---

## 1. Context
NEM-019 has a minimal Gateway (`ai/model-gateway.service.ts`), a simulated-only router, a sealed-context type, a model-path registry, and a simple simulator. E1 freezes **shared provider contract v1** (capability descriptors, normalized usage, pricing) and a cost-aware, per-attempt ledger. E2 rebuilds the Gateway and simulator **on that contract**, so that a future provider adapter is the only provider-specific code written at the launch-readiness gate (P0 packet §A5).

## 2. Objective
A provider-independent Gateway with:
- capability negotiation;
- normalized requests, responses, errors, streaming, and structured output;
- validated citations;
- a deterministic simulator v2 that emulates provider behaviour (token accounting, caching, tiers, refusals, rate limits, timeouts);
- a reusable **provider contract test suite**;
- end-to-end settlement through the E1 ledger.

All of it dark by default and proven by tests.

## 3. Dependencies
- **E1 accepted**, with contract v1 frozen. E2 consumes v1 and may only extend it **additively** (v1.x), re-running E1's suites (P0 §A4.1).
- NEM-019 (accepted). PO approval of this specification and a separate execution instruction.
- **Not required:** any TT decision, PO-005, credentials, staging, CI change.
- **Test environment:** local VM and disposable containers (E1 ledger integration); no shared environment.

## 4. Source-of-truth references
ADR-001 (provider abstraction, routing, no model promise) · ADR-002 (rights, reconstruction safeguards) · ADR-003 (source modes, origins) · ADR-005 · ADR-006 (turn order, Context Builder invariant, trust boundary, origins, model-path invariants) · PO-026…028, PO-030, PO-031 · NEM-019 · E1 (contract v1) · P0 packet §A1, §A3.4, §A4.1, §A6.

## 5. In scope
Only under `services/api/src/knowledge/ai/` (plus tests):
1. **Gateway on contract v1:** `GatewayRequest` (model-path id, sealed context, instruction template id, required capabilities, output mode, `maxOutputTokens`, cache intent, attempt key) and `GatewayResponse` (segments with origin labels, citations, normalized usage record, outcome, stop reason, refusal category). No free-form prompt assembly outside templates bound to model paths.
2. **Capability negotiation:**
   - the router selects a registered **simulated** provider and model whose descriptor satisfies the request's required capabilities and context size;
   - if none does, the attempt ends with error `capability_unavailable` and outcome `not_sent` (E1 §9.3) **before** any reservation;
   - requests whose counted input exceeds the descriptor's context limit end with `context_too_large` **before** reservation;
   - the router allowlist still admits only simulated providers.
3. **Error normalization and retry policy (shared model, E1 §9.3):**
   - every provider or simulator result maps to exactly one row of the E1 §9.3 table: `error` category (`rate_limited`, `timeout`, `refusal`, `invalid_request`, `context_too_large`, `provider_unavailable`, `malformed_output`, `client_abort`, `internal`, `capability_unavailable`) → `outcome` → `usageCompleteness` → retryability;
   - E2 defines **no** additional categories or outcomes; additions go into contract v1.x with a new table row;
   - retries follow the table only (`rate_limited` after retry-after, `timeout`, `provider_unavailable`), are bounded and configurable, and **each attempt reserves and settles separately** through E1's per-attempt API;
   - the ledger action comes from E1's `ledgerActionFor`; the Gateway never decides release or hold itself;
   - HTTP/denial mapping for callers is a separate presentation layer over `error`.
4. **Streaming contract:**
   - an async stream of events (segment delta, citation, usage-final, terminal outcome);
   - client abort propagates to the provider;
   - settlement happens on terminal events;
   - a client abort yields `error: client_abort`, `outcome: aborted`, and `partial` or `unknown` usage, which E1 holds at the reserved amount.
5. **Structured-output contract:** JSON-schema-validated outputs. An invalid output yields `outcome: completed`, `error: malformed_output`, and `complete` usage, which is settled; no unvalidated object reaches callers.
6. **Citation and source-reference handling:**
   - citations reference context item refs and anchors from the sealed context only;
   - any citation outside the allowed set is a **scope violation** (segments dropped, metric, existing rules);
   - a `library` segment must carry a valid citation or be relabelled per the origin rules;
   - user content is never attributed to a book (ADR-006 trust boundary).
7. **Simulator v2 (deterministic):**
   - scripted by seed and fixture;
   - deterministic token counting (a documented approximation, flagged `estimated`);
   - prompt-prefix caching (hash plus lifetime, write versus read classes);
   - whole-request tier behaviour driven by E1 pricing fixtures;
   - refusals by category;
   - HTTP-429-style rate limits with retry-after;
   - timeouts, partial streams, malformed structured output, citation errors;
   - emits contract-v1 usage records only.
8. **Provider contract test suite:** `runProviderContract(adapterFactory)`, a reusable harness any future adapter must pass. It covers:
   - capabilities;
   - **every row of the E1 §9.3 outcome table** (error → outcome → completeness);
   - streaming termination;
   - structured output;
   - citation refs;
   - cache accounting;
   - abort;
   - idempotent attempt keys;
   - **usage records that price identically through E1's `priceUsage` golden vectors**.

   Run now against simulator v2.
9. **End-to-end settlement:**
   - negotiation → token count → E1 `worstCaseCost` reservation → simulated call → normalized usage → E1 settlement;
   - covers the success, retry, refusal, timeout, abort, and partial-stream paths;
   - the global allowance and per-user units hold under concurrency.
10. **Turn-stub integration:** NEM-019's `TurnService` uses the new Gateway without changing the turn order or the Context Builder invariant. The model-path registry requires a declared invariant and a proving test for every path (B-3).
11. **Dark-by-default and security tests:**
    - flag off: the module is not loaded and no route exists;
    - no SDK, HTTP client, or credential read in `knowledge/*`;
    - router refusal of non-simulated providers;
    - book text cannot override system instructions (template-delimited context, with fixtures containing instruction-like text);
    - no content in logs or metrics.
12. Technical-note update and completion report.

## 6. Out of scope
- **Any real provider adapter, SDK, credential, endpoint, or network call.** Written only at the launch-readiness gate.
- Retrieval, chunking, embeddings, pgvector (E5); sessions, conversations, Ask My Highlights, Briefs (E6, E7); NoetiaX depth (E8); any frontend (E9).
- Product decisions: model choice, web access for Expand (TT-18 open; no web-search capability is implemented), export formats, capacity UI, prices or budget values.
- Schema changes; CI/CD; infrastructure; staging; merges; deployments.
- Changing E1's contract incompatibly (stop condition).

## 7. Product rules
- No model or provider name in any customer-visible response or error message; "Basic" never appears.
- Origins: `library`, `synthesis`, `broader`, `user_content` (ADR-006). `broader` means model knowledge only; there is no web capability.
- `BOOK TOKEN ≠ AI USAGE`.

## 8. Protected systems
Reader, Escucha Activa, sync, ownership, `user_books`, `fragments`, tokens, Stripe, subscriptions, production data. NEM-019 and E1 guarantees (B-1, B-2, B-5, B-6, F-12, dark registration, the turn order, the Context Builder invariant). `app.module.ts` is unchanged.

## 9. Technical requirements
- All types, outcome and error categories, and **all monetary arithmetic** come from contract v1 (E1 §9.2, §9.3). An architecture test fails on a duplicate definition or on any pricing or rounding code outside the contract module.
- The Gateway never calls a provider without a confirmed reservation for that attempt.
- Timeouts and abort through `AbortController`; no provider call inside a database transaction.
- Deterministic simulator: the same seed, fixture, and request produce identical outputs and usage.
- Contract suite runnable in isolation (no database), plus an integration variant through the E1 ledger.

## 10. Security / privacy / copyright
- Sealed context only.
- Citations validated against the allowed set (ADR-006).
- Reconstruction safeguards remain the caller's responsibility (F-2 is E6); E2 exposes the counts that E6 needs.
- No content in logs, metrics, fixtures beyond invented text, or usage records.
- Injection fixtures use invented text.

## 11. Acceptance criteria
1. Capability negotiation selects only descriptors that satisfy the request, and denies with `capability_unavailable` before any reservation when none does.
2. Every simulator and provider error maps to exactly one E1 §9.3 row. Retries occur only for retryable rows, each as a new reserved attempt; retry-after is honoured. `context_too_large` and `capability_unavailable` are caught before any reservation. Release happens only on `zero_confirmed`.
3. Streaming: deltas, citations, and the final usage arrive in order; abort cancels the simulated call and yields `client_abort` / `aborted`, with partial or unknown usage held by the ledger.
4. Structured output: valid objects pass; invalid ones yield `completed` + `malformed_output`, with usage settled; callers never receive unvalidated objects.
5. A citation outside the sealed allowed set triggers the scope-violation path; a `library` segment without a valid citation is never returned as `library`.
6. Simulator v2 reproduces fixture-defined cache writes and reads, whole-request tier repricing (via E1 fixtures), refusals, 429s, timeouts, and malformed output, deterministically.
7. `runProviderContract(simulatorV2)` passes; a deliberately broken adapter fixture fails the suite (self-test).
8. **End-to-end, through the E1 ledger (real PostgreSQL), across success, retry, refusal, timeout, abort, and partial-stream paths:**
   - E1's **admission invariant** holds at every admission under concurrent distinct users;
   - when simulated actual usage stays within reservations, final settled + held ≤ allowance;
   - with an injected under-priced schema, the overrun is recorded exactly, the breaker opens, and later admissions on that schema are denied.
9. The NEM-019 turn order and Context Builder tests pass unchanged; every model path still declares an invariant with a proving test.
10. Dark: flag off means no module and no route; architecture tests show no SDK, HTTP client, or credential access and no non-simulated provider in the router.
11. All NEM-019 and E1 suites pass unchanged.

## 12. Required tests
Unit (≥ 80%): Gateway, negotiation, error mapping, streaming, structured output, citations, simulator v2. Contract suite (no database). Integration through the E1 ledger (disposable PostgreSQL and Redis). Architecture and security tests. Regression of all NEM-019 and E1 suites. Raw output in the completion report.

## 13. Observability
Existing intelligence counters plus `intelligence_gateway_outcome_total{outcome}`, `intelligence_gateway_retry_total`, `intelligence_capability_unavailable_total`. No content labels; no dashboards while dark.

## 14. Deployment / rollout
None. Branch and Draft PR only.

## 15. Documentation deliverables
A technical-note section (Gateway v2, simulator v2, contract suite usage for future adapters); a completion report; a list of contract v1.x additions, if any.

## 16. Open decisions
**None blocks execution.** TT-18 (no web capability built), PO-005 (no adapter), TT-09/TT-11 values (E1 fixtures), and identifier reservation (`NEM-022`, needed before approval).

## 17. Stop conditions
STOP and mark BLOCKED if any of the following arise:
- an incompatible change to contract v1 seems necessary;
- a schema change is needed;
- any network, SDK, or credential appears necessary;
- a NEM-019 or E1 test must change to pass;
- the turn order or Context Builder invariant would have to change;
- a product decision (TT-18, model choice) would need to be assumed.

## 18. Completion report
Per the README standard; includes the contract-suite results for simulator v2 and the documented procedure a future adapter follows.

## 19. Product Architecture review
`REVIEW-CHECKLIST.md`. Completion requires review and PO acceptance.
