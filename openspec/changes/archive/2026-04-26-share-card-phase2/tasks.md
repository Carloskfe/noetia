## 1. image-gen: textColor param

- [x] 1.1 Add `textColor: str | None = None` param to `render_card` in `templates/base.py`; if provided, skip `text_color_for_bg` and use `parse_hex_color(textColor)` directly
- [x] 1.2 Pass `textColor` through all four platform template `render` functions to `render_card`
- [x] 1.3 Add `textColor` to optional param parsing in `app.py` (no validation needed beyond hex format; pass as-is)
- [x] 1.4 Write unit tests in `tests/unit/templates/test_base.py`: `textColor` overrides auto-luminance for both light and dark backgrounds; `None` preserves auto-luminance
- [x] 1.5 Write unit test in `tests/unit/test_app.py`: POST with `textColor: "#FF0000"` returns 200; result forwarded to renderer

## 2. image-gen: new format IDs

- [x] 2.1 Add `wa-pic` (1080×1080), `wa-story` (1080×1920), `reel` (1080×1920), `twitter-card` (1200×675) to `DIMENSIONS` in each platform template that needs them; WhatsApp template gets `wa-pic` and `wa-story`; Instagram/Facebook get `reel`; LinkedIn gets `twitter-card`
- [x] 2.2 Add `wa-pic`, `wa-story`, `reel`, `twitter-card` to the `VALID_FORMATS` set in `app.py` and update the 400 validation error message
- [x] 2.3 Write unit tests for each new format: `wa-pic` → 1080×1080, `wa-story` → 1080×1920, `reel` → 1080×1920, `twitter-card` → 1200×675
- [x] 2.4 Write unit test in `tests/unit/test_app.py`: `format: "tiktok-story"` returns 400 with `"unsupported format: tiktok-story"`
- [x] 2.5 Run `pytest --cov=. --cov-report=term-missing` in `services/image-gen` — all tests must pass at ≥ 80% coverage

## 3. image-gen: preset thumbnails

- [x] 3.1 Create `services/image-gen/scripts/generate_presets.py`: for each of the 5 font IDs, call `render_card` with a fixed sample quote (e.g. "La lectura es un viaje"), author "Alexandria", dimensions 240×80, dark navy solid bg, save to `services/web/public/presets/{font-id}.png`
- [x] 3.2 Run `python services/image-gen/scripts/generate_presets.py` locally and commit the 5 PNG files to `services/web/public/presets/`
- [x] 3.3 Write unit test `tests/unit/scripts/test_generate_presets.py`: each preset PNG is valid (can be opened with PIL) and has correct dimensions 240×80

## 4. API: textColor forwarding in sharing module

- [x] 4.1 Update `SharingController.share` in `services/api/src/sharing/sharing.controller.ts` to extract `textColor?: string` from the request body and pass to `SharingService`
- [x] 4.2 Update `SharingService.generateShareUrl` in `services/api/src/sharing/sharing.service.ts` to accept `textColor?: string` and include it in the image-gen payload only when non-null
- [x] 4.3 Update `tests/unit/sharing/sharing.service.spec.ts`: test that `textColor` is forwarded when provided and omitted when not

## 5. API: social token service

- [x] 5.1 Create `services/api/src/social/social-token.service.ts`: `store(userId, platform, tokens)` encrypts with AES-256-CBC using `SOCIAL_TOKEN_SECRET` env var and writes to Redis key `social:tokens:{userId}:{platform}` with TTL from `expiresAt`; `getToken(userId, platform)` decrypts and returns token or null; auto-refreshes if within 5 min of expiry
- [x] 5.2 Create `services/api/src/social/social.module.ts` importing `RedisModule`, exporting `SocialTokenService`
- [x] 5.3 Write `tests/unit/social/social-token.service.spec.ts`: store saves to Redis; getToken returns null for missing key; getToken triggers refresh when token within 5 min of expiry; encryption/decryption round-trips correctly (mock Redis and crypto)

## 6. API: OAuth connect + callback endpoints

- [x] 6.1 Create `services/api/src/social/social.controller.ts` with `GET /social/:platform/connect` (JWT-protected): validates platform ∈ {linkedin, facebook, instagram}; generates CSRF state token; stores in Redis for 10 min; redirects to platform OAuth URL with correct scopes
- [x] 6.2 Add `GET /social/:platform/callback` to `SocialController`: validates `state` against Redis; exchanges code for tokens via platform API; calls `SocialTokenService.store`; returns HTML with `window.close()`; on error returns HTML with error flag
- [x] 6.3 Add platform OAuth config to `.env.example`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_TOKEN_SECRET`, `INSTAGRAM_PUBLISH_ENABLED`
- [x] 6.4 Write `tests/unit/social/social.controller.spec.ts`: connect redirects to correct OAuth URL; callback stores token and returns close-popup HTML; callback rejects mismatched state with 400; callback handles `?error=access_denied`

## 7. API: social publish endpoint

- [x] 7.1 Add `POST /social/:platform/publish` (JWT-protected) to `SocialController`: fetches token from `SocialTokenService`; returns 401 if null; downloads PNG from `imageUrl` via HTTP; calls platform-specific publisher; returns `{ postUrl }`
- [x] 7.2 Create `services/api/src/social/publishers/linkedin.publisher.ts`: uploads image to LinkedIn's asset upload API, creates UGC post with media, returns post URL
- [x] 7.3 Create `services/api/src/social/publishers/facebook.publisher.ts`: uploads image to Facebook Page's photo API, returns post URL
- [x] 7.4 Create `services/api/src/social/publishers/instagram.publisher.ts`: checks `INSTAGRAM_PUBLISH_ENABLED`; if false returns 503; otherwise uploads to IG media endpoint and publishes
- [x] 7.5 Write `tests/unit/social/social.controller.spec.ts` (publish cases): successful LinkedIn publish returns `{ postUrl }`; 401 when account not connected; 502 on platform API error; 503 for Instagram when `INSTAGRAM_PUBLISH_ENABLED=false`
- [x] 7.6 Write `tests/unit/social/publishers/linkedin.publisher.spec.ts`, `facebook.publisher.spec.ts`, `instagram.publisher.spec.ts`: mock HTTP calls; assert correct API payloads
- [x] 7.7 Run `pnpm test` in `services/api` — all tests must pass

## 8. Web: font thumbnail picker

- [x] 8.1 Update `ShareModal.tsx`: replace "Aa" `<button>` text with `<img src={`/presets/${font.id}.png`} alt={font.label} />` for each of the 5 font buttons; keep `onClick` and selected-state logic unchanged
- [x] 8.2 Update `tests/unit/components/ShareModal.spec.ts`: assert each font button renders an `<img>` with the correct `src` and `alt`

## 9. Web: format grid expansion

- [x] 9.1 Update `FORMAT_PLATFORM_MAP` in `services/web/lib/share-utils.ts`: add `wa-pic` (platform `whatsapp`, format `wa-pic`), `wa-story` (platform `whatsapp`, format `wa-story`), `reel` (platform `instagram`, format `reel`), `twitter-card` (platform `twitter`, format `twitter-card`); remove `wa`
- [x] 9.2 Update `ShareModal.tsx` format grid: replace single "WA" button with "WA Pic" and "WA Story"; add "Reel" and "Twitter/X Card" buttons (9 total); update `selectedFormat` default to `ig-post`
- [x] 9.3 Add aspect-ratio logic for new formats: `wa-story` → 9:16, `reel` → 9:16, `wa-pic` → 1:1, `twitter-card` → 16:9
- [x] 9.4 Update `tests/unit/components/ShareModal.spec.ts`: assert 9 format buttons render; WA Story updates aspect ratio to 9:16; Twitter/X Card updates to 16:9
- [x] 9.5 Update `tests/unit/lib/share-utils.spec.ts`: wa-pic, wa-story, reel, twitter-card map to correct platform+format; `wa` is no longer in the map

## 10. Web: text color picker

- [x] 10.1 Add `textColor: string | null` state to `ShareModal` (default `null` = auto-luminance); compute `effectiveTextColor` from `textColor ?? getTextColor(bgColors)` for the CSS preview
- [x] 10.2 Add `<input type="color">` labelled "Color del texto" below the background controls; initialise its value to the current auto-luminance colour; `onChange` sets `textColor` state
- [x] 10.3 Add "Restablecer" `<button>` next to the colour picker; `onClick` sets `textColor` to `null` and resets the input value to the current auto-luminance colour
- [x] 10.4 Include `textColor` in the `POST /fragments/:id/share` payload only when non-null (in both "Descargar" and "Copiar enlace" actions)
- [x] 10.5 Update `tests/unit/components/ShareModal.spec.ts`: picking a colour updates preview text colour; "Restablecer" reverts to auto-luminance; `textColor` is included in generation payload when set; omitted when null

## 11. Web: social publish UI

- [x] 11.1 Add `connectedPlatforms: Set<string>` state to `ShareModal`; on mount call `GET /social/:platform/status` (or check from a parent context) for linkedin, facebook, instagram to populate initial state
- [x] 11.2 Add a "Publicar" section to `ShareModal` below the download buttons: for each platform show "Conectar cuenta" button (if not connected) or "Compartir ahora" button (if connected)
- [x] 11.3 "Conectar cuenta" opens `GET /social/:platform/connect` in a popup (`window.open`); poll via `window.addEventListener('message')` or `setInterval` checking for popup close; re-fetch connection status on popup close
- [x] 11.4 "Compartir ahora" calls `POST /fragments/:id/share` then `POST /social/:platform/publish` in sequence; single `publishingPlatform` loading state; on success show toast "¡Publicado en {Platform}!" with post link; on failure show inline error
- [x] 11.5 Instagram "Compartir ahora" shows a `title` tooltip "Pendiente aprobación" and `disabled` when `process.env.NEXT_PUBLIC_INSTAGRAM_PUBLISH_ENABLED !== 'true'`
- [x] 11.6 Write `tests/unit/components/ShareModal.spec.ts` publish cases: connect button present when platform not connected; "Compartir ahora" triggers share then publish; success toast appears; publish failure shows inline error; Instagram button disabled when flag is false
- [x] 11.7 Run `pnpm test` in `services/web` — all tests must pass
