# Environment Promotion — dev → staging → production

Documents the intended engineering path and the pre-production checklist. **Distinguish documented process from automatically-enforced process** (§36): the steps below are the *intended* workflow; only the parts noted as "CI-enforced" are actually enforced by automation today.

## Intended path
```
developer
   ↓  feature branch
   ↓  PR / review + CI (lint / typecheck / build / tests)      ← CI-enforced (ci.yml)
staging  (branch `staging` → cd-staging.yml)                    ← CI-enforced deploy trigger
   ↓  smoke + isolation tests, migration rehearsal (RUNBOOK)    ← manual today
   ↓  Product Architecture / Product Owner gate when required   ← manual (governance, NEM-004)
main  (branch `main` → cd.yml)                                  ← CI-enforced deploy trigger
   ↓
production
```

### Enforced vs. manual (be honest)
- **CI-enforced:** `ci.yml` runs lint/typecheck/build/tests on push/PR; `cd-staging.yml` deploys on `staging`; `cd.yml` deploys on `main`.
- **NOT auto-enforced (process/discipline):** "must pass through staging before main", the Product Owner gate, migration rehearsal, and reader-regression review. These are governed by NEM-004 (mission approval + explicit execution + review), not by a branch-protection rule. A future mission may add branch protection / required-staging checks to enforce this in CI.

## Pre-production promotion checklist (before merging to `main`)
Run in staging first:
- [ ] CI green (lint / typecheck / build / tests) on the branch.
- [ ] Deployed and validated on **staging** (smoke tests pass — RUNBOOK).
- [ ] **Isolation tests** pass (staging cannot see production data — RUNBOOK / smoke).
- [ ] **Migrations rehearsed** on staging (`migration:run:prod` against the staging DB); rollback understood.
- [ ] For DB-image/pgvector changes: restore-compatibility proven on staging (pgvector-validation.md).
- [ ] Stripe behavior verified in **test** mode; no live-key path touched.
- [ ] Reader / Escucha Activa regression verified unaffected.
- [ ] Secrets/config separated; no secrets committed; `settings.local.json` excluded.
- [ ] Rollback path documented.
- [ ] Governance: mission authorized + (where required) Product Architecture review complete.

## Production deployment note
`main` currently auto-deploys to production (`cd.yml`, unchanged by NEM-006A). Therefore: **do not merge to `main` until the checklist passes on staging.** A completed, reviewed staging validation is the gate for production promotion.
