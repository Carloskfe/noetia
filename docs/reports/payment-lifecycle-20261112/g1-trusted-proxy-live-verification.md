# G1-I1 Checkpoint III: read-only live topology verification (sanitized)

| | |
|---|---|
| **Mission** | G1-I1 / Checkpoint III: Read-Only Live Topology Verification, completed through the PO's evidence handoff (2026-11-14) |
| **Design under review** | [`g1-trusted-proxy-correction-design.md`](g1-trusted-proxy-correction-design.md), baseline `14423c4` (not modified by this report) |
| **Evidence provenance** | **The Product Owner** ran the read-only commands on the production server and supplied the outputs. **Claude Code did not access the server** in this mission. The restricted off-site backup credential was **not** used. Claude Code's own contributions are labelled AGENT-REPORTED (public DNS) and VERIFIED REPOSITORY (GitHub and committed files). |
| **Status** | Documentation only. No live change of any kind. **STOP for independent PA review.** |

**Classification labels:**
- **VERIFIED LIVE**: from the PO-supplied server outputs.
- **VERIFIED REPOSITORY**: from GitHub or committed files.
- **AGENT-REPORTED**: Claude Code's earlier public check, not repeated during the PO's server session.
- **INFERRED**: reasoning, not observed.
- **PROPOSED**: design.
- **UNRESOLVED**: open.

**Sanitization:** the ACME e-mail, MAC addresses, full Docker IDs, the host's public IPv6 prefix, the provider gateway and the Tailscale addresses are omitted or redacted. Private Docker subnets and container addresses are kept only where the overlap and trust analysis needs them.

---

## 1. Executive summary

- **The live topology supports the Checkpoint II architecture (Option C).** The proposed edge range `10.211.75.0/28` overlaps no live Docker network and no observed host address or main-table route. The API's internal network can be kept while its shared-`proxy` role moves to a dedicated edge network.
- **The live evidence strengthens the reason for the change.** The production API shares `proxy` with AutoGuildX's `web` and `api` containers, and with Noetia's `web` and `storage`. Any of them can reach `api:4000` without Traefik. A rule that trusts arbitrary private addresses would let them forge client IPs.
- **Live Traefik configuration matches the repository** for everything relevant here: no `forwardedHeaders` overrides; Docker provider default network `proxy`; `exposedByDefault: false`.
- **One material repository/live drift:** live Traefik is **also attached to `proxy_staging`**, which the committed Traefik compose file doesn't declare (PR #26 is unmerged). This does not change the architecture, but it **must be reconciled before any Traefik compose file is persisted** (§7).
- **Candidate `S = 10.211.75.0/28`, `R = 10.211.75.8/29`: accepted for further qualification, not approved for creation.**
- **Recommendation:** the design is **ready for a separately authorized local implementation and qualification mission** (code plus the T-I1-01…12 tests in disposable environments). A **live rollout** should wait for U3 (drift) to be reconciled and for the PR #26/#28 sequencing decision (§10).

## 2. GitHub baseline [VERIFIED REPOSITORY]

| PR | State | Head |
|---|---|---|
| #60, payment lifecycle / G1-I1 | Draft, unmerged | `14423c45ddea2168e8cd31bf4865438cd2bf1df3` (before this report) |
| #59, public ecosystem site | Draft, unmerged | `e326b81f262fbe99e10bb3fbeff6232f066eb230`, unchanged |
| #26, NEM-017 staging isolation | Draft, unmerged | `02c98f73b5c80f35af8ad3238a579d18c437425a` |
| #28, NEM-018 shared-proxy hardening | Draft, unmerged | `35ab50bdc16e4f5d94e104b943a1a4592e60a6fe` |

## 3. V1: Docker network inventory [VERIFIED LIVE]

| Network | Driver | IPv4 subnet | Gateway | Allocation range | Internal | Users (from V3/V4/V8 and names) |
|---|---|---|---|---|---|---|
| `bridge` | bridge | 172.17.0.0/16 | 172.17.0.1 | none | false | Docker default |
| `proxy` | bridge | 172.18.0.0/16 | 172.18.0.1 | none | false | **Shared:** Traefik, Noetia (`web`, `api`, `storage`), AutoGuildX (`web`, `api`) |
| `noetia_noetia_net` | bridge | 172.19.0.0/16 | 172.19.0.1 | none | false | Noetia production internal |
| `autoguildx_agx_net` | bridge | 172.20.0.0/16 | 172.20.0.1 | none | false | AutoGuildX internal |
| `noetia_staging_noetia_staging_net` | bridge | 172.21.0.0/16 | 172.21.0.1 | none | false | Noetia staging internal |
| `proxy_staging` | bridge | 172.22.0.0/16 | 172.22.0.1 | none | false | Traefik (V3); staging edge |
| `host`, `none` | host / null | — | — | — | — | Docker built-ins |

- The `IPRange=invalid Prefix` output means **no allocation range is configured**. The `--format` template prints an unset prefix that way.
- No IPv6 subnet is configured on any network.
- **Overlap with the proposed `10.211.75.0/28`: none** (all live subnets are in `172.17.0.0/16`–`172.22.0.0/16`).
- **[INFERRED]** Docker's default address pools hand out `172.17`–`172.31/16` and `192.168/16` blocks to networks created without a subnet. A `10.211.75.0/28` network is outside those pools, so a future auto-allocated network (for example `proxy_agx` from PR #28) won't collide with it.

## 4. V2: host routing and addresses [VERIFIED LIVE, sanitized]

**IPv4:**
- the default route goes via the provider gateway on `eth0`;
- `eth0` carries the public address already documented in `CLAUDE.md`;
- `lo` is `127.0.0.1/8`;
- the Docker bridge gateways are in `172.17`–`172.22/16`;
- `tailscale0` holds one `/32` in the Tailscale range `100.64.0.0/10`;
- there is **no route or interface address covering `10.211.75.0/28`**.

**IPv6:**
- the host has a **public `/64` on `eth0`** (prefix redacted) and an IPv6 default route via a link-local gateway;
- Tailscale holds a `/128` ULA;
- Docker bridges and veths show **only link-local `fe80::/64`**, with no global IPv6 on any container network.

**Overlap assessment:**

| Possible conflict | Result |
|---|---|
| Host addresses | None |
| Existing Docker bridges | None |
| Provider routes | None in the main table |
| Production and staging networks | None |
| VPN / overlay | No main-table route. **[UNRESOLVED, U8]** Tailscale installs its routes in a separate policy-routing table (commonly table 52), which `ip -4 route` doesn't show. A tailnet subnet route overlapping `10.211.75.0/28` would take precedence for **host-originated** traffic. **[INFERRED]** Container-to-container traffic on the same bridge (Traefik → API) is switched at layer 2, so it isn't affected. |

**Qualification:** this verifies the current inventory only, not future routes or networks.

## 5. V3: Traefik live attachments [VERIFIED LIVE]

| Network | Traefik IPv4 | Gateway | Global IPv6 | Static IPAM |
|---|---|---|---|---|
| `proxy` | 172.18.0.3 | 172.18.0.1 | none | none (dynamic) |
| `proxy_staging` | 172.22.0.2 | 172.22.0.1 | none | none (dynamic) |

**Drift:** the committed `infra/server/traefik/docker-compose.yml` [VERIFIED REPOSITORY] declares only `proxy`. Live Traefik is also on `proxy_staging`, the change PR #26 proposes. **Some NEM-017 network setup was therefore applied on the server** while PR #26 remains unmerged.
- **[INFERRED]** Consistent with this, V4 shows **no staging container on `proxy`**.
- **[UNRESOLVED, U3]** Whether `/opt/traefik/docker-compose.yml` on the server lists `proxy_staging`, and whether the rest of NEM-017 is applied, wasn't inspected. Not inferred.

## 6. V4: shared `proxy` membership [VERIFIED LIVE]

| Container | Application |
|---|---|
| `traefik` | Edge proxy |
| `noetia-api-1`, `noetia-web-1`, `noetia-storage-1` | Noetia production |
| `autoguildx-api-1`, `autoguildx-web-1` | AutoGuildX |
| Noetia staging | **None present** |
| Other | None |

**Finding:** five non-Traefik containers share a bridge with the Noetia API. **[INFERRED]** Under normal bridge networking they can open connections to `noetia-api-1:4000` without Traefik. This is a reachability finding, not an authentication bypass: JWT and ownership checks still apply. It rules out any `trust proxy` rule that trusts private or Docker address space, and it is exactly what PR #28 (moving AutoGuildX to `proxy_agx`) and G1-I1 (moving the API to `noetia_api_edge`) address.

## 7. V5: live Traefik static configuration [VERIFIED LIVE vs VERIFIED REPOSITORY]

| Setting | Live `/opt/traefik/traefik.yml` | Repository `infra/server/traefik/traefik.yml` |
|---|---|---|
| Dashboard | disabled | disabled |
| Entrypoints | `web :80` (redirect to `websecure`), `websecure :443` | same |
| `forwardedHeaders.insecure` | **not set** | not set |
| `forwardedHeaders.trustedIPs` | **not set** | not set |
| Docker provider | `exposedByDefault: false`, `network: proxy` | same |
| ACME | HTTP challenge, e-mail [REDACTED] | same structure |

**Version:** the running image tag wasn't part of this output. The committed compose file pins `traefik:v2.11` [VERIFIED REPOSITORY]. The live image tag is **[UNRESOLVED, minor]**.

**Security reading:**
- **[VERIFIED LIVE + documented default]** No forwarded-header trust is configured, which is the default that discards client-supplied forwarding headers. Checkpoint I demonstrated this behaviour on `traefik:v2.11` **locally** [Local].
- **[UNRESOLVED, U6]** No live request tested production header handling.

**Implementation requirement [PROPOSED]:**
- The Noetia API's labels must set `traefik.docker.network=noetia_api_edge` **in the same change** that removes the API from `proxy`.
- The provider-wide default (`network: proxy`) **must not change**: `web`, `storage` and AutoGuildX still depend on it.

## 8. V6: Docker daemon IPv4/IPv6 [VERIFIED LIVE]

**Observed:**
- no `/etc/docker/daemon.json`;
- Docker Engine 29.4.3 on Ubuntu 24.04.4 LTS, kernel 6.8;
- 24 containers, all running;
- IPv4 forwarding enabled; firewall backend iptables; Swarm inactive.

**Effective behaviour supported by evidence:**
- Container networks are IPv4-only: no network has an IPv6 subnet (V1), and there is no global IPv6 on bridges (V2).

**Not established read-only [UNRESOLVED]:**
- **U1:** the effective `userland-proxy` setting. With no `daemon.json`, the effective value is Docker's built-in default for this version. That wasn't observed and isn't reported here.
- Docker's full IPv6 and ip6tables daemon behaviour.

**Why U1 matters [INFERRED]:**
- The host has public IPv6, while Traefik's container has none.
- If an IPv6 connection reaches Traefik's published ports through Docker's userland proxy, Traefik would see a Docker gateway address rather than the client's.
- Those clients would then share one bucket. This is never a trust expansion: the gateway is not in `R`, and it would arrive as Traefik's `X-Forwarded-For` value, not as a trusted peer.

## 9. V7 / V8

**V7, public DNS [AGENT-REPORTED, Claude Code's earlier check from its own resolver]:**
- `A noetia.app` → the documented public IPv4;
- `AAAA noetia.app` → **none**.

So browsers resolving `noetia.app` use IPv4. **[UNRESOLVED, U2]** Other IPv6 paths weren't checked: direct IP access or other hostnames.

**V8, production API attachments [VERIFIED LIVE]:**

| Network | API IPv4 | Role |
|---|---|---|
| `noetia_noetia_net` | 172.19.0.11 | Internal: web SSR, Prometheus, worker, db, cache (committed compose) |
| `proxy` | 172.18.0.4 | Shared edge (Traefik, and also reachable by AutoGuildX and Noetia web/storage) |

There is no global IPv6. **[INFERRED]** The proposed design keeps role 1 and replaces role 2 with `noetia_api_edge`. Legitimate internal callers use `noetia_net` [VERIFIED REPOSITORY], so they keep access. This does **not** prove the transition is uninterrupted (§11).

## 10. Candidate subnet and trusted range [PROPOSED, supported by live inventory]

| | Value |
|---|---|
| Network | `noetia_api_edge`: Docker bridge, `--internal`, IPv4-only, external, created once |
| Subnet `S` | `10.211.75.0/28` |
| Gateway | `10.211.75.1` (host bridge, **outside** `R`, untrusted) |
| Allocation range `R` | `10.211.75.8/29` (container addresses .8–.15) |
| Members | `traefik` and the production Noetia API **only** |
| API setting | `TRUSTED_PROXY_CIDRS=10.211.75.8/29` |

**Why it's suitable:**
- no overlap with the live Docker subnets or the observed host addresses and routes;
- outside Docker's default auto-allocation pools [INFERRED];
- the gateway is excluded from `R`;
- Traefik may move within `R` on recreation without a configuration change.

**Caveat:** an address range doesn't prove identity. Trusting `R` is safe **only while** membership is limited to Traefik and the API, and Docker allocates container addresses only from `R` (§12).

**Decision status:** accepted for further qualification. **NOT approved for live creation or configuration.**

## 11. Rollout and availability risk assessment (design §8; not executed)

| # | Risk | Status |
|---|---|---|
| 1 | Network exists with wrong IPAM (another subnet or range) | **Mitigated by design plus a check:** an idempotent create with explicit `--subnet`/`--ip-range`, and a pre-deploy `docker network inspect` asserting `S`/`R`. A mismatched range fails **safe** (Traefik untrusted, shared buckets). **Needs a test:** T-I1-08. |
| 2 | Traefik not connected when the API switches networks | **Real availability risk: `/api` returns 502** until Traefik is attached or the change is rolled back. Mitigated by **ordering** (attach Traefik live before the merge, since merge = CD deploy) and a pre-merge `docker inspect traefik` check. **Needs a rehearsal** against the verified topology (U5). |
| 3 | The API's router keeps the old network label | Traefik would target the API's `proxy` address, which no longer exists after the API leaves `proxy`: a 502. **Mitigated by design:** label and network change in one commit; post-deploy health check. **Needs a test.** |
| 4 | The API loses its internal dependencies | **Mitigated by design:** `noetia_noetia_net` is unchanged (V8). **Needs a test:** health, plus DB, Redis, MinIO and Meilisearch reachability after the change. |
| 5 | Deployment replaces a healthy API before new routing works | Partly mitigated: if `noetia_api_edge` is missing, `compose up` fails on the external-network check **before** recreating (NEM-017 local finding [Local]). If it exists but Traefik isn't attached, the API is recreated and risk 2 applies. **Unresolved until rehearsed (U5).** |
| 6 | The trusted range doesn't match actual addresses | Fails **safe** (no trust, today's shared buckets). Detected by the post-deploy check (design §8.3: per-client `X-RateLimit-Remaining-global`, and `docker network inspect` showing members in `R`). **Needs a test:** T-I1-07/08. |
| 7 | Live Traefik compose diverges from GitHub | **Confirmed (U3).** Persisting the repository's Traefik compose as-is would **drop `proxy_staging`** on the next recreation and cut staging routing. **Must reconcile first:** read-only inspection of `/opt/traefik/docker-compose.yml` and NEM-017 status. Unresolved. |
| 8 | Rollback restores `proxy` networking but not routing | **[INFERRED]** Reverting the compose change (API back on `proxy`, label `proxy`) and redeploying restores today's path, because Traefik is still on `proxy` and nothing is removed from it. **Not rehearsed:** untested, not guaranteed. **Needs a rehearsal.** |

**Downtime windows (none can be claimed as zero):**
1. The API container recreation during the deploy: the existing per-deploy gap, tracked as known debt, not introduced by this change.
2. Any 502 window from risks 2 or 3, until fix or rollback.
3. The rollback redeploy itself, a second recreation.

`docker network connect` for Traefik needed no restart in the NEM-017 **local** rehearsal [Local]. The live `proxy_staging` attachment suggests the same was done live, but that is [INFERRED] and not verified.

## 12. Security trust-boundary assessment

Invariant: **only the genuine Traefik peer may supply a trusted forwarded client IP to the API.**

| Question | Assessment |
|---|---|
| Can another container join `noetia_api_edge` under current arrangements? | Only through Docker control: a compose file listing the network, or `docker network connect`. Live, every project deploys on this host with Docker access (AutoGuildX's CD runs Docker commands), so **this is a procedural control, not a technical one.** Proposed controls: the network appears only in Noetia's and Traefik's compose files (code review), and a deploy-time membership check expects exactly two members. **[UNRESOLVED, U4]** until implemented and tested. |
| Can a container obtain an address in `R`? | Only if attached (above). Docker's dynamic allocation stays inside `--ip-range`. A static `ipv4_address` outside `R` would be untrusted (fails safe). [INFERRED; T-I1-07] |
| Reach the API through another network and forge headers? | After the change, the API's only other network is `noetia_noetia_net` (172.19/16), never in `R`, so headers are ignored. AutoGuildX loses its path entirely (V4/V8 plus design). Spoofing a source in `R` across bridges fails: Docker inter-bridge isolation, and the TCP handshake returns to the real `R` host. [INFERRED; T-I1-04/05] |
| Accidental trust through subnet overlap? | No overlap today (V1/V2). The pre-deploy IPAM assertion covers future drift. **U8:** Tailscale policy routes weren't inspected; they affect host-originated traffic only. |
| Tracker becomes a Docker gateway instead of the client? | Possible for IPv6 or hairpin traffic **if** Docker relays it through its userland proxy (U1/U2). The effect is a shared bucket for those clients, **not** trust expansion. The gateway addresses (`172.18.0.1`, `10.211.75.1`) are outside `R`. |
| Stale or mismatched trust configuration? | Fails safe to today's behaviour (design §5.6). Detected by the post-deploy check. |
| Authentication and authorization? | Unaffected. JWT, ownership, the G-1 read-only verifier, R1-B, G-b and every financial path don't read `req.ip` [VERIFIED REPOSITORY, design §2]. |

**Conclusion:** the proposed boundary is **justifiable** on the live topology. Its strength depends on the membership invariant (U4), which must be enforced by review plus a deploy check and qualified by T-I1-05/07.

## 13. PR #26 / #28 coordination [VERIFIED REPOSITORY + VERIFIED LIVE]

| Item | PR #26 (NEM-017) | PR #28 (NEM-018) | G1-I1 |
|---|---|---|---|
| Traefik compose edit | Adds `proxy_staging` to the `networks:` list | Adds `proxy_agx`; its runbook says edit only **after** NEM-017's version lands | Adds `noetia_api_edge` |
| `init.sh` | — | Adds `docker network create proxy_agx` | Adds `noetia_api_edge` creation |
| Live state | **`proxy_staging` exists and Traefik is attached; no staging container on `proxy`** (partially or fully applied; U3) | **Not applied:** AutoGuildX is still on `proxy` | Not applied |
| Name or subnet conflict | — | `proxy_agx` would auto-allocate from Docker's pools [INFERRED] | `10.211.75.0/28` is outside those pools |

**Recommended order** (recommendation only; no merge or deploy authorization):
1. **Reconcile NEM-017:** record what is live, and make the repository's Traefik compose and the server file agree (they include `proxy_staging`).
2. **NEM-018:** move AutoGuildX to `proxy_agx`.
3. **G1-I1:** create the edge network and move the API off `proxy`.

Each later change must rebase the same Traefik `networks:` list, and must recheck the actual diffs and the live state right before authorization (U7). G1-I1 does **not** depend on NEM-018 for correctness. Its edge network closes the AutoGuildX → API path by itself. Order 2→3 only reduces how many times the Traefik file changes.

## 14. Repository/live divergence (recorded, not corrected)
1. **Traefik attachments:** live `proxy` + `proxy_staging`; committed compose `proxy` only (U3).
2. **Design wording (Checkpoint II §2, `proxy` members):** the design lists "staging until NEM-017" as a possible `proxy` member. Live shows **no staging container on `proxy`**. The design's conclusion is unaffected. Per this handoff, the design document is **not** edited; recorded here for PA.
3. **Design §8.2 step 4 (persist Traefik compose):** the future implementation must persist a Traefik compose file that **keeps `proxy_staging`**, as well as adding `noetia_api_edge`. Recorded for the implementation mission; the design is not edited.

None of these is an architecture contradiction, so no STOP applies.

## 15. Open questions (not closed by this report)

| ID | Question |
|---|---|
| U1 | The effective Docker `userland-proxy` setting wasn't established |
| U2 | The host has public IPv6; `noetia.app` reportedly has no AAAA. Other IPv6 ingress paths (direct address, other hostnames) weren't checked |
| U3 | Live/repository drift: Traefik is on `proxy_staging`; the committed Traefik compose doesn't declare it. The server's Traefik compose file and NEM-017 status weren't inspected |
| U4 | The trusted-range membership invariant is proposed, not yet created or tested |
| U5 | No migration has been rehearsed against the exact verified host configuration |
| U6 | No live request tested production forwarded-header handling |
| U7 | PR #26 and #28 diffs and live state must be rechecked right before implementation |
| U8 | Tailscale policy-routing tables (outside the main table) weren't inspected for routes overlapping `S` (affects host-originated traffic only) |
| — | The live Traefik image tag wasn't captured (the repository pins `v2.11`) |

**Smallest read-only follow-ups,** if PA wants them before a live rollout (PO-run, no changes):
- `docker inspect traefik --format '{{.Config.Image}}'`
- `cat /opt/traefik/docker-compose.yml`
- `ip -4 route show table all`, which shows Tailscale's tables
- `ss -ltnp`, filtered for listeners on 80 and 443: whether `docker-proxy` processes hold them, which bears on U1

## 16. Recommendation
1. **Architecture:** Option C stands. The live topology supports it and the live `proxy` membership strengthens the case. No architecture correction is needed.
2. **Candidate:** `S = 10.211.75.0/28`, `R = 10.211.75.8/29`, accepted for qualification; not approved for creation.
3. **Next step:** the design is **ready for a separately authorized implementation and qualification mission** that is local and disposable only:
   - the trusted-proxy helper and `main.ts` change;
   - the compose, Traefik, `init.sh` and docs changes **prepared but not applied**;
   - the T-I1-01…12 tests;
   - a rollout and rollback rehearsal against a local mirror of the **verified** topology, including `proxy_staging` and the AutoGuildX containers on `proxy`.
4. **Before any live rollout:**
   - reconcile U3 (NEM-017 drift);
   - decide the PR #26/#28/G1-I1 order;
   - run the small read-only follow-ups above;
   - rehearse to close U5;
   - authorize the rollout separately.

## 17. No-change confirmation
- **No live server changes:** Claude Code made no access to the server in this mission. The PO's commands were read-only. No network, container, Traefik, Docker, firewall, DNS, environment or database change was made.
- **Repository:** the only change is this new report. The design document, application code, tests, compose files, Traefik files and infrastructure files are unchanged.
- **PRs:** PR #60 remains Draft; PR #59, #26 and #28 are unchanged. No merge, deployment or activation.

**STOP for independent PA review.**
