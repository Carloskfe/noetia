## ADDED Requirements

### Requirement: Users table stores account data
The system SHALL maintain a `users` table in PostgreSQL with columns: `id` (UUID, primary key), `email` (unique, nullable for Apple users without email), `passwordHash` (nullable for OAuth users), `provider` (enum: local, google, facebook, apple), `providerId` (nullable), `name`, `avatarUrl`, `createdAt`, `lastLoginAt`. A TypeORM migration SHALL create this table.

#### Scenario: Migration creates users table
- **WHEN** TypeORM migrations are run against a fresh database
- **THEN** the `users` table exists with all required columns and constraints

#### Scenario: Email uniqueness is enforced
- **WHEN** two users with the same email are inserted
- **THEN** the database rejects the second insert with a unique constraint violation

### Requirement: User profile can be retrieved and updated
The system SHALL provide `GET /users/me` to return the authenticated user's profile and `PATCH /users/me` to update `name` and `avatarUrl`. Both endpoints SHALL require a valid JWT.

#### Scenario: Authenticated user retrieves profile
- **WHEN** a GET request is sent to `/users/me` with a valid JWT
- **THEN** the system returns HTTP 200 with the user's id, email, name, avatarUrl, and createdAt

#### Scenario: Unauthenticated request is rejected
- **WHEN** a GET request is sent to `/users/me` without a JWT
- **THEN** the system returns HTTP 401
