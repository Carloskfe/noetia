# NEM-023 — Report: Knowledge Retrieval and Grounding (Stage 1)

**Status:** **IMPLEMENTATION COMPLETE — AWAITING PRODUCT ARCHITECTURE REVIEW.** Checkpoints A–C done under Amendment 1 (PO: B-1, B-2, B-3 Option A, §9). One target was **not met**: retrieval p95 ≤ 150 ms (§13); this needs a decision. §1–§8 are kept as the record of the blocked pre-execution check; §9 onward records the resumed work.
**Delivery state:** Draft PR only · Not merged · Not deployed · No production indexing · No staging · No paid or external AI.
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

---

## 9. PO decision on B-1 to B-3 (2026-11-10)

PO *"NEM-023 RESUME AUTHORIZATION — PRODUCT OWNER DECISION: APPROVED"* approves **Option A** for all three blockers. It is recorded in the mission as **Amendment 1**.

| ID | Decision | Effect |
|---|---|---|
| B-1 | **A** | User highlight and note retrieval moves to **E6's** future scope. E5 returns **book passages only** (`chunk` items). NEM-019's protections for `fragments` are unchanged. E6 is not implemented |
| B-2 | **A** | `chapterLabel`, `phraseIndexStart`, and `phraseIndexEnd` stay nullable and **unpopulated** in Stage 1. `textHash`, code-point offsets, and citation correctness are preserved. `sync_maps` is neither read nor modified |
| B-3 | **A** | Exactly one intent-preserving amendment of `tests/integration/knowledge/cost-migration.int-spec.ts`: revert newer-than-074 migrations first, then 074 and 073 by name, keeping every NEM-021 assertion; separate commit; verified on disposable PostgreSQL with the NEM-021 regression suites **before** Checkpoint A. No other protected test may change |

The restrictions are unchanged: no merge, no deployment, no production indexing or data, no paid or external AI, no infrastructure or CI/CD changes, no E6, and no change to protected NEM-019/021/022 behaviour.

## 10. Phase 2 — B-3 verification checkpoint (passed before any E5 code)

| Item | Value |
|---|---|
| Amendment commit | **`49ecace`** `test: NEM-023 B-3 — NEM-021 AC-13 reverts migrations newer than 074 first (intent-preserving)` (file: `tests/integration/knowledge/cost-migration.int-spec.ts` only) |
| What changed | `revertMigrationsAfter074()` runs before the AC-13 assertions. 074 and 073 are still reverted **by name** (the existing per-step name assertions). Snapshot comparisons run at the "074 is latest" state; the full schema is restored at the end (`showMigrations() === false`). **Every existing assertion is kept**; no production code, contract v1, ledger, or historical migration changed |
| Disposable database | `postgres:16-alpine` (16.13) at `127.0.0.1:55432`, database `nem019_test`; Redis 7 at `127.0.0.1:56379`. Both containers were created for the run |
| Amended test, no newer migration | `npx jest -c jest.integration.config.js --runInBand tests/integration/knowledge/cost-migration.int-spec.ts` → **3 passed / 3** |
| Amended test with a **temporary** `ZzProbe1748300000075` migration (the probe that failed in §3 B-3; deleted afterwards, never committed) | **3 passed / 3**; the database ended fully migrated (075 applied) |
| NEM-021 regression (+ every other integration suite) | `npx jest -c jest.integration.config.js --runInBand` → **7 suites, 111 passed / 111** |
| Knowledge unit regression | `npx jest --maxWorkers=2 tests/unit/knowledge` → **37 suites, 713 passed / 713** |

Environment for every integration command: `NEM019_DISPOSABLE_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=nem019_test DB_USER=noetia DB_PASS=test NEM019_REDIS_URL=redis://127.0.0.1:56379`.

## 11. Checkpoints

| Checkpoint | Commit | Content |
|---|---|---|
| Phase 1 | `d45acdc` | Amendment 1 (B-1, B-2, B-3) recorded in the mission, register, and this report |
| B-3 | `49ecace` | The single authorized protected-test amendment (§10) |
| **A** | `539e031` | Migration 075 (`unaccent`, `noetia_es/en/simple`, `ai_book_chunks` S2); `computeTextHash`; chunker; `IndexingPermission`; `BookIndexer` (transactional, limits, prune, purge); `StorageService.getBytes` + `StorageBookText`; metrics; operator command; unit tests |
| **B** | `370f6cc` | `LexicalRetrievalService` (SQL-level allowed pairs, constant per-language configurations, deterministic ranking, budget, S2 hash-checked fetch); `QueryContextSource`; `AnchorResolver`; NEM-023 architecture tests |
| **C** | see PR head | Integration suites (A + B, end to end, performance); optional verified-text cache (off by default); technical-note §13; migration entry 075; this report |

Design, runbook, limits, and deviations: [technical note §13](../architecture/three-tier-intelligence/09-nem-019-control-plane-technical-note.md#13-nem-023--knowledge-retrieval-stage-1-lexical-s2-draft-pr-dark).

## 12. Test commands and results (final, fresh disposable containers)

| Suite | Command | Result |
|---|---|---|
| All integration suites (NEM-019, NEM-021, NEM-022, NEM-023) | `npx jest -c jest.integration.config.js --runInBand` (env as in §10) | **9 passed, 1 skipped (performance, opt-in); 146 passed / 146** |
| NEM-023 integration A + B | `… tests/integration/knowledge/retrieval.int-spec.ts` | **31 / 31** |
| NEM-023 end to end | `… tests/integration/knowledge/retrieval-e2e.int-spec.ts` | **4 / 4** |
| NEM-023 performance | `NODE_OPTIONS=--experimental-vm-modules NEM023_PERF=1 NEM023_MINIO_ENDPOINT=127.0.0.1 NEM023_MINIO_PORT=59000 NEM023_MINIO_ACCESS_KEY=… NEM023_MINIO_SECRET_KEY=… npx jest -c jest.integration.config.js --runInBand tests/integration/knowledge/retrieval-performance.int-spec.ts` (disposable local `minio/minio` container) | **1 / 1** (§13) |
| Full API unit suite | `npx jest --maxWorkers=2 --coverage` | **125 suites, 1,823 passed / 1,823** |
| Coverage, `src/knowledge/retrieval/**` | (same run) | **100% statements, 96.6% branches, 100% functions, 100% lines** |
| Coverage, global | (same run) | Statements 93.92%, branches **78.76%** (the global 80% branch gate fails; it is pre-existing and has never passed on `main`; 77.49% at NEM-022, so this branch improves it), functions 91.8%, lines 95.08% |
| Lint | `npx eslint src/knowledge/retrieval src/knowledge/rights/text-hash.ts src/storage/storage.service.ts` | 0 errors |
| Typecheck | `NODE_OPTIONS=--max-old-space-size=1536 npx tsc --noEmit -p tsconfig.json` | 0 errors |

**Unchanged and passing:** NEM-019 `architecture.spec.ts` (including the `fragments`/`sync_maps` table guard and port bindings), NEM-021 contract and ledger suites, the NEM-022 gateway and provider-contract suites, and NEM-019/021/022 integration (`a-schema-migrations` AC-19, `cost-migration` AC-13 with migration 075 present, `cost-ledger`, `ledger`, `sessions`, `gateway-e2e`, `account-deletion`).

## 13. Measurements (§9.4, §13)

**Fixture:** 10 invented books × 2,000,000 code points each (≈ the largest dev book, ~500k tokens); production defaults (1,500 code points, 10% overlap). The vocabulary is Zipf-like and deterministic. S2 reads go through the **real `StorageService` against a disposable local MinIO**.

| Measure | Result |
|---|---|
| Chunks | 17,780 (1,778 per book; limit 2,000) |
| **Index size** | **66.3 MB** total (heap 7.3 MB, indexes 16.0 MB, TOAST 43.1 MB) — 26% of the 250 MB budget |
| **Indexing time** | **1.35 s per book** median (min 1.03 s, max 1.69 s); 13.7 s for 10 books |
| GIN use | `Bitmap Index Scan on "IDX_ai_book_chunks_tsv_es"` (EXPLAIN, unforced, on the sized fixture) |
| Ranking SQL alone | p50 1.9 ms |
| Per object (2 MB) | MinIO GET 8.1 ms median; SHA-256 + strict UTF-8 decode 11.3 ms median |
| **Retrieval, default configuration** (no cache; fetch + verify on every call) | **p50 163 ms, p95 540 ms, max 648 ms** (30 calls, 10 books, topK 8, budget 6,000) |
| Retrieval with the optional 64 MiB verified-text cache | p50 88 ms, p95 459 ms, max 496 ms (100 calls) |
| Hard bound | Every call < 2 s `statement_timeout` |

**Per query** (matching chunks out of 17,780 → median cold / cached ms): 0 → 8/8 · 42 → 112/100 · 415 → 99/43 · 590 → 179/60 · 629 → 132/62 · 1,145 → 110/79 · 2,322 → 304/216 · 3,399 → 168/156 · 4,224 → 399/264 · 9,855 → 518/415.

**Target p95 ≤ 150 ms: NOT MET.** Diagnosis by `EXPLAIN ANALYZE` on the fixture:
- `ts_rank_cd` cost is proportional to the number of matching chunks (≈ 18 µs per row). A term in 96% of chunks takes 650 ms ranked, against 63 ms for the same join unranked.
- Recompressing `tsv` with lz4, or storing it uncompressed, did **not** help (≈ 300 ms vs ≈ 330 ms).
- Selective queries are dominated by S2: fetch + hash + decode ≈ 20 ms per book.
- The synthetic vocabulary has very frequent non-stop-words; real Spanish/English stop words are removed by the configurations, so real frequency curves are likely kinder. Re-measuring on real, rights-verified texts is not possible yet (no verified records).

## 14. Rights enforcement and migration evidence

| Criterion | Evidence (integration test) |
|---|---|
| AC-1 allowed set only (SQL level) | The captured ranking rows contain only allowed (`bookId`, `textHash`) pairs. A wrong hash for an allowed book → nothing. Adversarial SQL/tsquery syntax never errors, leaks, or widens scope |
| AC-2 stale never served | After a text replacement: no items, `stale` reported, old ref unresolvable. A caller passing the old hash gets nothing (S2 object mismatch) |
| AC-3 hash authority | Tampered chunk rows claiming the current hash for an unpermitted version → nothing (`indexNotPermitted`). Single `computeTextHash` (architecture test); module binding unchanged |
| AC-4 two authorizations | Every `IndexingPermission` denial creates no chunks (unbound identity, `research_analysis` only, not attested, `pending_review`, incomplete, review expired). Parity test with `RightsService` (13 variants). An index-only book is never usable; a research-only book is not indexed and is reported. Revocation → nothing immediately (chunks present), `purge` → 0 rows. The indexer uses no user identity (architecture test) |
| AC-5 (Amendment 1) | Results are `chunk` items with no `userId`. The `fragments`, `sync_maps`, `user_books`, and `book_ai_rights` checksums are unchanged by indexing and retrieval |
| AC-6 anchors | Every passage equals `codePointSlice(source, charStart, charEnd)`; the resolver returns `textHash:charStart-charEnd`; chapter/phrase metadata is NULL |
| AC-7 full text | Accent folding beyond the core configurations (`niño`/`nino`, `café`/`cafe`), stemming, stop words; partial GIN used; cross-language limitation and `websearch` AND semantics documented by test |
| AC-8 end to end (test code) | eligibility → `QueryContextSource` → unchanged Context Builder → Gateway v2 + simulator v2: library segments cite only retrieved chunk refs and are settled once; a non-retrieved citation → scope violation, no text; ineligible books never reach retrieval |
| AC-9 budgets | Passage tokens ≤ budget for 1 / 40 / 200 / 8,000; NEM-021 reservations are monotonic in the context budget |
| AC-10 limits | Chunks per book; index size checked after the insert inside the transaction → rollback; simulated crash before commit → 0 rows, then resumable; idempotent; retention (third set refused; prune respects the 24 h window and the 30-day hard cap; the current set is never pruned); delete cascades |
| AC-11 S2 | No text or user column (schema tests, unit and integration); object fault → `unavailable`, mismatch → `stale`; latency measured with real MinIO fetches |
| Migration 075 | Down and up by name with a whole-schema snapshot outside `ai_book_chunks` (no residue; configurations and extension removed on down); no row seeded; FK CASCADE; constraints enforced; `unaccent` created by a **non-superuser** database owner |
| AC-12 | All NEM-019/021/022 suites pass unchanged (§12). Only local disposable PostgreSQL, Redis, and MinIO; no credentials of any shared environment; no provider; no cost |

## 15. Remaining blockers, risks, deviations

**Decisions requested (PA, D-8 engineering configuration):**

| ID | Decision | Options |
|---|---|---|
| **P-1** | Retrieval p95 target not met (§13) | (a) accept for Stage 1 with the 2 s hard bound and re-measure on real verified texts; (b) add a deterministic candidate cap before ranking (bounded latency; lower ranking quality for very frequent terms); (c) enable the verified-text cache (P-2); (d) a combination |
| **P-2** | Optional verified-text cache (implemented, **off**) | With the cache on, a direct `RetrievalPort` caller that passes a **stale** hash is served cached text verified earlier for that hash, instead of failing the per-request MinIO check. The composed path (`QueryContextSource`) always uses the current hash, so it is unaffected. Turning it on trades that defence in depth for about 20 ms per book per call |

**Risks:**
- R-3 (medium): `websearch_to_tsquery` ANDs bare terms, so recall for natural-language questions depends on E6 building `or` queries.
- R-4 (low): the AWS SDK under Jest needs `NODE_OPTIONS=--experimental-vm-modules` for the opt-in MinIO performance run only (no config change).
- R-5: production indexing remains blocked by mission §14 (RB-1 to RB-7, E3 adapters, legal).

**Deviations** (technical note §13.6):
- D-A: no separate btree (the UNIQUE index covers it).
- D-B: the additional `unavailable` exclusion and `failed` index outcome.
- D-C: all three language sub-queries are always issued.
- D-D: `StorageService.getBytes` added (byte-exact hashing), with tests (`storage.service.ts` now 100% lines).

**Protected systems:** NEM-019 code, tests, and bindings; NEM-021 contract v1, ledger, and tests (apart from the single authorized B-3 amendment); NEM-022 Gateway and tests; `TurnService`; `ContextSourcePort`; `app.module.ts`; `fragments`; `sync_maps`; reader; historical migrations; CI/CD; infrastructure — **all unchanged**. No E6 work.

## 16. Next action

**STOP for independent Product Architecture review** (REVIEW-CHECKLIST), plus decisions P-1 and P-2. Not merged; not deployed.
