# NEM-025 B1-A: fr-CA SEO and HTML-language design note

**Design only.** No route migration was made, and **French SEO readiness is not claimed.** Any change below needs PA review and a PO decision (Checkpoint B prep, D-9).

## Current state (verified at B1-A head)

- `app/layout.tsx` renders a static `<html lang="es">` and `metadata.openGraph.locale = 'es_LA'`.
- The client `LanguageProvider` later sets `document.documentElement.lang` to `es`, `en` or `fr-CA` (Checkpoint A). Crawlers that do not run JavaScript always see `es`.
- **19 route files declare static metadata:**
  - `app/page.tsx`, the layouts for `(auth)`, `(library)` and `(clubs)`, and `(billing)/pricing/layout.tsx`;
  - the 8 corporate `page.tsx` files and `upload-guide/page.tsx`;
  - the 3 legal pages;
  - `s/[id]/page.tsx`.

  The metadata language is mixed: corporate metadata is English and pricing is Spanish.
- `/s/[id]` is the only server-rendered page that chooses its language per request (`Accept-Language`). From B1-A it returns `fr-CA` only while the French gate is on.
- There is no `hreflang`, no localized sitemap, and no per-locale URLs.

## Options

| | Option | What changes | Pros | Cons |
|---|---|---|---|---|
| A | **Locale cookie + SSR `lang`** | The provider writes a `noetia_lang` cookie. `layout.tsx` reads `cookies()` and renders `<html lang>`. `generateMetadata` picks per-locale titles and descriptions | No URL change; small; correct `lang` on first paint for returning users | Crawlers have no cookie, so they still index Spanish only; one URL per page means no `hreflang` |
| B | **Locale-prefixed routes** (`/fr-ca/...`, `/en/...`, default Spanish) with Next.js middleware | Route tree under `[locale]`, `hreflang` alternates, localized sitemap | Real per-language indexing | **Route migration**: every link, redirect, analytics path and the Traefik routes would need review. Highest risk; needs a PA design STOP (NEM-025 §5.6) |
| C | **Keep client-only** and declare no French SEO | None | Zero risk | French pages not indexed in French |

## Recommendation (for PA/PO decision)

**Option A** first: correct `lang` and metadata for users, with no URL change. Then Option B only if French organic search becomes a goal. Option C is acceptable while the French pilot stays private, which is the current policy.

## Work required for Option A (not done)

1. A cookie write in `LanguageProvider.setLanguage` and on server-preference sync. It is not a security-relevant cookie and contains only the locale.
2. `app/layout.tsx`: `lang` from the cookie, normalized with `normalizeLanguage`, which keeps fr-CA off while gated.
3. Per-locale `metadata` dictionaries for the 19 files, using `generateMetadata` (strings only).
4. Tests: SSR `lang` attribute by cookie, gate off → never `fr-CA`, and metadata parity.
