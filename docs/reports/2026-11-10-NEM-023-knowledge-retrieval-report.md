# NEM-023 — Report: Knowledge Retrieval and Grounding (Stage 1)

**Status:** **BLOCKED AT PRE-EXECUTION CHECK — no implementation code written.** Three approved stop conditions are triggered. Each needs a decision before implementation can start (§6). Partial report under the reporting protocol (blocked work).
**Delivery state:** Not merged · Not deployed · No production indexing · No implementation PR yet.

---

## 1. Mission and authorization

| Item | Value |
|---|---|
| Mission | NEM-023 — Knowledge Retrieval and Grounding (E5, Stage 1: lexical, S2), specification at reviewed commit `54ad768` (PR #52); product decisions in PO-033 |
| Authorization | PO *"EXECUTE NEM-023 — Product Owner Authorization: GRANTED"* (2026-11-10): execute under the exact scope, checkpoints (A: schema, S2 indexing, chunking, text identity, book-level indexing authorization; B: retrieval, user isolation, citations, rights, budgets; C: integration, regression, performance, documentation), restrictions, and stop conditions. **"If any approved stop condition is triggered, stop immediately and report the blocker rather than improvising a workaround."** |
| Branch | `feat/nem-023-knowledge-retrieval`, created from `54ad768` (ancestry: E5 docs PR #52 → NEM-022 `f6a5cb7` → NEM-021 → …). `main` untouched |

## 2. Pre-execution verification

| Check | Result |
|---|---|
| Repository state | Clean; `docs/e5-retrieval-discovery` = origin = `54ad768`; NEM-022 head `f6a5cb7` is an ancestor |
| PO-033 and specification | Present and consistent: D-1, D-4 (S2), D-6, D-7, D-9 |
| `retrieval_indexing` compatibility (spec §9.7) | Still holds (operations validated by form; no column constraint) |
| Schema additions (`ai_book_chunks`, text-search configurations, `unaccent`) vs the NEM-021 D-2 guard | Pass: additive only; no historical migration touched |
| Indexer command location | Must live inside `knowledge/` (the NEM-019 test allows only `app.module.ts` to reference `knowledge/*` from outside); feasible |
| **User content search (§5.6) vs NEM-019 architecture tests** | **FAIL — B-1** |
| **Chapter labels and phrase ranges (§5.2) vs NEM-019 architecture tests** | **FAIL — B-2** |
| **Any migration ≥ 075 vs the NEM-021 migration test** | **FAIL — B-3** |

## 3. Blockers (verified with temporary probes; nothing committed)

### B-1 — §5.6 user highlight and note search cannot be built without changing an accepted NEM-019 test

§5.6 requires reading the requesting user's `fragments` (`text`, `note`). Every route is closed by accepted NEM-019 architecture tests (`tests/unit/knowledge/architecture.spec.ts`):

| Route | Blocking test |
|---|---|
| SQL on `fragments` from `knowledge/*` | *AC-10/17* — the table regex includes `fragments` (line 50) |
| Import `FragmentsService` from `knowledge/*` | *AC-16/17* — the forbidden-import regex includes `fragments/` (line 43) |
| An adapter outside `knowledge/` implementing a knowledge port | *"only app.module.ts references knowledge/\* outside the module"* (line 31) |

**Probe** (a temporary `src/knowledge/retrieval/zz-probe.ts` holding the §5.6 query; deleted):

```
✕ AC-10/17: knowledge SQL touches no token, plan, subscription, user_books, or fragments table …
    + "src/knowledge/retrieval/zz-probe.ts"
Tests: 1 failed, 17 passed, 18 total
```

Stop condition hit: *"A NEM-019, NEM-021, or NEM-022 test must change to pass"*; `fragments` is a protected system (spec §8).

### B-2 — §5.2 chapter labels and phrase ranges from `sync_maps`

The chunker derives chapter labels from heading phrases and phrase ranges from `sync_maps` (read-only). The same AC-10/17 regex includes `sync_maps`, so the same probe failed on its `sync_maps` query. Reading it through the books module would evade the check's text but break its intent (no shared path with reader data). Not pursued.

### B-3 — Any migration ≥ 075 fails the accepted NEM-021 migration test

`tests/integration/knowledge/cost-migration.int-spec.ts` (NEM-021 AC-13) pins `AddCompensationAdjustmentKey1748300000074` as the latest migration (lines 61, 79, 95) and reverts 074, then 073, by position. E5's table needs migration 075.

**Probe** (a temporary one-table `1748300000075-ZzProbe.ts`, disposable PostgreSQL 16; deleted, containers removed):

```
✕ AC-13: 074 and 073 run down and up; …
    Expected: "AddCompensationAdjustmentKey1748300000074"
    Received: "ZzProbe1748300000075"
✓ AC-19 (NEM-019, already made position-independent by the approved NEM-021 D-1) …
Tests: 1 failed, 8 passed, 9 total
```

This is the same class of issue as NEM-021's pre-execution B-1, resolved then by an approved intent-preserving amendment.

## 4. Work completed

1. Verified state, ancestry, PO-033, and the specification.
2. Ran the three probes above. Every probe file was deleted, and the probe containers were removed.
3. Created branch `feat/nem-023-knowledge-retrieval`.
4. Recorded the execution authorization and the BLOCKED status: mission file moved to `APPROVED/` per the PO's statement that the specification is approved; register; this report.

**No application code, tests, migrations, extensions, configuration, CI/CD, or infrastructure changed.** No production or staging access; no provider; no cost.

## 5. Risks

| ID | Rating | Risk |
|---|---|---|
| R-1 | High (schedule) | Checkpoints A–C cannot start until B-1 to B-3 are decided |
| R-2 | Medium | Workarounds would evade the accepted guards' intent and are not pursued: reading `fragments` or `sync_maps` through other modules, renaming SQL, or placing adapters outside `knowledge/` |

## 6. Decisions required

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **B-1** | §5.6 user highlight and note search | **A:** Move §5.6 to **E6**, which already owns highlights (PO-028 Ask My Highlights) and turn wiring. E5 retrieves book chunks only; `QueryContextSource` returns `chunk` items. *Specification amendment (scope reduction); no protected-test change.* **B:** An exception to NEM-019 AC-10/17 permitting read-only, user-scoped `SELECT` on `fragments` from one named E5 file (PO + PA) | **A** — smallest, keeps NEM-019 guards intact, matches the E5/E6 boundary |
| **B-2** | §5.2 chapter labels and phrase ranges | **A:** Stage 1 stores `chapterLabel` and `phraseIndexStart/End` as **null**; they are derived and optional. The X-3 anchor (`textHash` + offsets) is unaffected; fill them later through an approved path. *Specification amendment.* **B:** An exception permitting a read-only `SELECT` on `sync_maps` from the indexer file. **C:** Heading heuristics on the MinIO text (new behaviour; not recommended) | **A** |
| **B-3** | NEM-021 AC-13 migration test | **A:** Approve one **intent-preserving amendment** of `cost-migration.int-spec.ts` AC-13: revert migrations newer than 074 first, then 074 and 073 **by name**, with every assertion kept (the NEM-021 D-1 pattern). Applied as a separate commit, shown green before any E5 code. **B:** None viable (E5 needs a table) | **A** (PO + PA, as a test exception) |

If A is approved for all three, implementation proceeds from this branch:
1. the B-3 test amendment as its own commit, with suites green;
2. then Checkpoints A, B, and C under the amended scope.

## 7. Protected-systems confirmation

Not modified: NEM-019 (code, tests, module bindings), NEM-021 (frozen contract v1, ledger, tests), NEM-022 (Gateway, tests), `fragments`, `sync_maps`, the reader, migrations, `main`, CI/CD, infrastructure, staging, production. No E6 work.

## 8. Next recommended action

PO decisions on B-1 and B-2 (specification amendments), and PO + PA approval of the B-3 test amendment. *(Recommendation only.)*
