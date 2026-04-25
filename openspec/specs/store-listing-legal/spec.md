## ADDED Requirements

### Requirement: Google Play Data Safety section copy exists as a static artifact
A static Markdown file SHALL exist at `docs/store-listings/google-play-data-safety.md` containing completed answers to Google Play's Data Safety questionnaire: data types collected (name, email, financial info, app activity), data sharing with third parties (Stripe, auth providers), data encryption in transit, opt-out of data deletion request.

#### Scenario: Google Play data safety file exists
- **WHEN** the file `docs/store-listings/google-play-data-safety.md` is read
- **THEN** it contains filled-in answers for all required Google Play Data Safety fields in English

### Requirement: Apple App Privacy label summary exists as a static artifact
A static Markdown file SHALL exist at `docs/store-listings/apple-app-privacy.md` containing the App Privacy label answers for Apple App Store Connect: data linked to identity (email, purchases, usage data), data not linked to identity (crash data), and a table summarising each data type, its purpose, and whether it is linked to the user.

#### Scenario: Apple privacy label file exists
- **WHEN** the file `docs/store-listings/apple-app-privacy.md` is read
- **THEN** it contains a filled-in table covering all data types collected by Alexandria in English

### Requirement: Store listing privacy policy URL placeholder is documented
The static files SHALL include the intended public URL for the hosted Privacy Policy (e.g., `https://alexandria.app/legal/privacy`) so it can be pasted into both store submission forms.

#### Scenario: Privacy policy URL is present in both store listing files
- **WHEN** either store listing file is read
- **THEN** it contains the privacy policy URL string
