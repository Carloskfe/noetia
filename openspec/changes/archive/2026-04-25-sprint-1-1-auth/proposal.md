## Why

No user can currently access Alexandria — there is no authentication system. This sprint delivers the full auth layer so users can register, log in via email or social providers, and receive JWT tokens that gate all future API endpoints.

## What Changes

- Implement email + password registration and login with bcrypt hashing
- Implement JWT access tokens (15min) and refresh tokens (7d) with rotation
- Implement Google OAuth 2.0 login via Passport.js
- Implement Facebook OAuth login via Passport.js
- Implement Apple Sign-In via Passport.js
- Create `users` database table and TypeORM entity
- Add auth guards to protect future API routes
- Create logout and token refresh endpoints
- Build login and register pages in Next.js web app
- Store refresh tokens in Redis with expiry

## Capabilities

### New Capabilities

- `email-password-auth`: Register and login with email + password, bcrypt hashing, JWT issuance
- `social-auth`: OAuth login via Google, Facebook, and Apple using Passport.js strategies
- `jwt-session`: Access token + refresh token lifecycle, rotation, Redis storage, logout
- `user-entity`: PostgreSQL `users` table, TypeORM entity, profile CRUD endpoints
- `auth-web-pages`: Next.js login and register pages with form validation and social login buttons

### Modified Capabilities

## Impact

- **`services/api`**: New `auth/` and `users/` module implementations; new dependencies: `@nestjs/passport`, `passport`, `passport-local`, `passport-google-oauth20`, `passport-facebook`, `passport-apple`, `bcrypt`, `@nestjs/jwt`, `ioredis`
- **`services/web`**: New login and register pages; new dependency: form library (React Hook Form)
- **`infra/postgres`**: TypeORM migration creates `users` table
- **`cache` (Redis)**: Refresh tokens stored with TTL
- **`.env.example`**: Already contains OAuth credentials placeholders — no changes needed
