# NEM-024 Checkpoint D — Completion Report: Minimal Bilingual Web Q&A

**Status:** **CHECKPOINT D IMPLEMENTED — AWAITING INDEPENDENT PRODUCT ARCHITECTURE REVIEW (2026-11-10).** Checkpoint E not started; not merged, not deployed, not activated.
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
| **D-D1** | The in-flight `{key, question}` is stored **in browser `localStorage`** per session until a terminal outcome | Required for "same-key replay after reload". It is a per-browser recovery aid, **not** conversation memory and **not** server persistence. If storage is unavailable, reload recovery is skipped and the turn still appears in history |
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

**STOP: submitted for independent Product Architecture review of Checkpoint D.**
