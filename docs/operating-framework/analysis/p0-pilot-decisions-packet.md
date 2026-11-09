# DRAFT — P0 Product Owner Decisions Packet (Noetia+ / NoetiaX)

**Status:** `DRAFT — AWAITING PRODUCT OWNER REVIEW` · **Revision 3 (2026-11-09):** review corrections R-1…R-3 on top of Revision 2 (realignment to the Product Owner strategy update). Decision preparation only. **No decision is made here.** No provider, model, budget, price, participant, corpus title, mission, environment change, or deployment is approved or selected.
**Builds on:** [Pilot-Readiness Assessment, Revision 3](../../architecture/three-tier-intelligence/10-pilot-readiness-assessment.md) (Draft PR #47) · [05 Open decisions](../../architecture/three-tier-intelligence/05-open-decisions.md) · [06 Roadmap](../../architecture/three-tier-intelligence/06-implementation-roadmap.md) · PO-025…028, PO-030 · PO-029 (draft) · ADR-005, ADR-006 · [NEM-019](../../engineering-missions/COMPLETED/NEM-019-tier-aware-intelligence-control-plane.md).

> **D-1 decided (2026-11-09) → [PO-031](../decisions/product-owner/PO-031-development-planning-baseline-and-e1-e2-drafting.md):** Revision 3 is the accepted development planning baseline; drafting of E1/E2 is authorized; execution, merge, deployment, and provider acquisition are not. All other recommendations here remain provisional.
> **E1/E2 specifications approved (2026-11-09) → [PO-032](../decisions/product-owner/PO-032-approval-of-nem-021-and-nem-022-specifications.md):** NEM-021 and NEM-022 reserved; execution not authorized.
> Existing PO records and ADRs are **not edited**. Any approved option would be recorded in the usual way (new PO record or amendment, register update).
> **Disclosure:** prepared by an AI model from one of the providers compared in Part C (Anthropic). The comparison quotes only official provider documentation and recommends deciding on data-handling grounds.

---

## Revision 3 summary (architecture review corrections R-1…R-3)

- **R-1, environments:**
  - Verified repository configuration is now separated from unverified live state (§A3.3).
  - Binding rules added (§A3.4): reuse rather than duplicate; staging not isolated until NEM-017 is applied and S19 re-tested; destructive DB tests only in disposable local containers; no load tests on staging; a separate authorization for every staging deployment; confirm the `/api/health` exception.
  - The inventory and reuse strategy are unchanged.
- **R-2, open decisions:**
  - The Class 2 column is now "Provisional recommendation (not approved)", with a "Must close before" mission column.
  - TT-16, TT-17, TT-18, TT-20, and TT-25 now list their options neutrally.
  - E5, E7, E9, and E10 implement the **approved** option rather than a presumed one.
  - "Complete frontend" means the approved launch scope; mobile is not excluded by default.
- **R-3, E1/E2:**
  - E1 now starts with a reviewed, versioned **shared provider contract v1** (capabilities, usage, pricing; §A4.1). The ledger is built against it, and E2 implements the Gateway, simulator, and contract tests on the same schema.
  - Ownership, acceptance, and the preserved NEM-019 invariants are documented. No mission was added.

No PO record, ADR, or acceptance is recorded or changed. Documentation only.

## Revision 2 summary

The Product Owner's strategy update (2026-11-09) replaces "early internal real-AI pilot" with: **complete the product (backend, frontend, infrastructure, provider-independent integration readiness) on simulated providers, and acquire no paid AI service before a separately authorized launch-readiness gate.**

**What changed:**
- **Removed from the critical path:** the internal real-AI pilot (Assessment Option B), early provider selection, credentials, spending authorization, and live evaluation runs.
- **Added:**
  - decision classes aligned to the new strategy (§A2);
  - a mandatory **reuse assessment of the existing test environments** (§A3);
  - a dependency-aware sequence that completes backend and frontend before provider acquisition (§A4);
  - a **provider-connection and launch-validation gate** (§A5);
  - the list of **launch blockers that simulated tests cannot clear** (§A6).
- **Kept as reference for the gate:** the verified provider comparison and economics (Part C1) and the candidate corpus (Part C2). The corpus and rights work needs no AI and now runs *during* development.
- **Superseded:** Revision 1's G0–G3 pilot gates, cohort, consent, and pilot spending figures. Assessment §1, §2, §9, and §11 are marked superseded by a note in that document. No PO decision changed.

---

## Part A — Strategy realignment

### A1. Principles carried into every mission

1. **Provider independence:** all model access goes through the Gateway and explicit capability contracts. Provider-specific code exists only as an adapter behind the contract, written at the gate.
2. **Simulated and deterministic first:** a simulated provider, deterministic fixtures, and a contract test suite that any future adapter must pass.
3. **Preserved guarantees:** default-deny rights (F-12), entitlement (PO-026), budgets (B-1, B-5, B-6), account deletion (B-2), isolation, and dark-by-default registration. No mission weakens them.
4. **Provider-neutral cost accounting:** rate cards and usage records model token classes (input, output, cache write per TTL, cache read, reasoning or thinking), long-context tiers, batch and regional modifiers, and non-token pricing (per request, per character, per image), so that any provider can be configured without code changes.
5. **Existing infrastructure first:** PostgreSQL (with pgvector on staging), Redis, MinIO, Meilisearch, BullMQ worker, Grafana/Prometheus, Playwright and Jest already exist. No new service or paid dependency is proposed.
6. **Simulated tests are not validation.** Passing them proves wiring, contracts, limits, and safety controls, not answer quality, real cost, or real latency (§A6).
7. **No mission implies a merge to `main` or a production deployment** (Assessment §7). Every mission carries "Production deployment: NOT AUTHORIZED; merge to `main`: NOT AUTHORIZED" unless an authorization says otherwise.

### A2. Decision classes

| Class | Meaning | Decisions |
|---|---|---|
| **1. Before development** | Needed before the first mission can be drafted | **D-1** (single decision; below) |
| **2. During development (just in time)** | Each needed before the mission that implements it (§A4 column "Needs"); can be decided in sequence | TT-03 · TT-07 · TT-08 · TT-10 · TT-11 (behaviour) · TT-13 (policy shape; values configurable) · TT-14 · TT-15 · TT-16 (billing *structure*) · TT-17 · TT-18 · TT-19 · TT-20 · TT-25 · TT-27 · TT-12 + TT-26 (corpus, verifier, legal review) · TT-22 (Terms/Privacy drafting) · TT-01 (before billing work) · B-2 retention · GOV-001 adoption · stack merge and dark-deployment plan (F-6) · staging isolation (NEM-017) |
| **3. Deferred to the provider-connection gate** | Need a real provider or real measurements | PO-005 provider and DPA · credentials · spending authorization and budget **values** (allowances, provider limits; TT-09 COGS targets calibrated from measurement) · model routing · semantic embeddings if TT-25 chooses them · TT-16 price **values** (after measured cost) · TT-23 (only if a pre-launch beta is wanted) |
| **4. Launch blockers needing real AI** | Cannot be validated with simulated providers | §A6 |

**D-1 (before development):** *Confirm the strategy translation in this packet (complete product on simulated providers; provider gate later; the engineering sequence in §A4), and authorize drafting the first two mission specifications (E1, E2) for separate approval.*
- Options: (a) confirm; (b) revise the sequence; (c) pause.
- **Recommended: (a).**
- No spend, no legal surface; E1 and E2 are dark and test-only.
- Reversible.
- What follows approval: drafting only, not execution.

#### Class 2 detail — what each decision unlocks

> **Every entry in the "Provisional recommendation" column is a proposal, not a requirement.** Nothing becomes part of the launch scope until the PO approves it. Each decision must be **closed before the mission in "Must close before" begins**; that mission's specification then implements the approved option, whatever it is. "Complete frontend" (E9) means complete implementation of the **approved launch scope**. Mobile, web search, semantic search, export formats, and billing shape are **not** excluded or fixed by this packet.

| ID | Question (short) | Provisional recommendation *(not approved; PO decides)* | Must close before | Reversible |
|---|---|---|---|---|
| TT-03 | What "Noetia" includes; prerequisite wording without "Basic" | Plain wording that names the book subscription; no "Basic" | E9 (UI copy) | Yes |
| TT-07 | NoetiaX depth (which DX capabilities; benchmark criteria) | Approve a minimal DX set for v1 plus benchmark criteria (judged at the gate) | E8 | Yes |
| TT-08 | Noetia+ depth on agreements and contradictions | Passage-level comparison, labelled | E6 | Yes |
| TT-10 | What users see about capacity | Plain "monthly capacity" indicator, no tokens or model names | E9 | Yes |
| TT-11 | Behaviour at the limit | Hard stop with a plain message; upgrade prompt if eligible; no add-on credits (values at the gate) | E6, E9 | Yes |
| TT-13 | Quotation and reconstruction thresholds (F-2) | Approve the *policy shape* (per-book, per-turn, cross-session accounting); values configurable with conservative defaults, finalized with legal review | E6 | Yes |
| TT-14 | Retention after cancel or downgrade; Brief after revocation | Read-only history; Brief tombstone with redaction (F-3) | E6, E7 | Partly |
| TT-15 | Qualifying subscription states and linked members | Decide the commercial rule (owner, states, linked members) | E4 | Yes |
| TT-16 (structure) | One Stripe subscription or two; trials; tier swap and proration | **Open; options:** (a) one subscription with add-on items; (b) a separate premium subscription. Provisional: decide the structure before E10; prices at the gate. No structure is assumed by E1–E9 | E10 | Partly |
| TT-17 | Brief export formats and sharing | **Open; options:** in-app only; Markdown; PDF; DOCX; link sharing. Provisional: in-app plus one format, no public sharing. E7 builds whichever formats are approved | E7 | Yes |
| TT-18 | Expand at launch | **Open; options:** (a) model knowledge only, labelled `broader`; (b) with web search (adds cost, sources, and rights surface). Provisional: (a). If (b) is approved, web access also becomes a gate item (live provider tool) | E6 | Yes |
| TT-19 | Other capabilities by tier; mode and product names | Assign per the capability matrix ([01](../../architecture/three-tier-intelligence/01-capability-matrix.md)) | E6, E9 | Yes |
| TT-20 | Mobile parity and how premium is sold in apps | **Open; options:** (a) web and mobile parity at launch; (b) web first, mobile later; (c) mobile read-only. Provisional: (b), because store billing is a separate risk. **E9 implements whatever launch scope is approved; mobile is not excluded by default.** If (a) is approved, E9 includes the React Native app and store-billing work becomes a dependency | E9 | Yes |
| TT-25 | Semantic highlight search; tier | **Open; options:** (a) lexical at launch (no embeddings, so buildable without a provider); (b) semantic at launch (needs an embedding provider, so its validation becomes a gate item; pgvector exists on staging). Provisional: (a), with a vector-ready interface. E5 builds the approved option | E5, E6 | Yes |
| TT-27 | Book AI permissions for saved-quotation text in Ask My Highlights | Treat saved text under the book's AI permissions; no highlight generation for ineligible books (F-1) | E6 (Ask My Highlights) | Yes |
| TT-12 / TT-26 | Launch corpus; evidence standard; Named Verifier; jurisdictions | Candidates in C2 enter verification; designate the Named Verifier; engage legal review on C2.4 | Before the gate (no AI needed) | Yes |
| TT-22 | Terms and Privacy for AI processing and provider disclosure | Draft during development; the provider name is filled in at the gate | Before launch | Yes |
| TT-01 | Purchased-token expiry conflict | Resolve as a commercial invariant | E10 | Partly |
| B-2 | Anonymized cost records after deletion | Keep `CASCADE` (current) unless finance requires anonymized retention | E1 | Yes |
| F-6 / GOV-001 | Merge the stack and deploy the dark schema to production during development, or only at launch | Adopt GOV-001; plan one early, authorized **dark** production deployment to shrink the launch-day risk | Mid-development | Partly |
| NEM-017 | Staging network isolation | Authorize applying NEM-017 before any staging deployment of the stack | First staging use (E-T) | Yes |

### A3. Existing test environments — mandatory reuse assessment

Inspected 2026-11-09 from repository configuration (branches `main`, `nem-006a-staging`, PR #26/#27), session records, and one unauthenticated HTTPS request. **No environment was created, modified, or logged into.** Live host details marked *(unverified)* need operator confirmation.

#### A3.1 Inventory

| Environment | Configuration (verified in repo) | Services | Database / storage | Resource limits | Deployment workflow | Isolation from production |
|---|---|---|---|---|---|---|
| **Staging** — `staging.noetia.app` (NEM-006A) | `docker-compose.staging.yml`, `.env.staging.example`, `cd-staging.yml`, `docs/staging/*` on branch `nem-006a-staging` (**not on `main`**) | api, web, image-gen, worker, db, cache, storage, search. No monitoring stack | **PostgreSQL 16 + pgvector** (`noetia_staging` DB), Redis, MinIO, Meilisearch, each on its own `*_staging` volume. Seeded with 84 public-domain titles; **no audio, placeholder sync maps** | CPU/memory caps per service (api 0.75 CPU / 384 MB; db 0.75 / 512 MB; total ≈ 2 GB) on the **production host** | Manual (`docker compose -p noetia_staging … up -d --build` in `/opt/noetia-staging`). `cd-staging.yml` triggers on a `staging` branch that **does not exist** (auto-deploy deliberately not armed) | Separate compose project, directory, volumes, secrets, Stripe **test** mode, Traefik basic auth. **But:** it shares the external `proxy` network with production, and the S19 DNS fall-through was **confirmed by local reproduction**. Fix = NEM-017 (Draft PR #26), **not applied**. **Isolation is therefore not verified.** Observed: web root returns 401 (auth), but **`/api/health` returns 200 unauthenticated** (likely an intended health exception; to confirm) |
| **Local development VM** | `docker-compose.yml` (dev; read-only source mounts) | Full stack + Prometheus, node-exporter, cAdvisor, Grafana, nginx proxy | PostgreSQL 16 (**no pgvector**), Redis, MinIO, Meilisearch on local volumes. Development data only | 6 vCPU, 7.2 GiB RAM (~4.5 GiB free at idle); `systemd-oomd` kills the session above 50% pressure. Rules: `jest --maxWorkers=2`, one heavy job at a time (branch `docs/dev-vm-resource-limits`, unmerged) | `docker compose up` locally | Fully separate machine; no production credentials required |
| **Disposable local containers** (pattern proven in NEM-019) | `docker run --rm` PostgreSQL 16 / Redis 7, ports bound to 127.0.0.1; `jest.integration.config.js` refuses non-local or non-`_test` databases | PostgreSQL, Redis (≈ 60 MB together) | Throwaway; full migration chain 000–072 applies cleanly | Within the VM budget | Started and removed per test run | Complete |
| **GitHub CI** (`ci.yml`) | Lint, typecheck, build, unit tests with coverage (TS + Python) | GitHub runners | **No PostgreSQL or Redis service** (F-10) | GitHub-hosted | On PRs and pushes | Complete; no production access |
| **Production** | `docker-compose.server.yml`, `cd.yml` | — | — | — | Every push to `main` deploys and migrates | **Never a test environment** |

#### A3.2 What runs where

| Test type | Where | Why |
|---|---|---|
| Unit tests (api, web, worker, mobile, image-gen) | Local VM (capped workers) + CI | Already in place |
| Real-PostgreSQL integration (locks, ledger, migrations up/down, account deletion) | **Disposable local containers** | Destructive by design (reverts migrations); never on shared databases |
| Contract tests for the Gateway (simulated provider; fixture rate cards modelled on several providers' published structures) | Local VM + CI (pure unit level) | No network, no credentials |
| Full-stack simulated-AI end-to-end (module flag on, simulated provider) | **Local dev stack** first; then **staging** after NEM-017 and an explicit staging deployment authorization | Staging validates the deployment path and pgvector-backed features in a production-like topology |
| Frontend unit / component tests | Local + CI (Jest) | Already in place |
| Browser end-to-end (Playwright, `test:e2e`) | Local dev stack; staging behind basic auth for manual and automated browser checks | Playwright already a dependency |
| Migration forward-only rehearsal on a production-like database | **Staging**, by authorization (forward only; non-destructive) | Never revert migrations on staging; reverts belong to disposable DBs |
| pgvector / retrieval index tests | Disposable `pgvector/pgvector:pg16` container locally (an image, not a service) or staging | Local dev DB lacks pgvector |
| Load, latency, and reader-impact tests | **Local VM only, at small scale.** Not on staging | Staging shares the production host; load there could degrade production |
| Escucha Activa / sync regression | Local (staging has no audio) | Existing staging limitation |

#### A3.3 Verified configuration versus unverified live state

| Verified (repository configuration, read 2026-11-09) | **Unverified** (live operational state; needs operator confirmation) |
|---|---|
| Staging compose file, per-service limits, `*_staging` volumes, separate project and directory, Stripe test mode, basic-auth middleware, staging-only deploy workflow (branch `nem-006a-staging`) | Which commit staging runs now (session records mention `1295201`; Draft PR #27 plans against it) |
| S19 DNS fall-through between production and staging, confirmed by **local reproduction**; fix drafted in NEM-017 (Draft PR #26) | Whether the live staging containers are still attached to the shared `proxy` network (NEM-017 is **not applied**) |
| `cd-staging.yml` triggers only on a `staging` branch that does not exist | That staging's database, Redis, MinIO, and Meilisearch volumes are in fact separate on the host |
| Production deploys and migrates on every push to `main` (`cd.yml`) | Whether `/api/health` without basic auth is an intended exception (observed: 200 unauthenticated; web root 401) |
| Local VM limits and the disposable-container pattern (NEM-019) | Host resource headroom while staging and production run together |

#### A3.4 Rules for using the existing environments *(binding on every proposed mission)*

1. **Reuse, do not duplicate.** Use the existing staging stack, local VM, disposable containers, and CI. No new environment is proposed.
2. **Staging is not considered safely isolated** until NEM-017 is applied **and** S19 is re-tested as resolved. Until then, nothing from this programme is deployed there.
3. **Destructive database tests** (migration reverts, constraint and lock tests, account-deletion tests) run **only in disposable local containers**. Never on staging or any shared database.
4. **Load and resource-intensive tests never run on staging** while it shares the production host.
5. **Every staging deployment requires its own explicit authorization** naming the branch and the steps. Arming `cd-staging.yml` is a separate PO decision.
6. **Confirm the `/api/health` authentication exception** (operator check) before staging is used.
7. Production is never a test environment; any production change follows Assessment §7.

#### A3.5 Missing capabilities and the smallest changes *(proposals only; each needs its own authorization)*

1. **Apply NEM-017** (Draft PR #26): move staging api/web/storage to `proxy_staging`. **Prerequisite for any staging use by this programme.** Without it, staging containers could resolve production service names.
2. **Confirm whether `/api/health` without basic auth is intentional** (operator check; documentation fix if so).
3. **Staging deploys a named branch manually**, per the predeploy plan (Draft PR #27). Do not arm `cd-staging.yml` until the PO accepts staging.
4. **CI PostgreSQL job (F-10):** one CI job with a PostgreSQL service to run the integration suites. A CI mission; until then, local disposable runs with raw output in reports.
5. **Local pgvector:** use the `pgvector/pgvector:pg16` image for disposable tests when retrieval work needs it. No dev-stack change required.
6. **Local resource rules:** keep the documented limits (merge branch `docs/dev-vm-resource-limits` when convenient); stop the monitoring containers during heavy test runs if memory is short.

### A4. Dependency-aware engineering sequence *(proposals; none created, approved, or executed)*

All missions: simulated providers only; no credentials; dark by default; "Production deployment: NOT AUTHORIZED; merge to `main`: NOT AUTHORIZED".

| # | Mission (working title) | Scope | Needs (decisions) | Depends on | Test environment | Acceptance (summary) |
|---|---|---|---|---|---|---|
| **E1** | Shared provider contract v1 + provider-neutral cost accounting | **Phase 1, contract first:** the minimum shared schema (§A4.1). **Phase 2:** multi-dimension rate cards (token classes, TTL-specific cache writes, long-context tiers, batch and regional modifiers, non-token units); cost-aware reservation from the capability contract's worst case; **global micro-USD guard** (D14); per-attempt reservation (D15); usage normalization | D-1; B-2 | NEM-019 (#46) | Disposable DBs; CI | Contract v1 reviewed and frozen at E1 acceptance; the ledger consumes only contract types; caps hold under concurrent variable-cost turns and settlement failures; fixture rate cards for at least two published provider pricing structures; B-6 and F-12 tests still pass |
| **E2** | Gateway, simulator v2, and contract tests on contract v1 | Gateway and router implementing contract v1 capabilities (analysis with citations, structured output, streaming, cache hints, token counting, optional embeddings); contract test suite every adapter must pass; simulator emulating token classes, caching, long-context tiers, refusals, rate limits, timeouts; deterministic fixtures | D-1 | E1 (contract v1) | Local + CI | Contract suite green on the simulator; simulator usage records settle through the E1 ledger end to end; contract changes only additive (v1.x) with E1 tests re-run; no provider SDK; router still refuses non-simulated providers |
| **E3** | Rights and text adapters | `TextIdentityPort` (MinIO object hash), manifest-based `RightsVerificationAuthorityPort`, manifest tooling | TT-26 (format only) | NEM-019 | Disposable DBs | Unmanifested or stale rows denied; **no real attestation** until legal review completes |
| **E4** | Entitlement adapters | `QualifyingPlanPort` (commercial rule); `OwnershipPort` if licensed titles are in scope (needs NEM-013) | TT-15 | NEM-019 | Disposable DBs | Rule as decided; no writes to plans or subscriptions |
| **E5** | Retrieval foundation (provider-independent) | Chunking with anchors (X-3); retrieval per the approved TT-25 option (lexical on existing PostgreSQL full-text search or Meilisearch, and/or a vector backend on pgvector with embeddings validated at the gate); full-book context path as an alternative strategy; context budgets | TT-25 (closed before E5) | E2 | Disposable DBs (+ pgvector image if the vector-ready schema is exercised) | Retrieval only within the allowed set; anchors survive re-ingestion; reader p95 unchanged |
| **E6** | Research sessions, conversations, My Knowledge, Ask My Highlights | Conversation storage (additive migration); turns with citations and origin labels; session-scoped My Knowledge; Ask My Highlights with its invariant (F-1); reconstruction accounting (F-2); analytics exclusion (F-9) | TT-08, TT-11, TT-13, TT-14, TT-18, TT-19, TT-27 | E1, E2, E3, E5 | Disposable DBs; local dev stack | All ADR-006 invariants per model path; no highlight route to full text; deletion cascades |
| **E7** | Research Brief | Schema, immutable versions, generated limitations, export in the **approved** TT-17 formats, private MinIO storage, revocation tombstone (F-3) | TT-14, TT-17 | E6 | Disposable DBs; local | Every finding traceable; no Brief without a session; export uses no AI |
| **E8** | NoetiaX depth | Approved DX capabilities; per-book artifacts; background runs on the existing BullMQ worker; run ceilings; planner validation | TT-07 | E6 | Local; disposable | Planner scope limits; resume after restart; run ceilings; purge on revocation |
| **E9** | Frontend for Noetia+ and NoetiaX (approved launch scope) | Book selection (3/10), session management (lock, fork, read-only), research chat with citations linking into the reader (link only; reader untouched), My Knowledge, Ask My Highlights, Brief view and export, capacity indicator, at-limit UX, en/es i18n. **Web and, if TT-20 approves it, mobile** (all four i18n files per the voice guide) | TT-03, TT-10, TT-11, TT-19, TT-20 | E6, E7 (E8 for NoetiaX screens) | Local dev stack (Jest + Playwright) | Simulated end-to-end flows pass; reader suites unchanged with the flag on and off |
| **E10** | Premium billing integration (Stripe **test** mode) | Product structure per the **approved** TT-16 option; checkout; webhooks to entitlement; cascade rules; no token minting (F-2…F-6 regressions) | TT-16 (structure), TT-01, TT-15 | E4; M-C, M-D, NEM-013 prerequisites | Disposable DBs; staging (Stripe test) after NEM-017 | Premium invoices issue no tokens; ownership untouched on cancel; Stripe test-mode validation |
| **E-T** | Staging integration (deployment rehearsal) | Apply NEM-017; deploy a named candidate branch to staging; forward-only migrations; simulated-AI and Playwright runs behind basic auth | NEM-017 and staging-deployment authorizations | E6–E9 (and E10 when ready) | **Staging** | Isolation verified; migrations rehearsed; no production change |
| **E11** | Operational readiness | CI PostgreSQL job (F-10); Redis memory budget (F-7); ledger compensation runbook; Grafana panels for intelligence metrics; dark-deployment plan (F-6); migration-order check versus NEM-016 (D17) | GOV-001; F-6 plan | E1–E10 | CI; staging | Runbooks reviewed; dashboards render from simulated traffic |
| **GATE** | Provider connection and launch validation | §A5 | Class 3 decisions | E1–E11 | Staging, then production by authorization | §A5 |

#### A4.1 Shared provider contract (resolves the E1/E2 ordering)

E1's ledger needs capability, usage, and pricing definitions that E2's Gateway also implements. To keep the two consistent without adding a mission:

| Item | Decision (engineering, within scope) |
|---|---|
| **What** | `contract v1`, a versioned, provider-neutral schema with three parts. **Capability descriptor:** capability key, model-path id, context limit, `max_tokens` bound, supported features (citations, structured output, streaming, cache hints, token counting, embeddings). **Usage record:** per-class token counts (input, output, cache write by TTL, cache read, reasoning), non-token units, outcome, provider/model keys, idempotency key. **Pricing schema:** per-class unit prices, threshold tiers that apply to the whole request, modifiers (batch, region), non-token unit prices, version and effective date |
| **Where** | One module under `services/api/src/knowledge/ai/contract/` (types plus JSON fixtures). Both the ledger and the Gateway import it; neither defines its own copies |
| **Owner** | Written and frozen as v1 in **E1, phase 1** (reviewed by Product Architecture before the ledger work proceeds). **Owned thereafter by the Gateway (E2 and later).** Changes are additive (v1.x) and must re-run both suites; a breaking change needs a v2 and its own review |
| **Sequencing** | E1 phase 1 (contract v1) → E1 phase 2 (cost-aware ledger against v1) → E2 (Gateway, simulator v2, contract tests on v1) |
| **Acceptance** | E1: v1 reviewed; the ledger compiles and is tested only against v1 types and fixtures. E2: the contract suite passes on the simulator; simulator usage settles through the E1 ledger end to end; no schema copy exists |
| **Invariants preserved** | NEM-019 global admission lock (B-6), reservation before any provider call, durable idempotent settlement and reconciliation (B-5), fail-closed admission (B-1), default-deny rights and the F-12 authority boundary, account-deletion cascades (B-2), dark registration, router refusal of non-simulated providers, **no live-provider access** |

Critical path: **E1 (contract v1 → ledger) → E2 → (E3, E5) → E6 → (E7, E8) → E9 → E-T → E11 → GATE**. E4 and E10 run alongside once TT-15 and TT-16 are decided. Corpus verification and legal review (C2) and Terms drafting (TT-22) run in parallel and must finish before the GATE.

### A5. Provider-connection and launch-validation gate *(separately authorized)*

**Entry criteria:**
- E1–E11 accepted;
- staging isolated (NEM-017);
- corpus manifest entries approved by the Named Verifier after legal review;
- Terms and Privacy drafted;
- PO-005 decided;
- spending authorization granted (re-verified prices, Part C1).

**Steps:**
1. Provider account, DPA, region, and a **dedicated workspace and key** per environment (pilot traffic, evaluation).
2. Implement **only** the provider adapter against the E2 contract; the contract suite must pass.
3. Load a rate card from **re-verified** prices; set ledger allowances and provider alerts and limits (conditional exposure as in C1.4).
4. Run the evaluation set (staff-written, PO-approved) on staging.
5. Run a short internal validation with qualifying subscribers (PO-026).
6. Measure everything in §A6.
7. Decide launch values (TT-09 targets, TT-11 values, TT-16 prices).
8. Authorize production deployment and enabling separately (F-6).

**Exit criteria (thresholds for PO approval; from Rev 1 §6):**
- citation accuracy ≥ 95%;
- grounding ≥ 90%;
- zero scope violations and zero cross-user or household leakage;
- cost per session within ±30% of the calibrated model;
- warm-turn p50 and cold full-book p95 latency within the approved bounds;
- reader p95 unchanged;
- ledger versus invoice within 2%;
- provider spend-limit behaviour observed as documented.

### A6. Launch blockers that cannot be validated without real AI

Simulated tests validate wiring, contracts, limits, isolation, rights gating, and failure handling. They **do not** validate:
1. answer quality, grounding, and citation accuracy on a real model, in Spanish and English;
2. real token consumption, cache hit rates, and cost per session, and therefore the budget values (TT-09, TT-11) and prices (TT-16);
3. latency (time to first token, cold full-book turns) and reader impact under real long requests;
4. provider refusal and safety behaviour, error modes, and rate limits;
5. fidelity of provider usage reporting (ledger versus invoice) and spend-limit enforcement timing;
6. prompt-injection resilience against instructions embedded in book text;
7. real-model reconstruction and quotation behaviour against the F-2 thresholds;
8. the NoetiaX depth benchmark (TT-07): "deep" must be demonstrated, not assumed;
9. semantic retrieval quality, if embeddings are chosen;
10. the provider's contractual data handling (DPA, retention, region).

---

## Part B — Superseded by Revision 2

The Revision 1 material below no longer drives the plan:
- G0–G3 pilot gates;
- the 4-person internal pilot cohort and its pilot-only entitlement subset;
- internal pilot consent;
- pilot exit thresholds as an operation gate;
- the "M1–M6" pilot sequence.

The **thresholds** carry over to the launch gate (§A5), and the **PO-026 position** carries over unchanged: no exception, and every user holds a qualifying subscription. The PR history keeps Revision 1 (commit `1dd6f75`).

---

## Part C — Reference material for the gate and the parallel rights workstream

## C1. Provider comparison (PO-005) — reference for the provider-connection gate

### C1.1 Verified facts (official documentation, read 2026-11-09)

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

### C1.2 Economics under comparable workloads (for the gate)

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

### C1.3 Provisional recommendation for the provider-connection gate (not approved; not for now)

Under the 2026-11-09 strategy **no provider is acquired during development**. When the gate opens (§A5):
1. **One provider for launch validation:** one data-processing review, one rate card, one spend-control surface. The Gateway's capability contract keeps the choice reversible.
2. **Choose on PO-005 criteria first** (retention, zero-retention path, region, contract), then on the verified economics above.
3. **Mid-tier model for quality validation; small-tier model measured on the evaluation set** to calibrate routing. High tier only as an optional quality-ceiling pass.
4. **Re-verify every figure in C1.1 on the day of authorization.** The figures above are a 2026-11-09 snapshot.

### C1.4 Candidate spending figures for the launch-validation run *(PO candidates; conditional; not for development)*

These replace the former internal-pilot figures. They apply only once the gate in §A5 is authorized. The structure carries over (ledger allowance, provider alert and hard limit, separate evaluation workspace, conditional maximum exposure); the amounts are re-proposed at the gate from measured token counts.

| Figure | Candidate | Basis |
|---|---|---|
| Validation-run spending target (illustrative, 4 internal testers) | **~$106** (Anthropic) or **~$149** (OpenAI) for the first month | 4 users × expected ($46.08 / $89.28) + evaluation ≤ $60 (mid + small arms, with reruns) |
| Ledger global allowance (validation traffic; needs E1, D14) | **$150** | ~1.7–3.3× expected live spend |
| Per-user allowance (units; set from the rate card) | **≈ $40-equivalent / month** | Covers expected usage (≈ $11.5–22) with headroom; truncates the high tail ($124–236) |
| Provider: validation workspace alert / hard limit | **$100 / $200** | Hard limit set above the ledger so the ledger binds first |
| Provider: evaluation workspace hard limit | **$60** | Separate key (D16); not seen by the ledger |
| Behaviour at the limit (TT-11) | **Hard stop with a plain message** | Pilot only; reversible |
| Maximum financial exposure | **≈ $210 — conditional** | $150 + $60 **only if** E1 is implemented correctly **and** both provider limits stop traffic as their documentation states. Enforcement timing is unverified; overshoot during any lag is not bounded by Noetia |

Note: an Anthropic workspace limit cannot be set on the **default** workspace, and both providers apply organization-tier caps above any workspace limit.

---

## C2. Candidate launch corpus (TT-12; TT-26) — workstream that needs no AI

### C2.1 Candidates *(none verified; none eligible in any environment)*

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

### C2.2 Likely public domain versus verified rights to the exact digital text

"Likely public domain" concerns the **work**. Eligibility requires an attested record for the **exact stored text** (`textHash`), its edition, and any added material (07 §3; F-12). A title can be public domain while a given digital edition is not usable as-is. That happens when the edition includes modern notes, a modern introduction, or contributor annotations, or when the licence requires header retention.

### C2.3 Minimum verification workflow and roles

| Step | Who | Output |
|---|---|---|
| 1. Screen title (rule in §C2.1) | Engineering / Product Architecture | Candidate row with dates and sources |
| 2. Identify the edition behind the stored text; list added material | Engineering, reading the stored object and its source page (read-only) | Edition note, added-material list |
| 3. Compute `textHash` of the stored object | Engineering (read-only; E3 adapter, on staging after NEM-017 or a local copy) | Hash |
| 4. Legal review for the target jurisdictions (US, ES, MX, CO, AR, CL, PE, EU/UK) | **Specialist legal reviewer** (external counsel or equivalent) | Written opinion per title or per rule |
| 5. Approve the manifest entry by pull request | **Named Verifier**: a person the PO designates (TT-26), accountable for the record, not necessarily a lawyer, acting on step 4 | Reviewed manifest entry (two-key with the database row; F-12) |
| 6. Review date | Named Verifier | Annual, or on any text change (a new hash reverts the book to `unknown`) |

### C2.4 Legal questions for specialist review

1. **Mexico life + 100:** confirm that it does not revive works already public domain (the secondary source suggests it does not).
2. **Moral rights:** Spain and many Latin American laws keep attribution and integrity rights perpetually. Does AI summarization or excerpting of public-domain works raise integrity concerns, and what attribution is required?
3. **Wikisource transcriptions:** is a transcription a contributor work under CC BY-SA? Does using it as model context, or showing excerpts, carry attribution or share-alike duties?
4. **Project Gutenberg licence:** it is US-centred. What applies to a company and users outside the US? Must all Gutenberg references be removed before storage, display, or AI processing (the licence grants derivative freedom "if all references to Project Gutenberg are removed")?
5. **Sending public-domain text to a foreign AI provider:** any non-copyright restriction (contract, data export) in the target jurisdictions?
6. **Jurisdiction of determination:** which law applies — the company's, the users', or the servers'?

---


## Outstanding verification requirements

- Operator confirmation of staging's live state: deployed commit, network attachments, the `/api/health` authentication exception, and database separation.
- NEM-017 applied and isolation re-tested before any staging use.
- Re-verification of provider prices and terms at the gate (Part C1 is a 2026-11-09 snapshot).
- Real token counts of candidate titles (stored objects) before gate figures are set.
- Edition identification and legal review for the corpus (C2.3, C2.4).
- Migration-order check against NEM-016's 068 before any deployment.

## Unresolved questions

1. Is a third provider (e.g. Google) to be evaluated at the gate?
2. Who is the Named Verifier, and when can legal review start?
3. Should the dark schema reach production early (one authorized dark deployment) or only at launch?
4. Is mobile in scope for launch (TT-20)?
5. Should licensed (author) titles be in the launch corpus? If so, `OwnershipPort` needs NEM-013, which pulls in more work.
6. Can staging be used once NEM-017 is applied, or does the PO prefer a separate staging host later? (The current recommendation is to reuse the existing staging.)

## Appendix A — Reproducible cost calculation

`python3 p0_costs.py` reproduces every figure in §C1.2 and the illustrative totals in §C1.4. Prices as in §C1.1. Values marked ASSUMED are not on the providers' pages.

```python
# P0 packet economics. Prices verified 2026-11-09 from official provider pages (see packet §C1.1), except where marked ASSUMED.
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
