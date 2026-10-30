# NOETIA ENGINEERING MISSION — NEM-014
## CI Integration of Real-PostgreSQL Tests (ephemeral, isolated)

**Status:** IN PROGRESS — implementation authorized by the Product Owner (2026-10-29), limited to §5
**Mission type:** INFRASTRUCTURE
**Implementation authorization:** LIMITED — `.github/workflows/ci.yml` (one new job) and the testing section of `CLAUDE.md` only
**Schema changes:** NOT AUTHORIZED
**Infrastructure changes:** SPECIFICALLY AUTHORIZED — CI configuration only (§5), on approval
**Production deployment:** NOT APPLICABLE (CI only; `cd.yml` untouched)
**Product Owner approval:** GRANTED for implementation within §5 (2026-10-29). Merging is **not** authorized.

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
| ~~O-1~~ | ~~Where the job lands~~ | **Resolved:** on the coordinated release branch (`release/acquisition-a`) |
| **O-2** | Make the job a required status check? | Not until it has run green for a few weeks; branch protection currently requires no checks |

## 17. Stop conditions

STOP if the job would need a secret, a production or staging connection, a paid runner, or any change to `cd.yml` or existing jobs.

## 18. Completion report (2026-10-29)

**Status:** implemented on `release/acquisition-a` (draft PR #14) — not merged.

| Criterion | Result |
|---|---|
| 1 — job passes on NEM-011 code, fails when the fix is reverted | PR #14: **18/18 pass**. Throwaway PR #15 (pre-NEM-011 `library.service.ts` + `subscriptions.service.ts`): **9/18 fail** — G1, G1b, pre-existing-rows, G2 (2 of 5 rounds), G2b, G2c, free-account balance ×2. PR #15 closed, branch deleted, never merged |
| 2 — under 5 minutes | **53 s** |
| 3 — no other job changed, no secret added | Diff: one new job + `CLAUDE.md` testing note |

**Changed files:** `.github/workflows/ci.yml` (job `api — integration tests (PostgreSQL)`), `CLAUDE.md` (§ Testing — integration tests). **Note:** CI runs only on pull requests to `main`, so the job runs on PRs, not on branch pushes.

## 19. Product Architecture review

Per `REVIEW-CHECKLIST.md`. Verdict: _pending_.
