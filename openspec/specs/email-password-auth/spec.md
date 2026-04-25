## ADDED Requirements

### Requirement: User can register with email and password
The system SHALL allow a user to create an account by providing a unique email address and a password of at least 8 characters. The password SHALL be hashed with bcrypt (cost factor 12) before storage. The system SHALL return an access token and set a refresh token cookie on successful registration.

#### Scenario: Successful registration
- **WHEN** a POST request is sent to `/auth/register` with a valid email and password
- **THEN** a new user record is created, an access token is returned in the response body, and a refresh token httpOnly cookie is set

#### Scenario: Duplicate email rejected
- **WHEN** a POST request is sent to `/auth/register` with an email that already exists
- **THEN** the system returns HTTP 409 with message "Email already in use"

#### Scenario: Weak password rejected
- **WHEN** a POST request is sent to `/auth/register` with a password shorter than 8 characters
- **THEN** the system returns HTTP 400 with a validation error message

### Requirement: User can login with email and password
The system SHALL authenticate a user by verifying their email and bcrypt-hashed password. On success it SHALL return a new access token and rotate the refresh token cookie.

#### Scenario: Successful login
- **WHEN** a POST request is sent to `/auth/login` with a valid email and matching password
- **THEN** the system returns HTTP 200 with a JWT access token and sets a new refresh token cookie

#### Scenario: Wrong password rejected
- **WHEN** a POST request is sent to `/auth/login` with a valid email but incorrect password
- **THEN** the system returns HTTP 401 with message "Invalid credentials"

#### Scenario: Unknown email rejected
- **WHEN** a POST request is sent to `/auth/login` with an email that does not exist
- **THEN** the system returns HTTP 401 with message "Invalid credentials"
