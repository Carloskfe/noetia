# 10 — Noetia+ / NoetiaX Pilot-Readiness Assessment

> **DRAFT — assessment only. Revision 3 (2026-11-09).** Not a decision, not a mission, not an authorization. It approves no price, budget value, token rule, provider, model, pilot participant, deployment, or mission. Every dollar figure and every value marked *(candidate)* is a proposal for the Product Owner. Provider facts are **provisional** until checked against the sources in §4.1. Prepared for independent Product Architecture review.

**Inputs (not restated):** PO-025…028, PO-030 (decided) · PO-029 (draft) · ADR-001…006 · [04 Entitlements and budgets](04-entitlements-and-budgets.md) · [05 Open decisions](05-open-decisions.md) · [06 Roadmap T2–T9](06-implementation-roadmap.md) · [07 Rights requirements](07-rights-verification-requirements.md) · [09 NEM-019 technical note](09-nem-019-control-plane-technical-note.md) · [NEM-019 report §0.1](../../reports/2026-11-09-NEM-019-implementation-report.md#01-product-owner-acceptance-2026-11-09) · [NEM-003 cost model](../../noetia-plus/07-cost-and-usage-model.md).

Tier definitions (Noetia / Noetia+ / NoetiaX) and the **3-book and 10-book** session limits (PO-027) are unchanged throughout. Sequencing NoetiaX later in a pilot does not redefine it.

---

> **Strategy update (2026-11-09) — read first.** The Product Owner has redirected Noetia+ / NoetiaX development to **complete the product on simulated providers and acquire no paid AI service before a separately authorized launch-readiness gate.** This assessment's **§1 (recommendation), §2 (pilot options), §9 (pilot mission sequence) and §11 (pilot design) are therefore superseded** by the [P0 decisions packet, Revision 2](../../operating-framework/analysis/p0-pilot-decisions-packet.md) (§A2–§A6).
>
> **Still valid as reference for that gate:**
> - §4 economics method (with the verified price correction in the packet, C1);
> - §5 budget mechanisms;
> - §6 full-book versus retrieval comparison;
> - §7 deployment sequencing;
> - §8 rights approach.
>
> No PO decision is changed by this note.

## Revision 3 summary (review corrections P-6…P-8)

- **P-6:** every monthly scenario was recomputed from §4.2–§4.4 with the script in Appendix A.
  - High full-context Sonnet is **$133.80** (was ~$113: the earlier figure used 3 cache writes and 12 warm turns instead of `W` = 4 and `T − W` = 11).
  - The same error affected High full-context Opus: **$247.80** (was ~$205).
  - Also corrected: Low full-context Sonnet **$0.96** (was ~$1.05) and Low retrieval Sonnet **$0.33** (was ~$0.4). Both had used 3 K instead of the scenario's 1.5 K output.
  - Monthly figures are now given to the cent, stating `B` and `R`.
- **P-7:** context-size sensitivity is now stated by full-book context `C`.
  - 60 K of context (one short book) costs **$0.61** per session.
  - The former row labelled "60 K, n = 2" meant 120 K of context, whose $0.98 was arithmetically correct but ambiguously labelled.
- **Additional:** the internal spending target is **$103** (was ≈ $105). All per-turn and other sensitivity entries reproduce unchanged.
- **P-8:** the ≈ $190 maximum exposure is now stated as **conditional** on both correct implementation of Mechanism 2 and the assumed behaviour of the provider's evaluation-workspace limit. No provider limit is described as a hard guarantee.

The conclusions are unchanged: full-book context is a quality benchmark well above the PO-001 guideline; no price, allowance, model, or provider is chosen.

## Revision 2 summary (architecture review corrections P-1…P-5)

| | What changed |
|---|---|
| **P-1** Provider economics | Facts are now split into **verified in the repository**, **provisional provider data**, and **Noetia assumptions** (§4.1–§4.2). Model names, prices, context limits, and cache discounts are labelled provisional, with the authoritative pages to check before any spending authorization. Costs are reproducible from explicit formulas and token volumes (§4.3). Sensitivity added for cache misses, output tokens, and long-context pricing (§4.5). No provider or model is selected |
| **P-2** Budget enforcement | Three mechanisms are separated (§5): **(1)** NEM-019's internal-unit ledger (what it guarantees today and what it does not); **(2)** proposed cost-aware reservation and settlement; **(3)** external provider controls. **No hard dollar ceiling is claimed today.** The proposed design's guarantee is stated with its conditions and residual exposure (concurrency, settlement failure, billing delay, out-of-band traffic) |
| **P-3** Deployment sequencing | New §7: the #34 → #47 chain, the fact that **a merge to `main` deploys production and runs migrations** (`cd.yml`), staging-isolation and migration-order prerequisites, and guardrails so that no pilot mission can imply production authorization |
| **P-4** Spending figures | Revision 1's $150 allowance versus $200 backstop is resolved into four distinct figures (§5.4): spending target, ledger allowance, provider alert/limit, and maximum exposure. All are PO candidates |
| **P-5** Context strategy | Full-book context is now stated as a **pilot quality benchmark, not the selected commercial implementation**, with a quality / cost / latency / complexity comparison against retrieval (§6). NoetiaX context requirements stay **provisional** until corpus sizes and provider limits are verified |

**Remaining uncertainties:**
- live provider prices, long-context rules, cache pricing, and spend-limit enforcement semantics;
- real token counts of the candidate corpus;
- the full-book versus retrieval quality gap (only the pilot can measure it);
- staging isolation (S19);
- TypeORM behaviour if NEM-016's migration 068 lands after 069–072.

**New implementation dependencies discovered in this revision:**
- **D14:** NEM-019 has a per-user allowance and an overall *unresolved* bound, but **no global total-spend allowance**. The micro-USD global guard designed in [04 §4](04-entitlements-and-budgets.md#4-resource-budgets) is not implemented.
- **D15:** provider-side retries must reserve per attempt.
- **D16:** a provider key/workspace dedicated to the pilot, separate from the one used for evaluation, so that no traffic bypasses the ledger unseen.
- **D17:** verify migration order against NEM-016's 068 before any deployment.

**Decisions needing PO approval:** §10. No new PO decision, ADR, or mission is created by this document.

---

## 1. Executive recommendation

1. **Two-step pilot:** an **internal real-AI pilot on an isolated staging environment** (Option B), then a **limited external pilot** (Option C) only if B passes its exit criteria (§11). A separate simulated-provider pilot is not recommended (§2).
2. **Noetia+ (≤ 3 books) first.** NoetiaX's context needs are provisional (§6.3). Its real-user access waits for verified corpus sizes, retrieval (roadmap T3), and TT-07.
3. **Full-book context is a pilot quality benchmark only.** It is measured against retrieval-sized context. Under the provisional prices it is far above PO-001's ~$1.50/month normal-user COGS guideline, so it is **not** a candidate commercial architecture. The commercial context strategy is a later decision informed by the pilot's measured quality gap (§6).
4. **No real provider call before cost-aware reservations and a global micro-USD guard exist** (M1; D1, D14). Until then NEM-019 offers no dollar guarantee (§5.1).
5. **No production change is implied by any pilot step.** Merging the stack to `main` deploys production and runs migrations. That needs its own PO authorization under F-6, a snapshot, and migration-order verification (§7).
6. **Corpus:** 6–10 legally reviewed, original-language public-domain works in ES and EN (§8). `isFree` is never evidence.

---

## 2. Pilot options and trade-offs

| | **A. Simulated-provider pilot** | **B. Internal real-AI pilot** | **C. Limited external pilot** |
|---|---|---|---|
| Who | Staff | 3–5 staff with qualifying subscriptions *(candidate; TT-23)* | 15–30 invited subscribers *(candidate)* |
| Where | Staging | **Isolated staging** (§7.3) | Production (needs F-6 authorization) |
| Validates | UI flow, limits, error UX | **Answer quality, citations, cost per session, latency, reader isolation, ledger versus invoice** | Real behaviour, heavy-tail cost, support load |
| New legal surface | None | Provider data handling (PO-005); internal consent | Terms/Privacy (TT-22), TT-13, TT-14 |
| AI spend | $0 | Low, capped (§5.4) | Moderate, capped |
| **Assessment** | Low value: its checks belong in mission acceptance tests | **Most learning per dollar and per unit of risk** | Needed before launch; only after B |

---

## 3. Minimum prerequisites

### 3.1 Blockers for the internal pilot (B)

| # | Prerequisite | Type |
|---|---|---|
| B1 | Provider selection and data-handling review | **PO** (PO-005) |
| B2 | Pilot participants without a book plan, if any; qualifying subscription states for the pilot | **PO** (TT-23; TT-15 subset) |
| B3 | Pilot corpus; verifier, evidence standard, jurisdictions | **PO + legal** (TT-12, TT-26) |
| B4 | Spending figures in §5.4 (target, allowance, provider alert/limit) | **PO** (values) |
| B5 | Ledger deltas D1–D3, D14, D15 (§5.2) | Engineering |
| B6 | Adapters: text identity, verification authority (pilot manifest), qualifying plan (pilot subset), full-book context source | Engineering after B2/B3 |
| B7 | Real Gateway adapter, kill switch, timeouts, concurrency cap; router allowlist change explicitly authorized | Engineering |
| B8 | Minimal web session UI (≤ 3 books, citations), en/es, behind the flag | Engineering |
| B9 | **Staging isolation** (S19 / NEM-017) and an explicit **staging** deployment authorization (§7.3) | Infra + deployment authorization |
| B10 | Evaluation set and thresholds (T2-lite) with its own spend limit and its own key (D16) | PO thresholds; engineering |
| B11 | Internal participant consent for AI processing | **PO** (TT-22 scope) |

### 3.2 Additional blockers for the external pilot (C)

TT-22 · TT-13 with **F-2** · TT-14 · **production deployment authorization under F-6** (§7) · **F-7** Redis budget · **F-9** AI content kept out of analytics · **F-10** CI PostgreSQL job (a CI mission) · ledger compensation runbook · **F-11** SA-003 conflicts.

### 3.3 Can wait until commercial launch

Billing/Stripe (T8; TT-16) · prices and token policy (TT-01, TT-16) · customer capacity UI (TT-10) · mobile (TT-20) · Research Brief (T6; TT-17) · NoetiaX depth (T7; TT-07) · Ask My Highlights (TT-25, TT-27, F-1) · Expand-with-web (TT-18) · `OwnershipPort` (F-5, NEM-013; **not needed for a public-domain-only pilot**, because ADR-006 gives public domain an access basis) · dedicated DB pool · retrieval at scale (T3) · author opt-in corpus.

---

## 4. AI economics (P-1)

### 4.1 Status of provider information

| Category | Content | Status |
|---|---|---|
| **Verified in the repository** | NEM-019 ledger behaviour (units, reservations, B-6 global serialization, idempotent settlement); `cd.yml` deploy-and-migrate on push to `main`; book text in object storage (`books.textFileKey`); PO-001 COGS guideline ~$1.50 and bands 15/25/35 | Verified by code and test inspection |
| **Provisional provider data** | Model names, per-token prices, context-window sizes, cache write/read multipliers, cache TTLs, batch discount, long-context pricing tiers, token-counting cost, spend-limit semantics | **Not verified.** Taken from reference material bundled with the development tooling (cached 2026-10-06), first-party Anthropic API only. **No other provider was examined** (PO-005 keeps the Gateway provider-agnostic) |
| **Noetia assumptions** | Tokens per word and per book, turns per session, output per turn, cache-miss behaviour, sessions per month, retrieval context size | Estimates; to be measured in the pilot (§4.2) |

**Authoritative sources to check before any spending authorization** (for the Anthropic option; each other candidate provider needs its equivalent):
- Pricing: `https://platform.claude.com/docs/en/about-claude/pricing.md`
- Models overview (IDs, context windows): `https://platform.claude.com/docs/en/about-claude/models/overview.md`
- Prompt caching (TTLs, write/read pricing, minimums): `https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md`
- Token counting (and whether it is billed): `https://platform.claude.com/docs/en/build-with-claude/token-counting.md`
- Rate limits: `https://platform.claude.com/docs/en/api/rate-limits.md`
- Usage and cost reporting (for invoice reconciliation): `https://platform.claude.com/docs/en/manage-claude/usage-cost-api.md`
- Workspace spend limits and alerts: the provider console documentation (enforcement timing must be confirmed)
- Amazon Bedrock and Vertex AI publish their own prices if those platforms are chosen.

**Provisional price set "PS-1"** (illustrative; *not verified*):

| Model (provisional) | Input $/M | Output $/M | Cache write 5-min / 1-h | Cache read $/M | Context (provisional) | Notes |
|---|---|---|---|---|---|---|
| Haiku 5.5 | 0.10 (≤ 100 K prompt) · 0.50 (> 100 K) | 0.50 · 2.50 (> 100 K) | 1.25× / 2× input *(assumed)* | ≈ 0.1× input *(unknown)* | 1 M | Long-context tier listed |
| Sonnet 5.5 | 2.00 | 10.00 | 2.50 / 4.00 | 0.20 | 1 M | No long-context tier listed — **verify** |
| Opus 5.5 | 4.00 | 20.00 | 5.00 / 8.00 | 0.20 | 1 M | No long-context tier listed — **verify** |
| Fable 5.1 | 10.00 | 50.00 | 12.50 / 20.00 | 0.25 | 1 M | Excluded from the pilot on cost |

Thinking tokens are billed as output (provisional). The batch discount (provisional 50%) applies to evaluation runs only.

### 4.2 Noetia workload assumptions

| Symbol | Meaning | Low | Expected | High |
|---|---|---|---|---|
| `k` | Tokens per word | EN 1.3 · ES 1.6 | | |
| `B` | Tokens per book | 60 K | **150 K** | 300 K (outliers > 600 K) |
| `n` | Books per session (Noetia+) | 1 | 2 | 3 |
| `C = n·B` | Full-book context per turn | 60 K | 300 K | 900 K |
| `R` | Retrieval context per turn | — | 20 K | 40 K |
| `T` | Turns per session | 3 | 8 | 15 |
| `O` | Output tokens per turn (answer + thinking) | 1.5 K | 3 K | 8 K |
| `m` | Cold cache misses per session (beyond the first write) | 0 | 1 | 3 |
| `W = 1 + m` | Cache writes per session | 1 | 2 | 4 |
| `S` | Sessions per user per month | 2 | 6 | 20 |

Note: the High column's `C` of 900 K (3 × 300 K) approaches the provisional 1 M window. §4.4 therefore uses the median `B` for the per-turn table and treats long books as a sensitivity case (§4.5).

### 4.3 Formulas (reproducible)

Prices per token: `p_in`, `p_out`, `p_w` (cache write, 5-minute TTL), `p_r` (cache read). All costs are in USD.

```
Full-book context, per session:
  cost_full = W·(C·p_w + O·p_out) + (T − W)·(C·p_r + O·p_out)

Full-book context without caching (when reuse is rare):
  cost_nocache = T·(C·p_in + O·p_out)

Retrieval context, per session (small cached system prefix ignored):
  cost_retr = T·(R·p_in + O·p_out)

Per-turn worst case before the call (basis of the proposed reservation, §5.2):
  worst_turn = C·max(p_in, p_w) + O_max·p_out          where O_max = max_tokens

Monthly per user:
  cost_month = S · cost_session
```

### 4.4 Results under PS-1 (provisional)

**Per turn (B = 150 K):**

| Strategy · model | Cold turn (write) | Warm turn (read) | Worst case (3 books, O_max = 8 K) |
|---|---|---|---|
| Full, 1 book · Sonnet 5.5 | 150 K×2.5 + 3 K×10 = **$0.405** | 150 K×0.2 + 3 K×10 = **$0.06** | — |
| Full, 3 books · Sonnet 5.5 | 450 K×2.5 + 3 K×10 = **$1.155** | 450 K×0.2 + 3 K×10 = **$0.12** | 450 K×2.5 + 8 K×10 = **$1.205** |
| Full, 3 books · Opus 5.5 | **$2.31** | **$0.15** | **$2.41** |
| Full, 3 books · Haiku 5.5 (> 100 K tier) | **$0.29** | **≈ $0.03** *(read price unknown)* | **≈ $0.30** |
| Retrieval 20 K · Sonnet 5.5 | 20 K×2 + 3 K×10 = **$0.07** | same | 40 K×2 + 8 K×10 = **$0.16** |
| Retrieval 20 K · Haiku 5.5 | **≈ $0.004** | same | **≈ $0.01** |

(Token counts × $/M ÷ 10⁶.)

**Per user per month** (all rows use the median `B` = 150 K; retrieval at `R` = 20 K, with 40 K shown for High; Haiku retrieval uses the ≤ 100 K prompt tier):

| Scenario | Full · Sonnet | Full · Opus | Retrieval · Sonnet | Retrieval · Haiku |
|---|---|---|---|---|
| Low (S = 2, T = 3, n = 1, m = 0, O = 1.5 K) | $0.96 | $1.80 | $0.33 | $0.02 |
| **Expected** (S = 6, T = 8, n = 2, m = 1, O = 3 K) | **$12.60** | $23.04 | **$3.36** | $0.17 |
| High (S = 20, T = 15, n = 3, m = 3, O = 8 K) | **$133.80** | **$247.80** | $36.00–48.00 | $1.80–2.40 |

Worked expected session, full · Sonnet: `2·(300 K·2.5e-6 + 3 K·10e-6) + 6·(300 K·0.2e-6 + 3 K·10e-6) = 2·0.78 + 6·0.09 = $2.10`, × 6 sessions = $12.60.
Worked high session, full · Sonnet: `W = 4`, `T − W = 11`: `4·(450 K·2.5e-6 + 8 K·10e-6) + 11·(450 K·0.2e-6 + 8 K·10e-6) = 4·1.205 + 11·0.17 = $6.69`, × 20 sessions = $133.80.
Every entry in §4.4–§4.5 is reproduced by the script in Appendix A.

### 4.5 Sensitivity (expected session; Sonnet 5.5 under PS-1)

| Variable | Values | Full-book session | Retrieval session |
|---|---|---|---|
| Cache writes `W` | 1 / **2** / 4 / 8 (every turn cold) | $1.41 / **$2.10** / $3.48 / $6.24 | n/a ($0.56) |
| Caching disabled | — | $5.04 (cheaper than W = 8: when reuse is rare, do not cache) | n/a |
| Output `O` | 1.5 K / **3 K** / 8 K | $1.98 / **$2.10** / $2.50 | $0.44 / **$0.56** / $0.96 |
| Retrieval context `R` | **20 K** / 40 K | n/a | **$0.56** / $0.88 |
| Long-context surcharge (hypothetical: input above 200 K at 2×; **not in PS-1; verify**) | ×1 / ×2 | **$2.10** / ~$3.96 | unaffected below threshold |
| Full-book context `C` | 60 K (one short book) / 120 K (two short books) / **300 K** (two median) / 600 K (two long books) | $0.61 / $0.98 / **$2.10** / $3.96 | unaffected |

**Readings:**
- Full-book cost is dominated by cache writes (cold misses) and by context size, not by output.
- Retrieval cost is dominated by output and by `R`.
- A long-context surcharge, if one applies, would almost double full-book cost while leaving retrieval untouched.
- Each of these inputs is measurable in the internal pilot.

Against PO-001 (~$1.50/month normal-user guideline; TT-09 open), under PS-1:
- full-book context is roughly **8×** over;
- mid-tier retrieval roughly **2×** over;
- cheap-tier retrieval is under.

**No price, allowance, or model is chosen here** (TT-09, TT-16, PO-005).

---

## 5. Budget enforcement and financial exposure (P-2)

### 5.1 Mechanism 1 — NEM-019 internal-unit ledger (**exists today**, dark)

| Guaranteed today (tested) | **Not** guaranteed today |
|---|---|
| A reservation is written before any provider call, or the call is denied (fail-closed admission) | **Any dollar bound.** Units have no defined dollar mapping; the rate card is single-dimension |
| Per-user/capability: reserved + settled + unresolved units ≤ allowance at admission | A turn's **actual** usage can exceed its fixed reservation (`reserveUnitsPerTurn`). The overrun is recorded at settlement, after the fact |
| Overall unresolved units ≤ overall bound, serialized across users (B-6) | **No global total-spend allowance** across users (D14). The overall bound limits *unresolved* units only |
| One settlement per key; replays never double-charge; unknown usage stays held | Provider-side retries are invisible to the ledger (D15) |
| Ledger failure at settlement keeps the reservation held at its reserved amount | Traffic outside the Gateway (evaluation scripts, manual tests) is not seen (D16) |

**Conclusion:** today's ledger bounds *how many* turns are admitted, not *what they cost*. **No real provider call may be made on Mechanism 1 alone.**

### 5.2 Mechanism 2 — Proposed cost-aware reservation and settlement (**requires engineering**, M1)

Consistent with [04 §4](04-entitlements-and-budgets.md#4-resource-budgets) (per-user allowances in units; a global guard in micro-USD). Deltas:
- **D1** reserve `worst_turn` (§4.3) per turn, in units for the user allowance and in micro-USD for the global guard;
- **D2** multi-dimension rate card (input, output, cache write per TTL, cache read, long-context tier);
- **D3** per-class usage mapping at settlement;
- **D14** a **global micro-USD period allowance** checked under the existing B-6 global lock;
- **D15** a reservation per provider attempt (or no automatic provider retries).

**Guarantee, if implemented:** admission adds each `worst_turn` to consumption *before* the call, and consumption already includes unresolved reservations at their reserved amount. So `settled cost + held reservations ≤ global allowance` at every admission, **including concurrent requests** (serialized by the B-6 lock) and **settlement failures** (held at worst case, never released to zero).

**Conditions the guarantee depends on:**
1. the rate card matches the provider's actual billing;
2. the provider honours `max_tokens` and charges nothing outside the modelled token classes;
3. every provider call goes through the Gateway;
4. retries are reserved.

**Residual exposure under Mechanism 2:**

| Source | Size | Mitigation |
|---|---|---|
| Rate card stale (price rise) or an unmodelled charge | Proportional to the error | Re-verify the rate card before each pilot period; provider alert |
| Traffic outside the Gateway on the same account | Unbounded by the ledger | Dedicated pilot key/workspace (D16); provider limit |
| Provider billing delay | Does not affect the ledger (it counts at admission); affects invoice reconciliation timing only | Reconcile after the provider's reporting delay |
| Held reservations never settled | Counted at worst case, so this is overstatement, not overspend | Runbook for compensating entries |

### 5.3 Mechanism 3 — External provider controls (**configuration, not code**)

Workspace spend alerts and limits in the provider console, and a dedicated workspace/key for the pilot. These are **independent of Noetia** and catch residuals above, but their enforcement may lag usage. Exact semantics (hard stop or alert, timing, granularity) are **unverified** and must be confirmed (§4.1). When a provider limit trips, calls fail, the Gateway reports `failure`, and the reader is unaffected (Reader Stability First). **A provider limit is treated as a backstop, not as the primary ceiling.**

### 5.4 Pilot spending figures (P-4; all PO candidates)

| Figure | Meaning | Internal pilot *(candidate)* | External pilot *(candidate)* |
|---|---|---|---|
| **Spending target** | Expected spend, from §4.4 | $63 (5 users × $12.60, full-book benchmark) + ≤ $40 evaluation ≈ **$103** | ~$100–400, depending on the strategy measured in B |
| **Ledger global allowance** (Mechanism 2, D14) | Primary ceiling; admission stops at it | **$150** | **$400** |
| **Per-user allowance** (units; mapped by the rate card) | Fair use per participant | ≈ $25-equivalent | ≈ $15-equivalent |
| **Provider alert** | Early warning | $120 | $320 |
| **Provider limit** | Backstop above the ledger, so that the ledger binds first | $200 | $500 |
| **Maximum financial exposure** | See below | **≈ $190 — conditional, not guaranteed.** It is $150 (pilot ledger) + $40 (evaluation workspace) and holds only if **both** (a) Mechanism 2 is implemented correctly and its conditions 1–4 hold, **and** (b) the provider's separate evaluation-workspace limit stops spend at $40 as assumed. Neither is verified today. If (a) fails, pilot exposure is bounded only by the provider limit; if either provider limit lags or behaves as an alert rather than a hard stop, exposure can exceed these figures by whatever is spent during the lag | ≈ $400, under the same two conditions |
| **Evaluation runs** | Separate key and workspace (D16); batched; not seen by the ledger | ≤ $40 *intended*, bounded only by that workspace's provider limit, whose enforcement is **unverified** (§5.3) | — |

Revision 1 listed "$150 allowance" and "$200 backstop" without distinguishing them. They are different layers: the $150 is the ledger's primary ceiling for pilot traffic, and the $200 is an independent backstop deliberately set above it. Evaluation traffic sits outside the ledger by design and is bounded only by its own workspace limit. **No figure in this table is a hard guarantee.** The ledger ceiling becomes an internal guarantee only once Mechanism 2 is implemented and verified. Provider limits remain an external control whose enforcement semantics are unverified (§4.1, §5.3). Without Mechanism 2, no internal ceiling exists, which is why M1 precedes any real call.

---

## 6. Full-book context versus retrieval (P-5)

### 6.1 Role in the pilot

Full-book context is the **quality benchmark**: it shows what the model can do when nothing is missed by retrieval. It is **not the selected commercial implementation**. The commercial context strategy (retrieval, a hybrid, or routing) remains a later decision informed by the measured gap. It is not decided here.

### 6.2 Comparison

| Dimension | Full-book context (benchmark) | Retrieval-sized context |
|---|---|---|
| **Quality** | Whole-book visibility; no retrieval misses; cross-passage reasoning. Risks: degraded attention over very long inputs; citation anchoring needs character offsets | Depends on retrieval recall and chunking with anchors (X-3); can miss distributed evidence; easier per-passage citation |
| **Cost** (PS-1, expected user) | ~$12.6/month (Sonnet 5.5); dominated by cache writes and misses | ~$3.4 (Sonnet 5.5) · ~$0.2 (Haiku 5.5) |
| **Latency** | Time to first token grows with input; cold turns over hundreds of thousands of tokens are likely much slower than warm turns (**unmeasured**) | Typically seconds (**unmeasured**) |
| **Engineering complexity** | Low: load the stored text of the allowed set, cache, cite by offsets. No index | Higher: chunking with anchors, an index (lexical via existing PostgreSQL/Meilisearch, or embeddings plus pgvector = T3), ranking, recall evaluation |
| **Data sent to the provider** | The entire text of each selected book per cold turn (public domain only in the pilot); PO-005 consideration | Excerpts only |
| **Scope controls** | Context Builder invariant applies unchanged | Same; retrieval needs an explicit, non-empty allowed set (ADR-006) |
| **Fits the 3-book limit** | At median `B`, yes (≈ 450 K); long books may not | Yes |
| **Fits the 10-book limit** | **Provisional: unlikely** at median `B` (≈ 1.5 M versus a provisional 1 M window) | Yes, by design |

### 6.3 NoetiaX context requirements (provisional)

Whether any NoetiaX session can use full-book context depends on the **measured** token sizes of the eligible corpus and on the **verified** context limit of the chosen provider and platform. Until both are known, NoetiaX is planned on retrieval (T3), and its depth on TT-07. **The 10-book limit itself is unchanged** (PO-027).

---

## 7. Deployment and dependency sequencing (P-3)

### 7.1 The stacked chain (verified 2026-11-09)

| PR | Branch → base | Content | Runtime code / migrations |
|---|---|---|---|
| #34 | three-tier reconciliation → `main` | Docs | None |
| #35 | T0 decision closure → #34 | Docs | None |
| #40 | Rev 2 PO approvals → #35 | Docs | None |
| #41 | ADR-005/006 review → #40 | Docs | None |
| #42 | ADR corrections → #41 | Docs | None |
| #43 | ADR acceptance → #42 | Docs | None |
| #44 | PO-025 / NEM-019 id → #43 | Docs | None |
| #45 | NEM-019 approval → #44 | Docs | None |
| **#46** | NEM-019 implementation → #45 | **Code + migrations 069–072** | **Yes** |
| #47 | This assessment → #46 | Docs (inherits #46's code through stacking) | Through #46 |

All ten are Draft and unmerged. Merging within the stack changes no environment. **Merging any part of the chain into `main` triggers `cd.yml`**: pull, build, `up -d`, then `migration:run:prod`. Runs queue rather than cancel. Every push to `main` redeploys production, including documentation-only pushes (mission README warning). Once #46 reaches `main`, the ten NEM-019 tables are created in production and the tier policies are seeded. `KnowledgeModule` stays off by default, but the schema is live (F-6).

### 7.2 Prerequisites before any merge to `main`

1. An explicit Product Owner **deployment authorization** naming the merge (F-6). Mission acceptance, PR approval, or pilot approval do **not** imply it.
2. A Contabo snapshot before deployment (CLAUDE.md safety rules).
3. **Migration-order verification (D17).** NEM-016's `1748300000068-AddShareLifecycle` is unmerged on other branches. If 069–072 reach production first and 068 lands later, confirm on a disposable database that TypeORM still runs 068, and that the two sets have no dependency, in both orders.
4. The GOV-001 §5.4 merge gate (PR #39, not yet merged; its adoption is itself a PO decision).
5. No merge while a deployment is running (check `gh run list`).
6. The post-deploy verification in CLAUDE.md (containers healthy, last migrations, spot test).
7. F-11 (SA-003 conflicts) resolved before the three-tier stack merges.

### 7.3 Staging prerequisites (internal pilot)

- **Isolation:** the S19 proxy-network DNS fall-through between production and staging must be fixed (NEM-017, Draft PR #26; infrastructure authorization) before staging holds real AI credentials or pilot data.
- **Staging deployment authorization:** a separate, explicit PO authorization to deploy a named branch and run migrations 069+ on the **staging database only**, with verification that staging's database is not shared with production.
- **Staging auto-deploy** is not armed. Deployment is manual and must follow the predeploy plan (Draft PR #27).
- **Secrets:** the pilot provider key lives only in staging's environment; evaluation uses a separate key (D16).

### 7.4 Guardrails so that no pilot mission implies production change

Each proposed mission (§9) would state "**Production deployment: NOT AUTHORIZED**" and "**Merge to `main`: NOT AUTHORIZED**". Missions branch from the stack, not from `main`, and end in Draft PRs. Staging deployment appears only in a mission whose authorization explicitly names staging. Production appears only in a later, separately authorized deployment mission.

---

## 8. Book rights

### 8.1 Public-domain-first: sound, but narrower than the catalogue

`isFree`, catalogue source, and sync quality are **never evidence** (ADR-006; 07 §2). Today no book is eligible, which is correct.

### 8.2 Minimum compliant pilot corpus *(candidate screening heuristic; not a legal determination)*

- Original-language works only (no translations).
- Author died before 1926 **and** first published before 1930. This aims to clear long terms such as Mexico's life + 100 and Spain's life + 80 for pre-1987 deaths, plus US publication-based rules. **Legal review must confirm** (TT-26).
- Stored edition free of modern editorial material, or that material removed before hashing.
- 6–10 titles, about half ES and half EN.
- Known traps excluded, e.g. the King James Version (Crown rights in the UK), modern critical editions, LibriVox-derived texts.

### 8.3 Text identity and verification authority

- **Text identity:** SHA-256 of the stored object (`books.textFileKey`), cached by ETag. Re-ingestion changes the hash, and the book reverts to `unknown` (07 §4).
- **Pilot authority:** a reviewed rights manifest in the repository `(catalogue key, textHash, basis, jurisdictions, verifier, date, evidence)`, approved by pull request by the named verifier (TT-26). Attestation requires both a complete row and a matching manifest entry. No new infrastructure is needed; corpus changes require a deployment.
- **Before commercial scale:** a restricted database role or audit trail for `book_ai_rights` (infrastructure), and opt-in records.

---

## 9. Proposed mission sequence — **proposals only; none created, approved, or executed**

Every mission below would carry "Production deployment: NOT AUTHORIZED; merge to `main`: NOT AUTHORIZED" unless stated.

| # | Mission (working title) | Depends on | Acceptance (summary) | Environment authorization | Rollback |
|---|---|---|---|---|---|
| **P0** | Pilot decisions packet (documentation) | This assessment | §10 decisions answered and recorded | None | n/a |
| **M1** | Ledger cost model: D1–D3, D14, D15 | NEM-019 (#46) | Reservation ≥ `worst_turn`; global micro-USD guard holds under concurrent variable-cost turns and settlement failures (real-PostgreSQL tests); B-6 and F-12 tests still pass | Disposable test DB only | Revert the additive migration; flag off |
| **M2** | Rights and text adapters (pilot manifest) | P0 (TT-26), NEM-019 | Unmanifested or stale-hash rows denied; no real book attested until P0 names the corpus | Disposable test DB only | Unbind (deny) |
| **M3** | Pilot entitlement adapter | P0 (TT-23, TT-15 subset) | Only the PO-defined subset qualifies; linked members and other states stay `unknown`; no writes to plans or subscriptions | Disposable test DB only | Unbind |
| **M4** | Real Gateway adapter + evaluation run | P0 (PO-005, figures), M1, staging prerequisites §7.3 | Kill switch tested; provider alert and limit configured; evaluation thresholds measured; cost within ±30% of §4; reader p95 unchanged | **Staging only**, by explicit authorization naming it | Revoke key; flag off |
| **M5** | Minimal web session UI | M1–M4 | ≤ 3-book selection, lock/fork UX, citations, safe copy; reader unaffected | Staging only (with M6) | Flag off |
| **M6** | Staging deployment + internal pilot operation and report | M1–M5, §7.3 | Pilot within §5.4 figures; exit criteria (§11) reported with raw ledger-versus-invoice reconciliation | **Staging only**, explicit | Flag off; revoke grants and key |
| M7+ | External-pilot gates (§3.2) incl. **production deployment under F-6** | M6 passes | Per gate | Production only by its own authorization | Per gate |

---

## 10. Open Product Owner decisions (existing IDs)

| Needed for | Decision | ID |
|---|---|---|
| B | Provider(s), platform, and data handling | PO-005 |
| B | Pilot participants without a book plan | **TT-23** |
| B | Qualifying subscription types and states (pilot subset); linked members | **TT-15** |
| B | Pilot corpus | **TT-12** (PO-029 draft) |
| B | Evidence standard, verifier, jurisdictions | **TT-26** |
| B | Internal consent; public Terms for C | **TT-22** |
| B | COGS target and denominator (the pilot only measures) | TT-09 |
| B | Behaviour at the limit | TT-11 |
| B | Capacity visibility | TT-10 |
| B | Noetia+ depth | TT-08 |
| B | Expand without web (candidate) | TT-18 |
| B | Spending figures in §5.4 | B4 (values) |
| B | Staging deployment authorization (and NEM-017 infrastructure authorization) | F-6 context; NEM-017 |
| C | Quotation and reconstruction thresholds | TT-13 (F-2) |
| C | Retention of pilot conversations | TT-14 |
| C | Production deployment of the stack | F-6 |
| Later | NoetiaX depth; prices and billing; token expiry; highlights; Briefs; mobile | TT-07; TT-16; TT-01; TT-25, TT-27; TT-17; TT-20 |
| Any | Anonymized cost-record retention after deletion | B-2 (PO/PA) |
| Any | Adoption of the GOV-001 merge gate | PR #39 |

**Engineering details** (not PO decisions, within approved values): model routing within an approved provider; context assembly and chunking; cache TTL and keep-alive; timeouts and concurrency caps; rate-card schema; the reservation formula; the manifest format; UI layout within the voice guide.

---

## 11. Pilot design

| | Internal (B) *(candidate)* | External (C) *(candidate)* |
|---|---|---|
| Population | 3–5 staff with qualifying subscriptions (or per TT-23) | 15–30 invited subscribers, ES/EN |
| Capabilities | Noetia+ sessions, 1–3 books, Q&A with citations | Same |
| Excluded | NoetiaX real use, Briefs, Ask My Highlights, Expand-with-web, mobile, billing | Same |
| Ceilings | §5.4; context ≤ 3 books; `max_tokens` cap; concurrency cap | §5.4 |
| Duration | 2–4 weeks | 4–6 weeks |

**Exit criteria (thresholds for the PO):**
- citation resolution and grounding at or above the T2 thresholds;
- zero leakage across users or households;
- zero unexplained scope violations;
- reader p95 unchanged;
- ledger versus provider invoice within tolerance (candidate ≤ 2%, measured after the provider's reporting delay);
- cost per session within ±30% of §4 after 20 sessions;
- the full-book versus retrieval quality gap quantified;
- participant signal.

**Stop conditions:**
- 80% of the ledger allowance consumed before mid-period;
- a provider alert fires;
- any isolation defect;
- a reader regression;
- an unexplained scope violation;
- a rights challenge or provider-terms change;
- reconciliation divergence beyond tolerance;
- error or refusal rate above an agreed level.

---

## 12. Risks and unresolved questions

| Risk | Severity | Mitigation |
|---|---|---|
| Treating provisional prices as facts | High | §4.1 verification before any spending authorization |
| Real calls before Mechanism 2 exists | **Critical** | M1 precedes M4; no real call on Mechanism 1 |
| Full-book benchmark mistaken for the product | High | §6.1 |
| An accidental production deployment through a stack merge | **Critical** | §7.2 prerequisites; §7.4 guardrails |
| Reader degradation from long AI requests in the API process | High | Concurrency cap, timeouts, stop rule; worker offload before C |
| Corpus judged non-compliant somewhere | High | Conservative heuristic + legal review |
| Staging not isolated | High | NEM-017 before credentials or data |
| Provider limit enforcement lag | Medium | Ledger is primary; provider is backstop only |

**Unresolved questions for review:**
1. Is a staging-hosted internal pilot acceptable, or must pilot data live only in production?
2. Who writes or approves the evaluation questions?
3. Is cross-user caching of public-domain book-text-only prefixes acceptable under PO-005?
4. Which model tiers may the router use in the pilot (engineering proposes, PO approves spend)?
5. Do the provisional context limits hold on the chosen platform and region?
6. Should per-user allowance units be defined so that they track cost closely during the pilot (simpler), or stay decoupled as ADR-005 intends for commercial use? A PO/PA choice; the global micro-USD guard is the dollar ceiling either way.

---

## Appendix A — Reproducible cost calculation

Run with `python3 pilot_costs.py`. It uses the provisional PS-1 prices (§4.1) and the assumptions in §4.2, and reproduces every entry in §4.4 and §4.5 and the §5.4 spending target. Haiku 5.5 cache write and read multipliers are **assumed** (1.25× and 0.1× of input). The long-context row doubles all input classes as a **hypothetical**.

```python
# Reproduces every cost entry in 10-pilot-readiness-assessment.md §4.4–§4.5 (PS-1, provisional prices).
M = 1e-6
PS1 = {  # $ per token: input, output, cache write (5-min), cache read
    "sonnet": dict(i=2*M, o=10*M, w=2.5*M, r=0.2*M),
    "opus":   dict(i=4*M, o=20*M, w=5*M,   r=0.2*M),
    "haiku_long":  dict(i=0.5*M, o=2.5*M, w=0.625*M, r=0.05*M),   # > 100K prompt tier; write/read multipliers assumed
    "haiku_short": dict(i=0.1*M, o=0.5*M, w=0.125*M, r=0.01*M),   # <= 100K prompt tier
}
def turn_cold(p, C, O): return C*p["w"] + O*p["o"]
def turn_warm(p, C, O): return C*p["r"] + O*p["o"]
def worst(p, C, Omax):  return C*max(p["i"], p["w"]) + Omax*p["o"]
def full(p, C, T, O, W): return W*turn_cold(p, C, O) + (T-W)*turn_warm(p, C, O)
def nocache(p, C, T, O): return T*(C*p["i"] + O*p["o"])
def retr(p, R, T, O):    return T*(R*p["i"] + O*p["o"])
B = 150_000  # median book; all monthly rows use median B (book size varies only in §4.5)
r = lambda x: f"{x:,.3f}"
print("§4.4 per turn")
for name, p, C in [("full1 sonnet", PS1["sonnet"], B), ("full3 sonnet", PS1["sonnet"], 3*B),
                   ("full3 opus", PS1["opus"], 3*B), ("full3 haiku", PS1["haiku_long"], 3*B)]:
    print(f"  {name}: cold {r(turn_cold(p,C,3000))} warm {r(turn_warm(p,C,3000))} worst(8K) {r(worst(p,C,8000))}")
for name, p in [("retr sonnet", PS1["sonnet"]), ("retr haiku", PS1["haiku_short"])]:
    print(f"  {name}: turn {r(20_000*p['i']+3000*p['o'])} worst(40K,8K) {r(40_000*p['i']+8000*p['o'])}")
print("§4.4 monthly (B=150K)")
scen = {"low": dict(S=2, T=3, n=1, m=0, O=1500), "expected": dict(S=6, T=8, n=2, m=1, O=3000),
        "high": dict(S=20, T=15, n=3, m=3, O=8000)}
for k, s in scen.items():
    C, W = s["n"]*B, 1+s["m"]
    fs = full(PS1["sonnet"], C, s["T"], s["O"], W); fo = full(PS1["opus"], C, s["T"], s["O"], W)
    rs = [retr(PS1["sonnet"], R, s["T"], s["O"]) for R in (20_000, 40_000)]
    rh = [retr(PS1["haiku_short"], R, s["T"], s["O"]) for R in (20_000, 40_000)]
    print(f"  {k}: session full-sonnet {r(fs)} | month full-sonnet {r(s['S']*fs)} full-opus {r(s['S']*fo)} "
          f"retr-sonnet {r(s['S']*rs[0])}-{r(s['S']*rs[1])} retr-haiku {r(s['S']*rh[0])}-{r(s['S']*rh[1])}")
print("§4.5 sensitivity (expected session, sonnet)")
p = PS1["sonnet"]; C, T, O = 2*B, 8, 3000
print("  W=1,2,4,8:", [r(full(p, C, T, O, W)) for W in (1, 2, 4, 8)], "nocache:", r(nocache(p, C, T, O)))
print("  O=1.5K,3K,8K full:", [r(full(p, C, T, x, 2)) for x in (1500, 3000, 8000)],
      "retr:", [r(retr(p, 20_000, T, x)) for x in (1500, 3000, 8000)])
print("  R=20K,40K retr:", [r(retr(p, R, T, O)) for R in (20_000, 40_000)])
p2 = {k: (v*2 if k in ("i", "w", "r") else v) for k, v in p.items()}  # hypothetical: all input classes x2
print("  long-context x2 full:", r(full(p2, C, T, O, 2)))
print("  context C=60K,120K,300K,600K full:", [r(full(p, c, T, O, 2)) for c in (60_000, 120_000, 300_000, 600_000)])
print("§5.4 target: 5 users x expected =", r(5*6*full(p, C, T, O, 2)), "+ eval 40")
```

Output at revision 3:

```
§4.4 per turn
  full1 sonnet: cold 0.405 warm 0.060 worst(8K) 0.455
  full3 sonnet: cold 1.155 warm 0.120 worst(8K) 1.205
  full3 opus: cold 2.310 warm 0.150 worst(8K) 2.410
  full3 haiku: cold 0.289 warm 0.030 worst(8K) 0.301
  retr sonnet: turn 0.070 worst(40K,8K) 0.160
  retr haiku: turn 0.004 worst(40K,8K) 0.008
§4.4 monthly (B=150K)
  low: session full-sonnet 0.480 | month full-sonnet 0.960 full-opus 1.800 retr-sonnet 0.330-0.570 retr-haiku 0.017-0.028
  expected: session full-sonnet 2.100 | month full-sonnet 12.600 full-opus 23.040 retr-sonnet 3.360-5.280 retr-haiku 0.168-0.264
  high: session full-sonnet 6.690 | month full-sonnet 133.800 full-opus 247.800 retr-sonnet 36.000-48.000 retr-haiku 1.800-2.400
§4.5 sensitivity (expected session, sonnet)
  W=1,2,4,8: ['1.410', '2.100', '3.480', '6.240'] nocache: 5.040
  O=1.5K,3K,8K full: ['1.980', '2.100', '2.500'] retr: ['0.440', '0.560', '0.960']
  R=20K,40K retr: ['0.560', '0.880']
  long-context x2 full: 3.960
  context C=60K,120K,300K,600K full: ['0.612', '0.984', '2.100', '3.960']
§5.4 target: 5 users x expected = 63.000 + eval 40
```

---

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-09 | Initial DRAFT assessment |
| 2 | 2026-11-09 | Product Architecture review corrections P-1…P-5 (summary at top). Scope unchanged: assessment only; no new PO decision, ADR, or mission |
| 3 | 2026-11-09 | Review corrections P-6…P-8: every cost entry recomputed by script (Appendix A). High full-context Sonnet $113 → **$133.80**; also corrected High full-context Opus $205 → $247.80, Low full-context Sonnet $1.05 → $0.96, Low retrieval Sonnet $0.4 → $0.33, and the spending target $105 → $103. Context-size sensitivity restated by `C` (60 K = $0.61; the former "60 K, n = 2" row = 120 K = $0.98). Maximum exposure explicitly conditional on internal enforcement **and** provider limit behaviour; no unverified provider limit is described as a guarantee |
| 4 | 2026-11-09 | Strategy-update note (top): §1, §2, §9, §11 superseded by the P0 packet Revision 2; no other content changed |

*Documentation only. No application code, migration, infrastructure, CI/CD, Stripe, subscription, or production setting was changed. No AI provider was called, and no AI charge was incurred.*
