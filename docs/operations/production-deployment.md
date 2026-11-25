# Production deployment protection (DEP-1)

> **STATUS: NOT ACTIVE. PO approval is required for every step below.** Until the PO records activation here, the
> current procedure is in force: a push to `main` deploys immediately, with `git pull origin main`.
> **This change must not be merged before steps 1–4 pass.**

## Current versus after activation

| | **Current (in force)** | **After activation** |
|---|---|---|
| Trigger | Push to `main` deploys at once | Push to `main` **waits** for PO approval |
| What deploys | Whatever `main` is at that moment | Exactly the run's commit; refused if no longer the tip |
| Re-running an old run | Deploys the newest `main` | Refused |
| Server checks | None | Lock, clean tracked files, fast-forward only, exact SHA, `.env.production` guard |
| Evidence of success | Green run | `/opt/noetia/.git/noetia-deployed.log`, written after health **and** migrations |
| Host / key verification | None | Both fingerprints, mandatory |
| Rollback | Revert merge | Revert PR, or [production-rollback.md](production-rollback.md) |

Build, `up --wait` and migrations are unchanged. Migrations still run **after** the new code is live.

## Activation checklist

Each step is a **separate PO approval**. Stop at the first failure. S = GitHub settings, X = production-affecting.

| # | Type | Step | Pass condition |
|---|---|---|---|
| 0 | read-only | PO on the server: tracked files clean; branch is `main`; `command -v flock fuser`; record live SHA. PO root SSH and Contabo console work without GitHub. Backup and free snapshot slot | All true. A dirty tree would make every deploy refuse |
| 1 | S | Create ruleset `main-baseline` (DEP-1A §3.1) | Read-back equal; empty bypass list |
| 2 | S | Create Environment **`production`** (exact spelling): reviewer = PO; self-review prevention **off**; admin bypass **off**; **Selected branches: `main`** (never "Protected branches only") | `gh api repos/Carloskfe/Noetia/environments/production` shows reviewer and branch policy; UI shows admin bypass off. **An Environment name alone guarantees nothing** |
| 3 | X | New deploy key made on the PO's machine; public half added to the server, old one kept | PO logs in with the new key |
| 4 | S | Environment secret `DEPLOY_SSH_KEY`; Environment variables `DEPLOY_KEY_FINGERPRINT`, `DEPLOY_HOST_FINGERPRINT` (see below). Keep the repository secret | Names listed at **Environment** scope |
| 5 | X | Add the baseline log line (see below) | `tail` shows the live SHA |
| 6 | X | Merge this change with, or as, an authorized release. The run must **wait**. Reject it once | Server untouched. **If it does not wait, it has deployed** |
| 7 | X | Re-run, compare the SHA, approve | `DEPLOYED <sha>`, log line, health probes |
| 8 | S | Delete the **repository** secret | `gh secret list` no longer shows it; `gh secret list --env production` does. **A matching fingerprint proves which key was used, not its scope: only this listing proves scope** |
| 9 | X | Remove the old public key after the next successful deploy | PO root path still works |
| 10 | S | Agent identity separation (DEP-1A §7) | Agent token is not admin |
| 11 | S | Ruleset `main-po-updates-only` | **ACTIVATION GATE, behaviour unverified**: DEP-1B report §6 |

**Fingerprints** are public values in the form `SHA256:` + 43 characters, no trailing `=` or newline.
- Key: `ssh-keygen -lf new_key.pub`.
- Host: run **on the server console**, not over the network. The SSH action uses the first algorithm both sides
  support in the order **ECDSA, RSA, Ed25519**. Use
  `ssh-keygen -lf /etc/ssh/ssh_host_ecdsa_key.pub` if the server offers an ECDSA key. An Ed25519 fingerprint
  would then make every deploy fail (safely). Check `sshd -T | grep -i hostkey`.

**Baseline line** (step 5; `<SHA>` is the live commit the PO confirmed). Without it, the first rollback has no target:
```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) <SHA> baseline" >> /opt/noetia/.git/noetia-deployed.log
```

## After activation: daily use

1. The PO merges. The run waits. The approval screen shows a SHA, not a diff: compare it with the reviewed release.
2. Approve only one release at a time. If a newer merge lands, the older run is refused; approve the newer one.
3. Rejecting a run does not remove the commit from `main`: the next approved deploy ships it unless it is reverted.
4. Any change under `.github/` is a production-privileged change. Never rename the Environment, delete it while the
   workflow names it, or make the repository private without revisiting DEP-1.

5. Other runbooks use a plain `git pull` on the server (Whisper, Grafana, sync scripts). It moves the checkout without
   deploying, so a later *manual* build would ship unapproved code, and rollback checks may refuse more than needed.
   Never use it while a deploy runs or after a rollback.

| Message | Meaning |
|---|---|
| `not the tip of main` | Superseded. Approve the newer run |
| `deploy key missing` / `not the expected deploy key` | Environment secret missing or wrong (a repository secret may have been used) |
| `…FINGERPRINT missing or malformed` | Variable unset. Nothing was contacted |
| `host key fingerprint mismatch` | Treat as a possible attack until checked from the console |
| `tracked files are modified` | PO reads `git diff` on the server. Never `reset --hard` or `clean` |
| `another deploy or rollback is running` | See production-rollback.md §4 |
| Timeout (30 min command / 45 min job) | **The server may still be working.** Check the lock before doing anything |

## Undoing DEP-1

Restore a repository secret **first** (if step 8 was done), then revert the workflow, then remove the rulesets, and
the Environment last. Deleting an Environment deletes its secrets.
