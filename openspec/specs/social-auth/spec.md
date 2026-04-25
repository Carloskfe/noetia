## ADDED Requirements

### Requirement: User can login with Google OAuth
The system SHALL support Google OAuth 2.0 login via Passport.js. On successful OAuth callback, the system SHALL upsert a user record with `provider: "google"` and `providerId` set to the Google subject ID, then issue tokens.

#### Scenario: New user logs in with Google
- **WHEN** a user completes Google OAuth consent and is redirected to `/auth/google/callback`
- **THEN** a new user record is created with the Google profile email and provider info, and the user is redirected to the web app with tokens set

#### Scenario: Returning user logs in with Google
- **WHEN** a user who has previously logged in with Google completes OAuth consent
- **THEN** the existing user record's `lastLoginAt` is updated and fresh tokens are issued

### Requirement: User can login with Facebook OAuth
The system SHALL support Facebook OAuth login via Passport.js. On successful callback, the system SHALL upsert a user record with `provider: "facebook"`.

#### Scenario: New user logs in with Facebook
- **WHEN** a user completes Facebook OAuth and is redirected to `/auth/facebook/callback`
- **THEN** a new user record is created with Facebook profile data and tokens are issued

### Requirement: User can login with Apple Sign-In
The system SHALL support Apple Sign-In via Passport.js. Apple only provides the user's name on the first login; subsequent logins provide only the subject ID.

#### Scenario: First-time Apple login
- **WHEN** a user completes Apple Sign-In for the first time
- **THEN** a user record is created using the name and email provided by Apple, and tokens are issued

#### Scenario: Returning Apple login
- **WHEN** a user who previously signed in with Apple completes Sign-In again
- **THEN** the existing user is located by Apple subject ID and fresh tokens are issued
