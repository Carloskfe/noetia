# NEM-016 staging acceptance harness

Repeatable acceptance tests for NEM-016 sharing integrity: A1–A20 plus supplemental cases.

**Nothing here has been run against staging or production.** Running it on staging needs explicit Product Owner authorization. It has only been run locally, against the disposable stack in `local/`.

| File | Purpose |
|---|---|
| `acceptance.mjs` | The command-line tool (Node 20+, no dependencies) |
| `lib/matrix.mjs` | The acceptance matrix; everything else derives from it |
| `COVERAGE.md` | Test-to-requirement coverage (generated) |
| `REPORT-TEMPLATE.md` | Report template with PASS, FAIL, BLOCKED and NOT RUN (generated) |
| `MANUAL-CHECKLIST.md` | Checks that need a person or the host |
| `test/` | Unit tests; no network (`node --test test/`) |
| `local/` | Disposable stack and end-to-end validation (`local/run-local.sh`) |

## Safety design

These are enforced in code and covered by unit tests:

- **Targets are an allowlist.** `staging` has fixed URLs that can't be overridden. `local` accepts loopback addresses only. Production can't be expressed as a target.
- **Staging needs an authorization phrase naming the deployed commit.** This is a deliberate speed bump, not proof of approval. The approval itself comes from the Product Owner.
- **Routes are an allowlist.** The only book writes it can make are the fixture upload and deleting the fixture it recorded, so existing books can't be modified.
- **Redirects are never followed.** Images are only fetched from the target's storage origin.
- **The harness has no database, Redis, SSH or Docker access.** It generates SQL, and the operator runs it.
- **Disruptive tests stay BLOCKED** until named with `--approve`.
- **Automated checks can't be set by hand.** Manual results need an evidence note.
- **The fixture is pinned by SHA-256**, so only the approved text can be uploaded.
- **It stops when the target fails a health check** between tests.

### Credentials

No credentials are stored in source control, and none are needed from the operator:

- Accounts are synthetic: `nem016-<run>-<role>@staging.invalid`.
- Passwords are derived in memory from a random seed file, which must have mode 600 and sit outside any git repository. They are never written or printed.
- Access tokens stay in memory. Run state holds ids and results only, also outside the repository.
- Everything recorded passes through redaction.

## Environment variables

| Variable | Needed for | Purpose |
|---|---|---|
| `NEM016_TARGET` | all network commands | `staging` or `local` |
| `NEM016_RUN_ID` | everything but `plan` and the generators | From `new-run-id` |
| `NEM016_SECRET_FILE` | all network commands | Seed file from `init-secret` |
| `NEM016_DEPLOYED_SHA` | staging | Full commit deployed on staging |
| `NEM016_PO_AUTHORIZATION` | staging | `I-HAVE-PO-AUTHORIZATION-FOR-STAGING:<sha>`; set only once authorized |
| `NEM016_STATE_DIR` | optional | Default `~/.local/state/noetia-nem016` |
| `NEM016_INELIGIBLE_BOOK_ID` | A14 | From the query below; without it A14 is BLOCKED |
| `NEM016_ELIGIBLE_BOOK_ID` | A19, optional | Otherwise the first free seeded book with phrases |
| `NEM016_FIXTURE_BOOK_ID` | optional | Reuse an already uploaded fixture |
| `NEM016_PRESET_BG_URL` | local only | A6 preset. Staging uses the public `noetia.app` preset from the plan |
| `NEM016_A8B_TOKEN_SEEDED` | A8b | `1` once the fake token is seeded |
| `NEM016_A11_TIMEOUT_MS` | A11, optional | Default 180000 |
| `NEM016_A15_BUDGET_S` | A15, optional | Minimum window left before starting; default 240 |
| `NEM016_LOCAL_API`, `NEM016_LOCAL_STORAGE` | local only | Loopback origins |

## Staging procedure

**Don't start until the Product Owner has authorized it.** `dcs` is the RUNBOOK alias, run from `/opt/noetia-staging` on the host, one line at a time. Everything else runs from a workstation.

```bash
node acceptance.mjs plan                                  # no network: tests, data impact, approvals
node acceptance.mjs init-secret ~/.config/nem016.seed
export NEM016_TARGET=staging NEM016_SECRET_FILE=~/.config/nem016.seed NEM016_RUN_ID=$(node acceptance.mjs new-run-id)
export NEM016_DEPLOYED_SHA=<full sha>                     # read it from the host
export NEM016_PO_AUTHORIZATION=I-HAVE-PO-AUTHORIZATION-FOR-STAGING:$NEM016_DEPLOYED_SHA
```

**1. Baseline, before any write.** Needed for A17 and X6.

```bash
node acceptance.mjs evidence-sql --label baseline > baseline.sql
# host: dcs exec -T db psql -U noetia -d noetia_staging -q -f - < baseline.sql > baseline.out
node acceptance.mjs ingest-evidence baseline.out
node acceptance.mjs preflight
```

**2. Choose the A14 book** (read-only, on the host). If no row comes back, A14 is reported as BLOCKED.

```sql
SELECT b.id, b.title FROM books b LEFT JOIN sync_maps s ON s."bookId"=b.id WHERE b."uploadedById" IS NULL AND b."isPublished" AND COALESCE(s."syncCoverage",0) < 0.90 LIMIT 5;
```

**3. Accounts and fixture.** Staging has no administrator, and an admin upload is the only way to publish the fixture. So the smallest change is a one-row grant on a synthetic account, removed straight after the upload. **This is a staging database write and needs Product Owner approval.** The SQL aborts unless it changes exactly one `nem016-…@staging.invalid` row.

```bash
node acceptance.mjs setup-accounts
node acceptance.mjs admin-sql --grant  > grant.sql        # operator runs it on the host
node acceptance.mjs setup-fixture
node acceptance.mjs admin-sql --revoke > revoke.sql       # operator runs it straight away
```

**4. Non-disruptive tests.**

```bash
node acceptance.mjs run --only A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A14,X1,X2,X3,X4,X5
```

**5. Tests needing named approval, only those approved.**

```bash
node acceptance.mjs run --only A12,A15,A19 --approve A12,A15,A19
```

**6. Evidence, manual checks and report.**

```bash
node acceptance.mjs evidence-sql --label final > final.sql   # operator runs it; ingest as in step 1
node acceptance.mjs manual-template > manual.json            # fill it in using MANUAL-CHECKLIST.md
node acceptance.mjs merge-manual manual.json
node acceptance.mjs report --approve A12,A15,A19
```

**7. Clean-up, only under the approved policy.** It's a dry run without `--execute`.

```bash
node acceptance.mjs cleanup
node acceptance.mjs cleanup --execute --approve cleanup
```

Revoke shares before deleting the book: **deleting a book doesn't revoke its shares, and their images stay public** (see "Measured behaviour"). The clean-up does this in the right order. To delete the fixture it needs the admin grant again. Without the grant it keeps both the fixture and the admin account, because deleting the uploader would null `uploadedById` and silently make the fixture ineligible.

## Tests that need extra care

| Test | Why | What's needed |
|---|---|---|
| **A11** | **Disruptive.** Stops staging storage, so book text and card images fail on staging | Product Owner approval naming A11; a quiet window |
| **A12** | Irreversible for the synthetic account | Named approval; gate G4 (empty `SMTP_HOST`) re-checked first |
| **A15** | 20 renders on the host shared with production | Named approval; a quiet window |
| **A19** | Raises a real book's `shareCount` by 1, permanently | Named approval. Eligibility and provenance columns aren't touched, which X6 confirms |
| **A14b** | Deletes the fixture, so it must run last. Needs the admin grant | Named approval; optional |
| **A8b** | Writes a fake token to staging Redis, seeded with `local/seed-fake-social-token.cjs` | Named approval; optional |
| **A6** | Staging image-gen reads one public static file from `noetia.app`, as the plan specifies | Covered by run authorization; nothing is written there |

### A11 procedure

Needs `--approve A11`. Re-check the isolation gate first (`docker network inspect proxy`, integrated report P0.4), because a stopped service is exactly the case where Docker DNS would fall through to another environment on a shared network.

```bash
node acceptance.mjs run --only A11 --approve A11 --phase prepare
# host: dcs stop storage
node acceptance.mjs run --only A11 --approve A11 --phase paused
node acceptance.mjs evidence-sql --label a11-paused > a11.sql  # operator runs it; ingest as in step 1
# host: dcs start storage, then wait up to 10 minutes for the sweep
node acceptance.mjs run --only A11 --approve A11 --phase after
```

**Use `stop`, not `pause`.** The original plan's `dcs pause storage` can't produce its expected result; see below.

### A13

The original sequence can't be replayed, because staging has already been upgraded. A13.schema is checked from database evidence. A13.sequence is recorded by the operator from evidence captured during the deploy, or stays BLOCKED, and the verdict then stays INCOMPLETE until the Product Owner decides on it. X7 records the local evidence, but it can't produce ACCEPTED.

## Measured behaviour (local stack)

| Interruption | Revoke request | Outbox while interrupted | After storage returns |
|---|---|---|---|
| `docker stop` | 204 after about 15 s | `attempts=1`, `lastError=Error` | The sweep removes the row and the image returns 404. This is the retry path A11 is meant to test |
| `docker pause` | **No response within 180 s** (the limit set here) | `attempts=0`, `lastError` empty | The in-flight delete finishes on resume, with no sweep involved |

In both cases the revocation commits first, so the share returns 404 straight away. The pause result comes from the S3 client having no request timeout (`services/api/src/storage/storage.service.ts`), so the same wait is expected for fragment and account deletion when storage stalls. That's reported as a finding, not changed here.

Also measured: after a book is deleted, its share page returns 404, but the **card image still returns 200** until the share is revoked.

These are local measurements, without Traefik or TLS. Timings on staging may differ.

## Running the local validation

Local only. Builds nothing itself, so create the images first from the baseline and candidate commits:

```bash
docker build --target production -t n16acc-api:old <baseline checkout>/services/api
docker build --target production -t n16acc-api:new <candidate checkout>/services/api
docker build -t n16acc-image-gen:new <candidate checkout>/services/image-gen
local/run-local.sh
```

Everything is named `n16acc`, bound to loopback and removed on exit. Image-gen has no route out, so renders can't reach production. It runs three passes: the full matrix on the candidate, the clean-up paths, and a negative control against the baseline API, which must fail. It takes 10–20 minutes because A11 waits for the real 10-minute sweep.
