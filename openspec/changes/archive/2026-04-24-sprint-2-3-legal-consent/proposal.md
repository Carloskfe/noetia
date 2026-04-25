## Why

Alexandria collects personal data, processes payments, and distributes protected content — all of which require legally compliant disclosures and user consent before the app can be published on the App Store or Google Play. Without a cookie consent layer, privacy policy, and terms of service in place, the platform exposes both users and the company to regulatory risk under GDPR-adjacent laws (Spain, Mexico, Argentina) and CCPA.

## What Changes

- Author bilingual (ES/EN) legal documents: Cookie Policy, Privacy Policy, Terms of Service — covering data collection, Stripe billing, Supabase/Auth.js authentication, MinIO storage, DRM content access, fragment sharing, subscription terms, and user rights.
- **Web**: Cookie consent banner (first visit, bottom bar) with "Aceptar todo" / "Solo esenciales" / "Gestionar" options; consent saved to `localStorage`; non-essential scripts blocked until consent given; re-prompted when policy version changes. Static legal pages at `/legal/cookies`, `/legal/privacy`, `/legal/terms`. Footer updated with links.
- **Mobile**: Mandatory first-launch consent screen (cannot be skipped) with Privacy Policy + Terms summaries, "Acepto / I agree" CTA, links to full documents, graceful exit on decline, consent version tracked in `AsyncStorage`, re-shown on version bump.
- **App Store / Google Play copy**: Static text artifacts — Google Play Data Safety section answers, Apple App Privacy label summary, and store listing privacy policy URL placeholders — ready for submission.

## Capabilities

### New Capabilities

- `cookie-consent`: Web consent banner, preference storage, non-essential script gating, and `/legal/cookies` page.
- `legal-documents`: Bilingual Privacy Policy and Terms of Service content and their web pages (`/legal/privacy`, `/legal/terms`).
- `mobile-consent`: React Native first-launch consent screen, AsyncStorage version tracking, and graceful decline handling.
- `store-listing-legal`: Static text artifacts for Google Play Data Safety and Apple App Privacy submission copy.

### Modified Capabilities

## Impact

- **web**: new `app/(legal)/` route group, `components/CookieBanner.tsx`, `lib/consent-utils.ts`, footer update, `app/layout.tsx` (mount banner).
- **mobile**: new `src/screens/ConsentScreen.tsx`, `src/offline/consent-storage.ts`, app entry navigation guard.
- **No API changes** — legal documents are static assets served from Next.js; no new backend endpoints required.
- **Dependencies**: no new packages required (web uses `localStorage` natively; mobile uses existing `@react-native-async-storage/async-storage` which is already included in RN projects).
- **App Store / Google Play**: static text files under `docs/store-listings/` for copy-paste at submission time.
