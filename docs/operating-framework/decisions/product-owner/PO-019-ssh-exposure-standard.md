# PO-019 — SSH Exposure Standard

**Status:** `DECIDED` · **Domain:** Security, Operations · **Recorded by:** NEM-009

> Noetia production infrastructure intentionally uses **TCP port 222** for SSH administration,
> not the default port 22. This is a deliberate production-hardening decision.

Port 222 is canonical for: production · disaster-recovery infrastructure · clean-host
reconstruction · firewall configuration · server initialization tooling · operational runbooks ·
SSH examples · deployment and recovery automation.

**Port 222 is not an anomaly to normalize back to 22.** Do not open port 22 merely because it
is the SSH default. Changing the canonical port requires a future explicit Product Owner
decision.

## What this corrected

`infra/server/init.sh` opened UFW `22/tcp` while production sshd listens on 222. The defect was
never the production port — it was that **disaster-recovery tooling did not reproduce the
approved production posture.** A rebuild during a real incident would have firewalled the
operator out of the host they were recovering (DR-19).

`init.sh` now configures sshd for 222, validates with `sshd -t`, opens UFW 222 **before**
restarting sshd, and instructs the operator to prove a second session before closing the first.

## Temporary bootstrap

If a provider delivers a fresh host reachable only on 22, that access is a
**`TEMPORARY RECOVERY BOOTSTRAP`**: documented, used only until port 222 is verified from a
second session, then closed with `ufw delete allow 22/tcp`. **Never a permanent fallback.**

## Verification

Repository scan for operational SSH references found exactly one incorrect assumption
(`init.sh:37`), now corrected. Confirmed posture: **SSH PORT 222**. Live production SSH was not
altered by NEM-009.
