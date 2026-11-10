# CI Baseline Investigation — mobile, web, and API unit-test coverage

**Status:** COMPLETE (read-only investigation) — for Product Architecture review.
**Authorization:** Product Owner, *"CI Baseline Investigation"* (2026-11-09): read-only investigation plus a documentation-only report on the NEM-022 branch.
**Changes made:** this report only. No application code, tests, CI/CD, coverage thresholds, dependencies, or infrastructure changed. No merge or deployment.

## 1. Conclusion

All three failing jobs are **pre-existing on `main`. NEM-022 introduced none of them.**

| Job | Cause |
|---|---|
| **Mobile** | Coverage far below the 80% global thresholds (29.61% statements) |
| **Web** | All four metrics below 80%; functions 51.74% is the worst |
| **API** | Only branch coverage below 80%. NEM-022 *improves* it |

Every test passes in all three jobs; only the coverage gates fail.

These jobs have **never passed**. The 80% thresholds were added on 2026-04-23 (`a10277a`) and the CI coverage gate on 2026-05-02 (`a69c96d`). CI runs only on pull requests into `main`, and work went straight to `main` until 2026-10-28. Since then **all 86 CI runs have failed**:
- the earliest runs at dependency install (the lockfile was out of sync with `package.json`; fixed by 2026-11-02);
- every run since then on coverage in the mobile, web, and API unit-test jobs.

Worker, image-gen, lint/typecheck/build, and Playwright pass. CI has never run on PR #51 or #50, because they do not target `main`.

## 2. Evidence: logs and commands

| Item | Value |
|---|---|
| Latest CI run | `42536785662` (2026-11-08, documentation-only PR `docs/gov-001-reporting-governance`) |
| Failed jobs (full logs: `gh api repos/Carloskfe/noetia/actions/jobs/<id>/logs`) | mobile `128902726177`, web `128902726051`, API `128902726088` |
| Command (every job) | `pnpm --filter @noetia/<service> test:cov` → `jest --coverage` (exit 1 from `coverageThreshold.global`) |
| Thresholds (each `jest.config.js`) | `global: { statements: 80, branches: 80, functions: 80, lines: 80 }` |

Log excerpts (run `42536785662`):

```
mobile  All files | 29.61 | 14.17 | 20.86 | 31.28     Test Suites: 24 passed · Tests: 179 passed
        Jest: "global" coverage threshold for statements (80%) not met: 29.61%   (also branches, lines, functions)
web     All files | 72.8  | 72.44 | 51.74 | 71.61     Test Suites: 19 passed · Tests: 298 passed
        Jest: "global" coverage threshold for statements/branches/lines/functions (80%) not met
api     All files | 90.46 | 68.83 | 87.56 | 91.8      Test Suites: 69 passed · Tests: 948 passed
        Jest: "global" coverage threshold for branches (80%) not met: 68.83%
```

(The web log's "Not implemented: navigation" is a jsdom warning, not a test failure.)

## 3. Baseline comparison

Coverage columns: statements / branches / functions / lines (%).

| Service | `main` (CI) | Accepted NEM-021 `bbd7c99` | NEM-022 head `55f76ed` | Attribution |
|---|---|---|---|---|
| Mobile | 29.61 / 14.17 / 20.86 / 31.28 | identical (same source tree `9a1e092…`) | identical (same tree) | Pre-existing; NEM-022 cannot affect it |
| Web | 72.8 / 72.44 / 51.74 / 71.61 | identical (same source tree `4835f93…`) | identical (same tree) | Pre-existing; NEM-022 cannot affect it |
| API | 90.46 / **68.83** / 87.56 / 91.8 (948 tests) | 93.11 / **76.14** / 90.97 / 94.18 (1,521)¹ | 93.26 / **77.49** / 90.84 / 94.5 (1,683)¹ | Pre-existing branch gap. The NEM stack raises branches by +8.66 points; **NEM-022 alone adds +1.35** |

¹ Local runs of the CI command (`jest --coverage`) in this session; the NEM-021 run used a temporary worktree, removed afterwards.

The mobile and web numbers were stable across every `main`-based PR from 2026-11-02 to 2026-11-08. One PR that added mobile tests read 30.22 / 15.29 / 21.24 / 31.75.

## 4. Configuration and affected files

**Mobile** measures `src/**/*.{ts,tsx}` except `src/navigation/**`, so screens and UI are measured.
- Screens are about 2,270 of roughly 5,000 source lines.
- Files below 50% statements: `ClubScreen`, `ClubsScreen`, `LanguageScreen`, `LiveSessionScreen`, `useClubSession`, `useNetworkSync`, `usePushNotifications`, `index.tsx` (0%); `ReaderScreen` (7%), `book-download` (14%), `SocialAuthButtons`, `ShareSheet` (15%), `LibraryScreen` (16%), `FragmentsScreen` (17%), `useAudioPlayer` (21%), `RegisterScreen` (22%), `OnboardingTour` (24%), `LoginScreen` (25%), `AudioPlayerBar`, `TourContext` (26%), `DownloadButton` (28%), `AccountScreen`, `PaywallScreen` (33%), `AuthContext` (46%).
- Strong: `lib` 100%, offline 89%, API client 78%.
- **No React Native rendering test library is installed**, so screens cannot be meaningfully tested today.
- The measured set includes ambient `src/types/*.d.ts` files. They contain no statements, so the impact is negligible.

**Web** measures only `lib/**/*.ts` (components and pages are not measured). Files below 80%:
- `lib/i18n/en.ts` and `es.ts` (about 1,660 lines; 28.6% statements, 25.9% functions). These are the main drag on functions.
- `clubs.ts` and `use-reading-heartbeat.ts`: 0%.
- `legal/terms-of-service.ts`, `privacy-policy.ts`, `cookie-policy.ts`: 0% statements, because no test loads them.
- `onboarding.ts`: 75% functions.

**API** measures only `src/**/*.service.ts` and `*.provider.ts`. Lowest branch coverage, the same files on `main` and NEM-022:

| File | Branches |
|---|---|
| `redis.provider` | 0% |
| `email.service` | 17% |
| `alignment.service` (sync, reader-critical) | 41% |
| `club-polls.service` | 50% |
| `club-members.service` | 52% |
| `clubs.service` | 55% |
| `push.service` | 57% |
| `storage.service` | 65% |
| `gifts.service` | 66% |
| `events.service`, `phrase-splitter.service` | 67% |

On the NEM stack only, `knowledge-db.service` (NEM-019) also shows 0% branches; it is a small file.

## 5. Smallest safe remediation plan

The plan keeps the 80% target, lowers no threshold, and excludes no production code. Each step needs Product Owner approval before work starts.

1. **API, smallest gap.** About 2.5 branch points on the NEM stack (12 points on `main` alone). Meaningful tests for:
   - `alignment.service` (reader sync, first per the reader-first hierarchy);
   - `email.service` (account confirmation and password reset);
   - `storage.service`.

   These are expected to clear 80% on the NEM stack. `main` reaches it only when the stack merges, or with more service tests.
2. **Web, moderate effort.**
   - Tests that call every i18n message function (the existing en/es parity test checks structure only).
   - Tests for `clubs.ts` and `use-reading-heartbeat.ts` (reading statistics).
   - Content tests for the legal modules (required sections and dates present).
3. **Mobile, largest effort, with a decision needed.** Reaching 80% requires testing screens, which are about 45% of the code. Options:
   - **(a)** add a React Native testing library as a dev dependency (needs PO approval) and test critical screens in reader-first order: Reader, Library, Auth;
   - **(b)** extract screen logic into hooks and helpers and unit-test it (touches app code; more risk).

   In either case, start with the 0% hooks (`useNetworkSync`, `usePushNotifications`, `useClubSession`) and `book-download`.
4. **Separate decision (no change proposed).** Web measures only `lib`, while mobile measures UI. Aligning them would lower the web figure further.

## 6. Scope note

NEM-022 changes no mobile or web file and no CI configuration. These failures should not block NEM-022 review. They are repository debt to plan separately.
