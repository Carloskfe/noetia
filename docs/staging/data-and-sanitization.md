# Staging Data & Sanitization Policy

Staging must never casually contain production PII. Default staging data is **synthetic**; production-derived data is allowed only after **sanitization**.

## Default: synthetic data (§17)
Staging is seeded with:
- synthetic users (email/password test accounts);
- test books + **public-domain** content (safe to use);
- Stripe **test** customers/subscriptions;
- synthetic clubs/fragments/notes;
- controlled fixtures.

**Do NOT auto-clone production into staging.** Production holds real beta-user and business data.

## When production-like data is needed (migration/restore rehearsal)
Use the documented pipeline — never a raw copy:
```
production backup → isolated restore → SANITIZE / ANONYMIZE → staging validation
```
A **schema-only** dump is preferred when only structural/migration compatibility is being tested (no user data at all).

## Categories requiring removal or transformation before any production-derived dataset enters staging (§18)
| Category | Action |
|----------|--------|
| Names | anonymize (e.g. `User 12ab`) |
| Email addresses | replace with `user+<hash>@staging.invalid` (non-deliverable) |
| OAuth identities (`provider`, `providerId`) | null / synthetic |
| Password hashes | replace with a single known test hash or null |
| Refresh tokens (Redis) | exclude entirely (do not import) |
| Payment identifiers (`stripeCustomerId`, `stripeSubscriptionId`, price/session IDs) | null / test-mode placeholders |
| User notes (`fragments.note`) | drop or replace with lorem |
| Private fragments / private clubs / club messages/discussions | drop or anonymize |
| Invite tokens, claim tokens, upload codes, reset/confirm tokens | drop |
| API credentials / secrets in any table | drop |
| Personal analytics (`events`, `reading_stats`, `user_personas`) | drop or aggregate/anonymize |

## Email safety (§20)
Staging must not email real users. Enforced by: SMTP unset by default in `.env.staging` (email disabled) and `EMAIL_SAFE_MODE=true` convention; if SMTP is configured for testing, restrict recipients to internal test addresses or an email sink. Even sanitized emails use a non-deliverable domain (`@staging.invalid`).

## Automation (future opportunity, not built here)
A repeatable sanitization script (SQL transform over a restored dump) is a good future addition. NEM-006A documents the policy and categories; it does not build an anonymization platform (§18). Until automated, sanitization is a manual, checklist-driven step performed on an **isolated** restore, never against production.

## Hard rules
- Never load raw production PII into staging.
- Never import production refresh tokens, payment identifiers, OAuth identities, or secrets.
- Never point staging services at production data stores.
