# G1-I1 Checkpoint V: production readiness, PR integration and controlled rollout planning

| | |
|---|---|
| **Mission** | G1-I1 / Checkpoint V: Production Readiness, PR Integration and Controlled Rollout Planning (PO authority; prepared by PA) |
| **Execution instruction** | PO: "Execute G1-I1 Checkpoint V according to the approved mission", baseline `7a67a11` |
| **Authorization** | **DOCUMENTATION ONLY.** Infrastructure, schema and deployment are NOT authorized |
| **Repository / PR** | `Carloskfe/noetia`, Draft PR #60 (stacked on Draft PR #59) |
| **Starting HEAD** | `7a67a11472e5232c7809473efb1d9f80c10528c5` (verified) |
| **Date** | 2026-11-15 |
| **Verdict** | **Plan prepared. NOT ready for a production authorization decision.** Blocking prerequisites remain (§15, §17), and four PO decisions are open (§16). **STOP for independent PA review.** |

**Evidence labels:**
- **[REPO]** = VERIFIED REPOSITORY.
- **[LIVE-PREV]** = VERIFIED LIVE: PREVIOUS PO-SUPPLIED EVIDENCE (Checkpoint III).
- **[LOCAL-PREV]** = VERIFIED LOCAL TEST: PREVIOUS CHECKPOINT.
- **[AGENT]** = AGENT-REPORTED: established by read-only commands in this mission, against GitHub or the local clone.
- **[INFERRED]**, **[PROPOSED]**, **[UNRESOLVED]** as named.

Every runbook step in this document is **PROPOSED: NOT AUTHORIZED FOR EXECUTION**. None has been performed.

---

## 1. Executive summary

1. **The current PR #60 branch must not be merged to deliver G1-I1.**
   - `main` → production is fully automatic: `.github/workflows/cd.yml` runs on every `push` to `main`, with no path filter. `main` is unprotected, has no rulesets and no deployment environments [AGENT].
   - PR #60 plus #59 would ship 14 public-site commits and 31 payment-lifecycle commits to production at the same moment, including webhook, subscription, billing-page and trial/token logic. All of their financial release gates are **closed** (§5, §15).
2. **Recommended strategy: B, in two stages: isolate G1-I1 into its own release change from `main`** (§6).
   - **Stage B-1** ships the trusted-proxy code **inert**: `TRUSTED_PROXY_CIDRS` unset means trust is off [LOCAL-PREV].
   - **Stage B-2** switches the API network only after the infrastructure is prepared.
   - The four G1-I1 implementation commits apply to `main` without textual conflict (simulation only [AGENT]). One test (`trusted-proxy.integration.spec.ts`) imports the G-1 `CheckoutStatusController`, which does not exist on `main`, so it needs a **separately authorized test adaptation**.
   - Creating that branch, cherry-picking and adapting the test all need **PO authorization (D-V1)**.
3. **G-1 depends on G1-I1, not the reverse.** Without trusted-proxy attribution, every user shares the Checkout-status **30/min** bucket (Checkpoint I). G1-I1 should therefore be live **before** any future G-1 release.
4. **Traefik drift is a blocking prerequisite.**
   - Live Traefik is on `proxy` + `proxy_staging` [LIVE-PREV]. `main`'s Traefik compose lists only `proxy` [REPO].
   - The live `/opt/traefik/docker-compose.yml` has never been inspected (U3).
   - CD never touches `/opt/traefik` [REPO], so the persisted live file is the operational truth, and its content is unknown.
5. **Correction to earlier documents.** Checkpoint IV §10, and a comment in PR #60's Traefik compose, say PR #26 and PR #60 "rebase trivially". An in-memory three-way merge shows **two conflicting hunks**. Resolving them by taking PR #26's side would **silently drop `noetia_api_edge`** [AGENT] (§7).
6. **CD has no G1-I1 safeguard.**
   - It never runs `noetia-api-edge-network.sh` and checks neither IPAM nor membership [REPO].
   - If the edge network is missing, the deploy fails before replacing the API (local only, R-02).
   - If the network exists but **Traefik is not attached**, CD would **report success** (`--wait` checks only the in-container healthcheck) while `/api/*` returns 504 [INFERRED from `cd.yml` + R-04].
   - Manual gates are therefore mandatory, and a CD preflight is proposed as a separately authorized change (§10).
7. **New evidence gap.** API outbound egress (Stripe API, SMTP, OAuth) after the API leaves `proxy` was **not tested** in Checkpoint IV. `noetia_net` is a normal bridge, so egress is expected to keep working [INFERRED], but it must be verified (§17).
8. **Unchanged:**
   - **R-05 stays NOT VERIFIED** with the real Docker provider (accepted exception).
   - The exact-two-member invariant is a **mandatory operational safeguard, not continuous enforcement and not proof of Traefik identity.**
   - API recreation gaps (502/504 for a few seconds) are expected; **no zero-downtime claim.**
   - **All financial release gates remain closed.**

## 2. Scope and authority

| | |
|---|---|
| **Done** | Read-only analysis of GitHub PRs, branches, commits, workflows and repository settings (via `gh api`). Read-only analysis of committed configuration and reports. In-memory merge simulations (`git merge-tree`, `git merge-file` on temporary copies), which move no ref, branch, index or working tree. One documentation commit to PR #60 |
| **Not done** | No production, staging or backup SSH. No Docker daemon access of any kind. No network, container, environment, Traefik, compose, script, workflow, code, test or migration change. No merge, rebase, cherry-pick, retarget, new branch, deployment or activation. No ADR. No change to PR #59, #26 or #28 |
| **Governance read** | `CLAUDE.md` (Engineering Mission Governance, Development Safety Rules, Production Deployment); `docs/engineering-missions/README.md` (authorization levels: DOCUMENTATION ONLY = docs may change, application code may not; STOP rules) |

## 3. Verified GitHub baseline [AGENT, 2026-11-15]

| PR | Expected HEAD | Observed HEAD | Base | Draft / state |
|---|---|---|---|---|
| #60 | `7a67a11…10528c5` | `7a67a11472e5232c7809473efb1d9f80c10528c5` ✔ | `feat/public-ecosystem-site-20261112` ✔ | Draft, OPEN, unmerged |
| #59 | `e326b81…eb230` | `e326b81f262fbe99e10bb3fbeff6232f066eb230` ✔ | `main` ✔ | Draft, OPEN, unmerged |
| #26 | `02c98f7…7425a` | `02c98f73b5c80f35af8ad3238a579d18c437425a` ✔ | `nem-006a-staging` ✔ | Draft, OPEN, unmerged |
| #28 | `35ab50b…60a6fe` | `35ab50bdc16e4f5d94e104b943a1a4592e60a6fe` ✔ | `main` ✔ | Draft, OPEN, unmerged |

**`main`, checked separately:** `6a5e5c0850a73a9de432be87d5be647bd138dbe7` ("fix: NOF-003 reconcile subscription display prices (#20)", 2026-10-31).
- The last three successful `CD` runs deployed `f202716`, `a96c853` and `6a5e5c0` (2026-10-29/31).
- #59's merge base is exactly `6a5e5c0`, so `main` has not moved under the stack.

**No material baseline change. No STOP.**

## 4. Evidence and provenance

| Source | Used for | Label |
|---|---|---|
| `gh pr view` / `gh run list` / `gh api …/branches/main`, `/rulesets`, `/environments`, `/actions/workflows` | Baseline, deploy history, protection and environments, registered workflows | [AGENT] |
| `origin/main:.github/workflows/{cd,ci}.yml`; `origin/nem-006a-staging:.github/workflows/cd-staging.yml` | Triggers and deploy scripts | [REPO] |
| PR #60 tree at `7a67a11` (`docker-compose.server.yml`, `infra/server/{init.sh,noetia-api-edge-network.sh,traefik/*}`, `services/api/src/{main.ts,common/trusted-proxy.ts}`, `.env.example`, `docs/incident-response.md` §1a) | Prepared configuration | [REPO] |
| PR #26 at `02c98f7`: NEM-017 report `docs/reports/2026-11-02-NEM-017-s19-network-isolation.md` (§6, §8) | Staging network, rollout steps | [REPO] + its own [LOCAL-PREV] rehearsal |
| PR #28 at `35ab50b`: `docs/operations/nem-018-autoguildx-network-migration.md` | AutoGuildX migration | [REPO] |
| `g1-trusted-proxy-live-verification.md` (Checkpoint III, V1–V8, U1–U8) | Live topology | [LIVE-PREV] |
| `g1-checkpoint-iv-qualification.md` (§5–§13) and `g1-checkpoint-iv/` | Local behaviour, R-01…R-09, the negative control | [LOCAL-PREV] |
| `g1-checkpoint-iv/iv-f2-r05-docker-provider.md` | R-05 exception (source analysis of Traefik v2.11.61) | [LOCAL-PREV] / source |
| `README.md` §10.7 and the launch-blocker list in this directory | Financial gates | [REPO] |
| `git merge-tree --write-tree` (4 commits onto `main`) and `git merge-file` (Traefik compose, temporary copies) | Conflict analysis | [AGENT] simulation; nothing integrated |

## 5. PR ancestry and integration graph [AGENT]

```
                            9e682fb (old main)
                               │
                               ├── nem-006a-staging (4 commits: staging foundation; NO PR to main exists)
                               │      └── PR #26 infra/nem-017-s19-network-isolation (3 commits: 58ec3cb, f434b32, 02c98f7)
   ... ── 2b3f06c, 8ecb9d2 (CD hardening, #5/#6) ── 6a5e5c0 = main  (auto-deploys to production)
                                                  │
                                                  ├── PR #28 infra/nem-018-shared-proxy-hardening (2 commits; docs/tests/patch only)
                                                  │
                                                  └── PR #59 feat/public-ecosystem-site-20261112 (14 commits)
                                                         └── PR #60 fix/payment-lifecycle-stabilization-20261112 (41 commits)
                                                                ├── 31 payment-lifecycle commits (5c4a90c … fc058b8: G-1, D1–D6, T-1, F-02 …)
                                                                └── 10 G1-I1 commits:
                                                                      docs  14423c4 1b88569 cc448a7
                                                                      impl  b304516 (api) · 5fe5d5a (infra) · a4d82bf (harness) · 6fb9305 (docs/env/playbook)
                                                                      docs  1fe93c4 8f74069 7a67a11
                                                                   (fc058b8, G-1 Checkpoint I, also holds the original G1-I1 diagnosis)
```

### 5.1 What a merge of each would put on `main` (and therefore in production)

| PR | Non-documentation scope | Release gates | Production effect if merged today |
|---|---|---|---|
| #59 | Public site and ecosystem presentation, Causas single-cause API/UI, `/pricing` checkout authentication and the status-unknown block (70 files) | PA review of the status-unknown correction pending; public-site acceptance | Immediate CD deploy of web and API changes |
| #60 (includes #59) | **58 non-doc files:**<br>- **Financial:** `subscriptions.service.ts` (+660), `webhooks.service.ts`, `billing-cycles.ts`, `stripe-fulfillment-ledger.ts`, `checkout-status.*`, `gifts.service.ts`, billing/success/pricing/account pages, mobile `PaywallScreen`, i18n<br>- **G1-I1:** `trusted-proxy.ts`, `main.ts`, compose, Traefik compose, helper, `init.sh`<br>- **No migrations** | G-1, G-4, G-5, W-1, W-2/SG-PM, USD-1, D4 portal, Stripe production webhook, Terms (OP-3), gift-email recovery, NEM-024 E-1: **all open** (§15) | **Financial functionality goes live without its gates (STOP gate 3 applies to this path).** The API network switch also goes live, and its outcome depends on the unprepared server (§10.3) |
| #26 (base `nem-006a-staging`) | Staging compose network change, Traefik compose `proxy_staging`, test harness, docs | NEM-017 rollout authorization (its §10); no path to `main` defined | None directly; it merges into `nem-006a-staging`, not `main` |
| `nem-006a-staging` → `main` (no PR exists) | `cd-staging.yml`, `docker-compose.staging.yml`, `.env.staging.example`, **web app changes** (`Dockerfile`, `app/layout.tsx`, `StagingBanner.tsx`, `next.config.js`) | NEM-006A acceptance | CD deploy of the web changes. `cd-staging.yml` stays inert (it triggers on a `staging` branch, which does not exist [AGENT]) |
| #28 | Docs, test harness, AutoGuildX patch (inert in Noetia) | NEM-018 authorization; the AutoGuildX repository change | Docs-only deploy run (CD has no path filter); no runtime change |

**`cd.yml` lineage hazard [AGENT].** `nem-006a-staging` forked before `8ecb9d2`/`2b3f06c`, so its tree still holds the **old destructive `cd.yml`**:
- `cancel-in-progress: true`;
- `compose down`, `docker rm -f` of `noetia-*`, `docker network rm noetia_noetia_net`.

No `nem-006a-staging` or PR #26 commit modifies `cd.yml`, so a correct three-way (or squash) merge keeps `main`'s safe version [AGENT: `git log 9e682fb..origin/nem-006a-staging -- .github/workflows/cd.yml` is empty]. A file-copy or "take theirs" integration would **reintroduce the full-outage deploy**. Any future NEM-006A/NEM-017 integration must diff `.github/` against `main` before merging.

### 5.2 Strategy comparison

| Criterion | **Strategy A**: merge the stack in order (#59 → #60) after all gates | **Strategy B**: isolate G1-I1 into a release-specific change from `main` (two stages) |
|---|---|---|
| Scope contamination | **High.** G1-I1 activation is welded to 45 commits of public-site and financial change | **Low.** Only `trusted-proxy.ts`, `main.ts` (+1 import, +1 call), unit tests, then the compose/Traefik/helper/`init.sh` files and docs |
| Dependency on financial gates | **Total.** G1-I1 cannot ship until every financial gate closes. Yet G-1 itself needs G1-I1 live (30/min shared bucket), a circular release dependency | **None.** G1-I1 can ship first and unblock G-1's attribution precondition |
| CI/CD activation risk | One merge = public site + payments + network switch in a single deploy. Mistakes are hard to attribute | B-1 deploy is inert (no trust, no network change). B-2 deploy is a compose-only change, gated by manual preflight |
| Rollback complexity | Reverting the network switch without reverting payments needs a partial revert inside a large merge; a full revert un-ships payments | A revert of B-2 is one compose hunk; B-1 can stay deployed (inert). Matches `docs/incident-response.md` §1a |
| Conflicts | Traefik compose conflicts with PR #26 (§7); otherwise none new | Cherry-pick simulation: **0 textual conflicts** for `b304516`, `5fe5d5a`, `a4d82bf`, `6fb9305` [AGENT]. **Compile/test conflict:** `trusted-proxy.integration.spec.ts` imports `CheckoutStatusController`/`CheckoutStatusService` (absent on `main`), so it needs adaptation (same assertions against a neutral throttled test controller) or deferral to the stack. Later, #60 must absorb the duplicates (identical hunks; INFERRED clean, recheck at the time) |
| Operational effort | One large release window | Two small windows (B-1 can be any normal deploy; B-2 needs the infrastructure window) |
| Required authorizations | PA/PO acceptance of every financial gate plus merge instructions for #59 and #60 | **New:** release branch from `main`, cherry-pick, test adaptation (test code: outside documentation-only), PR to `main` (CI runs, red baseline), merge instruction per stage |

### 5.3 The `main` = production coupling

Every merge to `main`, including documentation-only merges, starts `CD`:
- `git pull`, `compose build`, `up -d --remove-orphans --wait`, migrations, `docker image prune -f` [REPO].
- No branch protection, no required checks, no deployment environment approval [AGENT].
- CI's last 40 runs are all `failure` [AGENT] (pre-existing coverage failures), so a red CI is not a usable stop signal.

**A merge is a production action** and must be treated as Phase C of the rollout (§11).

## 6. Recommended integration strategy

**Recommendation: Strategy B (two stages), conditional on PO decision D-V1.**

**Stage B-1: inert code**
- **Content:** `services/api/src/common/trusted-proxy.ts`, the `main.ts` call, `trusted-proxy.spec.ts`, an adapted integration spec, `.env.example` (blank `TRUSTED_PROXY_CIDRS=`), and the `CLAUDE.md` / `incident-response.md` §1a text.
- **Production effect:** with `TRUSTED_PROXY_CIDRS` absent from `.env.production`, the API logs one info line and behaves exactly as today [LOCAL-PREV: T-I1-08, H fixture]. **No compose, network or Traefik change.**
- **Value:** proves the code path in production with zero trust change, and shrinks the B-2 diff.

**Stage B-2: network switch**
- **Content:** the `docker-compose.server.yml` hunk (API `proxy` → `noetia_api_edge`; label `traefik.docker.network=noetia_api_edge`; external network declaration), `infra/server/noetia-api-edge-network.sh`, the `init.sh` hook, the repository copy of the Traefik compose **rewritten against whatever version has landed by then** (§7, §8), and `TRUSTED_PROXY_CIDRS=10.211.75.8/29` in `.env.production`.
- **When:** merged **only** after Phase B is complete and the preflight is green (§9, §11).
- The harness (`a4d82bf`) can go with either stage or stay on PR #60 (no production effect).

**Evidence-based rationale:**
1. It is the only option that does not trip STOP gate 3 (financial functionality without gates).
2. It breaks the G-1 ↔ G1-I1 circularity.
3. Rollback becomes a single, isolated compose revert.
4. It is textually feasible (0 conflicts), with one known test adaptation.

**Actions this requires that are NOT authorized today** (each a future PO decision, D-V1):
- create a release branch from `main`;
- cherry-pick;
- adapt one test file;
- open a PR to `main`;
- give merge instructions for B-1 and B-2;
- decide later how PR #60 absorbs the duplicated G1-I1 commits.

**If the PO prefers Strategy A,** G1-I1 cannot be released until every financial gate in §15 is closed. Phase B must also be complete **before** the #60 merge, or the deploy either fails (network missing) or breaks `/api` (Traefik not attached) while also shipping payments.

## 7. NEM-017 / NEM-018 coordination

### 7.1 PR #26 (NEM-017)

| Question | Finding |
|---|---|
| Committed changes | `docker-compose.staging.yml` (staging `api`/`web`/`storage` → external `proxy_staging`, label `traefik.docker.network=proxy_staging`); `infra/server/traefik/docker-compose.yml` (+`proxy_staging`); `infra/tests/network-isolation/*`; staging docs; mission record [REPO] |
| Base-branch dependence | Everything in `nem-006a-staging` (staging compose, `cd-staging.yml`, web `StagingBanner`/`Dockerfile`/`next.config.js`) is a prerequisite. PR #26 edits `docker-compose.staging.yml`, which exists **only** on that branch [REPO]. No PR from `nem-006a-staging` to `main` exists [AGENT] |
| Already reflected in PR #60 | Only the Traefik `proxy_staging` declaration, **with different comment text** [REPO] |
| Live state | `proxy_staging` exists and Traefik is attached; no staging container on `proxy` [LIVE-PREV]. Whether NEM-017 §8 step 6 (persist `/opt/traefik/docker-compose.yml`) was done is **[UNRESOLVED] (U3)** |
| Merge-order hazard | Three-way merge of the Traefik compose (base `main`, PR #60, PR #26) gives **2 conflicting hunks**: the service `networks:` list and the top-level `networks:` map [AGENT]. A resolution that takes PR #26's side **drops `noetia_api_edge`** from both. This corrects Checkpoint IV §10 and the PR #60 comment ("rebases trivially"). The compose file is not edited in this mission (prohibited) |
| Lost or duplicated changes | A wrong order risks: (a) losing `noetia_api_edge` (above); (b) reintroducing the old `cd.yml` if `nem-006a-staging` is integrated by copying (§5.1); (c) duplicate `proxy_staging` entries if both are pasted by hand; how Compose treats a duplicate is untested [UNRESOLVED, E-13] |
| Preserving `proxy_staging` across Traefik recreations | Only the **persisted live file** governs a recreation; the repository copy has no effect until an operator copies it. Requirement: the live file lists `proxy`, `proxy_staging` and (after B-2 prep) `noetia_api_edge` **before** any Traefik recreation, and the repository copy matches it (§8) |

### 7.2 PR #28 (NEM-018)

| Question | Finding |
|---|---|
| Committed | `docs/reports/2026-11-03-NEM-018-…md`, `docs/operations/nem-018-autoguildx-network-migration.md`, `infra/tests/shared-proxy-isolation/*` (including `autoguildx-proxy-agx.patch` and AutoGuildX fixtures) [REPO]. **No Traefik compose or `init.sh` change** [REPO] |
| Future operational steps (runbook) | Create `proxy_agx`; live-attach Traefik; merge the AutoGuildX patch **in the AutoGuildX repository** (its CD runs `docker rm -f` before `up`); persist the Traefik file at a planned maintenance; add `proxy_agx` to `init.sh` [REPO: runbook §2–§4] |
| Other-repository dependency | The AutoGuildX compose change lives in the AutoGuildX repository. Not authorized here; G1-I1 does not need it |
| Must NEM-018 precede G1-I1? | **Security:** no. G1-I1 removes the API from `proxy`, which by itself closes the AutoGuildX → API path [LOCAL-PREV: T-I1-05]. **Availability:** no dependency. **Operational:** both edit the same Traefik `networks:` list and both require a live attach, so they must be **serialized**, never run in the same window by different operators |
| Can G1-I1 ship without compromising AutoGuildX? | Yes [INFERRED + LOCAL-PREV]. G1-I1 does not touch `proxy` or AutoGuildX containers, and Traefik stays on `proxy`. Residual: after G1-I1, the shared-name ambiguity on `proxy` (S19 class) still affects Noetia `web`/`storage` until NEM-018 |
| Adding `proxy_agx` later | Live `docker network connect proxy_agx traefik` (no restart), then add `proxy_agx` **alongside** `proxy`, `proxy_staging` and `noetia_api_edge` in the live file and the repository copy. Never by replacing the list |

### 7.3 Proposed sequence (PO decision D-V2)

The Checkpoint III recommendation was NEM-017 → NEM-018 → G1-I1. This report proposes the following for PO decision:

1. **NEM-017 reconciliation (documentary first):** a PO-operated read-only capture of the live Traefik file (§9 P-5). If it already lists `proxy_staging`, record it. Otherwise persist it in the B-2 window (nano, **no `compose up`**). Decide PR #26's path to `main`.
2. **G1-I1 B-1** (inert code; independent of everything else).
3. **G1-I1 B-2** (network switch).
4. **NEM-018** (AutoGuildX → `proxy_agx`), as a separate window.

**Rationale:**
- G1-I1 is a precondition for G-1.
- G1-I1 does not depend on NEM-018 for correctness.
- NEM-018 depends on another repository and its destructive CD.

Running NEM-018 first remains acceptable if the PO prefers fewer Traefik-file edits. It delays G1-I1 behind cross-repository work.

## 8. Live/repository Traefik drift matrix

| Network | (1) Known live attachment | (2) Committed config | (3) Unknown live persisted config | (4) Proposed final | (5) Evidence before any change | (6) Consequence if stale | (7) Recovery |
|---|---|---|---|---|---|---|---|
| `proxy` | Traefik `172.18.0.3` [LIVE-PREV] | `main`, #26, #60: listed [REPO] | Presumably listed; **not inspected** (U3) | Keep | P-5 file capture; P-6 attachments | Every production route (`noetia.app`, `storage`, AutoGuildX) fails after a recreation | `docker network connect proxy traefik`; restore the file |
| `proxy_staging` | Traefik `172.22.0.2` [LIVE-PREV] | `main`: **absent**; #26 and #60: listed [REPO] | **Unknown** whether listed (NEM-017 step 6) | Keep | P-5; NEM-017 status record | Staging routing stops after a recreation; production unaffected (NEM-017 §8) | `docker network connect proxy_staging traefik` |
| `noetia_api_edge` | **Does not exist** [LIVE-PREV] | #60 only [REPO] | Absent (network doesn't exist) | Add, after Phase B creates and attaches it | Preflight P-1…P-4 (§9) | After B-2: **`/api/*` 504/502 for every user** after a recreation [LOCAL-PREV R-04] | `docker network connect noetia_api_edge traefik` (no restart); §12 |
| `proxy_agx` | Does not exist [LIVE-PREV] | Nowhere (runbook proposal only) [REPO] | Absent | Add later under NEM-018 | NEM-018 preconditions | AutoGuildX down after a recreation (once NEM-018 is applied) | Connect per NEM-018 §5 |

**Other drift items:**
- **Image tag:** `traefik:v2.11` is a floating tag [REPO]. The live image version is [UNRESOLVED] (Checkpoint III). A recreation may pull a newer v2.11.x. The R-05 source analysis is pinned to `v2.11.61`.
- **Static config:** live `traefik.yml` matches the repository for the reviewed settings (`exposedByDefault: false`, `network: proxy`, no `forwardedHeaders`) [LIVE-PREV]. `log.level: ERROR` is from the repository copy; the live value was not part of the V5 table [UNRESOLVED, low].

**Rules for any future operator:**
- **Never replace** `/opt/traefik/docker-compose.yml` with a GitHub copy. Capture it, diff it against the intended list, and edit only the `networks:` entries with `nano` (`CLAUDE.md`: no multi-line SSH pastes).
- **Never** `docker compose up` in `/opt/traefik` to apply a network change; it recreates Traefik and interrupts every site on the host [LOCAL-PREV: NEM-017 E2].
- **"Attached live" ≠ "persisted".** An attachment made with `docker network connect` survives `docker restart traefik` but **not** a recreation from a file that lacks it. Today `proxy_staging` is verified only as *attached*; its persistence is unverified.
- **Recreation risk while drift exists:** any Traefik recreation (host maintenance, a compose `up` in `/opt/traefik`, an image update) drops every attachment missing from the file. With unknown persistence, a recreation today could already drop `proxy_staging`; after B-2 it could also drop `noetia_api_edge` and take down the production API. **B-2 must not proceed until the persisted file is verified to list all required networks.**

**STOP gate 4 assessment:** the divergence **can** be reconciled with one PO-operated read-only capture (P-5), so documentation proceeds. The reconciliation itself is a **blocking prerequisite** for B-2 (§15).

## 9. Network and trust-boundary preflight plan

**PROPOSED: NOT AUTHORIZED FOR EXECUTION.** These are read-only commands for a **future PO-operated** session. Run them one line at a time (no multi-line pastes). They print no secrets.

| # | Check | Read-only command (single line) | Pass condition / STOP condition |
|---|---|---|---|
| P-1 | Docker subnet inventory | `docker network ls -q \| xargs docker network inspect --format '{{.Name}} {{.Driver}} {{range .IPAM.Config}}{{.Subnet}} {{.Gateway}} {{.IPRange}}{{end}} internal={{.Internal}} v6={{.EnableIPv6}}'` | No subnet overlaps `10.211.75.0/28`. **STOP** on any overlap |
| P-2 | Host IPv4 routes, all tables | `ip -4 route show table all` | No route covering any part of `10.211.75.0/28`. **STOP** otherwise |
| P-3 | Policy routing, including Tailscale | `ip rule show` · `ip -4 route show table 52` · `tailscale status --peers=false` (if installed) | No Tailscale/policy route overlapping `10.211.75.0/28` (closes U8). **STOP** otherwise |
| P-4 | Host interfaces | `ip -4 -br addr` | No interface address in `10.211.75.0/28`. **STOP** otherwise |
| P-5 | Persisted Traefik compose | `sha256sum /opt/traefik/docker-compose.yml` · `cat /opt/traefik/docker-compose.yml` | Record the hash and content. **STOP** if it lacks `proxy` or `proxy_staging`, or differs from the expected structure in any non-network way, until the PA reviews it |
| P-6 | Traefik attachments | `docker inspect traefik --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'` | `proxy`, `proxy_staging` present (pre-B); plus `noetia_api_edge` with an address in `10.211.75.8/29` (post-attach). **STOP** if it is missing or out of range |
| P-7 | Traefik image and start time | `docker inspect traefik --format '{{.Config.Image}} {{.Image}} {{.State.StartedAt}}'` | Record. `StartedAt` must be **unchanged** after the live attach |
| P-8 | Effective edge IPAM | `bash infra/server/noetia-api-edge-network.sh check` (from `/opt/noetia` once the helper is on the server) or the P-1 format for `noetia_api_edge` | bridge, `internal=true`, IPv6 off, one IPAM config, subnet `10.211.75.0/28`, gateway `.1`, range `.8/29`. **STOP** on any mismatch: wrong driver, not internal, IPv6 on, wrong IPAM. Never "fix" a network while a container is attached |
| P-9 | Edge membership | `bash infra/server/noetia-api-edge-network.sh members traefik` (before B-2) · `… members traefik noetia-api-1` (after) | Exactly the listed containers. **STOP** on any other member |
| P-10 | API networks and label | `docker inspect noetia-api-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}{{index .Config.Labels "traefik.docker.network"}}'` | Before: `noetia_noetia_net proxy` + `proxy`. After: `noetia_api_edge noetia_noetia_net` + `noetia_api_edge`. **STOP** if the label names a network the API is not on (the R-05 fallback condition) |
| P-11 | Trusted-CIDR configuration (presence, not value dump) | `grep -c '^TRUSTED_PROXY_CIDRS=10\.211\.75\.8/29$' /opt/noetia/.env.production` | `1` at B-2; `0` before. **STOP** on any other value (mismatch with R) |
| P-12 | Server checkout state | `git -C /opt/noetia rev-parse HEAD` · `git -C /opt/noetia status --porcelain` | HEAD = expected `main` commit; **no tracked modifications** (CD's `git pull` would fail on local edits) |
| P-13 | Engine versions | `docker version --format '{{.Server.Version}}'` · `docker compose version` | Record; compare with Checkpoint III (29.4.3) |
| P-14 | Userland proxy / listeners (U1) | `ss -ltnp '( sport = :80 or sport = :443 )'` | Record whether `docker-proxy` holds 80/443 (affects IPv6/hairpin attribution only; fail-safe) |

**Final trusted CIDR:** `TRUSTED_PROXY_CIDRS=10.211.75.8/29`. Never the subnet, never a private range or keyword.

**Expected membership:** `noetia_api_edge` = {`traefik`, `noetia-api-1`} exactly.

## 10. CI/CD deployment-trigger assessment

| # | Question | Finding | Evidence |
|---|---|---|---|
| 1 | Events that deploy production | `push` to `main` only | `.github/workflows/cd.yml` `on.push.branches: [main]` [REPO]; registered workflows: `CD`, `CI` only [AGENT] |
| 2 | Does a merge to `main` deploy automatically? | **Yes.** No branch protection, no rulesets, no environment approval | `gh api …/branches/main` → `protected:false`; rulesets `0`; environments none [AGENT] |
| 3 | Can documentation-only changes deploy? | **Yes, if they reach `main`** (no `paths` filter). Compose recreates only services whose config or image changed [INFERRED], but `build`, migrations and `image prune` still run | `cd.yml` [REPO] |
| 4 | Production vs staging workflows | Production: `cd.yml` (`/opt/noetia`). Staging: `cd-staging.yml` exists **only** on `nem-006a-staging` / PR #26 branches. It triggers on a `staging` branch (none exists) or `workflow_dispatch`, and is **not registered** (dispatch on the default branch is unavailable: HTTP 404) | [REPO] + [AGENT] |
| 5 | PR validation for the stacked branch | `ci.yml` runs only on `pull_request` → `main`. PR #60 targets #59's branch, so **no CI runs** (0 runs on the branch). The last 40 CI runs overall: **all failure** (pre-existing coverage gates) | [REPO] + [AGENT] |
| 6 | Workflows that may recreate the production API | `cd.yml` step `docker compose … up -d --remove-orphans --wait --wait-timeout 300` recreates `api` whenever its image or config changes. B-1 (code) and B-2 (networks/labels) both qualify | [REPO] |
| 7 | Preflight membership check in deploy? | **None** | `cd.yml` has no `noetia-api-edge-network.sh` call [REPO] |
| 8 | Edge IPAM validation in deploy? | **None** beyond compose's own "external network must exist" check | [REPO]; R-02 [LOCAL-PREV] |
| 9 | Helper auto-invoked anywhere? | **No.** Only `infra/server/init.sh` calls `ensure`, and `init.sh` is a manual one-time server bootstrap, never run by CD | [REPO] |
| 10 | Could the planned merge order activate unapproved functionality? | **Strategy A: yes.** Payments, billing UI, mobile paywall copy and the public site go live with #60/#59. **Strategy B:** no financial or UI code. Noetia+/NoetiaX: "Coming Soon" presentation only, in #59 [REPO] | §5.1 |

### 10.1 Push safety of this documentation commit [AGENT]

- The PR #60 branch is `fix/payment-lifecycle-stabilization-20261112`.
- `cd.yml` (identical to `main`'s on this branch; `git diff origin/main HEAD -- .github/` is empty) triggers only on `main`.
- `ci.yml` triggers only on `pull_request` → `main`.
- `gh run list --branch fix/payment-lifecycle-stabilization-20261112` → **no runs** across the branch's 41 earlier pushes.

**This commit cannot trigger a deployment.** Verified before pushing.

### 10.2 What happens if B-2 (or #60) reaches `main` in each server state [INFERRED from `cd.yml` + LOCAL-PREV]

| Server state at merge time | CD outcome | Production effect |
|---|---|---|
| `noetia_api_edge` missing | `up -d` fails: "declared as external, but could not be found" | Running API not replaced [LOCAL-PREV R-02; the multi-service production project is untested]. Deploy **red**; migrations skipped; `main` ahead of production; every later deploy fails until fixed |
| Network exists, **Traefik not attached** | Build OK; API recreated; `--wait` passes (in-container healthcheck); **deploy green** | **`/api/*` 504 for everyone** [LOCAL-PREV R-04] with a green pipeline |
| Network exists, Traefik attached, `TRUSTED_PROXY_CIDRS` missing | Green | Routing OK; attribution still shared (fail-safe) [LOCAL-PREV T-I1-08] |
| Correct label, but an extra member on the edge network | Green | **Trusted-peer exposure**: that member can forge `X-Forwarded-For` [LOCAL-PREV negative control] |
| All prepared | Green | Intended state, after a short recreation gap [LOCAL-PREV R-01] |

**Side effect [INFERRED, verify]:** `.env.production` is the `env_file` of several services. Editing it (adding `TRUSTED_PROXY_CIDRS`) may make the **next** CD run recreate every service that uses it, not only `api`.

### 10.3 Safeguard classification

| Safeguard | Class |
|---|---|
| Compose refuses to start with a missing external network | **Existing safeguard** (local evidence only) |
| CD `concurrency: deploy-production`, `cancel-in-progress: false` | **Existing safeguard** (against half-finished deploys) |
| Pre-merge P-6/P-8/P-9/P-10/P-11 run by the operator, with recorded output | **Proposed manual gate. Blocking prerequisite for B-2** |
| Post-deploy P-9 (exact two members) and P-10, plus the §13 checks | **Proposed manual gate** (mandatory) |
| Merge only on an explicit PO instruction naming the stage, after checking `gh run list` for a running deploy (memory: no merges mid-deploy) | **Proposed manual gate** |
| A `cd.yml` step running `noetia-api-edge-network.sh members traefik noetia-api-1` **before** `up -d` (fail closed) and again after | **Proposed future code change: needs separate CI/CD authorization (NEM mission)** |
| Branch protection / environment approval for `main` | **Proposed future change: separate authorization**; repository governance, out of G1-I1 scope |
| Membership monitoring between deploys (a periodic check) | **Proposed future change: separate authorization** |

**Deployment-safety recommendation:**
- No G1-I1 network change (B-2 or #60) may be merged until Phase B is complete, P-5…P-12 are green and recorded, and the PO has issued a merge instruction naming the stage.
- Until a CD preflight exists, the operator who merges must also be the one who verified Phase B in the same window.

## 11. Proposed phased rollout sequence

**PROPOSED: NOT AUTHORIZED FOR EXECUTION.** It assumes Strategy B. Under Strategy A, substitute "the #60 merge" for "the B-2 merge", after all financial gates close.

### Phase A: authorization and prerequisites

| # | Requirement | Evidence to record |
|---|---|---|
| A-1 | Independent PA review of this report | PA record |
| A-2 | PO decisions D-V1…D-V4 (§16) | PO record |
| A-3 | Confirmation of which change may merge (B-1 / B-2 / stack) and that no financial code is included (`git diff --stat main…<branch>`) | Diff listing |
| A-4 | Financial gate status recorded as **closed / not affected** (§15) | Gate register snapshot |
| A-5 | Approved window (§16 D-V3), with the operator and rollback authority named | PO record |
| A-6 | Backup and recovery readiness: a Contabo snapshot before B-2 (infrastructure change, `CLAUDE.md` Development Safety Rules), and the last offsite backup confirmed | Snapshot ID/time; backup log line |
| A-7 | Fresh preflight P-1…P-14 (§9), same day | Sanitized outputs |
| A-8 | **Last known-good revision** recorded: the `main` commit live before the B-2 merge (P-12 HEAD), plus the live API networks and label (P-10) and the Traefik attachments (P-6). Today's deployed `main` is `6a5e5c0` [AGENT: last successful CD run], but the live checkout is unverified (P-12). Do **not** use any PR #60 commit as a rollback target | P-12/P-10/P-6 output |

**Local test success does not authorize release.**

### Phase B: infrastructure preparation (reversible, no API change)

| # | Proposed operation (single-line commands, from the helper's own logic) | Reversible? | Checkpoint |
|---|---|---|---|
| B-1i | Re-validate the subnet (P-1…P-4) | n/a | All pass |
| B-2i | `bash /opt/noetia/infra/server/noetia-api-edge-network.sh ensure`. The helper is on the server only once B-1 or B-2 code is on `main`; otherwise the equivalent `docker network create --driver bridge --internal --subnet 10.211.75.0/28 --gateway 10.211.75.1 --ip-range 10.211.75.8/29 noetia_api_edge` followed by P-8 | Yes: `docker network rm noetia_api_edge` while it has **no** members | P-8 OK |
| B-3i | `docker network connect noetia_api_edge traefik` (live, **no restart**) | Yes: `docker network disconnect noetia_api_edge traefik` | P-6 shows `proxy`, `proxy_staging`, `noetia_api_edge` (∈ R); P-7 `StartedAt` unchanged; `noetia.app`, `/api/health`, `storage.noetia.app`, staging and AutoGuildX answer |
| B-4i | `… members traefik` | n/a | Exactly `traefik` |
| B-5i | Persist `/opt/traefik/docker-compose.yml` with `nano`: add `noetia_api_edge` to the service `networks:` and as an external network; keep `proxy` and `proxy_staging`. **No `compose up`** | Yes: restore from the P-5 capture | Diff against the P-5 capture shows only the two additions; `docker compose -f /opt/traefik/docker-compose.yml config -q` succeeds (parse only) |
| B-6i | Add `TRUSTED_PROXY_CIDRS=10.211.75.8/29` to `/opt/noetia/.env.production` with `nano` | Yes: remove the line | P-11 = 1. Harmless before B-2: the API's peer is still Traefik's `proxy` address, outside R. Note the §10.2 recreation side effect |

**Boundary:** Phase B changes only Traefik's attachments, a new empty network, one file in `/opt/traefik` and one environment line. **The API is untouched until Phase C.** Abort at any checkpoint: undo in reverse order; production is unaffected.

### Phase C: controlled integration (a production action)

| # | Requirement |
|---|---|
| C-1 | B-1 merged and deployed earlier, with its own §13 subset green (API boots; log shows trust **disabled / unset**; no behaviour change) |
| C-2 | B-2 PR contains **only** the network-switch files (A-3 listing); `.github/` unchanged versus `main` |
| C-3 | Phase B checkpoints all green **in the same window**; P-9 = `traefik` only |
| C-4 | No CD run in progress (`gh run list --workflow cd.yml --limit 1`) |
| C-5 | PO merge instruction naming B-2 |
| C-6 | Merge, then watch CD. A **red** CD at `up -d` means the network is missing: STOP and go to §12 row 1. A **green** CD is **not** acceptance; continue to Phase D |

### Phase D: deployment validation

The checks are listed in §13. All are read-only or non-financial. No payment transaction, checkout or Stripe call is made to prove network readiness.

### Phase E: stabilization

| Topic | Rule |
|---|---|
| Immediate rollback | `/api/health` or `/api/*` failing for more than about 2 minutes after the recreation gap; an internal caller (web SSR, Prometheus, worker) unable to reach `api:4000`; an unexplained third edge member (contain first: §12 row 5); login broken |
| May be monitored | Shared buckets with routing OK (fail-safe; diagnose per §12 row 8); isolated 502s inside the recreation window; staging-only issues (§12 row 9) |
| Evidence to capture | P-6, P-9, P-10, P-11 outputs; the API `[trusted-proxy]` log line; the §13 results with timestamps; the CD run ID; a monitor tally of the gap |
| Approval to proceed or close | The operator named in A-5, then a PA review of the evidence. A commit or green CD does not complete the rollout |
| Masked R-05 fallback | Pass only if P-10 shows the label **exactly** `noetia_api_edge` **and** the API is attached to `noetia_api_edge`. Per the Traefik v2.11.61 source, Traefik then takes the deterministic label branch and the fallback is never reached. A working route alone does **not** prove this (the fallback can also pick the edge network). Independent per-client buckets (§13 D-10) prove that Traefik's peer is in R. The fallback itself remains **NOT VERIFIED** |
| Repeat checks | P-9 + P-10 after **every** later Traefik or API recreation (deploys, host reboot, maintenance) |

**Availability:** API recreation gaps of a few seconds with 502/504 are expected in B-1, B-2 and any rollback [LOCAL-PREV: R-01 3 failures in 3.2 s; R-08 2 in 3.0 s]. **No zero-downtime claim.**

*Contradiction recorded (not edited):* design §8.2 says "no production downtime expected". Checkpoint IV's observed gaps supersede that wording.

## 12. Rollback and recovery matrix

**PROPOSED: NOT AUTHORIZED FOR EXECUTION.** "Revert" means a revert commit on `main`, which CD deploys. **Do not edit tracked files in `/opt/noetia` by hand**: CD's `git pull` would then fail. Never prune, never remove a network that has members, never recreate Traefik to "fix" networking.

| # | Failure | Detection signal | Authority | Preconditions | Proposed recovery | Expected interruption | Verify restoration | Residual risk |
|---|---|---|---|---|---|---|---|---|
| 1 | Edge network missing at merge | CD red at `up -d` ("external … not found"); API container ID unchanged | Operator → PO | B-2 already on `main` | Either complete Phase B (create, attach, validate) and re-run CD (`workflow_dispatch` is not configured: re-push or revert), or revert B-2 on `main` | None expected (old API keeps serving) [LOCAL-PREV R-02] | `/api/health` 200; P-10 unchanged (still on `proxy`) | `main` ≠ production until resolved; migrations skipped by that run |
| 2 | Incorrect IPAM | P-8 `STOP:` | Operator; STOP to PA | Before B-3i | **Do not attach Traefik and do not merge B-2.** If the network has no members, PA may authorize removal and recreation. If it has members, escalate; never recreate in place | None | P-8 OK | Subnet conflict requires a new candidate, so back to Checkpoint III-style verification |
| 3 | Traefik not on the edge network | `/api/*` 504 (~30 s) or 502 while web, storage and staging are fine; P-6 lacks `noetia_api_edge` | Operator (immediate) | Network exists with the right IPAM | `docker network connect noetia_api_edge traefik` (no restart); then ensure the persisted file lists it (B-5i) | Until reattached; then immediate [LOCAL-PREV R-04] | P-6; `/api/health` 200; §13 D-10 | A recreation from a stale file repeats this, hence B-5i |
| 4 | Wrong API network label | P-10 label ≠ `noetia_api_edge`, or 504 intermittently across refreshes | Operator → PO | — | Revert B-2 on `main` (restores label `proxy` + the `proxy` network together). Never hot-edit labels on the server | Recreation gap | P-10 back to the pre-change state; `/api/health` 200 | **R-05 NOT VERIFIED:** fallback behaviour in production is unknown; it may be masked or show as 504 |
| 5 | Unexpected edge member | P-9 `STOP: members are [...]` | Operator (immediate), then PO / security | — | `docker network disconnect noetia_api_edge <container>`; identify how it joined (compose file, manual connect); review its logs and the rate-limit history; if the cause is unknown, treat it as a Docker-control compromise (escalation below) | None for production routing | P-9 exactly two | That container could forge client IPs and evade limits while attached [LOCAL-PREV negative control]; auth and JWT unaffected |
| 6 | Internal API dependency inaccessible | Web SSR errors; Prometheus target down; worker failures; `docker exec noetia-web-1 wget -qO- http://api:4000/health` fails | Operator | — | Check that the API is still on `noetia_noetia_net` (P-10). If not, revert B-2 | Recreation gap | Internal call 200 | Indicates a compose or network mistake, not trust logic |
| 7 | Persistent 502/504 after B-2 | More than about 2 minutes of failures after the gap | Operator (immediate) | Rows 3/4 excluded or failed | Revert B-2 on `main` → CD puts the API back on `proxy` with label `proxy`. Leave Traefik's edge attachment and the network in place (harmless). Keep `TRUSTED_PROXY_CIDRS` or remove it (no effect while the peer is outside R) | Revert CD duration + recreation gap (~minutes) | `/api/health` 200; P-10 pre-change | If CD itself is broken, go to row 10 |
| 8 | Per-client limits still shared | §13 D-10: `X-RateLimit-Remaining-global` decrements across two client networks | Operator → PA | Routing OK | Read the API log `[trusted-proxy]` line (disabled? value?); P-11; P-6 Traefik edge address ∈ R? Fix the env value with `nano` and recreate the API through a normal deploy, or accept fail-safe temporarily | None | D-10 independent buckets | Fail-safe (no spoofing). Checkout-status shared bucket persists (affects G-1 readiness, not current production) |
| 9 | Staging routing breaks | `staging.noetia.app` fails while production is fine | Operator | — | `docker network connect proxy_staging traefik`; verify the persisted file lists it (P-5) | Staging only | Staging 200 | Never trade production stability for staging; no Traefik recreation |
| 10 | Rollback redeploy fails | Revert CD red or hangs | PO + operator | Snapshot from A-6 | Use `docs/incident-response.md` procedures (crash loop, Traefik 502/404). A manual `docker compose … up -d` from a clean `/opt/noetia` at the reverted `main` commit, run by an authorized operator. Contabo snapshot restore is the **last resort**, PO decision only (it loses data written after the snapshot) | Variable | `/api/health`, login, reader spot check | Snapshot restore implications for user data. Requires a separate PO decision |

**Escalation (Docker-control assumption):**
- The threat model assumes attackers do not control the Docker daemon.
- Today every project on the host, including AutoGuildX CD, runs with root Docker access [LIVE-PREV]. Admission to the edge network is therefore a **procedural** control, not a technical one.
- If an unexplained member appears or host compromise is suspected, the response is incident-level:
  - contain (disconnect);
  - preserve evidence;
  - rotate secrets per `docs/secrets-rotation.md`;
  - have the PO decide on wider measures.
- G1-I1 cannot provide guarantees beyond this assumption.

## 13. Post-deployment acceptance checks (B-2)

**PROPOSED. Read-only or non-financial only.**

| # | Check | Pass |
|---|---|---|
| D-1 | `curl -s -o /dev/null -w '%{http_code}' https://noetia.app/api/health` | 200 |
| D-2 | `https://noetia.app/` and one `https://storage.noetia.app/` public image | 200 |
| D-3 | Staging home (with its basic auth) | Same status as before the change |
| D-4 | Internal: `docker exec noetia-web-1 wget -qO- http://api:4000/health`; Prometheus API target up | OK / up |
| D-5 | P-10 API networks = {`noetia_noetia_net`, `noetia_api_edge`}, label = `noetia_api_edge` | Exact |
| D-6 | P-9 `members traefik noetia-api-1` | Exactly two |
| D-7 | `docker logs noetia-api-1 2>&1 \| grep '\[trusted-proxy\]'` | Trust honoured only from `10.211.75.8/29`; no WARN |
| D-8 | Traefik routes the API via the edge address: D-1 OK **and** D-5 exact **and** D-10 pass (Traefik's peer ∈ R) | All three |
| D-9 | API egress (new requirement): one non-financial outbound check, e.g. a TLS reach test from the API container to an SMTP or OAuth host, **no Stripe API call with credentials** | Reachable |
| D-10 | Independent buckets: two different client networks each `curl -sI https://noetia.app/api/health` (or a public GET route) | Each sees its own `X-RateLimit-Remaining-global` sequence |
| D-11 | Login (email or Google) plus one authenticated read (`/api/users/me`, library list) by an operator test account | 200 |
| D-12 | Reader-critical: open a free-library book, stream audio for a few seconds, confirm phrase sync | Works (product hierarchy: reader first) |
| D-13 | Payment-verification read-only: an unauthenticated `GET` of the Checkout-status route returns 401 (once G-1 is deployed; on `main` today the route does not exist, so skip). **No checkout, no payment, no webhook replay** | 401 / skipped |
| D-14 | Spoof check: from an external client, `curl -sI -H 'X-Forwarded-For: 1.2.3.4' …/api/health` repeatedly | Bucket follows the real client, not the header |

## 14. Residual risks and known limitations

| # | Risk | Status |
|---|---|---|
| RR-1 | **R-05 real Docker-provider wrong-label behaviour: NOT VERIFIED** (accepted exception). Possibly non-deterministic network selection; a masked error if the fallback picks the edge network; a 504 if it picks `noetia_net`; silent at production `log.level: ERROR`. Mitigated only by P-10 at release and after recreations | Accepted for local qualification; production acceptance = **D-V4** |
| RR-2 | Edge membership is the trust boundary. The exact-two-member check is **point-in-time**, not continuous enforcement, and **not cryptographic proof** of Traefik identity. Any admitted container can forge forwarding headers | Mandatory operational safeguard; continuous monitoring is a future change |
| RR-3 | API recreation gaps (502/504, seconds) in each stage and rollback | Expected; no zero-downtime claim |
| RR-4 | No CD preflight: a green CD can coexist with a broken `/api` (Traefik not attached) | Manual gates; future CD change |
| RR-5 | Traefik persisted-file drift (U3); floating `traefik:v2.11` tag | Blocking prerequisite (P-5); image pin = future decision |
| RR-6 | API egress after leaving `proxy` not tested | Evidence requirement (D-9, §17) |
| RR-7 | Production behaviour for a missing external network in the multi-service project is untested (R-02 was a single-service disposable project) | Evidence requirement |
| RR-8 | `.env.production` edit may recreate several services on the next deploy | Verify (§17); plan the window accordingly |
| RR-9 | IPv6 / userland-proxy attribution (U1/U2): affected clients share buckets (fail-safe); IPv6 /128 buckets; shared NAT | Known; unchanged |
| RR-10 | Shared-name ambiguity on `proxy` remains for `web`/`storage` until NEM-018 | Pre-existing (S19 class) |
| RR-11 | `nem-006a-staging` carries an obsolete destructive `cd.yml` in its tree | Integration hazard; diff `.github/` before any merge |
| RR-12 | CI is red on every run, so it is not a merge signal | Pre-existing |

## 15. Release gate register

| Gate | Status | Notes |
|---|---|---|
| Checkpoint IV local qualification | **ACCEPTED WITH EXCEPTION** | PA final decision recorded at `7a67a11` |
| R-05 real Docker-provider negative path | **NOT VERIFIED: EXCEPTION ACCEPTED** (local qualification only) | Production risk acceptance pending (D-V4) |
| Production Traefik compose reconciliation (U3) | **OPEN: BLOCKING for B-2** | Needs P-5 capture plus PA review |
| Production subnet and Tailscale route revalidation (U8) | **OPEN: BLOCKING for Phase B** | P-1…P-4, same day |
| API egress after the network change | **OPEN** (new) | D-9; can be closed during B-2 validation, with rollback ready |
| PR #26 / NEM-017 integration decision | **OPEN** | Including the `nem-006a-staging` path to `main` |
| PR #28 / NEM-018 integration decision | **OPEN** | Cross-repository |
| PR #59 / #60 stack integration decision | **OPEN** | D-V1 |
| CI/CD activation and merge-safety assessment | **ASSESSED (§10): safeguards insufficient**; manual gates required; CD preflight = future authorization | |
| Trusted-network membership enforcement | **TO VERIFY at rollout** (manual P-9); continuous enforcement absent | |
| Production rollout authorization | **NOT AUTHORIZED** | |
| G-1 payment verification (server-side Checkout-session verification) | **CLOSED / NOT RELEASE-QUALIFIED** | Implemented locally; release gates open; depends on G1-I1 attribution |
| W-1 (token package inactive at fulfillment) | **OPEN** (launch gate, W1-PO policy pending) | |
| W-2 / SG-PM (payment-method assumptions) | **OPEN** | |
| G-4 (Checkout ambiguity after Stripe timeouts) | **OPEN** | |
| G-5 (verification-script location) | **OPEN** | |
| USD-1 (Stripe USD price objects) | **OPEN** | Needs Stripe access |
| D4 Stripe portal configuration | **OPEN** | |
| Stripe production webhook configuration | **OPEN** | |
| Gift-email recovery | **OPEN** | |
| Terms wording for T-1 / D1–D6 (OP-3, legal) | **OPEN** | |
| NEM-024 | **E-1 OPEN / BLOCKED; Checkpoint E NOT QUALIFIED** | |
| PR #59 status-unknown correction | **Awaiting PA** | |
| CI coverage gates | **Failing (pre-existing)** | |
| Financial release gates overall | **CLOSED / NOT RELEASE-QUALIFIED** | G1-I1 does **not** qualify any of them |

## 16. PO decision register

### D-V1: Integration strategy

| | |
|---|---|
| Context | `main` auto-deploys; PR #60 carries 31 payment-lifecycle commits plus #59's public site |
| Options | **A:** merge #59 → #60 after all gates. **B:** isolate G1-I1 from `main` in two stages (B-1 inert code, B-2 network switch). **B′:** single-stage isolation |
| Pros/cons | A: no new branch, but G1-I1 is blocked behind every financial gate, rollback is entangled, and G-1 depends on G1-I1 (circular). B: small, revertible, unblocks G-1, but needs a release branch, cherry-picks and one test adaptation, and #60 must later absorb the duplicates. B′: one window fewer, but larger blast radius at activation |
| Recommendation | **B (two stages)** |
| If deferred | G1-I1 stays undeployed; G-1 cannot be released with correct per-client limits |
| Future authorization | Create a release branch from `main`; cherry-pick `b304516`, `5fe5d5a`, `6fb9305` (± `a4d82bf`); a **test-code change** for `trusted-proxy.integration.spec.ts`; a PR to `main`; merge instructions per stage. CD consequence: each merge is a production deploy |

### D-V2: NEM-017 / NEM-018 sequencing

| | |
|---|---|
| Context | Checkpoint III recommended 017 → 018 → G1-I1; not authorized |
| Options | (i) 017-reconcile → 018 → G1-I1; (ii) **017-reconcile → G1-I1 (B-1, B-2) → 018**; (iii) G1-I1 without 017 reconciliation (**not supported**: U3 is blocking) |
| Pros/cons | (i) fewer Traefik-file edits, but G1-I1 waits on another repository. (ii) unblocks G-1 sooner; a separate window for each Traefik-file edit |
| Recommendation | **(ii)**. Also decide PR #26's route to `main` (NEM-006A integration with the `.github/` diff check) |
| If deferred | Drift persists; any Traefik recreation can drop `proxy_staging` today |
| Future authorization | A NEM-017 rollout or reconciliation instruction; NEM-018 execution, including the AutoGuildX repository |

### D-V3: Production deployment window

| | |
|---|---|
| Considerations | Low-traffic hours for readers (product hierarchy). An operator with root SSH plus the PO available for rollback decisions. No AutoGuildX deploy or NEM-018 work in the same window. A Contabo snapshot slot free (3 slots). Offsite backup recent. Note the CD duration (build ~minutes) plus the recreation gap. Separate windows for Phase B + B-2 (one window) and B-1 (any normal deploy) |
| Recommendation | One supervised window for Phase B followed immediately by the B-2 merge; B-1 earlier as a routine deploy |
| If deferred | No effect on production |
| Future authorization | A PO-scheduled window inside a separate infrastructure rollout authorization |

### D-V4: Release risk acceptance

| | |
|---|---|
| Risks to accept or reject | RR-1 (R-05 NOT VERIFIED in production), RR-2 (membership = procedural boundary, point-in-time check), RR-3 (recreation gaps), RR-4 (no CD preflight; manual gates instead), RR-6/7/8 until closed |
| Options | Accept with the manual gates in §10.3/§11; or require prior mitigation (e.g. authorize the stub-Docker-API test for R-05, or a CD preflight mission) |
| Recommendation | Accept RR-1, RR-2 and RR-3 with the manual gates. Require RR-6 (egress) to be checked in-window, with rollback ready. Commission the CD preflight as a follow-up mission |
| If deferred | No production rollout can be authorized |
| Note | The PA's local-qualification exception **does not** constitute production risk acceptance |

## 17. Unresolved evidence requirements

| # | Requirement | How (future, PO-operated or authorized) | Blocks |
|---|---|---|---|
| E-1 / U3 | Content and hash of `/opt/traefik/docker-compose.yml`; NEM-017 step 6 status | P-5 | B-2 |
| E-2 / U8 | Policy-routing tables (Tailscale) for `10.211.75.0/28` | P-3 | Phase B |
| E-3 | Fresh subnet, route and interface inventory | P-1, P-2, P-4 | Phase B |
| E-4 | Live `/opt/noetia` HEAD and cleanliness (last known good) | P-12 | Phase A |
| E-5 | Live Traefik image version (floating tag) | P-7 | D-V4 (R-05 analysis is pinned to v2.11.61) |
| E-6 | API outbound egress with the API on `noetia_net` + internal edge only | D-9 in-window; or a future authorized local test | B-2 acceptance |
| E-7 | Multi-service production compose behaviour on a missing external network | Observe only if it happens; or a future authorized local test with the full `docker-compose.server.yml` | RR-7 |
| E-8 | Whether an `.env.production` edit recreates every `env_file` service | Future authorized local compose test, or accept and plan the window | RR-8 |
| E-9 / U1, U2 | userland-proxy and IPv6 ingress | P-14; AAAA check | Fail-safe; informational |
| E-10 / U6 | Production forwarded-header handling | D-14 | B-2 acceptance |
| E-11 | Staging deploy source revision (no `staging` branch exists; `/opt/noetia-staging` state unknown) | PO-operated `git -C /opt/noetia-staging rev-parse HEAD` | D-V2 |
| E-12 | Inter-bridge isolation on the production daemon (determines whether the R-05 `noetia_net` fallback gives 504) | Not testable without R-05 work | RR-1 (accepted exception) |
| E-13 | Whether Compose accepts duplicate network entries from careless manual merges | Parse-only test (future) | Integration hygiene |

## 18. No-change statement

- **No server access:** no production, staging or backup SSH; no Docker daemon commands of any kind (local or remote) in this mission.
- **No application, test, compose, script, Traefik, environment, workflow or migration change.** The only repository change is this report.
- **No merge, rebase, cherry-pick, retarget or new branch.** The `git merge-tree` and `git merge-file` simulations moved no ref and touched no working tree or index of any branch. PR #59, #26 and #28 are unchanged.
- **No deployment, activation or Stripe interaction.** `TRUSTED_PROXY_CIDRS` is not set anywhere live (unchanged).

## 19. Recommendation for the next separately authorized mission

1. **PA review** of this report.
2. **PO decisions D-V1…D-V4.**
3. If B is chosen, a **G1-I1 Checkpoint VI: isolated release preparation** mission (repository only):
   - create the release branch from `main`;
   - cherry-pick the G1-I1 commits;
   - adapt `trusted-proxy.integration.spec.ts` to a neutral throttled controller, keeping all assertions;
   - open a Draft PR to `main` (CI runs);
   - leave the `infra/server/traefik/docker-compose.yml` copy written against the then-landed version;
   - no merge.
4. In parallel, a **PO-operated read-only evidence session** (P-1…P-14) to close E-1…E-5 and E-11, with sanitized output for PA review.
5. Then a separate **infrastructure rollout authorization** for Phase B + B-2, and a later optional **CD preflight** mission (NEM governance).

## 20. Mandatory STOP

**Checkpoint V is planning only.** Nothing in this report authorizes:
- network creation, Traefik attachment or configuration edits;
- branch creation, cherry-picks, merges or deployment;
- financial release or Stripe activation.

**All production and financial release gates remain closed.**

**STOP for independent Product Architecture review.**
