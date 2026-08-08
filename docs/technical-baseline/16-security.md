# 16 — Security

## Strengths — CONFIRMED
- **Password hashing:** bcrypt, cost factor **12** (`auth.service.ts`).
- **Refresh cookie hardening:** `httpOnly: true`, `sameSite: 'strict'`, `secure` in production, `path: '/'`, 30-day maxAge. Refresh tokens are opaque, **rotated on every refresh**, and stored server-side in Redis (revocable).
- **Access tokens:** short-lived JWT (15 m), never carry secrets in payload.
- **Input validation:** global `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields on every DTO.
- **Rate limiting:** global `ThrottlerGuard`, 120 requests / 60 s.
- **CORS:** restricted to `WEB_URL` (not `*`).
- **Stripe webhooks:** signature-verified (`constructEvent` with `STRIPE_WEBHOOK_SECRET`); invalid signatures rejected before processing. `rawBody` preserved for verification.
- **Social-publishing tokens:** encrypted at rest with **AES-256-CBC** (`social-token.service.ts`, random IV per record), stored in Redis with TTL, keyed by `SOCIAL_TOKEN_SECRET`.
- **Server hardening (ops):** SSH on non-default port 222, fail2ban active (per CLAUDE.md / project state).
- **Secrets:** not committed (`.env.production` on server only); in-code defaults are dev placeholders.

## Weaknesses / risks — CONFIRMED
1. **No `helmet`** — standard HTTP security headers (CSP, HSTS, X-Frame-Options, etc.) are not set at the API layer. Some may be applied by Traefik/Next.js; **UNKNOWN** whether equivalents exist at the edge. *(Impact: clickjacking / MIME-sniffing / missing HSTS exposure.)*
2. **Decentralized admin authorization** — `isAdmin` checked inline per-controller, not via a single `AdminGuard`. A missed check on a new admin route is a latent privilege-escalation risk. *(Consistency/coverage risk.)*
3. **No admin action audit log** — privileged actions (token grants, publishes, deletes) are not recorded in an audit trail.
4. **In-code default secrets** — placeholders like `changeme-social-secret`, `changeme`, `minioadmin` exist as fallbacks; safe only if **every** production env var is set. A single unset var silently falls back to a weak default. *(Depends on `.env.production` completeness — UNKNOWN from code.)*
5. **CBC without explicit authentication** — social-token encryption uses AES-256-**CBC** (no AEAD/HMAC tag). Confidentiality is fine; integrity/tamper-evidence is weaker than GCM. Low impact (short-lived OAuth tokens in Redis).

## Not analyzed / unknown — UNKNOWN / OUT OF SCOPE
- Edge headers, WAF, TLS cipher config at Traefik — **OUT OF SCOPE** (infra, not code).
- Actual production env-var completeness — **UNKNOWN**.
- Dependency vulnerability posture (no SCA output reviewed) — **OUT OF SCOPE**.
- Penetration-test / DRM-access-audit results — **UNKNOWN** (a DRM/access audit is referenced in backlog).

## PII & data protection — CONFIRMED
- PII stored: email, name, country, avatar, provider IDs, Stripe customer ID. Payment card data is **not** stored (delegated to Stripe).
- Privacy controls exist as user-level toggles (`shareReadingProgress/Library/Profile/Fragments`, `allowInsights`) and account deletion (`DELETE /users/me`).
- Legal surfaces present (`lib/legal/{privacy,terms,cookie}`), cookie consent banner/modal, and mobile consent screen. **CONFIRMED**.

## Summary posture — INFERRED
Solid application-layer fundamentals (hashing, token rotation, validation, throttling, webhook verification, encrypted third-party tokens). The main gaps are **defense-in-depth headers (helmet/CSP)**, **centralized admin RBAC**, and **audit logging** — none are architectural blockers; all are additive hardening.
