## ADDED Requirements

### Requirement: Access tokens are short-lived JWTs
The system SHALL issue JWT access tokens signed with `JWT_SECRET` that expire after 15 minutes. Tokens SHALL include `sub` (user ID), `email`, and `iat`/`exp` claims.

#### Scenario: Valid token grants access
- **WHEN** a request includes a valid Bearer token in the Authorization header
- **THEN** the JwtAuthGuard passes and the request proceeds

#### Scenario: Expired token is rejected
- **WHEN** a request includes an expired JWT
- **THEN** the system returns HTTP 401 with message "Unauthorized"

### Requirement: Refresh tokens are stored in Redis and rotated
The system SHALL generate a UUID refresh token on login, store it in Redis as `refresh:<userId>:<tokenId>` with a 7-day TTL, and set it as an httpOnly cookie. On each refresh request the old token SHALL be deleted and a new one issued (rotation). On logout the token SHALL be deleted from Redis.

#### Scenario: Valid refresh token issues new tokens
- **WHEN** a POST request is sent to `/auth/refresh` with a valid refresh token cookie
- **THEN** the old Redis token is deleted, a new refresh token is stored, a new access token is returned, and a new refresh cookie is set

#### Scenario: Invalid or expired refresh token is rejected
- **WHEN** a POST request is sent to `/auth/refresh` with a token not found in Redis
- **THEN** the system returns HTTP 401 and clears the cookie

### Requirement: User can logout
The system SHALL provide a logout endpoint that deletes the refresh token from Redis and clears the refresh token cookie.

#### Scenario: Successful logout
- **WHEN** a POST request is sent to `/auth/logout` with a valid refresh token cookie
- **THEN** the token is deleted from Redis, the cookie is cleared, and the system returns HTTP 200
