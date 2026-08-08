# 05 — API

REST API built with **NestJS**. Global config (**CONFIRMED**, `main.ts` / `app.module.ts`): `ValidationPipe({ whitelist: true, transform: true })`, `cookie-parser`, CORS restricted to `WEB_URL`, `rawBody: true` (for Stripe signature verification), global `ThrottlerGuard` (120 req / 60 s). DTO validation via `class-validator`/`class-transformer` (17 DTO files).

## Route surface — CONFIRMED

Full HTTP surface (verified from `@Controller`/`@Get/@Post/@Patch/@Delete` decorators):

### Auth `/auth`
`POST register · login · refresh · logout · resend-confirmation · forgot-password · reset-password`; `GET confirm-email`; OAuth: `GET google|facebook|apple (+ /callback)`, mobile token exchange `POST google/mobile · facebook/mobile · apple/mobile`.

### Users `/users`
`GET me`, `PATCH me`, `PATCH me/onboarding`, `DELETE me` (account deletion).

### Books `/books`
`GET /` (supports `?search=` ILIKE + `?limit=` behind quality gate), `GET pending`, `GET :id`, `POST /` (upload), `PATCH :id/publish`, `DELETE :id`, `GET :id/fragments`, `GET/POST :id/sync-map`, `POST :id/sync-map/srt`, `GET/POST :id/progress`.

### Authors `/authors`
`GET me/books · me/analytics · me/quota`.

### Library `/library` & Collections `/collections`
`GET /` (user library), `GET ids`, `POST/DELETE :bookId`; collections `GET /`, `GET :slug`.

### Fragments `/fragments`
`POST /`, `PATCH :id`, `DELETE :id`, `POST combine`.

### Sharing (root-mounted)
`POST fragments/:id/share`, `GET shares/:id` (public invite page feed).

### Social publishing `/social`
`GET :platform/connect · :platform/callback · :platform/status`, `POST :platform/publish` (platforms: linkedin, facebook, instagram, pinterest).

### Search `/search`
`GET /` (query `q`, filters `category`, `isFree`).

### Subscriptions `/subscriptions`
`GET plans · token-packages · me · linked-users`; `POST checkout · tokens/purchase · portal · cancel · resume · sync · books/:bookId/purchase · books/:bookId/redeem · invite · invite/accept`; `DELETE linked-users/:userId · invite/:inviteId`.

### Webhooks `/webhooks`
`POST stripe` (signature-verified — see [08](08-subscriptions.md)).

### Gifts `/gifts`
`POST checkout · claim`, `GET preview/:token`.

### Clubs `/clubs`
Full CRUD + membership (`join`, `invite`, `accept`, role changes, ban/remove), books (add/activate), messages, phrase-anchored discussions, polls (create/vote/close), and sessions (Escucha Juntos). ~30 endpoints.

### Causes `/causes`
`GET /`, `GET/POST preferences`.

### Stats `/stats`
`POST heartbeat`, `GET me`, `GET history`.

### Push `/push`
`POST register` (Expo token).

### Admin
- `/admin/codes` — `POST/GET` upload codes.
- `/admin/tokens` — `POST promotional`, `GET/POST courtesy/quotas`, `POST courtesy/issue`, `GET balance/:userId`.
- `/admin/personas` — `POST recompute`, `POST :userId/recompute`, `GET :userId`.
- `/waitlist` — `POST /`, `GET /`, `GET stats`, `POST :id/invite` (admin-gated reads).

### Ops
- `/health` — `GET /`.
- `/metrics` — `GET metrics` (Prometheus exposition).

## Authorization pattern — CONFIRMED

Guards applied via `@UseGuards` (usage counts across controllers):

| Guard | Count | Meaning |
|-------|-------|---------|
| `JwtAuthGuard` | 44 | Authenticated user required |
| `JwtAuthGuard, EmailConfirmedGuard` | 8 | Must also have confirmed email |
| `JwtAuthGuard, SubscriptionGuard` | 3 | Must have active subscription/entitlement |
| `AuthGuard('google'/'facebook'/'apple')` | 6 | OAuth flow |
| `AuthGuard('local')` | 1 | Email/password login |

- **Admin authorization is inline** (`isAdmin` checks inside controllers: books, personas, waitlist, codes) rather than a dedicated `AdminGuard`. **CONFIRMED** — this is an important consistency note (see [16-security.md](16-security.md)).
- **Club roles** enforced by `ClubRoleGuard` (`clubs/guards/`). **CONFIRMED**.

## API style — INFERRED
- REST/JSON only. No GraphQL despite CLAUDE.md's "REST/GraphQL" phrasing → **the code is REST-only** (no GraphQL module present). Documentation-vs-code conflict; **code wins**.
- One WebSocket namespace via Socket.IO for club live sessions (`club-session.gateway.ts`).
