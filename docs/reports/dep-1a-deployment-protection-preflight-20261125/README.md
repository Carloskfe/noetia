# DEP-1A: production deployment protection preflight

**Status:** COMPLETE (design only). **Nothing was activated. Awaiting independent Product Architecture review.**
**Date:** 2026-11-25 · **Authorization:** PO execution authorization DEP-1A (design-only, read-only diagnostic).

**Labels:** **[M]** measured in this session · **[D]** GitHub documentation read in this session · **[R]** rehearsed locally on throwaway repositories, with a stubbed `docker` and no network · **[K]** general knowledge, not confirmed · **[U]** unverified, cannot be inspected safely · **[P]** proposal.

## Summary

1. **Option C is free here [M][D].** The repository is public and owned by a personal account. Nothing needs a paid plan while it stays public.
2. **Today there is no gate [M].** `main` has no ruleset and no branch protection, there is no Environment, and every push to `main` opens a **root** SSH session on production.
3. **The controls are only as independent as the identity behind them.** The agent uses the PO's admin login. Until that login is removed from the agent's machine, Option C prevents *accidents*, not a determined or compromised holder of that login.
4. **A simpler identity model than IR-3A's is available.** A GitHub App for the agent, plus a second ruleset in which **only the PO may update `main`**, needs no PR-approval rules, so the PO never deadlocks on their own PRs.
5. **`cd.yml` alone is insufficient for exact-commit deployment.** Server-side checks, a server lock, a raised command timeout and four corrected runbooks are also needed. And an exact *commit* is still not an exact *artifact*, because the image builds are not locked (F-D5).
6. **Three traps in activation:** a missing Environment is created **unprotected** on first use (F-B2); "Protected branches only" can mean *all* branches (F-B1); a missing Environment secret silently **falls back** to the repository secret (F-C2). The sequence in §8 is built around them.

---

## 1. Verified repository baseline

| Item | Observed [M] |
|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01`, at the start and before publication |
| Governance and reports read | `CLAUDE.md`, `docs/engineering-missions/README.md`, IR-1 (#89), IR-3A (#91), `05-staging-strategy.md`, `incident-response.md`, `secrets-rotation.md`, the S-ALT `ROLLOUT.md`, `business/en/04-development-process.md` |
| Repository | public, owner type `User`, 0 forks, forking allowed, merge/squash/rebase all allowed, auto-merge off |
| Collaborators | `Carloskfe` (admin) only; 0 pending invitations |
| Rulesets / effective rules on `main` / classic protection | `[]` / `[]` / "Branch not protected" |
| Environments / deployments | 0 / 0 |
| Actions | enabled; all actions allowed; SHA pinning not required; default `GITHUB_TOKEN` read-only; Actions cannot approve PRs; fork-PR approval for first-time contributors |
| Actions secrets (names only) | `DEPLOY_SSH_KEY`, created 2026-05-10, last updated 2026-05-12. No variables. No Dependabot or Codespaces secrets |
| Deploy keys / webhooks / self-hosted runners | 0 / 0 / 0 |
| Secret scanning and push protection | enabled |
| Agent credential | `gh` as `Carloskfe`, scopes `repo`, `workflow`, `read:org`, `gist`; effective permission **admin** |
| Updates to `main` (latest 60 activity records) | 46 direct pushes, 14 PR merges; no force push listed |
| Last CD run | `44804341215`, `8f2f294`, success, 6 min 43 s |

**Not inspectable safely [U]** (PO to check in the web UI or on the server):
- account plan (the token lacks the scope) and 2FA state;
- **GitHub Apps and OAuth apps installed on the account** (the endpoint refuses this token). Any with write access is another identity to account for;
- account SSH keys, other credentials on the VM or Windows host, and every `authorized_keys` entry on the server;
- how the server authenticates `git fetch` (HTTPS is plausible: 0 deploy keys and a public repository), whether it is on branch `main`, and whether its tree is clean;
- whether the AutoGuildX repository also holds a root credential for this host.

None of these blocks the *design*. The first and last three are activation preconditions (§8).

## 2. Current deployment architecture

```
push/merge to main ──> cd.yml (no approval, no Environment)
   └─ appleboy/ssh-action@v1.2.0, root@host:222, repository secret DEPLOY_SSH_KEY
        └─ git pull origin main          <- whatever main is NOW
           docker compose build          <- mutable server checkout as build context
           up -d --wait 300              <- new code is live here
           migration:run:prod            <- migrations run AFTER the new code is live
           image prune
```

| ID | Finding | Evidence |
|---|---|---|
| **F-A1** | Any direct push or merge to `main` deploys, documentation included. | `cd.yml:3-5` [M] |
| **F-A2** | The run's SHA is never used; the server deploys the newest `main`. **Re-running an old run also deploys the newest `main`.** | `cd.yml:34` [M] |
| **F-A3** | The SSH **command timeout is the action's 10-minute default**; the last deploy took 6:43 in total. A slow build is cut off mid-script, and the remote process may continue. | `action.yml` at v1.2.0 [M]; remote continuation [K] |
| **F-A4** | No host-key `fingerprint` is configured, so the SSH client does not verify it is talking to the production host. | [M]; effect [K] |
| **F-A5** | The action is pinned to a mutable tag (currently commit `7eaf766`) and **downloads the `drone-ssh` binary at run time**, in a job that holds the root key. | `entrypoint.sh` at v1.2.0 [M] |
| **F-A6** | GitHub concurrency does not protect the server: a cut-off run, a manual deploy and a new run can overlap there. | [M] no lock in the script |
| **F-A7** | **`cd-staging.yml` exists on 12 remote branches.** It uses the **same root key on the same host**, on push to a branch named exactly `staging` or by manual dispatch. No `staging` branch exists, and the file is not on the default branch, so it is **inert**. Creating `staging` from one of those branches would open a root session on production. | [M] |
| **F-A8** | `.gitignore` does **not** match `.env.production` (`.env`, `.env.local`, `.env.*.local` only). On the server it is an ordinary untracked file. `git add .` would stage it; `git clean -fd` would **delete the production environment file**. The design uses neither, and no `reset --hard`. | `git check-ignore` [M] |

F-A7 was already documented (NEM-006A). Publication here cannot trigger it, so it is reported rather than treated as a STOP.

## 3. Workstream A: ruleset design

Rulesets are repository-level and work for personal repositories; the API answers normally [M]. "Evaluate" (dry run) is not assumed available: GitHub reserves it for Enterprise [K].

### 3.1 Ruleset 1, `main-baseline` (Phase 1) [P]

```json
{
  "name": "main-baseline",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "api — lint / typecheck / build",       "integration_id": 15368 },
          { "context": "web — lint / typecheck / build",       "integration_id": 15368 },
          { "context": "worker — lint / typecheck / build",    "integration_id": 15368 },
          { "context": "worker — unit tests (≥80% coverage)",    "integration_id": 15368 },
          { "context": "image-gen — unit tests (≥80% coverage)", "integration_id": 15368 } ] } }
  ]
}
```
`refs/heads/main` is used instead of `~DEFAULT_BRANCH`, so changing the default branch can't move the rule.

### 3.2 Required checks, by phase

| Check | Today, on a `main`-based docs PR (#89) [M] | Phase 1 | Phase 2: once the combined release **including #64** is on `main` |
|---|---|---|---|
| lint/typecheck/build: api, web, worker | pass | **required** | required |
| unit: worker, image-gen | pass | **required** | required |
| unit: api, web | fail | no | **required** (both pass on #90 [M]) |
| E2E | fail, **and targets production by default** (IR-1) | **no** | **required** (local build only) |
| unit: mobile | fail | no | **no, until the PO decides D-3 of IR-3A** |
| Branch up to date (`strict`) | | off | on |

- `strict` stays off in Phase 1 because "Update branch" re-runs CI, and with it the E2E job aimed at production.
- Excluding mobile changes no threshold: the job still runs and stays visibly red.
- Check names include `—` and `≥`. A renamed CI job would leave a required check permanently pending, so renames and ruleset updates must go together.
- `integration_id` 15368 is GitHub Actions [M]: another app or status cannot satisfy these checks by using the same name.
- `ci.yml` has no path filters, so documentation PRs satisfy the checks.

### 3.3 Required determinations

| Question | Answer |
|---|---|
| Does it bind administrators? | Yes, with an **empty bypass list**: the docs describe bypass as something granted to listed actors [D]. Must be proven by test N-1 (§8). |
| Can an admin get round it? | **Yes, by editing, disabling or deleting it.** No bypass means no *silent* bypass, not immutability. |
| Are zero approvals necessary now? | **Yes.** Authors cannot approve their own PRs [K], and there is one account. Requiring 1 would block every PR. |
| Are approved releases still mergeable? | Yes: ordinary PR merge, including the SHA-pinned API merge. |
| Does Draft status protect? | No. It is a convention; anyone with write access can clear it. |

### 3.4 Ruleset 2, `main-po-updates-only` (Phase 3, after identity separation) [P]

```json
{
  "name": "main-po-updates-only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [ { "actor_type": "User", "actor_id": "<PO numeric user id>", "bypass_mode": "pull_request" } ],
  "rules": [ { "type": "update" } ]
}
```
- "Restrict updates" lets only bypass actors update the branch [D]. The API lists a `User` actor and a `pull_request` mode [D]. **Whether a personal repository accepts a `User` actor is [U]**; the documented fallback is the repository-admin role. On a personal repository only the owner is admin, so the effect is the same.
- It is separate so that the PO's bypass applies to *this* rule only and never to Ruleset 1. That layering is [K], proven by test N-5.
- **Why not "1 required approval" instead?** It deadlocks PO-authored and emergency PRs, or makes the agent approve the PO's work. With Ruleset 2 the PO's own merge *is* the approval. This replaces IR-3A §7.4 item 4's suggestion that approvals become real controls.
- **Consequence:** the agent no longer merges. The PO clicks Merge; today's "Claude merges SHA-pinned" practice ends.

## 4. Workstream B: Environment `production`

| Setting | Proposed | Reason |
|---|---|---|
| Required reviewers | `Carloskfe` (PO) only | One reviewer is enough; up to 6 can be listed [D] |
| Prevent self-review | **Off, permanently while there is one human** | It stops whoever *initiated* the run from approving it, even as a required reviewer [D]. The PO merges, so the PO initiates: **On would deadlock every deploy.** It adds nothing against the agent, who is not a reviewer. (Corrects IR-3A.) |
| Admin bypass ("force deploy") | **Disallowed** | Allowed by default [D]. Not in the documented REST request body, so set in the UI and verify by reading back |
| Deployment branches | **Selected branches: `main`** (type *branch*, no tags) | See F-B1 |
| Wait timer / custom protection apps | None | Not needed |
| Secrets | `DEPLOY_SSH_KEY` | §5 |
| Variables | `DEPLOY_KEY_FINGERPRINT`, `DEPLOY_HOST_FINGERPRINT` (both public values) | §5, §6 |

**Availability [D]:** on Free, Pro and Team, required reviewers and the admin-bypass switch exist for **public repositories only**; on Free, Environment secrets also require a public repository. **Making the repository private would remove the gate.** A PO decision to change visibility must revisit this.

| ID | Finding |
|---|---|
| **F-B1** | **Do not choose "Protected branches only".** It follows classic branch protection rules, and "if no branch protection rules are defined… all branches can deploy" [D]. We would use a ruleset, not classic protection, so it could allow **every** branch. |
| **F-B2** | **A job that names a missing Environment makes GitHub create it with no protection, and it deploys at once** [K]. The same happens with a misspelled name. The Environment must exist and be verified *before* the workflow line merges. |
| **F-B3** | The branch rule matches `GITHUB_REF` [D]. `pull_request` runs use `refs/pull/N/merge`, so they are refused. `pull_request_target` and `workflow_run` can run as the default branch [K]; neither is used today. **A future workflow on `main` with either trigger must be reviewed as production-privileged.** |

**Shared identity.** If requester and reviewer are the same account and self-review is allowed, the approval is valid to GitHub. **Every approval today could also be given by the agent's token** through `POST …/pending_deployments`, so an approval record would not prove a human acted. This ends only with §7.

**Queued and superseded runs [D]:** by default one run may be pending per group, and a newer one cancels it. `queue: max` (up to 100) exists but is **not recommended**: queued older SHAs would fail the tip check anyway. Whether a run *awaiting approval* holds the group is [U]. The design is safe either way:

| Situation | Result under §6 |
|---|---|
| A waits; B merges; PO approves A | A is **refused before SSH** (superseded). B then asks for approval; B contains A |
| A waits; B and C merge | B may be cancelled by GitHub; only C can deploy. Nothing is lost: C contains both, and the approval shows C's SHA |
| A rejected | The run fails; the server is untouched. `main` still contains A, **so the next approved deploy ships it unless it is reverted** |
| Not approved within 30 days | The job fails [K]; server untouched |
| Old run re-run | Refused (not the tip) |

**Limitations:** the gate shows a SHA, not a diff; the PO must compare it with the reviewed release. It controls the Actions path only (§10).

## 5. Workstream C: SSH credential isolation

| ID | Finding |
|---|---|
| **F-C1** | A repository-level secret is available to **any** workflow pushed to **any** branch by someone with write access: GitHub says such users have "read access to all secrets" [D]. Protecting `main` does not protect this key. Fork PRs do not receive it [K]. |
| **F-C2** | If both scopes hold `DEPLOY_SSH_KEY`, the Environment value wins; if the Environment one is missing, the job **silently uses the repository one** [K]. Useful for transition, but it can mask a failed move. Hence the fingerprint check below. |
| **F-C3** | GitHub never returns a secret's value, so it can't be "moved". The value must be re-entered **by the PO** from their own copy, or replaced. `CLAUDE.md` says a key is at `/root/.ssh/deploy_key` on the server [U]; if so, a private root key sits on the host it opens. |
| **F-C4** | Removing the repository secret breaks `cd-staging.yml` (F-A7). **That is desirable.** Staging then needs its own Environment, and a key that is not production root, before any future arming. |

**Access after the change**

| Where the workflow runs | Can read the key? |
|---|---|
| Deploy job on `main`, after approval | Yes |
| Same job before approval, or rejected | No [D] |
| Feature branch or PR, with `environment: production` | No: branch rule refuses the job |
| Feature branch or PR, without it | No: not a repository secret any more |
| Fork PR | No |

**Rotate rather than re-enter [P].** The key has been repository-readable since May and is a permanent root credential. A **new** key, entered only in the Environment, removes the transition risk: old and new both work on the server until the PO has seen a deploy succeed with the new one.

**Safe verification without contacting production** (first step of the job, before any SSH):
```yaml
- name: Verify deploy credential (no network)
  env:
    KEY: ${{ secrets.DEPLOY_SSH_KEY }}
    WANT: ${{ vars.DEPLOY_KEY_FINGERPRINT }}
  run: |
    set -eu
    umask 077; f=$(mktemp); trap 'rm -f "$f"' EXIT
    printf '%s\n' "$KEY" > "$f"
    got=$(ssh-keygen -y -P '' -f "$f" 2>/dev/null | ssh-keygen -lf - | awk '{print $2}') || true
    [ -n "$WANT" ] && [ "$got" = "$WANT" ] || { echo "REFUSED: deploy key missing or not the expected key"; exit 1; }
```
It proves the right key is in scope and defeats the silent fallback. It does **not** prove the server accepts it. Only a deploy, or a PO-run SSH test, proves that. Metadata checks use secret *names* and `updated_at` only.

**Dedicated non-root identity: yes, later (DEP-1C).** A plain user in the `docker` group is effectively root [K], so a username change alone adds little. The useful control is a **forced command**: `restrict,command="/usr/local/sbin/noetia-deploy"` in `authorized_keys`, with a root-owned script outside the repository that accepts only a SHA and repeats the §6 checks. A stolen key could then only redeploy the current tip of `main`, not open a shell. It needs server changes, so it is a separate production-affecting mission.

## 6. Workstream D: exact-commit deployment

### 6.1 Decisions in the design
- **Identity:** `github.sha` (push event, immutable across re-runs).
- **Strict tip rule:** normal deploys require the SHA to **equal** the current tip of `main`, checked on the runner after approval and again on the server. This also proves membership of `main`. A merge landing *after* the check cannot change what is built.
- **No detached HEAD:** `git merge --ff-only <sha>` on the local `main` branch. It cannot go backwards, cannot overwrite local edits and keeps plain `git pull` in runbooks working. `reset --hard`, `clean` and force are never used.
- **Clean tree required:** modified tracked files fail the deploy. *(Today's `git pull` tolerates unrelated edits, so the PO must check before activation.)* Untracked files are not checked, because `.env.production` is one (F-A8). An untracked file under `services/*` could still enter a build (residual).
- **Server lock** (`flock`) closes F-A6. **Deployed log** in `.git/` is written only after health and migrations succeed; `HEAD` alone does not mean "live".
- Build, `--wait`, migration and prune commands are unchanged.

### 6.2 Proposed `cd.yml` [P] — NOT APPLIED

```yaml
name: CD

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy to production (Contabo)
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    environment:
      name: production          # must already exist, protected (F-B2)
      url: https://noetia.app
    steps:
      - name: Refuse unexpected or superseded commit (no production contact)
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -eu
          [ "$GITHUB_REF" = refs/heads/main ] || { echo "REFUSED: not main"; exit 1; }
          tip=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)
          [ "$tip" = "$GITHUB_SHA" ] || { echo "REFUSED: $GITHUB_SHA superseded by $tip"; exit 1; }

      # - Verify deploy credential (no network): step in §5

      - name: Deploy via SSH
        uses: appleboy/ssh-action@7eaf76671a0d7eec5d98ee897acda4f968735a17 # v1.2.0
        with:
          host: 84.247.140.175
          username: root
          port: 222
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          fingerprint: ${{ vars.DEPLOY_HOST_FINGERPRINT }}   # PO supplies; closes F-A4
          command_timeout: 30m                               # closes F-A3
          script: |
            set -eu
            SHA='${{ github.sha }}'
            cd /opt/noetia
            exec 9>/var/lock/noetia-deploy.lock
            flock -n 9 || { echo "REFUSED: another deploy is running"; exit 1; }

            echo "── Verifying approved commit ────────────────────"
            printf '%s\n' "$SHA" | grep -Eqx '[0-9a-f]{40}' || { echo "REFUSED: bad SHA"; exit 1; }
            [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "REFUSED: tracked files modified on server"; exit 1; }
            git fetch --no-tags origin main
            [ "$(git rev-parse FETCH_HEAD)" = "$SHA" ] || { echo "REFUSED: superseded or not the tip of main"; exit 1; }
            git checkout -q main
            git merge --ff-only "$SHA"
            [ "$(git rev-parse HEAD)" = "$SHA" ] || { echo "REFUSED: checkout is not the approved commit"; exit 1; }

            DC="docker compose --env-file .env.production -f docker-compose.server.yml"
            $DC build
            [ "$(git rev-parse HEAD)" = "$SHA" ] || { echo "REFUSED: checkout changed during build"; exit 1; }
            $DC up -d --remove-orphans --wait --wait-timeout 300
            $DC exec -T -e DB_HOST=db api npm run migration:run:prod
            printf '%s %s\n' "$(date -u +%FT%TZ)" "$SHA" >> .git/noetia-deployed.log
            docker image prune -f
            echo "DEPLOYED $SHA"
```
- `actions/checkout` is dropped: nothing on the runner uses it, so no repository code runs next to the key.
- An empty `fingerprint` disables host verification [K], so the PR must refuse an empty variable, as the key step does.
- `drone-ssh` is still downloaded at run time (F-A5). Replacing the action with the runner's own `ssh` and a pinned `known_hosts` removes it. Recommended with DEP-1C rather than in the smallest change.

### 6.3 Rehearsal [R]
The server script above, run verbatim under `dash` with only the two paths changed:

| Case | Result |
|---|---|
| Normal | deployed, HEAD = SHA, on `main` |
| Old run re-run / superseded SHA | refused, **0 docker calls** |
| Malformed or injected SHA (`abc; id`) | refused, 0 docker calls |
| Tracked file modified | refused, 0 docker calls |
| Untracked `.env.production` present | deploys; file untouched |
| `main` advances during build | approved SHA deployed, new one not |
| Migration fails | exit 1, log **not** written; retry of the same SHA succeeds |
| Second deploy while locked | refused, 0 docker calls |
| `main` rewritten (force push) | refused (`--ff-only`) |
| Fetch fails | exit 128, 0 docker calls |
| Forward deploy after a detached rollback | deployed, back on `main` |

*Not rehearsed:* the real SSH action, the Environment gate, real Docker, real migrations, GitHub's queue, and the runner tip check. The §5 key check was rehearsed with a throwaway key: correct key accepted; wrong key, empty key and empty variable refused. In my first run of this rehearsal the docker stub itself was faulty; results are from the corrected stub with the script unchanged.

### 6.4 Failure handling

| Fails at | State | Action |
|---|---|---|
| Any check, fetch or lock | Production unchanged | Fix and re-run, or deploy the newer run |
| Build | Checkout moved, containers unchanged | Fix forward, or re-run |
| `up` | Possibly mixed containers | Re-run same SHA, or §9 rollback |
| Migration | **New code live, schema old** (existing ordering, F-D4) | Re-run after the cause is fixed; §9 only if the code tolerates it |
| Connection lost | Remote may continue | The lock refuses a concurrent start; read the deployed log |

### 6.5 Findings

| ID | Finding |
|---|---|
| **F-D1** | Changing only `cd.yml`'s checkout line would miss the lock, dirty tree, timeout and runbooks. |
| **F-D2** | **Runbooks contradict the new model** and must change in the same mission: `CLAUDE.md` (manual deploy, auto-deploy), `incident-response.md` (manual deploy), `business/{en,es}/04-…` (P1 rollback = `git revert HEAD && git push` from the server), `secrets-rotation.md` ("test CI by pushing a trivial commit"). The server-side push would be blocked by Ruleset 1, and suggests the server **may hold push credentials** [U]. |
| **F-D3** | Plain `git pull` on the server (Whisper scripts, Grafana and sync docs) moves the checkout **without** deploying. With the new script that is harmless: deploys are tip-equal and verified. But a later *manual* build would ship unapproved code. |
| **F-D4** | Migrations run after the new code is live, and a code rollback does not reverse them. Unchanged by this design; recorded as a risk. |
| **F-D5** | **Same commit ≠ same artifact.** The api and web Dockerfiles copy only `package.json` and run `npm install`, with no lockfile, and base images use moving tags (`node:20-alpine`, `minio:latest`). A rebuild of an approved SHA, including a rollback, can produce different dependencies. CI tests the pnpm lockfile instead. True artifact identity needs lockfile builds and registry images by digest: **separate mission**. |

## 7. Workstream E: identity separation

Target: PO = owner, sole approver, sole merger. Agent = write code and open PRs; no administration, secrets, Environments, approvals or `main` updates.

| | **0. Fine-grained token on the PO account** | **1. Machine user + classic token** | **2. GitHub App (recommended)** |
|---|---|---|---|
| Cost | $0 | $0; the Terms allow **one** free machine account [D] | $0 |
| Permissions | Contents, PRs, Issues write; Actions, Checks read | Collaborator (write). **Fine-grained tokens do not work for a collaborator on someone else's repository** [D], so a broad classic token is needed (`public_repo`, without `workflow`) | Same list as option 0, chosen per permission [D] |
| Administration / Environments / Secrets | None granted | Personal-repo collaborators lack settings. But the REST docs give **collaborators** secret create/update [D]; `public_repo` may not suffice [U] | **None granted** (separate permissions [D]) |
| Approve deployments | Needs `Deployments: write` [D]: not granted. **But it acts as the PO**, the listed reviewer | Not a listed reviewer | Not granted, not a reviewer |
| Edit workflow files | Not granted | Without `workflow` scope, push refused [K] | Not granted (`Workflows` permission [D]) |
| Update `main` | Blocked by Ruleset 1 (direct). **Can merge**: Ruleset 2 sees the PO | Blocked by Ruleset 2 | Blocked by Ruleset 2 |
| Audit | **Indistinguishable from the PO** | Separate user | Separate `app[bot]` |
| Credential | Long-lived token | Long-lived token + password + 2FA + mailbox | Private key on the VM → tokens valid 1 hour [K] |
| Setup | 10 min | ~45 min | ~1 h, including a small token-minting helper and `gh`/git configuration |
| CI on its PRs | Yes | Yes | Yes [K] |

**Recommendation: option 2.** It is the only one that gives both fine-grained limits and a separate audit identity on a *personal* repository. Option 0 is a reasonable same-day interim: it removes administration and settings from the agent, but **not** the attribution or merge problem. Option 1 is the fallback.

- App permissions: Contents **RW**, Pull requests **RW**, Issues **RW**, Actions **R**, Checks **R**, Metadata **R**. Everything else none, notably Administration, Environments, Secrets, Workflows, Deployments, Webhooks. Installed on this repository only.
- Missions that edit workflows (#64, DEP-1B) then need a PO push or a temporary, revocable `Workflows` grant. **That friction is the control.**
- Merging an existing workflow change between branches may also be refused; expect it.

**The credential that matters is the old one.** Separation is real only after the PO:
1. logs `gh` out on the agent's VM and removes cached git credentials and browser sessions for the owner account there;
2. revokes the old OAuth token in GitHub settings;
3. uses another device or OS user for approvals, with 2FA;
4. **reviews installed GitHub/OAuth apps**, including any connector with write access.

The VM also holds a restricted offsite-backup SSH key; it is unrelated and unchanged. If the owner's session stays available to the agent's OS user, **options 1 and 2 are not enforceable**, only conventional. The repository-local agent settings also allow `git push *` without asking; tightening that is an optional extra guard, not a control.

## 8. Workstream F: activation sequence

**Categories:** **R** read-only · **S** repository settings (PO) · **W** workflow/documentation implementation · **X** production-affecting. Each of S, W and X needs its **own** PO authorization.

| # | Cat. | Who | Step | Pass condition / stop |
|---|---|---|---|---|
| 0.1 | R | PO | Export current state (rulesets, Environments, secret **names**); confirm own copy of a working root SSH path and Contabo console | Emergency access works **without** GitHub |
| 0.2 | R | PO | Server: `cd /opt/noetia && git status --porcelain --untracked-files=no; git branch --show-current; git rev-parse HEAD; command -v flock` | Empty; `main`; current release SHA; path printed |
| 0.3 | R | PO | Server: host key fingerprint; list `authorized_keys` entries by comment/fingerprint | Recorded; unknown entries explained |
| 0.4 | R | agent | No CD running; `main` SHA recorded | Idle |
| 0.5 | R | PO | Fresh backup, and a snapshot slot | As IR-3A §9 |
| **1** | S | PO | Create **Ruleset 1** | Read back equals §3.1; `bypass_actors: []` |
| 1T | S | PO authorizes | Negative tests N-1, N-2 | Refused. **If a test is wrongly accepted it deploys**: see below |
| **2** | S | PO | Create Environment `production` with every §4 setting | Read back: reviewer, `main` only, admin bypass off |
| **3** | X | PO | Generate the new key on the PO's machine; add the **public** half to the server, keep the old one | PO's own SSH login with the new key succeeds |
| **4** | S | PO | Put the new private key in the Environment secret; set the two fingerprint variables. **Keep the repository secret** | Name listed at Environment scope. Today's deploy path is unaffected |
| **5** | W | agent (authorized DEP-1B) | Draft PR: §6.2 `cd.yml`, runbooks (F-D2). Merge **with, or as, a planned release** | PA review; `environment: production` spelled exactly |
| **6** | X | PO | PO merges. The run must **wait**. First **reject** it | Server untouched (0.2 repeated, container start times unchanged): gate proven |
| **7** | X | PO | Re-run the same run; check the SHA; **approve** | `DEPLOYED <sha>`; server HEAD and log equal the SHA; health probes pass |
| **8** | S | PO | Delete the **repository** secret | Only the Environment copy is listed |
| **9** | X | PO | Remove the old public key from `authorized_keys` **after step 12 or the next successful deploy** | PO root path still works |
| **10** | S | PO | Create the GitHub App; move the agent to it; revoke the old token (§7) | Agent's effective permission is not admin |
| **11** | S | PO | **Ruleset 2** | N-5, N-6 |
| **12** | R/X | both | Remaining negative tests; next release through the full path | All pass |
| **13** | S | PO | Phase 2 required checks after the combined release | §3.2 |

**Why this order.** Ruleset first: cheapest, reversible, no effect on deploys. Environment before the workflow (F-B2). New key in the Environment *before* the workflow needs it, with the repository secret kept until success, so no step leaves the project unable to deploy. (IR-3A's order would move the secret first and break the next deploy.)
**If step 6 fails to wait:** it is a real deploy of `main`. That is why step 5 rides on a planned, already approved release and not on a "harmless" test.

### Negative tests

| Test | Action | Expected | Risk if the control fails |
|---|---|---|---|
| N-1 | **Dry validation first:** read `rules/branches/main` for effective rules. Then, only if authorized, push an *empty* commit to `main` as the owner | Rejected | It deploys (no content change). **Authorize explicitly, or accept the read-back alone** |
| N-2 | Attempt to delete `main` or force-push | **Do not test live**; read back only | Catastrophic |
| N-3 | Throwaway branch, push-triggered workflow with `environment: production` and only `echo` | Job refused by branch rule; no secret | `echo` only |
| N-4 | Throwaway branch workflow **without** Environment, printing only whether the secret is empty (`[ -z ]`), after step 8 | Empty | Prints yes/no, never a value |
| N-5 | Agent identity: merge a PR whose base is `main` | Refused (Ruleset 2). **Run only while a release is ready**, or accept the read-back | It would merge, then **wait** at the gate |
| N-6 | Agent identity: edit a ruleset, read or write Environment secrets, approve a pending run, push a workflow file | 403/refused for each | Harmless no-op payloads |
| N-7 | Re-run an old CD run after a newer release, PO approves | Refused before SSH | Refused again on the server |

### Recovery

| Problem | Recovery |
|---|---|
| Approval impossible (reviewer locked out, self-review on by mistake) | PO corrects the Environment; rejected run can be re-run. Server untouched |
| Fingerprint step refuses | Environment secret missing or wrong: PO re-enters it. Production not contacted |
| Server rejects the new key | Old key is still authorized: PO fixes `authorized_keys`, or temporarily enters the old key **and its fingerprint** |
| Host fingerprint mismatch | Treat as a possible attack until the PO verifies it from the console. Then correct the variable |
| Dirty-tree refusal | PO inspects `git diff` on the server. **Never `reset --hard` or `clean` blindly** (F-A8) |
| Ruleset blocks a needed merge | Fix the check; otherwise PO sets the ruleset to Disabled, records why, re-enables |
| Workflow broken | Revert PR (gated by the *broken* workflow), or manual deploy (§9) |

**Full rollback of DEP-1:** revert the workflow PR (this deploys) → **restore a repository secret first** if step 8 is done, because the old workflow has no Environment → then delete Rulesets 2 and 1 → delete the Environment last. Deleting an Environment deletes its secrets, and deleting it while the workflow still names it triggers F-B2.

## 9. Rollback and emergency access

1. **Default: revert PR.** A new forward commit through CI, PO merge and approval. About 5–10 minutes plus CI. Migrations are not reversed; check that the reverted code works with the current schema.
2. **Urgent: PO manual deploy over SSH of a previously deployed SHA.** Independent of GitHub. Draft runbook for DEP-1B [P]:
```
cd /opt/noetia
tail .git/noetia-deployed.log        # choose an earlier, successful SHA
flock -n /var/lock/noetia-deploy.lock bash -c 'set -eu; S=<40-hex>; grep -q " $S$" .git/noetia-deployed.log; git diff --quiet $S HEAD -- services/api/src/migrations || { echo "MIGRATIONS DIFFER: STOP"; exit 1; }; git checkout -q --detach $S; C="docker compose --env-file .env.production -f docker-compose.server.yml"; $C build; $C up -d --remove-orphans --wait --wait-timeout 300'
```
   - The detached HEAD is deliberate. While detached, plain `git pull` fails, but **`git pull origin main` silently moves forward** [R]: do not run it. The next gated deploy returns to `main` [R].
   - No migration step: older code has nothing to apply, and reversing is never automatic.
   - Before the first gated deploy the log is empty; the PO records the known-good SHA at step 0.2.
   - Follow with a revert PR, or the next gated deploy brings the bad commit back.
   - Not yet rehearsed against real Docker. S-ALT's web-first rule (`infra/tests/s-alt/ROLLOUT.md`) still applies when a rollback crosses `c15f3bf`.
3. **Optional later:** `workflow_dispatch` with a SHA input, `main` only, same Environment, same "in the deployed log" and migration checks. Not in the smallest mission: it is a second way to production.
4. **Break-glass:** Contabo console/VNC and the PO's root SSH key, kept off the agent's VM and **not** dependent on GitHub. Every use is recorded in the release issue.

## 10. Threat model and residual risks

"Before" = after steps 1–9 with the shared login. "After" = also steps 10–11.

| Threat | Before separation | After separation | Residual |
|---|---|---|---|
| Accidental direct or force push | **Blocked** | **Blocked** | Owner can edit the ruleset |
| Accidental merge | Merge lands; deploy **waits** | Merge **blocked** for agent; PO's own mistake waits | Merged content ships with the next approval unless reverted |
| Unauthorized agent merge | **Not prevented** | **Blocked** (N-5 proves it) | Depends on the old login being gone |
| Agent approves a deployment | **Not prevented** | **Blocked** | Same |
| Administrator bypass | Silent bypass off; admin can change settings | Same, PO only | Owner account takeover defeats everything: 2FA essential. Detection through audit only |
| Shared credentials | **Open** | Closed if §7 items 1–4 are done | Same VM/OS user would reopen it |
| Malicious workflow on a branch | Key **unreachable** (step 8) | Same, and the agent can't push workflows | Other future repository secrets |
| Malicious workflow merged to `main` | PO approval sees a SHA, not intent | PO must merge it too | **Review any `.github/` change**; a job on `main` naming the Environment gets the key once approved |
| Compromised third-party action | Commit pin | Same | Runtime binary download (F-A5). Actions not restricted to an allow-list |
| Compromised deploy key | **Root on production**, unchanged | Same | Old key stays valid until step 9. DEP-1C forced command is the fix |
| Wrong SHA deployed | **Blocked twice** [R] | Same | F-D5: commit, not artifact. Untracked server files |
| Concurrent deploys | Group + `flock` [R] | Same | Manual deploys that ignore the lock |
| Host impersonation | Blocked if the fingerprint is set | Same | Empty variable disables it |
| Production access outside Actions | **Not covered** | **Not covered** | PO root SSH, all `authorized_keys`, Contabo, staging and AutoGuildX on the same host and Docker daemon, offsite-backup key, Traefik |
| Mobile distribution (EAS/OTA) | **Not covered** | **Not covered** | Separate credential and path |
| Repository made private | Gate **lost** on Free/Pro/Team [D] | Same | Process rule |
| GitHub outage | No gated deploy | Same | §9 item 2 |

**Enforceability.** Today **none** of these controls exists. Each becomes *enforced* only when its read-back and negative test pass. Before step 10, controls against the agent itself are **conventions**.

## 11. Costs and operational complexity

| Item | Spend | Effort [estimate] |
|---|---|---|
| Rulesets, Environment, App | **$0** | PO 60–90 min in total |
| DEP-1B workflow + runbooks | $0 | 0.5 agent-day + PA review |
| Activation, supervised | $0 | PO ~1 h, around one planned release |
| DEP-1C forced command | $0 | 0.5–1 agent-day + PO server work |
| Each release | $0 | +1 PR merge and +1 approval by the PO |

No paid feature is needed. The main recurring cost is that **releases wait for the PO**.

## 12. Questions requiring PO decisions

| ID | Decision | Recommendation (the PO decides) |
|---|---|---|
| **P-1** | Adopt Option C as refined here | Yes |
| **P-2** | Phase 1 required checks: the five green ones, or none | The five |
| **P-3** | Agent identity: App, machine user or interim token | App |
| **P-4** | PO alone merges to `main` (Ruleset 2) | Yes |
| **P-5** | Strict tip rule (a superseded approval is refused) or allow older ancestors | Strict |
| **P-6** | Rotate the key instead of re-entering it | Rotate |
| **P-7** | Remove the owner login from the agent's VM; where the PO approves from | Yes; separate device with 2FA |
| **P-8** | DEP-1C (forced command) timing | Soon after, separately |
| **P-9** | F-A7: 12 branches with the production-root staging workflow | Leave inert; step 8 disarms them. Never create a `staging` branch before it |
| **P-10** | F-D5 (reproducible artifacts) | Separate mission |
| **P-11** | Run live N-1/N-5, or accept read-backs | Read-backs for destructive cases; N-5 during a release |
| **P-12** | Activate before, or with, the combined release | Settings (1–4) before; workflow with that release |
| **P-13** | Confirm the repository stays public | Required by this design |
| **P-14** | Add `.env.production` to `.gitignore` (F-A8) | Yes, inside DEP-1B |

**Governance observations (not blocking a design, must be settled before activation):** "CI/CD must not be modified except by a mission that specifically authorizes it" applies to DEP-1B. `CLAUDE.md`'s "push after every commit" must be read as *push to a branch*. `secrets-rotation.md` and the P1 rollback text contradict Ruleset 1 (F-D2). I chose no interpretation and edited nothing.

## 13. Suggested smallest implementation mission

**DEP-1B — implementation only, no activation:**
- `cd.yml` as §6.2, with the §5 step; runner checks refuse empty variables;
- runbook corrections (F-D2) and the §9 rollback runbook; `.gitignore` line if P-14;
- a small test harness reproducing §6.3, run locally;
- Draft PR, PA review, **merge only with a planned release and explicit PO instruction**.

Settings steps (1–4, 8, 10, 11) are performed **by the PO**, with read-only verification by the agent. **If only one thing is done now, create Ruleset 1:** free, about 5 minutes, reversible, no workflow change, and it removes direct pushes, the route used by 46 of the last 60 updates.

## 14. Confirmation: no operational changes

**Performed:** read-only `gh api`/`gh run` queries, `git fetch`, reading public GitHub documentation and the public `appleboy/ssh-action` source, a local rehearsal in a disposable scratch directory, one documentation commit on a new branch, one Draft PR.

**Not performed:** settings, ruleset or Environment changes · secret read, export, move, rotation or deletion (names and dates only) · identity, App, token or credential creation · workflow, source, dependency or configuration changes · merge · deployment · workflow dispatch, re-run or approval · production or staging SSH · SQL, migrations or server commands · infrastructure change · spending.

**Publication safety [M]:** this branch is based on the IR-3A documentation branch, and its Draft PR targets that branch. `ci.yml` runs only for PRs into `main`; `cd.yml` only on push to `main`; neither branch contains `cd-staging.yml`. No workflow matches, so no E2E run can reach production.

**STOP gates**

| Gate | Outcome |
|---|---|
| Settings not safely inspectable | Four areas listed as [U] in §1; not bypassed; assigned to the PO as preconditions |
| Permission change, secret value, workflow change, production connection, source change | Not needed |
| Unexpected deployment trigger | F-A7: known, inert, reported |
| Governance contradiction | Reported in §12; affects activation, not design |
| Paid feature | None |

**Sources [D]:** GitHub Docs, read 2026-11-25: *About rulesets*; *Available rules for rulesets*; *Creating rulesets for a repository*; REST *rules*, *environments*, *secrets*, *workflow runs*; *Deployments and environments*; *Reviewing deployments*; *Control workflow concurrency*; *Permission levels for a personal account repository*; *Permissions required for GitHub Apps*; *Managing personal access tokens*; *Secure use reference*; *Terms of Service* §B.3.

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.** The Product Owner retains final authority over all deployment-security and release decisions.
