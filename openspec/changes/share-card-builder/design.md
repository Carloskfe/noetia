## Context

Alexandria's image-gen service already generates PNGs programmatically using Pillow — no AI involved. The current share flow has two separate modal components (`SharePicker`, `SharePreviewModal`) with a fixed 5-palette colour system and a single format per platform. Users cannot customise fonts or background colours, and they see no preview until after the image is generated. The web client and image-gen service are already connected through `POST /fragments/:id/share` → `POST /generate`.

## Goals / Non-Goals

**Goals:**
- Live CSS-based preview in the browser that updates instantly with no API calls while the user browses options
- Per-platform format selection: post (existing dimensions) and story (1080×1920) for Instagram and Facebook
- 5 bundled TTF fonts selectable by the user; same fonts used in both the CSS preview and the Pillow PNG
- Fully customisable background: solid colour or two-stop linear gradient with hex colour pickers
- Text colour derived automatically from background luminance (WCAG contrast heuristic)
- Optional caption from fragment note, shown with a checkbox in the preview modal
- Single API call to generate the PNG only on Download or Copy Link

**Non-Goals:**
- AI-generated backgrounds or imagery
- More than 5 fonts in the initial release
- Per-character or per-word typography controls
- Animated or video formats (Reels, TikTok)
- Custom watermark or logo upload

## Decisions

### Decision 1 — CSS preview, single PNG generation on commit

**Chosen:** Render the preview entirely in CSS/HTML in the browser. Call `POST /generate` only when the user clicks Download or Copy Link.

**Rationale:** Each Pillow render is ~50–150 ms locally but adds latency over the network. With 5 fonts × 2 bg types × infinite colour combinations, pre-generating options is impractical. CSS can faithfully reproduce the card layout (same fonts via Google Fonts CDN, same text wrapping rules, same colour logic) at zero latency.

**Alternative considered:** Call `/generate` on every option change with debounce. Rejected — even 300 ms debounce produces noticeable lag per keystroke on colour pickers, and burns MinIO storage for discarded previews.

### Decision 2 — Fonts bundled in Docker image, loaded via Google Fonts in browser

**Chosen:** Download TTF files for Playfair Display, Lato, Merriweather, Dancing Script, and Montserrat during `docker build` (via `RUN wget` in the image-gen Dockerfile). Load the same fonts in the web client via `@import` from Google Fonts CDN.

**Rationale:** Pillow requires local font files; it cannot fetch URLs. Bundling at build time keeps the container self-contained and avoids runtime font fetch failures. The Google Fonts import in the browser ensures the CSS preview matches the Pillow output without shipping font files in the Next.js bundle.

**Font paths in container:** `/app/fonts/{playfair,lato,merriweather,dancing,montserrat}.ttf`

### Decision 3 — Text colour derived from background luminance

**Chosen:** Compute relative luminance of the background colour (or average of gradient stops) using the WCAG formula. Use white text when luminance < 0.179, dark navy (`#0D1B2A`) otherwise. Apply identically in both CSS preview and Pillow render.

**Rationale:** Eliminates manual text-colour selection for users. Guarantees readable contrast for any background choice. Same logic in Python and TypeScript keeps preview and output in sync.

### Decision 4 — `style` param removed; `font` + `bgType` + `bgColors` replace it

**Chosen:** Drop the `style` string from `POST /generate` and the sharing API. Replace with explicit `font` (one of 5 IDs), `bgType` (`solid` | `gradient`), and `bgColors` (array of 1 or 2 hex strings).

**Rationale:** The old `style` param was an opaque shorthand for a fixed palette. The new params are orthogonal and composable — any font can pair with any background. Existing callers (none external) are updated in the same PR.

### Decision 5 — Unified `ShareModal` component

**Chosen:** Delete `SharePicker.tsx` and `SharePreviewModal.tsx`. Replace with a single `ShareModal.tsx` that owns all state: selected platform+format, font, bgType, bgColors, captionEnabled, and the generated URL.

**Rationale:** The two existing components passed state up to `FragmentSheet` and back down, creating awkward prop threading. A single modal owns its lifecycle cleanly and is easier to test.

**Layout:** Fixed overlay, max-w-lg, scrollable. Top: CSS preview card (aspect ratio driven by format). Below: Format grid → Font picker → Background controls → Caption toggle → Action buttons.

### Decision 6 — Story format in image-gen

**Chosen:** Add `format` param (`post` | `story`) to `POST /generate`. Platform templates dispatch dimensions based on format: post uses existing widths; story uses 1080×1920 for Instagram and Facebook. LinkedIn and WhatsApp do not support story format — passing `story` for those falls back to `post`.

**Rationale:** Minimal change to existing render pipeline; no new template files needed, just a dimension lookup.

## Risks / Trade-offs

- **CSS vs Pillow font rendering differs** — browser and Pillow use different text-layout engines; kerning and line-break points may diverge slightly for long quotes. → Mitigation: keep quote text ≤ 280 chars (enforced client-side); test with representative long strings.
- **Google Fonts CDN dependency in browser** — preview fonts fail if CDN is unreachable. → Mitigation: CSS `font-family` stack falls back to system serif/sans; preview still usable. PNG is unaffected (uses bundled TTFs).
- **Colour picker accessibility** — native `<input type="color">` has poor mobile UX in some browsers. → Mitigation: acceptable for MVP; replace with a custom picker in a future sprint if UX feedback warrants it.
- **MinIO storage growth** — each Download/Copy generates a new PNG. → Mitigation: existing MinIO bucket; no change to current retention policy. Future sprint can add TTL-based cleanup.

## Migration Plan

1. Update image-gen: add fonts, update `base.py` and `app.py`, rebuild container
2. Update API: add params to sharing controller/service, deploy
3. Update web: replace SharePicker + SharePreviewModal with ShareModal, deploy
4. Steps are independently deployable; old `style` param is only consumed internally so no external callers break

**Rollback:** Each layer is independently revertable. Image-gen and API changes are backwards-compatible additions (new optional params with defaults); the web change is the only breaking UX change but has no external contract.

## Open Questions

- Should gradient direction be configurable (top-to-bottom vs diagonal)? — deferred to post-MVP; default to top-to-bottom for now
- Should the caption checkbox default to checked or unchecked? — default unchecked; user opts in
