# G1-I1 Checkpoint VI: Stage B-1 isolated release preparation (qualification and handoff)

| | |
|---|---|
| **Mission** | G1-I1 Checkpoint VI: Isolated Release Preparation, Stage B-1 (PO: APPROVED AND EXECUTE) |
| **Authorization** | Repository only: one branch from `main`, extraction of the trusted-proxy code and tests, test adaptation, Draft PR, local validation. **No merge, deployment, production/staging access, Docker operations or activation** |
| **Target baseline** | `main` = `6a5e5c0850a73a9de432be87d5be647bd138dbe7` (verified) |
| **Source** | Draft PR #60 at `d8e61e24e0b8c35c08c9d0f722f6ff6876d71689` (implementation commit `b304516`, docs `6fb9305`) |
| **Branch** | `release/g1-i1-b1-trusted-proxy-inactive` (no upstream tracking; pushed with an explicit refspec) |
| **Draft PR** | [#61](https://github.com/Carloskfe/noetia/pull/61) → `main`: "G1-I1 Stage B-1 — Inactive Trusted-Proxy Code (DO NOT MERGE)" |
| **Commits** | `30db6f9` feat(api) implementation · this report's commit |
| **Verdict** | **Prepared and locally validated. Inactive by construction.** **STOP for independent PA review.** |

## 1. Baseline verification [AGENT, 2026-11-15]

| PR | HEAD | Base | State |
|---|---|---|---|
| #60 | `d8e61e2` ✔ | `feat/public-ecosystem-site-20261112` | Draft, open, unmerged |
| #59 | `e326b81` ✔ | `main` | Draft, open, unmerged |
| #26 | `02c98f7` ✔ | `nem-006a-staging` | Draft, open, unmerged |
| #28 | `35ab50b` ✔ | `main` | Draft, open, unmerged |

**`main`:** `6a5e5c0` ✔. The last production CD run deployed `6a5e5c0` (2026-10-31).

**CI/CD:**
- Registered workflows are `cd.yml` (`push` → `main` only: the production deploy) and `ci.yml` (`pull_request` → `main`: lint, typecheck, build, tests; no secrets, SSH or deploy).
- The branch push and the Draft PR therefore start **CI only, never CD**.
- After the push, `main` was still `6a5e5c0`.

## 2. Files changed (vs `main`)

| File | Change | Relation to Checkpoint IV / PR #60 |
|---|---|---|
| `services/api/src/common/trusted-proxy.ts` | New (76 lines) | **Byte-identical** |
| `services/api/src/main.ts` | +1 `Logger` import, +1 import, +1 `applyTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS, new Logger('TrustedProxy'))` call | **Byte-identical** (whole file) |
| `services/api/tests/unit/common/trusted-proxy.spec.ts` | New (53 tests) | **Byte-identical** |
| `services/api/tests/unit/common/trusted-proxy.integration.spec.ts` | New (27 tests) | **Adapted** (§3) |
| `.env.example` | Blank `TRUSTED_PROXY_CIDRS=` with guidance | **Byte-identical** |
| `CLAUDE.md` | Env-table row and a "Trusted proxy (G1-I1)" note | **Rewritten for B-1.** It says the variable must stay empty until B-2. It omits PR #60's network, helper and Traefik instructions, which are B-2 material and reference files absent on `main` |
| `docs/reports/g1-i1-stage-b1/{README.md,evidence.txt}` | This report and sanitized evidence | New |

**Not included** (left on PR #60 for B-2 or elsewhere):
- `docker-compose.server.yml`, `infra/server/traefik/*`, `infra/server/noetia-api-edge-network.sh`, `infra/server/init.sh`;
- the `infra/tests/trusted-proxy/` harness;
- `docs/incident-response.md` §1a;
- every G-1 / payment / public-site file.

## 3. Test adaptation rationale

PR #60's integration spec drove its 30/min assertions through the real G-1 `CheckoutStatusController`, together with `CheckoutStatusService`, a Stripe mock and subscription/ledger repositories. None of these exist on `main`. Importing them is impossible without bringing financial code.

**Adaptation:**
- A **test-only** `ProbeController` (`GET /probe/limited`) defined inside the spec, guarded by the **real** `JwtAuthGuard` (real `JwtStrategy`; `UsersService` mocked) and a **real** `@Throttle({ global: { limit: 30, ttl: 60_000 } })` override, under the API's real `ThrottlerModule` config (`global`, 120/min, = `app.module.ts`).
- Success is `200 {user}` instead of the G-1 uniform `404`.
- The header comment states that the probe stands in for a route that **does not exist on `main`**. No production endpoint is added or implied.

| Requirement | Test(s) | Result |
|---|---|---|
| Independent external IP buckets | T-I1-01 | PASS |
| 31st request → 429; headers track the client's own bucket | T-I1-02; T-I1-04 rotation | PASS |
| Existing 120/min global limit, separate from the 30/min route | "the 120/min routes are per client too" | PASS |
| Forwarded-address handling (rightmost entry; no XFF → peer) | two `req.ip` tests | PASS |
| Forged headers from untrusted peers rejected | T-I1-04 (3 tests) | PASS |
| IPv4 and IPv4-mapped IPv6 | T-I1-09 (3 tests) | PASS |
| Invalid configuration fails safe | T-I1-08 (stale range + 9 invalid values) | PASS |
| Authentication isolation (real JWT mechanism) | T-I1-10: 4 × 401 without a JWT; **added**: a foreign-signed or garbage JWT → 401; a valid JWT → 200 with the user resolved | PASS |

**Removed:** only the G-1-specific assertions (uniform 404 body `checkout_session_not_found`, `Cache-Control: no-store`, "no Stripe call"). Those belong to G-1's own suites on PR #60. Test count: 26 → 27 (+1 invalid-JWT case).

## 4. Validation results

Raw output: [`evidence.txt`](evidence.txt).

| # | Check | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` (api; `src/**`) | **PASS** (0 errors). Test files are type-checked by ts-jest during the runs below |
| 2 | Focused `tests/unit/common` (unit + integration) | **PASS: 80/80** (53 + 27) |
| 3 | Auth regression `tests/unit/auth*` | **PASS: 7/7 suites, 73/73** (including `auth.controller.spec.ts`) |
| 4 | Full API `npx jest --maxWorkers=2` | **PASS: 71/71 suites, 1028/1028.** `main` without B-1: 69 / 948. The delta is exactly the 2 new suites and 80 tests |
| 5a | `npm run build` (`nest build`) | **PASS**; `dist/common/trusted-proxy.js` emitted |
| 5b | ESLint, changed files / `npm run lint` | **PASS: 0 errors.** 3 warnings on changed files: the pre-existing `console.log` in `main.ts` and 2 `no-explicit-any` in the test (repository style). Whole API: 0 errors, 254 warnings |
| 5c | Coverage of `src/common/trusted-proxy.ts` | **100%** statements, branches, functions and lines (threshold 80%) |
| 6 | Diff audit vs `main` | **PASS:** 6 files (+442/−1) before this report. No path under compose, Traefik, `infra/`, `.github/`, migrations, subscriptions, webhooks, Stripe, gifts, checkout, web or mobile |
| — | CI on PR #61 | **NOT RUN locally.** It runs on GitHub. Expected **red** on the pre-existing coverage gates (Checkpoint V §10: last 40 CI runs failed) |
| — | Web and mobile suites | **NOT RUN:** those packages are not changed |

**Environment note:** pnpm 10 again skipped bcrypt's build script. The same environment-only repair PA accepted for IV-F1 (bcrypt 5.1.1's own install script; identical binding hash) was applied in the new worktree. No tracked file changed.

**No security regression:**
- No change widens trust.
- With the variable unset (all environments), `applyTrustedProxy` leaves Express at "trust nothing" and logs one info line.

## 5. Exclusion confirmations

- **Financial:** no G-1 Checkout-status code, Stripe, payment, subscription, webhook, token, gift, D1–D6/T-1, pricing UI, Noetia+/NoetiaX or PR #59 public-site change. No migration or business rule.
- **Infrastructure:** no `docker-compose.server.yml`, Traefik compose or static config, `noetia_api_edge`, `init.sh`, network script, `.env.production` or CI/CD change.
- **Authentication:** implementation unchanged; tests use it as-is.
- **Operations:** no production, staging or backup SSH. No Docker command. No merge, deployment or activation. PR #59, #60, #26 and #28 are unchanged.

## 6. Known limitations

1. **The behaviour is only meaningful after B-2.** Merged alone, B-1 is inert: rate limits stay shared per proxy address, exactly as today.
2. The integration suite exercises trust and throttling through a **test-only** controller. The real 30/min Checkout-status route is verified by G-1's suites on PR #60.
3. Duplication: PR #60 still contains the same G1-I1 commits. When the stack is integrated later, it must absorb these identical changes (Checkpoint V §5.2; a future decision).
4. CI is not a usable signal (pre-existing red), so local evidence and PA review are the qualification basis.
5. The residual risks from Checkpoint IV and V are unchanged and apply at B-2:
   - **R-05 is NOT VERIFIED** with the real Docker provider;
   - the exact-two-member invariant is a point-in-time operational safeguard, not proof of identity;
   - recreation gaps are expected.

## 7. Remaining B-2 prerequisites (Checkpoint V §11, §15, §17: none closed here)

- PA review of Checkpoint V, and PO decisions D-V1…D-V4.
- PO-operated read-only preflight P-1…P-14, in particular:
  - the live `/opt/traefik/docker-compose.yml` capture (U3);
  - subnet, route and Tailscale revalidation (U8);
  - live `/opt/noetia` HEAD and cleanliness;
  - the Traefik image version.
- A Stage B-2 change rewritten against the then-landed Traefik compose (PR #26 conflict, Checkpoint V §7.1).
- A separate infrastructure rollout authorization (Phase B + B-2 window); API egress verified in-window.
- **Merge of B-1 itself** requires an explicit PO instruction naming Stage B-1. That merge is a production deploy (no behaviour change expected; normal API recreation gap).

**All production and financial release gates remain closed.**

## 8. STOP

**STOP for independent Product Architecture review.** No merge, no deployment, no Stage B-2 activation. PR #61 stays Draft.
