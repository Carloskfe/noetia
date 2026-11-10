# 13 — E6 Security, Rights, and Failure-Mode Assessment (DISCOVERY, DRAFT)

**Status:** DRAFT, documentation-only. No protected system is changed by this document. Conflicts with accepted architecture are recorded with options and are not resolved here.

## 1. Authorization layers per turn (all must pass; most restrictive wins)

| Layer | Question | Enforced by | Default |
|---|---|---|---|
| Authentication | Who is asking? | `JwtAuthGuard` | Reject |
| Module flag | Is intelligence enabled at all? | `KNOWLEDGE_MODULE_ENABLED === 'true'` | Off: no routes exist |
| Entitlement and prerequisite | Does the user hold the tier, with an active book plan (PO-026)? | `EntitlementService` + `QualifyingPlanPort` | `unknown` → deny |
| Capability | Is `research_session` in the tier and flagged on? | `CapabilityGuard` + policy | Deny |
| Session | Is it the user's session, active, and within the tier limit? | `TurnService` step 2 | Deny |
| Book, user-level | Is this book usable by this user now (`research_analysis`)? | `RightsService.eligibility` (re-evaluated every turn) | Deny |
| Book, index-level | May an index of this exact text version be used? | `IndexingPermission` (re-checked per request) | Deny |
| Text version | Is the passage from the current, verified text? | `TextIdentityPort` + S2 object hash | Fail closed |
| Context | Does every item belong to an allowed book, with highlights and notes owned by the requester? | `ContextBuilderService` invariant | Abort the turn + metric |
| Output | Does every citation refer to the sealed context, with origins correct? | `enforceCitations` | Drop the whole answer |
| Budget | Is there capacity, and is the ledger healthy? | Cost ledger admission | Deny before any call |

E6 adds **no new authority**. It wires existing layers in order and adds user content under the existing Context Builder invariant.

## 2. Rights during a session (ADR-006 "rights revoked" row)

- Eligibility and index permission are evaluated **at every turn**.
  - A book revoked mid-session is excluded from new turns, and the exclusion is **disclosed** (`exclusions.ineligible` / `indexNotPermitted`).
  - The locked set is unchanged; the session continues if at least one book remains, otherwise `no_eligible_books`.
- **Earlier answers:**
  - Earlier answers already persisted in `ai_turns` contain excerpts of the revoked book. Whether they remain viewable, are redacted, or are tombstoned is **TT-14 (retention / revocation)**, which is not decided.
  - Recommendation for the dark build: keep them, and mark the citation as "source no longer available" at render time; no deletion.
  - A production decision is required before launch (packet D-8, *before launch*, not before implementation).
- Revocation also requires `purge` of the index (NEM-023 runbook); E6 does not change that.

## 3. User knowledge: highlights and notes

### 3.1 Facts (code, unchanged)

- `fragments(id, userId, bookId, startPhraseIndex, endPhraseIndex, text, note, themes, createdAt, updatedAt)`.
- `POST /fragments` accepts any `text` for any `bookId`, and `PATCH` can rewrite it. **A saved quotation is a user assertion, not publisher text** (PO-028 facts; ADR-006 trust boundary).
- Listing goes through `GET /books/:id/fragments` (the books module). There is no search endpoint.
- NEM-019 architecture tests (accepted) forbid any `knowledge/*` SQL on `fragments` (AC-10/17), any `knowledge/*` import of `fragments/` (AC-16/17), and any reference to `knowledge/*` outside `app.module.ts`.
- E5 Amendment 1 moved user-content retrieval to E6 for exactly this reason.

### 3.2 Conflict

**Every route from `knowledge/` to highlight rows breaks or evades an accepted NEM-019 architecture test.**
- Placing the SQL in a new module outside `knowledge/` and importing it would pass the test's text while defeating its intent (no shared path with reader data). That workaround is **rejected**, as it was in E5 (R-2).

### 3.3 Options (decision D-2: PA + PO, a protected-test exception)

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A (recommended)** | **Named, test-asserted read exception.** One file, `knowledge/user-content/user-highlight-source.ts`, may run **one** `SELECT` on `fragments`. The NEM-019 architecture test is amended to allow exactly that file, and a new test asserts: SELECT only; columns limited to `id, bookId, text, note, createdAt`; a mandatory `"userId" = $1` predicate **and** `"bookId" = ANY($2)` (in a session, the eligible selected books); `LIMIT` ≤ cap; no join to any other user table; no write anywhere | Smallest; keeps the intent (no writes, no cross-user path, no reader coupling); enforceable by test | Amends an accepted protected test (needs explicit authorization) |
| B | **Owned read port in the fragments module, injected through `knowledge.registration`.** Fragments exports a narrow read function; registration passes it as a factory argument | Keeps SQL with the owner module | Changes the registration contract ("imports nothing") **and** two architecture tests; more moving parts |
| C | **Defer user knowledge.** The E6 MVP answers from book passages only; My Knowledge in session follows later | No protected-test change | The MVP lacks "My Knowledge"; PO-028 / ADR-003 mode distinction is visible only later |

### 3.4 Trust rules (independent of the option)

1. Highlights and notes enter context only as `kind: 'highlight' | 'note'` with `userId` = requester. The Context Builder invariant already rejects anything else.
2. **They are never book evidence.** The Gateway policy already labels segments citing them `user_content`; a `library` segment may cite only chunks. A highlight is never shown as "the book says".
3. **In a session (My Knowledge):** only highlights on **eligible selected books** (ADR-006), governed by the book's AI permissions ("as if publisher text"). An ineligible book's highlights are excluded together with the book.
4. **Optional verification** (proposed, not required for the MVP): a highlight whose exact text occurs in the book's current verified S2 text may be **linked** to the containing chunk's anchor. The citation still points to the chunk, and the highlight stays `user_content`. This is not in the MVP (it adds S2 work to E-1's path).
5. **Ask My Highlights (library-wide)** is a **separate model path** with the Highlight Context Builder invariant (no chunks, no stored book text, own capability budget). Saved-quotation permissions there are **TT-27 (open)**. It is not part of the research turn and is gated on TT-27 (D-1).
6. **Highlight search** (lexical, no model) is not an AI path. If built, it belongs in the fragments or books module (outside `knowledge/`) with the user predicate. It is not proposed for the E6 MVP.
7. Privacy: no question, highlight, note, or answer text in logs, metrics, or errors (existing architecture test pattern), and no cross-user or household visibility (PO-026 rule 6).

## 4. Threats and mitigations

| Threat | Mitigation (existing → E6 addition) |
|---|---|
| Prompt injection in book text, highlights, or questions | Gateway delivers context as delimited data, never as instructions (NEM-022 templates); citation policy drops out-of-scope citations → E6 keeps the question in the user slot only |
| Indirect full-text extraction through many questions | Budgets per capability; top-k 8 / 6,000-token passage budget; excerpts only → **cumulative reconstruction accounting (F-2) depends on TT-13**, which is not decided (recommendation: E6 records per-(user, book) excerpt spans without content; thresholds configurable, defaulting to "measure only"; see packet D-8) |
| Using highlights to reach unselected books | In a session only selected eligible books' highlights; the AMH path never has chunks |
| Fabricated quotations shown as the book | `user_content` origin; never `library` |
| Cross-user leakage | Mandatory `userId` predicates; Context Builder owner check; Gateway context-owner check (NEM-022 F-2) |
| Replay or double charge | Server-side key `turnIdempotencyKey`; ledger uniqueness; E6 replays the stored turn |
| Mobile token on a long request | Non-streaming request; standard timeout; no token in the URL |
| SSE through proxies | Traefik passes streaming; dev nginx may buffer (needs `X-Accel-Buffering: no`). Infrastructure is unchanged; the header is set by the API response |

## 5. Failure-mode table (turn)

| Failure | Stage | Charge | Lock | User-visible (code → copy) | Proposed E6 behaviour |
|---|---|---|---|---|---|
| Not entitled / no book plan | 1 | None | No | `prerequisite_missing`, `no_entitlement` | Upsell or explain; no retry button |
| Capability disabled / policy missing | 1 | None | No | `feature_disabled`, `policy_missing` | "Not available right now" |
| Session read-only / over limit | 2 | None | No | `session_read_only` | Offer fork |
| No eligible book | 3 | None | No | `no_eligible_books` | List excluded books with reasons (no internal detail) |
| Some books excluded | 3–4 | — | — | `exclusions` in the result | Disclosure banner on the answer |
| Retrieval returns nothing | 4 | Normal | Yes (if accepted) | Answer with an "insufficient passages" synthesis | Disclose "no matching passages in the selected books"; suggest rephrasing (`or` / fewer terms, E5 AND semantics) |
| Retrieval DB timeout (2 s per statement) | 4 | None (before reservation) | No | `turn_failed` | Retry allowed with the same key |
| Object store unavailable / stale | 4 | — | — | `exclusions.unavailable` / `stale` | Disclosed per book |
| Budget exhausted | 7 | None | No | `budget_exhausted` (429) | TT-11 copy; no retry |
| Ledger unhealthy / unresolved reservations | 7 | None | No | `budget_unavailable`, `unresolved_reservations` (503) | "Temporarily unavailable"; retry later |
| Context too large | 7 | None | No | `context_too_large` | Should not occur (budget allocator); internal alert |
| Set changed between preflight and lock | 8 | Released | No | `set_changed` | Auto-retry once with a new key, or ask the user |
| Provider timeout / unavailable | 9 | **Held** at the reserved amount until reconciliation | Yes | `turn_failed` | "Try again"; a new key creates a new reservation; disclose that capacity may be briefly reserved |
| Client cancels | 9 | **Held** (`client_abort`, partial usage) | Yes | Cancelled state | No partial text shown (F-1); persist the turn as `cancelled` |
| Scope violation (bad citation) | 11 | Settled | Yes | `scope_violation` | Generic error; no text released; alert metric |
| Malformed output / refusal | 9–11 | Settled | Yes | `turn_failed` | Generic error |
| Persistence write fails after a successful answer | 12 | Settled | Yes | Answer returned | Return the answer and log a content-free event. A replay with the same key cannot return it (documented gap; packet item) |

## 6. Open items affecting security (not decided here)

- TT-27: saved-quotation permissions in Ask My Highlights.
- TT-13: quotation and reconstruction thresholds.
- TT-14: retention and revocation of stored answers.
- TT-22: Terms and Privacy before real user data reaches a provider. It does not block a simulated dark build; it blocks any real provider.
- TT-25: semantic highlight search. Out of scope (no embeddings).
