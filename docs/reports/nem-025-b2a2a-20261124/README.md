# NEM-025 B2-A2a: local registration language and account-email localization (completion report)

**Authorization:** PO execution authorization "NEM-025 / B2-A2a", which approves B2-D1, B2-D2, B2-D4 and B2-D6, with OAuth excluded. **Only B2-A2a was executed.**

**Not done:**
- B2-A2b OAuth, commerce, gift, waitlist or invitation changes;
- B2-B push;
- French activation;
- migrations or backfills;
- merges, deployments, builds for release or OTA updates;
- real emails or expenses.

**STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

---

## 1. Verified baseline and dependency graph

| Reference | Expected | Verified head (2026-11-24) | Base |
|---|---|---|---|
| Checkpoint A, PR #78 | `81143790` | `81143790` | `main` |
| B1-A web, PR #80 | `28aa6680` | `28aa6680` | Checkpoint A |
| B1-B mobile, PR #81 | `c4106a2` | `c4106a2b` | Checkpoint A |
| B2 preparation, PR #82 | `0ad54f7` | `0ad54f75` | `main` |
| B2-A1, PR #83 | `0f14735` | `0f147359` | Checkpoint A |
| SP-1-I1, PR #85 | `82c3d2e` | `82c3d2e0` | `main` |
| `main` | — | `8f2f2943` | — |

**Governance read:**
- root `CLAUDE.md`;
- `docs/engineering-missions/README.md` and `REVIEW-CHECKLIST.md`;
- NEM-025 specifications (#77);
- the Checkpoint A interface-locale contract (`users/ui-locale.ts`);
- B2 preparation and the message matrix (#82), including N-1 in §3.3.1 and the A2a/A2b split;
- the B2-A1 implementation (#83);
- the B1-A and B1-B registration surfaces.

```
main 8f2f294
 └─ #78 Checkpoint A 8114379
     ├─ #83 B2-A1 0f14735 ─── B2-A2a API  (this report)     feat/nem-025-b2a2a-api
     ├─ #80 B1-A  28aa668 ─── B2-A2a web                    feat/nem-025-b2a2a-web
     └─ #81 B1-B  c4106a2 ─── B2-A2a mobile                 feat/nem-025-b2a2a-mobile
```

**Stacking:**
- Each surface has its own Draft PR on the branch it depends on. No branches were merged or combined.
- The three B2-A2a PRs are independent of each other:
  - **New client against an old API:** the global `ValidationPipe({ whitelist: true })` silently drops the unknown `uiLanguage`, so registration still succeeds in Spanish.
  - **Old client against the new API:** the client omits the field, which is optional.
- Each PR was tested on its own base.

## 2. Draft PRs and heads

| Surface | Draft PR | Base | Commits |
|---|---|---|---|
| API | see the PR comment and description | `feat/nem-025-checkpoint-b2a1` | `a2472e3` golden master (unchanged code); `a34818e` implementation; then this report |
| Web | see the API PR comment | `feat/nem-025-checkpoint-b1a` | `fd5f819` |
| Mobile | see the API PR comment | `feat/nem-025-checkpoint-b1b` | `0aaf975` |

The PR URLs and the final API head are recorded in the completion comment on the API PR, because this file is part of the commit it would name.

## 3. Changed files

**API (13 files):**

| File | Change |
|---|---|
| `src/auth/dto/register.dto.ts` | Optional `uiLanguage`, `@IsIn(SUPPORTED_UI_LOCALES)` |
| `src/auth/auth.controller.ts` | Passes `dto.uiLanguage` to `register` (one line) |
| `src/auth/auth.service.ts` | `register(…, uiLanguage?)`: gate check before the email lookup, value stored on create, confirmation in the persisted locale. Resend and reset use `accountEmailLocale`; the casts are removed. |
| `src/users/users.service.ts` | Farewell locale via `accountEmailLocale` (one line plus a comment) |
| `src/email/locale.ts` | `accountEmailLocale()` (wraps `resolveMessageLocale`); doc comments updated for the B2-D4 approval |
| `src/email/email.service.ts` | **Type-only:** the three account methods accept `EmailLocale`. **No runtime change.** |
| `tests/unit/auth/account-email.golden-master.spec.ts` (+ `.snap`) | Golden master (`a2472e3`); the pre-correction block was edited explicitly in `a34818e` |
| `tests/unit/auth/register-locale.spec.ts` | New: scenarios 1–6 and 10–14, security and non-interference tests |
| `tests/unit/auth/dto/register.dto.spec.ts` | New: DTO validation |
| `tests/unit/auth/auth.service.spec.ts` | One expectation: an explicit `'es'` fourth argument |
| `tests/unit/email/locale.spec.ts`, `templates.spec.ts` | Test titles and comments only (they described N-1 as unauthorized) |

**Web (4 files):**
- `app/(auth)/register/page.tsx`: three lines;
- `lib/register-request.ts`: new;
- `tests/unit/lib/register-request.spec.ts`: new;
- `tests/unit/app/auth/register-page.spec.tsx`: new.

**Mobile (4 files):**
- `src/screens/auth/RegisterScreen.tsx`: three lines;
- `src/auth/register-request.ts`: new;
- `tests/unit/auth/register-request.spec.ts`: new;
- `tests/unit/screens/RegisterScreen.locale.spec.tsx`: new.

## 4. API, web and mobile separation

**API:**
- validates and persists the registration language;
- applies N-1 to the four account-email callers.

**Web and mobile:**
- read the language from the existing `LanguageProvider` (`useTranslation().language`). No new state, storage or preference source.
- send it on `POST /auth/register` only. No other request changes.
- send only `es` or `en`. `fr-CA` is never sent from registration in this build (§12).

**Unchanged:** OAuth buttons and components (`SocialAuthButtons`), login, password reset and every other screen.

## 5. Data flow

```
LanguageProvider.language (es | en | fr-CA*)        *fr-CA only if the client French gate is on
  └─ registerRequestBody(fields, language)          web lib/register-request.ts · mobile src/auth/register-request.ts
       → { name, email, password, uiLanguage?: 'es' | 'en' }    fr-CA / anything else → field omitted
POST /auth/register
  └─ ValidationPipe: RegisterDto.uiLanguage optional, @IsIn(es, en, fr-CA)            else 400
  └─ AuthService.register
       1. registrationUiLocale(): undefined → none; not selectable now (fr-CA gate off) → 400   ← BEFORE findByEmail
       2. findByEmail → 409 (unchanged)
       3. bcrypt hash (unchanged)
       4. usersService.create({ name, email, passwordHash, provider: local, emailConfirmed: false, uiLanguage? })
             omitted → insert byte-identical to before; column default 'es' applies
       5. generateEmailConfirmToken (unchanged)
       6. sendEmailConfirmation(…, accountEmailLocale(user.uiLanguage))   persisted value, N-1 normalized
       7. issueTokens → response (unchanged shape)
GET /users/me → { …, uiLanguage }  (established contract; reports the persisted value)
```

## 6. Backward compatibility

| Client | Behaviour |
|---|---|
| Old web or mobile build (no field) | Registers. The insert is identical to before and stored as `es`; the email is Spanish. **Test 3**, plus golden master `register/omitted/create` and `register/omitted/email` (byte-identical). |
| New client, old API | The field is stripped by whitelist validation, and the reader registers in Spanish, as before |
| Registration response | **Unchanged** for web and mobile (golden master `registration response body`, byte-identical) |

**Decision for PA (R-1), on the response contract.** The register response comes from the shared `safeUser()`, which is also used by login, refresh, confirm and the OAuth callbacks. Adding `uiLanguage` there would change OAuth responses, which this mission excludes.
- The persisted preference is reported through the established contract, `GET /users/me`. **Test 6** asserts it returns the stored value after registration.
- Both clients already read `GET /users/me`.
- The register response neither contains nor contradicts the value.
- If the PA prefers `uiLanguage` in the register response itself, a register-only field is a small follow-up.

## 7. N-1 normalization matrix (B2-D4)

**Applies to:**
- registration confirmation;
- resend confirmation;
- password reset;
- account-deletion farewell.

All four go through `accountEmailLocale(stored) = resolveMessageLocale(stored).locale`.

| Stored / persisted value | Body and subject | `<html lang>` before | `<html lang>` after |
|---|---|---|---|
| `es` | Spanish (unchanged) | `es` | `es` (**byte-identical**) |
| `en` | English (unchanged) | `en` | `en` (**byte-identical**) |
| `fr-CA` (gate on or off; readiness constant false) | Spanish | `fr-CA` | **`es`** |
| `pt`, `fr`, `EN`, `''`, other legacy values | Spanish | raw value | **`es`** |
| `null` / missing | Spanish | `es` (cast fallback) | `es` |
| `"><script>` (hostile) | Spanish | raw value (escaped nowhere) | **`es`** |

**Not normalized (excluded, B2-D6):**
- gift card;
- gift confirmation;
- waitlist confirmation;
- waitlist invite;
- plan invite.

These still call EmailService exactly as before; EmailService itself still selects with `dispatchCopyLocale()` and echoes its `lang` argument. X-4 therefore remains open for those callers, for a later B2-A2 mission.

The farewell fallback name (`Lector` or `Reader`) is unchanged for every value: invalid values chose `Lector` before and still do.

## 8. ES/EN golden-master comparison

**Golden masters:**
- **New (`a2472e3`, captured on unchanged B2-A1 code):** 12 snapshots:
  - registration from a client that sends no language (create call and email);
  - resend, reset, farewell and farewell-without-name, each for `es` and `en`;
  - the web and mobile registration response bodies.
- **B2-A1:** 46 email snapshots.

**Unchanged:** all 58 snapshots pass. No snapshot file was modified after `a2472e3`, and none was regenerated.

**Intentional changes,** made as an explicit edit of the `pre-correction record` block in `a34818e` (visible in the diff):
1. Invalid or gated stored values: the subject and body are still Spanish; `<html lang="<raw>">` becomes `<html lang="es">`. That is 15 cases: 3 paths × `pt`, `EN`, `fr`, `''`, `fr-CA`.
2. A registration language was ignored before (nothing stored, Spanish email). It is now persisted, and the confirmation is in that language.

## 9. Registration and existing-account email tests

All mail goes through the real EmailService with nodemailer mocked.

| # | Scenario | Test | Result |
|---|---|---|---|
| 1 | Spanish UI → stored `es`, Spanish email | `register-locale` 1 | ✅ |
| 2 | English UI → stored `en`, English email | `register-locale` 2 | ✅ |
| — | Language set on create, not by a later update | `register-locale` | ✅ |
| 3 | Old client omits the language → Spanish registration | `register-locale` 3; golden master | ✅ |
| 4 | Unsupported values (`pt`, `EN`, `fr`, `es-MX`, `''`, `<b>`, `null`, `42`) → 400 before lookup; nothing stored; no email | `register-locale` 4; DTO spec | ✅ |
| 5 | `fr-CA` rejected while the gate is closed (unset, `TRUE`, `1`, `yes`) | `register-locale` 5 | ✅ |
| 6 | The persisted preference is what `GET /users/me` reports | `register-locale` 6 | ✅ |
| 7 | Resend unchanged for `es`/`en` | Golden master | ✅ byte-identical |
| 8 | Password reset unchanged for `es`/`en` | Golden master | ✅ byte-identical |
| 9 | Farewell unchanged for `es`/`en`, with and without a name | Golden master | ✅ byte-identical |
| 10 | Invalid or legacy values → Spanish body and `lang="es"` | Golden master correction block; resolver table | ✅ |
| 11 | Stored `fr-CA` → Spanish (even with the gate on) | Golden master; `register-locale` 11 | ✅ |
| 12 | OAuth unchanged | `register-locale` 12 (create payload, arities); web and mobile OAuth assertions | ✅ |
| 13 | Gift, invitation, waitlist and commerce callers unchanged | `register-locale` 13; `templates.spec` raw-attribute tests | ✅ |
| 14 | No external email | nodemailer mocked in every spec; asserted | ✅ |
| 15 | Registration and authentication security | 409 unchanged; same 400 for taken and free emails; hash, token and confirmation status unchanged | ✅ |
| 16 | B2-A1 tests pass with no snapshot change | 46 snapshots, 125 email tests | ✅ |

**Web:**
- `register-page.spec.tsx`: the real page with mocked API; the form is filled and submitted.
  - `es` → `uiLanguage: 'es'`; `en` → `'en'`; `fr-CA` → no field.
  - OAuth buttons still render.
- **Negative control:** against the unchanged page, the es/en tests fail.

**Mobile:**
- `RegisterScreen.locale.spec.tsx`: uses the B1-B shallow harness, since there's no React renderer in the package. It calls the real submit handler.
  - Same matrix as web.
  - `SocialAuthButtons` props are unchanged (`onSuccess` = `onRegister`, plus `onError`).
- **Negative control:** against the unchanged screen, the es/en tests fail.

**Security notes:**
- The language check runs before `findByEmail`. A gated or unsupported value gives the same 400 for taken and free emails, so it adds no account-existence signal.
- A valid language never bypasses the 409, never changes hashing, tokens or `emailConfirmed`, and is never logged.
- The DTO's `@IsOptional` treats `null` as absent; the service then rejects `null` (400), consistent with `PATCH /users/me`.

## 10. OAuth non-interference

**API:**
- `upsertOAuthUser`, `verifyGoogleIdToken`, `verifyFacebookToken`, `verifyAppleIdentityToken`, the OAuth controller routes and `safeUser()` are untouched in the diff.
- The test asserts:
  - the OAuth create payload is unchanged and has no language;
  - no email is sent;
  - the method arities are unchanged.

**Web:** `SocialAuthButtons` is untouched and still rendered.

**Mobile:** `SocialAuthButtons` is untouched; its props on the register screen are unchanged.

B2-A2b (OAuth localization) was not started.

## 11. Excluded-call-site non-interference

**Callers:**
- No source change to `gifts.service.ts`, `waitlist.service.ts`, `subscriptions.service.ts`, Stripe, checkout or tokens. The test asserts these files and `email.service.ts` never reference `accountEmailLocale` or `resolveMessageLocale`.

**EmailService:**
- **Runtime unchanged.** The only change is the TypeScript type of the `lang` parameter on the three account methods.
- All 46 B2-A1 golden masters pass.
- PR #66's 32 EmailService tests pass when run against this branch.

**Push:** B2-B was not started; there is no push change.

## 12. French fail-closed

| Layer | Behaviour |
|---|---|
| `FR_CA_TRANSACTIONAL_READY` | Still `false`; asserted in `register-locale` 5b |
| API registration | `fr-CA` → 400 unless `FR_CA_ENABLED === 'true'`, the same gate as `PATCH /users/me` |
| API with the gate on | Accepts `fr-CA` per the Checkpoint A contract (**decision for PA, R-2**). The confirmation is Spanish with `lang="es"`. |
| Account emails | Stored `fr-CA` → Spanish, gate on or off |
| Web and mobile | `fr-CA` is never sent from registration, whatever the client gate. This avoids a gate mismatch turning into a failed registration. |

No French copy is sent, no French UI or legal consent was enabled, and USD policy is untouched.

## 13. Typecheck, lint, unit tests and build

All runs are local with `--maxWorkers=2`.

**API (base: B2-A1 `0f14735`):**

| Check | Base | B2-A2a |
|---|---|---|
| Unit tests | 1,467 passed | **1,541 passed** (+74), 85 suites |
| Snapshots | 46 | 58 (46 + 12 new) |
| Coverage, all files (statements / branches / functions / lines) | 78.66 branches (B2-A1 report) | 91.70 / **78.98** / 90.50 / 93.13 |
| `email.service.ts`, `users.service.ts` | 100 | 100 |
| `tsc --noEmit` | pass | pass |
| `npm run lint` | 0 errors / 254 warnings | 0 errors / **254** warnings. The touched files' warnings are pre-existing and on untouched lines (12 in the controller, 2 in the service, identical on the base); the new specs have none. |
| `nest build` | pass | pass |

**Web (base: B1-A `28aa668`):**

| Check | Base | B2-A2a |
|---|---|---|
| Unit tests | 615 passed / 35 suites | **624 passed** / 37 suites |
| Snapshots | 20 | 20 (unchanged) |
| Coverage, all files | 86.66 / 82.82 / 83.33 / 86.93 | 86.75 / 83.01 / 83.39 / 87.03; `register-request.ts` 100 |
| `tsc --noEmit` | pass | pass |
| `next lint` | 15 warnings, 0 errors | 15 warnings, 0 errors |
| `next build` | — | pass (`/register` 2.62 kB) |

**Mobile (base: B1-B `c4106a2`):**

| Check | Base | B2-A2a |
|---|---|---|
| Unit tests | 261 passed / 31 suites | **270 passed** / 33 suites |
| Snapshots | 17 | 17 (unchanged) |
| Coverage, all files | 45.34 / 37.01 / 32.26 / 48.27 | 46.26 / 38.38 / 32.64 / 49.24; `register-request.ts` 100 |
| `tsc --noEmit` | pass, 0 errors | pass, 0 errors |
| Lint | No lint script or configuration in the package | — |
| Build | Not run: no EAS build or OTA is authorized. The change is JavaScript-only. | — |

**Local note:** the new API worktree first lacked the repo-root `node_modules` link used by the other worktrees. Three unrelated suites could not resolve `jsonwebtoken` and `express` until the link was added. That was an environment artifact, not a test failure.

## 14. CI and pre-existing failures

**CI:** it runs only on PRs targeting `main` (`.github/workflows/ci.yml`). All three B2-A2a PRs are stacked on feature branches, so **CI does not run on them**; the results above are local. This is the same situation as #80, #81 and #83.

**Pre-existing failures on `main`-targeted PRs** (none introduced here; see the #85 CI comment):
- the API branch-coverage gate (main 69.14%);
- the web and mobile unit coverage gates;
- web E2E: the runner image is Ubuntu 26.04, which Playwright doesn't support.

**Locally, against the 80% thresholds:**
- **API:** branch coverage 78.98% (improved from 78.66%) is still below 80%.
- **Mobile:** below 80% (pre-existing).
- **Web:** meets 80%.

## 15. Compatibility with related PRs

| PR | Overlapping files | Assessment |
|---|---|---|
| #60 payment lifecycle | none | No auth, email or users file in #60's diff. No gift, subscription or purchase code touched (B2-D6). |
| #66 EmailService tests | none | #66's spec, run against this branch: **32/32 pass**. The only EmailService change is type widening. |
| #80 B1-A | `app/(auth)/register/page.tsx` | Expected: the web PR is stacked on #80 and edits three lines of its page |
| #81 B1-B | none | The mobile PR is stacked on #81 |
| #83 B2-A1 | `email/locale.ts`, `email.service.ts`, two specs | Expected: the API PR is stacked on #83 and builds on its foundation |
| #85 SP-1-I1 | `users/users.service.ts` (`deleteAccount`) | A three-way merge (`git merge-file`) of #85's version, this version and the shared base is **clean**: #85's push cleanup and the farewell locale line sit side by side. The SP-1-I1 order is preserved: user delete → push cleanup → farewell. |

## 16. Outstanding work (not authorized here)

**B2-A2b:**
- OAuth registration language (separate PA review and PO authorization);
- whether OAuth responses should carry `uiLanguage`.

**Other B2-A2 correction families (approved direction, separate missions):**
- gift, waitlist and invitation recipient-language policy (B2-D1 callers);
- HTML entities in plain-text subjects (X-5);
- hardcoded Spanish fallback names and labels;
- normalization for the excluded templates (X-4 for those callers).

**Commerce:** gift and buyer language, and subscription and plan-invite emails, pending #60 compatibility review.

**B2-B:** push localization.

**For PA:**
- **R-1:** register-response contract (§6).
- **R-2:** whether the API should accept `fr-CA` at registration when only the interface gate is on (§12). Current behaviour follows the Checkpoint A contract, and the confirmation still falls back to Spanish.

**Unchanged and noted:** F-X1, found in SP-1-I1. `AuthController`'s class-level `@Throttle({ default: … })` is not applied (the throttler is named `global`). Registration throttling is unchanged by this mission.

The historical account-deletion erasure claim remains a separately tracked privacy and legal item; the farewell wording was not changed.

## 17. No deployment, migration or expense

**Confirmed:**
- no merge;
- no deployment;
- no staging or production access;
- no SQL;
- no migration or backfill (the existing `uiLanguage` column, migration 044, default `'es'`, is used as is);
- no new dependency or infrastructure;
- no expense;
- no real email (nodemailer mocked everywhere);
- no mobile build or OTA;
- no French activation;
- no payment-gate, USD, legal-copy or account-deletion-procedure change.

---

**STOP AFTER IMPLEMENTATION FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

The Product Owner retains final authority over integration, release and subsequent engineering missions.
