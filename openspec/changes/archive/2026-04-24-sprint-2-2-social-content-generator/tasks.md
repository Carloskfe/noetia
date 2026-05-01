## 1. image-gen — Dependencies & MinIO Client

- [x] 1.1 Add `minio==7.2.7` to `services/image-gen/requirements.txt`
- [x] 1.2 Create `services/image-gen/storage.py` — `MinioClient` wrapper that reads `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` from env, exposes `upload(bucket, object_name, data: bytes) -> str` (uploads PNG, returns 7-day pre-signed URL); bucket defaults to `"images"`

## 2. image-gen — Quote Card Templates

- [x] 2.1 Implement `services/image-gen/templates/linkedin.py` — `render(fragment: dict) -> bytes`: 1200×627 px, dark navy background (`#0D1B2A`), wrapped white quote text (centered, max ~60 chars/line), gold horizontal rule, attribution line (`author · title`), bottom-right "Noetia" watermark
- [x] 2.2 Implement `services/image-gen/templates/instagram.py` — `render(fragment: dict) -> bytes`: 1080×1080 px, same design system as LinkedIn
- [x] 2.3 Implement `services/image-gen/templates/facebook.py` — `render(fragment: dict) -> bytes`: 1200×630 px, same design system
- [x] 2.4 Implement `services/image-gen/templates/whatsapp.py` — `render(fragment: dict) -> bytes`: 800×800 px, same design system

## 3. image-gen — POST /generate Endpoint

- [x] 3.1 Update `services/image-gen/app.py`: add `POST /generate` route — validate required fields (`text`, `author`, `title`, `platform`); dispatch to correct template by platform name; call `MinioClient.upload`; return `{ "url": "<pre-signed-url>" }` 200; return 400 for missing fields or unknown platform; return 500 on MinIO error

## 4. image-gen — Unit Tests

- [x] 4.1 Create `services/image-gen/tests/unit/templates/test_linkedin.py` — mock Pillow draw calls; assert correct image size, that `ImageDraw.text` was called with quote text and attribution, no real file I/O
- [x] 4.2 Create `services/image-gen/tests/unit/templates/test_instagram.py` — same pattern, assert 1080×1080
- [x] 4.3 Create `services/image-gen/tests/unit/templates/test_facebook.py` — same pattern, assert 1200×630
- [x] 4.4 Create `services/image-gen/tests/unit/templates/test_whatsapp.py` — same pattern, assert 800×800
- [x] 4.5 Create `services/image-gen/tests/unit/test_app.py` — mock `storage.MinioClient.upload`; test `/generate` happy path returns 200 + url; test unknown platform → 400; test missing field → 400
- [x] 4.6 Create `services/image-gen/tests/unit/test_storage.py` — mock `minio.Minio`; assert `upload` calls `put_object` and `presigned_get_object` with correct args
- [x] 4.7 Run `pytest --cov=. --cov-report=term-missing` in `services/image-gen` — all tests pass; coverage ≥ 80%

## 5. API — SharingModule

- [x] 5.1 Create `services/api/src/sharing/sharing.service.ts` — inject `HttpService`; method `generateShareUrl(fragment: Fragment, book: Book, platform: string): Promise<string>` — POST to `${IMAGE_GEN_URL}/generate` with `{ text, author: book.author, title: book.title, platform }`; return URL string; throw `BadGatewayException` on non-200
- [x] 5.2 Create `services/api/src/sharing/sharing.controller.ts` — `POST /fragments/:id/share`, `JwtAuthGuard`; look up fragment (404 if missing); load book; call `SharingService.generateShareUrl`; return `{ url }` 200
- [x] 5.3 Create `services/api/src/sharing/sharing.module.ts` — imports `HttpModule`, `TypeOrmModule.forFeature([Fragment, Book])`; registers `SharingService` and `SharingController`
- [x] 5.4 Import `SharingModule` in `src/app.module.ts`

## 6. API — Unit Tests

- [x] 6.1 Create `services/api/tests/unit/sharing/sharing.service.spec.ts` — mock `HttpService`; test happy path returns URL; test non-200 from image-gen throws `BadGatewayException`
- [x] 6.2 Run `npm run test` in `services/api` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 7. Web — SharePicker Component

- [x] 7.1 Create `services/web/components/SharePicker.tsx` — props: `fragmentId: string`, `onClose: () => void`, `onSuccess: (url: string) => void`; renders four platform buttons (LinkedIn, Instagram, Facebook, WhatsApp); on click calls `POST /fragments/:id/share` with platform; shows loading state; on error shows "No se pudo generar la imagen"; on success calls `onSuccess(url)`

## 8. Web — SharePreviewModal Component

- [x] 8.1 Create `services/web/components/SharePreviewModal.tsx` — props: `url: string`, `onClose: () => void`; renders `<img src={url} />`, "Descargar" button (anchor with `download` attr), "Copiar enlace" button (writes to clipboard, label changes to "¡Copiado!" for 2 s)

## 9. Web — Fragment Sheet Integration

- [x] 9.1 Update `services/web/components/FragmentSheet.tsx` — add share icon button to each fragment card; manage `sharingFragmentId: string | null` and `shareUrl: string | null` state; render `<SharePicker>` when `sharingFragmentId` is set; render `<SharePreviewModal>` when `shareUrl` is set

## 10. Web — Unit Tests

- [x] 10.1 Create `services/web/tests/unit/components/SharePicker.spec.ts` — mock `fetch`; test platform button renders; test successful call invokes `onSuccess` with URL; test error shows message
- [x] 10.2 Create `services/web/tests/unit/components/SharePreviewModal.spec.ts` — test image src equals URL; test copy button changes label to "¡Copiado!"
- [x] 10.3 Run `npm run test` in `services/web` — all tests pass; run `npm run test:cov` — coverage ≥ 80%

## 11. Verification

- [x] 11.1 Rebuild image-gen container: `docker compose build image-gen && docker compose up -d image-gen`
- [x] 11.2 `curl -s -X POST http://localhost:5000/generate -H "Content-Type: application/json" -d '{"text":"Test quote","author":"Test Author","title":"Test Book","platform":"linkedin"}' | jq .` — confirm `url` field in response
- [ ] 11.3 Open the URL from 11.2 in a browser — confirm styled PNG renders correctly
- [x] 11.4 `POST /fragments/:id/share` with valid JWT and `{ "platform": "instagram" }` — confirm 200 + url
- [ ] 11.5 Open reader → Fragment Sheet → click Share on a fragment → pick a platform → confirm preview modal opens with image
- [x] 11.6 All api, web, and image-gen tests still pass
- [x] 11.7 Commit and push all changes to GitHub
