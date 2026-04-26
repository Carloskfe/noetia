## Why

Phase 1 shipped a functional share-card builder with a live CSS preview, font selection, and solid/gradient backgrounds — but the card design control is still coarse (auto-luminance only, no direct color override) and the social sharing loop ends at download/copy-link. Phase 2 closes the UX gap so users can fine-tune cards to taste and publish in one tap without leaving the app.

## What Changes

- **Font color picker** — manual `<input type="color">` that overrides the auto-luminance white/navy decision; value forwarded as optional `textColor` hex param to image-gen
- **5 visual preset thumbnails** — replace the "Aa" font buttons with small PNG mockup images showing each typeface rendered on the current background; clicking applies both font and a matching default palette
- **Complete format list** — adds WA Story (9:16 1080×1920), WA Pic (1:1 1080×1080 alias), Reel cover (9:16 1080×1920), and Twitter/X card (16:9 1200×675) to the format grid and to image-gen dimensions
- **Social OAuth + direct publish** — "Conectar cuenta" flow for LinkedIn (fast), Facebook Page, and Instagram Business; "Compartir ahora" button posts the generated card directly via each platform's API; Facebook and Instagram require Meta App Review before production traffic

## Capabilities

### New Capabilities

- `social-publish`: OAuth connection and direct-publish flow for LinkedIn, Facebook Page, and Instagram Business accounts from the ShareModal

### Modified Capabilities

- `share-card-builder`: adds font color override control, preset thumbnail picker, new format buttons (WA Story, WA Pic, Reel cover, Twitter/X card), and "Compartir ahora" publish trigger in `ShareModal`
- `quote-card-generation`: adds optional `textColor` hex param to `render_card` and all platform templates; adds WA Story, Reel cover, and Twitter/X card format dimensions

## Impact

- **image-gen** (`templates/base.py`, all four platform templates, `app.py`): new `textColor` param; new format IDs and dimensions
- **web** (`components/ShareModal.tsx`): font color picker, preset thumbnail images, expanded format grid, connect-account buttons, "Compartir ahora" action
- **api** (`sharing/` module): no new endpoints for phase 2 download/copy; `SharingService` forwards `textColor`; new `social-publish/` module added for OAuth callback and publish endpoints
- **New dependency**: LinkedIn API v2, Facebook Graph API v21, Instagram Graph API — OAuth 2.0 flows and media-publish endpoints
