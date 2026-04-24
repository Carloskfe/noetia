## ADDED Requirements

### Requirement: Platform templates render styled quote cards
The image-gen service SHALL render a PNG quote card for each supported platform using the fragment text, author name, and book title. Each card SHALL include a dark navy background, wrapped white quote text, gold accent rule, author + book attribution, and an "Alexandria" watermark.

#### Scenario: LinkedIn card renders at correct dimensions
- **WHEN** `render(fragment)` is called on the LinkedIn template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 1200×627 px

#### Scenario: Instagram card renders at correct dimensions
- **WHEN** `render(fragment)` is called on the Instagram template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1080 px

#### Scenario: Facebook card renders at correct dimensions
- **WHEN** `render(fragment)` is called on the Facebook template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 1200×630 px

#### Scenario: WhatsApp card renders at correct dimensions
- **WHEN** `render(fragment)` is called on the WhatsApp template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 800×800 px

#### Scenario: Long text is wrapped and does not overflow
- **WHEN** `render(fragment)` is called with quote text longer than 200 characters
- **THEN** the returned PNG is valid (no exception) and text is wrapped within card bounds

### Requirement: POST /generate endpoint accepts fragment metadata and returns a URL
The image-gen service SHALL expose `POST /generate` accepting JSON `{ text, author, title, platform }`. It SHALL render the card, upload the PNG to MinIO `images/` bucket with a UUID filename, and return `{ url: <pre-signed URL> }` with HTTP 200.

#### Scenario: Valid request returns pre-signed URL
- **WHEN** a POST request is sent to `/generate` with `{ text, author, title, platform: "linkedin" }`
- **THEN** the response is HTTP 200 with JSON `{ "url": "<string starting with http>" }`

#### Scenario: Unknown platform returns 400
- **WHEN** a POST request is sent to `/generate` with `platform: "tiktok"`
- **THEN** the response is HTTP 400 with `{ "error": "unsupported platform" }`

#### Scenario: Missing required field returns 400
- **WHEN** a POST request is sent to `/generate` with `text` omitted
- **THEN** the response is HTTP 400 with `{ "error": "missing required field: text" }`
