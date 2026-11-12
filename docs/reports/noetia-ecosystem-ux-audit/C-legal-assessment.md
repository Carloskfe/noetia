# Appendix C — Legal Documents, Disclosures and Legal UX (Spanish and English)

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md).

> **This is not legal advice and makes no claim of legal compliance.** No legal text was modified. Every "suggested direction" below is a recommendation **for qualified legal counsel and the Product Owner**; none is proposed final wording.

**Sources** (`main@6a5e5c0`): `services/web/lib/legal/terms-of-service.ts` (ES lines 3–98, EN 100–195), `privacy-policy.ts` (ES 3–100, EN 102–199), `cookie-policy.ts` (ES 3–43, EN 45–85) and `services/web/app/(legal)/legal/LegalPage.tsx`.

**Reference audit:** NOF-004 legal benchmark (`docs/nof-004-legal-benchmark-audit@8b0e4f9`, Draft PR #23), findings F-1 to F-15. These are cited, not re-derived.

**Pending correction:** Draft PR #22 (`fix/nof-004-terms-annual-prices@d254eea`).

**Language parity.** The English text mirrors the Spanish on every fact checked here: prices, member counts, age, cancellation, governing law, controller, retention, processors and cookie entries. Every finding therefore applies to both languages; line references are given as ES / EN.

## 1. Coverage matrix

| Document | ES | EN | Current version | Products covered | Gaps (IDs from Appendix A) | Legal review | UX issues |
|---|---|---|---|---|---|---|---|
| Terms of Service | ✔ | ✔ | "4 de junio de 2026 / June 4, 2026", taken from the cookie module (LG-01); labeled "Versión MVP — sujeta a revisión legal" | Noetia only | LG-05 … LG-12 | **Required** | LG-02 … LG-04 |
| Privacy Policy | ✔ | ✔ | same shared date | Noetia only | LG-13 … LG-17 | **Required** | same |
| Cookie Policy | ✔ | ✔ | owns `LAST_UPDATED` | Noetia web | LG-18 … LG-20 | Required | same |
| Subscription and cancellation disclosures | partial (pricing copy) | partial | n/a | Noetia | LG-21, LG-22; NOF-004 F-5, F-7, F-8 | Required | not adjacent to the CTA |
| Account deletion and retention notices | ✔ (modal copy) | ✔ | n/a | Noetia | NC-12; NOF-004 F-1 | Required | warning-only |
| Copyright, ownership and sharing | in Terms §4, §5, §8 | ✔ | — | Noetia | LG-07 | Required | — |
| AI and premium disclosures | **✘** | **✘** | — | Noetia+, NoetiaX | LG-12, LG-16, LG-23 | **Required before premium launch** | — |
| Mobile consent | inline bilingual | — | links to the web pages | Noetia mobile | LG-24 | Recommended | — |
| Registration, checkout, settings links | **✘** at registration and checkout; footer only | **✘** | — | Noetia | NC-03, LG-21 | Required | — |

## 2. Terms of Service — findings (ES and EN)

| Topic | Current text (location ES / EN) | Observation | Suggested direction for counsel |
|---|---|---|---|
| Prices | monthly $8.99 / $13.99 / $18.99; annual $80.99 / $125.99 / $170.99 (`:23-27` / `:120-124`) | Monthly matches the product. Annual is outdated; Draft PR #22 proposes $83.99 / $129.99 / $179.99 (pending review) | Confirm the canonical annual prices from Stripe before publication |
| Family size | "hasta 4 miembros / up to 4 members" (`:27` / `:124`) | Product allows 5 (`maxProfiles` 5; UI "Hasta 5 usuarios", `i18n/es.ts:362`); NOF-004 F-12 | PO decides 4 or 5; align product, UI and Terms |
| Tokens | 90 days from issue (`:31` / `:128`) | Matches current paid-token behaviour (TT-01 open, PO-025). Promotional and courtesy tokens expire in 30 days, undisclosed (F-10) | Disclose every token class and expiry |
| Trial | "cuando esté disponible" (`:37` / `:134`) | Every checkout gets a 14-day trial with no once-per-customer limit (F-5); pricing advertises the trial (`i18n/es.ts:337`) | Align the trial description with the actual offer |
| Cancellation | "desde tu configuración de cuenta"; end of period; no partial refunds (`:38` / `:135`) | Cancellation is only via the Stripe portal (F-7); no statement on statutory withdrawal rights | Describe the real path; counsel on EU/ES withdrawal and US auto-renewal requirements |
| Renewal notice | none | Not implemented (NOF-004 row 10) | Counsel |
| Ownership | not stated; §8 "han licenciado su contenido a Noetia" (`:81` / `:178`) | Permanent ownership is APPROVED policy (PO-025, PO-026) but absent from the Terms; behaviour anomalies F-2 and F-3 | Clause on what "permanent" means: withdrawal of a title, suspension, account deletion |
| Public domain | "bajo licencias abiertas compatibles" (`:81` / `:178`) | Public domain is not an "open licence" | Accurate description |
| Provider identity | "Carloskfe / Noetia" (`:79` / `:176`) | A handle rather than a legal entity | Legal entity, address, contact |
| Governing law | Spanish law and courts (`:93` / `:190`) | Operator located in New York (NOF-004 row 2) | Counsel |
| Age | 18+ (`:17` / `:114`) | No age check or attestation at sign-up (F-13; NC-03) | Attestation mechanism per counsel |
| Causas | 2.22% of each payment (`:44` / `:141`) | Donation mechanism not verified in this assessment (CT-13) | PO verifies the mechanism before the claim stays |
| AI and premium | absent | Required before Noetia+/NoetiaX launch (see §5) | New premium terms |

## 3. Privacy Policy — findings (ES and EN)

| Topic | Current text (ES / EN) | Observation | Suggested direction |
|---|---|---|---|
| Controller | "Noetia es operada por Carloskfe" (`:11` / `:110`) | No legal entity or address | Counsel |
| Data categories | identity, OAuth, payment, reading activity, fragments, events, theme tags, persona, clubs, technical, preferences (`:19-29` / `:118-128`) | No research questions, AI conversations or Research Briefs (premium) | Add when premium launches (§5) |
| Processors | Stripe, Google OAuth, Facebook Login, Apple Sign In, Sentry, MinIO (self-hosted) (`:58-66` / `:157-165`) | Missing: Resend (email delivery, listed in the CLAUDE.md vendor table), the hosting provider, and Google Fonts (NC-08). Apple Sign In appears to be listed ahead of its configuration (INFERRED; verify) | Complete processor list |
| Retention | behavioural events 2 years rolling; logs 90 days (`:53-54` / `:152-154`) | Rolling purge not found in code (F-14) | Align the claim with the implementation |
| Rights | access, rectification, erasure, **portability**, objection, restriction (`:71-79` / `:170-178`) | No self-service export found (F-14) | Describe the actual request process |
| Transfers | none | Third-country processors (Stripe, Google, Sentry, Resend) | Counsel |
| Training | none | PO-002: licensed content must not train general-purpose models | Disclose when premium launches |

## 4. Cookie Policy — findings (ES and EN)

| Entry | Policy says | Implementation (`main@6a5e5c0`) | Observation |
|---|---|---|---|
| `access_token` | essential cookie, "Sesión/Session" (`:20` / `:62`) | `localStorage.setItem('access_token', …)` (persistent until cleared or logout) | Wrong storage type and duration |
| `user_type` | essential cookie, session | `localStorage` | Same |
| `noetia_consent` | cookie, 1 year | `localStorage` key `noetia_consent` (`lib/consent-utils.ts:2`) | Storage type differs |
| Undisclosed | — | `noetia_lang` (`lib/i18n/index.tsx:9`), `reader-dark-mode`, `reader-font-size`, `reader-layout`, `reader-speed`, `email_confirmed`, `user_id`, `noetia_token` | Preference and functional storage not listed |
| Analytics | optional, "30 days" (`:24-29` / `:66-71`) | No analytics script found (no gtag, plausible, posthog, segment or fbq) | Consent asked for processing that doesn't occur |
| Marketing | none in the MVP (`:31-32` / `:73-74`) | none found | Accurate |
| Third-party | — | Stripe Checkout (Stripe domain); Google Fonts request from the share editor | Counsel on disclosure |

## 5. Premium (Noetia+ / NoetiaX) coverage

**Status:** approved policy exists, but there is no customer-facing disclosure.

| Required topic | Approved policy source | Implemented? | Disclosure today | Recommendation for counsel and PO |
|---|---|---|---|---|
| AI-assisted research; generated answers may be inaccurate | PO-003 / ADR-003 | Draft only (PR #56, simulated providers) | none | Accuracy-limitation notice in the Terms and in the UI near answers |
| Source attribution; never attribute general knowledge to a book | PO-003 | partial (origin labels on `860f531`) | none | Explain provenance labels in the Terms and in an in-product help page |
| Eligible content and copyright permissions; anti-reconstruction | PO-002; PO-029 (**DRAFT**) | rights records and permission checks (E3, Draft) | none | Permitted-use clause; quotation limits remain a future Product/Legal decision (PO-002) |
| Research-session privacy; highlights private | PO-028 | Draft | none | Privacy section for conversations and Briefs |
| AI provider processing and disclosure | PO-001; TT-22 open | simulated only | none | Processor disclosure once providers are selected (launch gate, PO-031) |
| No training on licensed content | PO-002 | n/a | none | Disclosure |
| Retention, deletion and export of conversations and Briefs | not decided | Draft | none | PO decision, then disclosure |
| Subscription prerequisite | PO-026 / ADR-005 | NEM-019 (Draft PR #46) | none | Terms clause: premium requires an active Individual, Duo or Family subscription |
| Book ownership vs book tokens vs AI usage | PO-001, PO-025, PO-026 | separate ledgers (Draft) | none | Explicit separation clause |
| 3-book / 10-book limits; lock after the first analysis | PO-027 / ADR-006 | server-side on `860f531` | UI copy only (Draft) | Describe in the Terms or plan description |
| Usage limits and entitlement conditions | PO-001 bands; TT-13, D10 open | NEM-021/022 (Draft) | "capacidad mensual" (Draft) | After the PO decides units |
| Trust-page AI statements | — | — | "we do not use AI to generate book content" (`app/(corporate)/trust/content.tsx`) | Reconcile before AI answers launch (LG-23) |

## 6. Legal UX and acknowledgment proposal

### Current presentation (VERIFIED, `LegalPage.tsx`)

- **Rendering:**
  - documents render inside `<pre className="whitespace-pre-wrap">` (`:25,29`), so `#` headings, `|---|` tables and `**` bold appear literally;
  - assistive technologies receive one undifferentiated block;
  - `prose` classes have no effect because `@tailwindcss/typography` is not a dependency.
- **Layout:** two columns at `lg`; flag emoji 🇪🇸/🇺🇸 as language labels (`:24,28`); combined "Título ES / Title EN" H1 (`:14`).
- **Contrast:** status banner amber-600 on white (3.19:1, `:17`); date in `text-gray-400` (2.54:1, `:16`).
- **Dates:** one date for all documents (LG-01).
- **Missing:** table of contents, anchors, version identifier, change history and print styles.

### Proposed experience (PROPOSED; Design, PO and Eng-auth approval)

1. **Language-aware single document.**
   - Default to the user's language, with a visible switch ("Read in English" / "Leer en español") and `hreflang` alternates.
   - Language names, not flags.
2. **Structured source.**
   - Each document stored per language and per version as structured data or MDX: `{documentId, version, effectiveDate, sections[]}`.
   - Rendered as semantic `<h2>`/`<h3>`, lists and real tables, with responsive table-to-card on narrow screens.
3. **Navigation and status.**
   - **Header:** title, version label, effective date, short change summary and a link to previous versions.
   - **Table of contents:** sticky on desktop, collapsible on mobile; every section has an anchor.
4. **Per-document dates and versions.** This removes the shared-date root cause, which Draft PR #22 works around with a placeholder.
5. **Acknowledgment flows.**
   - **Registration:** a required checkbox — "Acepto los Términos de Servicio y he leído la Política de Privacidad" / "I agree to the Terms of Service and have read the Privacy Policy", plus an age attestation per counsel. Links open in the active language.
   - **Checkout:** an auto-renewal, trial and cancellation disclosure adjacent to the CTA, with a Terms link.
   - **Material changes:** an in-app re-acceptance banner.
   - **Premium activation:** a separate acknowledgment of the AI limitations and premium terms.
6. **Evidence of acceptance (needs a separately authorized schema):** `{userId, documentId, version, language, acceptedAt, surface}`.
7. **Behaviour mapping.** Each legal statement maps to an implemented behaviour or a NOF-004 item. Publication is blocked while a mapped behaviour is unresolved.
8. **Accessibility.** Body 16–18 px; line length ≤ 75 characters; AA contrast; skip link to the table of contents; print stylesheet; a `lang` attribute per document.

## 7. Items requiring qualified legal counsel

1. **Provider identity:** legal entity, address and contact (Terms §8, Privacy §1).
2. **Governing law and jurisdiction** vs the operator's location.
3. **Commercial terms:**
   - annual prices (Draft PR #22);
   - family size (4 vs 5);
   - all token classes and expiries;
   - trial terms.
4. **Consumer rights and disclosures:**
   - statutory withdrawal and refund rights (EU, ES) for subscriptions and digital content;
   - auto-renewal and renewal-notice obligations (US states, NOF-004).
5. **Ownership:** the meaning and limits of permanent ownership; the public-domain description.
6. **Privacy:**
   - complete processor list (Resend, hosting, Google Fonts or self-hosting, OAuth providers actually in use);
   - international transfers;
   - retention and portability claims vs implementation.
7. **Cookies:** storage-type accuracy (`localStorage`); undisclosed storage; the analytics description.
8. **Premium terms and privacy** (§5), before any Noetia+/NoetiaX launch.
9. **Acceptance and age:** record-keeping requirements; the age-attestation approach.
10. **Trust page** AI statements once AI features exist.
