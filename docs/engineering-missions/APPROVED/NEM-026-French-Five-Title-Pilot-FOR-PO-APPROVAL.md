# NOETIA ENGINEERING MISSION — NEM-026
## French-Language Five-Title Reader & Audio Pilot

**Status:** FINAL SPECIFICATION FOR PO APPROVAL — NOT YET APPROVED; NOT EXECUTABLE
**Mission type:** DESIGN + BOUNDED CONTENT/INGESTION IMPLEMENTATION (after separate authorizations)
**Implementation authorization:** NONE CURRENTLY. Separate PO specification approval and explicitly named execution instruction required.
**Schema changes:** NOT AUTHORIZED
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED
**Product Owner approval:** REQUIRED (approval ≠ execute)
**Independent Product Architecture review:** Mandatory STOP
**Audit baseline:** main `8f2f294378a8cdc7472f2849ce533981605fcb01` (recheck)
**Specification finalized:** November 22, 2026, incorporating PO selection of *Maria Chapdelaine* in place of *Les Trois Mousquetaires*.

## 1. Context
PO requests Noetia EN/ES/FR readiness with **exactly five initial French titles**, targeting Canadian French readers while preserving Noetia's free public-domain pilot policy (TT-12). This mission is limited to the five titles selected by the PO. The sources are *candidates* pending title-specific rights and technical qualification; they are not certified ready for distribution. It does not itself publish or release them.

## 2. Objective
Create a rights-reviewed, quality-qualified five-title French `fr` catalog PILOT that delivers the same reader/audio/highlight experience as current free-library titles, with **no change to existing English/Spanish books**. Every French title remains unavailable to the public until a title-specific QA gate and separate PO publication authorization.

## 3. Dependencies
- Explicit PO approval and named execution instruction for NEM-026 (distinct from approval of NEM-025).
- A verified French-language reader experience or bounded private trial (NEM-025, coordinate deployment sequencing).
- Frozen selection and preliminary source evidence in `FR-CA-FIVE-TITLE-MANIFEST-FOR-PO-APPROVAL.md`; no import without per-edition rights and engineering checks.
- Source terms/rights validation for US + Canada, and recording usage/streaming/processing rights (not inferred solely from author lifetime).
- Current `main` source and other active PRs rechecked before any work.

## 4. Locked five-title scope and references

**PO-selected title identities (five and only five):**

| # | Work | Source edition candidate | French audio candidate | Material gate |
|---|---|---|---|---|
| 1 | *Candide, ou l’optimisme* — Voltaire | Gutenberg **#59859** | LibriVox `candide-by-voltaire-2` | Text/audio chapter and wording alignment |
| 2 | *Le Horla* — Guy de Maupassant | Gutenberg **#10775** | LibriVox `le-horla-by-guy-de-maupassant-1203` | **Both are collections**; agree on full recueil scope vs selected story before cataloging |
| 3 | *Le Tour du monde en quatre-vingts jours* — Jules Verne | Gutenberg **#800** | LibriVox `le-tour-du-monde-en-quatre-vingts-jours-by-jules-verne` | Long multi-reader recording; chapter and playback QA |
| 4 | *Madame Bovary* — Gustave Flaubert | Gutenberg **#14155 (French)** | LibriVox `6435` | Three M4B parts; current importer only picks the first. **#2413 is an English translation and must not be used.** |
| 5 | *Maria Chapdelaine* — Louis Hémon | Gutenberg **#13525 (French)** | LibriVox `maria-chapdelaine-by-louis-hemon` | Québec context; 16-section French recording; rights and text alignment |

These titles are the scope limit, not a claim that rights, recording editions, completeness or sync have been accepted. A replacement needs a **new express PO selection**, even if a candidate is blocked. See the frozen manifest for URLs, findings and quality checklist.

## 4A. Existing technical sources
- `services/api/src/ingestion/{catalogue.ts,ingestion.service.ts,gutenberg-fetcher.service.ts,librivox-api.service.ts,phrase-splitter.service.ts,phrase-aligner.ts,whisper-sync.service.ts}`
- `services/api/src/books/{book.entity.ts,books.service.ts,books.controller.ts}`
- `services/api/src/search/search.service.ts`; `services/api/src/books/sync-map.entity.ts`
- `CLAUDE.md`, `docs/engineering-missions/README.md`, `docs/whisper-sync-troubleshooting.md`.

## 5. In scope
1. Maintain the **five-entry PO-selected manifest** with stable exact source edition IDs/URLs, audio page, rights proof, narrative start/end, publication state and QA evidence per title. No broad import or catalog growth.
2. Verify French-language *text* for each Gutenberg ID and French-language *audio* for each specified LibriVox item. Check that recording edition, story scope and chapter order match the selected text. Reject English translations and nonmatching collections.
3. Develop safe, explicit ingestion of only these five, initially `isPublished=false`, not available in public discovery or search, with no automatic publish on import. If current ingest pipeline cannot support this without protected-system changes, STOP for PA design approval.
4. Integrate French phrase parsing and QA tests: `CHAPITRE`, `PARTIE`, `PRÉFACE`, `FIN`, French guillemets/quotes, apostrophes, `œ/æ` ligatures and accents. Validate `normalizeWord()` and sentence splitting without regressing ES/EN.
5. Match audio chapters to text, obtain word-level French Whisper timestamps from an approved existing model/provider, trim non-narrative material, preserve full reading progress and enforce the existing ≥90% synchronized coverage quality gate.
6. Support multipart/large M4B only after evaluating cost and reader seek behavior. Prefer remote streaming over copying gigabytes to limited server storage **when rights, reliability and URL behavior are verified**. Avoid storing redundant ZIPs and M4Bs.
7. Verify search indexing/discovery and language tagging: book `language='fr'`, independent of interface `uiLanguage='fr-CA'`; no translation of literary source text.
8. Propose release one title at a time with an evidence packet, but never publicize without title-specific PO approval and legal requirements met.

## 6. Out of scope
- Ingestion of the wider French catalog; new paid book tiers; licensing of copyrighted modern texts; whole-catalog reprocessing.
- Production DB writes, live import, staging writes unless separately allowed, production deployment, premium activation, migrations, expensive hosted AI services, new infra.
- Anything changing financial/token, user ownership, social donation or reader synchronization principles.

## 7. Product rules
- Exactly five French pilot titles in first proposed set (manifest); no automatic catalog expansion.
- `fr` denotes original book language. Users may select any EN/ES/fr-CA interface while reading them.
- Full text rights and full *recording* rights must cover target distribution and use (incl. Canada); if not verified, the title is HOLD.
- No auto-publication, no publish despite a passing sync map without explicit PO approval.
- Free-library acquisition tool, not a new commercial licensing model.

## 8. Protected systems
Escucha Activa audio sync, existing ES/EN library, permanent ownership, search quality gate, production data/MinIO, migration history, payments and all user rights.

## 9. Technical requirements
- Current `IngestionService.ingestOne()` inserts `isPublished: true` **before** audio sync passes. This is unacceptable for a gated French pilot. Introduce a safe pilot-specific publication boundary or STOP for a separate reviewed design; do not silently alter the behavior of existing catalog entries.
- Current `ingestAll()` loops every `CATALOGUE` entry, and `Book` defaults language to `es`. Explicitly set `fr` and never add active entries before gating is implemented.
- `BooksService.findAll()` requires `isPublished` and `syncCoverage >= 0.90` for ingested free books; `SearchService` also has a quality gate. Check both paths. Direct book URLs need review so unpublished IDs cannot be read as published through authenticated endpoints; no accidental public indexing.
- `PhraseSplitterService.isHeading()` recognizes English/Spanish but not French; add tests and smallest safe parser changes. Align `normalizeWord()` ligatures (`œ`/`æ`) and elisions consistently with French Whisper tokenization.
- `GutenbergFetcherService` has four remote fallbacks and a 25s timeout; each text still needs rights, encoding and narrative trim evidence.
- `LibrivoxApiService.getM4bUrl()` extracts the **first** M4B link only; multipart audio like Madame Bovary is **not** supported as one complete stream. Fix only within separate authorized scope, or hold the title.
- `Le Horla` Gutenberg #10775 is a story collection and the LibriVox link contains many stories; do not accidentally label this as the single short story while serving the whole collection. Verify scope and titles.
- Maintain integrity across crashes/retries: partial ingestion cannot leave a publicly accessible or partially indexed book.

## 10. Rights, privacy and security
- Verify source public-domain status in both USA and Canada, the specific edition, front matter, visual covers, narrator recording, use and redistribution. Record source links and review dates; use original public-domain assets rather than modern cover art by default.
- Do not scrape or download audio in bulk before rights and cost checks; do not consume large server bandwidth or storage without a cost cap.
- No customer data used in ingestion QA.

## 11. Acceptance criteria
- Exactly five candidate entries with verifiable source URLs and recorded title/author/language/source ID.
- For each title: rights evidence, French text check, French audio check, chapter match, complete text import, audio seek/stream reliability, >=90% sync coverage, no corrupted accents/ligatures, search/reader test and manual sampled phrase alignment.
- Staged records cannot be found through public search or direct reader endpoints until explicitly published.
- EN/ES tests and QA unchanged; no production data/infra modifications; tests pass in relevant changed code.
- QA report distinguishes READY / HOLD by title and states storage/bandwidth estimates and remaining obligations.

## 12. Tests
- French splitter/aligner unit tests including punctuation, ligatures, chapter boundaries and narrative trim.
- Programmatic exclusion of all five from discovery/search pre-publication; negative direct URL access test.
- French metadata persists, and EN/ES metadata unaffected.
- Audio stream and chapter sequencing plus seeking on mobile and web, including M4B byte ranges and expiration behavior.
- Sync score gate >=90%; sample alignment starts/ends and no missing front matter; duplicate ingestion idempotency and interrupted writes.
- No unsupported audio fallback or silent publication.

## 13. Observability
Existing logs, sync-quality report, and per-title QA evidence. Avoid adding new monitoring services. Include per-title text/audio source, coverage, duration and pending failure reason.

## 14. Rollout
NOT AUTHORIZED. Initial pilot is **private/unpublished**, no production ingestion, migration or paid activation. Separate PO approval for any staging data load and individual public title release.

## 15. Documentation deliverables
- Frozen five-title manifest (`FR-CA-FIVE-TITLE-MANIFEST-FOR-PO-APPROVAL.md`, later updated with per-title QA results)
- Per-title copyright and narrator/recording review packet.
- Text/audio alignment and storage/streaming evaluation.
- Draft PR with code+tests only if separately authorized to implement.

## 16. PO confirmation items and execution gates
- **Title selection:** FINAL for this approval packet. PO chose *Maria Chapdelaine* in place of *Les Trois Mousquetaires* on November 22, 2026. Exactly the five titles in §4; no agent substitutions.
- **Pilot exposure:** private/unpublished by default. Public titles require distinct, title-by-title PO authorization after PA and rights review.
- **Review responsibility:** establish a qualified French/French-Canadian editor and a rights-review owner, or explicitly authorize bounded external review expenditure before public availability.
- **Le Horla display/scope:** the candidate source is an anthology; defer any alternate display title or story-only extraction until the actual text/audio alignment and product labeling can be presented for PO approval. Do not misrepresent anthology as a single short story.
- **Long/multipart audio:** if a title cannot fit the existing audio pipeline or the approved resource budget, hold that title. Do not silently replace it.
- **Territorial rights:** no Canadian distribution without verified rights to the exact text, narration and permitted uses. U.S. public-domain metadata is insufficient for Canada.
- **Execution distinction:** approving this specification does not authorize application changes, staging/prod DB writes, ingestion or public publication.

## 17. STOP conditions
- Source language incorrect, recording not French, rights uncertain in any target territory, text/audio edition mismatch, sync below threshold, unsupported multipart audio, excess server consumption, premature public access, payment or protected-system changes.

## 18. Completion report
Five rows (title / rights / text / audio / completeness / syncCoverage / storage / READY-HOLD / blockers), changed paths, tests, production unchanged, committed SHA and Draft PR link, deviation list. STOP for PA review before importing or publishing.

## 19. Product Architecture review
PA verifies source-language correctness, rights and text/audio provenance, quality gates, privacy, costs, no regressions, no accidental exposure. PO makes publication decisions.

**NEM-026 SPECIFICATION FINALIZED FOR PO APPROVAL — NO EXECUTION AUTHORIZATION.**
