# NEM-025 (trilingual platform): alignment requirements

**Status:** governance alignment annex. **Not** a mission specification, and **not** an execution authorization.

> **Baseline finding:** the approved NEM-025 specification file from the PO's finalized approval packet is **not in the repository**. It is absent from `main` at `8f2f294`, from every remote branch, and from GitHub issues and PRs (searched 2026-11-22). `docs/engineering-missions/APPROVED/` contains only `.gitkeep`. Its content therefore **could not be compared**.
>
> This annex lists what the approved specification **must contain** after the PO decisions of 2026-11-22. When the approved NEM-025 text is committed, PA reconciles it against this checklist. Any gap is a specification change for PA/PO, never a silent edit by the implementation agent.

## A. PO decisions to incorporate (FINAL, 2026-11-22)

| # | Requirement | Source |
|---|---|---|
| A1 | Interface languages: **`en`, `es`, `fr-CA`**. | PO: trilingual platform |
| A2 | French interface label: **"Français (Canada)"**. | PO |
| A3 | **A book's original language is independent of the interface language.** Interface switching never changes book text or audio; book-language filtering is a separate control. | PO |
| A4 | **The French pilot stays private and unpublished** until a separate, independent checkpoint approves a public French release. | PO |
| A5 | **USD is the only financial currency** (USD-LOCAL-REFERENCE §1–§2). | PO: financial currency, FINAL |
| A6 | **Optional informational CAD (and other local-currency) equivalents**, displayed only per USD-LOCAL-REFERENCE §3–§6. | PO |
| A7 | Reference-rate sourcing, date disclosure, freshness and unavailable-rate behaviour; Bank of Canada evaluated for CAD (USD-LOCAL-REFERENCE §4–§5). | PO |
| A8 | **French transactional message coverage** (see C). | PO mission §3.B |
| A9 | **Tests preventing accidental use of converted amounts in checkout** (see D). | PO mission §3.B |
| A10 | **Backward compatibility** for existing `es`/`en` users and clients (see B). | PO mission §3.B |

## B. Backward compatibility requirements (repository facts, `main` 8f2f294)

1. **Stored preference:** `users.uiLanguage` is `VARCHAR(5) NOT NULL DEFAULT 'es'` (migration 044). `fr-CA` is 5 characters, so **no schema change is needed** to store it. Existing `es`/`en` values stay valid and unchanged; there is no data migration.
2. **Input validation:** `UpdateUserDto.uiLanguage` is only `@IsString() @MaxLength(5)`, so any five-character string is accepted today. NEM-025 should restrict it to `es | en | fr-CA` while accepting every existing stored value.
3. **Silent fallback hazard:** the API narrows the language with `as 'es' | 'en'` and the boolean `isEn` (`email.service.ts`, `push.service.ts`, `auth.service.ts`, `users.service.ts`). A `fr-CA` user would silently receive **Spanish**. NEM-025 must replace the binary `isEn` pattern with a three-way language resolution that has an explicit default.
4. **Clients:** web `lib/i18n` and mobile `src/i18n` define `type Language = 'es' | 'en'`. Adding `fr-CA` needs `fr-CA.ts` on both platforms and structural-parity tests (web already enforces en/es parity in `tests/unit/lib/i18n.spec.ts`; the rule extends to three files). The CLAUDE.md four-file rule becomes **six files**, and needs a CLAUDE.md update in NEM-025.
5. **Older mobile builds** that only know `es`/`en` must keep working if the server stores `fr-CA`: they must fall back without crashing. Mobile language changes are JS-only (OTA-eligible), unless a native locale configuration changes.
6. **Public pages that pick a language from `Accept-Language`** (for example `app/s/[id]/page.tsx` `pickLang()`) must map `fr*` to `fr-CA` only once French is public (A4). Until then, they keep `es`/`en`.

## C. French transactional message coverage (inventory)

French versions are required for every user-facing system message, including:
- **Email** (`services/api/src/email/email.service.ts`, 8 methods on `main`): `sendEmailConfirmation`, `sendPasswordReset`, `sendFarewell`, `sendWaitlistConfirmation`, `sendGiftCard`, `sendGiftConfirmation`, `sendPlanInvite`, `sendWaitlistInvite`. The email footer contact line is included.
- **Payment-lifecycle notices designed in PR #60 R2** (not yet implemented): payment issue, resolved-delivered, resolved-refunded, duplicate-book refund, gift redeemed (addenda B and E).
- **Push** (`push.service.ts`): `invite_accepted`, `gift_claimed`, and any new types.
- **Stripe-hosted surfaces:** Checkout `locale` (Stripe supports `fr-CA`; to verify at implementation) and customer `preferred_locales` for Stripe receipts and invoices. **Locale only; never currency.**
- **Legal surfaces** (Terms, Privacy, Cookies): French versions are a **legal dependency** (see the report, risks), not an engineering translation task.

## D. Currency safeguards and tests (minimum set)

1. A checkout-session test for each Checkout path (subscription, book, token package, gift): `currency === 'usd'` and `unit_amount` or `price` equal the server-side configuration, **whether a rate is available, stale or extreme**.
2. A DTO test: checkout requests carrying `amount`, `currency` or `fxRate` fields have them stripped or rejected, and the session is unchanged.
3. Module-isolation test: no file under `subscriptions/`, `gifts/`, `webhooks`, token, royalty or Causas modules imports the rate module (a source-scan unit test; no new dependency).
4. Formatter tests: USD always rendered with an explicit marker in `en`/`es`/`fr-CA`; the equivalent is rendered only with a fresh rate, always with `CA`/ISO marking and the date; stale, missing, zero, negative or non-numeric rates → `null` (USD only).
5. Webhook W-2 amount/currency verification remains USD-only (PR #60 R2 tests unaffected).
6. A UI test: when the rate endpoint fails, the pricing, gift, token and paywall screens still render the USD price and allow checkout.

## E. Out of scope for NEM-025 unless the PO adds it

Payment currencies other than USD; Stripe Price objects; geolocation; French catalogue ingestion (NEM-026); a public French release (separate checkpoint); legal translations.
