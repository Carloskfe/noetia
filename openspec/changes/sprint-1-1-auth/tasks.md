## 1. API Dependencies & Setup

- [x] 1.1 Install auth dependencies in `services/api`: `@nestjs/passport`, `passport`, `passport-local`, `@types/passport-local`, `passport-google-oauth20`, `@types/passport-google-oauth20`, `passport-facebook`, `@types/passport-facebook`
- [x] 1.2 Install Apple Sign-In: `passport-apple`
- [x] 1.3 Install JWT + bcrypt: `@nestjs/jwt`, `bcrypt`, `@types/bcrypt`
- [x] 1.4 Install ioredis for token storage: `ioredis`
- [x] 1.5 Install class-validator and class-transformer for DTO validation: `class-validator`, `class-transformer`
- [x] 1.6 Enable `ValidationPipe` globally in `src/main.ts`

## 2. User Entity & Migration

- [x] 2.1 Create `src/users/user.entity.ts` with columns: `id` (UUID), `email` (unique, nullable), `passwordHash` (nullable), `provider` (enum), `providerId` (nullable), `name`, `avatarUrl`, `createdAt`, `lastLoginAt`
- [x] 2.2 Create TypeORM migration `CreateUsersTable` that creates the `users` table with all constraints
- [x] 2.3 Add migration script to `package.json` and configure TypeORM CLI in `src/data-source.ts`
- [x] 2.4 Run migration against the dev database to verify the table is created

## 3. Users Module

- [x] 3.1 Create `src/users/users.service.ts` with methods: `findById`, `findByEmail`, `findByProvider`, `create`, `update`
- [x] 3.2 Create `src/users/dto/update-user.dto.ts` with optional `name` and `avatarUrl` fields
- [x] 3.3 Create `src/users/users.controller.ts` with `GET /users/me` and `PATCH /users/me` (both protected)
- [x] 3.4 Wire entity and service into `src/users/users.module.ts`

## 4. JWT Session Service

- [x] 4.1 Create `src/auth/token.service.ts` that generates signed JWTs (15min expiry) using `@nestjs/jwt`
- [x] 4.2 Add refresh token methods to `TokenService`: `storeRefreshToken(userId, tokenId)`, `validateRefreshToken(userId, tokenId)`, `deleteRefreshToken(userId, tokenId)` using ioredis with 7d TTL
- [x] 4.3 Create `src/auth/jwt.strategy.ts` (Passport JWT strategy) that validates Bearer tokens and loads user from DB
- [x] 4.4 Create `src/auth/jwt-auth.guard.ts` that extends `AuthGuard('jwt')`

## 5. Email / Password Auth

- [x] 5.1 Create `src/auth/dto/register.dto.ts` (email, password min 8 chars, name)
- [x] 5.2 Create `src/auth/dto/login.dto.ts` (email, password)
- [x] 5.3 Create `src/auth/local.strategy.ts` (Passport local strategy) that validates email + bcrypt password
- [x] 5.4 Implement `POST /auth/register` in `src/auth/auth.controller.ts`: hash password, create user, issue tokens
- [x] 5.5 Implement `POST /auth/login` using LocalAuthGuard: validate credentials, issue tokens

## 6. OAuth Strategies

- [x] 6.1 Create `src/auth/strategies/google.strategy.ts` using `passport-google-oauth20`, upsert user on validate
- [x] 6.2 Create `src/auth/strategies/facebook.strategy.ts` using `passport-facebook`, upsert user on validate
- [x] 6.3 Create `src/auth/strategies/apple.strategy.ts` using `passport-apple`, upsert user on validate
- [x] 6.4 Add OAuth routes to `auth.controller.ts`: `GET /auth/google`, `GET /auth/google/callback`, same for facebook and apple
- [x] 6.5 OAuth callback redirects to web app with tokens (access token as query param, refresh token as cookie)

## 7. Refresh & Logout Endpoints

- [x] 7.1 Implement `POST /auth/refresh`: read refresh token cookie, validate in Redis, rotate tokens
- [x] 7.2 Implement `POST /auth/logout`: delete refresh token from Redis, clear cookie
- [x] 7.3 Set refresh token as `httpOnly`, `sameSite: strict`, `secure: true` (allow `false` in dev) cookie in all token-issuing endpoints

## 8. Auth Module Wiring

- [x] 8.1 Configure `JwtModule` and `PassportModule` in `src/auth/auth.module.ts`
- [x] 8.2 Configure Redis connection in `src/auth/auth.module.ts` using `REDIS_URL` env var
- [x] 8.3 Register all strategies (local, jwt, google, facebook, apple) as providers
- [x] 8.4 Export `JwtAuthGuard` from `AuthModule` for use by other modules

## 9. Web — Login & Register Pages

- [x] 9.1 Install `react-hook-form` and `zod` in `services/web`
- [x] 9.2 Create `app/(auth)/login/page.tsx` with email + password form and social login buttons
- [x] 9.3 Create `app/(auth)/register/page.tsx` with name, email, and password fields
- [x] 9.4 Create `app/(auth)/layout.tsx` with centered card layout
- [x] 9.5 Create `lib/api.ts` in web — thin fetch wrapper pointing to `NEXT_PUBLIC_API_URL`
- [x] 9.6 On successful login/register, store access token in memory (or `sessionStorage`) and redirect to `/library`
- [x] 9.7 Show inline error messages from API responses on both forms

## 10. Verification

- [x] 10.1 `POST /auth/register` with valid data returns 201 and access token
- [x] 10.2 `POST /auth/login` with valid credentials returns 200 and access token
- [x] 10.3 `POST /auth/login` with wrong password returns 401
- [x] 10.4 `GET /users/me` with valid JWT returns user profile
- [x] 10.5 `GET /users/me` without JWT returns 401
- [x] 10.6 `POST /auth/refresh` with valid cookie returns new access token
- [x] 10.7 `POST /auth/logout` clears cookie and invalidates refresh token
- [x] 10.8 Login page loads at `http://localhost:3000/login` without errors
- [x] 10.9 Register page loads at `http://localhost:3000/register` without errors
- [x] 10.10 Commit and push all changes to GitHub
