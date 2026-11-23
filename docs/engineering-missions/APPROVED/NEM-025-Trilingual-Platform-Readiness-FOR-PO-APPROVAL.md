# NOETIA ENGINEERING MISSION — NEM-025
## Trilingual Platform Readiness (English / Español / Français canadien)

**Status:** FINAL SPECIFICATION FOR PO APPROVAL — NOT YET APPROVED; NOT EXECUTABLE
**Mission type:** DESIGN + BOUNDED IMPLEMENTATION (once separately approved and explicitly executed)
**Implementation authorization:** NONE CURRENTLY. After PO approval, a distinct explicitly named execution instruction is still required.
**Schema changes:** NOT AUTHORIZED; STOP if a migration is demonstrably required
**Infrastructure changes:** NOT AUTHORIZED
**Production deployment:** NOT AUTHORIZED
**Product Owner approval:** REQUIRED (approval ≠ execution)
**Product Architecture:** Independent review required before merge/deploy
**Audit baseline:** `main` at `8f2f294378a8cdc7472f2849ce533981605fcb01` (revalidate before executing)
**Specification finalized:** November 22, 2026 (FR-CA five-title selection confirmed)

> Per `CLAUDE.md` and `docs/engineering-missions/README.md`, this draft does NOT authorize implementation. Execution needs a distinct PO instruction explicitly naming NEM-025. Do not run it because the file exists.

## 1. Context
Noetia currently serves Spanish and English web/mobile interfaces and bilingual transactional emails. The PO wants tri-language readiness focused on French-Canadian users and a separately gated five-title French pilot under NEM-026. The PO has selected **Maria Chapdelaine** to replace **Les Trois Mousquetaires**, leaving exactly five fixed candidate titles. Readers must remain able to select an interface language independently from the original language of the book.

## 2. Objective
Produce a reviewed, tested EN/ES/fr-CA platform implementation on an isolated Draft PR, with no production release and no misleading partially translated French surface. The entire product workflow must remain functional in the two existing languages.

## 3. Dependencies
- Independent PA review and final PO authorization of this mission spec.
- Explicit subsequent PO execution instruction: `Execute NEM-025 ...`.
- Read current `main`, `CLAUDE.md`, mission governance, and relevant active PRs; the source paths below are from the pinned baseline, NOT a guarantee of current branch state.
- Preserve the final commerce decisions, disabled purchases, TT policy and Noetia+/NoetiaX Coming Soon surfaces.
- Coordinate with NEM-026; five pilot books are not included in this mission. The selected books are *Candide*, *Le Horla* (collection scope to be confirmed), *Le Tour du monde en quatre-vingts jours*, *Madame Bovary* and *Maria Chapdelaine*. The NEM-026 manifest, not this mission, owns source verification and title-specific QA.

## 4. Source of truth
- `docs/engineering-missions/README.md`; root `CLAUDE.md`
- `services/web/lib/i18n/{index.tsx,en.ts,es.ts}`
- `services/web/components/LanguagePicker.tsx`; `services/web/app/layout.tsx`, `sitemap.ts`
- `services/mobile/src/i18n/{index.tsx,en.ts,es.ts}`
- `services/mobile/src/screens/LanguageScreen.tsx`, `screens/account/AccountScreen.tsx`
- `services/api/src/users/{user.entity.ts,dto/update-user.dto.ts,users.service.ts}`
- `services/api/src/email/email.service.ts`
- `services/api/src/search/search.service.ts`, `books/{book.entity.ts,books.service.ts,books.controller.ts}`
- All public, onboarding, reader, research and account UI pages and error messages.
- `docs/product-governance/COMMERCE-DECISIONS.md` on PR #74 pending separate merge authorization; if not on main, do not fabricate its presence.

## 5. In scope (for future explicit limited implementation)
1. Inventory all locale-sensitive strings in web, mobile, API, auth, email, onboarding, reader, social, sharing, notifications, metadata, errors and accessibility. Produce a tracked coverage matrix, not an unverified claim.
2. Define canonical interface locale values: `es`, `en`, `fr-CA`. Accept old persisted values unchanged. Keep book language as ISO `fr` (not `fr-CA`); a French book must be readable with any UI language.
3. Extend typed translation dictionaries with a complete, quality-reviewed `fr-CA` translation and strict parity tests for nested keys, interpolations, plurals, currency labels and text overflow. Reject partial French/English mix in transactional or public-facing flows.
4. Extend web/mobile selectors and storage reconciliation, accepting `fr-CA` from authenticated API preferences. Use a single normalizer/whitelist. Avoid changing unrelated app storage keys or users' current preferences.
5. Validate `uiLanguage` server-side to the approved values. Existing `VARCHAR(5)` accommodates `fr-CA` (length 5), so no schema migration is expected. Legacy/malformed values must not break rendering.
6. Make canonical `html lang`, SEO metadata, accessible labels, and localized navigation consistently reflect the selected locale; do not rely solely on client mutation for indexable SEO. If localized route architecture is needed, design it and STOP for PA review before implementing a route migration.
7. Add French transactional email templates only with verified ES/EN regression, including security, account deletion, confirmation, gifts and notices. Never silently send English for a critical fr-CA communication.
8. Verify web/mobile reader controls, phrase rendering, book search, clubs, fragments, consent, support and payment-disabled copy in all languages. Add language filter only if needed; do not alter eligibility rules.
9. Audit research/analysis prompts, AI language output, summaries, sharing images, generated captions and theme-tag taxonomy for French; classify each as supported, gated or blocked. Do not represent Noetia+ or NoetiaX as purchasable.
10. Keep French entry hidden until complete UI coverage and PA-approved readiness. Feature flag must fail closed, default disabled, with no changes to `PAYMENTS_ENABLED`.

## 6. Out of scope
- Production deployment, staging mutation, traffic exposure, app-store release, purchase activation, legal terms changes, CAD pricing, subscription/tokens economics, promotion codes, and infrastructure.
- Ingesting/publishing books or audio (NEM-026), acquisition of copyrights/licences, new AI models or third-party paid services.
- Changes to ongoing PR #60, #62, #74 or older CI projects.

## 7. Product rules
- Interface locale and reading-language are independent.
- EN/ES experience and stored user preferences remain fully backward compatible.
- `fr-CA` is Canadian-French interface copy (not a forced translation of canonical book text).
- `fr` is French-language source content; preserve accents, ligatures and correct titles.
- USD remains the approved financial currency; Noetia+ and NoetiaX Coming Soon; purchases remain disabled until separate approval.
- Reader stability, permanent book ownership, library privacy and 2.22% Causas policy remain unchanged.

## 8. Protected systems
Escucha Activa reader/audio synchronization, reading progress, offline behavior, user fragments, books, subscriptions, financial activation, claims, backups, production data and privacy. Any scope conflict is a STOP.

## 9. Technical requirements
- Typed translation shape parity, including `fr-CA` (likely new `fr-ca.ts` in both web and mobile). Preserve existing source types.
- API `UpdateUserDto` currently accepts any `@IsString()` `uiLanguage` (MaxLength 5); restrict to approved values without rejecting existing `es`/`en`.
- Web and mobile providers currently whitelist only `es`/`en`. Update both providers + UI selectors and test saved language and authenticated precedence.
- Web `app/layout.tsx` is currently static `<html lang="es">` and `metadata.openGraph.locale='es_LA'`. SSR / localized SEO needs a coherent design; don't claim SEO localization by client DOM mutation alone.
- Web `LanguagePicker` and mobile `LanguageScreen` and `AccountScreen` explicitly enumerate `es`/`en`.
- API `EmailService` type is `Lang = 'es' | 'en'` and has conditionals, not a reusable dictionary. Use a third locale safely and verify all important templates.
- Web `WaitlistForm` includes visible Spanish literals not wrapped by i18n; extend audit beyond i18n dictionaries.
- Meilisearch `SearchService` indexes book language, but public `BooksController.findAll` has no `language` query. Any added filter must remain optional and compatible.
- Verify `fr` locale indexing behavior and French punctuation handling. Never translate original book text silently.

## 10. Security, privacy and copyright
No new personal-data collection or extra identity tracking; keep stored language preference private. Never use non-public client data for translation services without separately approved privacy analysis. New translations and marketing/legal copy require human French-Canadian and legal QA as applicable. Maintain HTML escaping and email-injection protections.

## 11. Acceptance criteria
1. English and Spanish remain byte-level / behavior-level compatible except explicitly reviewed changes.
2. Authenticated and anonymous language switching works predictably across reload and mobile restart; no cross-account leakage.
3. All French user-visible strings are French Canadian in supported screens; missing-key tests fail, no English/Spanish silent fallback in critical flows.
4. App structure, account errors, help, onboarding, reader controls, consent, footer, legal links, sharing and transactional email verified in all three languages.
5. Correct language metadata, accessible names and initial render; no hydration or route regressions.
6. Finance still unavailable; existing #59 landing, Causas, Coming Soon and purchase-gate tests unchanged and green in changed areas.
7. All changed file paths, tests and open blockers reported; Draft PR targeting `main`, STOP for PA.

## 12. Tests
- Type-level / runtime dictionary parity and interpolation checks EN/ES/FR.
- Unit tests for locale detection, allowed values, stored preference, anonymous behavior and signed-in sync.
- Web/mobile language selection, account change, navigation and onboarding flows.
- French text layout, long-string wrapping, apostrophes, diacritics, accessibility and SEO metadata.
- API DTO invalid locales rejected; existing preferences accepted.
- Email snapshots + parity for security and financial notifications.
- Payment-disabled gates, permanent book ownership, #59 Causas, Noetia+/NoetiaX Coming Soon regressions.
- CI failures that already exist on `main` must be reported accurately; do not lower thresholds or delete tests to hide failures.

## 13. Observability
Minimal per-locale anonymous usage/translation-error metrics only if they fit existing telemetry; no new vendor or PII collection. Track unexpected locale fallback as an engineering defect.

## 14. Deployment / rollout
NOT AUTHORIZED. Default `fr-CA` hidden. Draft PR only, no merge/deploy/OTA. PA review and separate PO authorization required before staging or release. No changes to payment environment variables.

## 15. Documentation deliverables
- Complete i18n string-surface inventory and EN/ES/fr-CA coverage matrix.
- Translation terminology guide (Québec terms, US$ convention, accessibility and notification tone).
- Architecture decision on SEO routing and locale behavior, where material.
- Implementation report and rollback plan.

## 16. PO confirmation items and safe implementation defaults
The PO's **five-title selection is already settled** by instruction dated November 22, 2026; this mission does not choose books.

1. **Exposure:** default to hidden/internal or invite-only pilot, **not** an immediate public French release; any public launch needs separate PO and PA authorization.
2. **Human verification:** before public exposure or sensitive French transactional notices, identify a qualified French-Canadian reviewer or separately approve a capped external review expense. AI-only translation is not sufficient to certify quality.
3. **Display label:** recommend `Français (Canada)` without treating flags as language identity. If PO wants a different label, resolve it before interface freeze.
4. **Research/AI:** audit French output and citations. Where not evidenced, keep functionality gated rather than silently claiming parity or inventing a Coming Soon policy for existing paid features.
5. **Acceptance boundary:** PO approval of this *specification* does not authorize code implementation, staging operations, public exposure, merge, release, or paid features.

These defaults let engineering prepare a bounded Draft PR after a separate execution authorization. Any material change to reader/AI product behavior is a STOP for a new PO decision.

## 17. STOP conditions
Current branch differs, reader behavior changes, paid services or migrations needed, rights unresolved, unexpected legal/commerce copy, pressure to publish untranslated surfaces, failing relevant safety tests, protected-system changes, or inability to establish complete i18n coverage.

## 18. Completion report
Mission, status, changed paths, database, tests, verification, deployment (none), deviations, open questions, protected systems confirmation, commit and Draft PR URL, recommendation. STOP for independent PA review.

## 19. PA review
Use `docs/engineering-missions/REVIEW-CHECKLIST.md`. Outcomes: approve / approve with follow-up / reject-remediate. No auto-merge, app release or next mission.

**NEM-025 SPECIFICATION FINALIZED FOR PO APPROVAL — NO EXECUTION AUTHORIZATION.**
