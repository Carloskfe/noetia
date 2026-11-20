# S-ALT: project-unique internal aliases (S19 mitigation) — contract and disposable harness

**LOCAL ONLY.** Nothing here may be run on a production or staging server. Every container, network and image
the scripts create is prefixed `salt`/`saltz_`/`saltbuild`/`s-alt-contract` and removed on exit (images are kept).

## The contract

`api`, `web` and `storage` are on `noetia_noetia_net` **and** the shared `proxy` network. Other projects on
`proxy` (AutoGuildX) advertise the same generic names (`api`, `storage`). Docker's embedded DNS answers a name
from the first-sorting attached network that has it, so while our api is stopped or recreated, `api` from our
web resolves to the other project's api and the reader's `Authorization`, cookies and body go there (S19-e).

| Caller | Value | Where |
|---|---|---|
| web `/api/*` rewrite (baked into `.next/routes-manifest.json`) | `http://noetia-api.internal:4000` | `web.build.args` + Dockerfile `ARG` default |
| web SSR share page `app/s/[id]` (runtime) | `http://noetia-api.internal:4000` | `web.environment` |
| api S3 client (`StorageService`, ingestion clients) | `noetia-storage.internal` | `api.environment.MINIO_ENDPOINT` |

Aliases are declared on `noetia_net` only. Values are compose **literals**: `environment:` overrides
`.env.production`, and nothing is interpolated from `--env-file`. CD (`.github/workflows/cd.yml`) always passes
`-f docker-compose.server.yml` explicitly, so neither `docker-compose.override.yml` nor `docker-compose.prod.yml`
is loaded.

**Why `.internal`.** When an alias is missing, Docker forwards the name to the host resolver. The production
web container has the tailnet search domain `tail52ba4d.ts.net`, and Tailscale MagicDNS answers bare tailnet
machine names. Docker forwards single-label names whenever the container sets no explicit `ndots`, which is
production's configuration. A bare `noetia-api` therefore fails **open** if a tailnet device of that name ever
exists. The negative-control variant `plain` demonstrates this with credentials. `.internal` is reserved and
never delegated in public DNS, and a dotted name is not answered by MagicDNS as a machine name. It fails closed
with `ENOTFOUND` under Docker's default `ndots:0` and under `ndots:5`. One residual remains: a resolver that
answers *every* name, including reserved TLDs (`UPSTREAM_MODE=all`), defeats any name choice.

## Files

| File | Purpose |
|---|---|
| `contract.sh [BASE_REF]` | Static contract (C1–C18) over the **effective** compose model, with a throwaway `.env.production` that sets the old generic values. With `BASE_REF`, it fails if any key other than the five S-ALT keys changed. |
| `build.sh web\|api` | Builds `saltbuild-web` / `saltbuild-api` exactly as CD does (`docker compose --env-file … -f docker-compose.server.yml build`). |
| `run.sh [candidate\|generic\|plain][-b2]` | Disposable failure-path harness: real web image, real Traefik v2.11, AutoGuildX-like neighbour, foreign `storage`, MagicDNS-like upstream (`fakedns.py`) and tailnet sink. |
| `storage-client.sh` | The real `StorageService` from the api image against a real MinIO reachable only via the alias. Covers round trip, unchanged presigned/public URLs, and fail-closed behaviour when MinIO is down. |
| `transition.sh forward\|rollback compose-order\|web-first` | Deployment-transition test (PA F-1): switches old to new with real Compose recreation under continuous credentialed traffic, and reports foreign requests and outage windows. |
| `ROLLOUT.md` | **Fail-closed rollout and rollback runbook (F-1), pre-deployment DNS gate (F-2), staging sync requirement (F-3).** |
| `noetia.yml`, `agx.yml`, `ndots.yml`, `responder.py`, `fakedns.py`, `storage-client.js`, `traffic.py` | Harness parts. |

## Running

```bash
infra/tests/s-alt/contract.sh origin/main          # static, seconds
infra/tests/s-alt/build.sh web api                 # ~5 min, one at a time on small VMs
(cd services/web && docker build -q --target production --build-arg INTERNAL_API_URL=http://api:4000 -t saltbuild-web-generic .)
(cd services/web && docker build -q --target production --build-arg INTERNAL_API_URL=http://noetia-api:4000 -t saltbuild-web-plain .)
infra/tests/s-alt/run.sh candidate                 # expected: all PASS
infra/tests/s-alt/run.sh generic                   # negative control (today's production): FAILs F1 F2 F3 ...
infra/tests/s-alt/run.sh plain                     # negative control (unsuffixed unique alias): tailnet sink gets credentials
infra/tests/s-alt/run.sh candidate-b2              # with PR #62 Stage B-2 topology
NDOTS=5 infra/tests/s-alt/run.sh candidate         # search-domain-first resolver
infra/tests/s-alt/storage-client.sh
infra/tests/s-alt/transition.sh forward compose-order   # control: CD as-is, expected FAIL (old web falls through)
infra/tests/s-alt/transition.sh forward web-first       # proposed rollout: expected PASS
infra/tests/s-alt/transition.sh rollback web-first
```

## What it does not cover (residual exposure)

- **Inbound (X4/X5):** when *AutoGuildX's* api is down, AutoGuildX's own generic `api` lookup resolves to
  Noetia's api on `proxy`. Their traffic, which may carry their users' credentials, reaches us. S-ALT cannot
  remove our container from their lookup. That needs network separation: PR #62 Stage B-2 or NEM-018.
- **Raw reachability (X1–X3):** any container on `proxy` can reach our api or MinIO by container name or IP.
- **Other internal callers:** `worker` and `image-gen` are on `noetia_net` only (not on `proxy`), so the
  cross-project path does not exist for them. Their generic names (`storage`, `cache`, `db`, `search`, `image-gen`)
  still fall through to the upstream resolver if the target is missing (D-1, unchanged by this PR).
- **Code defaults:** `app/s/[id]/page.tsx` still defaults to `http://api:4000` if `INTERNAL_API_URL` is unset. The
  image does not set it at runtime, so compose must (contract C8). Changing application code was out of scope.
- **Upstream resolver overriding `.internal`** (`UPSTREAM_MODE=all`).
