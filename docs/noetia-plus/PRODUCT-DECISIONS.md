# Noetia+ — Product Decisions (PO-001 / PO-002 / PO-003)

Durable record of the Product Owner decisions that resolve the three principal blockers from NEM-003. Recorded by **NEM-005**. These are **product/architecture policy** (not legal advice) and are authoritative for future implementation missions. Each is backed by an Architecture Decision Record.

> A future governance mission may migrate these into a formal Product Bible. Until then, this file is the canonical location.

---

## PO-001 — AI Economics & Provider Independence
→ **[ADR-001](../architecture/adr/ADR-001-ai-provider-abstraction-and-model-routing.md)**

- Noetia+ must **not** depend permanently on one AI provider or model. Use a **provider-agnostic AI Gateway** with **dynamic model routing**; workloads route by capability/quality/latency/language/context/availability/cost.
- **No model name is part of the customer promise** — users buy Noetia intelligence capabilities, not a particular external model.
- **Workload classes:** low-cost (classification, tagging, intent, query-rewrite, extraction, light summary, embedding, rec-augmentation → cheapest qualified); standard intelligence (Ask This Book / Ask My Highlights / grounded Q&A / synthesis / learning paths → efficient models meeting quality thresholds); advanced reasoning (cross-book synthesis, contradiction, complex comparison, sophisticated maps, high-value long-form/presentations → higher-cost selectively).
- **Pricing intent:** mainstream ~$5.99–$9.99/mo (interest ~$7.99–$8.99). **Final retail price NOT set here.**
- **Economic target (guardrail, not a billing rule):** normal-user average AI/infra COGS **≤ ~$1.50/mo.**
- **COGS bands** (`AI COGS / Noetia+ revenue`, configurable): **Excellent ≤15% · Healthy >15–25% · Caution >25–35% · Intervention Required >35%.** Not hard-coded into product behavior unless a future mission authorizes it.
- **Metering:** track provider/model/tokens/embeddings/retrieval/duration/est-cost/cache/failures. **Raw LLM tokens are not the customer-facing unit.** `BOOK TOKEN ≠ AI USAGE` — never merged.

## PO-002 — Copyright Intelligence & Permission-Aware Retrieval
→ **[ADR-002](../architecture/adr/ADR-002-permission-aware-content-intelligence.md)**

- **Permanent principle:** Noetia Brain may help a user *understand* a copyrighted work but must not function to *reconstruct or substitute for* it.
- **Content rights classes:** PUBLIC DOMAIN (only when the specific text/translation/edition is verified — a modern translation is not automatically PD); OWNED/LICENSED-BY-USER (authorized Q&A/explain/summarize/compare/analyze/synthesize/cite/short-quote/connect — **subject to Noetia's rights agreement**; ownership ≠ unrestricted AI rights); DISCOVERABLE/NON-OWNED LICENSED (only contractually permitted metadata/previews/excerpts/approved representations); RESTRICTED (no AI retrieval/context).
- **Permission before retrieval:** entitlement + content-AI-rights enforced **before** protected content enters model context.
- **Rights-holder AI controls** supported at title level (indexing, Q&A, summary, comparison, quotation, grounding, discoverability embeddings, recommendation/knowledge-map participation, training). Schema is a future implementation decision.
- **Training default:** licensed content must **not** be used to train/improve a general-purpose model without explicit authorization.
- **Quotation:** no universal word-count/percentage is claimed as automatic fair use; governed by rights/contract/safety/context/purpose; anti-reconstruction safeguards required. **Thresholds are a future Product/Legal decision.**

## PO-003 — Source-Aware Hybrid Intelligence
→ **[ADR-003](../architecture/adr/ADR-003-source-aware-hybrid-intelligence.md)**

- Noetia Brain is **not** permanently restricted to Noetia sources; it may use broader model knowledge where the selected mode permits — but **Noetia-derived and general knowledge must not be invisibly blended** (principle: **Source-Aware Intelligence**).
- **Three modes** (final names = future UX): **This Book** (tightly grounded in the selected book), **My Knowledge** (owned books + highlights + notes + authorized/public-domain Noetia sources — the core experience), **Expand** (broader/general/authorized-external knowledge with distinguishable provenance).
- **Provenance:** Noetia should answer "where did this idea come from?" — Noetia-grounded claims cite Book → Author → Chapter/Section → chunk → reader/sync location, ideally deep-linking into Escucha Activa. Hybrid answers can distinguish *FROM YOUR LIBRARY* vs *BROADER CONTEXT* (labels/UX = future).
- **Never attribute external knowledge to a book.**

## PO-004 — Semantic Retrieval Store
→ **[ADR-004](../architecture/adr/ADR-004-postgresql-pgvector-semantic-retrieval.md)** (accepted via NEM-005A)

- **PostgreSQL + pgvector** is the **authoritative semantic vector store**; **Meilisearch** stays lexical/full-text and may join future hybrid retrieval. **No standalone vector database for the MVP.**
- PostgreSQL remains the **system of record** (app data, ownership, content permissions, semantic chunks, embeddings, provenance, citation relationships). A primary reason for the choice is native integration of semantic retrieval with authoritative relational **permission** data (ADR-002 — authorization before context).
- **Semantic chunks stay separate from Escucha Activa sync phrases**, referencing a phrase range (`phraseIndexStart`/`phraseIndexEnd`) for provenance/deep-linking — no coupling of AI chunking to reader sync.
- **Exact vector search first** (correctness/recall/simplicity); approximate indexing (HNSW/IVFFlat) is a later, **evidence-driven** step, not added now.
- A mandatory **Semantic Retrieval Interface** keeps Noetia Brain decoupled from pgvector-specific queries; pgvector is the approved implementation, **not** an irreversible dependency. Embedding provider/model stays configurable under **ADR-001**; multilingual ES/EN (incl. cross-language) required; embedding versioning treated as re-embedding.
- Standalone vector DBs (Qdrant/Weaviate/Pinecone/etc.) and Redis-vector are **rejected for the MVP** on operational-complexity grounds. Reconsideration requires a future ADR on measured evidence.
- *(Does not alter PO-001/002/003.)*

---

## Three-tier decisions (Noetia · Noetia+ · NoetiaX) — approved 2026-11-08

Approved by the Product Owner on 2026-11-08 (*Product Architecture Decision Reconciliation — Three-Tier Architecture Governance and NEM-019 Preparation*). Full text, open items, and preserved preliminary text are in each record. These are product policy; they **authorize no implementation**.

> Record location: the full records are in `docs/operating-framework/decisions/product-owner/`, which is **not yet on `main`** (it arrives with the operating-framework and three-tier branches). This file is the register on `main`, so these entries are recorded here.

### PO-025 — Three-tier product structure (decided 2026-11-08)
→ **[PO-025](../operating-framework/decisions/product-owner/PO-025-three-tier-product-structure.md)**

- **Noetia** (multimodal reading and social platform), **Noetia+** (interactive, source-aware research), **NoetiaX** (qualitatively deeper research, not simply a larger book limit). Both premium tiers: interactive conversations and session-derived Research Briefs. Premium requires a qualifying book subscription (PO-026). Acquired books stay permanently owned; book tokens and AI budgets stay separate. "Basic" is not a customer-facing label.
- **Not decided:** token expiration (**TT-01 open**; current behaviour 90 days is unchanged; PO-024's six-month proposal is neither implemented nor approved); premium prices; quantitative AI budgets; additional token entitlements.

### PO-026 — Premium subscription prerequisite (TT-02)
→ **[PO-026](../operating-framework/decisions/product-owner/PO-026-premium-subscription-prerequisite.md)** · ADR-005 (accepted 2026-11-08)

- Noetia+ and NoetiaX both require an active **Individual, Duo, or Family** book subscription. Premium intelligence is an **add-on**, not a standalone replacement.
- Cancelling premium does **not** cancel the book subscription; ending the book subscription **ends** premium eligibility.
- Acquired books stay permanently owned. **Book tokens and AI usage budgets stay completely separate.** Household membership does not automatically share private knowledge, highlights, or AI conversations.
- **Open:** linked-member eligibility and qualifying states (TT-15); prices, billing structure, lifecycle and grace (TT-16). Supersedes in substance PO-022/PO-023 independence wording (PR #12); amendment text pending acceptance.

### PO-027 — Research session book limits (TT-04)
→ **[PO-027](../operating-framework/decisions/product-owner/PO-027-research-session-book-limits.md)** · ADR-006 (accepted 2026-11-08)

- Noetia+ **3** books, NoetiaX **10** books per research session; **every selected book counts**, including public domain.
- Verified, AI-eligible public-domain editions may be selected without adding them to the library. Copyright and edition eligibility are verified **independently of ownership**.
- The set **locks at the first analysis turn**; changes need a new or forked session. Limits are **enforced server-side**.

### PO-028 — My Knowledge and Ask My Highlights (TT-05)
→ **[PO-028](../operating-framework/decisions/product-owner/PO-028-my-knowledge-and-highlight-boundary.md)** · ADR-006 (accepted 2026-11-08)

- Full-book research stays restricted to the session's selected books.
- **Ask My Highlights** may search and answer questions over the user's own highlights **across the whole personal library**, independently of the 3/10 limit, with **its own AI usage controls**.
- Highlight access must not become an indirect route to full-book retrieval. Highlights and AI conversations are private to the individual account. This Book / My Knowledge / Expand remain distinct (PO-003).
- **Open:** book-permission treatment of saved quotations in highlight answers (TT-27), semantic search and tier placement (TT-25), provider disclosure (TT-22), thresholds (TT-13).

### PO-030 — Three-tier architecture governance (TT-21)
→ **[PO-030](../operating-framework/decisions/product-owner/PO-030-three-tier-architecture-governance.md)**

- NEM-003 preserved as historical architecture. The paused NEM-006 plan is **formally superseded**, its record preserved ([governance record](../architecture/three-tier-intelligence/08-architecture-governance-record.md)).
- ADR-005 and ADR-006 prepared, and **accepted on 2026-11-08** (revision 3) after independent Product Architecture review. NEM-019 reconciled, and **approved by the PO on 2026-11-08** (revision 4); **not authorized for execution**.

### PO-031 — Development planning baseline and E1/E2 drafting (D-1) — decided 2026-11-09
→ **[PO-031](../operating-framework/decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md)**

- [P0 packet](../operating-framework/analysis/p0-pilot-decisions-packet.md) Revision 3 accepted as the **development planning baseline**: complete the product on simulated providers, with provider acquisition at a separately authorized launch-readiness gate.
- **Drafting** of the E1 and E2 mission specifications authorized. **No execution, merge, deployment, identifier reservation, provider acquisition, or AI spending** is authorized.
- The packet's provisional recommendations remain open; no earlier PO record or ADR changes.

### PO-032 — Approval of NEM-021 (E1) and NEM-022 (E2) specifications — decided 2026-11-09
→ **[PO-032](../operating-framework/decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md)**

- E1 and E2 specifications (PR #49 Revision 3, including F-1…F-4) **approved**; identifiers **NEM-021** and **NEM-022** reserved.
- **Not authorized:** execution, merge, deployment, provider acquisition, paid AI.
- Sequencing: NEM-021's contract v1 needs a Product Architecture checkpoint before ledger work; NEM-021 must be completed and accepted before NEM-022 executes.

### PO-034 — E6 research-turn decisions and NEM-024 assignment — decided 2026-11-10
→ **[PO-034](../operating-framework/decisions/product-owner/PO-034-e6-research-turn-decisions-and-nem-024-assignment.md)**

- E6 decisions D-1(a) through D-11 **approved** for documentation and final PA sign-off only:
  - backend plus one minimal bilingual web Q&A interface;
  - eligible book passages only;
  - six additive interface amendments;
  - stateless model context;
  - web first; dark simulator;
  - best-effort `unrecorded` delivery;
  - a disconnect does not cancel;
  - hidden revoked excerpts;
  - W = 10 as a test candidate with reader p95 delta ≤ 50 ms.
- Also approved: the final eligibility check, terminal database-fenced recovery, and one provisional turn per session.
- Identifier **NEM-024** assigned.
- **Not authorized:** implementation, merge, deployment, paid AI.

### PO-035 — NEM-024 specification approval and Checkpoint A authorization — decided 2026-11-10
→ **[PO-035](../operating-framework/decisions/product-owner/PO-035-nem-024-specification-approval-and-checkpoint-a-authorization.md)**

- NEM-024 specification **approved** (reviewed `2e0cb54`; PA sign-off granted).
- **Checkpoint A only** authorized; B–E, merge, deployment, production providers or indexing, and infrastructure are not.
- Pre-execution check: **blocked** (B-1 protected NEM-023 test; B-2 specification gap).

### PO-049 — NEM-024 E-1 architecture validation (diagnostic and architectural validation only); PO-048 accepted as diagnostics — decided 2026-11-11
→ **[PO-049](../operating-framework/decisions/product-owner/PO-049-nem-024-e1-architecture-validation-authorization.md)**

- **A:** PO-048 accepted as a completed diagnostic investigation (not its remedy).
- **B:** PO-045 provisional; PO-046 and PO-048 accepted as diagnostics; PO-047 conditional for development progression (risks retained). **E-1 OPEN; Checkpoint E NOT QUALIFIED; release BLOCKED.**
- **C:** bounded validation of F-48-1 (is the single-lexeme hybrid exact?), F-48-2 (benchmark representativeness, governing benchmark unchanged) and F-48-3 (at most two further exact strategies).
- **Not authorized:** any `src`/SQL/migration/index/config change, approximate ranking, benchmark revision, infrastructure, merge, deploy, activation, PO-050.

### PO-048 — NEM-024 E-1 ranking investigation (diagnostic only); PO-047 accepted conditionally — decided 2026-11-11
→ **[PO-048](../operating-framework/decisions/product-owner/PO-048-nem-024-e1-ranking-root-cause-investigation-authorization.md)**

- **A:** PO-047 is accepted **conditionally for development progression**, not for release. Retained risks: the thin W=10 `p3x3` margin (1.8 ms), large-book memory under 512 MB, and representativeness.
- **Statuses:** PO-045 provisional; PO-046 accepted as diagnostics.
- **B:** a diagnostic-only E-1 investigation of PostgreSQL ranking versus the other retrieval stages. Exact-result equivalence is mandatory; candidate caps are lossy unless proven otherwise.
- **Not authorized:** any `src`/SQL/index/migration/configuration change, caps, infrastructure, merge, deploy, activation. **E-1 stays OPEN.**
- **Executed 2026-11-11** ([report](../reports/2026-11-11-NEM-024-po-048-e1-ranking-investigation.md)): bottleneck is per-row `ts_rank_cd` plus the TOAST `tsvector` fetch. Best exact candidate: E-1 p95 264 ms (not met). **Recommended (unapproved):** inline `tsv` storage + exact single-lexeme hybrid, plus a PO decision on multi-term ranking.

### PO-047 — NEM-024 Q-11 remediation (C + A) and requalification — decided 2026-11-11
→ **[PO-047](../operating-framework/decisions/product-owner/PO-047-nem-024-q11-remediation-and-requalification-authorization.md)**

- **Authorized:**
  - `--single-threaded-gc` on the API process only;
  - a production-safe, byte-exact presigned S2 read into a validated preallocated buffer;
  - tests and requalification (≥ 3 valid runs per workload).
- **Unchanged:** Q-11 50 ms (per endpoint, every run, never averaged), E-1, AC-11/P-2, ten books, 1 vCPU / 512 MB.
- **PO-045:** still provisional.
- **PO-046:** accepted as completed diagnostics.
- **Not authorized:** other flags or strategies, infrastructure, contracts, merge, deploy, activation. A failing valid run → STOP.
- **Executed 2026-11-11** ([report](../reports/2026-11-11-NEM-024-po-047-q11-remediation-and-requalification.md)): Q-11 met in all 9 required valid runs; minimum margin 1.8 ms (W=10 p3x3); E-1 open; awaiting PA review and PO acceptance.

### PO-046 — NEM-024 residual Q-11 investigation (diagnostic only); PO-045 retained provisionally — decided 2026-11-11
→ **[PO-046](../operating-framework/decisions/product-owner/PO-046-nem-024-residual-q11-performance-investigation-authorization.md)**

- **A:** PO-045 stays on the Draft branch **provisionally**: not accepted, not release-authorized.
- **B:** diagnostic investigation only, covering storage-fetch overhead, CPU-quota contention, remaining main-thread work, the minimal next remedy, and the single-container boundary.
- **Unchanged:** Q-11 50 ms, E-1, PO-027 ten books, AC-11/P-2. **Not authorized:** any `src` remedy, configuration, infrastructure, contract, merge, deploy, activation. STOP for PA review.
- **Executed 2026-11-11** ([report](../reports/2026-11-11-NEM-024-po-046-residual-performance-investigation.md)): residual cause = storage read + V8 parallel GC under 1 vCPU. **Recommended (unapproved):** `--single-threaded-gc` + a leaner presigned read, with ≥3-run requalification. Q-11 still open.

### PO-045 — NEM-024 Q-11 performance remediation (Option D + A, limited scope) — decided 2026-11-11
→ **[PO-045](../operating-framework/decisions/product-owner/PO-045-nem-024-q11-performance-remediation-authorization.md)**

- **Authorized:** one bounded S2 worker thread per API process (SHA-256 via `computeTextHash`, strict UTF-8 validation, passage slicing) plus byte-level code-point slicing; tests, documentation, report.
- **Unchanged:** Q-11 (reader p95 Δ ≤ 50 ms, sampler off; W=10/6/3 scenarios; 10-book admitted at W=10), E-1 target, AC-11/P-2 (re-read + re-verify, no cache), fail-closed `stale`/`unavailable`.
- **Not authorized:** ranking SQL, infrastructure/config/runtime flags, concurrency or thresholds, contracts, schema, merge, deploy, activation, further remedies. STOP for PA review.
- **Executed 2026-11-11** ([report](../reports/2026-11-11-NEM-024-po-045-q11-remediation-report.md)): implemented, tests green; **Q-11 still not qualified** (W=10, W=6 fail; W=3 passes); E-1 open. Awaiting PA review and PO decision.

### PO-044 — NEM-024 Q-11 root-cause investigation (diagnostic only) — decided 2026-11-10
→ **[PO-044](../operating-framework/decisions/product-owner/PO-044-nem-024-q11-root-cause-investigation-authorization.md)**

- **Diagnostic investigation only:** the causes of the Q-11 reader degradation, E-1 retrieval p95, and the N-3 one-second outliers.
- **Checkpoint E stays NOT QUALIFIED — Q-11 BLOCKING.**
- **Not authorized:** remedies, production code, contract changes, worker threads, infrastructure, concurrency or target changes, merge, deploy, activation.

### PO-042 / PO-043 — NEM-024 Checkpoint D accepted; Checkpoint E authorized — decided 2026-11-10
→ **[PO-042](../operating-framework/decisions/product-owner/PO-042-nem-024-checkpoint-d-formal-acceptance.md)** · **[PO-043](../operating-framework/decisions/product-owner/PO-043-nem-024-checkpoint-e-authorization.md)**

- **Checkpoint D accepted** for development progression, including F-D1 (privacy), F-D2 (idempotency), and F-D3 (cancellation).
- **Limitations preserved:** tab-only recovery; 15-minute storage expiry; older unknown turn after a newer question and reload; web coverage below its gate.
- **Checkpoint E authorized:** final verification and performance qualification only (regression, builds, Q-11 W=10→6→3, coverage, safety, exception register).
- **Not authorized:** merge, deployment, activation, paid providers, infrastructure, contract changes.

### PO-040 / PO-041 — NEM-024 Checkpoint C accepted; Checkpoint D authorized — decided 2026-11-10
→ **[PO-040](../operating-framework/decisions/product-owner/PO-040-nem-024-checkpoint-c-formal-acceptance.md)** · **[PO-041](../operating-framework/decisions/product-owner/PO-041-nem-024-checkpoint-d-authorization.md)**

- **Checkpoint C accepted** for development progression. Decisions recorded:
  - D-C1: SSE content released per turn, after Gateway validation and confirmed persistence (except D-8).
  - D-C2: stage names `checking` / `searching` / `composing`.
  - D-C3: after the stream opens, errors are `terminal` events with `statusCode`; HTTP 200 is not success.
- **New non-blocking risk:** SSE proxy idle timeout (no heartbeat), to be evaluated at Checkpoint E. All PO-038 exceptions are preserved; none closed.
- **Checkpoint D authorized:** the minimal bilingual web Q&A at `/research/[sessionId]` only.
- **Excluded:** session creation, selection, and management; navigation entries; user knowledge; Brief; NoetiaX; mobile; reader changes; providers; activation.

### PO-039 — NEM-024 Checkpoint C authorization (SSE transport and capability probe) — decided 2026-11-10
→ **[PO-039](../operating-framework/decisions/product-owner/PO-039-nem-024-checkpoint-c-authorization.md)**

- Checkpoint C only: `POST …/turns/stream` (stage / segment+delta after validation / terminal; disconnect ≠ cancel; D-8 never shown as persisted) and `GET /knowledge/sessions/capabilities` (before `:id`; no monetary or provider values).
- No exception waived. Not authorized: D–E, merge, deployment, activation, paid providers, infrastructure.

### PO-038 — NEM-024 Checkpoint B formal acceptance — decided 2026-11-10
→ **[PO-038](../operating-framework/decisions/product-owner/PO-038-nem-024-checkpoint-b-formal-acceptance.md)**

- Checkpoint B accepted for development progression (reviewed `a127c89`): fenced recovery, cancellation including Amendment 2, history, citation redaction, F-1 mapping, and the weighted guard. The PO-036 recovery condition is satisfied at the development checkpoint level.
- Not waived: E-1, E-2 (80.07% evidence; closing it needs a separate decision), NEM-022 coverage, D-8, cancellation-record persistence, in-process-only cancellation, Q-11, TT-14.
- Not authorized: C–E, merge, deployment, activation, paid providers, infrastructure.

### PO-036 / PO-037 — NEM-024 Checkpoint A conditional acceptance, Checkpoint B authorization, Amendment 2 — decided 2026-11-10
→ **[PO-036](../operating-framework/decisions/product-owner/PO-036-nem-024-checkpoint-a-conditional-acceptance-and-checkpoint-b-authorization.md)** · **[PO-037](../operating-framework/decisions/product-owner/PO-037-nem-024-checkpoint-b-amendment-2-cancellation-before-lock.md)**

- Checkpoint A accepted (conditional). Checkpoint B authorized with a release condition: stranded turns recovered before any user-facing release.
- Amendment 2 (Option B): a cancel before lock commit leaves no lock and no turn count, and writes a terminal `cancelled` record.
- Not authorized: C–E, merge, deployment, activation.

### Still open in the three-tier package
TT-01 purchased-token expiry · TT-12 verified AI-eligible launch corpus and rights · NoetiaX depth and evaluation criteria (TT-07) · AI budget values and resets (TT-09, TT-11) · premium pricing and Stripe architecture (TT-16) · quotation and anti-reconstruction thresholds (TT-13) · retention and export (TT-14) · legal disclosures and provider data handling (TT-22). **PO-025** (three-tier structure) was **decided on 2026-11-08** with TT-01 kept open; draft **PO-029** (eligible corpus) remains **not decided**. See [`05-open-decisions.md`](../architecture/three-tier-intelligence/05-open-decisions.md).

---

## Blockers closed by these decisions
The three principal NEM-003 blockers are **resolved**:
1. Provider architecture / economic philosophy → **PO-001 / ADR-001.**
2. General copyright / quotation architecture → **PO-002 / ADR-002.**
3. Grounded-only vs broader model knowledge → **PO-003 / ADR-003.**

## Still open (subordinate) — not resolved here
Final retail price · exact fair-use/quotation technical thresholds · final AI fair-use limits · exact provider selection · exact model selection · publisher-contract language · final customer-facing intelligence-mode names · final UX presentation. See [`20-open-product-decisions.md`](20-open-product-decisions.md).

## Legal
This document is **product policy, not legal advice.** Before commercial rollout of licensed-content AI features, obtain legal review of licensing agreements, quotation policies, publisher AI permissions, content-processing terms, and provider data handling. The architecture is deliberately configurable so it is not blocked on that review.
