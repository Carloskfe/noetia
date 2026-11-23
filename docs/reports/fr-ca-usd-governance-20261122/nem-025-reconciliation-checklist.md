# NEM-025 (trilingual platform): reconciliation checklist

**Status:** reconciliation checklist for PA. **It does not replace, summarise or amend the full PO-approved NEM-025 specification.** It is not a mission specification and not an execution authorization.

> **Source of truth:** the **full PO-approved NEM-025 specification** in the PO's finalized approval packet governs. Per PA review of PR #76, that specification exists but **is not yet in GitHub**. It was not found on `main` at `8f2f294`, on any remote branch, or in issues or PRs (searched 2026-11-22).
>
> **Where the full file must be committed (engineering-mission governance):** `docs/engineering-missions/APPROVED/NEM-025-<approved-title-slug>.md`, verbatim from the approval packet. This follows the established pattern, for example `APPROVED/NEM-021-provider-neutral-ai-contract-and-cost-accounting.md` and `APPROVED/NEM-022-…` on PR #49, preferably with the PO approval record committed alongside, as was done for NEM-019/021/022. The slug is the approved title; it is not invented here. Committing the file is documentation work, and **it does not authorize execution** (APPROVED ≠ EXECUTE).
>
> **How to use this checklist:** once the full file is committed, PA checks each item below against it and records the result per item: **covered** (cite the spec section), **not covered**, or **conflicts**. A *not covered* or *conflicts* result goes to PA/PO as a specification question. **It is never resolved by editing the approved specification without PO approval, and never by substituting this checklist.**

## A. PO decisions to verify in the full specification (FINAL, 2026-11-22)

| # | Requirement | Source |
|---|---|---|
| A1 | Interface languages: **`en`, `es`, `fr-CA`**. | PO: trilingual platform |
| A2 | French interface label: **"Français (Canada)"**. | PO |
| A3 | **A book's original language is independent of the interface language.** Interface switching never changes book text or audio; book-language filtering is a separate control. | PO |
| A4 | **The French pilot stays private and unpublished** until a separate, independent checkpoint approves a public French release. | PO |
| A5 | **USD is the only financial currency** (USD-LOCAL-REFERENCE §1–§2). | PO: financial currency, FINAL |
| A6 | **P-1 (FINAL):** CAD is the only authorized informational currency for the initial French pilot; no other informational currencies; every actual price, charge, invoice, refund and record remains USD (USD-LOCAL-REFERENCE §3A). | PO, FINAL 2026-11-22 |
| A6b | **P-2 (FINAL):** USD-only default; CAD only by **explicit user preference**; the preference is **independent of interface language** (en/es/fr-CA users can each choose CAD); it never modifies Stripe Checkout or subscription currency; a missing, invalid, stale or unavailable rate → USD only; **no IP-based selection** (§3B). | PO, FINAL 2026-11-22 |
| A7 | **P-3 (PENDING):** legal clearance of Bank of Canada reference-rate reuse, and approval of customer-facing conversion disclosures. **Until granted, no CAD equivalents may be publicly displayed.** Rate sourcing, date, freshness and fallback rules: §4–§6. Whether non-public (pilot/staging) display is permitted before clearance is not assumed (policy U-5). | PO; **PENDING** |
| A8 | **French transactional message coverage** (see C). | PO mission §3.B |
| A9 | **Tests preventing accidental use of converted amounts in checkout** (see D). | PO mission §3.B |
| A10 | **Backward compatibility** for existing `es`/`en` users and clients (see B). | PO mission §3.B |

## B. Backward compatibility: repository facts to check against the spec (`main` 8f2f294)

1. **Stored preference:** `users.uiLanguage` is `VARCHAR(5) NOT NULL DEFAULT 'es'` (migration 044). `fr-CA` is 5 characters, so **no schema change is needed** to store it. Existing `es`/`en` values stay valid and unchanged; there is no data migration.
2. **Input validation:** `UpdateUserDto.uiLanguage` is only `@IsString() @MaxLength(5)`, so any five-character string is accepted today. NEM-025 should restrict it to `es | en | fr-CA` while accepting every existing stored value.
3. **Silent fallback hazard:** the API narrows the language with `as 'es' | 'en'` and the boolean `isEn` (`email.service.ts`, `push.service.ts`, `auth.service.ts`, `users.service.ts`). A `fr-CA` user would silently receive **Spanish**. NEM-025 must replace the binary `isEn` pattern with a three-way language resolution that has an explicit default.
4. **Clients:** web `lib/i18n` and mobile `src/i18n` define `type Language = 'es' | 'en'`. Adding `fr-CA` needs `fr-CA.ts` on both platforms and structural-parity tests (web already enforces en/es parity in `tests/unit/lib/i18n.spec.ts`; the rule extends to three files). The CLAUDE.md four-file rule becomes **six files**, and needs a CLAUDE.md update in NEM-025.
5. **Older mobile builds** that only know `es`/`en` must keep working if the server stores `fr-CA`: they must fall back without crashing. Mobile language changes are JS-only (OTA-eligible), unless a native locale configuration changes.
6. **Public pages that pick a language from `Accept-Language`** (for example `app/s/[id]/page.tsx` `pickLang()`) must map `fr*` to `fr-CA` only once French is public (A4). Until then, they keep `es`/`en`.

## C. French transactional message coverage: inventory to check against the spec

French versions are required for every user-facing system message, including:
- **Email** (`services/api/src/email/email.service.ts`, 8 methods on `main`): `sendEmailConfirmation`, `sendPasswordReset`, `sendFarewell`, `sendWaitlistConfirmation`, `sendGiftCard`, `sendGiftConfirmation`, `sendPlanInvite`, `sendWaitlistInvite`. The email footer contact line is included.
- **Payment-lifecycle notices designed in PR #60 R2** (not yet implemented): payment issue, resolved-delivered, resolved-refunded, duplicate-book refund, gift redeemed (addenda B and E).
- **Push** (`push.service.ts`): `invite_accepted`, `gift_claimed`, and any new types.
- **Stripe-hosted surfaces:** Checkout `locale` (Stripe supports `fr-CA`; to verify at implementation) and customer `preferred_locales` for Stripe receipts and invoices. **Locale only; never currency.**
- **Legal surfaces** (Terms, Privacy, Cookies): French versions are a **legal dependency** (see the report, risks), not an engineering translation task.

## D. Currency safeguards and tests: minimum set to check against the spec

1. A checkout-session test for each Checkout path (subscription, book, token package, gift): `currency === 'usd'` and `unit_amount` or `price` equal the server-side configuration, **whether a rate is available, stale or extreme, and whether the user's currency preference is USD or CAD**.
2. A DTO test: checkout requests carrying `amount`, `currency` or `fxRate` fields have them stripped or rejected, and the session is unchanged.
3. Module-isolation test: no file under `subscriptions/`, `gifts/`, `webhooks`, token, royalty or Causas modules imports the rate module (a source-scan unit test; no new dependency).
4. Preference tests (P-2): default is USD for every interface language; CAD appears only after an explicit preference; changing the interface language never changes the currency preference, and the reverse; the preference never reaches any Checkout or subscription call; no request header or IP-derived value sets it.
5. Formatter tests: USD always rendered with an explicit marker in `en`/`es`/`fr-CA`; the equivalent is rendered only with a fresh rate, always with `CA`/ISO marking and the date; stale, missing, zero, negative or non-numeric rates → `null` (USD only).
6. Webhook W-2 amount/currency verification remains USD-only (PR #60 R2 tests unaffected).
7. A UI test: when the rate endpoint fails, the pricing, gift, token and paywall screens still render the USD price and allow checkout.

## E. Out of scope for NEM-025 unless the PO adds it

Payment currencies other than USD; Stripe Price objects; geolocation; French catalogue ingestion (NEM-026); a public French release (separate checkpoint); legal translations.
