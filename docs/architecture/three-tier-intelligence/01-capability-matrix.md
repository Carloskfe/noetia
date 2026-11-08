# 01 — Three-Tier Product Capability Matrix

**Status:** PROPOSED for Product Architecture review; updated after T0. Only rows tagged `PO` or `ADR` are approved. Rows tagged `T0` carry a preliminary ruling that is drafted but not yet accepted as a record.

**Tags**

| Tag | Meaning |
|---|---|
| `PO` | Stated in the Product Owner scope update of 2026-11-06 |
| `ADR` | Existing accepted decision (PO-001…005, ADR-001…004, or the approved PO direction of 2026-10-30) |
| `T0` | Preliminary PO ruling of the T0 review, drafted as PO-025…029 |
| `PROPOSED` | Architecture proposal; needs review |
| `OPEN → TT-nn` | Needs a Product Owner decision, listed in [05](05-open-decisions.md) |

---

## 1. The three tiers

| | **Noetia** | **Noetia+** | **NoetiaX** |
|---|---|---|---|
| **What it is** `PO` | The existing multimodal reading and social-sharing platform | Source-aware, interactive AI intelligence and research | Advanced source-aware intelligence: deeper cross-book reasoning and research |
| **Books per analysis session** `PO` | No AI sessions (`PROPOSED`) | **Maximum 3** | **Maximum 10** |
| **Promise in one line** `PROPOSED` | Own, read and listen, highlight, share | Ask and compare a few books, and know where each idea came from | Investigate a question across a larger set and see how the arguments relate |

The customer-facing label "Basic" is not used anywhere (`PO`). "Basic subscription" in the 2026-10-30 approved wording is **internal shorthand only**; this package says **book plan** (Individual, Duo or Family).

## 2. Capability matrix

### Reading and ownership — the same for every tier

| Capability | Noetia | Noetia+ | NoetiaX | Status |
|---|---|---|---|---|
| Reader, Escucha Activa, offline, progress | ✓ | ✓ | ✓ | Existing; never depends on premium status (`ADR`, NEM-003 08). The PRD's planned free-versus-subscriber gating (lines 279, 297) is a separate matter within Noetia |
| Fragments, notes, quote cards, sharing, clubs | ✓ | ✓ | ✓ | Existing |
| Permanent ownership of acquired books | ✓ | ✓ | ✓ | `PO`, PO-021 |
| Buy token packages at $9.99 / $24.99 / $39.99 / $74.99 | ✓ | ✓ at the same prices | ✓ at the same prices | `PO` |
| Redeem a token for a book | ✓ | ✓ | ✓ | Existing |
| Purchased-token expiry | Same for all tiers | Same | Same | `T0`: **PO-024 governs**, with no universal 90-day rule. 1-token: 90 days; 3/5/10: six calendar months |
| A premium tier unlocks unowned paid books | ✗ | ✗ | ✗ | PO-021, PO-022 |
| A premium tier includes book tokens of its own | — | Not assumed | Not assumed | `OPEN → TT-16` |
| Available without a qualifying book subscription | — | ✗ | ✗ | `T0` (PO-026). Qualifying plans and states: `OPEN → TT-15` |

### Interactive research

| Capability | Noetia | Noetia+ | NoetiaX | Status |
|---|---|---|---|---|
| Book selection for a session | ✗ | Up to 3 | Up to 10 | `PO`; enforced server-side, [03 §3](03-research-architecture.md#3-server-side-enforcement-of-book-limits) |
| Interactive in-app conversation | ✗ | ✓ | ✓ | `PO` |
| Follow-up questions in session | ✗ | ✓ | ✓ | `PO` |
| Session synthesis | ✗ | ✓ | ✓ (deeper) | `PO` journey; depth `OPEN → TT-07` |
| Research Brief export | ✗ | ✓ | ✓ | `PO`; format `OPEN → TT-17` |
| Brief replaces the conversation | ✗ | ✗ | ✗ | `PO`: a Brief comes from a session; no one-shot path (`PROPOSED`) |
| Number of sessions per month | — | Governed by the budget | Governed by the budget | `PROPOSED`; `OPEN → TT-06` |
| Lock selected books at the first analysis turn; change by new or forked session | — | ✓ | ✓ | `PO` (PO-027, decided 2026-11-08) |
| Every selected book counts, including public domain; verified public-domain editions selectable without the library | — | ✓ | ✓ | `PO` (PO-027, decided 2026-11-08) |
| **Ask My Highlights**: search **and answers** over own highlights across the whole library, outside the book limit, with its own usage controls | Undecided | Undecided | Undecided | `PO` (PO-028, decided 2026-11-08); tier placement `OPEN → TT-25`; saved-quotation permissions `OPEN → TT-27` |

### Source awareness — the same integrity on both premium tiers

Accuracy and honesty are not sold by tier. These are the integrity baseline, not premium features (`PROPOSED`).

| Capability | Noetia+ | NoetiaX | Status |
|---|---|---|---|
| This Book / My Knowledge / Expand | ✓ | ✓ | `ADR` (ADR-003); analysis bound to selected books, `T0` (PO-028) |
| Permission check before content enters context | ✓ | ✓ | `ADR` (ADR-002) |
| Traceable citations (Book → Author → Chapter → chunk → reader location) | ✓ | ✓ | `ADR` (ADR-003) |
| Citation validation before display | ✓ | ✓ | `PROPOSED` |
| Library-derived and model-derived claims kept distinct | ✓ | ✓ | `ADR` (ADR-003) |
| Anti-reconstruction protections | ✓ | ✓ | `ADR` (ADR-002); thresholds `OPEN → TT-13` |
| Named external model in the promise | ✗ | ✗ | `ADR` (PO-001). NoetiaX must not be sold as "a better model" |

### Depth — the difference between premium tiers

`PO`: NoetiaX must be **qualitatively deeper, not only a larger book limit**. The precise capabilities need specification and PO approval, so everything in this table is a **candidate** for TT-07 and TT-08.

| Dimension | Noetia+ (candidate) | NoetiaX (candidate) |
|---|---|---|
| Retrieval | Single-pass, balanced across selected books | Multi-pass, driven by gaps found in earlier passes |
| Representation | Passages | Per-book map of claims and positions |
| Cross-book analysis | Side-by-side answers with cited agreements and tensions | Claim-by-book evidence matrix with typed disagreements |
| Reasoning | Direct synthesis | Argument reconstruction, assumption surfacing, counter-arguments |
| Verification | Citation validation (baseline) | Baseline, plus a claim-support pass and a coverage report |
| Brief | Required sections | Required sections, plus evidence matrix, method and coverage |
| Execution | Streamed | Streamed turns, plus longer resumable background runs |

### Economics

| Item | Noetia+ | NoetiaX | Status |
|---|---|---|---|
| Monthly internal resource budget | Own policy | Own policy | `PO` |
| Budget values | Not set | Not set | **Not invented here**; calibrated by measurement, then `OPEN → TT-09` |
| Book tokens increase AI allowance | Never | Never | `PO`, PO-001 |
| AI usage consumes book tokens | Never | Never | PO-001 |
| Subscription price | Not set | Not set | `PO`: not authorized by this assignment; `OPEN → TT-16` |

### Later NEM-003 capabilities not assigned to a tier

The scope update covers research. It does not say where these go, and this package does not drop them or assign them silently: DISCOVER (recommendations, semantic search), REMEMBER, CREATE, GROW, knowledge maps. → `OPEN → TT-19`.

## 3. Relationship to ownership and subscriptions

```
              NEVER depends on a premium tier
┌────────────────────────────────────────────────────┐
│ Ownership (user_books) · Reader · Escucha Activa   │
│ Fragments · Notes · Tokens (token_ledger)          │
└────────────────────────────────────────────────────┘
        ▲ read-only input: "may this book be analysed?"
        │
┌────────────────────────────────────────────────────┐
│ Intelligence: Noetia+ (3) · NoetiaX (10)           │
│ Entitlement · Sessions · Budgets (separate ledger) │
└────────────────────────────────────────────────────┘
```

| Rule | Source |
|---|---|
| Acquired books stay owned after any cancellation, downgrade, or expired token | `PO`, PO-021, PO-024 rule 16 |
| Cancelling a premium tier affects only intelligence features | NEM-003 08 |
| Owning a book does not itself grant AI rights over it | ADR-002 |
| Cancelling a premium tier never cancels the book plan | PO direction 2026-10-30 |
| Book plan ends → premium entitlement ends, per a future lifecycle policy | `T0` (PO-026), both tiers |
| Household token pools do not share libraries, notes, or AI conversations; linked members are not assumed to qualify | Governance README; `T0` |
| Effective book access = free, or a `user_books` row; never premium status | PO-021 (the code differs today: see [02 §3](02-reconciliation-report.md#3-current-code-versus-the-design)) |
