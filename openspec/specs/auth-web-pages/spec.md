## ADDED Requirements

### Requirement: Login page allows email/password and social login
The web app SHALL provide a login page at `/login` with an email + password form and buttons for Google, Facebook, and Apple sign-in. On successful login the user SHALL be redirected to `/library`.

#### Scenario: Successful email login redirects to library
- **WHEN** a user submits valid credentials on the login page
- **THEN** the access token is stored in memory, the refresh cookie is set, and the user is redirected to `/library`

#### Scenario: Invalid credentials shows error
- **WHEN** a user submits incorrect credentials on the login page
- **THEN** an inline error message is displayed and the user remains on the login page

#### Scenario: Social login button initiates OAuth
- **WHEN** a user clicks the Google, Facebook, or Apple login button
- **THEN** the browser is redirected to the corresponding OAuth provider URL

### Requirement: Register page allows account creation
The web app SHALL provide a register page at `/register` with name, email, and password fields. Validation SHALL run client-side before submission.

#### Scenario: Successful registration redirects to library
- **WHEN** a user submits valid registration data
- **THEN** an account is created, tokens are set, and the user is redirected to `/library`

#### Scenario: Client-side validation prevents weak passwords
- **WHEN** a user enters a password shorter than 8 characters
- **THEN** an inline error is shown before the form is submitted to the API
