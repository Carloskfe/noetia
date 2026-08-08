# 18 — Testing

## Test inventory — CONFIRMED
Unit spec files under each service's `tests/unit/` (mirrors `src/`):

| Service | Framework | Spec files |
|---------|-----------|-----------:|
| api | Jest (ts-jest) | 67 |
| web | Jest + jsdom | 19 |
| mobile | Jest | 24 |
| worker | Jest | 2 |
| image-gen | pytest | 10 |

**CONFIRMED** by file count. Project notes cite ~686 API + 145 mobile individual test cases passing at a prior checkpoint (case counts not re-verified here → **INFERRED** current totals).

## Testing standard — CONFIRMED (CLAUDE.md, enforced culturally)
- Every service file must have a mirrored `tests/unit/**` spec (`.spec.ts` / `test_*.py`).
- Coverage threshold **80%** per service, gated in CI.
- Tests mock external dependencies (DB, Stripe, MinIO, network) — no test touches real infrastructure.

## CI gates — CONFIRMED (`.github/workflows/ci.yml`)
- Per-service matrix: **lint → typecheck → build**.
- Unit tests **with coverage** (`test:cov`) for api/web/worker/mobile; pytest `--cov` for image-gen. Job names assert "≥80% coverage".
- Runs on push/PR.

## End-to-end — CONFIRMED (capability) / INFERRED (coverage)
- **Playwright** is a web dependency (`@playwright/test`) → E2E capability exists in `services/web`.
- Extent of the E2E suite was **not** enumerated; project backlog lists a full production E2E run (auth, reader/Escucha Activa, fragments, sharing, subscriptions/tokens, clubs, mobile offline) as **still to be completed** → current E2E coverage is **INFERRED partial**.

## Verified-this-cycle examples — CONFIRMED
- `phrase-aligner.spec.ts` (14 tests incl. onset-bias regression), `sync-diagnostics.spec.ts` (7), `reader-utils.spec.ts` (45 incl. credits hold-static regression), `whisper-sync.service.spec.ts` + `phrase-splitter.service.spec.ts` (46) — all green.
- Web i18n parity enforced by `tests/unit/lib/i18n.spec.ts`.

## Load / performance testing — CONFIRMED (present) / UNKNOWN (current results)
- `scripts/load-test/` and `reports/` exist (k6 referenced in backlog: 500 VUs). Latest results **UNKNOWN** — a re-run against current prod is a backlog item.

## Gaps — INFERRED
- Worker has minimal coverage (2 spec files) relative to its role.
- No contract tests between web/mobile and the API.
- No mutation testing / no security (SAST/DAST) in CI observed.
