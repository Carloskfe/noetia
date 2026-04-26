## ADDED Requirements

### Requirement: User can connect a social account from the ShareModal
The `ShareModal` SHALL display a "Conectar cuenta" button for each supported platform (LinkedIn, Facebook, Instagram). Clicking the button SHALL initiate a server-side OAuth 2.0 flow by opening `GET /social/:platform/connect?userId=<id>` in a popup window. On successful OAuth callback, the popup SHALL close and the ShareModal SHALL reflect the connected state.

#### Scenario: Connect button is shown for each platform
- **WHEN** the ShareModal is open
- **THEN** "Conectar cuenta" buttons are visible for LinkedIn, Facebook, and Instagram

#### Scenario: Clicking connect opens OAuth popup
- **WHEN** the user clicks "Conectar cuenta" for LinkedIn
- **THEN** a popup window opens to `GET /social/linkedin/connect` and the browser redirects to LinkedIn's OAuth authorization page

#### Scenario: Popup closes and state updates on successful auth
- **WHEN** the OAuth flow completes successfully and the server stores the token
- **THEN** the popup closes, the ShareModal shows "Conectado" for that platform, and "Compartir ahora" becomes available

#### Scenario: Connect cancelled or denied by user
- **WHEN** the user closes the popup or denies permissions on the platform
- **THEN** the button reverts to "Conectar cuenta" and no token is stored

### Requirement: API exposes OAuth connect and callback endpoints
The API SHALL expose `GET /social/:platform/connect` and `GET /social/:platform/callback` for each supported platform. The connect endpoint SHALL redirect the user to the platform's authorization URL with the correct scopes. The callback endpoint SHALL exchange the authorization code for tokens, encrypt and store them in Redis, and redirect to a close-popup page.

Supported platforms and required scopes:
- `linkedin`: `w_member_social`, `r_liteprofile`
- `facebook`: `pages_manage_posts`, `pages_read_engagement`
- `instagram`: `instagram_content_publish`, `instagram_basic` (requires Meta App Review)

#### Scenario: Connect endpoint redirects to platform OAuth page
- **WHEN** `GET /social/linkedin/connect` is called with a valid session
- **THEN** the response is HTTP 302 redirecting to LinkedIn's OAuth authorization URL with correct `client_id`, `redirect_uri`, `scope`, and `state` (CSRF token)

#### Scenario: Callback stores token and closes popup
- **WHEN** `GET /social/linkedin/callback?code=<code>&state=<state>` is called with a valid code
- **THEN** the server exchanges the code for tokens, stores them encrypted in Redis under `social:tokens:{userId}:linkedin`, and returns an HTML page that calls `window.close()`

#### Scenario: Callback rejects mismatched state
- **WHEN** the `state` parameter in the callback does not match the stored CSRF token
- **THEN** the response is HTTP 400 with `{ "error": "invalid state" }` and no token is stored

#### Scenario: Callback handles platform error response
- **WHEN** the callback receives `?error=access_denied`
- **THEN** the response returns an HTML page that calls `window.close()` with an error flag readable by the opener

### Requirement: Token storage is server-side and encrypted
The `SocialTokenService` SHALL store OAuth tokens in Redis encrypted with AES-256-CBC using a `SOCIAL_TOKEN_SECRET` environment variable. The Redis key SHALL be `social:tokens:{userId}:{platform}`. Access token TTL SHALL match `expiresAt`; refresh tokens SHALL be stored under `social:tokens:{userId}:{platform}:refresh` with a 60-day TTL. Tokens SHALL never be returned to the browser in plaintext.

#### Scenario: Token is stored on successful callback
- **WHEN** the callback endpoint receives a valid authorization code
- **THEN** `SocialTokenService.store(userId, platform, tokens)` is called and the encrypted token exists in Redis

#### Scenario: SocialTokenService refreshes expired access token automatically
- **WHEN** `SocialTokenService.getToken(userId, platform)` is called and the access token expires within 5 minutes
- **THEN** the service uses the refresh token to obtain a new access token, updates Redis, and returns the new token

#### Scenario: Missing token returns null
- **WHEN** `SocialTokenService.getToken(userId, platform)` is called for a platform the user has not connected
- **THEN** the method returns `null`

### Requirement: User can publish a generated card directly to a connected social platform
The API SHALL expose `POST /social/:platform/publish` (JWT-protected). It SHALL accept `{ fragmentId, imageUrl, caption? }`, download the PNG from MinIO using `imageUrl`, upload it to the platform's media API, and post with the optional caption. It SHALL return `{ postUrl }` with HTTP 200 on success.

#### Scenario: Successful LinkedIn publish returns post URL
- **WHEN** `POST /social/linkedin/publish` is called with a valid fragmentId, imageUrl, and connected account
- **THEN** the API downloads the PNG, uploads to LinkedIn's asset upload API, creates an image post, and returns `{ "postUrl": "https://www.linkedin.com/feed/..." }`

#### Scenario: Successful Facebook Page publish returns post URL
- **WHEN** `POST /social/facebook/publish` is called with a connected Facebook Page account
- **THEN** the API posts the image to the Page's feed and returns `{ "postUrl": "https://www.facebook.com/..." }`

#### Scenario: Instagram publish blocked without App Review (prod)
- **WHEN** `POST /social/instagram/publish` is called and `INSTAGRAM_PUBLISH_ENABLED=false`
- **THEN** the response is HTTP 503 with `{ "error": "instagram_publish_unavailable" }`

#### Scenario: Publish with no connected account returns 401
- **WHEN** `POST /social/:platform/publish` is called for a platform the user has not connected
- **THEN** the response is HTTP 401 with `{ "error": "account_not_connected" }`

#### Scenario: Platform API error returns 502
- **WHEN** the platform's media upload or post endpoint returns a non-200 response
- **THEN** the API returns HTTP 502 with `{ "error": "platform_publish_failed", "detail": "<platform message>" }`

### Requirement: ShareModal offers "Compartir ahora" for connected platforms
The `ShareModal` SHALL show a "Compartir ahora" button for each platform once an account is connected. Clicking it SHALL call `POST /fragments/:id/share` to generate the image, then immediately call `POST /social/:platform/publish` with the resulting URL. A single loading state SHALL cover both calls. On success, a toast SHALL confirm the post with a link to it. On failure, an error message SHALL be shown without closing the modal.

#### Scenario: "Compartir ahora" is disabled when no account is connected
- **WHEN** the user has not connected a LinkedIn account
- **THEN** the LinkedIn "Compartir ahora" button is absent or disabled

#### Scenario: "Compartir ahora" triggers generation then publish
- **WHEN** the user clicks "Compartir ahora" for LinkedIn
- **THEN** a loading state is shown, the card is generated, and the result is published to LinkedIn in sequence

#### Scenario: Successful publish shows confirmation toast
- **WHEN** both the generation and publish calls succeed
- **THEN** a toast notification appears with "¡Publicado en LinkedIn!" and a link to the post

#### Scenario: Publish failure shows inline error
- **WHEN** the publish API call returns an error
- **THEN** an error message "No se pudo publicar. Intenta de nuevo." is shown inside the modal

#### Scenario: Instagram "Compartir ahora" shows pending tooltip in prod
- **WHEN** `INSTAGRAM_PUBLISH_ENABLED=false` (production) and the user has connected Instagram
- **THEN** the Instagram "Compartir ahora" button shows a tooltip "Pendiente aprobación" and is non-interactive
