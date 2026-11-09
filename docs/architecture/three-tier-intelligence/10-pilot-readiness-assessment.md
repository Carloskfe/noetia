# 10 — Noetia+ / NoetiaX Pilot-Readiness Assessment

> **DRAFT — assessment only. Not a decision, not a mission, not an authorization.** It approves no price, budget value, token rule, provider, pilot participant, or mission. Every value marked *(candidate)* is a proposal for the Product Owner. Prices are **unverified external data** (§4.1). Prepared 2026-11-09 for independent Product Architecture review.

**Inputs (not restated here):** PO-025…028, PO-030 (decided) · PO-029 (draft) · ADR-001…006 · [04 Entitlements and budgets](04-entitlements-and-budgets.md) · [05 Open decisions](05-open-decisions.md) · [06 Roadmap T2–T9](06-implementation-roadmap.md) · [07 Rights requirements](07-rights-verification-requirements.md) · [09 NEM-019 technical note](09-nem-019-control-plane-technical-note.md) · [NEM-019 report §0.1](../../reports/2026-11-09-NEM-019-implementation-report.md#01-product-owner-acceptance-2026-11-09) · [NEM-003 cost model](../../noetia-plus/07-cost-and-usage-model.md).

Tier definitions (Noetia / Noetia+ / NoetiaX) and the **3-book and 10-book** session limits are unchanged throughout. Sequencing NoetiaX later in a pilot does not redefine it.

---

## 1. Executive recommendation

1. **Run the pilot in two steps:** an **internal real-AI pilot first** (Option B), then a **limited external pilot** (Option C) only if B passes its exit criteria. Do **not** run a simulated-provider pilot as a separate stage (Option A): it cannot measure the two unknowns that matter, answer quality and cost, and its useful parts are already covered by NEM-019's tests and each mission's acceptance tests.
2. **Pilot Noetia+ (≤ 3 books) first; hold NoetiaX real-user access** until retrieval exists and TT-07 defines its depth. Ten median books (~1.5 M tokens) do not fit a 1 M-token context, so NoetiaX cannot use the cheapest path to a first pilot (full-book context). It needs the retrieval work in roadmap T3. Include NoetiaX in the internal pilot only as a measured experiment, if at all.
3. **Use full-book context with prompt caching as the pilot's quality baseline, and measure it against retrieval-sized context.** For 1–3 books, full-book context avoids pgvector and embeddings (T3) for the pilot entirely. At the prices in §4 it costs roughly **8× the PO-001 normal-user COGS guideline** (~$1.50/month) under expected use, so it is a *measurement baseline, not a commercial architecture*. The pilot exists to learn how much quality retrieval loses for how much cost saved.
4. **Corpus: 6–10 verified public-domain works, original-language only (no translations), split between Spanish and English**, chosen to be conservatively safe across the target jurisdictions, and **legally reviewed** (TT-12, TT-26). The catalogue's `isFree` flag counts for nothing.
5. **Bound spend structurally in four layers:**
   - the NEM-019 PostgreSQL ledger (per-user and global allowances);
   - a cost-aware per-turn reservation (a new delta, §5.2);
   - a hard per-turn context and output ceiling;
   - a provider-side workspace spend limit as an independent backstop.

   Candidate internal-pilot exposure ceiling: **≤ $150 for one month** *(candidate; PO decides)*.
6. **Smallest mission path:** about 6 small missions (§7), mostly extending NEM-019 behind its existing flag, run first on **staging** (which avoids production migrations until the external step), plus a decisions packet the PO answers before any code.

---

## 2. Pilot options and trade-offs (A)

| | **A. Simulated-provider pilot** | **B. Internal real-AI pilot** | **C. Limited external real-user pilot** |
|---|---|---|---|
| Who | Staff, internal accounts | 3–5 staff with qualifying subscriptions *(candidate; TT-23)* | 15–30 invited subscribers *(candidate)* |
| Where | Staging | **Staging** (after the staging-isolation fix, NEM-017/S19) | Production (needs F-6 deployment authorization) |
| Validates | UI flow, limits, locks, error UX | **Answer quality, citations, cost per session, latency, reader isolation under real calls, ledger vs invoice** | Willingness to use, retention, real cost distribution, support load |
| Cannot validate | Quality, cost, latency | Real-user behaviour; heavy-tail cost | — |
| New legal surface | None | Provider data handling (PO-005); internal consent | **Terms and Privacy (TT-22)**, quotation thresholds (TT-13), retention (TT-14) |
| AI spend | $0 | Low, capped (§4.5) | Moderate, capped |
| Engineering beyond NEM-019 | UI + flag deployment | + real Gateway adapter, cost-aware reservation, rights adapters, staging deploy | + production deploy, F-2, F-5, F-7, F-9 gates |
| Reversibility | Trivial | Flag off; revoke key and grants | Flag off; revoke grants; communication to participants |
| **Value / risk** | Low value; its tests belong in mission acceptance | **Highest learning per dollar and per unit of risk** | Needed before launch; only after B |

**Recommendation: B, then C.** Option A is folded into the acceptance tests of the UI and Gateway missions (§7).

---

## 3. Minimum prerequisites (blockers versus later)

### 3.1 Blockers for the internal pilot (B)

| # | Prerequisite | Type | Source |
|---|---|---|---|
| B1 | Provider selection and data-handling review: what book text and questions are sent, retention, training use, region | **PO** (PO-005) | 07 §6 |
| B2 | Who may participate without a book plan, if anyone; which subscription states qualify for the pilot | **PO** (TT-23; TT-15 subset) | PO-026 has no pilot exception |
| B3 | Pilot corpus, verifier, evidence standard, and jurisdictions | **PO + legal** (TT-12, TT-26) | 07 §3–§5 |
| B4 | Pilot spend ceilings: per-user allowance, global allowance, overall unresolved bound, provider spend limit | **PO** (values) | TT-09 measurement only |
| B5 | NEM-019 production-readiness deltas: multi-dimension rate card, cost-aware reservation, provider usage mapping (§5.2) | Engineering | This assessment |
| B6 | Adapters: `TextIdentityPort`, `RightsVerificationAuthorityPort` (pilot manifest), `QualifyingPlanPort` (pilot subset), full-book `ContextSourcePort` | Engineering (after B2, B3) | NEM-019 report §0.1 |
| B7 | Real Gateway provider adapter behind the flag, kill switch, timeouts, concurrency cap; router allowlist change explicitly authorized | Engineering | Roadmap T4 |
| B8 | Minimal web UI for sessions (≤ 3 books, ask, citations), en/es, behind the flag | Engineering | Roadmap T5 (subset) |
| B9 | Staging isolation fixed (S19 / NEM-017) and migrations 069+ deployed to **staging** | Engineering + deployment authorization | F-6 applies to production, not staging |
| B10 | Evaluation set and thresholds for citation accuracy and grounding (T2-lite), with its own spend limit | PO approves thresholds; engineering builds | Roadmap T2 |
| B11 | Internal participant consent for AI processing (instead of public Terms) | **PO** (TT-22 scope) | TT-22 |

### 3.2 Additional blockers for the external pilot (C)

TT-22 Terms and Privacy · TT-13 quotation thresholds and **F-2** cross-session reconstruction accounting · TT-14 retention of pilot conversations · production deployment under **F-6** (snapshot, GOV-001 §5.4) · **F-7** shared Redis budget · **F-9** AI content kept out of events, personas, and analytics · CI PostgreSQL job for the integration proofs (**F-10**, a CI mission) · ledger compensation runbook · **F-11** SA-003 conflicts before the three-tier stack merges.

### 3.3 Can wait until commercial launch

Billing and Stripe (T8; TT-16) · public prices and token policy (TT-01, TT-16) · customer-visible capacity UI beyond a simple indicator (TT-10) · mobile (TT-20) · Research Brief (T6; TT-17) · NoetiaX depth (T7; TT-07) · Ask My Highlights (TT-25, TT-27, F-1) · Expand with web (TT-18) · `OwnershipPort` for licensed books (F-5, NEM-013; **not needed for a public-domain-only pilot**, because ADR-006 grants public domain an access basis without ownership) · dedicated DB pool · semantic retrieval at scale (T3) · author opt-in corpus.

---

## 4. AI economics (B)

### 4.1 Price data — **must be re-verified before any spend**

Source: the Claude API reference bundled with the development tooling, **cached 2026-10-06**, first-party Claude API rates. Not checked against the live pricing page in this assessment. Amazon Bedrock and Vertex AI price separately. **No other provider was evaluated** (PO-005 keeps the Gateway provider-agnostic; others need their own verified rate cards).

| Model (illustrative) | Context | Input $/M | Output $/M | Cache write 5-min / 1-h ($/M) | Cache read $/M |
|---|---|---|---|---|---|
| Claude Haiku 5.5 | 1 M | 0.10 (≤ 100 K prompt) · **0.50 (> 100 K)** | 0.50 · **2.50 (> 100 K)** | ×1.25 / ×2 of input *(verify)* | ≈ 0.1× input *(unverified for this model)* |
| Claude Sonnet 5.5 | 1 M | 2.00 | 10.00 | 2.50 / 4.00 | 0.20 |
| Claude Opus 5.5 | 1 M | 4.00 | 20.00 | 5.00 / 8.00 | 0.20 |
| Claude Fable 5.1 | 1 M | 10.00 | 50.00 | 12.50 / 20.00 | 0.25 |

Caching rules (same source): prefix match; up to 4 breakpoints; minimum cacheable prefix 512 tokens on these models; 5-minute default TTL refreshed on each read; 1-hour TTL at 2× write cost; batch processing at 50% (not useful for interactive turns; useful for evaluation runs). Thinking tokens are billed as output. **Verify:** live prices, long-context surcharges (only Haiku's tier is listed), Haiku 5.5 cache-read price, and whether token counting is free.

**Fable 5.1 is excluded from the pilot:** a full-context worst-case turn costs about $6.

### 4.2 Workload assumptions *(to be measured in the internal pilot)*

| Parameter | Low | Expected | High | Basis |
|---|---|---|---|---|
| Tokens per word | EN ~1.3 · ES ~1.6 | | | Estimate; measure on the corpus |
| Tokens per book | ~60 K (short) | **~150 K (median)** | ~300 K+ (long) | 40 K / 100 K / 200 K words. Outliers (e.g. *Don Quijote* ES) exceed 600 K |
| Books per session (Noetia+) | 1 | 2 | 3 | Limit 3 (PO-027) |
| Turns per session | 3 | 8 | 15 | |
| Output tokens per turn (answer + thinking) | 1.5 K | 3 K | 8 K | Effort-dependent |
| Cold cache misses per session (pause > 5 min) | 0 | 1 | 3 | User behaviour |
| Sessions per month | 2 | 6 | 20 | |
| Retrieval-sized context per turn | — | ~20 K | ~40 K | 12–25 passages plus system prompt |

### 4.3 Per-turn cost (median books)

| Strategy · model | First or cold turn (cache write) | Warm turn (cache read) | Worst-case turn (3 books, 8 K output, cold) |
|---|---|---|---|
| Full context, 1 book (150 K) · Sonnet 5.5 | ~$0.41 | ~$0.06 | — |
| Full context, 3 books (450 K) · Sonnet 5.5 | ~$1.16 | ~$0.12 | **~$1.21** |
| Full context, 3 books · Opus 5.5 | ~$2.31 | ~$0.15 | ~$2.41 |
| Full context, 3 books · Haiku 5.5 | ~$0.29 | ~$0.03 *(unverified read price)* | ~$0.30 |
| Retrieval (~20 K) · Sonnet 5.5 | ~$0.07 | ~$0.07 | ~$0.16 (40 K, 8 K out) |
| Retrieval (~20 K) · Haiku 5.5 | ~$0.004 | ~$0.004 | ~$0.01 |

Formula: `cost = cachedRead × p_read + cacheWrite × p_write + uncachedIn × p_in + out × p_out`. Note that Opus 5.5 and Sonnet 5.5 have the **same cache-read price** ($0.20/M). Once a cache is warm, the input side of Opus costs no more than Sonnet; the difference lies in writes and output.

### 4.4 Monthly cost per active user (Noetia+)

| Scenario | Full context · Sonnet 5.5 | Full context · Opus 5.5 | Retrieval · Sonnet 5.5 | Retrieval · Haiku 5.5 |
|---|---|---|---|---|
| **Low** (2 × 3 turns, 1 book) | ~$1.1 | ~$2 | ~$0.4 | < $0.05 |
| **Expected** (6 × 8 turns, 2 books, 1 cold miss) | **~$12.6** | ~$23 | **~$3.4** | ~$0.2 |
| **High** (20 × 15 turns, 3 books, 3 cold misses, 8 K output) | ~$113 | ~$205 | ~$36–48 (20–40 K context) | ~$2 |

High users exceed any candidate per-user allowance in §4.5 by design. The allowance, not the user, sets their cost.

Against PO-001's guideline (normal-user AI COGS ≤ ~$1.50/month; bands 15/25/35% of revenue), **full-book context is not commercially viable at these prices**. Retrieval on a mid-tier model is about 2× over the guideline under expected use. Cheap-tier retrieval and routing fit under it, if quality holds. These are the trade-offs the pilot must measure. **No price or allowance is chosen here** (TT-09, TT-16).

Levers, in order of effect:
1. Context strategy (full versus retrieval).
2. Model routing per turn type.
3. Cache warmth: keep-alive or 1-hour TTL for sessions with pauses.
4. Cross-user cache sharing of **book-text-only prefixes**. 04 §cache forbids sharing anything with notes, highlights, or conversation; public-domain book text is not user content. A canonical book order lets the most common first book be shared.
5. Output and thinking effort.
6. Batching evaluation runs (50%).

### 4.5 Worst-case spending exposure

With NEM-019 plus the §5.2 deltas, monthly spend is bounded by:

```
spend ≤ min(Σ per-user allowances, global allowance)
      + overall unresolved bound          (in-flight reservations not yet settled)
      ≤ provider workspace spend limit    (independent backstop outside Noetia)
```

**This holds only if each reservation is at least the worst-case cost of its turn** (§5.2 D1). The pre-call worst case is computable: known context tokens at the uncached write price, plus `max_tokens` at the output price. For example, ~$1.21 per Sonnet 5.5 turn at 3 × 150 K and 8 K output.

| | Internal pilot *(candidate)* | External pilot *(candidate)* |
|---|---|---|
| Participants | 3–5 | 15–30 |
| Per-user monthly allowance | ~$20 | ~$15 |
| Global monthly allowance | ~$150 | ~$400 |
| Provider spend limit (backstop) | ~$200 | ~$500 |
| Evaluation runs (T2-lite) | ≤ $50, batched | — |
| **Maximum exposure** | **≈ $200** | **≈ $500** |

All values are candidates for the PO (B4). The structural point is that exposure is capped by configuration, not by user behaviour.

---

## 5. Existing control plane — production-readiness review (D)

### 5.1 What NEM-019 already provides (reuse as is)

The deny-first resolver and versioned 3/10 policies; grants (pilot cohort control); flags and rollout; session limits under `FOR UPDATE`; the turn order; the Context Builder invariant and model-path registry; default-deny rights with the F-12 authority boundary; the PostgreSQL ledger with global serialization (B-6), idempotent settlement, and reconciliation; account deletion by `CASCADE`; Prometheus counters. **None of these need redesign for a pilot.**

### 5.2 Gaps a real provider exposes (engineering deltas)

| # | Gap | Why it matters | Delta (additive) |
|---|---|---|---|
| **D1** | Reservation is a fixed `reserveUnitsPerTurn` | A cold full-context turn (~$1.16) can far exceed a fixed reservation, so the ledger under-reserves and the global cap is only bounded by concurrency | Cost-aware reservation: reserve the computed worst case (context tokens × uncached/write price + `max_tokens` × output price); settle the actual |
| **D2** | Rate card holds one `microUsdPerUnit` | Providers price input, output, cache write (two TTLs), cache read, and long-context tiers separately | Multi-dimension rate card (additive migration); settlement computes cost per token class |
| **D3** | Usage is a single `unitsReported` | Settlement needs per-class usage; thinking is billed as output | Gateway maps provider usage (input, cache read/write, output) to the ledger's units and cost |
| **D4** | Units versus cost | ADR-005 keeps allowances in internal units so price changes do not shrink capacity | Engineering keeps that separation; the **unit definition and allowances are PO values** (B4) |
| **D5** | Router refuses non-simulated providers by design | Correct for NEM-019; a real adapter needs an explicitly authorized change | Adapter mission changes the allowlist under authorization; kill switch tested |
| **D6** | No context source | Full-book context must load only selected, eligible books | `ContextSourcePort` adapter reading stored text for the post-lock allowed set; the invariant already enforces scope |
| **D7** | Turns run inside the API process; dedicated pool deferred | Full-context turns can take tens of seconds; long-held connections risk reader latency (Reader Stability First) | Pilot-wide concurrency cap, strict timeouts, and a reader p95 stop rule; consider worker offload before C |
| **D8** | Adapters unbound | Every request denies | `TextIdentityPort` (hash of the stored object), `RightsVerificationAuthorityPort` (pilot manifest, §6.3), `QualifyingPlanPort` (pilot subset after B2). `OwnershipPort` not needed for public domain |
| **D9** | Provider-side data | Ledger rows cascade on deletion; provider logs do not | Covered by PO-005 review (retention, zero-retention options); document in the consent text |
| **D10** | CI has no PostgreSQL (F-10) | Concurrency proofs run only locally | Separate CI mission before C |
| **D11** | Migrations 069–072 not deployed (F-6) | Merging creates production tables | Staging deployment for B; production deployment authorization for C |
| **D12** | Shared Redis (F-7) | The admission cache shares 256 MB `noeviction` with authentication | Memory budget and monitoring before C |
| **D13** | No UI | Participants need a surface | Minimal web UI behind the flag (B8) |

---

## 6. Book rights (C)

### 6.1 Public-domain-first: sound, but narrower than the catalogue

The free library is mostly public domain *by intent*, but `isFree`, catalogue source, and sync quality are **never evidence** (ADR-006; 07 §2). Today no book is eligible, which is correct.

### 6.2 Minimum compliant pilot corpus *(candidate screening heuristic; not a legal determination)*

For a pilot, choose titles that are **obviously** safe rather than titles that are merely defensible:
- **original-language works only** (no translations; a translation carries the translator's term);
- **author died before 1926 and work first published before 1930**. That is chosen to clear long terms such as Mexico's life + 100 and Spain's life + 80 for pre-1987 deaths, as well as US publication-based rules. **Legal review must confirm** (TT-26);
- **stored edition free of modern editorial material** (introductions, notes, modern spelling revisions), or that material removed before hashing;
- **6–10 titles, about half Spanish and half English**, small enough to verify carefully and to fit the evaluation set (T2);
- **known traps** to exclude, for example: the King James Version (perpetual Crown rights in the UK); modern critical editions of old works; any LibriVox-derived text.

### 6.3 Text identity and verification authority

- **Text identity:** `TextIdentityPort` returns the SHA-256 of the exact stored object (`books.textFileKey`), cached by object ETag. A re-ingested text changes the hash, so its rights record no longer matches and the book reverts to `unknown` (07 §4), which is the intended behaviour.
- **Verification authority for the pilot:** a **reviewed rights manifest** kept in the repository. It lists `(catalogue key, textHash, basis, jurisdictions, verifier, date, evidence links)` and is approved by pull request by the named verifier (TT-26). The adapter attests a `book_ai_rights` row only if a manifest entry matches. That is two keys: a complete database row **and** a reviewed manifest entry.
  - Change control is git history plus review, with no new infrastructure.
  - Trade-off: updating the corpus needs a deployment, which is acceptable at 6–10 titles.
- **Before commercial scale:** a restricted database role or append-only audit for `book_ai_rights` (an infrastructure mission), and author/publisher opt-in records.

---

## 7. Proposed mission sequence (F) — **proposals only; none created, approved, or executed**

| # | Mission (working title) | Type · authorization needed | Depends on | Acceptance (summary) | Rollback |
|---|---|---|---|---|---|
| **P0** | Pilot decisions packet | PO decisions; documentation only | This assessment | B1–B4, B10 thresholds, B11, and TT items in §8 answered and recorded | n/a |
| **M1** | Ledger cost model for real providers (D1–D4) | Implementation, dark; additive migration | NEM-019 merged to the stack | Reservation ≥ computed worst case; per-class settlement exact on fixtures; B-6 and F-12 tests still pass; caps cannot be exceeded under concurrency with variable turn costs | Revert the migration (additive); flag off |
| **M2** | Rights and text adapters (D8, §6.3) | Implementation, dark | P0 (TT-26 verifier), M1 optional | Unmanifested or stale-hash rows denied; manifest change requires review; still no real book attested until P0 names the corpus | Remove the binding (falls back to the unbound deny) |
| **M3** | Pilot entitlement adapter (QualifyingPlan subset) | Implementation, dark | P0 (TT-23, TT-15 subset) | Only the PO-defined subset qualifies; linked members and other states stay `unknown`; architecture tests show no write to plans or subscriptions | Unbind the adapter |
| **M4** | Real Gateway adapter and evaluation run (D3, D5, D6, D7; T2-lite, T4 subset) | Implementation + provider credentials on **staging**; spend-capped | P0 (PO-005, caps), M1 | Kill switch tested; provider workspace spend limit set; evaluation thresholds measured; per-turn cost within ±30% of §4.3; reader p95 unchanged under a concurrent turn load | Revoke the key; flag off |
| **M5** | Minimal web session UI (B8) | Implementation, behind the flag; i18n web en/es | M1–M4 | ≤ 3-book selection, lock and fork UX, citations, safe error copy (no model names, no "Basic"); reader unaffected with the flag on and off | Flag off |
| **M6** | Staging deployment and internal pilot operation | Deployment authorization (staging) + operation; report | M1–M5, B9 | Pilot runs for 2–4 weeks within caps; §9 exit criteria reported with raw ledger-versus-invoice reconciliation | Flag off; revoke grants and key; migrations remain on staging only |
| M7+ | External-pilot gates (§3.2), each its own mission | Several | M6 passes | Per gate | Per gate |

NoetiaX real-user access follows T3 (retrieval) and T7 (TT-07) and is not on this path.

---

## 8. Open Product Owner decisions (by existing ID)

| Needed for | Decision | ID |
|---|---|---|
| B | Provider(s) and data handling | PO-005 |
| B | Pilot participants without a book plan, if any | **TT-23** |
| B | Which subscription types and states qualify (at least the pilot subset); linked members | **TT-15** |
| B | Pilot corpus | **TT-12** (PO-029 draft) |
| B | Evidence standard, named verifier, jurisdictions | **TT-26** |
| B | Internal consent versus public Terms; Terms for C | **TT-22** |
| B | COGS target and band denominator (the pilot only measures) | TT-09 |
| B | Behaviour at the limit (candidate for the pilot: hard stop with a plain message) | TT-11 |
| B | What participants see about capacity | TT-10 |
| B | Noetia+ depth on agreements and contradictions | TT-08 |
| B | Expand: model knowledge only, no web (candidate) | TT-18 |
| C | Quotation and reconstruction thresholds (F-2) | TT-13 |
| C | Retention of pilot conversations after the pilot | TT-14 |
| Later | NoetiaX depth (gates NoetiaX real-user access) | TT-07 |
| Later | Prices, billing, token expiry | TT-16, TT-01 |
| Later | Ask My Highlights search and permissions | TT-25, TT-27 |
| Later | Brief formats · mobile | TT-17 · TT-20 |
| Any | Anonymized cost-record retention after deletion | B-2 (PO/PA) |
| B | Pilot ceiling values (allowances, overall bound, provider limit) | B4 (values; TT-09/TT-11 context) |

**Engineering implementation details** (not PO decisions, within approved values): model routing within the approved provider; context strategy and chunking; cache TTL and keep-alive; timeouts and concurrency cap; rate-card schema; reservation formula; manifest format; UI layout within the voice guide.

---

## 9. Pilot design (E)

| | Internal pilot (B) *(candidate)* | External pilot (C) *(candidate)* |
|---|---|---|
| Population | 3–5 staff, each with a qualifying subscription (or per TT-23) | 15–30 invited subscribers, mixed ES/EN |
| Capabilities | Noetia+ research sessions, 1–3 books, Q&A with citations; This Book / My Knowledge (session-scoped) | Same |
| Excluded | NoetiaX real use, Briefs, Ask My Highlights, Expand-with-web, mobile, billing | Same |
| Ceilings | §4.5; per-turn context ≤ 3 books; `max_tokens` cap; concurrency cap | §4.5 |
| Duration | 2–4 weeks | 4–6 weeks |

**Success (exit) criteria — thresholds for the PO to approve:**
- citation resolution and grounding at or above the T2 thresholds;
- **zero** cross-user or household leakage;
- **zero** unexplained scope-violation events;
- reader p95 latency unchanged versus baseline;
- ledger usage reconciles with the provider invoice within an agreed tolerance (candidate ≤ 2%);
- cost per session within ±30% of the §4 model after 20 sessions, with the full-context versus retrieval quality gap quantified;
- participant signal (candidate: majority would use it weekly).

**Stop conditions (pause immediately; flag off):**
- spend reaches 80% of the global allowance before mid-period;
- any isolation or leakage defect;
- a reader p95 regression;
- an unexplained scope violation;
- a rights challenge or a provider-terms change;
- ledger-versus-invoice divergence beyond tolerance;
- refusal or error rate above an agreed level.

---

## 10. Risks and unresolved questions

| Risk | Severity | Mitigation |
|---|---|---|
| Full-context economics mistaken for the product model | High | §4.4 states it is a baseline; T3 decision informed by the measured quality gap |
| Under-reservation without D1 | High | M1 before any real call |
| Reader degradation from long AI requests in the API process | High | D7 concurrency cap and stop rule; worker offload before C |
| Pilot corpus judged non-compliant in some jurisdiction | High | Conservative heuristic + legal review (TT-26); original-language only |
| Prices or terms change | Medium | Verified rate cards per version; provider spend limit; re-verify before M4 |
| Staging not isolated (S19) | Medium | B9 prerequisite |
| Grants misused to bypass PO-026 | Medium | TT-23 decision; grants still require a qualifying plan |
| NoetiaX perceived as delayed | Medium | Communicate sequencing; tier unchanged |

**Unresolved questions for review:**
1. Is an internal pilot on staging acceptable to the PO, or must pilot data live only in production?
2. Should the evaluation set be built from staff-written questions, PO-approved questions, or both?
3. Is cross-user caching of public-domain book-text prefixes acceptable under PO-005's provider review?
4. Which model tiers may the router use in the pilot? Engineering proposes; the PO approves spend.
5. Does the 1 M-context assumption hold on the chosen platform and region (Bedrock and Vertex differ)?

---

*Prepared under the "Pilot-Readiness Assessment" instruction (documentation only). No application code, migration, infrastructure, CI/CD, Stripe, subscription, or production setting was changed. No AI provider was called, and no AI charge was incurred.*
