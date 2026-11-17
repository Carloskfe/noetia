# G-1 Checkpoint I: findings G1-I1 (diagnostic) and G1-I2 (wording correction)

| | |
|---|---|
| **Mission** | G-1 / Checkpoint I: G1-I1 Traefik and rate-limit investigation (**read-only diagnostic**) and G1-I2 authentication-wording correction (**bounded implementation**), PO authority with PA review. The local reproduction was run under the separate PA/PO authorization for revised steps 1–11. |
| **Repository / PR** | `Carloskfe/noetia`, PR #60 (Draft), stacked on PR #59 (Draft, unchanged at `e326b81`) |
| **Initial HEAD** | `b66485795906c0f1fba2041eaeac3f930d3a36ab`: verified = expected; Draft, unmerged; no concurrent G-1 work |
| **Status** | G1-I1: diagnosis complete, **correction NOT implemented** (needs PA/PO authorization). G1-I2: implemented and tested locally. CI did not run (stacked PR). STOP for PA review. |

---

## A. G1-I1: Traefik and rate-limit diagnostic (no correction made)

### A.1 Verified topology (repository configuration)

| Element | Evidence | Finding |
|---|---|---|
| Edge proxy | `infra/server/traefik/docker-compose.yml`, `traefik.yml` | `traefik:v2.11`, publishes `80:80` and `443:443`, on the external Docker network `proxy`. The `websecure` entrypoint has **no `forwardedHeaders` settings** (no `trustedIPs`, no `insecure`), which is Traefik's default: client-supplied `X-Forwarded-*` headers are not trusted. |
| API routing | `docker-compose.server.yml` labels | `noetia.app` + `PathPrefix(/api)` → `noetia-api` service on port 4000 (`stripprefix /api`); `traefik.docker.network=proxy` |
| API exposure | `docker-compose.server.yml` | The API has **no published host port**. It is reachable only from containers on `noetia_net` (web, worker, image-gen and the rest of the stack) and on `proxy` (Traefik and any other project attached to it, such as AutoGuildX or staging) |
| Browser → API path | `.env.example` `NEXT_PUBLIC_API_URL=/api` | The success page calls `/api/...` same-origin, so browser → Traefik → API: **one proxy hop** |
| CDN | `CLAUDE.md` (Cloudflare "DNS-only, gray cloud") | No CDN hop is configured. *Not verified live* |
| Server-side calls | `services/web/app/s/[id]/page.tsx` (`http://api:4000`) | The web container calls the API directly, without a proxy and without `X-Forwarded-For` |
| API client-IP resolution | `services/api/src/main.ts` | No `trust proxy` setting. Express `req.ip` = the TCP peer = Traefik's container address |
| Throttler | `@nestjs/throttler` **6.5.0** (`node_modules/@nestjs/throttler/dist/throttler.guard.js`) | Default tracker `getTracker(req) { return req.ip; }`. Bucket key = `sha256(Class-handler-throttlerName-tracker)`. One throttler, `global`, at 120/min (`app.module.ts`). The G-1 route overrides it to 30/min |
| Staging | Not in this branch | Staging compose and its Traefik attachment could not be inspected here |

**Correction to the G-1 implementation report (§7 R-1):** the "global 120/min" limit applies **per route handler** per tracker, not across the whole API. The G-1 route has its own 30/min bucket.

### A.2 Local reproduction (observed)

**Setup:**
- a real `traefik:v2.11`, with the same entrypoint defaults as production;
- an upstream with the API's exact throttler configuration (`@nestjs/throttler` 6.5.0);
- two client containers with distinct addresses (172.22.0.4 and 172.22.0.5).

Everything ran on an isolated disposable network, with no published ports and no Docker socket mount, and was removed afterwards. Raw output: [`i1-evidence/g1i1-repro.out.txt`](i1-evidence/g1i1-repro.out.txt). Scripts: [`i1-evidence/`](i1-evidence/).

The upstream ran in three modes:
- **none:** no proxy trust, the API's current setting;
- **restricted:** trust exactly the first hop, and only when it is a private address;
- **unrestricted:** `trust proxy: true`.

| Exp. | What was tested | Observed |
|---|---|---|
| E1 | What the upstream sees through Traefik, with a forged `X-Forwarded-For: 6.6.6.6` | Traefik **dropped the forged value** and set `X-Forwarded-For` (and `X-Real-Ip`) to the real client address. With **no trust**, `req.ip` = **Traefik's address for every client**. With restricted trust, `req.ip` = each client's own address |
| E2 | G-1-style route (30/min): client-a sends 20, then client-b sends 11 | **No trust:** client-b was blocked on its **11th** request (31st overall), so **one bucket is shared by all clients**. **Restricted:** client-b got 11/11, and client-a was blocked only at its own 31st |
| E3 | Any other route (120/min): client-a sends 60, then client-b sends 61 | **No trust:** client-b was blocked on its 61st (121st overall), so it is **shared too**. **Restricted:** 61/61. Buckets are per handler: client-a's 60 requests to `/other` all succeeded although the same tracker had exhausted the 30/min route |
| E4 | Rotating forged `X-Forwarded-For` **through Traefik** (restricted) | No evasion: client-b's real bucket went 11 + 19 = 30, then 429 |
| E5 | Rotating forged `X-Forwarded-For` **bypassing Traefik**, direct to the upstream from another container (restricted) | **Evasion possible:** 35/35 accepted, because the internal peer chooses its tracker. Restricted trust takes the last (rightmost) entry; unrestricted takes the first (client-controlled) entry. With no trust, forged headers are ignored |

### A.3 Conclusions: observed vs assumed

**Demonstrated locally:**
- With the current API configuration behind Traefik v2.11, the throttler keys **every external client by Traefik's address**.
- So the G-1 route's **30/min** is shared by all users reaching that API instance.
- So is every other route's **120/min** (per route handler).
- The throttler storage is in memory per process: one bucket set per API instance.
- G-1 polling (up to 11 requests per buyer in about 30 s) means **roughly 3 concurrent buyers** can exhaust the route. Buyers then see D2 `unavailable` ("We can't verify your purchase right now"). That is safe but degraded.
- Other routes that aren't `@SkipThrottle`'d (the library and fragments controllers are) have the same pre-existing exposure at 120/min per route.

**Inferred, not verified (production access not authorized):**
- Production behaves the same, inferred from the repository's Traefik and compose files. The live `/opt/traefik/traefik.yml` was not inspected and could differ from the repository.
- The address Traefik itself sees for clients depends on how the Docker daemon handles published ports:
  - iptables DNAT preserves the client address;
  - Docker's userland proxy, for example for IPv6 clients without ip6tables, would show a Docker gateway address for those clients.

  Not verified.
- No CDN hop exists in front of Traefik (Cloudflare DNS-only per `CLAUDE.md`). Not verified live.

**Spoofing analysis:**
- **From the internet:** forged forwarding headers are discarded by Traefik's default entrypoint configuration (E1, E4). Restricted trust therefore does **not** let internet clients choose their tracker. That holds only while the entrypoint keeps the default: no `forwardedHeaders.insecure`, and no `trustedIPs` covering client ranges.
- **From inside:** any container that can reach `api:4000` directly could forge its tracker under any trust setting (E5):
  - containers on `noetia_net`;
  - containers on the shared `proxy` network, including other projects.

  Impact: such a container could evade or pollute rate limiting. It gains no authentication or authorization (JWT is still required). **Unrestricted `trust proxy: true` must not be used**: it takes the leftmost, client-controlled entry.

### A.4 Options

| Option | Fixes the G-1 route | Fixes other routes | Change surface | Spoofing exposure | Verdict |
|---|---|---|---|---|---|
| **1. Restricted proxy trust:** in `main.ts`, `set('trust proxy', (addr, i) => i === 0 && isPrivate(addr))`, so exactly one trusted hop, and only a private (Docker) peer | Yes | Yes | One line plus a test; shared runtime config | Internet: none (Traefik strips). Internal containers can forge (E5) | **Recommended** |
| 1b. Trust only Traefik's exact address | Yes | Yes | Needs a static IP or subnet for Traefik on `proxy`: an **infrastructure** change | Internal forging limited to Traefik | Later hardening |
| 2. Authenticated-user tracker for the G-1 route only | Yes | No | The global `ThrottlerGuard` runs **before** `JwtAuthGuard`, so `req.user` is not set. It needs JWT decoding in the tracker (unverified decode lets forged tokens rotate buckets) or a second, reordered throttler guard | Low | More code, one route only |
| 3. Raise the G-1 route limit | Partially (higher shared ceiling) | No | One line | None | Masks the issue |
| 4. Route-level tracker reading `X-Real-Ip` / `X-Forwarded-For` | Yes | No | One route | Same trust assumption as option 1, but scattered | Inferior to option 1 |

### A.5 Recommended bounded correction (NOT implemented; needs PA/PO authorization)

**Option 1, restricted proxy trust,** as its own small mission:
1. **Read-only production verification first**, authorized separately:
   - the live Traefik entrypoint config matches the repository (no `forwardedHeaders.insecure` or `trustedIPs`);
   - the Docker daemon's published-port mode (`userland-proxy`, IPv6/ip6tables);
   - whether `noetia.app` serves IPv6;
   - the API's peer address as seen in a read-only check.
2. **Change:** one `trust proxy` function in `services/api/src/main.ts`, trusting exactly one private first hop.
3. **Tests:** an in-process test that the throttler buckets per forwarded client behind one trusted hop, and ignores forwarded headers from a direct non-proxy peer where applicable.
4. **Document the boundary:** this is safe **because** Traefik discards client forwarding headers. Any future change to Traefik's `forwardedHeaders`, a CDN in proxied mode, or a second proxy hop requires revisiting the setting.
5. **Optional later hardening:** option 1b, which narrows internal forging (E5).

Until then the G-1 route stays at its current behaviour, which fails safe: no false payment, delivery or entitlement claim.

---

## B. G1-I2: neutral sign-in wording (implemented)

**Exact strings** (`services/web/lib/i18n/{en,es}.ts`, `billing.success.status.signInToVerify`):

| EN | ES |
|---|---|
| Please sign in to verify your purchase. | Inicia sesión para verificar tu compra. |

**Behaviour:**
- **Session flow `401`:** the single neutral sentence plus the existing "Sign in" / "Iniciar sesión" button.
  - The same sentence is used for subscription, token and book Checkout.
  - No heading.
  - No payment, fulfillment or entitlement claim.
  - The return link keeps `session_id` and a permitted `purchase`; other parameters are discarded and the id is URL-encoded.
- **No-session `auth` view:** unchanged ("Sign in to confirm your subscription…", link `/login?next=%2Fbilling%2Fsuccess`).
- **`?purchase=gift`:** unchanged; no request, signed in or not (G-b).
- **Other G-1 text:** the 13 PO-2 groups are unchanged (test-compared against design §R4.3).

**Documented** in the design as [§R4.11](../g1-checkout-verification-design.md#r411-follow-up-wording-decision-g1-i2-session-flow-sign-in-state-checkpoint-i-po-2026-11-14). The §R4.4 R-S14 row is marked superseded for the session flow, and the top banner notes the follow-up sentence.

**Browser evidence** (production build, headless Chromium, API requests answered 401 by in-browser interception; [`i2-evidence/screenshots/`](i2-evidence/screenshots/) with [`evidence.json`](i2-evidence/screenshots/evidence.json)):

| Case | EN / ES rendered | Headings | Sign-in link `next` | API calls |
|---|---|---|---|---|
| 401, token Checkout | "Please sign in to verify your purchase." / "Inicia sesión para verificar tu compra." | none | `/billing/success?session_id=…&purchase=tokens` | status, then refresh (refused) |
| 401, book Checkout | same | none | `…&purchase=book` | same |
| 401, subscription Checkout | same | none | `/billing/success?session_id=…` | same |
| 401 with `purchase=evil&next=//attacker.example` | same | none | `/billing/success?session_id=…` (extras dropped) | same |
| No session, 401 | existing title and body (unchanged) | existing | `/billing/success` | sync, then refresh (unchanged flow) |
| `?purchase=gift` signed out | existing generic gift copy | existing | — | **none** |

**Tests** (local; raw output in [`i2-evidence/`](i2-evidence/)):

| Run | Result |
|---|---|
| Focused: `npx jest tests/unit/app/billing tests/unit/lib/checkout-status.spec.ts tests/unit/lib/i18n.spec.ts --maxWorkers=2` | **233/233 pass**. New: G1-I2 describe (7 tests: exact strings; token, book and subscription × EN/ES; no outcome claim; extra parameters discarded; id encoding; gift no request), the no-session view asserted unchanged, and §R4.11 doc-vs-dictionary plus status-key set |
| Full web suite `npx jest --maxWorkers=2` | **597/597 pass**, 30/30 suites, including i18n parity |
| Web `npx tsc --noEmit`, `next lint` (changed files), `npm run build` | 0 errors; no warnings or errors; **compiled successfully** |
| Full API regression `npx jest --maxWorkers=2` | **1295/1295 tests pass; 75/76 suites.** `tests/unit/auth/auth.controller.spec.ts` **fails to load**, the same pre-existing environment failure as at the baseline (`bcrypt` native binding not built in this worktree). Not caused by this change; **not all suites are green.** |

---

## C. Changed files

| File | Change |
|---|---|
| `services/web/lib/i18n/en.ts`, `es.ts` | + `billing.success.status.signInToVerify` (G1-I2) |
| `services/web/app/(billing)/billing/success/page.tsx` | The session-flow `auth` state renders the neutral sentence plus the existing sign-in button (no heading); comment updated |
| `services/web/tests/unit/app/billing/success-session.spec.tsx` | 401 test updated; new G1-I2 describe |
| `services/web/tests/unit/app/billing/success-page.spec.tsx` | The no-session 401 test now also asserts the unchanged title and body |
| `services/web/tests/unit/lib/checkout-status.spec.ts` | §R4.11 doc-match and status-key-set tests |
| `docs/reports/payment-lifecycle-20261112/g1-checkout-verification-design.md` | §R4.11 added; §R4.4 R-S14 row marked; banner note |
| `docs/reports/payment-lifecycle-20261112/g1-implementation/README.md` | R-1 corrected (per-handler buckets) |
| `docs/reports/payment-lifecycle-20261112/g1-checkpoint-i/**` | This report plus I1 and I2 evidence |

## D. Scope verification

- **No financial writes and no API source change at all.**
- **Not changed:** `main.ts`, Traefik, global throttling, middleware, infrastructure, migrations, Stripe, webhooks, tokens, book ownership, subscriptions, trial eligibility, gifts, mobile, Terms and Privacy Policy, Noetia+/NoetiaX, PR #59.
- **Disposable resources,** all named `g1i1-*` and created in this session: four containers and one network. Ownership was verified before cleanup; they were stopped (auto-removed), then the network was removed; verified that none remain. The local `next-server` used for screenshots was stopped by its PID.
- **Isolation:** no production, staging or Docker-socket access; no host-published ports for the experiment.

## E. Remaining risks

- **G1-I1 correction pending a PA/PO decision** (§A.5). Until then, the G-1 route and every other throttled route share their limits across users behind Traefik. It fails safe.
- **Unchanged release blockers:**
  - W-1;
  - SG-PM, with W-2 item 1;
  - A5, the production Stripe webhook events;
  - Stripe production keys and configuration;
  - USD-1;
  - the Stripe portal check (D4);
  - the Terms review (OP-3);
  - G-4 and G-5.
- **Unchanged status:** E-1 stays OPEN/BLOCKED and Checkpoint E stays NOT QUALIFIED.
- **Earlier G-1 observations, unchanged:** O-1 to O-4 and R-3, R-5 to R-7.
- **CI did not run.** Every result here is local.

**STOP for independent PA review.** No merge, deployment or activation.
