# 03 — Interactive Research and Research Brief Architecture

**Status:** PROPOSED. Nothing here is built or authorized. Endpoint, table, and field names are illustrative; a mission decides the final schema.

---

## 1. Design principles

1. **The conversation is the product; the Brief is its artifact.** A Brief is always produced from a session and never replaces one.
2. **Integrity is not a tier feature.** Permissions, citations, provenance, and anti-reconstruction are identical on Noetia+ and NoetiaX. Only depth and capacity differ.
3. **Reader first.** No code path in the reader, Escucha Activa, or ownership checks calls anything in this document.
4. **One enforcement point.** Every step goes through the NEM-003 Orchestrator, so no feature can skip tier, rights, or budget checks.

## 2. User journey

```
Book selection → Research session → Source-aware conversation
      → Follow-up questions → Synthesis → Research Brief export
```

| Step | User sees | Server does | Noetia+ | NoetiaX |
|---|---|---|---|---|
| **1. Book selection** | Library picker with eligibility; question (optional) | Resolve tier; compute eligibility per book; validate count | ≤ 3 | ≤ 10 |
| **2. Session start** | Selected books and what each one allows | Create session; confirm books are indexed; snapshot rights version | Same | Same |
| **3. Conversation** | Streamed answer with citations and origin labels; mode control | Permission → retrieval → context → model → citation validation → meter | Single-pass, streamed | Same, or multi-pass (candidate) |
| **4. Follow-ups** | Continued conversation | Resolve references; compact history; re-check tier, rights, and budget on **every turn** | Same | Same |
| **5. Synthesis** | Structured summary of the session | Synthesize from persisted turns and citations; no new sources | Agreements and tensions | Evidence matrix (candidate), background run |
| **6. Brief export** | Review, then export | Build structured artifact; validate citations; apply quote policy | Required sections | Plus depth sections (candidate) |

**Session states:** `draft` (books editable) → `active` (books locked at the first analysis turn) → `read_only` (tier lost, rights changed, or budget ended) → `deleted`.

**A one-book session is the smallest case**, which keeps Ask This Book from NEM-003 without a separate code path.

### Reuse of NEM-003

| Element | Treatment |
|---|---|
| `ai_conversations` | **Reuse**: a research session is a conversation with scope `selected`. No parallel entity |
| `ai_conversations.sourceRefs` (book list) | **Replace** for books with a normalized child table (§3). jsonb cannot enforce a limit |
| `ai_messages` | **Reuse**; add segments with origin labels; citations hold anchors, not book text |
| `knowledge_assets` | **Reuse**; add type `research_brief` |
| `/plus/ask`, conversation CRUD | **Reuse the design**, neutral naming |

### Illustrative API

| Method and path | Purpose | Notable errors |
|---|---|---|
| `POST /intelligence/sessions` `{ bookIds[] }` | Create session | `402 tier_required`, `422 session_book_limit_exceeded {limit}`, `403 book_not_ai_eligible {bookId, reason}`, `409 book_not_indexed` |
| `PUT /intelligence/sessions/:id/books` | Change books while `draft` | `409 session_books_locked` |
| `POST /intelligence/sessions/:id/turns` `{ question, mode, focusBookId? }` | Interactive turn (stream) | `429 budget_exhausted`, `409 session_requires_narrowing` |
| `POST /intelligence/sessions/:id/deep-runs` | Background deep analysis (NoetiaX candidate) | `403 capability_denied`, `202 {runId}` |
| `POST /intelligence/sessions/:id/synthesis` | Generate synthesis | `409 session_has_no_analysis` |
| `POST /intelligence/sessions/:id/briefs` | Generate Brief (`202`) | `409 session_has_no_analysis` |
| `GET /intelligence/briefs/:id`, `POST …/exports` | View and export | `403` if not the owner |

## 3. Server-side enforcement of book limits

The limit is **never** trusted from a client, stored only in the UI, or left to the model.

| # | Layer | Mechanism | Stops |
|---|---|---|---|
| 1 | **Resolver** | Limit read from the versioned tier policy for the authenticated user, on each request. The request body carries no limit | Tampered clients |
| 2 | **Normalized selection** | `ai_session_books(sessionId, bookId, position, addedAt)` with `UNIQUE(sessionId, bookId)` and `UNIQUE(sessionId, position)` | Duplicates inflating or hiding counts |
| 3 | **Transaction** | Lock the session row (`SELECT … FOR UPDATE`), count, compare with the limit, insert, all in one transaction | Parallel requests racing past the limit |
| 4 | **Database ceiling** | `CHECK (position BETWEEN 1 AND 10)`: a hard stop at the highest approved limit, independent of application bugs. The tier limit (3 or 10) stays in the service | Application defects |
| 5 | **Lock on first turn** | `booksLockedAt` set by the first analysis turn. Later changes **fork** a new session | Rotating books through one session to analyse an unlimited number |
| 6 | **Retrieval contract** | Semantic Retrieval Interface requires a non-empty, explicit `allowedBookIds` set, derived server-side. No "all books" option exists on this path | Forgotten filters |
| 7 | **Context Builder invariant** | Every chunk, highlight, and note entering context must belong to a session book. A violation aborts the turn and raises an alert rather than dropping silently | Defects in any earlier layer |
| 8 | **Planner and tool arguments** | Model-issued retrieval requests are validated against the session set. The model cannot widen scope | Prompt injection, multi-pass planners |
| 9 | **Re-evaluation per turn** | Tier and rights are re-resolved each turn. After a downgrade, a session over the new limit returns `session_requires_narrowing` and the user forks a smaller one; history stays readable | Downgrade retaining 10-book analysis |

**Evading limits by opening more sessions** cannot be solved by the per-session cap. It is covered by the monthly budget ([04 §4](04-entitlements-and-budgets.md#4-resource-budgets)) and the per-user, per-book reconstruction ledger (§5). A separate session count is TT-06.

**Required negative tests:** an eleventh book (DB and service); a fourth book on Noetia+; parallel adds at the limit; duplicate IDs; adding after the lock; a forged limit in the body; a planner naming an unselected book; a note from an unselected book; a downgrade with an active 10-book session.

## 4. What "deeper analysis" means technically

**Requirement (PO):** NoetiaX must be qualitatively deeper, not just a higher limit. **Test proposed:** give both tiers **the same 3 books and the same question** on a benchmark set. If NoetiaX shows no measurable gain against criteria the PO approves, depth has not been delivered, whatever the book limit. Without this test, "deeper" is unfalsifiable.

### Candidate capabilities (PO selects under TT-07)

| ID | Capability | Technical meaning | Cost shape |
|---|---|---|---|
| **DX-1** | Per-book position map | Structured extraction of a book's claims, definitions, and arguments, with anchors, stored per text version | High once per book, then shared where rights allow |
| **DX-2** | Claim-level evidence matrix | Claims × books: supports, contradicts, qualifies, silent, or insufficient, each with citations | Medium |
| **DX-3** | Typed disagreement | Direct, definitional, scope, empirical, or values disagreement; apparent versus genuine | Medium; advanced class |
| **DX-4** | Iterative research plan | Break the question into sub-questions, retrieve, detect gaps, retrieve again. Hard limit on passes | Medium to high; bounded |
| **DX-5** | Argument reconstruction | Premises → conclusions → assumptions for each position | Medium; advanced class |
| **DX-6** | Counter-argument analysis | Strongest objections, from the selected books first; anything external labelled `broader` | Medium |
| **DX-7** | Claim-support verification | A separate pass checking that each cited passage supports its claim, with a coverage report | Low to medium |
| **DX-8** | Concept tracing | How a concept moves across selected books | Medium |

**Recommended minimum for NoetiaX:** DX-1, DX-2, DX-4, and DX-7. They give a visible difference (a matrix, a method, a coverage statement) and DX-1 is the main cost lever. This is a recommendation, not a decision.

### Why ten books is not "three books, more"

- **Fixed context spreads thin.** With a fixed total context, ten books get roughly a third of the passages per book that three do. Balanced quotas alone produce *shallower* answers at ten, so per-book maps (DX-1) matter.
- **Pairs grow quadratically.** 3 books have 3 pairs; 10 books have **45**. Pairwise prompts are therefore **prohibited by design**: compare by clustering claims across books, then analyse clusters.
- **Runs take longer.** A multi-pass run does not fit a request/response turn, and CD restarts the API on each deploy. Deep runs execute in the worker, persist progress, and resume.

### Interaction with routing

| Rule | Reason |
|---|---|
| Tier selects **workload plans and budgets**; the Router still selects the model per workload | ADR-001: no model in the promise |
| NoetiaX copy describes outcomes, never a model | PO-001 |
| Any routing change must pass evaluation | ADR-001 |
| Noetia+ contradiction work class is undecided | TT-08 (C-4) |

**Open for the PO:** TT-07 (which capabilities), TT-08 (how far Noetia+ goes), and the criteria for the depth benchmark. **Open for engineering after that:** chunking, fusion, pass limits, and thresholds, all settled by evaluation. No evaluation methodology exists today (AI Governance Framework, `OPEN`).

## 5. Source and rights governance

### Modes are preserved, with session scope as a second axis (X-1)

| Mode (ADR-003) | Book-derived sources in a session | Broader model knowledge |
|---|---|---|
| **This Book** | One focus book from the session | Language and reasoning only; no substantive external claims. States when the book cannot answer |
| **My Knowledge** | All selected books, plus the user's own highlights and notes **on those books** | Same as This Book |
| **Expand** | Same sources as My Knowledge | Allowed, always labelled `broader`; never attributed to a book |

**Library-wide use (recommended for TT-05):** discovery across the whole library stays available as **retrieval without generation** (semantic search to *find* books to select). It sends no book text to a model, so it is cheap and does not count as analysis. Any generated analysis is bound to the session's books. Ask My Highlights is the one real exception to decide: it could run on the user's own highlight text only, outside the book limit, with no retrieval from book text.

### Permission pipeline (ADR-002 preserved, session step added)

```
Authenticated user
  → tier and capability resolved            (entitlement)
  → session book set loaded                 (limit)
  → for each book: rights class and
    operation permissions resolved          (content AI rights, most restrictive wins)
  → retrieval limited to the allowed set    (query-level filter, not post-filter)
  → rerank → context builder invariant      (backstop)
  → model via AI Gateway
  → segments, citation validation, quote and reconstruction checks
  → persist and meter
```

| Eligibility case | Behaviour |
|---|---|
| Owned, operation permitted | Eligible |
| Public domain with **verified edition** | Eligible, ownership not required (ADR-002); selection rule is TT-04 |
| Public domain status unverified | **Not eligible** until verified. `isFree` is not evidence |
| Non-owned licensed | Metadata and permitted representations only; **not selectable for full-text analysis** |
| Restricted | Never retrieved |
| Owned, but `crossBookComparison` not permitted | Usable for that book's own answers; **excluded from comparisons, and the exclusion is shown** in the answer and the Brief |
| `user_books` row of doubtful origin (F-7) | **Not eligible** until NEM-011 and B-10 are resolved |
| Below the catalogue quality standard and not owned | Not offered in the picker (existing rule: never show a title and then fail) |

**Default deny:** missing rights data means no AI use.

### Traceable citations

| Field | Purpose |
|---|---|
| `bookId`, title, author, edition or translation | Identify the source |
| `chapter`, `section` | Human-readable location |
| `chunkId`, `chunkIndex` | Retrieval audit |
| `textHash`, `charStart`, `charEnd` | **Authoritative anchor** (X-3) |
| `phraseIndexStart/End` (derived) | Deep link when a valid sync map exists; recomputed if the map changed; falls back to chapter when there is none |
| `rightsVersion` | Permissions at generation time |

Every citation must resolve to a chunk in the session's allowed set **before display**. A claim whose citation fails is not displayed as library-derived. Deep links need the reader `?phrase=` change, which is a protected-system change needing its own authorization (F-9). Until then, citations show location text and open the book.

### Separating book knowledge from model knowledge

Generation returns **structured segments**, not free text:

| Origin (X-2) | Meaning | Rule |
|---|---|---|
| `library` | Stated in a selected book | Requires a valid citation |
| `synthesis` | Noetia's connection between cited passages | Must cite each source; shown as interpretation, not as any author's claim |
| `broader` | General model knowledge | Expand only; never carries a book citation |

In This Book and My Knowledge, an uncited substantive claim is removed or the answer states the limitation. **Trade-off:** validating before display adds latency, so streaming proceeds segment by segment after validation rather than token by token.

### Anti-reconstruction

Thresholds remain a Product/Legal decision (TT-13); the mechanisms are architecture.

| Layer | Mechanism |
|---|---|
| **Structural** | Context takes top-k passages only; whole books never enter context |
| **Output** | Configurable verbatim limit per book, turn, session, and Brief |
| **Cumulative ledger (X-5)** | Per (user, book): which ranges were output verbatim, across **all** sessions and exports. Metadata only, no text. Triggers throttling or refusal |
| **Sequential detection** | "Continue", next-passage, and adjacent-chunk patterns |
| **Intent** | Refusal with an explanation for whole-chapter or bulk-quote requests; refusals logged as an abuse signal |
| **Exports** | Same policy as chat; a Brief stores anchors, with quotes governed separately. A Brief cannot be a route around chat limits |
| **Provider** | No training or data-sharing opt-in (ADR-002, PO-005) |

**Residual risks, stated plainly:**

- In Expand, a model might reproduce a famous text from its own training. Fuzzy matching catches this only for session books, not all works.
- A determined user with many sessions can slowly gather excerpts. The ledger raises the cost and leaves evidence; it does not make extraction impossible.
- Thresholds are product controls, not legal safe harbours (ADR-002).

### Prompt injection

Book text and notes are untrusted data, placed in a delimited region (NEM-003 14). Multi-pass planners add a new surface: planner tools are limited to retrieval inside the session's set, with validated arguments and no write or network access. A malicious uploaded book can distort analysis of itself, but not widen scope or reach another user's data.

### Reader protection (specific to this design)

| Control | Purpose |
|---|---|
| Dedicated, small database pool and statement timeout for `knowledge/*` | Vector queries cannot exhaust connections used by reader endpoints |
| Admission control on concurrent AI streams | The API (1 CPU / 512 MB, F-11) also serves readers |
| Deep runs and embedding in the worker, with low concurrency | Isolation |
| Master kill switch; test that reader endpoints pass with `knowledge/*` disabled | NEM-003 18 |

## 6. Research Brief

A structured, versioned, immutable record of a session, stored as a `knowledge_assets` row of type `research_brief`, user-private.

### Structure

| Section | Content | MVP |
|---|---|---|
| **Header** | Title, date, tier at generation, language, schema version | Required |
| **Research question and session scope** | Question(s), modes used, selected books | Required |
| **Selected books and source metadata** | Title, author, edition or translation, language, rights class, text version | Required |
| **Key findings** | Numbered findings, each with origin label and citations | Required |
| **Agreements and contradictions** | Cited on each side; unresolved items stated as unresolved | Required (depth per TT-08) |
| **Source citations** | All citations with resolved location | Required |
| **Synthesis and conclusions** | Marked as Noetia's interpretation | Required |
| **Relevant limitations** | Generated from **system facts**, not model prose (below) | Required |
| Broader context | `broader` content, in its own section | If Expand was used |
| Evidence matrix, method, coverage | DX-2, DX-4, DX-7 | NoetiaX, if approved under TT-07 |
| Annotations, Brief comparison, collaborative review, templates | | Later |

**Limitations must be factual and system-generated:** books or operations excluded by rights; unindexed books; sections with low retrieval coverage; features unavailable because of budget or degradation; claims removed for failed citation; `broader` content present; AI may err and should be checked against sources.

### Rules

| Rule | Reason |
|---|---|
| Requires at least one completed analysis turn; **no one-shot Brief endpoint** | `PO`: must not replace the interactive experience |
| Uses only session content | Prevents a Brief introducing unseen claims |
| Every finding has citations or an honest label | ADR-003 |
| Immutable; regenerating creates a new version and uses budget | Audit trail |
| Viewing or exporting a stored Brief uses no AI and no budget | Exports should not punish users |
| Excerpts only; never full-text export | PRD Security & DRM: "fragments (text excerpts) only — no full-text export" |
| Stored and exported privately | The MinIO `images` bucket is public (`infra/minio/buckets.sh`), so it must not be used. Needs a private prefix with short-lived signed URLs |
| Never includes other users' data; no household visibility | Personal Libraries Remain Personal |

### Export alternatives (none selected; TT-17)

| Option | Strengths | Risks | Effort |
|---|---|---|---|
| **In-app view with print** | No new surface; citations stay live | Not a portable file | Low |
| **Markdown** | Portable, simple, editable | Plain presentation; easy to alter | Low |
| **PDF** | Stable, professional | Rendering pipeline and worker memory; ES/EN fonts | Medium |
| **DOCX** | Editable, common for research | Formatting cost; easy to alter | Medium |
| **Share link** | Reuses the invite pattern; citations can lead to acquisition | Highest rights, privacy, and revocation risk; needs SA-001 review | High |

Links in exports open the reader only for users with access; others see an acquisition prompt rather than content, per PO-021.

### MVP versus later

| MVP | Later |
|---|---|
| All required sections; one export format (TT-17) | Further formats, templates |
| Immutable versions; private storage | Annotation, comparison between Briefs |
| System-generated limitations | Sharing, team review |
| ES and EN output | Citation-style formats (APA, MLA) |
| Deep links once the reader change is authorized | Depth sections beyond those approved |

## 7. Data additions (additive, future mission only)

| Entity | Type | Purpose |
|---|---|---|
| `ai_session_books` | New | Selection and limit enforcement |
| `ai_conversations` | Extend (design stage) | `booksLockedAt`, `tierAtCreation`, `policyVersion`, status |
| `ai_messages` | Extend (design stage) | Segments, citation anchors |
| `book_ai_rights` (NEM-003 `book_ai_permissions` + edition fields) | New | X-4 |
| `ai_book_artifacts` | New | Per-book position maps, keyed by `textHash` + pipeline version |
| `ai_source_exposure` | New | Reconstruction ledger, metadata only |
| `ai_deep_runs` | New | Resumable run state and progress |
| `ai_budget_ledger`, `ai_rate_cards`, `ai_tier_policies` | New | See [04](04-entitlements-and-budgets.md) |
| `knowledge_assets` | New (NEM-003 future) | Type `research_brief` |

**Unchanged:** `user_books`, `token_ledger`, `sync_maps`, `fragments`, `reading_progress`, `subscriptions` (changes there belong to M-C). `fragments` is not overloaded (NEM-003 13).
