# DRAFT — P0 Product Owner Decisions Packet (Noetia+ / NoetiaX pilot)

**Status:** `DRAFT — AWAITING PRODUCT OWNER REVIEW`. Decision preparation only. **No decision is made here.** No provider, model, budget, price, participant, corpus title, mission, or deployment is approved or selected.
**Date:** 2026-11-09 · **Builds on:** [Pilot-Readiness Assessment, Revision 3](../../architecture/three-tier-intelligence/10-pilot-readiness-assessment.md) (Draft PR #47) · [05 Open decisions](../../architecture/three-tier-intelligence/05-open-decisions.md) · PO-025…028, PO-030 · PO-029 (draft) · ADR-005, ADR-006 · [NEM-019](../../engineering-missions/COMPLETED/NEM-019-tier-aware-intelligence-control-plane.md).

> Existing PO records and ADRs are **not edited**. Each recommended option, once approved, would be recorded in the usual way (new PO record or amendment, PO register update), not by changing this packet.

> **Disclosure:** this packet was prepared by an AI model from one of the providers it compares (Anthropic). The comparison uses only figures quoted from each provider's official documentation (§3), and it recommends deciding the provider on data-handling grounds rather than on price.

---

## 1. Executive summary

- **Immediate PO attention: 1 decision** (G0-1): confirm the pilot direction and allow mission M1 to be drafted for approval. **No open TT item blocks M1.** M1 (the ledger cost model, dark, disposable databases only) implements a design already recorded in [04 §4](../../architecture/three-tier-intelligence/04-entitlements-and-budgets.md#4-resource-budgets): per-user allowances in units plus a global micro-USD guard.
- **Before any real AI provider is connected (Gate 1): 4 decisions.** Provider and data handling (PO-005); pilot spending figures and limit behaviour (TT-09 pilot scope, TT-11); pilot corpus and verifier (TT-12, TT-26). Plus staging authorizations, which are not TT items.
- **Before internal pilot operation (Gate 2): 5 decisions.** Participants and access (TT-23, TT-15 subset); internal consent (TT-22 internal scope); research depth and Expand (TT-08, TT-18); exit thresholds.
- **Everything else is deferrable** to the external pilot or commercial launch (§2).
- **Economics, using prices verified on 2026-11-09:**
  - a 4-person internal cohort at expected usage costs about **$46/month** (Anthropic Sonnet 5.5) or about **$89/month** (OpenAI gpt-6.1-sol) on the full-book benchmark;
  - a 50-question evaluation run costs **$1.56–$31.50** per model;
  - the providers differ by tens of dollars at pilot scale, so **the provider should be chosen on data handling (PO-005), not price**.
- **Corpus:** 10 candidate titles (5 ES, 5 EN) plus 2 alternates, all already in the catalogue, all original-language, all by authors who died before 1926. **None is verified**: each needs edition identification, a text hash, and legal review.

---

## 2. Decision gates

| Gate | Must be decided before | Decisions | Count |
|---|---|---|---|
| **G0** | The first pilot engineering mission (M1, ledger cost model) | G0-1 pilot direction | **1** |
| **G1** | Connecting a real AI provider (M4, staging, evaluation run) | PO-005; TT-09 (pilot scope) + TT-11; TT-12 + TT-26 | 4 (+ staging authorizations) |
| **G2** | Internal pilot operation (M6) | TT-23 + TT-15 (pilot subset); TT-22 (internal consent); TT-08; TT-18; exit thresholds | 5 |
| **G3** | External pilot or commercial launch | TT-13, TT-14, TT-10 (public UI), TT-16, TT-01, TT-07, TT-17, TT-20, TT-25, TT-27, B-2 retention, GOV-001 adoption, production deployment (F-6) | deferrable |

M2 (rights adapters) and M3 (entitlement adapter) can be built dark before G1 and G2. They need the G1 and G2 decisions only for the *values* they enforce (corpus manifest entries, qualifying states), not for their code.

---

## 3. Provider comparison (PO-005; TT-09; TT-11)

### 3.1 Verified facts (official documentation, read 2026-11-09)

Two providers were examined. **Google (Gemini) and others were not evaluated** in this packet; PO-005 may require it. Prices are USD per million tokens. No page showed a "last updated" date, so re-verify before any spending authorization.

| | **Anthropic** | **OpenAI** |
|---|---|---|
| Models compared | Sonnet 5.5 (mid), Haiku 5.5 (small), Opus 5.5 (high) | gpt-6.1-sol (mid), gpt-6-luna (small), gpt-6-astra (flagship) |
| Mid-tier input / output | $2 / $10 | $2 / $10 (≤ 272K input) · **$4 / $15 (> 272K)** |
| Mid-tier cache write / read | $2.50 (5-min) or $4 (1-h) / **$0.10** | $2.50 (30-min) or $5 (12-h) / $0.10 · $0.20 above 272K |
| Small-tier input / output | $0.10 / $0.50 (≤ 100K prompt) · **$0.50 / $2.50 (> 100K)** | $0.10 / $0.50 (≤ 272K) · $0.20 / $0.75 (> 272K) |
| Small-tier cache read | $0.01 · $0.05 (> 100K) | $0.01 · $0.02 (> 272K) |
| High tier input / output | Opus 5.5 $4 / $20, no long-context tier | gpt-6-astra $10 / $50 · $20 / $75 (> 272K) |
| Long-context rule | Haiku 5.5 only: whole request priced higher above 100K. Sonnet 5.5 and Opus 5.5: full 1M "at standard pricing" | Whole request priced higher above 272K input |
| Context / max output | 1M / 128K (all three) | 1.05M / 128K (all three) |
| Caching | Explicit or automatic; writes 1.25× (5-min) or 2× (1-h); reads 0.05–0.1×; minimum 512 tokens | Automatic by default (explicit mode available); writes 1.25× (30-min) or 2.5× (12-h); reads 0.05–0.1×; minimum 1,024 tokens |
| Batch | 50% | 50% |
| Training on API data | "Retained data is never used for model training without your express permission" | "Not used to train or improve OpenAI models (unless you explicitly opt in)" |
| Retention | Prompts and outputs "not retained by default" (Covered Models, e.g. Fable, need 30 days). Flagged content may be kept up to 2 years (*from a summarized part of the page; unverified*). Zero retention via sales | Abuse-monitoring logs "retained for up to 30 days". Zero retention by prior approval |
| Spend controls | Organization tier caps (e.g. $500/month at Start) **pause usage with HTTP 429**. User-set org/workspace limits return HTTP 400. Workspace limits are **not available on the default workspace** | Usage-tier monthly limits. Project/org **hard spend limit returns HTTP 429**; "spend alert" lets traffic continue |
| Sources | [pricing](https://platform.claude.com/docs/en/about-claude/pricing.md) · [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md) · [models](https://platform.claude.com/docs/en/about-claude/models/overview.md) · [rate & spend limits](https://platform.claude.com/docs/en/api/rate-limits) · [data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) | [pricing](https://developers.openai.com/api/docs/pricing) · [models](https://developers.openai.com/api/docs/models) · [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [rate & spend limits](https://developers.openai.com/api/docs/guides/rate-limits) · [your data](https://developers.openai.com/api/docs/guides/your-data) |

**Not verified:**
- OpenAI cache-write prices above 272K, and gpt-6-luna write prices (*assumed* 1.25× input).
- Whether provider hard limits stop traffic immediately or after a delay.
- Whether token counting is billed.
- Regional or data-residency uplifts. Both providers list one (about 10%); excluded from the figures below.
- OpenAI promotional pricing on other models (ends 2026-11-30).

**Correction to Assessment PS-1:** the verified Sonnet 5.5 cache-read price is **$0.10**, not the $0.20 assumed in PR #47 §4.1. PR #47 is not edited here. Its Sonnet full-context figures are slightly high: expected user $11.52 here versus $12.60 there.

### 3.2 Pilot economics under comparable workloads

Workload: the Assessment §4.2 assumptions (median book 150K tokens; low / expected / high = 2 / 6 / 20 sessions of 3 / 8 / 15 turns over 1 / 2 / 3 books, with 1 / 2 / 4 cache writes and 1.5K / 3K / 8K output). Same formulas as Assessment §4.3. Reproducible with the script in Appendix A.

**Monthly cost per user (USD):**

| Model | Full-book · low | Full-book · **expected** | Full-book · high | Retrieval 20K · expected |
|---|---|---|---|---|
| Anthropic Sonnet 5.5 | 0.90 | **11.52** | 123.90 | 3.36 |
| OpenAI gpt-6.1-sol | 0.90 | **22.32** | 235.80 | 3.36 |
| Anthropic Haiku 5.5 | 0.24 | **3.15** | 33.45 | 0.17 |
| OpenAI gpt-6-luna | 0.05 | **1.22** | 12.78 | 0.17 |
| Anthropic Opus 5.5 | 1.80 | 23.04 | 247.80 | 6.72 |
| OpenAI gpt-6-astra | 4.80 | 122.40 | 1,278.00 | 16.80 |

**Readings:**
- At 300K tokens (two median books) the full-book benchmark crosses OpenAI's 272K long-context threshold but not any Anthropic mid-tier threshold. That is why the mid tiers differ by about 2×, while low usage (one book, 150K) costs the same.
- In the small tier the order reverses: Haiku 5.5's 100K threshold applies first.
- Retrieval-sized context costs the same on both.
- With a 30-minute default cache lifetime (OpenAI) fewer turns go cold. With no cold miss, the expected user costs $7.20 (Sonnet) and $13.68 (Sol).

**Evaluation run** (50 questions × 2 books, batched, uncached worst case): Sonnet $15.75 · Sol $31.12 · Haiku $3.94 · Luna $1.56 · Opus $31.50 · Astra $155.62.

### 3.3 Recommended approach (for the PO to decide)

**Lowest cost that still tests quality meaningfully:**
1. **One provider for the pilot:** one data-processing review, one rate card, one spend-control surface.
2. **Live participant traffic on that provider's mid-tier model** with full-book context (≤ 3 books), because answer quality is what the pilot must judge.
3. **The small-tier model measured on the evaluation set only**, plus a lightweight retrieval arm (see Q5), to quantify the quality gap cheaply.
4. **No high tier** (Opus or Astra) in live traffic. Optionally, one evaluation pass as a quality ceiling ($31.50–$155.62).

At pilot scale both providers are affordable (≤ ~$90/month live for 4 people). **Choose the provider on PO-005 criteria:** retention defaults, the zero-retention path, region, contract terms, and spend-limit behaviour.

### 3.4 Proposed pilot spending figures *(PO candidates; conditional)*

| Figure | Candidate | Basis |
|---|---|---|
| Internal spending target | **~$106** (Anthropic) or **~$149** (OpenAI) for the first month | 4 users × expected ($46.08 / $89.28) + evaluation ≤ $60 (mid + small arms, with reruns) |
| Ledger global allowance (live traffic; needs M1, D14) | **$150** | ~1.7–3.3× expected live spend |
| Per-user allowance (units; set from the rate card) | **≈ $40-equivalent / month** | Covers expected usage (≈ $11.5–22) with headroom; truncates the high tail ($124–236) |
| Provider: pilot workspace alert / hard limit | **$100 / $200** | Hard limit set above the ledger so the ledger binds first |
| Provider: evaluation workspace hard limit | **$60** | Separate key (D16); not seen by the ledger |
| Behaviour at the limit (TT-11) | **Hard stop with a plain message** | Pilot only; reversible |
| Maximum financial exposure | **≈ $210 — conditional** | $150 + $60 **only if** M1 is implemented correctly **and** both provider limits stop traffic as their documentation states. Enforcement timing is unverified; overshoot during any lag is not bounded by Noetia |

Note: an Anthropic workspace limit cannot be set on the **default** workspace, and both providers apply organization-tier caps above any workspace limit.

---

## 4. Candidate pilot corpus (TT-12; TT-26)

### 4.1 Candidates *(none verified; none eligible in any environment)*

Selection rule (Assessment §8.2): original-language works only; author died before 1926; first published before 1930. All titles are already in the catalogue (`services/api/src/ingestion/catalogue.ts`), so the stored text exists. **The catalogue chose editions for audio-sync fit, not for rights** (07 §1).

| # | Title | Author (died) | First published | Lang. | Catalogue source | Likely public domain (screening) | Digital-text questions |
|---|---|---|---|---|---|---|---|
| 1 | *Marianela* | Benito Pérez Galdós (1920) | 1878 | ES | es.wikisource "Marianela" | US (pre-1931); ES life+80; MX life+100; CO, AR, CL, PE, EU | Which printed edition the transcription follows; modern orthography; Wikisource contributor material (CC BY-SA) |
| 2 | *Doña Perfecta* | Benito Pérez Galdós (1920) | 1876 | ES | es.wikisource "Doña Perfecta" | as #1 | as #1 |
| 3 | *María* | Jorge Isaacs (1895) | 1867 | ES | es.wikisource "María (Isaacs)" | as #1 (Colombian author) | as #1 |
| 4 | *Pepita Jiménez* | Juan Valera (1905) | 1874 | ES | Project Gutenberg #17223 | as #1 | Gutenberg header/licence removal; any editor's introduction or notes in that edition |
| 5 | *El sombrero de tres picos* | Pedro Antonio de Alarcón (1891) | 1874 | ES | es.wikisource "El sombrero de tres picos (1874)" | as #1 | as #1 |
| 6 | *Pride and Prejudice* | Jane Austen (1817) | 1813 | EN | Project Gutenberg #1342 | US; UK/EU life+70; ES; MX; LatAm | Gutenberg edition basis (illustrated edition prefaces?); header removal |
| 7 | *Frankenstein* | Mary Shelley (1851) | 1818 (rev. 1831) | EN | Project Gutenberg #84 | as #6 | **1818 or 1831 text?** It must be identified (it changes the textHash record) |
| 8 | *The Strange Case of Dr Jekyll and Mr Hyde* | R. L. Stevenson (1894) | 1886 | EN | Project Gutenberg #43 | as #6 | Short (cheap to test); header removal |
| 9 | *Walden* | Henry David Thoreau (1862) | 1854 | EN | Project Gutenberg #205 | as #6 | Non-fiction (research-style questions); ingestion regex history noted in catalogue |
| 10 | *Up from Slavery* | Booker T. Washington (1915) | 1901 | EN | Project Gutenberg #2376 | as #6 | Non-fiction; introduction by another person in some editions? |
| alt | *El gaucho Martín Fierro* | José Hernández (1886) | 1872 | ES | Project Gutenberg #14765 | as #1 | Verse; dedication letter |
| alt | *The Picture of Dorian Gray* | Oscar Wilde (1900) | 1890 / 1891 | EN | Project Gutenberg #174 | as #6 | **1890 or 1891 version?** |

**Excluded from the candidates:**
- **Every translation**, e.g. the Spanish *Orgullo y prejuicio* and *El Príncipe*: the translator's term applies.
- **Bible texts** (translations; the reported UK Crown rights in the King James Version were *not* confirmed by the sources read).
- **Authors who died in 1926 or later**: Unamuno, Quiroga, Blasco Ibáñez, Juan Ramón Jiménez, Wells, Montgomery, Bennett, Shinn.
- ***Don Quijote*** (very large; edition modernized).
- ***Lazarillo*** (anonymous; edition modernized).

**Evidence sources** the verifier would use:
- the Gutenberg ebook page (`gutenberg.org/ebooks/<id>`) and the licence inside the file;
- the Wikisource page and its linked source scan;
- Wikidata or national-library authority records for death and publication dates;
- WIPO Lex for national copyright laws.

The terms quoted in screening come from a secondary source ([Wikipedia list](https://en.wikipedia.org/wiki/List_of_copyright_duration_by_country), partly read from a summary). **They are not legal sources.**

### 4.2 Likely public domain versus verified rights to the exact digital text

"Likely public domain" concerns the **work**. Eligibility requires an attested record for the **exact stored text** (`textHash`), its edition, and any added material (07 §3; F-12). A title can be public domain while a given digital edition is not usable as-is. That happens when the edition includes modern notes, a modern introduction, or contributor annotations, or when the licence requires header retention.

### 4.3 Minimum verification workflow and roles

| Step | Who | Output |
|---|---|---|
| 1. Screen title (rule in §4.1) | Engineering / Product Architecture | Candidate row with dates and sources |
| 2. Identify the edition behind the stored text; list added material | Engineering, reading the stored object and its source page (read-only) | Edition note, added-material list |
| 3. Compute `textHash` of the stored object | Engineering (staging, read-only; M2 adapter) | Hash |
| 4. Legal review for the target jurisdictions (US, ES, MX, CO, AR, CL, PE, EU/UK) | **Specialist legal reviewer** (external counsel or equivalent) | Written opinion per title or per rule |
| 5. Approve the manifest entry by pull request | **Named Verifier**: a person the PO designates (TT-26), accountable for the record, not necessarily a lawyer, acting on step 4 | Reviewed manifest entry (two-key with the database row; F-12) |
| 6. Review date | Named Verifier | Annual, or on any text change (a new hash reverts the book to `unknown`) |

### 4.4 Legal questions for specialist review

1. **Mexico life + 100:** confirm that it does not revive works already public domain (the secondary source suggests it does not).
2. **Moral rights:** Spain and many Latin American laws keep attribution and integrity rights perpetually. Does AI summarization or excerpting of public-domain works raise integrity concerns, and what attribution is required?
3. **Wikisource transcriptions:** is a transcription a contributor work under CC BY-SA? Does using it as model context, or showing excerpts, carry attribution or share-alike duties?
4. **Project Gutenberg licence:** it is US-centred. What applies to a company and users outside the US? Must all Gutenberg references be removed before storage, display, or AI processing (the licence grants derivative freedom "if all references to Project Gutenberg are removed")?
5. **Sending public-domain text to a foreign AI provider:** any non-copyright restriction (contract, data export) in the target jurisdictions?
6. **Jurisdiction of determination:** which law applies — the company's, the users', or the servers'?

---

## 5. Participants and access (TT-15; TT-23)

- **Recommended cohort:** **4 internal participants**: the PO plus 3 staff, mixing ES and EN readers. That is enough to cover both languages and fiction plus non-fiction, small enough to keep spend and support trivial.
- **Preserve PO-026:** each participant holds their **own active qualifying book subscription** (Individual, Duo, or Family), bought through the normal flow. The company may fund staff subscriptions without any rule change. **No pilot exception is recommended**; TT-23 would be answered "no exception".
- **Minimal pilot entitlement policy** (no change to commercial subscription rules):
  - `QualifyingPlanPort` pilot subset answers `qualifying` only for the **subscription owner** with status **`active`**. `trialing`, `canceling`, `past_due`, and linked members all stay `unknown` (TT-15 stays open for commercial use).
  - A Noetia+ **grant** with reason `pilot-internal` for each named participant.
  - The capability flag is enabled, with grants as the only path in.
  - Grants never bypass the prerequisite (PO-026).

---

## 6. Product validation (TT-08; TT-22; TT-18; thresholds)

**Minimum research capabilities to test user value:**
- a research session with 1–3 selected books;
- Q&A grounded in those books with **passage citations**;
- **passage-level comparison across the selected books**, labelled as such (TT-08 option (a), standard class);
- This Book / My Knowledge scoped to the session;
- **Expand limited to the model's own knowledge**, labelled `broader`, with no web search (TT-18 option (a));
- no Briefs, no Ask My Highlights, no NoetiaX depth.

**Candidate exit thresholds** (for PO approval; measured on a 50-question evaluation set across the corpus, ES and EN, written by staff and approved by the PO, graded against a rubric by two human reviewers):

| Measure | Candidate threshold |
|---|---|
| Citation accuracy (the cited passage exists in a selected book and supports the claim) | ≥ 95% |
| Grounding (claims supported by the cited or selected text) | ≥ 90% |
| Scope violations / cross-user or household leakage | 0 / 0 |
| Cost per session versus model | within ±30% after 20 sessions |
| Latency, warm turn p50 / cold full-book turn p95 | ≤ 10 s / ≤ 60 s *(unmeasured; to be calibrated in the evaluation run)* |
| Reader p95 latency during pilot | unchanged (±5%) |
| Ledger versus provider invoice | ≤ 2% after the provider's reporting delay |

**Internal participant consent (TT-22, internal scope):** a short written notice signed by each participant. It states:
- what is sent to the provider: public-domain book text, their questions, the answers;
- that highlights and notes are not used;
- the provider's retention and training position (§3.1);
- the right to stop at any time, and deletion on request.

Public Terms and Privacy updates are deferred to the external pilot (G3).

**Provider data-handling requirements (PO-005):**
- no training on submitted data;
- retention no longer than the provider default, with zero retention requested if available;
- a dedicated workspace and project per environment;
- documented spend-limit behaviour;
- region acceptable to the PO.

---

## 7. Decision matrix

| ID | Question | Options | Recommended | Trade-offs (cost · legal · technical · product) | Depends on | Reversible | Authorization that would follow |
|---|---|---|---|---|---|---|---|
| **G0-1** | Proceed with the assessed direction (internal-first, Noetia+ only, full-book as benchmark) and allow M1 to be drafted? | (a) Yes. (b) Revise direction. (c) Pause | **(a)** | No spend; no legal surface; M1 is dark and test-only · delays nothing else | Assessment rev 3 | Yes | Drafting of the M1 mission specification for separate PO approval (not execution) |
| **PO-005** | Which provider and data-handling terms for the pilot? | (a) Anthropic. (b) OpenAI. (c) Evaluate a third provider first | **Decide on data handling**; economics differ only by tens of dollars at pilot scale. Both meet the minimum (no training on API data; hard spend limits documented) | Cost: mid-tier full-book about 2× apart (§3.2); small tier reversed · Legal: retention defaults differ (none by default vs up to 30 days) · Technical: caching TTL and minimums differ | None | Yes (Gateway is provider-agnostic) | Provider account, a dedicated pilot workspace and an evaluation workspace, a key in staging only, within M4 |
| **TT-09 / TT-11 (pilot scope)** | Pilot spending figures and behaviour at the limit | Figures in §3.4 · (a) hard stop. (b) soft warning | **§3.4 figures; (a) hard stop** | Higher figures mean less friction, more exposure · conditional exposure ≈ $210 | M1 implemented | Yes | Configuration values for M1, M4, and M6. TT-09's commercial COGS target stays open |
| **TT-12 / TT-26** | Pilot corpus and verification standard | Candidate list §4.1 (all or a subset) · named verifier · legal reviewer | **Approve the candidates for verification (not as verified)**; designate a Named Verifier; engage a legal reviewer on §4.4 | Legal review cost and time · narrower corpus is cheaper to verify | None | Yes | Steps 2–3 of §4.3 (read-only, staging) and legal review. Manifest entries only after review |
| **Staging** | Fix staging isolation and authorize staging deployment | (a) Authorize NEM-017 then staging deployment of the stack. (b) Defer | **(a)** when M1–M4 are ready | Infrastructure change; no production impact | NEM-017 (Draft PR #26) | Yes | Separate infrastructure and staging-deployment authorizations naming staging only |
| **TT-23** | May a participant without a book plan use a grant? | (a) No exception: participants hold a qualifying subscription. (b) Exception for pilot staff | **(a)** | (a) costs a few subscriptions, no rule change · (b) needs a recorded exception to PO-026 | None | Yes | M3 implements the pilot subset only |
| **TT-15 (pilot subset)** | Which states qualify in the pilot? | (a) Owner + `active` only. (b) Also `trialing` / `canceling`. (c) Include linked members | **(a)** | Most conservative; commercial TT-15 stays open | None | Yes | M3 adapter values |
| **TT-22 (internal)** | Internal consent instead of public Terms for the internal pilot? | (a) Written internal notice (§6). (b) Update public Terms now | **(a)** | Faster; external pilot still needs (b) | PO-005 | Yes | Use of the notice for the 4 participants |
| **TT-08** | Noetia+ depth on agreements and contradictions | (a) Passage-level comparison, labelled. (b) Deeper synthesis | **(a)** | Cheaper, easier to evaluate · (b) belongs to the NoetiaX discussion | — | Yes | M5 UI scope and evaluation rubric |
| **TT-18** | Expand in the pilot | (a) Model knowledge only, labelled `broader`. (b) Web search | **(a)** | No web cost or new rights surface | — | Yes | Gateway prompt scope in M4 |
| **Thresholds** | Exit criteria | §6 table | **§6 table** | Stricter thresholds mean longer tuning | Evaluation set | Yes | Acceptance criteria for M4 and M6 |

**Deferred (G3), not for decision now:** TT-13, TT-14, TT-10 (public), TT-16, TT-01, TT-07, TT-17, TT-20, TT-25, TT-27, B-2 retention, GOV-001 adoption, production deployment (F-6).

---

## 8. Recommended sequence

1. **G0-1** (PO), then M1 drafted for approval. In parallel, prepare the G1 decisions.
2. **G1** decisions. M2 and M3 can be drafted and built dark meanwhile. Legal review starts (§4.3 step 4).
3. NEM-017 and the staging authorization, then M4 (real Gateway plus evaluation run on staging, under §3.4 limits).
4. **G2** decisions, M5 (UI), then M6 (internal pilot operation and report).
5. External pilot gates (G3), each separately.

No step authorizes a merge to `main` or a production deployment (Assessment §7).

---

## 9. Outstanding verification requirements

- Re-verify both providers' prices, long-context rules, cache-write prices above thresholds, and spend-limit timing on the day spending is authorized.
- Confirm provider data-processing terms (DPA, region, zero-retention eligibility) for PO-005.
- Measure real token counts for each candidate title (stored objects) before finalizing figures; the economics assume a 150K median.
- Identify editions and added material for each candidate; resolve the Frankenstein (1818/1831) and Dorian Gray (1890/1891) text questions.
- Obtain legal review on §4.4.
- Verify migration order with NEM-016 and staging isolation before any deployment (Assessment §7).

---

## 10. Unresolved questions

1. Should a third provider (e.g. Google) be evaluated before PO-005?
2. Who is the Named Verifier, and is external counsel available for §4.4?
3. Is staging acceptable for the internal pilot's data, or must it live in production?
4. Who writes the 50 evaluation questions?
5. **Retrieval arm:** the Assessment proposes measuring the full-book versus retrieval quality gap, but no mission in M1–M6 builds retrieval. Should M4 include a minimal in-process lexical retrieval arm for the evaluation only (no new infrastructure)? Or is the gap measured later (T3)? *This is a dependency gap discovered by this packet.*
6. Should company-funded staff subscriptions be used for the cohort?

---

## Appendix A — Reproducible cost calculation

`python3 p0_costs.py` reproduces every figure in §3.2 and the cohort totals in §3.4. Prices as in §3.1. Values marked ASSUMED are not on the providers' pages.

```python
# P0 packet economics. Prices verified 2026-11-09 from official provider pages (see packet §3), except where marked ASSUMED.
# Workload assumptions = Pilot-Readiness Assessment rev 3 §4.2 (median book B = 150K tokens).
M = 1e-6
def tiers(short, long=None, threshold=None):
    return dict(short=short, long=long, th=threshold)
P = {
 "Anthropic Sonnet 5.5": tiers(dict(i=2*M, w=2.5*M, r=0.10*M, o=10*M)),
 "Anthropic Opus 5.5":   tiers(dict(i=4*M, w=5*M,   r=0.20*M, o=20*M)),
 "Anthropic Haiku 5.5":  tiers(dict(i=0.10*M, w=0.125*M, r=0.01*M, o=0.50*M), dict(i=0.50*M, w=0.625*M, r=0.05*M, o=2.50*M), 100_000),
 "OpenAI gpt-6.1-sol":   tiers(dict(i=2*M, w=2.5*M, r=0.10*M, o=10*M), dict(i=4*M, w=5*M, r=0.20*M, o=15*M), 272_000),   # long-tier write ASSUMED 1.25x long input
 "OpenAI gpt-6-luna":    tiers(dict(i=0.10*M, w=0.125*M, r=0.01*M, o=0.50*M), dict(i=0.20*M, w=0.25*M, r=0.02*M, o=0.75*M), 272_000),  # writes ASSUMED 1.25x input
 "OpenAI gpt-6-astra":   tiers(dict(i=10*M, w=12.5*M, r=1.0*M, o=50*M), dict(i=20*M, w=25*M, r=2.0*M, o=75*M), 272_000),   # long-tier write ASSUMED
}
def price(m, prompt):  t = P[m]; return t["long"] if t["long"] and prompt > t["th"] else t["short"]
def full(m, C, T, O, W):
    p = price(m, C); return W*(C*p["w"] + O*p["o"]) + (T-W)*(C*p["r"] + O*p["o"])
def retr(m, R, T, O):
    p = price(m, R); return T*(R*p["i"] + O*p["o"])
def evalq(m, C, O):  # one batched evaluation question, uncached (worst case), 50% batch discount
    p = price(m, C); return 0.5*(C*p["i"] + O*p["o"])
B = 150_000
SC = {"low": dict(S=2, T=3, n=1, W=1, O=1500), "expected": dict(S=6, T=8, n=2, W=2, O=3000), "high": dict(S=20, T=15, n=3, W=4, O=8000)}
for m in P:
    v = [SC[k]["S"]*full(m, SC[k]["n"]*B, SC[k]["T"], SC[k]["O"], SC[k]["W"]) for k in SC]
    print(f"full {m:22} low ${v[0]:7.2f} expected ${v[1]:7.2f} high ${v[2]:8.2f}")
for m in P:
    v = [SC[k]["S"]*retr(m, 20_000, SC[k]["T"], SC[k]["O"]) for k in SC]
    print(f"retr {m:22} low ${v[0]:7.2f} expected ${v[1]:7.2f} high ${v[2]:8.2f}")
for m in P:
    print(f"no-cold-miss {m:22} ${6*full(m, 2*B, 8, 3000, 1):7.2f}   eval(50q) ${50*evalq(m, 2*B, 3000):7.2f}")
for m in ("Anthropic Sonnet 5.5", "OpenAI gpt-6.1-sol"):
    print(f"cohort of 4, expected, {m}: ${4*6*full(m, 2*B, 8, 3000, 2):.2f}")
```

Output (2026-11-09): Sonnet 5.5 0.90 / 11.52 / 123.90 · Opus 5.5 1.80 / 23.04 / 247.80 · Haiku 5.5 0.24 / 3.15 / 33.45 · gpt-6.1-sol 0.90 / 22.32 / 235.80 · gpt-6-luna 0.05 / 1.22 / 12.78 · gpt-6-astra 4.80 / 122.40 / 1,278.00 (full-book, low / expected / high). Retrieval expected: 3.36 / 6.72 / 0.17 / 3.36 / 0.17 / 16.80. No cold miss: 7.20 / 14.40 / 2.11 / 13.68 / 0.81 / 81.00. Evaluation: 15.75 / 31.50 / 3.94 / 31.12 / 1.56 / 155.62. Cohort of 4: Anthropic $46.08 · OpenAI $89.28.

---

*Documentation only. No application code, migration, infrastructure, CI/CD, subscription, or Stripe change. No paid AI API was called; provider pages were read as public documentation. Nothing merged or deployed.*
