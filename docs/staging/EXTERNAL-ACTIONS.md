# Staging — Required External Actions (Product Owner / Ops)

NEM-006A completed all **repository-side** staging infrastructure. Activating a live staging environment requires the host-side and console-side actions below, which cannot be performed from the repository (and which this mission is not authorized to perform). Each is explicit and numbered.

## 1. Verify host capacity (colocation gate) — §6/§7
On the Contabo host, confirm free capacity before colocating staging:
```bash
free -h ; df -h ; docker stats --no-stream
```
Staging is bounded to roughly **~2.0 GB memory** (limits in `docker-compose.staging.yml`; no monitoring stack). The VPS is 8 vCPU / 24 GB. **If free memory/disk is insufficient to run staging without pressuring production, provision a separate small staging VPS instead** and point the staging deploy at it. Do not compromise production reliability.

## 2. Create the staging host checkout — on the **mission branch**, not `staging`
```bash
git clone -b <mission-branch> <repo> /opt/noetia-staging   # e.g. -b nem-006a-staging
```
Keep `/opt/noetia-staging` entirely separate from production's `/opt/noetia`.

**Do not create the remote `staging` branch yet.** Pushing it arms `cd-staging.yml`, which
would auto-deploy into a host directory that has no `.env.staging` and an environment nobody
has validated. Activate and prove the environment manually first (§10), then arm auto-deploy
last (§9). Rationale in [§9](#9-github-actions--arm-only-after-10-passes).

## 3. Create `.env.staging` on the host
Copy `.env.staging.example` → `/opt/noetia-staging/.env.staging` and fill **staging-only** values (no production secrets). Includes: staging DB/JWT/MinIO/Meili credentials, `STAGING_BASICAUTH`, Stripe **test** keys, email safety, optional staging OAuth. **Never commit this file.**

## 4. DNS (Cloudflare) — §8
Create DNS records pointing to the Contabo host IP:
- `staging.noetia.app` → `A 84.247.140.175`
- `storage.staging.noetia.app` → `A 84.247.140.175`
DNS-only (gray cloud), consistent with the existing Traefik + Let's Encrypt setup (Traefik will issue certs automatically once the records resolve).

## 5. Basic-auth credential — §9
Generate the Traefik basic-auth users string and put it in `.env.staging` as `STAGING_BASICAUTH` (escape `$` as `$$` for compose):
```bash
htpasswd -nbB stager '<staging-password>'
```

## 6. Stripe test mode — §19
Provide **test-mode** Stripe keys (`sk_test_…`, test `whsec_…`) in `.env.staging`, and register a **test-mode** webhook endpoint → `https://staging.noetia.app/api/webhooks/stripe`. Confirm no live keys are used. (Test-mode price IDs may differ from production; seed/update as needed on staging only.)

## 7. Email safety — §20
Choose one: leave SMTP unset in `.env.staging` (email disabled — default), OR configure a dedicated staging Resend sender restricted to internal test recipients, OR an email sink. Confirm staging cannot email real beta users.

## 8. OAuth callbacks (optional) — §21
If Google/Facebook login is wanted on staging, register staging callback URLs in each provider console:
- Google: `https://staging.noetia.app/api/auth/google/callback`
- Facebook: `https://staging.noetia.app/api/auth/facebook/callback`
Then set the staging client IDs/secrets in `.env.staging`. Otherwise email/password login is sufficient for staging validation.

## 9. GitHub Actions — arm only after §10 passes
`cd-staging.yml` reuses the existing `DEPLOY_SSH_KEY` secret and deploys on pushes to the
`staging` branch. It is inert until that branch exists, and **creating it is the deliberate
act of arming auto-deploy** — do it only once §10 has fully passed:
```bash
git push origin <mission-branch>:staging
```
Note `workflow_dispatch` does not appear in the Actions UI until the workflow file also
reaches the default branch.

## 10. First activation & validation (do this BEFORE §9)
On the host, with §1–8 done:
```bash
cd /opt/noetia-staging
alias dcs='docker compose -p noetia_staging --env-file .env.staging -f docker-compose.staging.yml'
dcs up -d --build          # first run builds 4 images; allow 5–15 min
dcs ps                     # api/web/db/cache/storage/search healthy
```
**Initialize MinIO buckets** — the staging compose has no bucket-init service, and without
this uploads and share-card generation fail:
```bash
AK=$(grep '^MINIO_ACCESS_KEY=' .env.staging | cut -d= -f2); SK=$(grep '^MINIO_SECRET_KEY=' .env.staging | cut -d= -f2); docker run --rm --network noetia_staging_noetia_staging_net -e MINIO_URL=http://storage:9000 -e MINIO_ACCESS_KEY="$AK" -e MINIO_SECRET_KEY="$SK" -v /opt/noetia-staging/infra/minio/buckets.sh:/buckets.sh:ro --entrypoint sh minio/mc /buckets.sh
```
Then migrations, the smoke + isolation tests in [RUNBOOK.md](RUNBOOK.md), and confirm
production is unaffected. Staging's `migrations` count must equal production's
(`docker exec -i noetia-db-1 psql -U noetia -d noetia -c "SELECT COUNT(*) FROM migrations;"`).

Two checks that specifically catch a bad staging build:
```bash
docker exec noetia_staging-web-1 grep -rho "https://[a-z.]*noetia\.app/api" .next/static | sort -u
curl -o /dev/null -w "%{http_code}\n" https://staging.noetia.app     # must be 401
```
The first must print **only** `https://staging.noetia.app/api`. `NEXT_PUBLIC_*` are inlined
into the client bundle at build time and cannot be overridden by runtime env, so a bundle
built without the staging build args serves staging's UI while reading and writing
**production** data. Finish with a browser pass: basic-auth prompt, amber STAGING ribbon,
login with a staging-only account, and DevTools → Network showing requests to
`staging.noetia.app` only.

## 11. (Later) Production PG16 restore-compatibility proof
When the pgvector production path is planned (resumed NEM-006 / NEM-006B), take a production DB snapshot per existing safety procedures, restore a **sanitized** copy into staging, and validate — see [pgvector-validation.md](pgvector-validation.md). **Not part of NEM-006A.**

## 12. (Future, separate mission) Provision AI provider credentials — PO-005
Reserved `.env.staging` slots exist for `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. NEM-006A does **not** enable AI. Provisioning + provider data-handling review (no training/data-sharing, per ADR-002) is a future operational prerequisite for resumed NEM-006.
