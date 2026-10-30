# NOETIA ENGINEERING MISSION — NEM-014
## CI Integration of Real-PostgreSQL Tests (ephemeral, isolated)

**Status:** DRAFT
**Mission type:** INFRASTRUCTURE
**Implementation authorization:** LIMITED — `.github/workflows/ci.yml` (one new job) and the testing section of `CLAUDE.md` only
**Schema changes:** NOT AUTHORIZED
**Infrastructure changes:** SPECIFICALLY AUTHORIZED — CI configuration only (§5), on approval
**Production deployment:** NOT APPLICABLE (CI only; `cd.yml` untouched)
**Product Owner approval:** REQUIRED (D3 approved in principle 2026-10-29; this specification not yet approved)

> Reminder: **APPROVED ≠ EXECUTE.** Executed only on an explicit Product Owner instruction naming NEM-014.

---

## 1. Context

NEM-011 added integration tests that run against a real PostgreSQL (`services/api/tests/integration/`, `npm run test:integration`), because mocks cannot prove transaction, row-lock, and unique-constraint behaviour. They run only on demand. Decision D3: run them in CI on **isolated, ephemeral** infrastructure, **no production connections, no paid services**, within an explicitly scoped mission.

## 2. Objective

Every pull request runs the real-database integration suite against a disposable PostgreSQL that exists only for that job.

## 3. Dependencies

The integration harness from NEM-011. Two options for where it lands first (open decision O-1).

## 5. In scope

One new job in `.github/workflows/ci.yml`:

```yaml
  # ── Integration tests — api against a throwaway PostgreSQL (NEM-014) ────────
  integration-tests-api:
    name: api — integration tests (PostgreSQL)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine          # same major version as production
        env:
          POSTGRES_USER: it
          POSTGRES_PASSWORD: it            # throwaway credential, job-local, not a secret
          POSTGRES_DB: it
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U it"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run integration tests
        run: pnpm --filter @noetia/api test:integration
        env:
          INTEGRATION_DATABASE_URL: postgres://it:it@127.0.0.1:5432/it
```

Plus `CLAUDE.md` § Testing: document `tests/integration/` (real database, own config, never in `tests/unit/`) — resolving the NEM-011 placement deviation.

## 6. Out of scope

`cd.yml` · existing jobs and coverage thresholds · branch-protection rules (O-2) · staging · any secret · web/mobile integration tests.

## 9. Technical requirements and safety

| Requirement | How it is met |
|---|---|
| Ephemeral | GitHub service container, created and destroyed with the job |
| Isolated | No network path to production; no secrets referenced; the harness refuses any non-loopback host |
| No paid services | GitHub-hosted runners and service containers are free for this **public** repository |
| Matches production schema | Each test file creates its own database and runs **every migration** |
| Deterministic | `--runInBand`; per-file databases; concurrency tests repeat rounds (see NEM-011 §12) |

## 11. Acceptance criteria

1. The job runs on every PR and push, passes on the NEM-011 code, and **fails** when the NEM-011 fix is reverted locally on a scratch branch (proves the job detects the defects).
2. Job time under 5 minutes.
3. No other job changes behaviour; no secret is added.

## 12. Required tests

The job itself, plus the revert check in criterion 1 (run once, recorded in the completion report, never merged).

## 14. Rollout

Merge only on approval. If the job proves flaky, it can be removed by reverting the single job without touching others.

## 16. Open decisions

| # | Question | Recommended default |
|---|---|---|
| **O-1** | Land the job on the NEM-011 branch (so PR #11 is validated by CI before merge) or on `main` after NEM-011 | **On the NEM-011 / NEM-012 release branch** — the tests exist only there, and CI evidence before merge is the point |
| **O-2** | Make the job a required status check? | Not until it has run green for a few weeks; branch protection currently requires no checks |

## 17. Stop conditions

STOP if the job would need a secret, a production or staging connection, a paid runner, or any change to `cd.yml` or existing jobs.

## 18–19. Completion report and review

Per README Completion Report Standard; Product Architecture review per `REVIEW-CHECKLIST.md`.
