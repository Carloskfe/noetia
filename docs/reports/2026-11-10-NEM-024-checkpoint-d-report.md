# NEM-024 Checkpoint D — Completion Report: Minimal Bilingual Web Q&A

**Status:** **CHECKPOINT D IMPLEMENTED — PA corrections F-D1 to F-D3 applied (§10) — AWAITING PA RE-REVIEW (2026-11-10).** Checkpoint E not started; not merged, not deployed, not activated.
**Authorization:** [PO-041](../operating-framework/decisions/product-owner/PO-041-nem-024-checkpoint-d-authorization.md) · **Checkpoint C acceptance:** [PO-040](../operating-framework/decisions/product-owner/PO-040-nem-024-checkpoint-c-formal-acceptance.md) · **Baseline:** `0c629d3` · **Mission:** [NEM-024](../engineering-missions/APPROVED/NEM-024-research-turn-orchestration-and-minimal-bilingual-web-qa.md) §5 item 13, §5.1, §5.2, AC-14 · **UX:** [doc 14](../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md)

## 1. Commits and PR

| Item | Value |
|---|---|
| Draft PR | https://github.com/Carloskfe/noetia/pull/56 (draft; base `feat/nem-024-checkpoint-a`) |
| PO-040 record | `9b18c5e` |
| Implementation and tests | `27e3149` |
| PO-041, this report, status | see the PR head |

## 2. Files changed (web only; no backend file changed)

| File | Change |
|---|---|
| `services/web/app/(research)/layout.tsx` (new) | `force-dynamic`, `robots: noindex`; no navigation entry |
| `services/web/app/(research)/research/[sessionId]/page.tsx` (new) | The only route; renders `ResearchSession` |
| `services/web/components/research/ResearchSession.tsx` (new) | The screen: gating, session context, history, ask, stages, cancel, recovery, answers, outcomes |
| `services/web/components/research/CitationDialog.tsx` (new) | Accessible excerpt dialog |
| `services/web/lib/research.ts` (new) | Types for the accepted contracts, incremental SSE parser, terminal → UI action mapping, error-code mapping, same-key recovery storage, API wrappers |
| `services/web/lib/api.ts` | **Additive:** `apiStream()` returns the raw `Response` for SSE, with the same token header and the same de-duplicated 401 refresh as `apiFetch`. `apiFetch` is unchanged |
| `services/web/lib/i18n/en.ts`, `es.ts` | New web-only `research` namespace (mobile files untouched, per CLAUDE.md platform rule) |
| `services/web/tests/unit/lib/research.spec.ts` (new) | 46 tests |
| `services/web/tests/unit/lib/api.spec.ts` | +3 (`apiStream`) |
| `services/web/tests/unit/components/research/ResearchSession.spec.tsx` (new) | 73 tests (36 per locale + 1) |
| `services/web/tests/e2e/research-qa.spec.ts` (new) | Playwright flow, once per locale |

Nothing was added in these categories:

- **Dependencies, frameworks, or services:** none. The build reuses `apiFetch`, Tailwind, `LanguageProvider`/`useTranslation`, and `next/link`.
- **Reader and navigation:** reader files are not modified, and no global navigation or book-page entry was added.
- **API changes:** no API, migration, or contract change.

## 3. Functionality against PO-041

| # | Requirement | Implementation |
|---|---|---|
| 1 | Capability gating | `GET …/capabilities` runs **first**. A 403 or any access-denial code (`feature_disabled`, `no_entitlement`, `prerequisite_missing`, `policy_missing`, `capability_not_in_tier`), or `features.researchTurns` false, or `research_session` missing → a neutral "not available" notice with a link to the Biblioteca. **No session or history request is made.** Loading shows `role="status"`. Other failures → load error; session 404 → not found. The server's English message is never shown |
| 2 | Session context | Book chips (title). The **lock indicator comes from the server** (`SessionView.locked`, refreshed after every outcome). Books excluded in the latest answer are greyed with "Not available for research right now". Read-only gives a notice plus a fork notice (`forkOffer.maxBooks`) and replaces the input |
| 3 | History | `GET …/turns?limit=<historyPageMax>`, shown oldest first. Provisional rows show as "processing". Failed rows map their `failureReason` code. Nothing is persisted by the client except §6 item D-D1 |
| 4 | Ask | `POST …/turns/stream` with a fresh `idempotencyKey` per question (`q_<uuid>`, matching `^[A-Za-z0-9_-]{8,64}$`) and the NFC-trimmed question. Enter submits; Shift+Enter adds a newline; a code-point counter enforces the probe's limit |
| 5 | Progress | `Preparing…` → `checking` / `searching` / `composing` texts (D-C2), plus `Recovering…`, `Processing…`, and `Cancelling…`. No text before the terminal (D-C1). Pulse animation only under `motion-safe` |
| 6 | Cancellation | A Cancel button and **Esc** call `POST …/turns/cancel` with the **same key**. While the stream is open its terminal decides. While polling a provisional turn, the cancel result's `turnId` is loaded. **A lost connection or unmount never calls cancel** |
| 7 | Recovery | The in-flight `{key, question}` is kept per session in browser storage until a terminal outcome. On reload the **same key** is replayed (server replay: no new reservation or provider call). On a lost stream: one automatic same-key replay, then "Check again" (same key). `pending` with the same key → poll `GET …/turns/:turnId` every 3 s. **A new key only on an explicit "Ask again"**, labelled as a new question |
| 8 | Answers | Segment origin labels in **text** (`From the book`, `Synthesis`, `Your notes`; `broader` hidden, TT-18). Numbered citation buttons with accessible names ("Citation 1, El faro"). The dialog shows the verified excerpt only for `available` or `position_unavailable`, and otherwise only the `sourceState` text (D-10: never text for revoked, stale, unavailable, or deferred, even if present). **"Open book" → `/reader/<bookId>`** (link only, no position) |
| 9 | Failures | Distinct copy and `data-status` for completed, **unrecorded** ("We couldn't save this answer to your history", answer still shown), processing, failed (mapped code), cancelled (with "may count against your capacity while it is confirmed" when release is unconfirmed or the provider started), interrupted, unknown ("Check again"). Notices: read-only, budget exhausted (input disabled), another question in progress (`duplicate_turn` on a new key → "Wait for the previous question to finish", input disabled) |
| 10 | Bilingual | All copy is under `research.*` in `en.ts`/`es.ts` (tú form, sentence case, `…`, no `¡`/`!`/`Error:`, "Biblioteca", no token wording, no model or provider names). Every server code maps to en/es. The server message is never displayed |
| 11 | Accessibility | A dedicated `role="log"` `aria-live="polite"` region announces only stage texts and outcomes, never answer text. The input has a visible `<label>` and `aria-describedby` (hint and counter), with `aria-invalid` when too long. The dialog has `role="dialog"`, `aria-modal`, `aria-labelledby`, focus moved inside, a Tab/Shift+Tab trap, Esc to close, and focus returned to the citation button; Esc inside the dialog does not cancel the turn. Citation buttons have `aria-haspopup="dialog"`. Labels are never colour-only |

## 4. Tests and verification

### 4.1 Web

| Suite | Result |
|---|---|
| `tests/unit/lib/research.spec.ts` | **46/46**. Covers:<br>• SSE parser: chunked or partial frames, comments, unknown events, malformed JSON, CRLF;<br>• key format;<br>• code points;<br>• storage round trip and failure tolerance;<br>• **each of the 20 error codes has en and es copy** (non-empty, different, no `Error:`/`!`/`¡`);<br>• unknown code → generic;<br>• history mapping;<br>• **terminal → action** for every outcome (D-C3);<br>• API routes;<br>• stream runner: ordering, terminal in a 200 stream, pre-stream HTTP errors, lost connection without a cancel call, 401, AbortSignal |
| `tests/unit/components/research/ResearchSession.spec.tsx` | **73/73**, every case in **en and es**. Covers:<br>• gating: loading, 3 denial codes, unwired, network error, 404, session denial;<br>• context and history states;<br>• ask flow with stage texts in the live log and no answer text before the terminal;<br>• Shift+Enter, empty, too long;<br>• unrecorded;<br>• failed, cancelled, interrupted, unknown;<br>• capacity note;<br>• **Ask again uses a NEW key**;<br>• read-only, budget-exhausted, and duplicate notices;<br>• pending → poll → result;<br>• **Cancel button and Esc use the SAME key**;<br>• cancel while polling;<br>• cancel failure;<br>• **lost connection → no cancel, same-key recovery once, then Check again**;<br>• **unmount → AbortSignal aborted, no cancel, key kept**;<br>• **reload → same-key replay**, history entry not downgraded;<br>• citation dialog: excerpt, Open book href, focus in, Esc and focus return, Tab trap, every `sourceState`, defensive no-text for revoked, backdrop;<br>• labels and live region;<br>• no key leaks;<br>• en ≠ es |
| `tests/unit/lib/i18n.spec.ts` (existing parity) | Passes with the new namespace |
| **Full web unit suite** | **21 suites, 420/420** (previously 298 + 122 new) |
| Coverage (configured for `lib/**/*.ts`) | `research.ts` **98.52% statements / 95.45% branches**; `api.ts` 93.1% / 86%. **Global web: 78.52 / 75.16 / 57.4 / 77.45** vs **baseline 72.8 / 72.44 / 51.74 / 71.61**. The web 80% gate **was already failing on the baseline** (known, project memory "CI coverage gates never passed"). Checkpoint D raises every figure but does not close the pre-existing gap |
| `tsc --noEmit` (app, tests) | 0 errors |
| `next lint` (research route, components, `lib`) | No warnings or errors |
| **Playwright** `tests/e2e/research-qa.spec.ts` against local `next dev` (port 3100), knowledge API simulated by route interception | **2/2 (en, es), run twice**. Flow:<br>1. ask → stages → answer with origin labels;<br>2. `role=log` announces "Answer ready";<br>3. keyboard-open the citation → dialog with the excerpt and an Open book href → Esc returns focus;<br>4. **cancel an in-flight question** (cancel request carries the same key);<br>5. **reload during an in-flight question → the same key and question are replayed; no cancel was sent** |

### 4.2 API regression (no API file changed)

| Suite | Result |
|---|---|
| API unit | **137 suites, 1,956/1,956** |
| API typecheck | 0 errors |
| API integration | Not re-run, because Checkpoint D changes no backend file. Last run at Checkpoint C (`7b65510`): 216/216 |

## 5. Contract conformance (no A–C contract changed)

- **D-C1:** the answer is rendered from the terminal's `result`, which is released per turn after validation and T1. The `delta`/`segment` frames carry the same text and are not rendered separately.
- **D-C2:** the stage names are used as accepted.
- **D-C3:** HTTP 200 is never treated as success; the `terminal.outcome` decides. Pre-stream HTTP errors are mapped by `code`.
- **D-8:** shown as "not saved". **D-9 (a):** no transport event cancels.
- **Idempotency:** the same key is used for every recovery, and a new key only on an explicit "Ask again".

## 6. Deviations and interpretations (for PA confirmation)

| Id | Item | Rationale |
|---|---|---|
| **D-D1** | ~~The in-flight `{key, question}` is stored in browser `localStorage`~~ **Superseded by F-D1 (§10.1):** tab-scoped `sessionStorage`, bound to the account, expiring, cleared on logout | Required for "same-key replay after reload". It is a recovery aid, **not** conversation memory and **not** server persistence |
| **D-D2** | Fork: **notice only**, no fork button | Forking needs a book selection (excluded by PO-041). The notice shows the fork limit from `forkOffer` |
| **D-D3** | The excluded-book chip state comes from the **latest answer's `exclusions`** | There is no session-level eligibility field. Using the latest answer avoids a backend change |
| **D-D4** | **One automatic same-key recovery** after a lost stream, then a manual "Check again". Provisional turns poll every 3 s | Bounded retries; never a new key |
| **D-D5** | `apiStream()` added to `lib/api.ts` | `apiFetch` parses JSON and cannot stream. `apiStream` reuses its token and shared refresh logic. Additive |
| **D-D6** | Playwright runs against the local web app with the **knowledge API simulated by route interception** (the repository's existing e2e pattern) | The real module is dark (unbound ports, no provider), so a full-stack simulated run needs fixture-bound ports, which are outside D's scope. The browser, routing, SSE parsing, focus, and i18n are all real |
| **D-D7** | History shows the most recent `historyPageMax` (50) turns; no pagination UI | Minimal interface; pagination is E9 |
| D-D8 | `invalid_request` copy names the 500-character limit | Equal to the server rule |

## 7. Risks

| Id | Risk | Disposition |
|---|---|---|
| R-D1 | Two tabs on the same session could both replay the same pending key | Same key, so the server replays: no double reservation or charge |
| R-D2 | `next build` was not run (VM memory limits). The route compiled and served under `next dev`; `tsc` and `next lint` are clean | Build runs in CI or at Checkpoint E |
| R-D3 | The web coverage gate is pre-existing red | Raised by D (75.16% branches); not closed |
| R-C1 | No SSE heartbeat (PO-040 item 9) | Carried to Checkpoint E |

## 8. Exceptions carried forward (not waived)

- **E-1:** retrieval p95, 594 ms vs 150 ms.
- **E-2:** API branches 80.20%; closing it needs a separate decision.
- **NEM-022 coverage exception.**
- **D-8:** best-effort `unrecorded` delivery.
- **Cancellation-record persistence.**
- **In-process-only cancellation.**
- **Q-11:** W=10 candidate.
- **TT-14:** answer retention and rights.
- **SSE proxy idle timeout** (no heartbeat).

## 9. Boundaries

Done: only Checkpoint D (the web route).

Not done:
- no Checkpoint E;
- no session creation, selection, or management UI;
- no navigation or book-page entry;
- no user knowledge, Research Brief, NoetiaX, or mobile;
- no reader change and no deep links;
- no provider, paid AI, activation, merge, or deployment;
- no backend or protected-contract change.

---

## 10. PA correction request (reviewed `3178e40`): F-D1 to F-D3

**Commit:** `3035d7b` (web only: `lib/api.ts`, `lib/research.ts`, `components/research/ResearchSession.tsx`, the three test files, and the e2e spec). No backend change, no new endpoint, no new dependency.

### 10.1 F-D1: recovery storage privacy (corrected)

**Before:**
- `{key, question}` lived in `localStorage` with no owner and no expiry.
- It survived logout, account switching, and closing the browser.

**Now, the lifecycle (`lib/research.ts`):**

| Aspect | Behaviour |
|---|---|
| Where | **`sessionStorage`**, this tab only: it survives a reload and is gone when the tab or window closes. Never `localStorage` |
| What | `{ v: 1, key, question, owner, savedAt }`. `owner` is the access token's `sub`, decoded without verification, for scoping only (existing auth infrastructure, `currentAccountId()` in `lib/api.ts`). No email or other claim is stored |
| When written | When a question is sent or replayed, **only if an account is signed in** (otherwise nothing is written; fail closed) |
| When removed | <br>• Any terminal outcome except `unknown`.<br>• `clearPending`.<br>• **Logout:** the existing `clearToken()` now calls `clearResearchRecovery()`, which sweeps every `noetia_research_pending:*` entry from both storages. Account deletion already calls `clearToken()` and `localStorage.clear()` |
| When discarded on read (and purged) | <br>• The owner differs from the current account (**account switch**).<br>• No signed-in account.<br>• Older than **`RECOVERY_TTL_MS` = 15 min** (longer than any turn's server fence; afterwards history is the source of truth).<br>• A future `savedAt` beyond 60 s of clock skew.<br>• Wrong version, invalid key, or malformed JSON |
| Legacy | A `localStorage` copy from pre-F-D1 builds is never read and is purged on load |

**Limitations (disclosed):**

- **Tab-scoped by design:** a question sent in one tab is not recovered from another tab. The other tab still shows the turn through history, as processing, completed, or interrupted.
- **Logout through another route:** a logout that only expires the token server-side, without `clearToken`, leaves the entry until the tab closes, the TTL passes, or an account mismatch is detected on read.
- **Unknown-turn recovery after reload:** only the latest pending question is stored. If the user asks a newer question after an `unknown` outcome, recovering the older one after a reload relies on history; in-page "Check again" still works (F-D2).
- **Signature not checked:** the token's `sub` is not verified client-side. This only scopes local data; the server authorizes every request.

**Tests:**

- **`research.spec.ts`** (8 F-D1 tests):
  - sessionStorage only, never localStorage, and no email stored;
  - nothing written without an account;
  - account switch and signed-out → not recovered and purged;
  - TTL boundary (exactly 15 min allowed, +1 ms rejected) and future skew;
  - legacy entry purged;
  - malformed, version, and key → purged;
  - **logout sweep** removes only prefixed entries in both storages;
  - storage failures never throw.
- **`api.spec.ts`** (2 tests): `currentAccountId` with the base64url alphabet and the invalid, missing-`sub`, and absent cases; the sweep tolerates unusable storage.
- **Component** (3 tests, en and es):
  - another account's entry → not replayed and purged;
  - expired entry and legacy entry → not replayed and purged;
  - signed out → nothing stored, and the turn still runs.
- **Playwright:** after the reload-recovery flow, no recovery entry remains in `localStorage` or `sessionStorage`.

### 10.2 F-D2: unknown-outcome recovery (defect found and corrected)

**Verified behaviour before the fix:**
- After `unknown`, the pending key was kept, so an immediate "Check again" or a reload replayed the same key.
- **Defect:** "Check again" used whichever pending question was *latest*. After a newer question was asked, it would have replayed the newer key, not the unknown turn's own key.

**Fix:**
- `terminalAction(…, key)` attaches `recovery: {key, question}` to the `unknown` turn.
- "Check again" on that turn replays **its own key and question**.
- The pending entry is kept for a reload, which auto-replays the same key.
- **No new key, no reservation:** the server replays by key, as accepted in Checkpoints A and B.

**Tests (component, en and es):**

| Test | What it proves |
|---|---|
| Immediate replay, even after a newer completed question | "Check again" sends `calls[0].key` and `'primera'`. The replayed result replaces the same turn id; no cancel call |
| **Reload after `unknown`** | Automatic replay with the same key and question ("Recovering…") |
| Lib | `unknown` carries `recovery` only when a key is known |

### 10.3 F-D3: cancellation during recovery (defect found and corrected)

**Defect:** while polling a provisional turn, a cancel answered `cancel_requested`, or one lacking a `turnId`, **returned after clearing the poll timer**. The UI stayed in "Cancelling…" indefinitely.

**Fix:** `resume()` always returns to a recoverable state for the same key.

| Situation | New behaviour |
|---|---|
| Polling + `cancel_requested` or no `turnId` | Back to "Processing…"; polling of the known turn resumes, or with no known id the same key is replayed |
| Polling + cancel request fails | Mapped notice; polling resumes; Cancel remains available |
| Polling + `turnId` | Load the turn; if still `accepted`, keep polling; otherwise show the outcome |
| Stream open + cancel request fails | Notice; phase restored; the stream's terminal decides |
| **Stream open and no terminal ever arrives** | A **watchdog** (`CANCEL_WATCHDOG_MS` = 15 s) aborts delivery only, **never a cancel**. The lost-connection path replays the **same key**, whose terminal shows the real outcome. If the automatic retry is exhausted: idle with "Check again" |

**Tests (component, en and es):**

| Test | What it proves |
|---|---|
| Polling + `cancel_requested` | Processing (not Cancelling); `getTurn` called again; then the cancelled outcome |
| Polling + no `turnId` | Same as above |
| Polling + cancel failure | Notice, processing, Cancel still present |
| **Watchdog** | Stream aborted after the timeout; replay with the same key; `cancelTurn` called exactly once; cancelled outcome shown |
| Terminal in time | The watchdog never fires; no replay |

**Negative control:** run against the pre-fix component, all 10 F-D2/F-D3 component tests fail as expected. With the fix, they pass.

### 10.4 Regression

| Check | Result |
|---|---|
| Web unit (full) | **21 suites, 448/448** (previously 420 + 28) |
| Coverage | `research.ts` 98.7% statements / **95.75% branches**; `api.ts` 95.23 / 87.5. Global web 80.0 / 76.25 / 58.92 / 78.88 (the gate is still pre-existing red; it was 75.16% branches at `3178e40`) |
| `tsc` (app, tests) · `next lint` | 0 errors · no warnings |
| Playwright (en, es) against local `next dev`, API simulated | **2/2, run twice**. Includes reload recovery under the new storage |
| API | No API file changed. Unit last run at `3178e40`: 1,956/1,956 |

**Not done:** no Checkpoint E, no merge, no deployment, no backend or accepted-contract change.

**STOP: returned for PA re-review of Checkpoint D.**

