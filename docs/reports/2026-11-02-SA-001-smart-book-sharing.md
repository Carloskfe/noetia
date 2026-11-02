# SA-001: Smart Book Sharing. Architecture review and technical specification

> **Documentation only.** This report records an architecture assessment. It does not authorize implementation. No application code, migration, Stripe, entitlement or production change was made. Platform-policy and copyright conclusions are internal risk assessments, not legal certification.

**Labels used throughout**

| Label | Meaning |
|---|---|
| **[V]** | Verified repository fact, at `origin/main` `6a5e5c0`, with a file reference |
| **[PO]** | Product Owner-approved requirement (SA-001 mission brief, 2026-11-02) |
| **[A]** | Assumption, not verified |
| **[R]** | Technical recommendation from this report, not approved |
| **[D]** | Decision pending with the Product Owner |
| **[X-V] / [X-S]** | External fact: read on the official page / from secondary or partial sources |

---

## 1. Mission and objective

SA-001 is an approved PO decision: **Smart Book Sharing, Option C: a smart link to the specific book.** This mission:
- inspects the repository
- assesses the architecture
- specifies the technical requirements
- publishes this report through a documentation-only Draft PR

It does **not** implement the feature.

## 2. Date and status

- **Date:** 2026-11-02
- **Status:** complete, awaiting PO review
- **Baseline:** `origin/main` at `6a5e5c0`
- **Report branch:** `docs/sa-001-smart-book-sharing`, Draft PR [#24](https://github.com/Carloskfe/noetia/pull/24), stacked on PR #23's branch (see §11)

## 3. Scope and exclusions

**In scope:**
- quotations, selections and reflections
- quote-card generation, backgrounds, typography and watermark
- export and external sharing
- book pages, book identifiers and URLs
- authentication and entitlements
- mobile deep linking
- public web pages and metadata
- privacy, copyright and security
- analytics

**Excluded by the PO [PO]:**
- an internal feed
- followers
- likes or reactions
- comment threads
- collaborative public editing
- reputation scores
- internal social recommendation algorithms
- a separate quotation landing page as the primary destination

No section of this report proposes any of these.

## 4. Executive summary

1. **The image-creation side of SA-001 largely exists and should be reused unchanged [V].**
   - The web `ShareModal` and the `image-gen` service already cover:
     - 8 platform formats
     - 18 nature and atmosphere background presets plus user uploads
     - font, bold, italic, alignment and S/M/L text size
     - automatic contrast
     - attribution (author · title, optional citation)
     - a subtle Noetia logo watermark
     - a permanent public PNG
   - No redesign is needed.
2. **The link side does not match Option C [V].**
   - Today a share link (`/s/<id>`) opens a **standalone quotation landing page**, the pattern SA-001 excludes as the primary destination.
   - Its "Read this book" button goes to the **reader**, which sends logged-out visitors to `/login`.
   - **Noetia has no public book page at all.** Books open only in the reader, and the book API (`GET /books/:id`) requires sign-in and a subscription.
3. **Native app links do not exist [V].**
   - The mobile app declares only the custom scheme `noetia://`.
   - It has no iOS associated domains, no Android App Links intent filters and no React Navigation `linking` config.
   - The web serves no `apple-app-site-association` or `assetlinks.json`.
   - Opening a shared link "in the app" requires a native build and store release, not an OTA update.
4. **Defects need fixing first, whatever the SA-001 design (§8):**
   - **Missing ownership check.** `POST /fragments/:id/share` lets any signed-in user publish any other user's fragment, given its UUID.
   - **Shares survive deletion.** Shares are never deleted when the fragment or the account is deleted.
   - **Mobile regression.** "Open image" on mobile opens the invite page, not the image, since 2026-07-19.
   - **Duplicate shares.** Every Download, Copy or Publish click creates a new image and a new share record.
5. **Recommended architecture [R]:**
   - Keep the existing short URL `https://noetia.app/s/<slug>`: it's durable, unguessable and already in circulation.
   - Make it render a new **public book page**, with a small "Compartido desde Noetia" section showing the shared quote or authorized reflection.
   - Serve the same page at a canonical `/books/<id>` URL.
   - Provide it through a new **public, metadata-only** book endpoint that never returns text or audio URLs.
   - Add universal links and App Links in a later, native-release phase.
6. **Estimate [R, A]:** about **17–26 engineer-days** over five phases, plus app-store review time for the native phase. Details in §10.

---

## 5. Verified findings

### 5.1 SA-001 approved product requirements [PO]

| # | Requirement |
|---|---|
| P1 | The link opens the **specific book** inside Noetia; the book stays the primary destination. |
| P2 | A **small, non-intrusive highlighted section**, integrated in the book page, shows the quote or reader reflection that motivated the visit, when authorized. No modal, popup, full-screen view or separate quote page. |
| P3 | The visitor can explore the book and read or listen **according to entitlements**. |
| P4 | Channels: LinkedIn, Facebook, Instagram, WhatsApp and other compatible destinations, as a standalone image, a linked image, or an image with a link, as each platform allows. |
| P5 | SA-001 is a foundational **Noetia** capability, available without Noetia+ or NoetiaX. Noetia+ and NoetiaX reuse the same sharing infrastructure. "Basic" is never used as a customer-facing name. |
| P6 | Preserve existing functionality and approved design decisions. Don't redesign the quote-card generator unless a compatibility issue requires it; report any such issue. |
| P7 | No social-network infrastructure (§3 exclusions). |

### 5.2 Existing functionality inventory [V]

| Area | What exists | Reference |
|---|---|---|
| Quotations and selections | `fragments` rows: `text`, `startPhraseIndex`/`endPhraseIndex`, `note`, `themes`. Owner checks on update, delete and combine. | `services/api/src/fragments/fragment.entity.ts`; `fragments.service.ts:53,60,72` |
| Reader reflections | Only `fragment.note`, private to the owner. In `ShareModal` it can be attached as the **post caption** when the user ticks "use as caption". It's never stored in the share record or shown on the invite page. | `ShareModal.tsx:264,782-797` |
| Quote-card generation | `POST /fragments/:id/share` → `image-gen` `/generate` → PNG uploaded to the public `images/` bucket under a random UUID name, with a **permanent** public URL | `sharing.controller.ts:30-81`; `sharing.service.ts:59-110`; `image-gen/storage.py:29-40` |
| Formats | ig-post 1:1, ig-story and reel 9:16, fb-post 1.91:1, fb-story 9:16, li-post 1.91:1, pin-post 2:3, pin-square 1:1 | `ShareModal.tsx` `FORMAT_ASPECT`; `image-gen/templates/*.py` |
| Backgrounds | 18 preset images (`/backgrounds/imagen-N.jpg`), user upload (sent as base64), solid and gradient colours, flip, cover/contain fit | `services/web/lib/share-utils.ts:31+`; `base.py:106-206` |
| Typography and contrast | Font choice, faux bold and italic, alignment, S/M/L text scale. WCAG-style relative luminance picks the text colour; the web forwards the resolved colour so the preview matches the output. | `base.py:61-86,208+`; `share-utils.ts` `getTextColor` |
| Attribution | Author · title is always rendered; optional citation (chapter or verse) | `base.py:313-315`; `ShareModal.tsx:127-135,440-456` |
| Watermark | Noetia logo bottom-right at 3.9% of card width, 90% opacity, light or dark variant chosen from the text colour. Text fallback if the asset is missing. | `base.py:31-58,249-288` |
| Export | **PNG only**: Download (`noetia-<format>.png`) and Copy link | `ShareModal.tsx:293-319` |
| External sharing (web) | OAuth connect and API publish to LinkedIn, Facebook, Instagram (behind `INSTAGRAM_PUBLISH_ENABLED`) and Pinterest. The image is posted **without a link**; the optional caption is the private note. | `social.controller.ts:143-180`; `publishers/*.ts` |
| External sharing (mobile) | `ShareSheet` generates a card, then `Share.share({ url, message: fragmentText })` and "Open image". No WhatsApp entry. | `services/mobile/src/components/ShareSheet.tsx:10-15,69,78-81,202` |
| Share record | `shares` table (migration 065): 10-character random slug, `bookId`, `fragmentId`, a snapshot of quote, author, title, citation and imageUrl, platform, `createdById`, `visitCount`. **No foreign keys.** | `share.entity.ts`; `1748300000065-CreateShares.ts:6-19` |
| Public share page | `/s/[id]`: SSR, OG and Twitter metadata built from the card, ES/EN chosen by `Accept-Language`, card image plus quote, "Read «title» on Noetia" → `/reader/<bookId>`, "Discover Noetia" → `/` | `services/web/app/s/[id]/page.tsx:24-136` |
| Book pages | **None.** The only routes are `/reader/[id]` and `/discover` (with collections). Book tiles link to `/reader/<id>`. | `services/web/app` route list; `BookGrid.tsx:39` |
| Book identifiers | UUID `books.id`; no slug field. The entity has `description`, `coverUrl`, `language`, `category`, `collection`, `isFree`, `priceCents`. | `books/book.entity.ts` |
| Public book data | `GET /books` (list, search, filters) is public and cacheable. `GET /books/:id` needs `JwtAuthGuard` and `SubscriptionGuard` and returns **presigned text and audio URLs**. | `books.controller.ts:65-87,97-115` |
| Reader entry when logged out | Redirects to `/login?next=/reader/<id>` | `reader/[id]/page.tsx:158-163` |
| Phrase deep link | None. The reader reads no query parameter; it resumes saved progress. | `reader/[id]/page.tsx` |
| Indexing | `robots.ts` disallows `/discover` and `/reader/`. `/s/` is crawlable by default and isn't in the sitemap. | `services/web/app/robots.ts:10-24`; `sitemap.ts` |
| Mobile links | `scheme: 'noetia'` only. No `associatedDomains`, no `intentFilters`; `NavigationContainer` has no `linking` prop. | `services/mobile/app.config.js:69`; `services/mobile/src/index.tsx:11` |
| Product names | "Noetia+" and "NoetiaX" don't appear in the web i18n or the PRD. No customer-facing "Basic" or "Básico" was found in `services/web/lib/i18n/{en,es}.ts` or `docs/PRD.md`. | grep at `6a5e5c0` |
| Analytics | The `fragment_shared` event (platform, format, themes); `books.shareCount` +1 per share call; `shares.visitCount` +1 per `/s/` server render | `sharing.controller.ts:69-77`; `sharing.service.ts:118` |

### 5.3 Gaps between the current implementation and SA-001

| # | Gap | Type | SA-001 req. |
|---|---|---|---|
| G1 | No public book page. The share destination is a separate quote page (`/s/`), and its CTA leads to the reader, which requires login. | [V] | P1, P2 |
| G2 | No public, metadata-only single-book endpoint. `GET /books/:id` is guarded and returns content URLs, so a public page can't reuse it safely. | [V] | P1, P3 |
| G3 | Visitors without the book have no clear acquisition route. The reader fails behind `SubscriptionGuard`. Acquisition is being redesigned (PO-021…023, PR #12; bypass fix PR #11, unmerged). | [V] + [D] | P3 |
| G4 | No universal links or App Links. Shared links always open the web, even with the app installed. | [V] | P1 |
| G5 | A reflection can't be the shared context. Notes are only post captions and aren't in the share snapshot. No consent or withdrawal model. | [V] | P2 |
| G6 | No "share with link" on most channels: API publishing posts the image without a link; there's no Web Share API or WhatsApp; Android drops the `url` field (§5.5). | [V] + [X-S] | P4 |
| G7 | PNG only. Instagram's publishing API accepts **JPEG only**, and the publisher sends a `data:` URI, which the API doesn't accept; it needs a public URL. Behind a flag, so dormant. | [V] + [X-V] | P4, P6 (compatibility issue) |
| G8 | Each Download, Copy or Publish click creates a new image and share. The same card produces several links, inflating `shareCount` and storage. | [V] | analytics, P6 |
| G9 | Shared context can't be withdrawn. No revoke, and no clean-up on fragment or account deletion. | [V] | P2 (deleted or withdrawn context) |
| G10 | Mobile "Open image" opens the invite page, and the mobile share message omits the link on Android. | [V] + [X-S] | P4, P6 (regression) |
| G11 | `visitCount` also counts link-preview crawlers (WhatsApp, Facebook, LinkedIn) and prefetches. It isn't a human-visit metric. | [V] + [A] | analytics |

### 5.4 Recommended smart-link architecture [R]

**URL shape**
- **Shared URL (unchanged):** `https://noetia.app/s/<slug>`
  - The slug is 10 characters from a 62-character alphabet, generated with `crypto.randomBytes` (about 59 bits). It's already unguessable [V `sharing.service.ts:12-18`].
  - Keep it: existing links stay valid, and it's short enough for captions.
- **Canonical book URL (new):** `https://noetia.app/books/<bookId>`
  - It uses the UUID now.
  - A readable slug, such as `/books/<uuid>/<title-slug>`, is optional [D].
- **Optional campaign attribution:** standard `utm_source`, `utm_medium` and `utm_campaign` parameters appended to the shared URL, chosen per channel when the link is generated.
  - The platform is already stored on the share, so attribution needs no tracking identifiers about the visitor.

**Routing**
1. `/s/<slug>` server-renders **the book page itself**, a shared component, with the highlighted section.
   - It sets `<link rel="canonical" href="/books/<bookId>">`.
   - `robots: noindex` keeps search engines from indexing individual shares [R, D].
   - It uses the **card image** as `og:image` with `og:image:width` and `og:image:height` [X-V Facebook webmasters]. The card is what the sharer chose, and it's what the preview shows on LinkedIn, Facebook and WhatsApp.
2. `/books/<bookId>` renders the same page without the highlighted section. It's indexable only if the PO wants SEO for books [D]; today `robots.ts` blocks `/discover` and `/reader/`.
3. Rendering directly instead of redirecting keeps a single hop. In-app browsers (Instagram, Facebook, LinkedIn) and preview crawlers then get the right OG tags at the URL that was shared [R].

**Data**
- New **public** endpoint, `GET /books/:id/public`. It returns only:
  - id, title, author, description, coverUrl, language, category, collection
  - `isFree`
  - whether audio exists
  - narrator, when available
- It **never** returns `textFileUrl`, `audioFileUrl`, `audioStreamUrl` or sync maps.
- It 404s for unpublished books, and for books hidden by the quality gate [feedback: only offer standard books].
- `GET /shares/:id` (existing) grows into the share-context payload:
  - `kind`: `quote` | `reflection`
  - the quote snapshot
  - an optional reflection, only when consented
  - `revoked`, so the page can show a neutral state
  - book id

**Behaviour by visitor**

| Visitor | Behaviour |
|---|---|
| Existing user, entitled | Web page shows the book and the highlighted section. Primary CTA: "Read" or "Listen" → `/reader/<id>`. With app links (phase 4) the app opens straight to the book. Optional phrase jump [D]. |
| Existing user, not entitled | Same page and section. CTA: the acquisition route defined by PO-021…023 (token redemption, subscription or purchase). No text or audio is exposed. |
| Visitor without account or app | Mobile-first public page: cover, title, author, description, highlighted section. CTAs: "Start reading on Noetia" → register with `next=/books/<id>?s=<slug>`; "Discover Noetia". No registration needed to view public metadata. |
| Share deleted or revoked | Book page renders normally and the highlighted section is omitted. If the book itself is unavailable: "This book is no longer available" plus Discover. Never a 404 dead end. |

**Mobile app links (phase 4)**
- Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from `web`. Android requires `https://<host>/.well-known/assetlinks.json` [X-V].
- Add iOS `associatedDomains: ['applinks:noetia.app']` [X-S; the Apple page didn't load for this audit].
- Add Android `intentFilters` with `autoVerify: true`, `VIEW`, `BROWSABLE` and `DEFAULT`, and `https` for `noetia.app` with paths `/s/*` and `/books/*` [X-V].
- Add a React Navigation `linking` config that maps both paths to a book screen.
- Native change: needs `eas build` and store submission, not OTA [V CLAUDE.md § Mobile OTA].
- Android 15+ verification can take up to 7 days to propagate [X-V].
- Universal links often **don't** fire inside social in-app browsers [X-S], so the web page must be fully functional on its own. It's the primary destination, not a fallback.
- Interaction: per PR #12, the mobile app is entirely behind a subscription paywall [V-PR #12, not re-verified]. App links would land non-subscribers on the paywall unless that's resolved [D].

### 5.5 Book-page highlighted section specification [R; exact copy and visuals pending UI review]

- **Placement.** Inline in the book page, below the title and author block and above the description, in normal page flow. It's not sticky, not an overlay, has no dismissal requirement and never blocks scrolling or CTAs.
- **Size.** At most about 25% of the first mobile viewport. Long quotes are clamped to 4 lines with "Show more" expanding inline. Desktop: a max width matching the description column.
- **Content:**
  - label: **"Compartido desde Noetia"** (ES) / **"Shared from Noetia"** (EN)
  - the text in quotation marks for a book quote, with author · title and the optional citation
  - for a reflection: a different style, such as an italic body without quote marks, labelled **"Reflexión de un lector"** / **"A reader's reflection"**, with the referenced quote, if any, shown smaller beneath
  - no sharer identity by default [D]
- **Card image.** Not repeated in the section; the text is enough. The image stays as `og:image`. A small thumbnail is optional [D].
- **States.** Normal; reflection; revoked or deleted (section omitted, no error); book unavailable (neutral message plus Discover).
- **Accessibility.** Real text, not an image, so it's selectable and screen-reader friendly. Contrast ≥ 4.5:1. `aria-label` describing the shared-context region.
- **i18n.** Copy in all four i18n files, or web-only keys if the section is web-only [CLAUDE.md § Voice & Style]: "tú" form, sentence case, "Noetia" by name.

### 5.6 External-platform sharing compatibility matrix

Access date for all external sources: 2026-11-02.

| Channel | Standalone image | Link with OG preview | Image + clickable link in same post | API publishing from Noetia | Noetia today [V] | Recommendation [R] |
|---|---|---|---|---|---|---|
| **LinkedIn** | Yes | Yes, from `og:*` [X-S] | Image post with the URL in the commentary; the text link is clickable [X-S] | `ugcPosts` is marked **Legacy**: "The Posts API replaces the `ugcPosts` API" [X-V] | API image post, no link (`linkedin.publisher.ts:54-67`) | Migrate to the Posts API (separate task); put the share URL in the commentary; offer "share link" through the LinkedIn share URL |
| **Facebook** | Yes | Yes, from `og:*`; images cached by URL [X-V] | Photo post with the link in the caption [X-S] | Graph API posts only to **Pages** the user manages; personal-profile posting isn't available to apps [X-S] | Publishes to the user's **first managed Page** (`facebook.publisher.ts:10,26`); users without a Page can't publish | Default to link sharing (sharer dialog or native share), so the OG card shows; keep Page publishing as an option |
| **Instagram** | Yes (feed, story) | No link previews; feed-caption links aren't clickable [X-S]; Stories link sticker is manual [X-S] | No (feed). Stories: manual link sticker. | Professional accounts only; **JPEG only**; public `image_url`; 100 posts per 24h (page also says 50 for carousels) [X-V] | Publisher sends a PNG `data:` URI (`instagram.publisher.ts:21-30`), which is incompatible; flag-gated off | Image-first: download or native share of a 9:16 or 1:1 card; "link in bio" or Stories sticker guidance; fix JPEG and public URL before enabling the API |
| **WhatsApp** | Yes, by native share | Yes, from `og:*` [X-S] | Image + caption through the native share sheet; the caption URL is clickable [X-S] | No publishing API for personal chats; `wa.me/?text=` prefilled-text links [X-S; official page didn't load] | Not offered on web or mobile | Add a WhatsApp button (`wa.me/?text=<quote> <url>`) and native share; make sure `og:image` is a reasonably small JPEG [A] |
| **Pinterest** | Yes | Pin `link` field | Yes (the pin links out) | v5 `pins` supports a destination link [X-S] | Pins without `link` (`pinterest.publisher.ts:20-30`) | Set `link` to the share URL |
| **Native share (web)** | `navigator.share({ files })` where `canShare` allows; HTTPS and user gesture required; "limited availability" [X-V] | `navigator.share({ url, text })` | Files + text + URL, platform-dependent | — | Not used | Primary mobile-web action, with feature detection and a fallback to Download plus Copy |
| **Native share (RN app)** | `Share.share` doesn't share files [X-V]; needs a file-sharing module [A] | `url` reads as iOS-only; Android uses `message` [X-V, ambiguous badge] | Put the URL inside `message` | — | `Share.share({ url: <invite page>, message: quote })`, so Android omits the link (`ShareSheet.tsx:80`) | Include the URL in `message`; add image-file sharing |
| **Download / copy** | Yes (PNG) | Copy link | Manual | — | Yes | Keep; add JPEG export for Instagram and WhatsApp size [R] |

**What a shared image can't do [X-S, PO brief].** A PNG or JPEG can't carry a universally clickable link. A link is clickable only when:
- it's a separate URL in the post or message text
- it's a link preview generated from OG tags
- the platform has a link field, such as the Pinterest pin link or an Instagram Stories sticker

The card should keep the visible attribution and logo. A printed `noetia.app` text mark is optional [D].

### 5.7 Privacy, copyright and security considerations

| # | Issue | Fact or assessment | Safeguard [R] |
|---|---|---|---|
| S1 | **Missing ownership check.** `sharing.controller.ts:52` loads the fragment by id with no `userId` check. Any signed-in user who knows a fragment UUID can render and **publish another user's fragment** as a public share. | [V]; UUIDs are hard to guess, but they reach the client in API responses [A] | Require `fragment.userId === req.user.id`, as `fragments.service.ts:53` does |
| S2 | **Arbitrary text.** `text` (`textOverride`) is accepted unvalidated and attributed to the book's author and title on the card and the public page | [V] `sharing.controller.ts:40`, `sharing.service.ts:65,99` | Length cap. Edited text either stays close to the original, or the card and page are labelled "edited by reader" [D]. Rate-limit share creation. |
| S3 | **Deletion doesn't remove shares.** No foreign keys; snapshots and public images remain after fragment or account deletion | [V] migration 065 | Revoke on fragment delete. Delete shares and their images on account deletion, consistent with the Privacy Policy's deletion statements (see NOF-004 report). Add a user-facing "withdraw share". |
| S4 | **Reflections.** Notes are private; the only current exposure is an explicit, per-publish caption checkbox | [V] `ShareModal.tsx:782-797` | A reflection appears on the book page only with explicit per-share consent, stored with the share, and is withdrawable. Never default-on, never inferred from the caption setting. |
| S5 | **Restricted content.** Public pages must expose metadata and the user-chosen quote only | [V] the guarded endpoint returns presigned URLs | Separate public endpoint (§5.4). Tests asserting that no text or audio URL appears in public responses. |
| S6 | **Quotation licensing.** Free-library books are public domain [V CLAUDE.md]. Author and publisher titles are under copyright [A]. | Internal assessment: short quotations with attribution are commonly treated as permissible, but this varies by jurisdiction and contract; it's **not** certified | Per-book quote limit (characters or phrases) and a publisher opt-out flag for author catalogue titles [D]; author upload terms to cover quote sharing [D] |
| S7 | **Identifier guessing.** Slug ~59 bits, random; shares can't be enumerated through the API | [V] | Keep. Don't expose `createdById` publicly (not exposed today [V]). |
| S8 | **Abuse and spam.** Unlimited share creation; public images are permanent | [V] | Per-user rate limit; reuse one share per identical card (fixes G8); admin revoke |
| S9 | **Indexing.** `/s/` is crawlable and indexable by default | [V] robots | `noindex` on `/s/*`; book pages indexable only by PO decision |
| S10 | **Analytics privacy.** | [R] | Aggregate counts only; no third-party pixels on share pages; no storing visitor IP or user agent beyond existing logs; update the Privacy and Cookie policies if new tracking is added (legal-gated, see NOF-004) |
| S11 | **Link expiry.** Permanent links favour durability; withdrawal is handled by revoke, not expiry | [R] | Permanent by default; revoke supported [D] |

### 5.8 Analytics opportunities and limitations

**Can be measured reliably [R]:**
- **Card created:** `fragment_shared` exists; add a card id.
- **Image exported:** new client event, Download.
- **Share link generated:** `shares` row; deduplicated, see G8.
- **Share link opened:** server render of `/s/<slug>`, **excluding** known preview crawlers by user agent.
- **Book-page visit from a share:** the `s` parameter or slug.
- **Registration from a share:** carry the slug through `next` and record it on the user at sign-up.
- **Book added or opened from a share.**
- **Subscription conversion from a share:** only by passing the slug into Checkout metadata. That's a **Stripe change**, so it's out of scope now [D].

**Measured only approximately:**
- **Opens by channel.** Uses the stored `platform` plus `utm_*` parameters; users may paste the link anywhere.
- **Crawler versus human opens.** User-agent filtering is heuristic.

**Can't be measured [PO, X-S]:**
- how often a downloaded image is forwarded or reposted
- impressions and reach on external platforms, except a few platform-insights APIs for API-published posts
- views of an image that carries no link
- WhatsApp forwarding

## 6. External references

Accessed 2026-11-02.

| Source | URL | Result |
|---|---|---|
| Instagram Platform: Content publishing | https://developers.facebook.com/docs/instagram-platform/content-publishing/ | [X-V]: JPEG only; public URL fetched by Meta; professional account; 100 posts per 24h (50 for carousels, as stated on the page) |
| React Native: Share | https://reactnative.dev/docs/share | [X-V] partial: `url` and `message`, at least one required; no files; the iOS/Android badge placement is ambiguous in extracted text |
| MDN: Navigator.share() | https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share | [X-V]: files supported where `canShare`; HTTPS; transient activation; limited availability |
| Apple: Supporting associated domains | https://developer.apple.com/documentation/xcode/supporting-associated-domains | **Didn't load** (title only). AASA details are [X-S]. |
| Android: Verify App Links | https://developer.android.com/training/app-links/verify-android-applinks | [X-V]: `/.well-known/assetlinks.json`; `autoVerify`; VIEW, BROWSABLE, DEFAULT; Android 15+ propagation up to 7 days |
| LinkedIn: UGC Post API (Legacy) | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api | [X-V]: page titled "Legacy"; the Posts API replaces `ugcPosts` |
| WhatsApp: How to use click to chat | https://faq.whatsapp.com/5913398998672934 | **Didn't load** (title only). The `wa.me/?text=` format is [X-S]. |
| Facebook: Sharing for webmasters | https://developers.facebook.com/docs/sharing/webmasters/ | [X-V]: `og:url/title/description/image`, `og:type`; specify image width and height; cached by URL; Sharing Debugger |

## 7. Risks

| Level | Risk |
|---|---|
| **Critical** | None that blocks SA-001 design work. |
| **High** | S1: cross-user fragment publishing (privacy). S3: shares and images survive deletion (privacy-policy conflict). G3: no acquisition route on the public page until PO-021…023 and PR #11 are settled. S6: quotation limits for copyrighted author titles undefined. |
| **Medium** | G10: mobile regression ("Open image" opens a page; Android drops the link). G7: dormant Instagram publisher incompatible with the API. G8: duplicate shares distort metrics. S2: arbitrary text attributed to authors. LinkedIn `ugcPosts` legacy status. App links blocked by the mobile paywall model. |
| **Low** | G11: crawler-inflated `visitCount`. S9: indexing of `/s/`. Facebook Page-only publishing (users fall back to link sharing). Android App Links propagation delay. |

## 8. Recommendations

**Required before or as part of SA-001 [R]**
1. Ownership check on `POST /fragments/:id/share` (S1).
2. Share lifecycle: revoke on fragment delete; delete on account deletion; user withdrawal (S3, G9).
3. Fix the mobile `ShareSheet` (G10): it treats `res.url` as the image, and the Android message omits the URL.
4. Public metadata-only book endpoint and public book page (G1, G2, S5).
5. `/s/<slug>` renders the book page with the highlighted section, canonical, `noindex` and OG from the card (§5.4).
6. Reuse one share per card instead of one per click (G8).
7. Validate and cap `text` and label edits (S2), plus a rate limit (S8).
8. Explicit consent model for reflections before any reflection is shown publicly (S4).

**Optional improvements [R]**
- Web Share API, WhatsApp button, link in the LinkedIn commentary and Pinterest `link` (G6).
- JPEG export; fix the Instagram publisher before enabling it (G7).
- LinkedIn Posts API migration.
- Universal links and App Links (G4).
- Readable book slugs; phrase deep link into the reader.
- Crawler-filtered open metric; share-attributed registration.

**Quote-card generator:** no redesign recommended. Two compatibility issues for PO review: PNG-only output (G7) and the absence of a link mark on the card [D].

## 9. Tests and verification performed

- Read-only inspection of `origin/main` `6a5e5c0` through `git show` and `git grep`. Every [V] reference was read at that commit.
- Official documentation fetched for 8 sources. Apple and WhatsApp pages returned no body and weren't retried; those points are marked [X-S].
- No code executed, no tests run, no database, staging or production access, no Stripe access.
- Limitations:
  - The mobile paywall behaviour is cited from PR #12, not re-verified.
  - The platform UX claims marked [X-S] (clickable caption links, in-app-browser universal-link behaviour, Facebook personal-profile API limits) weren't verified on official pages in this mission.
  - Effort estimates are judgement.

## 10. Open questions and PO decisions

**Effort estimate [R, A]: one engineer, includes unit tests per CLAUDE.md**

| Phase | Content | Estimate |
|---|---|---|
| 1. Integrity fixes | S1, S3/G9 (revoke, cascade, deletion), G10, G8, S2/S8 | 3–4 days (may include one migration, for share `revokedAt`) |
| 2. Public book page and smart link | Public endpoint; `/books/<id>`; `/s/<slug>` renders the book page; highlighted section; states; OG/canonical/noindex; i18n | 5–7 days |
| 3. Share-flow channels | Web Share API, WhatsApp, LinkedIn commentary link, Pinterest link, JPEG export, mobile share fixes | 3–4 days |
| 4. Native app links | AASA and assetlinks, app config, `linking`, book-screen routing, EAS build and store submission | 4–6 days + store review |
| 5. Reflections and analytics | Consent and withdrawal, reflection variant, events, crawler filtering, signup attribution | 2–5 days (excludes Stripe attribution) |
| **Total** | | **~17–26 days** |

**Dependencies:**
- PO-021…023 and PR #12 (acquisition model, mobile paywall)
- PR #11 (paid-book acquisition bypass, unmerged)
- NOF-004 legal work (Privacy and Cookie policy updates, if analytics or reflection publishing changes data processing)
- a NEM mission for any implementation phase [CLAUDE.md governance]
- Phase 4 needs Apple and Google developer-account access

**Decisions for the PO [D]**
1. **Canonical URL.** Approve `/s/<slug>` rendering the book page, plus `/books/<id>` as canonical? Or should `/s/` redirect?
2. **Indexing.** Should public book pages be indexable by search engines? `/s/*` stays `noindex`?
3. **Acquisition CTA.** What do non-owners and visitors see: subscription, token redemption, purchase? This depends on PO-021…023.
4. **Reflections.** Approve per-share explicit consent, withdrawable? Show the sharer's name or stay anonymous?
5. **Edited quotes.** Allow edited text on cards and the page? If so, how is it labelled, and with what limits?
6. **Copyright.** Per-book quotation limits for author and publisher titles? A publisher opt-out? Update author upload terms (legal-gated)?
7. **Link permanence.** Permanent links with user revoke, rather than expiry?
8. **Channels.** Priority order of LinkedIn, Facebook, Instagram and WhatsApp for phase 3? Add WhatsApp on web and mobile? Keep Facebook Page publishing?
9. **Card link mark.** Add a small printed `noetia.app` mark? This is the only card change considered; it needs design review.
10. **Native app links.** Schedule phase 4 now, or after the mobile paywall model is resolved?
11. **Analytics.** Approve the event list in §5.8? Pass the share slug to Stripe Checkout metadata later (a Stripe change)?
12. **Pre-existing defects.** Fix S1, S3 and G10 now under a separate bug-fix mission, ahead of SA-001?
13. **Tier naming.** Confirm "Noetia" as both the brand and the base tier name in copy, for example "Included in Noetia". None of the three tier names is in code yet.

## 11. Changes made

- **No application code, legal document, test, migration, Stripe, entitlement or production change was made.**
- Added this report: `docs/reports/2026-11-02-SA-001-smart-book-sharing.md`.
- Added one index row to `docs/reports/README.md`.
- **Protocol status:** the reporting protocol (`docs/reports/README.md` and the `CLAUDE.md` section) exists only on PR #23's branch; it **isn't installed on `main` yet**. This branch is therefore stacked on `docs/nof-004-legal-benchmark-audit`, and the Draft PR targets that branch.
  - PR #23 itself isn't modified.
  - If #23 merges first, GitHub retargets this PR to `main`.
  - If #23 is abandoned, this PR needs rebasing onto `main` with its own `docs/reports/README.md`.

## 12. Next recommended action

PO reviews this report and decides items 1–13 in §10. Implementation then needs a named NEM mission. A natural first one is "Phase 1: integrity fixes" (S1, S3, G10, G8), which is independent of the open product decisions. **No implementation until the PO authorizes it.**
