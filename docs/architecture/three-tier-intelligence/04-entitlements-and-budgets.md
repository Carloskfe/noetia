# 04 — Entitlements and Resource Budgets: Noetia+ versus NoetiaX

**Status:** PROPOSED; updated after T0 (PO-026, ADR-005, both drafts). **No budget value, model price, or subscription price is set here.** Every value is a named parameter until measured and approved. No billing system is modified.

---

## 1. Design rules

| Rule | Source |
|---|---|
| Book tokens never increase AI allowances, and AI usage never consumes book tokens | `PO`, PO-001 |
| Separate monthly internal budgets per premium tier | `PO` |
| Raw LLM tokens are not the customer-facing unit | PO-001 |
| Cancelling or downgrading never touches owned books, tokens, or reading | `PO`, PO-021, PO-024 |
| Each premium tier funds itself; the book plan is not an AI budget | PR #18 W-5 (planning) |
| Plan checks are centralized, never scattered | NEM-003 08, NEM-002A |

## 2. Tier-capability model

### Resolver

One service answers one question. Feature code never reads plans or Stripe state.

```ts
// Illustrative, not an implementation
interface EffectiveEntitlement {
  tier: 'noetia' | 'noetia_plus' | 'noetiax';
  source: 'subscription' | 'beta_grant' | 'admin_grant' | 'none';
  capabilities: ReadonlySet<Capability>;
  limits: { sessionMaxBooks: number };          // 3 or 10
  budgetPolicyId: string | null;
  policyVersion: number;
  validUntil: Date | null;
  denialReason?: 'tier_required' | 'prerequisite_missing'
               | 'payment_issue' | 'flag_off';
}
```

### Policy is versioned data

`ai_tier_policies` (append-only): tier, version, capability set, limits, budget policy reference, effective date.

| Capability (neutral naming) | Noetia | Noetia+ | NoetiaX | Status |
|---|---|---|---|---|
| `intelligence.session.create` | ✗ | ✓ | ✓ | `PO` |
| `limit.session.maxBooks` | — | **3** | **10** | `PO` |
| `intelligence.mode.this_book`, `.my_knowledge`, `.expand` | ✗ | ✓ | ✓ | ADR-003; Expand scope TT-18 |
| `intelligence.brief.export` | ✗ | ✓ | ✓ | `PO` |
| `intelligence.synthesis.standard` | ✗ | ✓ | ✓ | `PO` journey |
| `intelligence.deep.position_map`, `.evidence_matrix`, `.research_plan`, `.claim_verification` | ✗ | ✗ | Candidate | TT-07 |

A limit change is a new policy version approved by the PO, not a code edit.

### Resolution order

Corrects NEM-003 18's ordering (H-2): a rollout bucket and a flag can only **restrict**. **T0 change: a grant supplies a tier but never bypasses the prerequisite** (PO-026).

```
1. Master flag off                     → deny
2. Capability flag off                 → deny
3. Admin deny override                 → deny
4. Tier source: premium entitlement or grant; none → deny (tier_required)
5. Qualifying book plan (port answer):
     qualifying → continue
     not_qualifying or unknown → deny (prerequisite_missing)
6. Capability in tier policy?          else deny (capability_denied)
7. In rollout bucket?                  else deny (flag_off)
   → allow
```

`QualifyingPlanPort` hides how plans and states qualify (TT-15). Until an adapter exists, it answers `unknown`. Whether a no-charge pilot may use grants without a book plan is TT-23.

Cached in Redis with a short TTL; a change in entitlement invalidates the cache. If the cache is down, resolve from PostgreSQL. **If entitlement cannot be determined, deny AI, and never affect reading.**

### Isolation guarantees (architecture tests)

| Test | Protects |
|---|---|
| Reader, content guard, library, token modules do **not** import `knowledge/*` | Reader Stability, Ownership |
| `knowledge/*` does not import `TokenLedger`, `TokenPackage`, or `redeemToken` | Token independence |
| Resolver is keyed by `userId`; `linkedUserIds` grants no tier or data visibility | Personal Libraries |
| Every intelligence route has a declared capability | No missing checks |

## 3. Compatibility verification

### Stripe subscriptions: **not compatible today**

| Requirement | Current code | Verdict | Remedy (separate missions) |
|---|---|---|---|
| Hold a book plan and a premium tier | `uq_subscriptions_user`; upsert on `userId` (`subscriptions.service.ts:531`) | ✗ **overwrites** | M-C product lines |
| Read multi-item subscriptions | `items.data[0]`, `lines.data[0]` (`webhooks.service.ts:130,176`) | ✗ | M-C, M-D |
| Premium invoices issue no tokens | Every paid invoice issues `tokensPerCycle`, default 1 (`webhooks.service.ts:141`; `plan.entity.ts:23-24`) | ✗ | Issue only for the book-plan line |
| Premium plans not auto-listed | `findAll` returns all rows; pricing page renders them | ✗ | Product line filter, launch control |
| Premium never unlocks paid books | Any active row unlocks (`subscription.guard.ts:41`) | ✗ | NEM-013 |
| Webhook verification and idempotency | Present (NEM-002A); `stripe_processed_events` | ✓ reuse | — |
| Revenue separately identifiable | No per-line payment record | ✗ | M-D |
| Refunds and disputes | Not handled (NOF-003) | ✗ | M-D |
| Account deletion cancels billing | Does not (NOF-004 audit) | ✗ | M-D (G9) |
| Cancelling premium leaves the book plan | Cancel acts on the user's one Stripe subscription (`subscriptions.service.ts:482-490`) | ✗ | Product-line-aware cancel: remove the premium item or subscription only |
| Trial policy per product | 14-day trial hard-coded on all plan checkouts (`subscriptions.service.ts:216`) | ✗ | Per-plan trial, after TT-16 |

**The resolver is structure-neutral.** Whichever structure TT-16 selects, it reads a normalized "product-line entitlement" rather than Stripe shapes.

| Structure | For | Against |
|---|---|---|
| **One Subscription, separate line items** (recommended under the approved dependency) | One invoice and one failure state, which suits "ends when the book plan ends"; a tier change is a price swap | Line-level attribution of fees, refunds, discounts, and taxes needed (PR #18 §9.2); **cancel must remove the premium item, never set `cancel_at_period_end` on the Subscription**; interval handling to verify against current Stripe documentation |
| **Two Subscriptions** | Independent lifecycles; simple revenue separation | Two charges and fees; the cascade must be built; recommended earlier only because of independence, which the 10-30 direction removed |

### Permanent ownership: **compatible by design, with one precondition**

Ownership never reads premium status. Precondition: `user_books` is not yet trustworthy as proof of ownership (F-7), so AI eligibility depends on NEM-011 and B-10.

### Book-token mechanics: **fully compatible**

Token purchase needs only login and confirmed email (`subscriptions.controller.ts:48-50`), prices are unchanged (verified on the public endpoint, 2026-11-06), and nothing here adds a tier check. Stripe's own prices were not checked.

| Event | Tokens and books | AI budget |
|---|---|---|
| Buy a token package | Tokens added at the unchanged price | **Unchanged** |
| Redeem a token | Book owned permanently; may become eligible for analysis | **Unchanged** |
| A token expires | Lost per PO-024 | **Unchanged** |
| Budget exhausted | Still buy, redeem, read, and listen | Limited |
| Premium cancelled | Tokens and books untouched | Ends |
| Upgrade or downgrade | Untouched | New policy applies |

The ledgers have no foreign key, shared table, or shared service between them. An answer may *link* to the acquisition flow, but AI never spends a token.

## 4. Resource budgets

### Two measures, deliberately separate

| Measure | Unit | Used for | Changes when provider prices change? |
|---|---|---|---|
| **Actual cost** | Estimated micro-USD from a versioned rate card (`ai_usage_events.estCostMicros`) | Finance, COGS, global guard | Yes |
| **Allowance** | **Noetia Resource Units**: internal, weighted by workload | Per-user fair use | No, unless a new rate version is approved |

**Why not budget directly in dollars?** A provider price rise would silently shrink what customers receive. Separating them means price shocks hit the global guard and alerts, leaving a visible decision for a human. Resource units are never shown to customers (PO-001).

### Budget policy parameters (values intentionally absent)

Separate instance per tier. **No values are proposed; see calibration below.**

| Parameter | Meaning | Noetia+ | NoetiaX |
|---|---|---|---|
| `monthly_units` | Hard monthly allowance per user | `P_units` | `X_units` |
| `soft_threshold_pct` | When to begin conservation behaviour | `P_soft` | `X_soft` |
| `advanced_units_cap` | Monthly share for advanced reasoning | `P_adv` | `X_adv` |
| `turn_ceiling` | Maximum units for one turn | `P_turn` | `X_turn` |
| `deep_run_ceiling` | Maximum units for one background run | n/a unless TT-08 allows | `X_run` |
| `session_ceiling` | Maximum units for one session | `P_sess` | `X_sess` |
| `context_budget` | Maximum context per turn, total and per book | `P_ctx` | `X_ctx` |
| `rate_limit`, `concurrent_runs` | Burst and parallelism | `P_rate` | `X_rate` |
| `global_monthly_cost_cap` | **Tier-wide** spend ceiling in cost terms | `P_global` | `X_global` |

### Metering and reservation

`ai_usage_events` (NEM-003) records what happened. It cannot stop overspend when several requests run in parallel, so a **reservation ledger** is added (X-7).

```
Preflight estimate → atomic reserve (Redis)      fail → graceful "budget" state
  → model call(s) via Gateway
  → settle to actual: write usage event + budget ledger entry
  → release the unused reservation
```

| Situation | Behaviour |
|---|---|
| Provider failure | Reservation released; user not charged |
| User aborts a stream | Charged for actual consumed |
| Crash mid-call | Expired reservations reconciled by a job; ledger is the source of truth |
| Redis lost | Rebuild from PostgreSQL; AI denied until then; reader unaffected |
| Duplicate request | Idempotency key; one charge |
| Cache hit | Actual consumption only (benefit goes to the user); recorded with `cacheHit` |

**Period:** `OPEN → TT-11`. Recommended: anchored to the billing date, with monthly resets on annual plans using calendar months (the 30-day token drip already drifts; PO-024 E-6). No rollover.

**Plan changes (proposed):** upgrade applies the new budget at once; downgrade applies at period end.

### Dynamic model routing

Routing follows ADR-001: workload → class → qualified model, set by configuration (PO-005 as the initial configuration). Tier determines **which workloads run and within what budget**.

| Workload | Class (ADR-001) | Noetia+ | NoetiaX |
|---|---|---|---|
| Intent, query rewrite, title, compaction | Low-cost | ✓ | ✓ |
| Embeddings | Low-cost | Shared | Shared |
| Grounded answer | Standard | ✓ | ✓ |
| Citation validation | Low-cost, plus deterministic | ✓ | ✓ |
| Agreements and tensions | Standard or Advanced: **TT-08** | ✓ | ✓ |
| Position map build (DX-1) | Standard or Advanced by evaluation | — | Candidate |
| Evidence matrix, typed disagreement (DX-2, 3) | Advanced | — | Candidate |
| Research planning (DX-4) | Low-cost to Standard | — | Candidate |
| Claim-support verification (DX-7) | Low-cost to Standard | — | Candidate |

Each route has a fallback, and a route change requires passing evaluation (ADR-001).

### Caching

| Layer | Content | Scope | Key includes | Rights check |
|---|---|---|---|---|
| **Embeddings** | Chunk vectors | Shared | `bookId`, `textHash`, embedding version | At retrieval |
| **Per-book artifacts** | Position maps | Shared if the title permits | `textHash`, pipeline version | At read; purged on revocation (X-6) |
| **Provider prompt cache** | Stable system and context prefix | Per Gateway capability | Provider-defined | Requires provider data-handling review |
| **Retrieval results** | Chunk IDs per query | User or session | `userId`, book-set hash, rights version | Rights version in key |
| **Answers** | Generated answers | **Only** verified public-domain, non-personal questions, if at all | Mode, book set, rights version, prompt and route version | Never with notes or highlights |

**Never cached across users:** anything using notes, highlights, or conversation context (NEM-003 15). DX-1 shows why caching matters most for NoetiaX: the first user of a book pays the build cost, and later sessions reuse it, turning per-book cost from repeated to approximately one-time.

### Fair-use enforcement

| Level | Check | Response |
|---|---|---|
| Request | Oversized prompt, rate, concurrency | Reject before any model call |
| Turn or run | Ceiling | Reduce plan or ask to narrow |
| Session | Ceiling | Offer synthesis, or a new session |
| User, month | Soft, then hard | Conservation, then TT-11 behaviour |
| Abuse | Anomalies; reconstruction signals | Throttle and review |
| Tier, month | `global_monthly_cost_cap` | Tier-wide ladder below |

### Graceful degradation

**Principle: degradation is always disclosed and never silently sold as depth.** If a NoetiaX deep run is not possible, it is queued or declined. A shallow result must not be presented as deep, and Brief limitations record what happened.

| Stage | Trigger (parameter) | Action | User-visible |
|---|---|---|---|
| 0 Normal | — | Normal routing | None |
| 1 Conserve | Soft threshold | More cache, tighter context, fewer rerank passes | None or minimal; quality must still pass evaluation |
| 2 Reroute | Advanced cap, or provider issue | Lower-cost **qualified** route; a route without qualification is not used | Note, if capability changes |
| 3 Defer | Global pressure | Queue deep runs and Briefs | "Will be ready later" |
| 4 Restrict | Hard limit | Stop generation; history, Briefs, exports, and search stay available | Clear message per TT-11 |
| 5 Tier off | Global cap, or incident | Capability flag off | Clear message |
| 6 Kill | Master flag | All intelligence off | **Reader fully unaffected** |

### Cost observability

Extends NEM-003 16, using PO-001's bands. No prompts or answers in logs.

| Metric | Dimensions | Purpose |
|---|---|---|
| Cost and units | Tier, workload, class, provider, model | Main cost view |
| **AI COGS ÷ revenue per tier** | Noetia+ and NoetiaX **separately** | Blended ratios could hide a loss-making tier. Denominator per TT-09 |
| Cost per active subscriber, per session, per turn, per Brief, per deep run | Tier | Unit economics |
| Distribution p50, p90, p99; share used by top 1% | Tier | Heavy tail |
| Cost by number of books | Tier | Tests the claim that cost is not linear in books |
| Cache hit rate, including artifact reuse | Layer | Main lever |
| Model class mix | Tier | Advanced share |
| Limit and degradation events | Tier, stage | Experience and tuning |
| Limit rejections; reconstruction signals; refusals | Tier | Abuse |
| API, database, and worker saturation **alongside** reader latency | — | Reader protection; alerts on regression |

**Alerts:** PO-001 band crossings per tier; projected tier cap breach; unknown rate card; reservation drift; reader latency regression while intelligence load is high.

### Calibration: how values get decided

1. **Benchmark corpus** of verified public-domain books, ES and EN (T2).
2. **Shadow measurement** of each workload under PO-005 configuration with verified current provider prices, on 1, 3, and 10 books (T4).
3. **Closed beta with hard technical caps** (T5, T7): real behaviour and the distribution.
4. **Compute the bounds:**

```
Self-funding ceiling(tier) = (1 − a) × P − fee(P) − U           [per subscriber-month]
Healthy average(tier)      = 0.25 × denominator(TT-09)          [PO-001 band]
Worst-case cost(tier)      ≈ monthly_units × cost per unit      [must be ≤ self-funding ceiling]
```

5. **The PO approves** values and prices together (TT-09, TT-16).

`P`, `a`, `fee`, and `U` are undecided or unmeasured. PR #18's illustrative result (break-even AI near $4.93 at a $6.00 *planning* price) shows the method; it is **not** adopted here. **Key consequence for review:** cost is bounded by the hard budget, whereas the *average* depends on behaviour, so both checks are needed.

## 5. Open items for this document

TT-06, TT-08, TT-09, TT-10, TT-11, TT-15, TT-16, TT-23. See [05](05-open-decisions.md).
