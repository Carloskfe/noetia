## 1. Legal Content — Bilingual Text Constants

- [x] 1.1 Create `services/web/lib/legal/cookie-policy.ts` — export `COOKIE_POLICY_ES` and `COOKIE_POLICY_EN` as multiline string constants covering: what cookies are used (essential: session auth; analytics: reading behaviour; marketing: future), retention periods, how to withdraw consent, and a link to `/legal/privacy`
- [x] 1.2 Create `services/web/lib/legal/privacy-policy.ts` — export `PRIVACY_POLICY_ES` and `PRIVACY_POLICY_EN` covering: data controller (Noetia / Carloskfe), categories of data collected (email, name, payment info via Stripe, reading progress, fragments), legal basis, retention (account data: until deletion; payment: 7 years per tax law), third-party processors (Stripe, MinIO, Google/Facebook/Apple OAuth), user rights (access, rectification, erasure, portability — contact legal@noetia.app), governing law (Spain / RGPD), CCPA addendum for California users
- [x] 1.3 Create `services/web/lib/legal/terms-of-service.ts` — export `TERMS_ES` and `TERMS_EN` covering: service description, minimum age (18), subscription plans (Individual $9.99/mo or $89/yr; Dual Reader $14.99/mo or $135/yr), free trial conditions, cancellation/refund policy, DRM and content restrictions (no download, no redistribution), fragment sharing (user retains ownership of own text; Noetia gets a licence to render quote cards), intellectual property, disclaimer of warranties, limitation of liability, governing law (Spain), contact

## 2. Web — Consent Utility

- [x] 2.1 Create `services/web/lib/consent-utils.ts` — export: `CONSENT_VERSION = "1.0"`, type `ConsentRecord { version, analytics, marketing, timestamp }`, `saveConsent(record: ConsentRecord): void` (writes to localStorage), `loadConsent(): ConsentRecord | null`, `needsConsent(): boolean` (true if no record or version mismatch), `hasAnalyticsConsent(): boolean`, `hasMarketingConsent(): boolean`

## 3. Web — Cookie Consent Banner Component

- [x] 3.1 Create `services/web/components/CookieBanner.tsx` — client component; on mount calls `needsConsent()`; if true renders fixed bottom bar (z-50, white bg, shadow-lg) with: short bilingual text ("Usamos cookies / We use cookies"), three buttons — "Aceptar todo / Accept all" (calls `saveConsent` with analytics+marketing true), "Solo esenciales / Essentials only" (analytics+marketing false), "Gestionar / Manage" (opens `CookiePreferencesModal`); hides itself after save
- [x] 3.2 Create `services/web/components/CookiePreferencesModal.tsx` — modal with two toggles (Analytics cookies, Marketing cookies), each bilingual, with Save button that calls `saveConsent` with chosen values and closes modal
- [x] 3.3 Mount `<CookieBanner />` in `services/web/app/layout.tsx` inside the `<body>` tag after the main content

## 4. Web — Legal Pages

- [x] 4.1 Create route group `services/web/app/(legal)/legal/cookies/page.tsx` — renders `COOKIE_POLICY_ES` and `COOKIE_POLICY_EN` in side-by-side columns (ES left, EN right on desktop; stacked on mobile); includes page title "Política de Cookies / Cookie Policy" and last-updated date
- [x] 4.2 Create `services/web/app/(legal)/legal/privacy/page.tsx` — same bilingual layout for `PRIVACY_POLICY_ES` / `PRIVACY_POLICY_EN`; title "Política de Privacidad / Privacy Policy"
- [x] 4.3 Create `services/web/app/(legal)/legal/terms/page.tsx` — same bilingual layout for `TERMS_ES` / `TERMS_EN`; title "Términos de Servicio / Terms of Service"
- [x] 4.4 Update global footer component (or create `services/web/components/Footer.tsx` if absent) — add links to `/legal/cookies`, `/legal/privacy`, `/legal/terms` with bilingual labels; ensure footer renders in `app/layout.tsx`

## 5. Web — Unit Tests

- [x] 5.1 Create `services/web/tests/unit/lib/consent-utils.spec.ts` — mock `localStorage`; test `needsConsent()` returns true when no record; test `needsConsent()` returns true on version mismatch; test `needsConsent()` returns false on current version; test `saveConsent` writes correct JSON; test `hasAnalyticsConsent()` returns correct value; test `loadConsent()` returns null when storage is empty
- [x] 5.2 Run `npm run test` in `services/web` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 6. Mobile — Consent Storage Utility

- [x] 6.1 Create `services/mobile/src/offline/consent-storage.ts` — export: `CONSENT_VERSION = "1.0"`, type `MobileConsentRecord { version, accepted, timestamp }`, `saveConsent(record): Promise<void>` (writes JSON to AsyncStorage key `"noetia_consent"`), `loadConsent(): Promise<MobileConsentRecord | null>`, `consentIsCurrent(): Promise<boolean>` (true if stored version matches `CONSENT_VERSION` and `accepted` is true)

## 7. Mobile — Consent Screen

- [x] 7.1 Create `services/mobile/src/screens/ConsentScreen.tsx` — React Native screen with: ScrollView containing bilingual Privacy Policy summary (2–3 paragraphs ES then EN) and Terms of Service summary; tappable links to `https://noetia.app/legal/privacy` and `https://noetia.app/legal/terms` (open with `Linking.openURL`); sticky bottom bar with "Acepto / I agree" button (primary style) and "No acepto / I decline" button (text style)
- [x] 7.2 Wire "Acepto / I agree": calls `saveConsent({ version: CONSENT_VERSION, accepted: true, timestamp: Date.now() })` then navigates to next screen
- [x] 7.3 Wire "No acepto / I decline": shows `Alert.alert` with message "Noetia no puede usarse sin aceptar los términos. / Noetia cannot be used without accepting the terms." and OK button that calls `BackHandler.exitApp()` (Android) / does nothing gracefully on iOS (cannot force-quit)
- [x] 7.4 Add navigation guard in the root navigator (`services/mobile/src/screens/` or equivalent entry): on app start, call `consentIsCurrent()`; if false, render `ConsentScreen` first; if true, render the auth/main stack

## 8. Mobile — Unit Tests

- [x] 8.1 Create `services/mobile/tests/unit/offline/consent-storage.spec.ts` — mock `@react-native-async-storage/async-storage`; test `consentIsCurrent()` returns false when no record; test returns false on version mismatch; test returns true on matching version + accepted; test `saveConsent` calls AsyncStorage.setItem with correct key and JSON
- [x] 8.2 Run `npm run test` in `services/mobile` — all tests pass

## 9. Store Listing Static Artifacts

- [x] 9.1 Create `docs/store-listings/google-play-data-safety.md` — filled-in answers for Google Play Data Safety questionnaire: data types collected (Personal info: name/email; Financial info: purchase history via Stripe; App activity: reading progress, fragments created, books opened), data sharing (Stripe for payments, Google/Facebook/Apple for OAuth), all data encrypted in transit (TLS 1.2+), users can request deletion via legal@noetia.app, no data sold to third parties
- [x] 9.2 Create `docs/store-listings/apple-app-privacy.md` — Apple App Store Connect App Privacy answers: table with columns (Data Type, Purpose, Linked to Identity, Tracking); rows for Email Address (account), Name (account), Purchase History (analytics/payments), Reading Activity (product personalisation), Crash Data (analytics, not linked); privacy policy URL: `https://noetia.app/legal/privacy`

## 10. Verification

- [x] 10.1 Open web app — verify cookie banner appears on first visit, disappears after accepting, does not reappear on reload
- [x] 10.2 Navigate to `/legal/cookies`, `/legal/privacy`, `/legal/terms` — verify bilingual content renders correctly on desktop and mobile viewport
- [x] 10.3 Verify footer links to all three legal pages appear on the home/library page
- [x] 10.4 Bump `CONSENT_VERSION` to `"1.1"` temporarily — verify banner reappears; revert to `"1.0"`
- [ ] 10.5 Run mobile app on simulator — verify consent screen appears on first launch, "Acepto" navigates forward, decline shows alert
- [x] 10.6 All web and mobile tests pass
- [x] 10.7 Commit and push all changes to GitHub
