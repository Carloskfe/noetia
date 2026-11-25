# NEM-025 Checkpoint B1-A: Web Interface Completeness, completion report

**Authorization:** PO execution authorization "NEM-025 / CHECKPOINT B1-A — WEB INTERFACE COMPLETENESS". The B1 specification, including B1-D1 to B1-D4, was approved by the PO.
**Status:** implemented on a Draft PR stacked on Checkpoint A. **PA review: conditionally accepted.** This revision is a documentation-only correction requested by that review (billing dependency, golden-master counts, release-readiness limitations in §12); no implementation or test file changed. **MANDATORY STOP:** awaiting independent PA re-review. No B1-B (mobile), no B2 (email/push), no merge, no deployment.

## 1. Verified baseline and dependency commits

| Ref | SHA |
|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01` (unchanged) |
| Checkpoint A (PR #78, branch `feat/nem-025-checkpoint-a`) | `81143790e661126dbf862201565d6c98ab111019`: **B1-A is branched from this exact head** |
| Approved spec and record (PR #77) | `4ef2906d2713508c25494fad67a6de91f13cb903` |
| Checkpoint B prep (PR #79) | `e24c729` |
| USD/CAD governance (PR #76) | `4302f0d` |

- **Branch:** `feat/nem-025-checkpoint-b1a`. The Draft PR targets `feat/nem-025-checkpoint-a`, so its diff contains only B1-A.
- **CI:** CI only runs on PRs into `main`, so it **does not run on this stacked PR**. The equivalent checks were run locally (§9). If PA requires CI evidence, the options are retargeting to `main` (the diff would then include Checkpoint A) or waiting for #78. No dependency branch was merged.

## 2. Draft PR and commits

See the PR body. Commits, in order:
1. `69a0501`: golden master captured on unchanged code.
2. `486e209`: corporate pages and header.
3. `bb32883`: upload guide.
4. `28cb77f`: remaining surfaces and approved corrections.
5. `f1e32fc`: author portal.
6. `bd91e2f`: tests.
7. `ad55aff`: this report and the SEO note.
8. Documentation-only correction after PA review (this report only).

## 3. Changed files (59 under `services/web/`, plus 2 docs)

- **New typed dictionaries:** `lib/i18n/pages/{types,corporate-nav,about,careers,company,contact,how-we-build,milestones,team,trust,upload-guide,causas,share-invite,author-portal}`.
- **New helpers:** `lib/i18n/errors.ts` (localized API error mapping) and `lib/i18n/format.ts` (presentation-only dates and country names).
- **Extended:** `lib/i18n/{en,es,fr-ca}.ts`, with new keys: `common.tooManyAttempts`, `auth.*.errors.{invalidCredentials,emailTaken}`, `onboarding.interests.selectedCount`, `onboarding.prefs.otherCountry`, `account.accountSection`, `clubs.create.bookRequired`, `clubs.page.{leaveConfirm,linkCopied}`, `clubs.sessions.{cancelConfirm,notFound,loadError}`, and the new namespaces `bookGrid`, `emailBanner`, `collection`, `clubLive`, `clubCard`, `clubDiscussionForm`, `accountNav`, `authCallback`, `socialPage`.
- **Pages and components switched to dictionaries:**
  - the 8 corporate pages plus `_components` (the corporate header toggle now uses `selectableLanguages()`);
  - `upload-guide`, `causas`, `s/[id]`, `(admin)/author`;
  - `onboarding/{interests,preferences}`, `discover/collection/[slug]`, `profile`, `(account)/layout`, `auth/callback`, `(social)/social`;
  - `login`, `register`, `confirm-email` (error mapping);
  - the club pages and components (`clubs/[id]`, `clubs/new`, `live`, `ClubCard`, `ClubChat`, `ClubDiscussion`, `ClubPollCard`, `ClubSessionCard`, `EscuchaJuntosRoom`);
  - `BookGrid` and `EmailVerificationBanner`.
- **Tests:** `tests/unit/golden-master/b1a-web.spec.tsx` (+ snapshot), `tests/unit/lib/i18n/{pages.spec.tsx,errors.spec.ts,format.spec.ts}`, `tests/unit/lib/i18n.spec.ts` (allowlist).
- **Not touched:** `services/api`, `services/mobile`, `lib/legal/*`, the email and push services, Stripe and payments, `lib/purchase-availability.ts`, CI, `package.json` and the lockfile.

## 4. Web localization coverage matrix

| Surface | ES/EN source | fr-CA | Status |
|---|---|---|---|
| Corporate: about, careers, company, contact, how-we-build, milestones, team, trust, header | inline bilingual → dictionaries | ✅ full | DONE (draft fr) |
| Upload guide | inline → dictionary | ✅ full | DONE |
| Causas page | inline → dictionary | ✅ full (2,22 %) | DONE |
| Share invite `/s/[id]` | inline → dictionary | ✅ behind gate | DONE |
| Author portal (B1-D1) | Spanish-only → dictionary | ✅ full | DONE (EN added) |
| Book grid, email banner, collection, onboarding interests and countries, account nav, profile (status, section, dates), auth callback, social page, club confirm/alert/errors/aria/labels/dates | literals → dictionary | ✅ | DONE |
| Login, register, confirm-email error display | raw API text → localized mapping | ✅ | DONE |
| Main dictionaries (`en`/`es`/`fr-ca`) | — | ✅ 100% keys | DONE |
| Billing page `account/billing` | Spanish-only | ❌ | **UNRESOLVED INTEGRATION DEPENDENCY on PR #60** (pre-execution check V-2). **Not complete and not approved for French exposure.** Only the account-nav link label ("Billing"/"Facturación"/"Facturation") is localized; the page it opens is Spanish-only in every language. |
| Pricing and gift price display | `$` formatting | — | **UNRESOLVED INTEGRATION DEPENDENCY on PR #60** (`currency.ts`, V-3). Not complete; no CAD |
| Legal pages (`LegalPage`, `lib/legal/*`) | ES+EN side by side | ❌ | **EXCLUDED: legal agreements not translated or altered** |
| `WaitlistForm`, `PlanCard` | Spanish / English literals | ❌ | **Unused** (no route renders them); recommend removal (separate decision) |
| Internal admin console `(admin)/admin` | Spanish-only | ❌ | **EXCLUDED** (B1-D1) |
| SEO / metadata (19 files) and `<html lang>` | static | ❌ | **Design note only** (`seo-design-note.md`) |
| `how-we-build` stack table labels | English in every language | unchanged | Technical labels, kept as before |
| Profile interest tags | Spanish values stored in the user record | unchanged | Data values, not UI copy; changing them needs a data decision |

## 5. EN/ES golden-master comparisons

- **Method:** commit `69a0501` recorded, **before any refactor**, the visible text and accessible attributes (aria-label, title, placeholder, alt) of 20 surfaces as Jest snapshots: one snapshot per surface, each holding an ES entry and an EN entry (20 snapshots, 40 language entries). Every later commit ran against them.
- **Correction of the earlier count:** the first version of this report said "14 byte-identical surfaces" and "7 changed entries". The exact counts, from comparing the snapshot file at `69a0501` with `ad55aff`, are: **13 surfaces unchanged, 7 surfaces changed, 8 language entries changed** (the collection surface changed in both ES and EN). 32 of 40 language entries are byte-identical.

**The 20 tested surfaces** (`SURFACES` in `services/web/tests/unit/golden-master/b1a-web.spec.tsx`):

| # | Surface | ES entry | EN entry |
|---|---|---|---|
| 1 | `corporate/about` | unchanged | unchanged |
| 2 | `corporate/careers` | unchanged | unchanged |
| 3 | `corporate/company` | unchanged | unchanged |
| 4 | `corporate/contact` | unchanged | unchanged |
| 5 | `corporate/how-we-build` | unchanged | unchanged |
| 6 | `corporate/milestones` | unchanged | unchanged |
| 7 | `corporate/team` | unchanged | unchanged |
| 8 | `corporate/trust` | unchanged | unchanged |
| 9 | `corporate/nav` | unchanged | unchanged |
| 10 | `upload-guide` | unchanged | unchanged |
| 11 | `causas` | **changed** (C-1) | unchanged |
| 12 | `book-grid` | unchanged | **changed** (C-2) |
| 13 | `waitlist-form` (unused component) | unchanged | unchanged |
| 14 | `email-verification-banner` | unchanged | **changed** (C-3) |
| 15 | `onboarding/interests` | unchanged | **changed** (C-4) |
| 16 | `discover/collection` | **changed** (C-5, fixture) | **changed** (C-6) |
| 17 | `plan-card` (unused component) | unchanged | unchanged |
| 18 | `account/layout` | **changed** (C-7) | unchanged |
| 19 | `author-portal` | unchanged | **changed** (C-8) |
| 20 | `club-card` | unchanged | unchanged |

**Each changed ES/EN snapshot entry:**

| ID | Entry | Before (baseline `69a0501`) | After (`ad55aff`) | Reason |
|---|---|---|---|---|
| C-1 | `causas` ES, text | "Escribenos a causas@noetia.app" | "Escríbenos a causas@noetia.app" | §6 #6 (accent) |
| C-2 | `book-grid` EN, aria-label ×3 | "En tu biblioteca", "Agregar a tu biblioteca" ×2 | "In your library", "Add to your library" ×2 | §6 #1 |
| C-3 | `email-verification-banner` EN, text + aria-label | "Confirma tu correo electrónico para acceder a pagos y descargas. Reenviar correo"; aria "Cerrar" | "Confirm your email to access payments and downloads. Resend email"; aria "Close" | §6 #2 |
| C-4 | `onboarding/interests` EN, text | Spanish ("¿Qué te interesa leer? Elige hasta 5 categorías…") | English ("What do you like to read? Choose up to 5 categories…") | §6 #3 |
| C-5 | `discover/collection` ES, text | "… Clásicos libros …" | "… Clásicos2 libros …" | **Test-fixture change, not a product change:** the baseline fixture had no `bookCount`, so the count rendered empty in both versions of the code. Adding `bookCount: 2` to the fixture is the only fixture change. Spanish copy is otherwise identical. |
| C-6 | `discover/collection` EN, text | "Volver Colección … libros" (Spanish) | "Back Collection … 2 books" | §6 #4, plus the same fixture change as C-5 |
| C-7 | `account/layout` ES, text | "Account", "Billing" (English) | "Cuenta", "Facturación" | §6 #5 |
| C-8 | `author-portal` EN, text + 4 placeholders | Spanish ("Portal de autores…"; placeholders "El nombre completo de tu libro", "Nombre completo del autor", "Breve descripción…", "978-… (opcional)") | English ("Author portal…"; "The full title of your book", "The author's full name", "A short description…", "978-… (optional)") | §6 #7 |

Collection, book titles and descriptions in the fixtures ("Clásicos", "Obras maestras") are book/catalogue data and stay in their original language by design.

## 6. Intentional EN/ES corrections (B1-D2) and supporting tests

| # | Surface | Before | After | Evidence |
|---|---|---|---|---|
| 1 | Book grid add-to-library button (aria) | Spanish for EN | English for EN; ES unchanged | golden `book-grid` en |
| 2 | Email-verification banner | Spanish for EN | English for EN; ES unchanged | golden `email-verification-banner` en |
| 3 | Onboarding interests | Spanish for EN; error fallback English ("Something went wrong.") for ES | dictionary in each language; localized error | golden `onboarding/interests` en; `errors.spec` |
| 4 | Collection page | Spanish for EN; raw error text; "1 libros" | localized; mapped error; correct singular | golden `discover/collection` |
| 5 | Account nav | English ("Account", "Billing") for ES | Spanish for ES ("Cuenta", "Facturación"); EN unchanged | golden `account/layout` es |
| 6 | Causas page | "Escribenos" (missing accent) | "Escríbenos" | golden `causas` es |
| 7 | Author portal | Spanish for EN authors; raw server errors | English for EN; localized errors (status code only) | golden `author-portal` en; `pages.spec` |
| 8 | Profile | status badge, "Cuenta" section and dates in Spanish for EN | interface language (ES unchanged: same labels, `es-ES` dates) | `format.spec`; dictionary keys |
| 9 | Club screens | leave/cancel confirms, link-copied alert, session errors, no-audio, "Frase #" in Spanish for EN; "Select a starting book." and aria "Delete"/"Playback position" in English for ES | each in the interface language | dictionary parity tests |
| 10 | Auth callback, `/social` | English for ES | Spanish for ES | dictionary keys |
| 11 | Login, register, confirm-email errors | raw API messages (English, e.g. "Invalid credentials") for every language | localized by HTTP status (401/409/429/other) | `errors.spec` |
| 12 | Club session/poll dates, profile dates | browser-default locale, or `es-ES` for everyone on the profile | interface language (`es-ES`, `en-US`, `fr-CA`) | `format.spec` |

**No product-policy, legal-copy or financial meaning was changed.** The 2.22% Causas figure, the "planned program" wording, the purchases-unavailable notices and the Noetia+/NoetiaX "Coming Soon" copy are unchanged in ES/EN, and kept in fr-CA.

## 7. French gate verification

- All gates default **off** and **fail closed** (only `'true'` enables them).
- **Corporate header:** ES/EN only by default; `TRUE` keeps French hidden; `FR` appears only with `NEXT_PUBLIC_FR_CA_ENABLED=true` (golden spec, gate block).
- **Share page:** `pickShareLanguage` returns `fr-CA` only with the gate on (`pages.spec`).
- **Checkpoint A protections unchanged:** `LanguagePicker` and `LanguageProvider` refuse `fr-CA` while gated, and the API rejects `fr-CA`. There is no other path to French: all new French copy is reached only through the active interface language, which can't be `fr-CA` while the gate is off.
- **Untranslated legal content and transactional messages cannot become public through B1-A:** no legal text or email/push template was changed or translated.

## 8. Accessibility and formatting results

- **Accessible names** (aria-label, placeholder, alt) are now localized on the B1-A surfaces and captured in the golden master.
- **Interpolation parity:** every function in the main and page dictionaries is called with the same arguments in every language.
- **Unicode:** French accents, ligatures (œ) and typographic quotes are rendered and asserted, for example `février` and `2,22 %`.
- **Untranslated-string guards:** these cover the main dictionaries and every page dictionary.
- **Formatting:** dates use `Intl` with the interface locale. Country names use `Intl.DisplayNames` (fr-CA "Mexique"); Spanish keeps its existing labels. No currency formatting was changed, and there is no CAD.
- **Long strings:** French is ~15–30% longer. Visual wrapping and truncation at phone widths were **not** verified (needs a manual or Playwright pass; E2E is red in CI for an environment reason, PR #64). This goes to the human review step.

## 9. Test and CI results (local, Node 20, `--maxWorkers=2`)

| Check | Checkpoint A (#78) | B1-A |
|---|---|---|
| Web unit tests | 498 passed | **615 passed (+117)** |
| Web coverage stmts / branches / funcs / lines | 83.87 / 82.25 / 79.71 / 84.06 (functions **below** 80) | **86.66 / 82.82 / 83.33 / 86.93: all ≥ 80** |
| Web lint | 15 warnings, 0 errors | 15 warnings, 0 errors (no new warnings) |
| Web typecheck / production build | pass | pass |
| API / mobile | untouched | untouched |

- **Existing vs introduced failures:** none introduced.
- **The web unit coverage gate**, which failed on `main` and on #78 (functions), **now passes locally.**
- The pre-existing api branch-coverage and mobile coverage failures, and the E2E environment failure, are unaffected.
- No threshold or CI file was changed.
- CI does not run on this stacked PR (§1).

## 10. Protected-system confirmation

Untouched:
- payments, Stripe, `PAYMENTS_ENABLED` and the purchase-availability gate;
- subscriptions and token economics;
- USD-only commerce (no CAD, no exchange rates);
- the 2.22% Causas commitment;
- Noetia+/NoetiaX "Coming Soon";
- legal agreements;
- API transactional communications (email and push);
- mobile;
- book ownership, reading progress, reader controls and Escucha Activa;
- book content and original book languages (book titles, authors and quotations untranslated; the English demo passage is kept);
- NEM-026 and ingestion (French is not offered as an upload language);
- schema, infrastructure, dependencies, expenses and production.

## 11. Outstanding issues for B1-B, B2 or PO decision

- **Human review:** the fr-CA review by a qualified Canadian-French reviewer (NEM-025 §16.2) covers about 7 000 French words added so far. Terminology is pending: "vous", "jeton", "Écoute active" (D-T1 to D-T6).
- **Billing page and USD price display: unresolved integration dependency on PR #60** (V-2, V-3). Not complete and not approved for French exposure (§4, §12).
- **SEO / `<html lang>` / metadata:** decision on Option A, B or C (`seo-design-note.md`, D-9).
- **Onboarding country list has no Canada** (Latin America, Spain, US, Other). A French-Canadian user must choose "Other". Adding Canada is a product data decision (PO).
- **Upload-guide and author-portal copy** say books reach "readers across Latin America". They are translated faithfully, not changed.
- **Unused `WaitlistForm` and `PlanCard`:** remove or localize (PO/PA).
- **Visual layout QA** of French text expansion (manual or Playwright).
- **B1-B (mobile)** and **B2 (email/push, gate readiness)** need separate PO instructions.

## 12. Release-readiness limitations

B1-A is **not** release-ready for French. Even after PA acceptance of the code, French must stay gated off until each limitation below is closed by its own approved work:

| # | Limitation | Status | Closed by |
|---|---|---|---|
| L-1 | **French visual layout QA** (text expansion ~15–30%, wrapping and truncation at phone and desktop widths) | Outstanding: not performed | Manual or Playwright pass on B1-A surfaces |
| L-2 | **Qualified Canadian-French review** of all fr-CA copy (~7 000 words) and terminology D-T1 to D-T6 | Outstanding: all fr-CA copy is draft | NEM-025 §16.2 reviewer (PO to appoint; cost not yet approved) |
| L-3 | **SEO** (`<html lang>`, metadata, hreflang, SSR language) | Outside B1-A: design note only, no French SEO readiness claimed | PO choice of option in `seo-design-note.md`, then a separate authorization |
| L-4 | **Legal localization** (Terms, Privacy, legal pages) | Outside B1-A: not translated or altered | Separate legal work and approval |
| L-5 | **Account billing and USD price display** | Unresolved integration dependency on PR #60; not complete, not approved for French exposure | Localization after PR #60 lands, under a separate authorization |
| L-6 | **Transactional email and push readiness** (fr-CA templates, server language, gate readiness) | Pending B2 | B2 PO authorization |
| L-7 | **Automated CI evidence** | Missing: CI does not run on this stacked PR; all results in §9 are local | CI run after retargeting to `main` or after #78 merges |
| L-8 | **Integration verification** with the dependency stack (#78 Checkpoint A, #60 payments, #59 public site) | Pending dependency reconciliation: B1-A has been verified only on top of `81143790` | Rebase/merge-order reconciliation and re-verification before any merge |
| L-9 | **Mobile** | Not started | B1-B PO authorization |

**MANDATORY STOP AFTER B1-A — awaiting independent Product Architecture re-review.**
