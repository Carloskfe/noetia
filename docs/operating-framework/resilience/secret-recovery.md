# Secret Recovery

**NEM-009** · How authorized operators recover the credentials a clean-host rebuild needs.
**Names only — no values, ever.**

## Why this ranks above the database

A perfect PostgreSQL dump is **inert** without `DB_PASS`. In the recovery order, secrets come
second — after infrastructure, before data — because nothing starts without them. Today
`.env.production` exists **only on the host being recovered** (IG-DR-05).

## What must be recoverable

| Class | Names | Recovery source |
|---|---|---|
| Database | `DB_PASS` | Vault. Recoverable only if the dump was taken with a known password; a changed password makes an old dump unreadable by the app until reconfigured |
| Auth | `JWT_SECRET` | Vault. **Rotating it invalidates every session** — acceptable in a disaster |
| Object storage | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | Vault. Must match the restored MinIO or presigned URLs fail |
| Search | `MEILI_MASTER_KEY` | Vault, or regenerate — index is rebuildable |
| Social tokens | `SOCIAL_TOKEN_SECRET` | Vault. **Loss orphans every AES-encrypted token in Redis**; users must re-link accounts |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Stripe dashboard — regenerable, but the webhook secret changes and the endpoint must be re-registered |
| Email | `SMTP_*` / Resend key | Resend console — regenerable |
| OAuth | Google, Facebook, Apple client IDs and secrets | Provider consoles — regenerable; **callback URLs must be re-registered** |
| Deploy | `DEPLOY_SSH_KEY` | GitHub secret + server `authorized_keys` — regenerate both |
| Backups | `BACKUP_AGE_RECIPIENT` (public), age **private** key, `rclone` credentials | Vault. **The private key is the one that cannot be regenerated** |
| Infrastructure | Contabo, Cloudflare, GitHub, registrar logins | Vault + MFA recovery codes |

## The one that cannot be regenerated

Everything above except the **age private key** can be reissued from a provider console. The
age private key cannot: lose it and every off-site backup becomes permanently unreadable.

It must live in the operator's vault, **never on the server**, and its location — not its
value — must be recorded in the DR runbook.

## Recovery procedure

1. Authenticate to the credential vault (MFA recovery codes must themselves be recoverable —
   a vault locked behind a phone lost in the same incident is not a vault).
2. Retrieve `.env.production`; place at `/opt/noetia/.env.production`, `chmod 600`.
3. Retrieve the age private key to the **workstation** performing the restore, never the server.
4. Decrypt the backup locally, or restore on a machine holding the key.
5. Re-register anything provider-side that a new host invalidates: Stripe webhook endpoint,
   OAuth callbacks, deploy key.
6. Verify `git check-ignore -v .env.production` returns a match before any `git` operation in
   `/opt/noetia`.

## Rotation after an incident

If compromise is suspected, rotate per [`secrets-rotation.md`](../../secrets-rotation.md).
**Rotation requires separate authorization** (NEM-009 §28) and is not part of routine recovery.
