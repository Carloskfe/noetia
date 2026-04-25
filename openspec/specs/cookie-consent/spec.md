## ADDED Requirements

### Requirement: Consent banner appears on first web visit
The web app SHALL display a cookie consent banner at the bottom of the screen on first visit if no consent record exists in `localStorage` under the key `alexandria_consent`. The banner SHALL be visible across all pages and SHALL NOT block page interaction.

#### Scenario: First-time visitor sees banner
- **WHEN** a user visits any page and `localStorage.getItem('alexandria_consent')` returns null
- **THEN** the `CookieBanner` component is rendered at the bottom of the viewport

#### Scenario: Returning visitor with stored consent does not see banner
- **WHEN** a user visits any page and `localStorage.getItem('alexandria_consent')` returns a valid JSON object with a matching version
- **THEN** the `CookieBanner` component is NOT rendered

### Requirement: Banner offers three consent actions
The banner SHALL present three actions: "Aceptar todo / Accept all", "Solo esenciales / Essentials only", and "Gestionar / Manage". Each action SHALL immediately dismiss the banner and save a consent record.

#### Scenario: User accepts all cookies
- **WHEN** the user clicks "Aceptar todo / Accept all"
- **THEN** `localStorage` is written with `{ version, analytics: true, marketing: true, timestamp }` and the banner is hidden

#### Scenario: User accepts only essentials
- **WHEN** the user clicks "Solo esenciales / Essentials only"
- **THEN** `localStorage` is written with `{ version, analytics: false, marketing: false, timestamp }` and the banner is hidden

### Requirement: Consent preference gates non-essential scripts
The web app SHALL only initialize analytics or marketing scripts when the stored consent record has `analytics: true` or `marketing: true` respectively. Essential scripts (auth, payment) SHALL always run.

#### Scenario: Analytics blocked when consent is essentials-only
- **WHEN** the stored consent has `analytics: false`
- **THEN** `hasAnalyticsConsent()` returns false and analytics scripts are not initialized

#### Scenario: Analytics allowed after accept-all
- **WHEN** the stored consent has `analytics: true`
- **THEN** `hasAnalyticsConsent()` returns true

### Requirement: Consent re-prompt on policy version change
The system SHALL re-display the banner if the stored consent version does not match the current `CONSENT_VERSION` constant.

#### Scenario: Outdated consent triggers re-prompt
- **WHEN** `localStorage` contains a consent record with `version: "1.0"` and `CONSENT_VERSION` is `"1.1"`
- **THEN** `needsConsent()` returns true and the banner is shown

#### Scenario: Current consent suppresses banner
- **WHEN** the stored consent version matches `CONSENT_VERSION`
- **THEN** `needsConsent()` returns false

### Requirement: Cookie Policy page is accessible at /legal/cookies
The web app SHALL serve a bilingual (ES/EN) Cookie Policy page at `/legal/cookies` explaining what cookies Alexandria uses, their purpose, retention period, and how to withdraw consent.

#### Scenario: Cookie policy page renders
- **WHEN** a user navigates to `/legal/cookies`
- **THEN** the page renders with both Spanish and English content sections
