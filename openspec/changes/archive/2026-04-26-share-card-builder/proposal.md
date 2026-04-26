## Why

The current share flow forces users through two disconnected steps (platform picker → style gallery) with no preview until after generation, and offers only fixed color palettes with no personalisation. Users need to see exactly how their quote card will look — with their chosen font and background — before committing, and they need to choose the right format (post vs story) for where they're publishing.

## What Changes

- **NEW** Unified `ShareModal` component replaces `SharePicker` and `SharePreviewModal` — single panel with live CSS preview, format selection, font picker, background customiser, and caption toggle
- **NEW** Story format (1080×1920) added to image-gen for Instagram and Facebook
- **NEW** Font selection: 5 open-source TTF fonts bundled in the image-gen Docker image (Playfair Display, Lato, Merriweather, Dancing Script, Montserrat)
- **NEW** Background customisation: solid colour or gradient with user-chosen hex colours; text colour derived from background luminance automatically
- **REMOVED** Fixed 5-palette style system (classic/light/dark/warm/bold) — replaced by fully customisable font + background params
- **MODIFIED** `POST /fragments/:id/share` accepts `format`, `font`, `bgType`, `bgColors` in addition to `platform`
- **MODIFIED** `POST /generate` in image-gen accepts `format`, `font`, `bgType`, `bgColors`; drops `style`
- **MODIFIED** `FragmentSheet` passes fragment `text`, book `author`/`title`, and `note` into `ShareModal`
- **MODIFIED** `share-utils.ts` `shareFragment` signature updated with new params

## Capabilities

### New Capabilities

- `share-card-builder`: Unified share modal with live CSS preview, per-platform format selection (post/story), font picker, background customiser (solid/gradient + colour pickers), and optional caption from fragment note. Single API call on Download/Copy only.

### Modified Capabilities

- `quote-card-generation`: Add story format (1080×1920), accept `font`, `bgType`, `bgColors`, `format` params; derive text colour from background luminance; bundle 5 TTF fonts; drop fixed-palette `style` param
- `share-ui`: Replace two-component flow (SharePicker + SharePreviewModal) with single ShareModal; expose format, font, and background controls
- `fragment-sharing`: API endpoint accepts and forwards `format`, `font`, `bgType`, `bgColors` to image-gen

## Impact

- `services/image-gen/`: `app.py`, `templates/base.py`, all four platform templates, `Dockerfile` (font download), all image-gen tests
- `services/api/src/sharing/`: `sharing.service.ts`, `sharing.controller.ts`, unit tests
- `services/web/components/`: `SharePicker.tsx` (replaced), `SharePreviewModal.tsx` (replaced), new `ShareModal.tsx`, `FragmentSheet.tsx` (updated)
- `services/web/lib/share-utils.ts`: updated function signature
- `services/web/tests/`: new and updated specs for ShareModal
- No database schema changes
- No auth, subscription, reader, or library changes
