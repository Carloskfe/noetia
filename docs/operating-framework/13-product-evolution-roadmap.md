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
| **NEM-007 Phase B** — attribution schema, API, staging validation, catalog audit | IG-04 — no authoritative attribution system exists. Phase A (PO-011/012/013) is **complete** | **NEM-006C completion + acceptance**, stable staging, explicit PO authorization |
| **Creator settlement / payout engine** (NEM-008) | IG-02 | NOF-002 GATE D blockers: C-11, breakage residual and Q-14 are **now resolved** (PO-011/012/013); **IG-04 attribution remains**, plus `ACCOUNTING REVIEW` |
| **Stripe pricing verification** | IG-01 — live prices unverified against PO-006 | Production Stripe access |
| **NEM-006B** — production PG16 restore-compatibility proof | Prerequisite for any pgvector production work | Staging content (NEM-006C) |
| **Backup & restore (NEM-009 candidate)** | NOF-003: 6 CRITICAL gaps — no off-site copy, no MinIO backup, no secret backup, no tested restore, unverified execution, secrets not gitignored | Level 1 items are cheap; `.gitignore` fix is one line |
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

PO-007 allocation + PO-008 accrual + PO-010 basis + PO-011/012 timing + PO-013 discounts
                                   │
   NEM-006C ──> NEM-007 Phase B (attribution, IG-04) ──> NEM-008 settlement (IG-02)
                                   ACCOUNTING REVIEW ────┘
```

Two chains, largely independent. The Noetia+ chain is well specified and gated on
infrastructure. The economic chain's **policy is complete** — PO-010 through PO-013 answered
every open product question — leaving it gated on *attribution* (who is owed), accounting
review, and implementation. **It remains the chain accruing cost while it waits**, and both
chains now converge on NEM-006C finishing.
