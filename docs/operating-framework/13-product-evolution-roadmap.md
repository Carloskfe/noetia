# Product Evolution Roadmap

**v0.1** · NOF-001 · **No delivery dates.** Dates appear only where explicitly established;
none were found. Sequencing reflects dependencies and current engineering reality.

---

## NOW — in flight

| Item | State |
|---|---|
| **NEM-006C** — full-catalog reader-validatable staging content | Executing. Tooling committed; audio mirror in progress |
| **NOF-001** — Operating Framework v0.1 | This mission |
| **NEM-006A acceptance** | Complete, awaiting Product Architecture review. Auto-deploy deliberately **not armed** |

## NEXT — unblocked, not started

| Item | Why now | Blocked by |
|---|---|---|
| **Creator attribution in the schema** | IG-04 — no rights holder, narrator, or self-narrated flag per book. **The hard blocker on NEM-007** (NOF-002 §12) | Product + schema decision |
| **Creator settlement / payout engine** (NEM-007) | IG-02 | **GATE D = NO** (NOF-002): blocked on IG-04, C-11 Causas basis, breakage residual, Q-14 |
| **Stripe pricing verification** | IG-01 — live prices unverified against PO-006 | Production Stripe access |
| **NEM-006B** — production PG16 restore-compatibility proof | Prerequisite for any pgvector production work | Staging content (NEM-006C) |
| **Backup & restore procedure** | No documented, tested procedure exists | — |
| **Family seat resolution** | C-02 — a marketing claim and an enforcement rule disagree | Product Owner (Q-05) |

## LATER — approved direction, dependencies outstanding

| Item | Depends on |
|---|---|
| **Noetia+ / Noetia Brain** (NEM-006 resumed) | NEM-006B, AI credentials (PO-005), evaluation methodology |
| **Ask This Book** | Semantic retrieval, permission enforcement |
| **My Knowledge** | Ask This Book + highlight/note indexing |
| **Expand** | Provenance/labelling UX |
| **Rights-holder AI controls** | Schema decision (PO-002 defers it) |
| **Clubes de Lectura** | Specified in project memory only; absent from the documentation corpus |
| **Peer token gifting** | C-07 — confirm committed vs idea |
| **Narrator tooling** | An economic party with no product surface |

## EXPLORATORY — no commitment

- Advance / hybrid narrator compensation models
- Accessibility programme (**no policy exists at all** — see [03-product](03-product-framework.md))
- Additional markets beyond the LatAm / US-Hispanic emphasis (Q-13)
- Approximate vector indexing (HNSW/IVFFlat) — explicitly evidence-driven, not now

## Standing commitments with unclear triggers

| Commitment | Problem |
|---|---|
| Free-library additions stop after 6–12 months | No start date recorded → C-10, Q-08 |
| Free-library hero placement replaced at 50+ author titles | No owner watching the count |

Both are stated product commitments with no way to tell whether they have come due.

## Dependency spine

```
NEM-006A staging ──> NEM-006C content ──> NEM-006B PG16 proof ──> NEM-006 Noetia+
                                                                      ▲
                              PO-005 AI credentials ─────────────────┘
                              evaluation methodology (OPEN) ─────────┘

PO-007 allocation + PO-008 accrual + PO-010 gross value ──> settlement engine (IG-02)
                                    ACCOUNTING REVIEW ─────┘  discount allocation (Q-14) ┘
```

Two chains, largely independent. The Noetia+ chain is well specified and gated on
infrastructure. The economic chain's **policy is now complete** — PO-010 supplied the last
missing input — leaving it gated on accounting review and implementation rather than on an
unanswered product question. **It remains the chain accruing cost while it waits.**
