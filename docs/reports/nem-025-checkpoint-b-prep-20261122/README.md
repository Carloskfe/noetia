# NEM-025 Checkpoint B (Complete Trilingual Experience): engineering preparation report

**Mode:** DIAGNOSTIC + DESIGN ONLY. **This is not implementation authorization.** No application code was changed, no gate was enabled, and nothing was deployed.

**Companion files:**
- [`inventory.md`](inventory.md): the file-by-file localization inventory (B-1, B-2, B-3).
- [`fr-ca-terminology-guide.md`](fr-ca-terminology-guide.md): terminology, style and human-review requirements (B-4).

## 1. Verified repository baseline (revalidated 2026-11-22)

| Ref | State |
|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01`, unchanged since the NEM-025 audit baseline. The last merges are #65 (11-20) and #63 (11-18) |
| **PR #78**, Checkpoint A | Draft, head `81143790e661126dbf862201565d6c98ab111019`, **matches the instructed head**. CI run 45104680002: all tests pass; only the pre-existing coverage gates and E2E fail |
| PR #77, approved specs | Draft, `4ef2906`. NEM-025, NEM-026 and the manifest are verbatim (SHA-256 verified) |
| PR #76, USD/CAD governance | Draft, `4302f0d`. P-1 and P-2 FINAL, P-3 PENDING |
| PR #60, payment lifecycle | Draft, stacked on #59's branch, `d8e61e2`. **Adds ~211 lines to each of web `en.ts`/`es.ts` and 10 to each mobile file** |
| PR #67 (CI-3, web tests) | Draft, `255a9ce`. **Appends to `web/tests/unit/lib/i18n.spec.ts`** (also edited by #78) |
| PR #69 (CI-4.0) | Draft, `3bc8712`. **Adds the `react-test-renderer` dev dependency** that mobile render tests need |
| PRs #70 (CI-4.1, `9f4a192`) and #72 (PR-A, `395e6e9`) | Draft. **Both add `services/mobile/tests/unit/i18n/index.spec.ts`, the same path #78 creates** (add/add conflict) |

Inputs read: `CLAUDE.md`, mission governance, the NEM-025 specification and PO approval record (#77), Checkpoint A (#78) and USD-LOCAL-REFERENCE (#76).

## 2. Remaining localization surfaces (summary; details in `inventory.md`)

| Area | Files | Nature |
|---|---|---|
| Web inline-bilingual pages (fall back to English for fr-CA) | 13 (8 corporate pages, `_components`, `upload-guide`, `/causas`, `BookGrid`, `/s/[id]`) | ~3 700 French source words to extract into dictionaries |
| Web surfaces with no i18n | ~20 (billing page, WaitlistForm, EmailVerificationBanner, club confirm/alert/errors, PlanCard, account layout, auth callback, legal page chrome, author portal, admin) | Many are **pre-existing** bugs for EN or ES users too |
| Web server error strings | `lib/api.ts`, login, register, confirm-email | Raw English API messages shown to every language |
| Web metadata / SEO | 19 files; static `<html lang="es">` | Needs a locale-routing **design + PA STOP** before any route change |
| Mobile | 9 files (tabs, consent, social buttons, audio, library header, live chat, club alert) | Includes known defects M-D1, M-D2 and M-D4; Spanish tab labels for EN users |
| Email | 8 templates; binary `isEn` | 4 flows ignore the user's language entirely (**pre-existing**) |
| Push | 5 types | 2 have copy; **3 send an empty body today (pre-existing defect)** |
| Legal / consent | 3 documents, web `LegalPage`, mobile `ConsentScreen` | Legal-translation dependency |

Legitimate untranslated items (OK-NAME): "Noetia", "NOETIA", Causas Noetia, Noetia+/NoetiaX, email addresses, the English public-domain demo passage, symbols ("A−/A+", "10s"), book titles, author names and book text, which is never translated (NEM-025 §7).

## 3. Recommended implementation work packages

Each package is a separate commit set inside one Checkpoint B Draft PR, or separate PRs if the PO prefers. The French gate stays **off** throughout.

| WP | Content | Size | Notes |
|---|---|---|---|
| **B-W1** Web dictionary extraction | Move the 13 inline-bilingual files to dictionary namespaces (`corporate.*`, `uploadGuide`, `causasPage`, `bookGrid`); replace `_components` toggle with `LanguagePicker`; `/s/[id]` gate-aware `fr*` mapping | **L** (largest; ~400 strings) | Golden-master test first: snapshot each page's ES and EN text output **before** extraction, and assert identical text after (§4) |
| **B-W2** Web no-i18n surfaces | Wire the ~20 files to existing or new keys; client-side error mapping by status/code | **M** | Fixes pre-existing ES/EN defects; each such fix must be listed explicitly (§4) |
| **B-W3** Locale-aware formatting | `toLocaleString()` without a locale → `Intl` with the active locale; `formatUsd` by locale (`8,99 $ US`) | **S** | Depends on PR #60's `currency.ts` or its transplant |
| **B-W4** SEO / `html lang` design | Design document only: options (a) locale cookie + SSR `lang`; (b) `/fr-ca/` route prefix; (c) keep client-only and declare no fr-CA SEO | **S** (design) | **STOP for PA before any route migration** (NEM-025 §5.6) |
| **B-M1** Mobile surfaces | Tab labels, consent chrome, social buttons, audio and library strings, live chat, alerts; M-D1, M-D2 and M-D4 fixes | **M** | Render tests blocked without `react-test-renderer` (§9, D-6) |
| **B-T1** Email refactor + fr-CA | Per-locale template dictionaries (`email/copy/{es,en,fr-CA}.ts`) with typed parity; `resolveEmailLocale(uiLanguage)`; HTML `lang` attribute; all 8 templates in fr-CA | **M–L** | **Golden-master:** capture the current ES/EN HTML for every template before the refactor; byte-identical after (§4) |
| **B-T2** Language propagation for emails | Registration passes the UI locale (register DTO `uiLanguage`, gated); gift recipient, plan invitee and waitlist language rules | **M** | **Changes the language EN users receive** for 4 flows, so it needs a **PO decision** (D-3, D-4) |
| **B-T3** Push fr-CA + empty-body defect | fr-CA copy for 5 types; real copy for the 3 types that send empty bodies | **S** | Fixing the empty bodies changes ES/EN behaviour (**PO acknowledgement**, D-5) |
| **B-Q1** Accessibility and rendering tests | See §8 | **M** | Existing tooling only |
| **B-Q2** Dictionary QA updates | Apply reviewer and PO terminology decisions to the A dictionaries | **S** | After human review |

## 4. EN/ES backward-compatibility protections

1. **Golden-master before refactor:** for every extracted page and every email template, record the current ES and EN rendered text or HTML in a test fixture **before** changing code. The refactor must reproduce it exactly. Intentional changes are listed one by one in the PR and approved.
2. **Parity tests** (es ↔ en ↔ fr-CA structure and interpolation) extend to every new namespace, using the Checkpoint A pattern.
3. **Untranslated-string guard:** the allowlist test from Checkpoint A extends to the new namespaces.
4. **Gate tests:** with the gate off, no route, picker, API path or email produces French. With it on, French works. Tested on web, mobile and API.
5. **Pre-existing defect fixes are behaviour changes** for ES/EN users (Spanish billing page for EN users, empty push bodies, Spanish registration email for EN users, Spanish mobile tabs). Each needs explicit listing and PO acknowledgement; none is silent.
6. **Stored preferences:** no migration; `es`/`en` values untouched. A stored `fr-CA` stays impossible while the API gate is off.
7. **The 2.22% Causas commitment** stays tested in all three languages. Noetia+/NoetiaX stay "Coming Soon". USD formatting is tested.

## 5. Security and privacy implications

- **No new personal data.** The interface language is existing account data (`users.uiLanguage`). No IP geolocation. `Accept-Language` is used only for anonymous public pages (`/s/[id]`), as today.
- **Email HTML injection:** French copy introduces `’`, `«»` and non-breaking spaces. User-supplied values (names, gift messages) must keep passing through the existing `escape()`. Templates must declare `<meta charset="utf-8">` and `lang`. Golden-master tests cover the escaping paths.
- **Security-critical messages** (password reset, email confirmation, account deletion) must never fall back silently to another language for a fr-CA user. A test asserts the French template is used.
- **Server error mapping** (B-W2) also prevents displaying raw internal messages.
- **No translation service** receives user content. Drafts are produced from the source dictionaries only (NEM-025 §10).

## 6. Transactional-message readiness: conditions before the API may accept an active `fr-CA` preference (`FR_CA_ENABLED=true`)

**All** of the following must be true, verified by tests and PA:
1. **All 8 email templates** have reviewed fr-CA copy. `resolveEmailLocale('fr-CA')` returns French for every flow that has a known recipient locale. No security email falls back silently.
2. **All 5 push types** have fr-CA copy, and none sends an empty body.
3. **Registration** can carry the interface locale, so a user who registers from a French interface gets a French confirmation email. Otherwise the first email a French user receives is Spanish.
4. **PO decisions D-3 and D-4** are made (language for non-user recipients).
5. **The web and mobile French interfaces are complete** for every flow that triggers those messages (sign-up, reset, deletion, gifts, invites, clubs), so a user can't receive French mail about a screen they can't read, or the reverse.
6. **Human fr-CA review sign-off** for emails and push (§7).
7. **Legal:** French legal and consent documents are available, or the PO and legal explicitly accept the exposure scope (for example, a private invite-only pilot) before Québec users consent.
8. **Any payment notices built under PR #60 R2** ship with fr-CA copy, or are confirmed not to be live.

The **web and mobile gates** need the same conditions, plus complete UI coverage (B-W1, B-W2, B-M1), the SEO decision (B-W4), and a PO and PA exposure decision (NEM-025 §16.1: invite-only by default).

## 7. French-quality review requirements

See `fr-ca-terminology-guide.md` §5.
- A qualified Québec French reviewer (OTTIAQ-certified preferred).
- A separate legal translator for legal documents.
- Defined deliverables and acceptance criteria.
- Word-count scope for quotes.
- **No procurement or expense in this mission.** The PO decides between an internal reviewer and a capped external review (NEM-025 §16.2).

## 8. Existing coverage and missing tests

**Existing** (Checkpoint A, PR #78):
- web: dictionary parity, interpolation, untranslated guard, locale contract, provider, picker;
- mobile: parity, locale contract, stored preference;
- API: DTO and controller gate.

**Missing, proposed with existing tooling (no new dependency):**

| Test | Tooling | Purpose |
|---|---|---|
| Golden-master ES/EN text for each extracted page | jest + `react-dom/client` (already used, for example `StatsTab.spec.tsx`) | Backward compatibility |
| Golden-master ES/EN HTML for each email template | jest (API) | Backward compatibility; escaping |
| fr-CA email/push selection per flow, gate on and off | jest (API) | Readiness (§6) |
| Push: no empty body for any type × language | jest (API) | Defect regression |
| Accessibility: every `aria-label`, `title` and `alt` in the changed components comes from `t` and is non-empty in all three languages | jest DOM queries | B-5 |
| Long-string overflow guard: flag fr-CA strings exceeding the EN length by >40% on width-constrained keys (buttons, tabs, badges) for reviewer attention | jest (pure) | B-5; French typically runs 15–30% longer |
| Unicode: NFC normalization of all dictionary strings; no stray straight quotes inside French guillemets; non-breaking spaces before `%` and `:` | jest (pure) | B-5 |
| `html lang` / `document.documentElement.lang` follows the locale | jest (jsdom) | B-5 (existing Checkpoint A test extends) |
| Mobile screen rendering (tabs, consent, language screens) | **Needs `react-test-renderer`** (PR #69) | **Blocked** without D-6 |

**Visual layout** (wrapping, truncation at phone widths) cannot be fully verified by unit tests. It needs a manual or Playwright screenshot pass, and Playwright E2E currently fails in CI (pre-existing, CI-1 PR #64). That is a dependency, not a Checkpoint B test-infrastructure change.

**CI separation:**
- New Checkpoint B tests must pass. Coverage must not drop below the PR #78 values (api 69.14 branches, web 79.71 functions, mobile 22.48 functions).
- The pre-existing threshold failures (api branches, web functions, mobile all metrics) and the E2E environment failure stay reported as pre-existing. No threshold change.

## 9. Dependency and merge-order risks

| Risk | Effect | Mitigation |
|---|---|---|
| **PR #60 vs #78/Checkpoint B** | #60 adds ~150 web strings (payment status, **including PO-approved wording verbatim**). After both land, fr-CA parity tests fail until translated. French versions of PO-approved financial wording need **PO approval** | Decide merge order (D-7). If #60 lands first, Checkpoint B includes the fr-CA translation of its keys, with the financial wording submitted for PO approval |
| **PR #67 vs #78** | Both append to `web/tests/unit/lib/i18n.spec.ts`, so a textual merge conflict | Trivial rebase; whichever lands second resolves it |
| **PRs #70/#72 vs #78** | **Both add `mobile/tests/unit/i18n/index.spec.ts`**, so an add/add conflict. #70's version renders the provider and asserts the es/en-only behaviour | Merge the two specs on rebase; adapt #70's assertions to the gated contract |
| **PR #69 (`react-test-renderer`)** | Mobile render tests impossible without it | D-6: land #69 first, or authorize the dev dependency in Checkpoint B |
| **PR #75 email renames** (`hola@` → `support@`) | Email templates and footers would change twice | Sequence B-T1 after the address change, or make the footer address a single constant |
| **Checkpoint A not merged** | B must be stacked on #78 or wait | Stack the Checkpoint B branch on #78 (CI won't run on stacked PRs: memory/precedent) or target `main` after #78 merges |

## 10. Estimated engineering complexity and resource costs

| Package | Relative effort |
|---|---|
| B-W1 | L (largest: about 40% of total) |
| B-W2 | M |
| B-W3 | S |
| B-W4 | S (design only) |
| B-M1 | M |
| B-T1 | M–L |
| B-T2 | M |
| B-T3 | S |
| B-Q1 | M |
| B-Q2 | S |

**Overall: one large checkpoint.** Recommend splitting it into two execution authorizations:
- **B1:** web, mobile, formatting, tests;
- **B2:** transactional messages and the gate-readiness criteria.

**Resource costs:** no infrastructure, schema, dependency or service cost is proposed. The only possible costs are:
- the **human fr-CA review** (D-1);
- **legal translation** of the legal documents (D-8);
- the possible `react-test-renderer` dev dependency (D-6; free).

None is incurred by this preparation.

## 11. Explicit STOP conditions (Checkpoint B execution)

STOP and report if any of the following happens:
- a change would alter ES/EN output beyond the explicitly listed and approved behaviour changes;
- a golden-master test can't be made to pass;
- locale **route migration** or SEO architecture change is needed (PA design review first);
- a **schema** change, new dependency, paid service or infrastructure change is needed (including `react-test-renderer`, unless D-6 authorizes it);
- French legal or consent text is needed for an exposed flow;
- PO-approved financial wording (PR #60) needs a French version;
- the 2.22% Causas figure, USD-only commerce, Noetia+/NoetiaX status, payments, Stripe or CAD would be touched;
- any gate would need enabling;
- reader or Escucha Activa behaviour would change;
- an email security flow can't guarantee its language;
- a merge conflict with #60, #67, #69, #70 or #72 can't be resolved without changing their behaviour.

## 12. Decisions requiring Product Owner approval

| # | Decision |
|---|---|
| **D-1** | Human fr-CA reviewer: internal or capped external review (NEM-025 §16.2). Scope and word counts are in the guide §5 |
| **D-T1–T6** | Terminology:<br>• register ("vous" recommended);<br>• "jeton" vs "Token";<br>• "Écoute active" vs keeping "Escucha Activa";<br>• inclusive-writing convention;<br>• "clavardage"/"témoins";<br>• translated plan names (Individuel/Famille) vs DB names |
| **D-2** | Scope: include the **author portal** (Spanish-only today; product priority #2)? The internal admin tool is recommended out of scope |
| **D-3** | Language of emails to **non-users** (gift recipient, plan invitee): the buyer's or inviter's locale, Spanish default, or bilingual |
| **D-4** | Fixing the **4 email flows that ignore the user's language** (registration, gift ×2, plan invite, waitlist) changes what EN users receive. Approve as part of Checkpoint B? |
| **D-5** | Fix the **3 push types that send empty bodies** (pre-existing defect, all languages) in Checkpoint B? |
| **D-6** | Mobile render tests: wait for PR #69, or authorize the `react-test-renderer@18.2.0` dev dependency in Checkpoint B? |
| **D-7** | Merge order of PR #60 vs #78/Checkpoint B, and approval route for French versions of PO-approved payment wording |
| **D-8** | Legal: French Terms/Privacy/Cookies and consent before any Québec exposure, or a defined private-pilot exception |
| **D-9** | SEO approach for fr-CA (B-W4 options) after the PA design review |
| **D-10** | Split Checkpoint B into B1 (UI) and B2 (transactional + gate readiness)? (recommended) |

**STOP FOR PA REVIEW.** Checkpoint B implementation has not started and needs a separate, bounded PO execution authorization.
