## ADDED Requirements

### Requirement: First-launch consent screen is mandatory
The mobile app SHALL display a consent screen on first launch before any other screen. The user MUST accept the Privacy Policy and Terms of Service to proceed. The screen SHALL NOT provide a way to skip or dismiss without making a choice.

#### Scenario: First launch shows consent screen
- **WHEN** the app launches and no consent record exists in AsyncStorage
- **THEN** `ConsentScreen` is the first screen rendered, with no back button or skip option

#### Scenario: Returning user with valid consent bypasses screen
- **WHEN** the app launches and AsyncStorage contains a consent record matching the current `CONSENT_VERSION`
- **THEN** the app navigates directly to the auth/main flow, skipping `ConsentScreen`

### Requirement: Consent screen shows bilingual summaries and links to full documents
The consent screen SHALL display a short bilingual (ES/EN) summary of the Privacy Policy and Terms of Service. It SHALL include tappable links that open the full documents (web URLs or in-app WebView).

#### Scenario: Full document links are tappable
- **WHEN** the user taps the Privacy Policy link
- **THEN** the full privacy policy URL opens (in a WebView or system browser)

### Requirement: Accepting consent stores version and allows app entry
Tapping "Acepto / I agree" SHALL write the consent record `{ version, timestamp, accepted: true }` to AsyncStorage and navigate to the main app flow.

#### Scenario: User accepts and proceeds
- **WHEN** the user taps "Acepto / I agree"
- **THEN** AsyncStorage is written with the consent record and the app navigates to the next screen

### Requirement: Declining consent exits the app gracefully
Tapping "No acepto / I decline" SHALL show a brief explanation that the app cannot be used without consent, then exit the application.

#### Scenario: User declines and app exits
- **WHEN** the user taps "No acepto / I decline"
- **THEN** a message is shown ("Alexandria no puede usarse sin aceptar los términos / Alexandria cannot be used without accepting the terms") and the app closes

### Requirement: Consent version bump triggers re-consent on next launch
When `CONSENT_VERSION` changes, the stored consent version SHALL not match and the consent screen SHALL be shown again on the next app launch.

#### Scenario: Version mismatch triggers re-consent
- **WHEN** AsyncStorage contains `{ version: "1.0" }` and `CONSENT_VERSION` is `"1.1"`
- **THEN** `consentIsCurrent()` returns false and `ConsentScreen` is shown
