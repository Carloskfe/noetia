# 07 — Authentication & Authorization

## Mechanism — CONFIRMED (`services/api/src/auth`)

**Access tokens:** JWT (`@nestjs/jwt`), signed with `JWT_SECRET`, lifetime `JWT_EXPIRES_IN` (default `15m` per CLAUDE.md). Payload `{ sub: userId, email }` (`token.service.ts generateAccessToken`).

**Refresh tokens:** opaque, **rotating**, server-stored.
- `generateRefreshToken(userId)` mints a token id; `validateRefreshToken` / `deleteRefreshToken` manage it. Stored in **Redis** (`redis.provider.ts`). **CONFIRMED**.
- Delivery is client-type aware (`auth.controller.ts`):
  - **Web:** `refresh_token` httpOnly cookie, value `userId:tokenId`, `maxAge` 30 days, rotated on every `/auth/refresh`. The refresh token is never exposed to browser JS.
  - **Mobile:** refresh token returned in the response **body** (mobile has no cookie jar); access token also in body.
- `safeUser()` strips sensitive fields from the returned user object. **CONFIRMED**.

## Auth flows — CONFIRMED

- **Email/password:** `POST /auth/register`, `/auth/login` (`AuthGuard('local')`, bcrypt password hashing — `bcrypt` dependency). Email confirmation via `generateEmailConfirmToken`/`consumeEmailConfirmToken` (`GET /auth/confirm-email`, `POST /auth/resend-confirmation`).
- **Password reset:** `generatePasswordResetToken`/`consumePasswordResetToken` (`POST /auth/forgot-password`, `/auth/reset-password`). Tokens stored in Redis. **CONFIRMED**.
- **Refresh / logout:** `POST /auth/refresh` (rotates), `POST /auth/logout` (deletes refresh token).

## OAuth — CONFIRMED

Passport strategies present for all three providers:
- **Google** (`strategies/google.strategy.ts`) — **live** in production (per project state).
- **Facebook** (`strategies/facebook.strategy.ts`) — configured, **Dev mode** (pending Meta review) per project state.
- **Apple** (`strategies/apple.strategy.ts`, `@nicokaiser/passport-apple`) — strategy present; production configuration status **UNKNOWN** from code (project notes say not yet configured).

Web flow: `GET /auth/{provider}` → `/{provider}/callback`. Mobile flow: token exchange endpoints `POST /auth/{provider}/mobile` (mobile obtains provider token via Expo auth-session, backend verifies). **CONFIRMED** routes exist.

OAuth users are created with `emailConfirmed` handled to avoid trapping them behind the confirmation gate (migration 063 backfill; `upsertOAuthUser` heals on login). **CONFIRMED**.

## Authorization — CONFIRMED

Guards (see [05-api.md](05-api.md) for counts):
- `JwtAuthGuard` — base authentication (44 uses).
- `EmailConfirmedGuard` — confirmed-email gate (8 uses).
- `SubscriptionGuard` (`subscriptions/subscription.guard.ts`) — entitlement gate (3 uses).
- `ClubRoleGuard` (`clubs/guards/club-role.guard.ts`) — club role checks.

**Roles / permissions model — CONFIRMED:**
- User roles are coarse: `userType` (`personal|author|editorial`), `isAdmin` boolean, and `hostingTier` (`basic|starter|pro`) for author upload limits (`HOSTING_TIER_LIMITS` = 1/3/12).
- **No centralized RBAC / `AdminGuard`.** Admin authorization is enforced **inline** via `isAdmin` checks inside individual controllers (books, personas, waitlist, codes). This is functional but decentralized — flagged in [16-security.md](16-security.md) and [19-technical-debt.md](19-technical-debt.md).
- Author-scoping (`/authors/me/*`) derives the author from the JWT subject. **CONFIRMED**.

## Session model — INFERRED
Stateless access token + Redis-backed rotating refresh. No server session store beyond Redis refresh tokens. Logout is per-refresh-token (revokes one device). **INFERRED:** global "log out everywhere" not implemented.

## Secrets — CONFIRMED (names only)
`JWT_SECRET`, `JWT_EXPIRES_IN`, provider client IDs/secrets (`GOOGLE_*`, `FACEBOOK_*`, `APPLE_*`), `SOCIAL_TOKEN_SECRET` (for social-publishing token encryption). Values are not committed and are **not** reproduced here.
