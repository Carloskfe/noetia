# G1-I1 Checkpoint IV: bounded local implementation and security qualification

| | |
|---|---|
| **Mission** | G1-I1 / Checkpoint IV: Bounded Local Implementation and Security Qualification (PO authority; prepared by PA) |
| **Repository / PR** | `Carloskfe/noetia`, PR #60 (Draft), stacked on PR #59 (Draft, unchanged at `e326b81`) |
| **Starting HEAD** | `cc448a7a695081b3a2e16c99645019abc60b405c` (verified = expected; Draft, unmerged) |
| **Commits** | `b304516` feat(api) · `5fe5d5a` chore(infra), prepared only · `a4d82bf` test(infra) harness · `6fb9305` docs · this report's commit |
| **Verdict** | **Implemented and locally qualified, with two documented gaps: NOT fully qualified** (§7). Inactive everywhere until separately authorized. **STOP for independent PA review.** |

**Specifications:**
- [Checkpoint II design](g1-trusted-proxy-correction-design.md)
- [Checkpoint III live verification](g1-trusted-proxy-live-verification.md)
- [Checkpoint I](g1-checkpoint-i/README.md)

**Evidence:** [`g1-checkpoint-iv/`](g1-checkpoint-iv/) (sanitized raw output). **Harness:** [`infra/tests/trusted-proxy/`](../../../infra/tests/trusted-proxy/).

---

## 1. Baseline and environment

| Check | Result |
|---|---|
| PR #60 | Draft, unmerged, `cc448a7` = expected |
| PR #59 | `e326b81`, unchanged |
| PR #26 / #28 | `02c98f7` / `35ab50b`, both Draft, unmerged, unchanged. #26 edits `infra/server/traefik/docker-compose.yml` (`proxy_staging`); #28 edits no Traefik file |
| Governance read | `CLAUDE.md`, `docs/engineering-missions/README.md` (authorization levels, infrastructure authorization, repository hygiene), Checkpoint I–III documents |
| Docker engine | **Local:** context `default`, `unix:///var/run/docker.sock`, `DOCKER_HOST` unset, no SSH context; host `<local-dev-vm>` (Ubuntu 26.04, Docker 29.9.3). Production is Ubuntu 24.04 / Docker 29.4.3, so this is a different daemon. |
| Collision check | No `g1q4*` resources; no local network or route in `10.211.0.0/16`; local subnets 172.17–172.21 |
| Ownership inventory | [`g1-checkpoint-iv/OWNERSHIP.md`](g1-checkpoint-iv/OWNERSHIP.md), written **before** creating anything |

## 2. Changed files

| File | Change |
|---|---|
| `services/api/src/common/trusted-proxy.ts` | **New.** `parseTrustedProxyCidrs` and `applyTrustedProxy` |
| `services/api/src/main.ts` | +1 import, +1 call (`applyTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS, new Logger('TrustedProxy'))`) |
| `services/api/tests/unit/common/trusted-proxy.spec.ts` | **New.** 53 unit tests |
| `services/api/tests/unit/common/trusted-proxy.integration.spec.ts` | **New.** 26 in-process HTTP tests |
| `docker-compose.server.yml` | API: `proxy` → external `noetia_api_edge`; label `traefik.docker.network=noetia_api_edge`; header notes. **Prepared, not applied.** |
| `infra/server/traefik/docker-compose.yml` | Networks `proxy`, `proxy_staging` (live and identical to PR #26), `noetia_api_edge`. **Prepared, not applied.** |
| `infra/server/noetia-api-edge-network.sh` | **New.** `ensure` / `check` / `members`: exact-IPAM creation and validation, with a STOP on mismatch |
| `infra/server/init.sh` | Calls the helper's `ensure` (not executed) |
| `infra/tests/trusted-proxy/*` | **New** disposable harness (README, `upstream.ts`, `client.mjs`, `traefik-static.yml`, `render-dynamic.sh`, R-02 fixtures) |
| `.env.example`, `CLAUDE.md`, `docs/incident-response.md` | `TRUSTED_PROXY_CIDRS`, the invariant, sequencing, and the §1a playbook (502/504, diagnostics, rollback) |
| `docs/reports/payment-lifecycle-20261112/g1-checkpoint-iv*` | This report and its evidence |

**Not changed:**
- `traefik.yml` and the global Traefik provider network;
- the Checkout-status controller and service;
- Stripe, webhooks, tokens, subscriptions, book ownership, gifts, entitlements;
- authentication and JWT;
- rate-limit values;
- migrations, the web app, mobile and Noetia+/NoetiaX;
- PR #26, #28 and #59.

## 3. Implementation summary

**Parser** (`parseTrustedProxyCidrs`):
- **Accepts** 1–4 explicit `address/prefix` CIDRs: IPv4 prefix ≥ /24, IPv6 ≥ /112 (the Checkpoint II policy, no deviation).
- **Rejects:**
  - unset or empty values, and empty entries;
  - Express keywords (`loopback`, `linklocal`, `uniquelocal`), `true`/`false`, hop counts;
  - bare addresses, netmask notation, hostnames;
  - invalid addresses, prefixes out of range or too broad;
  - IPv4-in-IPv6 CIDR notation;
  - more than 4 entries.
- **Every rejection means trust disabled.** Missing configuration never means "trust private networks". No DNS, no Docker socket, no secret.

**Application** (`applyTrustedProxy`):
- Calls Express `app.set('trust proxy', cidrs)` only with a validated list; never throws.
- If Express itself rejects the value, it reports disabled.
- Logs one line: informational when unset (local dev stays quiet), WARN when invalid. The text contains only the configured ranges.

**Effect:** Express honours `X-Forwarded-For` only when the **TCP peer** is in the trusted range, and then uses the **rightmost** entry, the one Traefik appends. Every other peer is tracked by its own address. The throttler is unchanged:
- Checkout-status: **30 / min / client IP**;
- other routes: **120 / min / client IP per route handler**;
- in-memory store, no Redis.

## 4. Final proposed network configuration (prepared, not applied)

| | Value |
|---|---|
| Network | `noetia_api_edge`: bridge, `--internal`, IPv4-only, external, created by the helper |
| Subnet / gateway / allocation range | `10.211.75.0/28` / `10.211.75.1` / `10.211.75.8/29` (a qualified candidate, re-verify before creation) |
| Members | `traefik` and the production API **only** (`noetia-api-1`) |
| API networks | `noetia_net` (internal callers, unchanged) and `noetia_api_edge` |
| API label | `traefik.docker.network=noetia_api_edge`; all routers and middlewares preserved (compose-validated) |
| Traefik networks | `proxy`, `proxy_staging`, `noetia_api_edge` |
| API env | `TRUSTED_PROXY_CIDRS=10.211.75.8/29` (production only, after the network and Traefik attachment exist) |

## 5. Test results

**Fixtures:**
- **U:** unit tests.
- **H:** in-process HTTP integration. Real throttler, real Checkout-status controller and JWT guard, real `applyTrustedProxy`, a dual-stack listener, and peers from distinct loopback addresses.
- **D:** disposable Docker with real `traefik:v2.11` (production entrypoint defaults). Clients are on an "ext" network; the shared, staging, internal and edge networks mirror the live topology, including AutoGuildX-like containers and an impostor with the aliases `api`/`g1q4-api`.

Raw D output: [`g1-checkpoint-iv/evidence.txt`](g1-checkpoint-iv/evidence.txt).

### 5.1 T-I1-01 … T-I1-12

| ID | Test | Fixture | Result | Key evidence |
|---|---|---|---|---|
| T-I1-01 | Independent client buckets | H, D | **PASS** | D: client A 30 × 200 (remaining 29→0); client B 30 × 200 starting at **29** (own bucket); A's 31st 429 |
| T-I1-02 | Per-client exhaustion | H, D | **PASS** | 1–30 succeed, the 31st returns 429; `X-RateLimit-Remaining-global` 29…0; `Retry-After-global: 60` |
| T-I1-03 | External spoofing through Traefik | D | **PASS** | Rotating values, several header lines, comma lists, malformed/empty/invalid values, and claims of trusted-range addresses: always the real client IP; the 31st returns 429 |
| T-I1-04 | Direct internal access (E5 regression) | H, D | **PASS** | Web and monitor direct calls: `req.ip` = their own `noetia-net` address even with forged headers (including a trusted-range address); rotating headers → the 31st returns 429 |
| T-I1-05 | Shared-network isolation | D | **PASS** (+ observation) | AGX-like containers: `api` resolves to the **impostor**; the API's edge and `noetia-net` addresses **time out**; via Traefik they're attributed to their own proxy address. Traefik routes to the real API despite the impostor aliases (address-based). Staging is isolated and working. *Observation:* name ambiguity on the shared network (S19 class) is pre-existing and is addressed by NEM-018 (§10). |
| T-I1-06 | Traefik restart | D | **PASS** | New `StartedAt`; edge `.8` kept; exactly 2 members; per-client buckets correct on 30/min and 120/min; internal still untrusted; staging OK |
| T-I1-07 | Restart / recreation / dynamic allocation | D | **PASS**; negative control documents the boundary | §6 |
| T-I1-08 | Invalid and stale configuration | U, H, D | **PASS** | U: 37 rejection cases. H: 9 invalid values boot with no trust. D: a stale `10.211.75.0/30` gives a shared bucket (today's behaviour, never wider); `true` gives a WARN, the API boots, nobody trusted |
| T-I1-09 | IPv4 / IPv6 | U, H, D | **PASS (local)** | `::ffff:127.0.0.2` matches `127.0.0.2/32`; peer `::1` doesn't match an IPv4 range; IPv6 CIDR policy enforced. D: Traefik's peer appears as `::ffff:10.211.75.x` and matches `10.211.75.8/29`. **Production IPv6 ingress (U1/U2) is not resolved by local tests.** |
| T-I1-10 | Authentication regression | H + existing suites | **PASS with one suite BLOCKED** | H: forged headers from trusted and untrusted peers still get 401 without a JWT; a valid JWT behaves exactly as before. `checkout-status.contract.spec.ts` and `subscriptions-auth.contract.spec.ts` pass. **`tests/unit/auth/auth.controller.spec.ts` did NOT run:** it fails to load (`Cannot find module …/bcrypt_lib.node`), the pre-existing environment issue already present at the baseline in Checkpoints G-1 and I. **Classified BLOCKED, not passed.** |
| T-I1-11 | G-1 payment-verification regression | Existing suites | **PASS** | Checkout-status service and contract suites (uniform 404, ownership, read-only, `no-store`, R1-B, G-b) pass, as does the web suite (597/597, including the success-page, G1-I2 sign-in and gift-isolation tests) |
| T-I1-12 | Financial scope isolation | Diff audit + suites | **PASS** | No changed file under subscriptions, webhooks, tokens, gifts, library, auth, migrations, checkout-status or the web app. Webhook, subscription, payment-lifecycle and fulfillment-ledger suites pass (focused run 477/477) |

### 5.2 R-01 … R-09 (disposable rollout rehearsal)

| ID | Initial state → operation | Observed | Expected | Result | Residual risk |
|---|---|---|---|---|---|
| R-01 | Live-like (API on `proxy`, Traefik on ext/proxy/staging) → helper `ensure`, `docker network connect` Traefik, recreate API on edge | Network created with exact IPAM (idempotent second run). Traefik attached **without restart** (same `StartedAt`) and got `.8` ∈ R; staging attachment kept. After the switch, clients are attributed individually. **Monitor (200 ms):** Noetia route 728/731 OK, **3 failures in 3.2 s** (502 and 504 from the API recreation gap, plus one 404 artifact); staging 733/744 OK, 11 × 404 in 2.0 s (artifact) | Order works; any gap limited to the API recreation | **PASS** | **Not zero-downtime:** an API recreation gap exists, as in every deploy. The 404s came from the harness rewriting the route file in place, a file-provider artifact that production's Docker provider doesn't have; fixed with an atomic write and absent in R-08. |
| R-02 | Disposable compose project running → `up -d` with a missing external network | `network … declared as external, but could not be found` (exit 1); the **same container ID and `StartedAt`, still running** | No replacement of the running service | **PASS** | Production CD uses `up -d --build`; build-vs-network-check order not tested (the running service is not replaced either way) |
| R-03 | Four misconfigured networks + a missing one → helper `ensure`/`check` | STOP (exit 1) for wrong subnet, no allocation range, not internal, wrong gateway, and missing network; nothing created or modified | Reject, never "fix" | **PASS** | — |
| R-04 | Target state → disconnect Traefik from edge | Noetia route **504** (harness 3 s dial timeout; production default 30 s); staging and internal calls OK. `docker network connect` recovers immediately | Routing failure; documented recovery works | **PASS** | Real outage mode until reattached or rolled back; prevented by ordering plus the pre-merge check |
| R-05 | Target state → route to an address Traefik can't reach (wrong-label simulation) | Once applied, **every request 504**; restored → 200 | Routing failure | **PASS (simulated)** | **Not exercised with the Docker provider** (it needs the Docker socket, prohibited). The `traefik:v2.11` binary contains "Could not find network named" / "Defaulting to first available network", so a wrong label falls back to the container's *first* network, which is non-deterministic. The label and networks must change in one commit. |
| R-06 | Target state → internal callers | Web and monitor reach `api:4000` over `noetia-net`, attributed to their own addresses | Internal access preserved | **PASS** | — |
| R-07 | All states → staging route + prepared compose | Staging answered 200 in every state; the prepared Traefik compose lists `proxy_staging` (validated) | Staging preserved | **PASS** | The live `/opt/traefik/docker-compose.yml` content is still unverified (U3) |
| R-08 | Target state → API back on `noetia-net` + `proxy`, no trust, route via `proxy` | Reachable; attribution back to Traefik's address (pre-change); internal and staging OK. **Monitor:** 282/284 OK, **2 failures in 3.0 s** (the API recreation gap); no 404s | Prior routing restored | **PASS** | Rollback also has a recreation gap |
| R-09 | All owned resources → explicit-name removal | 0 `g1q4*` containers and networks remain; the 7 pre-existing networks are unchanged | Only owned resources removed | **PASS** | — |

### 5.3 Other validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` (api) | 0 errors |
| ESLint (changed API files) | 0 errors, 2 `no-explicit-any` warnings (in tests; repository style) |
| `npm run build` (api) | OK, `dist/common/trusted-proxy.js` emitted |
| Full API suite `npx jest --maxWorkers=2` | **1374/1374 tests pass; 77/78 suites.** `auth.controller.spec.ts` **BLOCKED** (bcrypt binding, pre-existing). [`api-full.txt`](g1-checkpoint-iv/api-full.txt) |
| Focused API (trusted-proxy, checkout-status, subscriptions-auth, webhooks, subscriptions, payment-lifecycle, ledger) | **477/477**. [`api-focused.txt`](g1-checkpoint-iv/api-focused.txt) |
| Full web suite | **597/597**, 30/30 suites. [`web-full.txt`](g1-checkpoint-iv/web-full.txt) |
| Traefik compose `config -q` | Valid: `proxy`, `proxy_staging`, `noetia_api_edge`, all external |
| Server compose `config --no-interpolate -q` | Valid (full interpolation needs production secrets, which were deliberately not supplied). The resolved API networks and label are correct; web/storage/worker/db/prometheus are unchanged |
| Shell syntax (`bash -n`) | Helper, `init.sh` and `render-dynamic.sh` OK; `shellcheck` not installed (not run) |
| `init.sh` | **Not executed** (it would install packages and configure the firewall); its network step is tested through the helper |
| CI | **Did not run** (stacked PR). All results are local. |

## 6. Address allocation and recreation evidence (T-I1-07)

| State | Traefik | API | In `R = 10.211.75.8/29`? | Gateway `.1` outside R | Traefik trusted / others untrusted / route OK |
|---|---|---|---|---|---|
| 1 Initial attachment | .8 | .9 | yes | yes | yes / yes / yes |
| 2 Traefik restart | .8 | .9 | yes | yes | yes / yes / yes |
| 3 Traefik recreation | .8 | .9 | yes | yes | yes / yes / yes (first request 404 while Traefik was still loading routes) |
| 4 API restart | .8 | .9 | yes | yes | yes / yes / yes |
| 5 API recreation | .8 | .9 | yes | yes | yes / yes / yes (502 until the API finished starting: recreation gap) |
| 6 Each recreated separately | = states 3 + 5 | | yes | yes | yes |
| 7 Combined, reverse order | **.9** (changed) | **.8** | yes | yes | **yes, without any config change** / yes / yes; per-client 30 then 429 |
| Static `--ip 10.211.75.3` (outside R) | — | — | no | — | **Untrusted** (`req.ip` = `.3`); the membership check STOPs |
| **Negative control:** unauthorized container attached normally | — | — | **yes (.10)** | — | **TRUSTED:** a forged client IP was accepted, and 35/35 rotating requests evaded the limit. The membership check STOPs: `members are [g1q4-api g1q4-rogue g1q4-traefik], expected exactly [g1q4-api g1q4-traefik]` |

**Conclusion:**
- Docker allocated every member inside R in every state, and the trusted set never widened through restart or recreation.
- **The CIDR model cannot tell an edge-network member from Traefik** (negative control). The security boundary is therefore **network membership: exactly `traefik` + the API**. It must be verified with `noetia-api-edge-network.sh members traefik noetia-api-1` at every deploy and after any Traefik or API recreation.
- Joining the network requires Docker control on the host. That is a procedural control (code review of compose files plus the membership check), not a technical one.

## 7. Qualification status and limitations

**Not fully qualified, for two reasons:**
1. **T-I1-10:** `auth.controller.spec.ts` is **BLOCKED** (it can't load because the `bcrypt` native binding isn't built in this worktree; the same failure exists at the baseline). Everything else that T-I1-10 requires passed. Closing this needs the suite run in an environment with bcrypt built, for example CI or a rebuilt local binding; no code change.
2. **R-05:** the wrong-label outcome was **simulated** with the file provider. The Docker provider's fallback was established from the Traefik binary, not exercised, because exercising it requires mounting the Docker socket, which is prohibited.

**Other limitations:**
- **Harness differences:** file provider instead of the Docker provider, a 3 s dial timeout instead of 30 s, plain HTTP, and clients on a Docker network instead of published ports. These affect timing and routing mechanics, not trust evaluation, which runs the real code.
- **Live ingress:** production published-port and IPv6 behaviour (U1/U2), whether Traefik sees real client addresses on the server, and the live `/opt/traefik/docker-compose.yml` (U3) remain unverified locally.
- **IP-based limits:** IPv6 clients are tracked per /128, and clients behind a shared NAT share buckets. This is inherent to IP-based limits and unchanged by this mission.
- **Availability:** every API recreation (deploy or rollback) shows a short gap (about 3 s in the harness). **No zero-downtime claim.**

**No STOP gate was triggered:**
- The negative control is the documented boundary: an edge-network member, which needs Docker control. Arbitrary internal containers were shown to be untrusted.
- No gateway was trusted, there was no range overlap, and no DNS identity was used.
- Staging was preserved, and no financial or authentication change was needed.

## 8. Threat-model results (observed)

| Actor | Result |
|---|---|
| External customer | Attributed to their real IP; own 30/120 buckets |
| External customer forging `X-Forwarded-For` (single, multiple, malformed, trusted-range) | Discarded by Traefik; real IP used; cannot evade (T-I1-03) |
| Noetia internal container (web, monitor) | Untrusted; tracked by its own address; forged headers ignored (T-I1-04) |
| AutoGuildX-like container on `proxy` | Can't reach the API directly (timeouts); via Traefik it's attributed to its own address (T-I1-05) |
| Impostor with aliases `api` / `g1q4-api` on `proxy` | Doesn't capture Traefik's API route (address-based); captures name lookups only from the shared network (pre-existing S19 class) |
| Static peer outside R on the edge network | Untrusted |
| Unauthorized container joined to the edge network | **Trusted.** Mitigated only by the membership invariant and its check |
| Traefik after restart, recreation or address change | Still trusted; the trusted set doesn't widen |
| Stale or invalid configuration | Trust disabled, shared buckets (today's behaviour) |
| Authentication | Unchanged: 401 without a JWT regardless of forwarded headers |

## 9. Production rollout prerequisites (none authorized here)
1. Independent PA review of this checkpoint, and closure of the two gaps in §7, or explicit acceptance of them.
2. Reconcile the production Traefik compose with the repository; it must keep `proxy_staging` (U3).
3. Re-verify that `10.211.75.0/28` is free on the server: V1/V2 checks plus Tailscale routing tables (U8).
4. Decide the PR #26 / #28 / G1-I1 sequence (§10).
5. A separate infrastructure rollout authorization, then this order:
   - `noetia-api-edge-network.sh ensure` on the server;
   - `docker network connect noetia_api_edge traefik` (live);
   - `members traefik` (before the API joins, only Traefik should be a member: verify);
   - set `TRUSTED_PROXY_CIDRS=10.211.75.8/29` in `.env.production` (nano);
   - persist `/opt/traefik/docker-compose.yml` (nano; **no `compose up`**);
   - merge (merge = CD deploy).
6. **Post-deploy:**
   - `members traefik noetia-api-1` returns exactly 2;
   - the API log shows the `[trusted-proxy]` line;
   - two different client networks show independent `X-RateLimit-Remaining-global`;
   - `/api/health` returns 200;
   - staging still answers.
7. **Rollback** as in `docs/incident-response.md` §1a. Expect a recreation gap.
8. **Unchanged release gates:** G-1 financial release gates, W-1, W-2, Stripe production configuration, the other payment-lifecycle gates, and NEM-024 qualification. **None is closed by this checkpoint.**

## 10. PR #26 / #28 coordination

**PR #26 (NEM-017):** its only Traefik-file change is adding `proxy_staging`. This branch's prepared Traefik compose contains the **same declaration**, matching the live attachment. Whichever lands first, the other's hunk becomes a no-op or a trivial rebase. PR #26 is based on `nem-006a-staging`, not `main`, so integration order must be decided by the PO.

**PR #28 (NEM-018):** no Traefik-file change in the PR. Its runbook proposes adding `proxy_agx` later. When it lands, that entry is added alongside `noetia_api_edge`. NEM-018 also removes the pre-existing name ambiguity on `proxy` seen in T-I1-05.

**Recommended order (unchanged from Checkpoint III):** reconcile NEM-017, then NEM-018, then the G1-I1 rollout. G1-I1 does not depend on NEM-018 for correctness.

## 11. Confirmation
- **No production, staging or AutoGuildX access or change.** No live Docker network changed. `TRUSTED_PROXY_CIDRS` is not set anywhere live. `init.sh` was not executed.
- **Local Docker:** only the inventoried `g1q4*` disposable resources were created, and all were removed by explicit name (R-09). No prune, no socket mount, no published ports.
- **No merge or deployment.** PR #60 remains Draft; PR #59, #26 and #28 are unchanged.

**STOP: independent PA review required before any part of this is considered qualified.**
