## ADDED Requirements

### Requirement: POST /fragments/:id/share generates and returns a quote card URL
The API SHALL expose `POST /fragments/:id/share` protected by `JwtAuthGuard`. It SHALL look up the fragment (returning 404 if not found), fetch the associated book's `title` and `author`, call `POST http://image-gen:5000/generate` with `{ text, author, title, platform }`, and return `{ url }` with HTTP 200.

#### Scenario: Authenticated user shares own fragment
- **WHEN** an authenticated user sends `POST /fragments/:id/share` with `{ "platform": "linkedin" }` for a fragment they own
- **THEN** the response is HTTP 200 with `{ "url": "<pre-signed image URL>" }`

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
The `SharingService` SHALL use NestJS `HttpModule` to call image-gen. It SHALL be injectable and mockable so unit tests do not make real HTTP calls.

#### Scenario: SharingService constructs correct image-gen payload
- **WHEN** `SharingService.generateShareUrl(fragment, book, platform)` is called
- **THEN** it sends `{ text: fragment.text, author: book.author, title: book.title, platform }` to image-gen and returns the URL string from the response
