## Context

Phase 1 delivered a share-card builder: live CSS preview, 5 fonts, solid/gradient backgrounds, download/copy-link actions. Phase 2 adds four capabilities on top of that foundation:
1. Font color picker — manual `textColor` override forwarded to image-gen
2. Visual preset thumbnails — static PNG assets replace "Aa" font buttons
3. Expanded format grid — 4 new format IDs (`wa-pic`, `wa-story`, `reel`, `twitter-card`)
4. Social OAuth + direct publish — LinkedIn, Facebook Page, Instagram Business; server-side token storage

Constraints: Redis and Postgres are already running; MinIO holds generated images; the image-gen Python service owns all PNG rendering; Meta App Review is required before Instagram publish goes live.

## Goals / Non-Goals

**Goals:**
- User can manually override the auto-luminance text color for precise card control
- Font picker shows recognizable thumbnails instead of abstract "Aa" labels
- Format grid covers WhatsApp Pic, WhatsApp Story, Instagram Reel cover, and Twitter/X card
- User can connect LinkedIn/Facebook/Instagram accounts and publish directly from the modal
- Tokens stored server-side; the web client never sees raw OAuth tokens

**Non-Goals:**
- TikTok, Pinterest, or any other platform in this phase
- Scheduled or queued posting (publish is immediate only)
- Analytics on published posts
- Removing the legacy `wa` format ID from image-gen (keep for backward compat; just hide from UI)
- Instagram publish before Meta App Review approval (feature-flagged off in prod)

## Decisions

### 1. textColor param: optional override, null = auto-luminance

`textColor` is sent only when the user has explicitly chosen a color (non-null). Image-gen checks: if `textColor` is present, use it directly; otherwise run the existing luminance calculation. This avoids breaking auto-luminance for users who never touch the picker.

**Alternative considered:** Always send a color (pre-compute luminance in the web client). Rejected — would couple web to the luminance formula and break if the formula is updated.

### 2. Preset thumbnails: static PNG assets, generated offline

Five 120×40 px PNGs are pre-rendered once (using `render_card` on a canonical sample quote) and committed to `web/public/presets/{font-id}.png`. The font picker `<img>` tags reference these directly.

**Alternative considered:** Render thumbnails on-demand via image-gen. Rejected — adds latency to every modal open and creates unnecessary image-gen load for a purely decorative element.

### 3. New format IDs — additive, wa kept for backward compat

New IDs: `wa-pic` (1080×1080), `wa-story` (1080×1920), `reel` (1080×1920), `twitter-card` (1200×675). The old `wa` ID (800×800) is retained in image-gen but removed from the ShareModal format grid. `wa-pic` is the replacement for `wa` in the UI.

**Alternative considered:** Rename `wa` → `wa-pic`. Rejected — risks breaking existing share links in the wild if any clients pass `format=wa`.

### 4. OAuth token storage: Redis, server-side, AES-256 encrypted

Tokens stored in Redis: key = `social:tokens:{userId}:{platform}`, value = AES-256-encrypted JSON `{ accessToken, refreshToken?, expiresAt }`. TTL matches `expiresAt`. Refresh tokens stored under a sibling key with a longer TTL.

**Alternative considered:** Encrypted column in Postgres `user_social_accounts` table. Viable but requires a DB migration and adds read latency for a frequently-checked token. Redis already holds sessions and is the natural fit for short-lived credentials.

**Alternative considered:** Store tokens in the browser (localStorage). Rejected — tokens would be accessible to XSS and cannot be scoped server-side.

### 5. Publish flow: server proxies multipart upload to platform

`POST /social/:platform/publish` accepts `{ fragmentId, imageUrl, caption? }`. The NestJS API:
1. Fetches the user's token from Redis
2. Downloads the PNG from MinIO using `imageUrl`
3. POSTs to the platform's media upload endpoint (multipart), gets a media ID
4. Posts with the media ID and caption

This keeps platform API credentials server-side and avoids CORS issues from the browser posting to Meta/LinkedIn directly.

### 6. Instagram publish: feature-flagged off until Meta App Review

A `INSTAGRAM_PUBLISH_ENABLED` env var gates the Instagram publish path in prod. In dev/staging the flag is on. The connect-account UI for Instagram is visible regardless; the "Compartir ahora" button shows a "Pendiente aprobación" tooltip instead of posting if the flag is off.

## Risks / Trade-offs

- **Meta App Review delay** → LinkedIn publish ships first; Facebook Page publish ships with App Review pending; Instagram publish is blocked until approval. Mitigation: feature flag isolates the blast radius.
- **OAuth token expiry** → Access tokens are short-lived (1 h for LinkedIn, ~60 days for Meta long-lived tokens). Refresh token rotation is required. Mitigation: `SocialTokenService` checks `expiresAt` before each publish and silently refreshes if within 5 min of expiry.
- **Redis eviction** → If Redis is under memory pressure, tokens can be evicted, requiring re-auth. Mitigation: use a dedicated Redis DB index (e.g., DB 1) for social tokens with `maxmemory-policy noeviction` on that DB.
- **Preset PNG commits** — 5 small PNGs (~5–15 KB each) in the repo. Acceptable one-time addition; no LFS needed.

## Open Questions

- **LinkedIn organization posting** — Phase 2 only posts as the user (personal profile). Do we need org/company page posting? Defer to phase 3.
- **Facebook Page selection** — A user may admin multiple Pages. Phase 2 will pick the first Page in the token's granted pages list. Full Page selector can come later.
- **Caption auto-copy vs. API post** — For Instagram, if App Review takes >4 weeks, should we fall back to copy-caption + deep-link to IG app? Decide at T-2 weeks based on review status.
