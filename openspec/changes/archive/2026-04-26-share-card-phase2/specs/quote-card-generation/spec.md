## MODIFIED Requirements

### Requirement: Platform templates render styled quote cards
The image-gen service SHALL render a PNG quote card for each supported platform and format. The card SHALL include: quote text wrapped to fit the card width, author + book attribution line, and an "Alexandria" watermark. The background SHALL be either a solid colour or a two-stop vertical gradient. The text colour SHALL be determined as follows: if `textColor` is provided, use it directly; otherwise apply auto-luminance (white when background luminance ≤ 0.179, dark navy `#0D1B2A` otherwise). The font SHALL be selected from 5 bundled TTF typefaces.

#### Scenario: LinkedIn post card renders at correct dimensions
- **WHEN** `render(fragment, style='post')` is called on the LinkedIn template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 1200×627 px

#### Scenario: Instagram post card renders at correct dimensions
- **WHEN** `render(fragment, style='post')` is called on the Instagram template with valid fragment data
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1080 px

#### Scenario: Instagram story card renders at correct dimensions
- **WHEN** `render(fragment, style='story')` is called on the Instagram template
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1920 px

#### Scenario: Facebook post card renders at correct dimensions
- **WHEN** `render(fragment, style='post')` is called on the Facebook template
- **THEN** the returned bytes decode to a valid PNG with dimensions 1200×630 px

#### Scenario: Facebook story card renders at correct dimensions
- **WHEN** `render(fragment, style='story')` is called on the Facebook template
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1920 px

#### Scenario: WhatsApp card renders at correct dimensions
- **WHEN** `render(fragment)` is called on the WhatsApp template
- **THEN** the returned bytes decode to a valid PNG with dimensions 800×800 px

#### Scenario: Long text is wrapped and does not overflow
- **WHEN** `render(fragment)` is called with quote text longer than 200 characters
- **THEN** the returned PNG is valid and text is wrapped within card bounds

#### Scenario: Light background produces dark text when no textColor override
- **WHEN** `render_card` is called with `bg_colors=["#FFFFFF"]` and no `textColor`
- **THEN** the rendered card uses dark navy text colour

#### Scenario: Dark background produces white text when no textColor override
- **WHEN** `render_card` is called with `bg_colors=["#000000"]` and no `textColor`
- **THEN** the rendered card uses white text colour

#### Scenario: textColor override bypasses auto-luminance
- **WHEN** `render_card` is called with `bg_colors=["#FFFFFF"]` and `textColor="#FF0000"`
- **THEN** the rendered card uses `#FF0000` as the text colour regardless of luminance

#### Scenario: Gradient background renders top-to-bottom
- **WHEN** `render_card` is called with `bg_type="gradient"` and `bg_colors=["#0D1B2A", "#1A4A4A"]`
- **THEN** the returned PNG is valid and dimensions are correct

#### Scenario: Each of the 5 fonts produces a valid PNG
- **WHEN** `render_card` is called with each of: `playfair`, `lato`, `merriweather`, `dancing`, `montserrat`
- **THEN** each call returns a valid PNG with correct dimensions

#### Scenario: WA Pic card renders at correct dimensions
- **WHEN** `render(fragment, format='wa-pic')` is called
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1080 px

#### Scenario: WA Story card renders at correct dimensions
- **WHEN** `render(fragment, format='wa-story')` is called
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1920 px

#### Scenario: Reel cover renders at correct dimensions
- **WHEN** `render(fragment, format='reel')` is called
- **THEN** the returned bytes decode to a valid PNG with dimensions 1080×1920 px

#### Scenario: Twitter/X card renders at correct dimensions
- **WHEN** `render(fragment, format='twitter-card')` is called
- **THEN** the returned bytes decode to a valid PNG with dimensions 1200×675 px

### Requirement: POST /generate endpoint accepts fragment metadata and returns a URL
The image-gen service SHALL expose `POST /generate` accepting JSON `{ text, author, title, platform, format?, font?, bgType?, bgColors?, textColor? }`. It SHALL render the card using the specified parameters (with defaults: `format=post`, `font=lato`, `bgType=solid`, `bgColors=["#0D1B2A"]`), upload the PNG to MinIO `images/` bucket with a UUID filename, and return `{ url: <pre-signed URL> }` with HTTP 200.

Valid values for `format`: `post`, `story`, `wa-pic`, `wa-story`, `reel`, `twitter-card`.

#### Scenario: Valid request returns pre-signed URL
- **WHEN** a POST request is sent to `/generate` with `{ text, author, title, platform: "linkedin" }`
- **THEN** the response is HTTP 200 with JSON `{ "url": "<string starting with http>" }`

#### Scenario: Request with all optional params returns 200
- **WHEN** a POST request is sent with `{ text, author, title, platform: "instagram", format: "story", font: "playfair", bgType: "gradient", bgColors: ["#0D1B2A", "#1A4A4A"], textColor: "#FFFFFF" }`
- **THEN** the response is HTTP 200 with a URL

#### Scenario: Request with textColor override returns 200
- **WHEN** a POST request is sent with `{ text, author, title, platform: "linkedin", textColor: "#FF6B6B" }`
- **THEN** the response is HTTP 200 and the generated PNG uses `#FF6B6B` as the text colour

#### Scenario: Request with wa-story format returns 200
- **WHEN** a POST request is sent with `{ text, author, title, platform: "whatsapp", format: "wa-story" }`
- **THEN** the response is HTTP 200 with a URL for a 1080×1920 PNG

#### Scenario: Request with twitter-card format returns 200
- **WHEN** a POST request is sent with `{ text, author, title, platform: "twitter", format: "twitter-card" }`
- **THEN** the response is HTTP 200 with a URL for a 1200×675 PNG

#### Scenario: Unknown platform returns 400
- **WHEN** a POST request is sent to `/generate` with `platform: "tiktok"`
- **THEN** the response is HTTP 400 with `{ "error": "unsupported platform" }`

#### Scenario: Unknown font returns 400
- **WHEN** a POST request is sent with `font: "comic-sans"`
- **THEN** the response is HTTP 400 with `{ "error": "unsupported font: comic-sans" }`

#### Scenario: Unknown bgType returns 400
- **WHEN** a POST request is sent with `bgType: "pattern"`
- **THEN** the response is HTTP 400 with `{ "error": "unsupported bgType: pattern" }`

#### Scenario: Unknown format returns 400
- **WHEN** a POST request is sent with `format: "tiktok-story"`
- **THEN** the response is HTTP 400 with `{ "error": "unsupported format: tiktok-story" }`

#### Scenario: Missing required field returns 400
- **WHEN** a POST request is sent to `/generate` with `text` omitted
- **THEN** the response is HTTP 400 with `{ "error": "missing required field: text" }`
