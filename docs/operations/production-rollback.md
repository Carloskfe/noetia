# Production rollback and manual deploy (DEP-1)

> **STATUS: NOT ACTIVE. Never run on production or staging.** This applies only after the Product Owner records
> DEP-1 activation ([production-deployment.md](production-deployment.md)). It has been rehearsed offline only, with
> stubbed Docker. **Until activation, use [incident-response.md §7](../incident-response.md#7-auto-deploy-cicd-failing).**

Every production use needs a Product Owner decision. Run as the PO, over the PO's own root SSH path, which must not
depend on GitHub. If SSH is down, use the Contabo console ([incident-response.md §9](../incident-response.md)).

## 1. What is running? Three different facts

| Fact | How to read it | What it does not tell you |
|---|---|---|
| **Checkout** | `git -C /opt/noetia rev-parse HEAD` | Whether it was built. A `git pull` or a failed build moves it without deploying |
| **Last success** | `tail -5 /opt/noetia/.git/noetia-deployed.log` (`time SHA deploy\|rollback\|baseline`) | Whether a *later* attempt failed halfway |
| **Containers** | `docker ps --format '{{.Names}} {{.CreatedAt}} {{.Status}}'` and `docker inspect -f '{{.Image}} {{.State.StartedAt}}' noetia-api-1 noetia-web-1` | The commit: images carry no commit label |

Containers created **after** the last log line came from an attempt that did not finish. Treat the running code as
unknown, and read that attempt's Actions log. A log line is trustworthy only when the containers are not newer
than the recorded deploy.

## 2. Choose the path

1. **Default: revert PR.** Goes forward through CI, PO merge and Environment approval. Use it whenever the site can wait.
2. **Urgent: the script below**, to a commit already in the log. Then a revert PR is still required (section 5).
3. **Neither, if migrations or `docker-compose.server.yml` differ.** The script refuses. Stop and plan a forward fix;
   restoring a database is a separate PO decision that loses newer writes. The S-ALT release (`c15f3bf`) changed
   `docker-compose.server.yml`, so rollbacks across it are refused; that needs `infra/tests/s-alt/ROLLOUT.md`.

## 3. Install the script (one line, from already fetched history)

Never paste multi-line text over SSH. `<RELEASE>` is a reviewed commit that contains this file.
```bash
git -C /opt/noetia show <RELEASE>:docs/operations/production-rollback.md | sed -n '/^# BEGIN ROLLBACK SCRIPT$/,/^# END ROLLBACK SCRIPT$/p' > /root/noetia-rollback.sh
```
Keep it outside the checkout: older commits do not contain it.

```sh
# BEGIN ROLLBACK SCRIPT
main() {
  set -eu
  refuse() { echo "REFUSED: $1"; exit 1; }
  g() { git -c gc.auto=0 -c maintenance.auto=false "$@"; }
  SHA=${1:-}; MODE=${2:-check}
  LOG=.git/noetia-deployed.log
  case "$MODE" in check|apply) ;; *) refuse "mode must be check or apply" ;; esac
  printf '%s' "$SHA" | grep -Eqx '[0-9a-f]{40}' || refuse "malformed SHA"
  cd /opt/noetia
  exec 9>/var/lock/noetia-deploy.lock
  flock -n 9 || refuse "another deploy or rollback is running"
  [ -s .env.production ] || refuse ".env.production missing or empty"
  dirty=$(g status --porcelain --untracked-files=no) || refuse "git status failed"
  [ -z "$dirty" ] || refuse "tracked files are modified on the server"
  grep -q " $SHA " "$LOG" || refuse "target was never recorded as a successful deploy"
  g merge-base --is-ancestor "$SHA" refs/heads/main || refuse "target is not in the history of main"
  tracked=$(g ls-tree --name-only "$SHA" -- .env.production) || refuse "cannot read the target"
  [ -z "$tracked" ] || refuse "target tracks .env.production"
  # Compare with local main, the newest commit this server may have migrated to.
  g diff --quiet "$SHA" refs/heads/main -- services/api/src/migrations || refuse "migrations differ: forward fix only"
  g diff --quiet "$SHA" refs/heads/main -- docker-compose.server.yml || refuse "docker-compose.server.yml differs: needs its own plan"
  echo "CHECKS PASSED for $SHA"
  [ "$MODE" = apply ] || { echo "Nothing changed (check mode)."; exit 0; }
  verify() {
    [ "$(g rev-parse HEAD)" = "$SHA" ] || refuse "checkout is not the target"
    dirty=$(g status --porcelain --untracked-files=no) || refuse "git status failed"
    [ -z "$dirty" ] || refuse "tracked files changed"
  }
  g checkout -q --detach "$SHA"
  verify
  docker compose --env-file .env.production -f docker-compose.server.yml build
  verify
  docker compose --env-file .env.production -f docker-compose.server.yml up -d --remove-orphans --wait --wait-timeout 300
  # No migrations: none may differ. No prune: keep the images for diagnosis.
  verify
  printf '%s %s rollback\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" >> "$LOG"
  echo "ROLLED BACK to $SHA"
}
main "$@"
# END ROLLBACK SCRIPT
```

## 4. Run

```bash
sh /root/noetia-rollback.sh <SHA> check
sh /root/noetia-rollback.sh <SHA> apply
```
- `check` changes nothing except creating the lock file.
- Before `apply`, also confirm against the **database**, which the script cannot see:
  `docker compose -f docker-compose.server.yml exec -T db psql -U noetia -d noetia -c "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3;"`.
  Every migration listed must exist in the target commit. A migration run by hand would be visible only here.
- Then verify: `docker ps` (all healthy), `https://noetia.app/api/health`, the home page, one book with audio, login.

| Fails at | State | Next |
|---|---|---|
| Any `REFUSED` before "CHECKS PASSED" | Nothing changed | Resolve the cause. Never `git reset --hard`, `git clean` or `checkout -f` |
| Build | Checkout detached at the target; **containers unchanged** | Re-run, or `git checkout main` (safe: nothing was rebuilt) |
| `up` / unhealthy | Possibly mixed containers; **no log line** | Re-run the same target, or roll back further, or forward fix |
| Lock held | Someone else is deploying | `fuser -v /var/lock/noetia-deploy.lock`. Wait. Never delete the lock file: that would allow a second run. Killing a run during `up` or a migration is a PO decision |

## 5. Returning to normal

After a rollback the checkout is **detached**. Until the next gated deploy:
- do **not** run `git pull origin main` (it moves the checkout forward silently) and do not build by hand;
- do **not** re-run or approve the bad commit's Actions run: while it is the tip of `main` it would be accepted again;
- merge a **revert PR**. Its gated deploy returns the checkout to `main` by itself.

## 6. Manual deploy when GitHub Actions is unavailable

Uses the **same** server script as the workflow, so every check applies. It needs `git fetch` to work. `<SHA>` is the
exact commit the PO approved. The script file is taken from that commit: review it before running.
```bash
cd /opt/noetia && git fetch --no-tags origin refs/heads/main && git show <SHA>:.github/workflows/cd.yml | sed -n '/# BEGIN SERVER SCRIPT/,/# END SERVER SCRIPT/p' | sed 's/^            //' | sed 's/\${{ github.sha }}/<SHA>/' > /root/noetia-deploy.sh && sh /root/noetia-deploy.sh
```
If GitHub itself is unreachable, no new commit can be deployed; rollback (section 3) still works.

## 7. `.env.production` reminder

It is untracked and **not** in `.gitignore`. On the server never run `git add .`, `git add -A`, `git clean`,
`git stash -u`, `git reset --hard` or `git checkout -f`. **Do not "fix" this with an ignore rule alone:** Git
refuses to overwrite an untracked file but *silently overwrites an ignored one* when a commit tracks that path. The
scripts refuse such commits; a plain `git pull` does not.

## 8. Not yet validated (PO-supervised, before relying on this)

Real Docker builds and health; real build duration inside 30 minutes; server `git`, `flock`, `fuser`, `sh` and
lock-path behaviour; that old commits still build with today's dependencies and base images (builds are not
locked, so a rollback may produce different dependencies); the §4 database check; a supervised rollback and return.
