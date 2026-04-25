## Context

Alexandria currently has no legal layer. The platform collects user email, processes Stripe payments, stores user-generated fragments in PostgreSQL, and serves DRM-protected book content — all without a cookie consent mechanism, privacy policy, or terms of service. The App Store and Google Play both require a privacy policy URL before an app can be published. GDPR-adjacent laws in Spain, Mexico, and Argentina require affirmative consent before non-essential cookies or tracking are set.

The legal documents are bilingual (ES/EN) because the primary market is Spanish-speaking, but international users and App Store reviewers expect English.

## Goals / Non-Goals

**Goals:**
- Bilingual (ES/EN) legal text for Cookie Policy, Privacy Policy, Terms of Service.
- Web cookie consent banner with granular preference storage (`localStorage`), script gating, and version-change re-prompt.
- Static legal pages at `/legal/*` routes in Next.js.
- Mobile first-launch consent screen that cannot be skipped, with graceful exit on decline.
- Static store listing text artifacts ready for Google Play Data Safety and Apple App Privacy submission.
- Unit tests for consent state logic (web) and consent version check (mobile).

**Non-Goals:**
- A cookie management SDK (OneTrust, Cookiebot) — `localStorage` is sufficient for MVP.
- Server-side consent logging or consent audit trails.
- GDPR data subject request API (right to erasure, portability) — future sprint.
- Translated App Store listings beyond English.
- Legal review by an attorney — copy is drafted in good faith for MVP and should be reviewed before production.

## Decisions

**D1 — localStorage for web consent, AsyncStorage for mobile consent**
No third-party consent SDK is introduced. The consent preference (`{ version, analytics, marketing, timestamp }`) is stored as a JSON string under the key `alexandria_consent`. Version mismatch triggers re-prompt. This is sufficient for MVP; a dedicated CMP can replace it without API changes.

**D2 — Policy version as a constant in `lib/consent-utils.ts` and `src/offline/consent-storage.ts`**
Bumping `CONSENT_VERSION` (e.g., `"1.0"` → `"1.1"`) automatically triggers re-consent on next load/launch without a database migration or backend call. This keeps the consent mechanism entirely client-side.

**D3 — Cookie banner mounts in `app/layout.tsx` as a Client Component boundary**
The banner reads `localStorage` on mount and conditionally renders. Next.js SSR means the banner is invisible on the first render pass and appears client-side only — acceptable for MVP (avoids hydration complexity with a Suspense boundary).

**D4 — Legal pages as static Next.js pages (not CMS-driven)**
Legal content lives in `/app/(legal)/legal/[doc]/page.tsx` with the bilingual text hardcoded as constants. This avoids a CMS dependency and keeps the content version-controlled. A future CMS migration is straightforward.

**D5 — Mobile consent screen as a navigation guard, not a modal**
`ConsentScreen` is placed as the first screen in the navigation stack before the auth flow. If consent is already stored (and version matches), the navigator skips it immediately. This is cleaner than an overlay modal and easier to test.

**D6 — Store listing copy as static Markdown files under `docs/store-listings/`**
These are non-code artifacts for copy-paste at submission time. No CI or code integration is needed.

## Risks / Trade-offs

- **Legal copy is not attorney-reviewed** → Mark all documents with a visible "Versión MVP — sujeta a revisión legal" / "MVP Version — subject to legal review" note at the top.
- **localStorage is cleared if user clears browser data** → Consent banner re-appears; this is acceptable behavior and the correct outcome.
- **Mobile AsyncStorage is cleared on app uninstall** → Consent screen re-appears on reinstall; correct behavior.
- **No server-side consent record** → If a regulatory audit requires proof of consent, this implementation cannot provide it. Mitigation: document the limitation and plan a consent-log API for a future sprint.
