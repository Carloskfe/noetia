# NEM-025 Checkpoint B2-A1: transactional email foundation (completion report)

**Scope:** B2-A1 only, as authorized by the PO following PA acceptance of PR #82 (`0ad54f75`).

**Not done:** B2-A2, B2-B, SP-1, merge, deployment, French activation or email delivery.

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

Companion: [`french-dictionary.md`](french-dictionary.md), which describes every French entry (item 5).

---

## 1. Verified baseline and branch dependency

| Item | Verified head (2026-11-23) |
|---|---|
| `main` | `8f2f294` |
| PR #78 Checkpoint A (`feat/nem-025-checkpoint-a`) | `81143790`. Contains `main`. **B2-A1 base.** |
| PR #77 approved specs | `4ef2906d` |
| PR #82 B2 preparation (PA-accepted) | `0ad54f75` |
| PR #66 CI-2 EmailService tests | `9c9e4903` |
| PR #60 payment lifecycle | `d8e61e24` |
| PR #75 email addresses | `cb953607` |

- **Branch:** `feat/nem-025-checkpoint-b2a1`, created from `81143790`.
- **Draft PR target:** `feat/nem-025-checkpoint-a`, the same stacking as B1-A and B1-B.
- No dependency PR was merged or modified.
- **CI:** CI runs only on PRs into `main`, so this stacked PR gets no CI. All results below are local runs.

## 2. Changed files and commits

| Commit | Content |
|---|---|
| `4caa54f` | **Golden master captured on unchanged code.** Tests only. |
| `9dbfaf7` | Typed dictionaries, shared renderer, escaping helpers, inert locale foundation, and their tests |
| *(this report)* | Documentation |

**Files** (all under `services/api/` except the report):

| File | Status | Purpose |
|---|---|---|
| `src/email/email.service.ts` | modified | Uses dictionaries and the renderer. Public methods, defaults, transport and `send()` are unchanged. Adds the `SUPPORT_EMAIL` constant. |
| `src/email/copy/types.ts` | new | `EmailCopy` interface (key and interpolation contract) |
| `src/email/copy/es.ts`, `en.ts` | new | Verbatim extraction of the existing copy |
| `src/email/copy/fr-ca.ts` | new | French engineering draft (inert) |
| `src/email/copy/index.ts` | new | `EMAIL_COPY` registry |
| `src/email/templates.ts` | new | Shared shell, button and fallback rendering; the 8 template functions |
| `src/email/escape.ts` | new | `SafeHtml` brand, `escapeHtml()` (byte-identical to the old helper), `trustedHtml()` |
| `src/email/locale.ts` | new | `dispatchCopyLocale()` (live, behaviour-preserving), `FR_CA_TRANSACTIONAL_READY = false`, and `resolveMessageLocale()` (N-1 design, **not wired**) |
| `tests/unit/email/email.golden-master.spec.ts` + `__snapshots__/` | new | 46-snapshot golden master |
| `tests/unit/email/copy.spec.ts` | new | Parity, completeness, interpolation, Unicode, French typography and terminology |
| `tests/unit/email/locale.spec.ts` | new | Readiness, dispatch matrix, N-1 in isolation |
| `tests/unit/email/escape.spec.ts` | new | Escaping is identical to the legacy oracle |
| `tests/unit/email/templates.spec.ts` | new | French rendering through the shared renderer; attribute safety; service inertness |
| `docs/reports/nem-025-b2a1-20261123/*` | new | This report |

**Untouched:**
- callers (auth, users, gifts, subscriptions, waitlist);
- push;
- DTOs;
- schema;
- configuration;
- dependencies;
- `tests/unit/auth/email.service.spec.ts`.

## 3. Eight-template localization matrix

| # | Template (method) | ES/EN after refactor | Default `lang` | fr-CA dictionary | fr-CA reachable at runtime? | Callers changed? |
|---|---|---|---|---|---|---|
| E-1/E-2 | Email confirmation (`sendEmailConfirmation`) | Byte-identical | `'es'` (unchanged) | Complete draft | **No** | No |
| E-3 | Password reset (`sendPasswordReset`) | Byte-identical | `'es'` | Complete draft | **No** | No |
| E-4 | Account deleted (`sendFarewell`) | Byte-identical (erasure claim unchanged) | `'es'` | Complete draft; **release-blocked** (SP-1 / B2-D5) | **No** | No |
| E-5 | Waitlist confirmation | Byte-identical | `'es'` | Complete draft | **No** | No |
| E-6 | Waitlist invite | Byte-identical | `'es'` | Complete draft | **No** | No |
| E-7 | Gift card | Byte-identical (subject escaping unchanged) | `'es'` | Complete draft | **No** | No |
| E-8 | Gift confirmation | Byte-identical (`hola@noetia.app` unchanged) | `'es'` | Complete draft | **No** | No |
| E-9 | Plan invite | Byte-identical | `'es'` | Complete draft | **No** | No |

Language selection for every existing caller is unchanged:
- `'en'` gives English;
- anything else gives Spanish;
- `<html lang>` echoes the argument exactly as before.

## 4. ES/EN/default golden-master results

The golden master was written and committed at `4caa54f` **before** any implementation change. It mocks `nodemailer.createTransport` and freezes the clock at `2026-06-15T12:00:00Z`, because the footer prints the year. Each snapshot records `{from, to, subject, html}`.

**Fixtures** (14 per language × `es`, `en`, default = 42, plus 4 transport snapshots = **46**):

| Group | Variants |
|---|---|
| Confirmation, reset, farewell, waitlist confirmation | 1 each |
| Waitlist invite | 1 (recipient containing `+`, which proves `encodeURIComponent` in the link) |
| Gift card | 4: 1 token + message + occasion; 3 tokens plain; 1 token + message; 3 tokens + occasion |
| Gift confirmation | 2: 1 and 3 tokens |
| Plan invite | 1 |
| Escaping | 1 per language, covering all 8 templates with `Ana & <b>"Bo"</b> 'C'`, a `<script>` message, a hostile occasion, a hostile plan name and the recipient email `a&b<c>@example.com` |
| Unicode | 1 per language (`José Ñúñez — 李小龍 ’«»`, emoji) |
| Transport and sender | Default sender, URL and transport; configured SMTP auth and secure; failure log message |

**Result after refactor (`9dbfaf7`):** `Snapshots: 46 passed, 46 total`. The run used `--ci`, so no snapshot can be written or updated. **No golden-master byte changed.**

## 5. French dictionary entries

See [`french-dictionary.md`](french-dictionary.md). It lists all **51 entries** (ES source and fr-CA draft side by side) plus per-entry notes:

- decision-dependent terms: D-T1 to D-T4 and D-T6;
- the legal-sensitive farewell statement (entry 17);
- plural handling;
- the 1-token wording nuance (entry 45).

## 6. French is inert

- French email requires `dispatchCopyLocale(lang) === 'fr-CA'`. That needs **both**:
  - the code constant `FR_CA_TRANSACTIONAL_READY`, which is **`false`** and is not an environment variable, so no configuration can flip it;
  - `FR_CA_ENABLED === 'true'`.
- **Enabling the interface gate alone never produces French.** Tested with `FR_CA_ENABLED=true` and `lang='fr-CA'`: every one of the 8 methods sends the Spanish email (`templates.spec.ts`).
- **No caller passes `'fr-CA'` today.** The public `Lang` type is still `'es' | 'en'`. A stored `fr-CA` reaching a caller's existing cast gets Spanish, exactly as before.
- **Negative gate values:** `''`, `'TRUE'`, `'True'`, `'1'`, `'yes'`, `' true'` and `'true '` never activate French, even with readiness forced on in tests (`locale.spec.ts`).
- **Invalid and legacy values** are tested separately (`'pt'`, `'EN'`, `'fr'`, `'"><'`, `null`, …):
  - Live dispatch keeps today's output: Spanish body and the raw `<html lang>` value.
  - The N-1 normalization `resolveMessageLocale()` is tested only in isolation.
  - A test asserts that `email.service.ts` does not reference it.

## 7. HTML escaping and security verification

| Check | Evidence |
|---|---|
| Escaping identical | `escapeHtml()` matches the legacy `escape()` on 8 inputs (`escape.spec.ts`). The escaping golden master is byte-identical for all 8 templates × 3 languages. |
| Typed escaping | Copy functions accept user values only as `SafeHtml`. Passing a raw string fails `tsc`. |
| No user value in attributes | `templates.spec.ts` renders all 8 templates in es, en and fr-CA with a hostile marker. The marker appears only escaped, and never inside any attribute value. |
| Tokenized links | Built exactly as before (`WEB_URL` + server token; `encodeURIComponent` for the waitlist email). Asserted in the golden master and in `templates.spec.ts` (href + fallback text). |
| Subjects | Unchanged, including the pre-existing escaped names in the gift and plan subjects (X-5). Correction belongs to B2-A2. |
| Support address | `SUPPORT_EMAIL = 'hola@noetia.app'`, value unchanged |
| Deletion wording | ES/EN unchanged. French is a faithful translation and is release-blocked (B2-D5). |
| Logging | No new log statement. The pre-existing failure log is snapshotted, and a test proves it contains neither the token nor HTML. It does contain the recipient address (pre-existing X-8), **unchanged and not expanded**. |
| Transport | `createTransport` options (defaults and configured) snapshotted and unchanged. Errors are still swallowed. |
| Delivery | Nodemailer is mocked in every email test. No email was sent. |

**Known tension, reported rather than resolved.** Instruction A1-4 says user content must never go directly into attributes. Instruction A1-3 says runtime output for invalid stored values must not change, because N-1 is not authorized. The `<html lang="${lang}">` echo of the method argument is **pre-existing** (X-4). It was kept unchanged to satisfy A1-3: no **new** user content reaches an attribute, and B2-A1 does not widen the echo. N-1 (`resolveMessageLocale`) is the designed fix, awaiting authorization.

## 8. Public EmailService contracts unchanged

- **Signatures:** a `diff` of every `send*` signature between `8114379` and `9dbfaf7` (including the multi-line `sendGiftCard`) shows them identical. All 8 methods keep their parameter order, types, `lang: Lang = 'es'` default and `Promise<void>` return.
- **Transport and wrapper:** the constructor (env-driven transport, sender, `WEB_URL`) and the `send()` error-swallowing wrapper are unchanged.
- **Behaviour:** the golden master proves identical output for every valid ES/EN/default call.
- **Callers:** none was modified.
- **Exports:** the only new export from `email.service.ts` is the constant `SUPPORT_EMAIL`. `EmailModule` is unchanged.

## 9. Unit tests, coverage, lint, typecheck and build

All runs are local, with `jest --maxWorkers=2 --ci`.

| Check | Checkpoint A baseline (`8114379`) | B2-A1 (`9dbfaf7`) |
|---|---|---|
| API test suites | 77 passed | **82 passed** (+5 new) |
| API tests | 1,342 passed | **1,467 passed** (+125 new, 0 failing) |
| Snapshots | — | 46 passed |
| Coverage, all files (statements / branches / functions / lines) | 90.58 / **69.14** / 87.56 / 91.83 | 91.67 / **78.66** / 90.47 / 93.10 |
| `email.service.ts` coverage | 44.68 / 17.08 / 36.84 / 42.22 | **100 / 100 / 100 / 100** |
| Global 80% branch threshold | **fails** (69.14) | **fails** (78.66). Pre-existing; improved by 9.5 points. |
| `tsc --noEmit` | pass | pass |
| `npm run lint` (`{src,test}`) | 0 errors, 254 warnings | 0 errors, 254 warnings (unchanged) |
| `eslint src/email` | — | clean |
| `eslint tests/unit/email` | — | 0 errors; 21 `no-explicit-any` warnings (deliberate `lang as any` casts that feed invalid values). Not covered by the lint script's globs. |
| `nest build` | — | pass; `dist/email/{copy,escape,locale,templates}` emitted |

**Coverage scope:** `collectCoverageFrom` measures only `src/**/*.service.ts` and `*.provider.ts`. The new `copy/`, `templates.ts`, `escape.ts` and `locale.ts` files are exercised by the 125 new tests but are outside the coverage report by configuration. The configuration was not changed.

**PR #66 cross-check:** #66's 32-test `email.service.spec.ts` was run temporarily against this branch and against the baseline. Both passed 32/32. The temporary copy was removed and nothing was committed.

## 10. Existing versus introduced failures

| Failure | Status |
|---|---|
| API global branch coverage below 80% | **Pre-existing**: 69.14 measured on the Checkpoint A baseline; API branch coverage was below 80% on `main` before NEM-025 (issue #68). B2-A1 improves it to 78.66. Not introduced. |
| Mobile and web coverage gates | Pre-existing and unaffected (no files touched) |
| Lint warnings (254) | Pre-existing; count unchanged |
| **Introduced failures** | **None** |

## 11. Compatibility with PRs #60, #66 and #75

| PR | Overlap | Assessment |
|---|---|---|
| **#60** (payments) | **No shared file.** #60 touches `gifts.service.ts` and `subscriptions.service.ts` (callers); B2-A1 touches only `src/email/*` and `tests/unit/email/*`. | Compatible. #60 calls `sendGiftCard`, `sendGiftConfirmation` and `sendPlanInvite` with unchanged signatures. The future caller work for E-7, E-8 and E-9 (B2-A2) still depends on #60's final shape (B2-D6). |
| **#66** (EmailService tests) | No shared file (#66 edits `tests/unit/auth/email.service.spec.ts`; B2-A1 adds `tests/unit/email/`) | Compatible. #66's 32 tests pass on this branch. Whichever merges first, the other needs at most a trivial rebase. |
| **#75** (addresses) | None (docs only) | The support address now lives in one constant (`SUPPORT_EMAIL`, value unchanged), so any future address change is one line in `email.service.ts`. |

## 12. Outstanding decisions (all pending PO approval)

| Decision | Status |
|---|---|
| B2-D1: language for known users and non-users | Pending |
| B2-D2: correct existing EN/ES defects (X-1a local, X-2, X-5, X-6). OAuth (B2-A2b) needs separate PA review and PO authorization. | Pending |
| B2-D3: empty-body push types | Pending |
| B2-D4: unknown or invalid preferences (N-1 activation; designed fallback `es`) | Pending |
| B2-D5: French sensitive messages: human fr-CA review; legal review of E-4 | Pending |
| B2-D6: integration with #60, #66 and #75 | Pending |
| Terminology D-T1 to D-T6 (affects the French draft) | Pending |

## 13. SP-1 not modified

**Confirmed.** No change to:
- push notifications;
- `push_tokens`;
- `PushService`;
- logout;
- account-deletion procedures;
- gift records;
- any migration.

SP-1 (PR #82 §6.1) remains open and out of scope.

## 14. Draft PR and final HEAD

The Draft PR URL and final HEAD SHA are recorded in the PR description and in the completion comment, because this document is part of the commit it would describe.

---

**Not authorized and not done:**
- **Out-of-scope work:** B2-A2, B2-B, SP-1.
- **Code that wasn't touched:** registration or OAuth changes; caller, DTO, Stripe-metadata or schema changes; N-1 activation.
- **Release and activation:** French activation in API, web or mobile; merge; deployment; OTA; builds.
- **Spending and delivery:** expenses; email delivery.

**STOP AFTER B2-A1 FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**
