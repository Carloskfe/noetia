## ADDED Requirements

### Requirement: POST /fragments/:id/share generates and returns a quote card URL
The API SHALL expose `POST /fragments/:id/share` protected by `JwtAuthGuard`. It SHALL look up the fragment (returning 404 if not found), fetch the associated book's `title` and `author`, call `POST http://image-gen:5000/generate` with `{ text, author, title, platform, format, font, bgType, bgColors }`, and return `{ url }` with HTTP 200. The `format`, `font`, `bgType`, and `bgColors` fields are optional; when omitted, image-gen defaults apply.

#### Scenario: Authenticated user shares own fragment with all options
- **WHEN** an authenticated user sends `POST /fragments/:id/share` with `{ platform: "instagram", format: "story", font: "playfair", bgType: "gradient", bgColors: ["#0D1B2A", "#1A4A4A"] }`
- **THEN** the response is HTTP 200 with `{ "url": "<pre-signed image URL>" }`

#### Scenario: Authenticated user shares with platform only (defaults applied)
- **WHEN** an authenticated user sends `POST /fragments/:id/share` with only `{ "platform": "linkedin" }`
- **THEN** the response is HTTP 200 with a URL, using image-gen defaults for font and background

#### Scenario: Fragment not found returns 404
- **WHEN** `POST /fragments/:id/share` is called with a non-existent fragment ID
- **THEN** the response is HTTP 404

#### Scenario: Unauthenticated request is rejected
- **WHEN** `POST /fragments/:id/share` is called without a valid JWT
- **THEN** the response is HTTP 401

#### Scenario: image-gen failure propagates as 502
- **WHEN** the image-gen service returns a non-200 response
- **THEN** the API responds with HTTP 502 `{ "error": "image generation failed" }`

### Requirement: SharingService calls image-gen via HTTP
The `SharingService` SHALL forward `platform`, `format`, `font`, `bgType`, and `bgColors` to image-gen. It SHALL be injectable and mockable so unit tests do not make real HTTP calls.

#### Scenario: SharingService constructs correct image-gen payload with all params
- **WHEN** `SharingService.generateShareUrl(fragment, book, platform, format, font, bgType, bgColors)` is called
- **THEN** it sends `{ text, author, title, platform, format, font, bgType, bgColors }` to image-gen and returns the URL string

#### Scenario: SharingService uses defaults when optional params are omitted
- **WHEN** `SharingService.generateShareUrl(fragment, book, "instagram")` is called without optional params
- **THEN** the payload sent to image-gen contains `platform: "instagram"` and omits or leaves defaults for the remaining params
