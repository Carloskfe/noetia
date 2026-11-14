# G1-I1 Checkpoint II: trusted-proxy correction design

| | |
|---|---|
| **Mission** | G1-I1 / Checkpoint II: Trusted-Proxy Correction Design (PO authority; prepared by PA). Security architecture, **design only**. |
| **Repository / PR** | `Carloskfe/noetia`, PR #60 (Draft), stacked on PR #59 (Draft, unchanged at `e326b81`) |
| **Baseline** | PR #60 head `fc058b8770b71f35aa96cb750d1c6123bcbb97bc` = expected; Draft, unmerged |
| **Inputs** | [Checkpoint I report](g1-checkpoint-i/README.md) §A and its [raw reproduction](g1-checkpoint-i/i1-evidence/g1i1-repro.out.txt); [G-1 design](g1-checkout-verification-design.md) §R3/§R4; committed infrastructure files |
| **Status** | **Proposal for independent PA review.** Nothing implemented, nothing applied, no live access, no new experiments. |

**Evidence labels:**
- **[Source]**: verified from committed repository files.
- **[Local]**: demonstrated in the Checkpoint I disposable reproduction.
- **[Live?]**: not verified on the server. Requires the read-only plan in §9.
- **[Proposal]**: design, not implemented.

---

## 1. Baseline and governance

| Check | Result |
|---|---|
| PR #60 | `OPEN`, Draft, head `fc058b8` = expected |
| PR #59 | `OPEN`, Draft, head `e326b81`, unchanged |
| Governance | `CLAUDE.md` (mission governance; critical server operations: never paste multi-line content over SSH, Traefik config at `/opt/traefik/traefik.yml`) |
| Overlapping work | **No mission owns the API trust surface** (`main.ts`). **Coordination needed:** Draft PR **#26** (NEM-017, S19 staging isolation) edits `infra/server/traefik/docker-compose.yml` to attach Traefik to a dedicated `proxy_staging` network. The design below edits the **same file in the same way** (one more `networks:` entry). Draft PR **#28** (NEM-018) proposes moving AutoGuildX off `proxy`. Neither is merged or applied. This is not a STOP: the surfaces are compatible and additive, but the later implementation must rebase on whichever lands first (§11). |

## 2. Verified starting findings

**From committed source [Source]:**

| Item | Finding |
|---|---|
| Edge proxy | `infra/server/traefik/docker-compose.yml`: `traefik:v2.11`, publishes `80` and `443`, attached **only** to the external network `proxy`. `traefik.yml`: entrypoints `web` and `websecure` with **no `forwardedHeaders` settings**, so client-supplied forwarding headers are not trusted. |
| `proxy` network | Created by `infra/server/init.sh` as `docker network create proxy`, **with no explicit subnet** (Docker assigns one) |
| API container | `docker-compose.server.yml`: `api` on `noetia_net` **and** `proxy`; **no published port**. Label `traefik.docker.network=proxy`; routers `noetia-api` and `noetia-api-metrics`, both to service port 4000. |
| Other members of `proxy` (this repo) | Noetia `web`, Noetia `storage` (MinIO), Traefik. By design of the shared network, any other project attached to it (AutoGuildX today per NEM-018; staging until NEM-017) can also reach `api:4000`. |
| Legitimate internal API callers | `web` SSR (`services/web/app/s/[id]/page.tsx` → `http://api:4000`) and Prometheus (`infra/prometheus/prometheus.yml` → `api:4000`). Both are on `noetia_net`. **No legitimate caller uses the `proxy` network.** |
| API bootstrap | `services/api/src/main.ts`: no `trust proxy`. `app.listen(port)` binds the dual-stack wildcard, so IPv4 peers appear as `::ffff:a.b.c.d`. |
| Throttler | `@nestjs/throttler` 6.5.0: tracker `req.ip`; bucket key `sha256(Class-handler-name-tracker)`; one throttler `global` at 120/min; the G-1 route at 30/min |
| Express trust matching | `proxy-addr` 2.0.7 (used by Express): an IPv4 subnet matches IPv4-mapped IPv6 peers (`trustSingle` converts with `toIPv4Address()`). Invalid trust values throw `TypeError` at `app.set` time. |
| Other effects of `trust proxy` | Express would also honour `X-Forwarded-Proto` / `-Host`. **No API code reads them:** OAuth callbacks are absolute from `API_URL`, and the refresh cookie's `secure` flag comes from `NODE_ENV`. Nothing else reads `req.ip`. |

**Demonstrated locally [Local], in the Checkpoint I reproduction:**
- Traefik v2.11 with these defaults discards client `X-Forwarded-For` and sets it, along with `X-Real-Ip`, to the peer it saw.
- With no trust, every client shares one bucket per route.
- Trusting any private first hop separates clients, but **lets a container that bypasses Traefik choose its tracker** (E5).
- `trust proxy: true` takes the client-controlled leftmost entry.

**Not verified live [Live?]:**
- whether the server's Traefik configuration and attachments match the repository;
- the `proxy` subnet and every other Docker subnet on the host;
- Docker published-port handling (iptables vs userland proxy) and IPv6;
- whether `noetia.app` has an AAAA record;
- the absence of a CDN hop.

## 3. The core requirement and why the address space is the wrong anchor

The API sees only the TCP peer address (`req.socket.remoteAddress`). A Docker hostname is **not** a property of the socket: the API can't ask "is this peer the container named `traefik`?" without a DNS lookup or the Docker socket (not allowed).

So the peer must be identified by an address that **only Traefik can hold**. On today's topology there is no such address:
- Traefik's address on `proxy` is dynamic.
- `proxy` is shared with other projects' containers, and with Noetia's own `web` and `storage`.
- Its subnet is unpinned.

**Conclusion.** A safe trusted-peer rule needs one of:
- (a) a pinned address on a network where nobody else can take it;
- (b) a network on which Traefik is the **only** possible peer;
- (c) a secret that only Traefik presents.

## 4. Options

### Option A: static Traefik IP on the existing `proxy` network
- **Mechanism:** pin `ipv4_address` for Traefik and trust that /32.
- **Blocker:** Docker accepts a static address only on networks with a **user-configured subnet**, and `proxy` was created without one [Source: `init.sh`]. Adding one means **recreating `proxy`**, which detaches Traefik, Noetia `web`/`api`/`storage` and every other project on the host: a shared-infrastructure outage.
- **Further weaknesses:**
  - another container could request the same address while Traefik is down;
  - other projects stay on the same network.
- **Rejected:** disproportionate blast radius for the benefit.

### Option B: verified address resolution (DNS lookup of `traefik`)
- **Mechanism:** the API periodically resolves `traefik` and trusts the result.
- **Weaknesses:**
  - **Name impersonation on a shared network.** Any container on `proxy` can declare the alias `traefik`, and Docker DNS then returns several addresses. NEM-016/NEM-017 demonstrated exactly this class of cross-project name fall-through on `proxy` (S19).
  - **Stale cache window.** After Traefik is recreated, its old address can be reassigned to another container before the cache refreshes.
  - **New runtime machinery:** a resolver loop, caching, failure states.
- **Rejected:** it doesn't establish identity, and it adds moving parts.

### Option C: dedicated proxy-to-API network (recommended, §5)
- **Mechanism:** a new **internal** bridge network joined **only** by Traefik and the Noetia API, with an **explicit subnet and allocation range**. The API trusts forwarding headers only from that allocation range, and Traefik reaches the API over that network.
- **Identity** is enforced by Docker network membership and kernel routing, not by a name, a secret or a dynamic address.
- **Precedent:** the same pattern as NEM-017 (`proxy_staging`) and NEM-018 (`proxy_agx`): a dedicated external network, plus a live `docker network connect` for Traefik.

### Option D: alternatives considered
- **D1: shared-secret header.**
  - **Mechanism:** a Traefik `headers` middleware sets `X-Noetia-Edge: <secret>` (overwriting any client copy); a custom throttler tracker trusts `X-Real-Ip` only when the secret matches.
  - **Pros:** no network change; failure falls back to shared buckets.
  - **Cons:**
    - a new long-lived secret in `.env.production` and in container labels;
    - rotation duty;
    - leakage risk through request-header logging or error reporting;
    - identity proven by a bearer string rather than topology;
    - changes the **global** throttler tracker instead of Express's standard mechanism.
  - **Verdict:** not smaller in total risk or upkeep than C, so not preferred. It remains the fallback if PA rejects any network change (§12 Q5).
- **D2: authenticated-user tracker on the G-1 route only.** It fixes one route and leaves every other route pooled. The global guard runs before `JwtAuthGuard`, so it needs either unverified JWT decoding or guard reordering. **Rejected** (Checkpoint I §A.4).
- **D3: raise the limit.** It masks the problem, which the mission forbids. **Rejected.**

## 5. Recommended architecture: Option C, dedicated internal edge network

```
Internet ──443──► traefik (v2.11, forwardedHeaders default: strips client X-Forwarded-*)
                    │  proxy  (shared: web, storage, other projects)  ── unchanged for web/storage
                    │
                    └─ noetia_api_edge  (NEW: --internal, subnet S, allocation range R;
                         │               members: traefik + noetia api ONLY)
                         ▼
                       api ── noetia_net ── web (SSR), prometheus, worker, db, cache, …
                       (leaves `proxy`)
```

### 5.1 How the trusted peer is established and maintained
- **The network** `noetia_api_edge` is created once with an **explicit** subnet `S` and allocation range `R ⊂ S`, both chosen by the §9 check. Placeholder: `S = 10.211.75.0/28` (gateway `10.211.75.1`), `R = 10.211.75.8/29`. It is created with `--internal`: no NAT, no external routing.
- **Members:** Traefik (attached once, persisted in its compose file) and the Noetia API (attached by `docker-compose.server.yml`). Nobody else.
- **Routing:** the API's Traefik label becomes `traefik.docker.network=noetia_api_edge`, so Traefik connects to the API **from its address in `R`**.
- **Trust rule:** the API sets Express `trust proxy` to exactly `R` (from `TRUSTED_PROXY_CIDRS`). Express then uses the rightmost `X-Forwarded-For` entry only when the TCP peer is in `R`; for any other peer, forwarding headers are ignored and `req.ip` is the peer itself.
- **Why `R` rather than all of `S`:** the gateway `.1` belongs to the host bridge. Docker allocates container addresses only from `R` (`--ip-range`), so host processes connecting through the bridge (source `.1`) are not trusted.
- **Why not Traefik's /32:** Traefik's address in `R` may change on recreation, but `R` contains only Traefik and the API, so trusting `R` is equivalent to trusting "Traefik, wherever it lands". It needs no pinning, discovery or DNS.

### 5.2 Why another container cannot impersonate Traefik

| Attempt | Outcome |
|---|---|
| A container on `noetia_net` or `proxy` connects to `api:4000` and sends `X-Forwarded-For` | Its source address is in `noetia_net`'s subnet (or it can't reach the API at all, now that the API has left `proxy`). That isn't in `R`, so the header is ignored and the tracker is its own address. |
| The same container forges an IP packet with a source in `R` | Docker's inter-bridge isolation rules drop cross-bridge traffic. Even unfiltered, the TCP handshake's replies go to the real `R` address, so no connection is established. *[Inference from Docker/TCP behaviour; T-I1-05 makes it a test.]* |
| A container joins `noetia_api_edge` | Requires changing a compose file or running `docker network connect`, i.e. **Docker-daemon control, which is already host-root-equivalent** and outside this threat model. It is detected by the deploy check, which expects exactly two members (§8.3). |
| A host process connects through the bridge gateway `.1` | Not in `R`, so untrusted |

### 5.3 Dynamic addresses

| Event | Effect |
|---|---|
| Traefik restart | Usually keeps its address. Either way, the new address is in `R`, so it stays trusted. **The trusted set doesn't grow.** |
| Traefik recreation | A new address in `R` (dynamic allocation stays inside `--ip-range`). Still trusted; no other member exists. |
| Docker daemon restart | Networks and attachments persist; same as a restart |
| Network recreated | Must reuse the documented `S`/`R` command (runbook). A different subnet makes `TRUSTED_PROXY_CIDRS` **stale**, which fails safe (§5.6). |
| API recreation or redeploy | The API takes an address in `R`, harmless (it never connects to itself) |
| Several networks on the API | Only the peer address matters. Peers on `noetia_net` are untrusted by construction. |

### 5.4 IPv4 and IPv6
- **Inside Docker:** `noetia_api_edge` is created **without** `--ipv6`, so Traefik→API traffic is IPv4. Node reports the peer as `::ffff:10.211.75.x`, and `proxy-addr` matches IPv4-mapped peers against IPv4 ranges [Source]. T-I1-09 pins this.
- **Validation:** `TRUSTED_PROXY_CIDRS` accepts IPv6 ranges too (validated, minimum prefix /112) in case IPv6 is ever enabled on the network. Today it is IPv4 only.
- **External IPv6 clients:**
  - Behind this fix, `req.ip` is whatever client address Traefik recorded. If the site serves IPv6 [Live?], one customer could rotate addresses within their /64.
  - If Docker relays IPv6 through its userland proxy [Live?], Traefik sees a gateway address for every IPv6 client, so they share a bucket. No API-side trust setting can fix that.

  Both are documented open questions (§12 Q2/Q3), not assumptions.

### 5.5 Direct internal API calls
- `web` SSR, Prometheus and the worker reach the API over `noetia_net`. Their peer is untrusted, so the tracker is their own container address, exactly as today. No caller depends on the API being on `proxy` [Source].
- Containers of other projects lose direct reach to the Noetia API, which **removes** an S19-class exposure. This is the only reachability change.

### 5.6 Configuration loading, validation and failure behaviour [Proposal]

| Condition | Behaviour |
|---|---|
| `TRUSTED_PROXY_CIDRS` unset or empty (local dev, staging before adoption) | Trust disabled, which is **today's behaviour**: no spoofing, shared buckets behind a proxy. Logged once at boot at `log` level. |
| Invalid value: not a CIDR, an unparsable address, a keyword (`true`, `loopback`, `uniquelocal`, a hop count), an over-broad prefix (IPv4 < /24, IPv6 < /112), or more than 4 entries | Trust disabled, **WARN once** at boot (`[trusted-proxy] disabled: <reason>`). **The API still starts.** |
| Valid but **stale** (Traefik not in `R`) | Traefik's peer is untrusted, so behaviour is shared buckets, today's. No spoofing possible. Detected by the post-deploy check (§8.3). |
| Traefik unavailable | No external traffic reaches the API. Internal calls are unaffected. Nothing becomes trusted. |
| Traefik not attached to `noetia_api_edge` while the label points there | **Traefik cannot reach the API (502 on `/api`)**, an availability failure, never a trust expansion. Prevented by deployment order (§8.2); recovered by rollback (§8.4). |

Every failure mode **narrows** trust back to the current behaviour. None widens it, and none stops other Noetia services.

### 5.7 Effects on the throttlers
- **No throttler code or limit changes.** Its tracker `req.ip` becomes the real client address for traffic arriving through Traefik.
- **G-1 Checkout-status route:** **30 requests / minute / client IP**, as approved. A buyer's polling (≤ 11 requests per 30 s) uses at most 11 of their own 30.
- **Every other throttled route:** 120 / minute / client IP **per route handler**, as configured. `@SkipThrottle` controllers are unchanged.
- **The in-memory store** stays per process, with no Redis. The polling budget is unchanged.
- **Inherent limitation (not introduced here):** customers behind one public address (offices, carrier-grade NAT) share buckets, as with any IP-based limit (§12 Q4).

### 5.8 Spoofing controls (summary)
1. **Traefik** discards client forwarding headers at the edge: default `forwardedHeaders` [Source, Local]. **Invariant:** never set `forwardedHeaders.insecure`, or `trustedIPs` covering client ranges, without revisiting this design.
2. **The API** trusts forwarding headers only from `R`, a range only Traefik can occupy.
3. **Express** takes the **rightmost** untrusted address (proxy-addr semantics), never the client-controlled leftmost.
4. **Validation rejects** keywords, hop counts, `true` and over-broad ranges.
5. **Authentication and authorization are untouched.** Client-IP attribution feeds only the throttler: JWT validation, ownership checks, the G-1 read-only verifier, R1-B, G-b and every financial path are independent of `req.ip` [Source].

## 6. Threat model (with the recommended design)

| # | Actor | Can reach the API? | Forwarding headers trusted? | Tracker | Can rotate or spoof it? | Can consume another client's allowance? | Authentication still enforced? |
|---|---|---|---|---|---|---|---|
| 1 | Ordinary external customer | Via Traefik | Traefik's own header, from peer `R` | Customer's public IP | No | Only with clients sharing their public IP (NAT) | Yes |
| 2 | External customer with forged `X-Forwarded-For` | Via Traefik | The forged header is **discarded by Traefik** | Customer's real IP | No [Local E1/E4] | No | Yes |
| 3 | External customer with several forwarding headers | Via Traefik | All client `X-Forwarded-*` discarded; Traefik writes one entry | Real IP | No | No | Yes |
| 4 | Another Noetia container on `noetia_net` | Directly | **No** (peer not in `R`) | Its container address | No (headers ignored) | Only its own internal bucket | Yes |
| 5 | Another application on `proxy` | **No** (the API leaves `proxy`) | — | — | — | — | — |
| 6 | Misconfigured or compromised internal container | Directly, if on `noetia_net` | No | Its container address | No | No external client's allowance | Yes |
| 7 | A request reaching the API without Traefik | From `noetia_net` only (no host port) | No | Peer address | No | No | Yes |
| 8 | Traefik, as configured | Via `noetia_api_edge` | **Yes** (peer in `R`) | Client IP from Traefik's header | Not by clients (they can't control Traefik's header) | No | Yes |
| 9 | Traefik after restart or address change | Via `noetia_api_edge` | Yes (new address still in `R`) | Client IP | No | No | Yes |
| — | Docker or host administrator | Anything | Could join the edge network | — | Yes | Yes | Yes, still JWT. Out of scope: host-root-equivalent |

**Compared with today:** actors 1–3 move from one shared bucket to per-client buckets. Actors 4, 6 and 7 are unchanged (untrusted). Actor 5 loses reach. The E5 weakness (private-first-hop trust) does not exist in this design.

## 7. Proposed patch (illustration for a later mission; NOT applied)

### 7.1 Files that would change

| File | Change |
|---|---|
| `services/api/src/common/trusted-proxy.ts` | **New.** Pure parser and validator for `TRUSTED_PROXY_CIDRS` |
| `services/api/src/main.ts` | Apply the validated trust list (about 8 lines) |
| `docker-compose.server.yml` | `api` moves `proxy` → `noetia_api_edge`; label `traefik.docker.network=noetia_api_edge`; declare the external network |
| `infra/server/traefik/docker-compose.yml` | Traefik also attaches to `noetia_api_edge` (rebase with PR #26, which adds `proxy_staging` the same way) |
| `infra/server/init.sh` | Idempotent creation of `noetia_api_edge` with the pinned `S`/`R` |
| `.env.example` | Document `TRUSTED_PROXY_CIDRS` (empty by default) |
| `CLAUDE.md`, `docs/incident-response.md` | Network table and env var; "502 on /api after edge change" playbook entry |
| `services/api/tests/unit/common/trusted-proxy.spec.ts`, `services/api/tests/unit/common/trusted-proxy.integration.spec.ts` | **New** tests (§10) |

**Not touched:** throttler configuration, the Checkout-status controller, authentication, payment, webhook and token code, migrations, `web`/`storage` networking, and the Traefik static config `traefik.yml`.

### 7.2 Code [Proposal]

```ts
// services/api/src/common/trusted-proxy.ts
import { isIP } from 'net';

export type TrustedProxyConfig = { enabled: true; cidrs: string[] } | { enabled: false; reason: string };
const MIN_PREFIX: Record<4 | 6, number> = { 4: 24, 6: 112 };
const MAX_ENTRIES = 4;

/** Accepts only explicit, narrow CIDRs (e.g. "10.211.75.8/29"). Never keywords, hop counts or `true`. */
export function parseTrustedProxyCidrs(raw: string | undefined): TrustedProxyConfig {
  if (!raw || !raw.trim()) return { enabled: false, reason: 'TRUSTED_PROXY_CIDRS not set' };
  const cidrs = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (cidrs.length === 0 || cidrs.length > MAX_ENTRIES) return { enabled: false, reason: 'expected 1–4 CIDRs' };
  for (const c of cidrs) {
    const m = /^([0-9a-fA-F:.]+)\/(\d{1,3})$/.exec(c);
    const family = m ? (isIP(m[1]) as 0 | 4 | 6) : 0;
    if (!m || family === 0) return { enabled: false, reason: `not an explicit CIDR: ${c}` };
    const prefix = Number(m[2]);
    if (prefix > (family === 4 ? 32 : 128) || prefix < MIN_PREFIX[family]) return { enabled: false, reason: `prefix too broad or invalid: ${c}` };
  }
  return { enabled: true, cidrs };
}
```

```ts
// services/api/src/main.ts (inside bootstrap(), after NestFactory.create<NestExpressApplication>)
const logger = new Logger('Bootstrap'); // import { Logger } from '@nestjs/common'
const trusted = parseTrustedProxyCidrs(process.env.TRUSTED_PROXY_CIDRS);
if (trusted.enabled) {
  try {
    app.set('trust proxy', trusted.cidrs); // Express/proxy-addr: forwarded headers honoured ONLY from these peers
    logger.log(`[trusted-proxy] forwarded client address trusted only from ${trusted.cidrs.join(', ')}`);
  } catch {
    logger.warn('[trusted-proxy] disabled: value rejected by Express'); // never crash; fall back to peer address
  }
} else {
  logger.log(`[trusted-proxy] disabled (${trusted.reason}); rate limits key on the immediate peer`);
}
```

The `logger.warn` / `log` split follows §5.6: an invalid value is a WARN; unset is informational, so local development stays quiet.

### 7.3 Configuration [Proposal]

```yaml
# docker-compose.server.yml (excerpt)
networks:
  noetia_net: { driver: bridge }
  proxy: { external: true }
  noetia_api_edge: { external: true }   # created once (init.sh / runbook) with --internal --subnet S --ip-range R
services:
  api:
    networks: [noetia_net, noetia_api_edge]           # leaves `proxy`
    labels:
      - "traefik.docker.network=noetia_api_edge"      # was: proxy
      # routers/services unchanged

# infra/server/traefik/docker-compose.yml (excerpt; merge with PR #26's proxy_staging entry)
services:
  traefik:
    networks: [proxy, noetia_api_edge]
networks:
  proxy: { external: true }
  noetia_api_edge: { external: true }
```

```bash
# infra/server/init.sh (idempotent; S and R confirmed by the §9 check)
docker network inspect noetia_api_edge >/dev/null 2>&1 \
  || docker network create --driver bridge --internal --subnet 10.211.75.0/28 --ip-range 10.211.75.8/29 noetia_api_edge
```

`.env.production`: `TRUSTED_PROXY_CIDRS=10.211.75.8/29`, the allocation range `R`, never the whole subnet.

## 8. Deployment, verification and rollback (for the later mission; not executed)

### 8.1 Prerequisites
1. The §9 read-only verification is approved and completed: `S`/`R` free, live Traefik config matches, member inventory known.
2. PA/PO authorization of the implementation mission, coordinated with PR #26 / NEM-017 (same Traefik file).
3. **Merging to `main` deploys production (CD).** So the server steps 1–3 below must be done **before** the merge.

### 8.2 Order (mirrors the NEM-017 rehearsed rollout; no production downtime expected)
1. `docker network create --driver bridge --internal --subnet S --ip-range R noetia_api_edge`
2. `docker network connect noetia_api_edge traefik`: **live, no Traefik restart**. Verify with `docker inspect traefik` that both networks are listed.
3. Add `TRUSTED_PROXY_CIDRS=R` to `.env.production` with `nano`. **Never paste multi-line content over SSH** (`CLAUDE.md`).
4. Persist the Traefik compose change on the server with `nano`. **Do not run `compose up` in `/opt/traefik`**: it recreates Traefik (NEM-017 finding).
5. Merge, then CD deploys. The API is recreated on `noetia_net` + `noetia_api_edge` with the new label. If the network were missing, `compose up` fails **before** replacing the running API (NEM-017 edge case).

### 8.3 Post-deploy verification
- `GET https://noetia.app/api/health` returns 200 through Traefik.
- `docker network inspect noetia_api_edge` lists **exactly** two members, `traefik` and the API.
- From **two different client networks** (for example mobile data and fixed line), `GET /api/subscriptions/plans` twice each: each client's `X-RateLimit-Remaining-global` decrements **independently** (120 → 119 → 118 per client). A shared sequence means the trust is stale.
- The API boot log contains the `[trusted-proxy] … trusted only from R` line.

### 8.4 Rollback
1. Revert the `docker-compose.server.yml` change (API back on `proxy`, label `proxy`) and remove `TRUSTED_PROXY_CIDRS`. Redeploy; the API returns to today's behaviour.
2. Optional, afterwards: `docker network disconnect noetia_api_edge traefik` and `docker network rm noetia_api_edge`. Leaving them in place is harmless.

## 9. Read-only live verification plan (for PA approval; NOT executed)

Run on the server by an authorized operator, one command at a time; all are read-only.

| # | Command | Purpose |
|---|---|---|
| V1 | `docker network ls` and `docker network inspect $(docker network ls -q) --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}} {{end}}'` | All subnets in use, so the chosen `S` doesn't overlap |
| V2 | `ip -4 route` and `ip -4 addr` | Host and provider routes, so `S` doesn't collide with host networking |
| V3 | `docker inspect traefik --format '{{json .NetworkSettings.Networks}}'` | Traefik's live attachments and addresses |
| V4 | `docker network inspect proxy --format '{{range .Containers}}{{.Name}} {{end}}'` | Every container on `proxy` (Noetia, staging, AutoGuildX) |
| V5 | `cat /opt/traefik/traefik.yml` (view only) | The live entrypoints have no `forwardedHeaders` override; image tag |
| V6 | `cat /etc/docker/daemon.json 2>/dev/null; docker info --format '{{json .SecurityOptions}}'` | `userland-proxy`, IPv6 and `ip6tables` settings (affects which client address Traefik sees) |
| V7 | `dig +short AAAA noetia.app` (from any machine) | Whether IPv6 clients exist at all |
| V8 | `docker compose -f docker-compose.server.yml exec -T api node -e "console.log(require('os').networkInterfaces())"` | The API container's live networks |

Expected decisions from V1–V8:
- the final `S`/`R`;
- confirmation that the edge strips client headers;
- whether the IPv6 questions (§12 Q2/Q3) are live concerns.

**Required before implementation: yes.**

## 10. Test specification (for the later mission; not implemented or run)

**Fixtures:**
- **(U) Unit:** pure tests of `parseTrustedProxyCidrs`.
- **(H) In-process HTTP, Jest, no Docker:**
  - a Nest app with the API's real throttler setup (`global` 120/min; a route with `@Throttle({ global: { limit: 30, ttl: 60000 } })`), with `trust proxy` applied through the same code path as `main.ts`;
  - listening on `::` (dual-stack, as in production);
  - clients use Node `http.request({ localAddress })` to originate from distinct loopback addresses: `127.0.0.2` as "Traefik" (trusted /32), and `127.0.0.3` / `127.0.0.4` as internal containers or clients.
- **(D) Disposable Docker:** a local, PA-authorized harness in the Checkpoint I / NEM-017 style:
  - real `traefik:v2.11` with production-default entrypoints;
  - an internal `--ip-range` network shared only with the upstream;
  - a third container on a separate "proxy" network;
  - uniquely named resources, explicit-name cleanup, no published ports, no Docker socket mounts.

| ID | Test | Fixture | Expected result and failure assertion |
|---|---|---|---|
| T-I1-01 | Independent external clients | H (`X-Forwarded-For` from the trusted peer: client A, then client B), D (two client containers via Traefik) | Each client gets 30 × 200 on the 30/min route. **Fail if** B's requests decrement A's bucket. |
| T-I1-02 | Per-client exhaustion | H, D | One client: requests 1–30 → 200, the 31st → **429** with `Retry-After-global`. |
| T-I1-03 | Forged header through Traefik | D (client sends a rotating `X-Forwarded-For`) | Still 429 at that client's 31st. **Fail if** any forged value opens a new bucket. |
| T-I1-04 | Direct internal access | H (peer `127.0.0.3`, untrusted, with a rotating `X-Forwarded-For`), D (internal container direct to the upstream) | `req.ip` = the peer; 429 at its 31st. **Fail if** the forged header changes the tracker (the E5 regression). |
| T-I1-05 | Shared Docker network | D (container on the "proxy" network only, not the edge) | It can't reach the upstream, or is untrusted if reachable; forged headers have no effect. **Fail if** trusted. |
| T-I1-06 | Traefik restart | D (`docker restart` the test Traefik) | Per-client buckets keep working; the third container is still untrusted. **Fail if** a new peer becomes trusted. |
| T-I1-07 | Traefik recreation | D (remove and recreate the test Traefik; its address changes within `R`) | Trusted again without config change; still no other trusted peer. An extra container attached to the edge network **is** trusted, documenting that membership is the boundary (the deploy check covers it). |
| T-I1-08 | Stale or invalid configuration | U (empty, `true`, `loopback`, `uniquelocal`, `1`, `0.0.0.0/0`, `10.0.0.0/8`, `::/0`, garbage, 5 entries), H (valid but excludes the peer) | U: `enabled:false` with a reason; the app **boots**; one WARN. H: forwarded headers ignored, shared bucket (today's behaviour). **Fail if** the app throws at boot, or trusts anything. |
| T-I1-09 | IPv4 / IPv6 | U (IPv6 CIDR ≥ /112 accepted, < /112 rejected), H (dual-stack listener; IPv4-mapped peer `::ffff:127.0.0.2` matches `127.0.0.2/32`; peer `::1` does **not** match an IPv4 range) | As stated. **Fail if** a mapped peer is unmatched, or an IPv6 peer matches an IPv4 range. |
| T-I1-10 | Existing API routes | Full API suite plus H (`JwtAuthGuard` route: 401 without a token, whatever the forwarding headers) | All existing suites pass. Forwarding headers never change authentication results. |
| T-I1-11 | G-1 regression | Existing `checkout-status.service.spec.ts` and `checkout-status.contract.spec.ts`, plus the web success-page suites | Unchanged: uniform 404, ownership, read-only, R1-B (no token `delivered`), G-b (no gift request). |
| T-I1-12 | Financial isolation | Source audit and the full payment suites | The diff touches only `main.ts`, the new helper, compose/env/docs. No payment, webhook, token, ownership or entitlement file changes. Webhook and payment suites green. |

**Acceptance criteria for the implementation:**
- T-I1-01 to T-I1-12 all pass, with D tests run locally and their evidence committed;
- existing API and web suites at least as green as the baseline (the known `bcrypt` environment exception noted);
- §8.3 verification passes after deployment.

## 11. Cost and operations
- **No new service, store, dependency or persistent state.** One Docker bridge network, about 10 lines of application code and one environment variable.
- **CPU and memory:** negligible (`proxy-addr` matching per request is already in Express's request path).
- **Maintenance:** none recurring. The network is created once (idempotent in `init.sh`). The only ongoing invariant: **keep `noetia_api_edge` to Traefik + API**, checked at deploy (§8.3).
- **Coordination:** rebase the Traefik compose edit with PR #26 (NEM-017). It is compatible with NEM-018's AutoGuildX move.
- **Staging:** the same pattern can later apply behind `proxy_staging` (NEM-017). Out of scope here.

## 12. Unresolved questions (for PA/PO)
1. **Live facts (§9):** the subnet choice, live Traefik parity, and the `proxy` member inventory. **Blocking for implementation, not for this design.**
2. **IPv6 via Docker's userland proxy:** if production relays IPv6 that way, Traefik sees one gateway address for all IPv6 clients. They would share a bucket after this fix. A host-level Docker setting is outside this design.
3. **IPv6 address rotation:** if IPv6 is served, a tracker per /128 lets one customer rotate within a /64. Mitigation: normalise IPv6 trackers to /64 in the throttler, a narrow future change needing its own approval.
4. **Shared public IPs** (carrier-grade NAT is common on mobile networks): several buyers behind one address share 30/min on the G-1 route. If that matters, a per-user tracker for the authenticated G-1 route could follow as a separate decision (it needs JWT verification inside the throttler path).
5. **If PA rejects any network change,** the fallback is D1 (shared-secret header). Its trade-offs are listed in §4.
6. **PR #26 / #28 sequencing** for the shared Traefik compose file.

## 13. STOP-gate review (mission §14)

| # | Gate | Status |
|---|---|---|
| 1 | Baseline differs | No |
| 2 | Safe peer identity can't be established | **Established by design:** network membership plus an explicit allocation range. Its *deployability* depends on §9 (a free subnet). |
| 3 | Trusts arbitrary internal containers | No: only the edge range, whose members are Traefik and the API |
| 4 | Dynamic addresses unsafe | No: the range absorbs Traefik address changes; staleness fails safe |
| 5 | Expands into authentication or financial logic | No |
| 6 | Introduces spoofing | No: E5 is closed; edge stripping is retained |
| 7 | Needs a production-only fact | **For implementation, yes** (§9: subnet, live Traefik config). Not for this design. The read-only plan is prepared and **not executed**. |
| 8 | New service, migration or complex networking unavoidable | No: one bridge network |
| 9 | Live access required | Not used. §9 needs separate approval. |
| 10 | Implementation required to continue | No |

## 14. Confirmation
- **The only file added is this document.** No application code, tests, Compose, Traefik, network, environment or infrastructure file changed. No container or network was created, restarted or removed, and no live traffic experiment was run.
- PR #60 remains Draft and PR #59 is unchanged. No merge, deployment or activation.

**STOP for independent PA review.**
