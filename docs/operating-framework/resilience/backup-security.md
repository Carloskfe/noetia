# Backup Security

**NOF-003** · Requirements. No cryptography implemented.

## What a Noetia backup contains

A PostgreSQL dump holds email addresses, password hashes, OAuth identifiers, refresh-token
records, Stripe customer/subscription IDs, permanent ownership, token history, private
fragments and notes, and club discussions. It is, in substance, **the entire user dataset in
one file**.

Today those files sit **unencrypted** on the production host.

## Encryption

**In transit:** any off-site transfer over TLS.

**At rest:** required for every copy leaving the host. Recommended: encrypt **before** upload
(client-side), so the storage provider never holds plaintext and provider compromise does not
become Noetia's breach.

**Key management is the hard part** — a key stored only on the server dies with the server,
and an encrypted backup with an unrecoverable key is not a backup. The key must live in the
same off-server vault as the secrets, and the runbook must state where. `PRIVACY REVIEW
REQUIRED`.

## Backup credentials — least privilege

The backup process should hold **write/append** rights to the backup destination and nothing
more:

- backup credentials must **not** be production admin credentials;
- compromise of the destination must not yield production access;
- **production compromise must not permit deletion of history** — this is what immutability
  is for (DR-13).

## Immutability

Recommended for at least the weekly/monthly recovery points: object-lock or
write-once retention on the off-site store. Without it, an attacker with host access deletes
production **and** its backups in one action — which is precisely today's exposure, since the
only copies live on the host being attacked.

## The gitignore defect — fix first

`git check-ignore` confirms **neither `.env.production` nor `.env.staging` is ignored**;
`.gitignore:13-15` covers only `.env`, `.env.local`, `.env.*.local`.

`/opt/noetia` is a git checkout that contains `.env.production`. A `git add .` there stages
live secrets: `JWT_SECRET`, `DB_PASS`, MinIO keys, Stripe keys, SMTP credentials, OAuth
secrets.

`CLAUDE.md:499` instructs operators to "confirm with `.gitignore` before any `git add .`" —
following that instruction today produces **false assurance**, because inspecting `.gitignore`
reveals no rule and an operator may reasonably conclude the generic `.env` entry covers it.

**IG-DR-02.** One-line fix, highest value-per-character in this document. NOF-003 is
documentation-only and does not apply it.

## Access control

Backup storage credentials belong in the same vault as production secrets, with access limited
to those authorized to declare a disaster. Restores must be logged: who, when, which recovery
point, and why — restoring a database is as consequential as any production mutation.

## Retention versus deletion

An immutable backup and a user's deletion request are in tension. See
[retention-policy.md](retention-policy.md) §Privacy. `LEGAL REVIEW REQUIRED`.
