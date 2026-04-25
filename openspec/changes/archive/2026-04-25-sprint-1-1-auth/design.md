## Context

The Alexandria API has no auth layer. All endpoints are currently open. This sprint adds the complete authentication system: email/password and three OAuth providers (Google, Facebook, Apple), JWT access/refresh token lifecycle, user persistence in PostgreSQL, and refresh token storage in Redis. The NestJS module stubs for `auth/` and `users/` exist but are empty.

## Goals / Non-Goals

**Goals:**
- Users can register and login with email + password
- Users can login with Google, Facebook, and Apple OAuth
- API issues short-lived access tokens (15min) and long-lived refresh tokens (7d)
- Refresh tokens are stored in Redis and rotated on each refresh request
- Auth guards protect all future API routes by default
- Login and register pages exist in the Next.js web app

**Non-Goals:**
- Email verification (future sprint)
- Password reset flow (future sprint)
- Role-based access control (future sprint)
- Mobile OAuth screens (Sprint 4.1)
- Two-factor authentication

## Decisions

### Token strategy: JWT access + Redis refresh tokens
Short-lived JWTs (15min) for stateless auth on each request. Refresh tokens (7d) stored in Redis as `refresh:<userId>:<tokenId>` with TTL. On logout, the Redis key is deleted — no token blacklist needed. On refresh, old token is deleted and a new one is issued (rotation).

**Alternative considered:** Session cookies — rejected; Alexandria targets mobile + web clients where stateless JWT is simpler.

### OAuth library: Passport.js with NestJS guards
`@nestjs/passport` integrates cleanly with NestJS guards and decorators. Each provider gets its own strategy file. The `validate()` method upserts the user record on each OAuth login.

**Alternative considered:** Custom OAuth flows — rejected; Passport handles token exchange and profile normalization, reducing error surface.

### Password hashing: bcrypt with cost factor 12
Industry standard, built-in brute-force resistance. Cost factor 12 balances security and latency (~300ms on modern hardware).

**Alternative considered:** Argon2 — valid but adds a native dependency that complicates Docker builds.

### User upsert on OAuth login
When a user logs in with Google/Facebook/Apple for the first time, a `users` row is created with `provider` and `providerId` set. Subsequent logins with the same provider update `lastLoginAt`. Email-matched accounts from different providers are treated as separate accounts in MVP (account linking is a future feature).

### Web auth state: httpOnly cookie for refresh token, Authorization header for access token
The Next.js app stores the refresh token in an httpOnly cookie (XSS-safe) and the access token in memory. The API issues `Set-Cookie` on login/refresh and clears it on logout.

## Risks / Trade-offs

`Apple Sign-In requires HTTPS` → Apple OAuth will not work on localhost without a tunnel (ngrok). Mitigation: implement and test Google/Facebook first; Apple can be verified in staging.

`Refresh token Redis dependency` → If Redis goes down, all users are effectively logged out on next token expiry. Mitigation: Redis has AOF persistence configured; acceptable risk for MVP.

`OAuth credentials in .env` → Missing or wrong credentials cause a 500 at startup. Mitigation: validate required env vars at module init and throw a clear error.
