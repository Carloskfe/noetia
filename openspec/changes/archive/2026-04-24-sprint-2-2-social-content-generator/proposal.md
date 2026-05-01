## Why

Fragments exist but have no outlet — users can save highlights yet cannot turn them into anything shareable. The Social Content Generator closes the loop by converting any saved fragment into a branded visual quote card, making sharing the natural next action after reading and activating Noetia's core growth mechanic.

## What Changes

- Implement the four platform-specific quote card templates in `image-gen` (LinkedIn, Instagram, Facebook, WhatsApp) using Pillow: styled background, wrapped quote text, author + book title attribution, Noetia watermark.
- Add a `POST /generate` endpoint to the image-gen Flask service that accepts `{ text, author, title, platform }`, renders the card, uploads the PNG to MinIO (`images/` bucket), and returns a pre-signed URL.
- Add `POST /fragments/:id/share` to the NestJS API: looks up the fragment + book metadata, calls image-gen, and returns the pre-signed URL.
- Add a **Share** button to each card in the Fragment Sheet drawer: clicking opens a platform picker (LinkedIn / Instagram / Facebook / WhatsApp); selecting a platform triggers generation, then shows a preview modal with download and copy-link actions.

## Capabilities

### New Capabilities

- `quote-card-generation`: image-gen renders platform-sized, styled PNGs from fragment data and stores them in MinIO.
- `fragment-sharing`: NestJS `/fragments/:id/share` endpoint orchestrates image-gen + MinIO and returns a usable URL.
- `share-ui`: Fragment Sheet share button, platform picker, and preview modal in the web reader.

### Modified Capabilities

## Impact

- **image-gen**: `app.py` (new `/generate` route), all four `templates/*.py` (implement real rendering), `requirements.txt` (add `minio` client and `boto3` as fallback).
- **api**: new `src/sharing/` module — `sharing.service.ts`, `sharing.controller.ts`, `sharing.module.ts`; `FragmentsModule` imports `SharingModule`.
- **web**: `components/FragmentSheet.tsx` updated; new `components/SharePicker.tsx` and `components/SharePreviewModal.tsx`.
- **MinIO**: uses existing `images/` bucket (already provisioned).
- **Docker networking**: image-gen must be reachable from the api container via `http://image-gen:5000`.
