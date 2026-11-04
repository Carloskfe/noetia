# NEM-016 staging acceptance harness

Repeatable acceptance tests for NEM-016 sharing integrity: A1–A20 plus supplemental cases, including the F1 and F2 corrections (X8, X9).

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
- **Routes are an allowlist.** On staging it can't create or delete any book at all, whatever the options say. Locally it can only delete books it uploaded.
- **Existing staging records are read-only.** The fixture and administrator are pinned in `lib/guard.mjs`. It won't log in as that administrator, and it won't generate SQL that grants or revokes staging privileges.
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
| `NEM016_FIXTURE_BOOK_ID` | local only, optional | Reuse an already uploaded local fixture. Staging's is pinned |
| `NEM016_BOUND_MS` | X8, optional | Limit for each deletion during a stall; default 8000 (5 s deadline plus overhead) |
| `NEM016_STALL_TIMEOUT_MS` | X8, optional | When the client gives up waiting; default 60000 |
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

**3. Accounts and fixture.** These records already exist on staging, so the harness only verifies them. It stops without changing anything if the fixture's id, title, uploader or published state differ:

| Record | Value |
|---|---|
| Fixture | `68303e17-3a80-4f17-b3c1-8be00a66cc71`, *Cuaderno de pruebas de citas (NEM-016)* |
| Administrator | `4219d326-b9fc-4aa9-8d35-6ce8b9e6e787`, `nem016-admin-test@noetia.invalid` |

```bash
node acceptance.mjs setup-accounts    # creates only the @staging.invalid test accounts, never an admin
node acceptance.mjs setup-fixture     # read-only on staging
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

On staging it revokes the run's shares and deletes the run's `@staging.invalid` accounts. **It keeps the fixture and the administrator.** Locally it also deletes the fixture if it has the admin grant.

## Tests that need extra care

| Test | Why | What's needed |
|---|---|---|
| **A11** | **Disruptive.** Stops staging storage, so book text and card images fail on staging | Product Owner approval naming A11; a quiet window |
| **A12** | Irreversible for the synthetic account | Named approval; gate G4 (empty `SMTP_HOST`) re-checked first |
| **A15** | 20 renders on the host shared with production | Named approval; a quiet window |
| **A19** | Raises a real book's `shareCount` by 1, permanently | Named approval. Eligibility and provenance columns aren't touched, which X6 confirms |
| **A14b** | Deletes the fixture | Local only; BLOCKED on staging |
| **X8** | **Disruptive.** Pauses staging storage. Fails on any commit without the F1 correction, so it's BLOCKED on `aaf708e` | A deployment with the fix; approval naming X8; a quiet window |
| **X9** | Needs a book that can be deleted, and the harness never deletes staging books | BLOCKED on staging until the Product Owner approves a disposable book |
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

## Staging compatibility

| Item | Behaviour |
|---|---|
| Deployed commit | `aaf708e` predates F1 and F2. On it, X8 stays BLOCKED, X9 is BLOCKED, and A1–A20 still run |
| `A11` on `aaf708e` | Use `stop`, as above. `pause` only became safe with the F1 correction |
| Fixture | Verified, never created. A fragment and shares go on it through the normal API, and those are what clean-up removes |
| Administrator | Never used by the harness. `admin-sql` refuses any target but `local`. X6.admin and X6.protected confirm it's unchanged |
| Verdict | Stays INCOMPLETE while X8 or X9 are BLOCKED, so it can't be ACCEPTED on `aaf708e` |

## Measured behaviour (local stack)

| Interruption | Before the fix | With the fix |
|---|---|---|
| `docker pause` (connection open, no answer) | No response within the test limit (180 s in the longest run); `attempts=0` | 204 in about 5 s; `attempts=1`, `StorageTimeoutError`; the sweep finishes after storage returns |
| `docker stop` (unavailable) | 204 in about 15 s; `attempts=1` | 204 in about 5 s; `attempts=1`, `StorageTimeoutError`; the sweep finishes after storage returns |

In every case the revocation commits first, so the share returns 404 straight away.

After a book is deleted: before the fix, its card images returned 200. With the fix, they return 404, or the sweep removes them if storage is down.

These are local measurements, without Traefik or TLS. Timings on staging may differ. Full results: `docs/reports/2026-11-03-NEM-016-F1-F2-corrective.md`.

## Running the local validation

Local only. Create the images first:

```bash
docker build --target production -t n16acc-api:old    <checkout of 9192c50>/services/api
docker build --target production -t n16acc-api:prefix <checkout of aaf708e>/services/api
docker build --target production -t n16acc-api:new    <checkout of the fix>/services/api
docker build -t n16acc-image-gen:new <checkout of the fix>/services/image-gen
local/run-f1-f2.sh   # F1 and F2: pre-fix, then fix under pause and stop; about 25 minutes
local/run-local.sh   # the full matrix on the fix, clean-up, and a negative control; about 15 minutes
```

Run them one at a time, as they share a project name and ports. Everything is named `n16acc`, bound to loopback and removed on exit. Image-gen has no route out, so renders can't reach production.
