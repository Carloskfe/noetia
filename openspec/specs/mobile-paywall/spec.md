## ADDED Requirements

### Requirement: Paywall screen shown to non-subscribers
The system SHALL display a `PaywallScreen` in the React Native app when a non-subscriber (status `none`, `canceled`, or `past_due`) attempts to access premium content.

#### Scenario: Non-subscriber taps premium book
- **WHEN** a user with no active subscription navigates to a premium content screen
- **THEN** `PaywallScreen` is rendered instead of the content

#### Scenario: Active subscriber accesses content
- **WHEN** a user with `status = active` or `trialing` navigates to premium content
- **THEN** the content screen renders normally without the paywall

### Requirement: Paywall screen links to web checkout
The system SHALL render a "Subscribe now" button on `PaywallScreen` that opens the web pricing page (`https://noetia.app/pricing`) via `Linking.openURL`.

#### Scenario: User taps "Subscribe now"
- **WHEN** a user taps "Subscribe now" on the paywall screen
- **THEN** `Linking.openURL('https://noetia.app/pricing')` is called, opening the browser

### Requirement: Paywall screen displays plan summary
The system SHALL display a brief summary of available plans (Individual and Dual Reader with prices) and a feature list on `PaywallScreen`.

#### Scenario: Paywall renders plan info
- **WHEN** `PaywallScreen` is rendered
- **THEN** both Individual ($9.99/mo) and Dual Reader ($14.99/mo) plans are listed with key features

### Requirement: Navigation guard checks subscription on app start
The system SHALL check subscription status (via `GET /api/subscriptions/me`) on app launch. If the user is authenticated but has `status = none` or `canceled`, the navigator SHALL render `PaywallScreen` as the default screen until a valid subscription is detected.

#### Scenario: App launch with expired subscription
- **WHEN** the app starts and the authenticated user has `status = canceled`
- **THEN** `PaywallScreen` is shown as the first screen

#### Scenario: App launch with active subscription
- **WHEN** the app starts and the authenticated user has `status = active`
- **THEN** the main reading stack is shown directly
