# Shared proxy network isolation tests (NEM-018)

**Local only. Never run these on the server.** They need Docker, python3, curl and `patch`. `next-rewrite-check.sh` also needs npm registry access.

Every project and network uses the `n18h` or `n18x` prefix and is removed on exit. Local dev stacks named `noetia-*` or `autoguildx-*` are never matched.

| Script | What it proves |
|---|---|
| `all.sh` | Runs every variant and compares each one's failed checks with the expected list. Exit 0 means every outcome was as expected. |
| `run.sh <variant>` | One topology, using the real Noetia compose file and the AutoGuildX fixtures. Real networks and Traefik labels; applications replaced by identity responders. |
| `rollout.sh` | Rehearses the migration and rollback from `docs/operations/nem-018-autoguildx-network-migration.md`, including AutoGuildX's CD script, with live monitors. |
| `next-rewrite-check.sh` | Builds a real Next.js app with Noetia's `rewrites()` and checks what a credentialed request forwards. |
| `mirror.py`, `lib.sh` | Generate the stand-in stacks; shared helpers. |
| `autoguildx-proxy-agx.patch` | The proposed AutoGuildX change. `recommended` and `rollout.sh` test this exact patch. |
| `fixtures/autoguildx/` | Unmodified copies of AutoGuildX's compose files at `a09e9a8`, so the suite runs without that repository. |

## Variants

| Variant | Topology | Expected |
|---|---|---|
| `baseline` | Noetia and AutoGuildX both on `proxy` (today) | Fails `X*`, `F*`, `E1`, `M1`: this reproduces the risk. `R1` and `R2` are a race and may or may not fail, so `all.sh` doesn't compare them |
| `alias` | Same networks, plus unique aliases and callers using them | Still fails `X*`, generic-name checks and `M1` |
| `noetia-moved` | Noetia on `proxy_noetia`, AutoGuildX on `proxy` | Passes |
| `recommended` | AutoGuildX on `proxy_agx`, Noetia unchanged | Passes |

## Running

```bash
# From the repo root. The optional file adds the three-network end state with NEM-017 staging.
git show origin/deploy/nem-017-on-006c:docker-compose.staging.yml > /tmp/staging.yml
STAGING_COMPOSE=/tmp/staging.yml infra/tests/shared-proxy-isolation/all.sh
```

## What these tests cannot show

- They don't validate production. The live host, its real applications, Let's Encrypt and real traffic aren't involved.
- Healthchecks aren't mirrored, so a router disappears here when a container stops, not while it's `starting` or `unhealthy`.
- The `/api/metrics` source-IP block can't be tested, because local clients come from an allowlisted range.
- Stand-ins start instantly, so measured outage times are lower bounds.
