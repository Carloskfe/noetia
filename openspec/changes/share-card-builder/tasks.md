## 1. image-gen — Fonts and Dockerfile

- [x] 1.1 Update `services/image-gen/Dockerfile` to download 5 TTF fonts during build: Playfair Display, Lato, Merriweather, Dancing Script, Montserrat into `/app/fonts/`
- [x] 1.2 Add `VALID_FONTS` dict in `templates/base.py` mapping font IDs to local TTF paths
- [x] 1.3 Write unit tests verifying each font file loads without error and renders a valid PNG

## 2. image-gen — Background and luminance logic

- [x] 2.1 Implement `parse_hex_color(hex: str) -> tuple` helper in `templates/base.py` (strips `#`, returns RGB tuple)
- [x] 2.2 Implement `relative_luminance(r, g, b) -> float` using WCAG formula in `templates/base.py`
- [x] 2.3 Implement `text_color_for_bg(bg_colors: list) -> tuple` — averages gradient stops, returns white or dark navy based on luminance threshold 0.179
- [x] 2.4 Update `render_card` signature: replace `style` param with `font`, `bg_type`, `bg_colors`; render solid or vertical gradient background using Pillow's `ImageDraw.rectangle` / linear gradient via pixel loop
- [x] 2.5 Write unit tests for `parse_hex_color`, `relative_luminance`, and `text_color_for_bg`
- [x] 2.6 Write unit tests for `render_card` with each font, solid background, gradient background, light and dark luminance cases

## 3. image-gen — Platform templates and story format

- [x] 3.1 Add `DIMENSIONS` dict to each platform template mapping `format` (`post`/`story`) to `(width, height)`; Instagram and Facebook get story = 1080×1920; LinkedIn and WhatsApp fall back to post dimensions for story
- [x] 3.2 Update `render` function in all four platform templates to accept `format` param and pass correct dimensions to `render_card`
- [x] 3.3 Write unit tests for Instagram story (1080×1920) and Facebook story (1080×1920) dimensions
- [x] 3.4 Update existing dimension tests to pass `format="post"` explicitly

## 4. image-gen — app.py endpoint

- [x] 4.1 Update `_REQUIRED_FIELDS` — remove `style`; add optional param parsing for `format`, `font`, `bg_type`, `bg_colors` with defaults (`format=post`, `font=lato`, `bg_type=solid`, `bg_colors=["#0D1B2A"]`)
- [x] 4.2 Add validation: unknown `font` → 400 `"unsupported font: <value>"`; unknown `bg_type` → 400 `"unsupported bgType: <value>"`
- [x] 4.3 Pass `format`, `font`, `bg_type`, `bg_colors` through to `renderer(fragment, format, font, bg_type, bg_colors)`
- [x] 4.4 Update `test_app.py`: remove old `style` tests, add tests for `format`, `font`, `bg_type`, `bg_colors` validation and pass-through; verify unknown font and unknown bgType return 400
- [x] 4.5 Rebuild image-gen Docker container and run full pytest suite — all tests must pass at ≥80% coverage

## 5. API — Sharing layer

- [x] 5.1 Update `SharingService.generateShareUrl` signature to accept `format?`, `font?`, `bgType?`, `bgColors?`; include them in the image-gen payload
- [x] 5.2 Update `SharingController.share` to extract `format`, `font`, `bgType`, `bgColors` from request body and forward to `SharingService`
- [x] 5.3 Update `sharing.service.spec.ts`: update `mockFragment` to use `startPhraseIndex: null`, add tests for full-params payload and defaults-only payload
- [x] 5.4 Run `pnpm test` in `services/api` — all 124+ tests must pass

## 6. Web — share-utils.ts

- [x] 6.1 Update `shareFragment(fragmentId, platform, format, font, bgType, bgColors)` to include all new params in the POST body
- [x] 6.2 Add `ShareFormat` type (`'ig-post' | 'ig-story' | 'fb-post' | 'fb-story' | 'li-post' | 'wa'`) and `FORMAT_PLATFORM_MAP` mapping each to `{ platform, format }`
- [x] 6.3 Update or add share-utils unit tests for the new function signature

## 7. Web — ShareModal component

- [x] 7.1 Create `services/web/components/ShareModal.tsx` — props: `fragmentId`, `fragmentText`, `author`, `bookTitle`, `note`, `onClose`
- [x] 7.2 Implement state: `selectedFormat` (default `ig-post`), `selectedFont` (default `lato`), `bgType` (default `solid`), `bgColors` (default `["#0D1B2A"]`), `captionEnabled` (default `false`), `loading`, `error`, `generatedUrl`
- [x] 7.3 Implement live CSS preview pane: card div with dynamic `style` prop (background solid or CSS `linear-gradient`; font-family from selected font; aspect ratio 1:1 or 9:16); show fragment text and attribution
- [x] 7.4 Implement format selection grid (6 buttons: IG Post, IG Story, FB Post, FB Story, LI Post, WA)
- [x] 7.5 Implement font picker (5 buttons showing "Aa" in each typeface; load fonts via Google Fonts `@import` in a `<style>` tag or Next.js `next/font`)
- [x] 7.6 Implement background controls: Sólido/Degradado toggle; one `<input type="color">` for solid; two `<input type="color">` for gradient
- [x] 7.7 Implement `getLuminance(hex)` and `getTextColor(bgColors)` helpers matching the Python logic (threshold 0.179); apply to preview text colour
- [x] 7.8 Implement caption section: render only when `note` is non-null; checkbox "Usar como comentario" (default unchecked); show note text when checked
- [x] 7.9 Implement "Descargar" action: on click, call `shareFragment` with current options, set loading; on success, trigger `<a download>` click on the returned URL
- [x] 7.10 Implement "Copiar enlace" action: same generation call; on success, `navigator.clipboard.writeText(url)` and show "¡Copiado!" for 2 s
- [x] 7.11 Implement error state: show "No se pudo generar la imagen" and re-enable buttons on failure
- [x] 7.12 Write `tests/unit/components/ShareModal.spec.ts` covering: renders preview, format selection updates aspect ratio state, font selection updates state, background type toggle, caption section visibility, Download triggers shareFragment, Copy triggers clipboard, error state, loading state

## 8. Web — FragmentSheet and cleanup

- [x] 8.1 Update `FragmentSheet.tsx`: import `ShareModal`; replace `sharingFragment` state and `SharePicker`/`SharePreviewModal` usage with `ShareModal`; pass `fragmentText`, `author` (from book or fragment), `bookTitle`, and `note`
- [x] 8.2 Delete `services/web/components/SharePicker.tsx`
- [x] 8.3 Delete `services/web/components/SharePreviewModal.tsx`
- [x] 8.4 Delete or update `tests/unit/components/SharePicker.spec.ts` and `SharePreviewModal.spec.ts`
- [x] 8.5 Run `pnpm test` in `services/web` — all tests must pass

## 9. Integration and verification

- [x] 9.1 Rebuild and restart all containers: `docker compose up -d --build`
- [x] 9.2 Smoke test: log in, open reader, create a fragment with a note, open Fragment Sheet, click share → verify ShareModal opens with CSS preview
- [x] 9.3 Test all 6 formats: confirm aspect ratio changes in the preview for post (1:1) and story (9:16) options
- [x] 9.4 Test all 5 fonts: confirm font changes are visible in the CSS preview
- [x] 9.5 Test solid background: pick a light colour, verify text becomes dark; pick a dark colour, verify text becomes white
- [x] 9.6 Test gradient background: enable degradado, pick two colours, verify gradient renders in the preview
- [x] 9.7 Test caption: open fragment with a note, check "Usar como comentario", verify note text is displayed
- [x] 9.8 Click "Descargar": verify spinner appears, PNG downloads, dimensions match selected format
- [x] 9.9 Click "Copiar enlace": verify URL is copied and "¡Copiado!" appears briefly
- [x] 9.10 Commit and push — message: `feat: share card builder with live CSS preview, font and background customisation`
