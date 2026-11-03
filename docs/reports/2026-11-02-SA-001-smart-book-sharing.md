# SA-001: Smart Book Sharing. Architecture review, approved decisions and technical specification

> **Documentation only.** This report records an architecture assessment and the Product Owner's approved SA-001 decisions. It does **not** authorize implementation, including the security corrections in §8.1. No application code, test, migration, Stripe, entitlement or production change was made. Platform-policy, privacy and copyright conclusions are internal risk assessments, not legal certification.

**Revision history**

| Rev | Date | Mission | Change |
|---|---|---|---|
| 1 | 2026-11-02 | SA-001 | Initial architecture review; 13 open questions |
| 2 | 2026-11-02 | SA-001-GOV-001 | Recorded the 13 PO-approved decisions (SA-001-D01…D13). Moved them out of the open questions. Added the staged sequence, dependencies, and new security findings S12–S15 and conflict C1. Re-verified against `origin/main` `6a5e5c0` (unchanged since rev 1). |

**Labels used throughout**

| Label | Meaning |
|---|---|
| **[V]** | Verified repository fact, at `origin/main` `6a5e5c0`, with a file reference |
| **[PO]** | Product Owner-approved requirement: the SA-001 brief, or decisions **SA-001-D01…D13** (§5.2) |
| **[A]** | Assumption, not verified |
| **[R]** | Proposed technical solution from this report, not approved as a design |
| **[D]** | Unresolved implementation detail, or a pending decision |
| **[X-V] / [X-S]** | External fact: read on the official page / from secondary or partial sources |

---

## 1. Mission and objective

SA-001 is an approved PO decision: **Smart Book Sharing, Option C.** The flow is:

> external quotation or reflection image → smart link → the specific Noetia book page → a small highlighted shared-context section → explore, read or listen according to entitlements.

- **Rev 1 (SA-001):** inspected the repository, assessed the architecture and specified the technical requirements.
- **Rev 2 (SA-001-GOV-001):** consolidated the 13 approved PO decisions into this single report. It also lists the remaining dependencies and the planning-only implementation sequence.

**Neither mission implements anything.**

## 2. Date and status

- **Date:** 2026-11-02, rev 2
- **Status:** product decisions approved; architecture documented; awaiting a separate PO authorization for Stage 0 (corrective mission). No implementation authorized.
- **Baseline:** `origin/main` at `6a5e5c0`, unchanged between rev 1 and rev 2
- **PR:** Draft [#24](https://github.com/Carloskfe/noetia/pull/24) on branch `docs/sa-001-smart-book-sharing`, stacked on PR #23's branch (see §11)

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

**Excluded by the PO [PO]:** Noetia is **not an internal social network**. Excluded are:
- internal feeds
- followers
- likes or reactions
- comment threads
- community publishing
- collaborative editing
- reputation scores
- internal social recommendation algorithms
- a separate quotation landing page as the primary destination

Nothing in this report proposes any of these.

**Also out of scope:**
- implementation of SA-001 or of the security corrections
- the NoetiaX research mission (see §5.10)

## 4. Executive summary

1. **All 13 PO decisions are approved and recorded** (§5.2). The open product questions in rev 1 are closed. What remains are implementation details, legal and rights inputs, and engineering dependencies (§10).
2. **Image creation is reusable unchanged [V]; D09 confirms this.** The existing generator already covers:
   - 8 formats
   - 18 nature and atmosphere backgrounds plus uploads
   - typography, auto-contrast and attribution
   - the Noetia watermark
   - permanent public PNGs

   No `noetia.app` mark will be added.
3. **The link side doesn't meet D01–D03 yet [V].**
   - `/s/<slug>` is a standalone quote page.
   - There's **no public book page**.
   - The book API requires sign-in and a subscription, and returns content URLs.
   - There are no universal links or App Links.
4. **Stage 0 must come first (D12).** Rev 1 found four defects; rev 2 adds four security and integrity findings and one requirement conflict:
   - **S12:** the image renderer fetches any URL a user supplies (server-side request forgery).
   - **S13:** the social-publish endpoint fetches any URL a user supplies.
   - **S14:** the public share API returns book data for unpublished or culled books.
   - **S15:** share inputs aren't validated or limited.
   - **C1:** "Edit before sharing" lets readers rewrite a fragment's text, which is then presented as the author's words. This conflicts with **D05**.

   Proposed corrective-mission scope: §8.1.
5. **Approved routing (D01):** keep `/s/<slug>`; render the book page directly there with the highlighted section; mark it `noindex`, pointing to the canonical `/books/<id>` (D02). The data comes from a new **public, metadata-only** book endpoint.
6. **Sequence (planning only, §10.2):**
   - Stage 0: corrections
   - Stage 1: public book page and smart link
   - Stage 2: universal sharing
   - Stage 3: reflections, rights and analytics
   - Stage 4: native links
   - Stage 5: direct-publishing improvements

   Estimate [R, A]: about **20–29 engineer-days** for Stages 0–4, or 23–34 including Stage 5, plus store review.

---

## 5. Verified findings and approved requirements

### 5.1 SA-001 brief requirements [PO]

| # | Requirement |
|---|---|
| P1 | The link opens the **specific book** inside Noetia; the book stays the primary destination. |
| P2 | A **small, non-intrusive highlighted section**, integrated in the book page, shows the quote or reader reflection that motivated the visit, when authorized. No modal, popup, full-screen view or separate quote page. |
| P3 | The visitor explores, reads or listens **according to entitlements**. |
| P4 | Channels: LinkedIn, Facebook, Instagram, WhatsApp and other compatible destinations, as a standalone image, a linked image, or an image with a link, as each platform allows. |
| P5 | SA-001 is a foundational **Noetia** capability; Noetia+ and NoetiaX reuse the same infrastructure. |
| P6 | Preserve existing functionality and approved design decisions. |
| P7 | No social-network infrastructure (§3). |

### 5.2 Approved Product Owner decisions: SA-001-D01…D13 [PO]

Approved on 2026-11-02 (SA-001-GOV-001). These are **product requirements**. The "proposed technical solution" column is **[R]**: engineering's proposal, not an approved design. Unresolved details are **[D]** and are tracked in §10.1.

| ID | Approved requirement [PO] | Proposed technical solution [R] | Unresolved detail [D] |
|---|---|---|---|
| **D01** Smart-link routing | Keep `/s/<slug>`. Render the specific book page **directly** at the shared URL, with the quote and any authorized reflection in a small highlighted section. No redirect to a separate quote page. `/books/<id>` is the canonical public book address. | One shared `BookPage` server component used by `/books/[id]` and `/s/[id]`, replacing today's `/s/[id]` body (§5.5). `/s/` sets `rel=canonical` to `/books/<id>`. | Whether `/books/<id>` also accepts a readable title slug |
| **D02** Search indexing | Eligible public book pages may be indexed. `/s/<slug>` is `noindex`, with the canonical book page identified. No private content, unpublished titles, unauthorized excerpts or revoked reflections exposed through indexing. | `robots: noindex` on `/s/*`. `/books/*` allowed in `robots.ts` and listed in the sitemap only for **eligible** books (published, passing the quality gate, not rights-restricted). Public endpoint 404s for ineligible books. Shared context never in the sitemap. | Exact eligibility rule, e.g. how culled or quality-gated titles are treated |
| **D03** Public discovery | Public metadata and shared context are viewable without registration. Reading and listening need existing entitlements. Visitors without access see acquisition options from the **separately approved acquisition model**. Keep the book destination and shared context after registration or acquisition. **No new pricing or entitlement rules.** | `GET /books/:id/public` (metadata only). CTA from the visitor's state (§5.4). `next=/s/<slug>` carried through register, login and acquisition return URLs. | The acquisition model is decided (PO-021…023) but its records and implementation are unmerged (PR #12, PR #11). The CTA depends on them (§10.1). |
| **D04** Reflections and identity | The section shows the quote and **optionally** the reader's reflection, which needs **explicit permission for that share**. The reader is **anonymous by default** and may opt in to attribution. Permission is withdrawable. Private notes are never public by default. | Per-share fields: `reflection` snapshot, `reflectionConsentAt`, `attributionEnabled` plus a display name snapshot, `reflectionWithdrawnAt`. Consent UI in the share flow, default off. Withdrawal from the fragments screen. | Attribution display format (first name, display name, handle); whether withdrawal is also available on mobile at launch |
| **D05** Quotation integrity | Preserve the author's original wording. Faithful excerpts allowed. Reflections clearly distinguished from quotes. No silent modification; no paraphrase presented as the original. | Card and section text must be a **faithful excerpt** of the book's own text, checked server-side against the source phrases (`startPhraseIndex`…`endPhraseIndex`). Reader text goes only in the reflection field, styled differently. | **Conflict C1** (§5.3): today's free-text edit feature. The faithful-excerpt rule (are elisions with "…" allowed?) needs a PO-approved definition. |
| **D06** Copyright and rights | Rights-aware sharing: per-title permissions and restrictions, attribution, documented quote limits, a rights-holder removal procedure, publisher opt-out. No universal safe length is assumed. Exact limits and licensing language need a separate rights and legal assessment. **Not legal certification.** | Per-book rights policy (sharing allowed or blocked, max excerpt length, attribution text). Enforcement at share creation and on public pages. Admin "remove share" and "restrict title" actions. Documented removal-request procedure. Public-domain titles allowed by default. | Values and legal wording come from the rights and legal assessment (§10.1). Author upload terms may need amendment (legal-gated, see NOF-004). |
| **D07** Permanent links and revocation | No automatic expiry. Readers can revoke publicly displayed shared content. Revocation removes the shared context from Noetia surfaces but keeps the book destination when appropriate. Unavailable books get an availability or discovery fallback. Noetia **can't** guarantee removal of copies already downloaded or posted externally; that limit is documented. | `revokedAt` on shares. A revoked share renders the book page without the section. Revocation also deletes the stored card image from the public bucket, and drops it from `og:image` once platform caches refresh [X-V: Facebook caches images by URL]. User-facing copy states the external-copies limit. | Whether revocation deletes the card image or only unlinks it |
| **D08** Distribution priorities | **P1:** universal sharing: image download, smart-link copy, native device share. **P2:** better direct publishing. Keep platform-specific behaviour. Keep Pinterest without expanding it. **No social-account connection needed for ordinary sharing.** No internal social network. | Stage 2: Web Share API with files, text and URL, with fallback; RN share fix; WhatsApp and copy-link without OAuth; optional JPEG export. Stage 5: LinkedIn Posts API migration, link in commentary or caption, Instagram publisher fix. | Whether Facebook Page-only publishing stays, or the button is relabelled "Publish to your Page" |
| **D09** Card branding | Keep the existing watermark. **No** visible `noetia.app` URL mark. Keep the generator's design and functions unless a separately identified compatibility or security correction is needed. | No visual change. Allowed corrections: S12 (background URL fetching), G7 (Instagram format), C1/D05 text-source validation. | — |
| **D10** Native app links | Web book experience first. Universal Links and App Links **only after** mobile entitlement and paywall alignment. They must eventually keep the book destination and the authorized shared context. No native builds or submissions in this mission. | Stage 4 (§5.4). | Timing depends on the mobile paywall alignment (PR #12 / PO-021…023) |
| **D11** Analytics | Privacy-conscious measurement of share creation, smart-link opens, book-page discovery and visits, and relevant acquisition outcomes. Separate crawlers from humans where reasonable. Avoid unnecessary personal identifiers. **No share data into Stripe** until separately reviewed and authorized. Subject to privacy and legal requirements. | Event list in §5.8. Aggregate counters plus first-party events, no third-party pixels. Crawler user-agent filter. | Whether new events need Privacy or Cookie Policy updates (legal-gated, §10.1) |
| **D12** Security and integrity first | A **separate corrective mission** before SA-001 features: ownership authorization; revocation, deletion and account-deletion integrity; mobile image and link regressions; duplicate shares. List any additional findings. This mission documents, **doesn't implement**. A separate explicit PO authorization is needed. | Proposed scope: §8.1, including the additional findings S12–S15 and C1. | PO authorization of the corrective mission, and its NEM number |
| **D13** Capability naming | **Noetia:** core reading, quotations, reflections, original knowledge creation, visual cards, external sharing. **Noetia+:** AI-assisted comprehension and knowledge development. **NoetiaX:** advanced Socratic reasoning, intellectual memory, cross-book connections. External sharing is in **every** tier. Never "Basic". Tiers are distinct from the Individual, Duo and Family plans. No price, rule, Stripe or entitlement change. | SA-001 copy and code use no tier gating. Any tier wording uses these names. | — |

### 5.3 Existing functionality inventory [V]

Verified at `6a5e5c0` and unchanged since rev 1.

| Area | What exists | Reference |
|---|---|---|
| Quotations and selections | `fragments` rows: `text`, `startPhraseIndex`/`endPhraseIndex`, `note`, `themes`. Owner checks on update, delete and combine. | `services/api/src/fragments/fragment.entity.ts`; `fragments.service.ts:53,60,72` |
| Editable fragment text | `PATCH /fragments/:id` accepts any `text` string (`UpdateFragmentDto`). `ShareModal` "save text" writes the edited card text back to the fragment. The tutorial says "edit it… or adjust the text before creating a card". | `fragments/dto/update-fragment.dto.ts`; `fragments.service.ts:50-55`; `ShareModal.tsx:204-214`; `services/web/lib/i18n/en.ts:424` |
| Reader reflections | Only `fragment.note`, private to the owner. In `ShareModal` it can be attached as the **post caption** when the user ticks "use as caption". It's never stored in the share record or shown on the invite page. | `ShareModal.tsx:264,782-797` |
| Quote-card generation | `POST /fragments/:id/share` → `image-gen` `/generate` → PNG in the public `images/` bucket under a random UUID name, with a **permanent** public URL | `sharing.controller.ts:30-81`; `sharing.service.ts:59-110`; `image-gen/storage.py:29-40` |
| Formats | ig-post 1:1, ig-story and reel 9:16, fb-post 1.91:1, fb-story 9:16, li-post 1.91:1, pin-post 2:3, pin-square 1:1 | `ShareModal.tsx` `FORMAT_ASPECT`; `image-gen/templates/*.py` |
| Backgrounds | 18 preset images (`/backgrounds/imagen-N.jpg`), user upload as base64, solid and gradient colours, flip, cover/contain fit. The image service loads `bgImage` from a `data:` URI **or any URL**. | `services/web/lib/share-utils.ts:31+`; `image-gen/templates/base.py:106-113` |
| Typography and contrast | Font choice, faux bold and italic, alignment, S/M/L scale. WCAG relative-luminance text colour; the resolved colour is forwarded so preview and output match. | `base.py:61-86,208+`; `share-utils.ts` `getTextColor` |
| Attribution | Author · title always rendered; optional citation | `base.py:313-315`; `ShareModal.tsx:127-135,440-456` |
| Watermark | Noetia logo bottom-right at 3.9% of width, 90% opacity, light or dark variant; text fallback | `base.py:31-58,249-288` |
| Export | **PNG only**: Download (`noetia-<format>.png`) and Copy link | `ShareModal.tsx:293-319` |
| External sharing (web) | OAuth connect and API publish to LinkedIn, Facebook, Instagram (flag-gated) and Pinterest. The image is posted without a link; the optional caption is the note. The publish endpoint downloads the `imageUrl` given in the request body, server-side. | `social.controller.ts:143-180`; `publishers/*.ts` |
| External sharing (mobile) | `ShareSheet` generates a card, then `Share.share({ url, message: fragmentText })` and "Open image". No WhatsApp entry. | `services/mobile/src/components/ShareSheet.tsx:10-15,69,78-81,202` |
| Share record | `shares` table (migration 065): 10-character random slug, `bookId`, `fragmentId`, a snapshot of quote, author, title, citation and imageUrl, platform, `createdById`, `visitCount`. **No foreign keys.** | `share.entity.ts`; `1748300000065-CreateShares.ts:6-19` |
| Public share API | `GET /shares/:id` returns the snapshot plus `book` (id, title, author, coverUrl, isFree) **without checking `isPublished`** or the quality gate | `sharing.service.ts:113-138` |
| Public share page | `/s/[id]`: SSR, OG and Twitter metadata from the card, ES/EN by `Accept-Language`, card image plus quote, CTA → `/reader/<bookId>` | `services/web/app/s/[id]/page.tsx:24-136` |
| Book pages | **None.** Book tiles link to `/reader/<id>`. | route list; `BookGrid.tsx:39` |
| Book identifiers | UUID `books.id`, no slug. `description`, `coverUrl`, `language`, `category`, `collection`, `isFree`, `priceCents`, `isPublished`. | `books/book.entity.ts` |
| Public book data | `GET /books` (list) is public and cacheable. `GET /books/:id` needs `JwtAuthGuard` and `SubscriptionGuard` and returns **presigned text and audio URLs**. | `books.controller.ts:65-87,97-115` |
| Reader entry when logged out | Redirects to `/login?next=/reader/<id>` | `reader/[id]/page.tsx:158-163` |
| Phrase deep link | None | `reader/[id]/page.tsx` |
| Indexing | `robots.ts` disallows `/discover` and `/reader/`. `/s/` is crawlable and isn't in the sitemap. | `robots.ts:10-24`; `sitemap.ts` |
| Mobile links | `scheme: 'noetia'` only. No `associatedDomains` or `intentFilters`; `NavigationContainer` has no `linking`. | `app.config.js:69`; `services/mobile/src/index.tsx:11` |
| Product names | "Noetia+" and "NoetiaX" don't appear in the web i18n or the PRD. No customer-facing "Basic" or "Básico" in `services/web/lib/i18n/{en,es}.ts` or `docs/PRD.md`. | grep at `6a5e5c0` |
| Analytics | `fragment_shared` event; `books.shareCount` +1 per share call; `shares.visitCount` +1 per `/s/` render | `sharing.controller.ts:69-77`; `sharing.service.ts:118` |

### 5.4 Gaps between the current implementation and SA-001

| # | Gap | Type | Decision |
|---|---|---|---|
| G1 | No public book page. The share destination is a separate quote page whose CTA leads to the login-gated reader. | [V] | D01, D03 |
| G2 | No public, metadata-only single-book endpoint | [V] | D01–D03 |
| G3 | No acquisition route for non-owners. The reader fails behind `SubscriptionGuard`. The approved model (PO-021…023) is unmerged; the bypass fix (PR #11) is unmerged. | [V] | D03 |
| G4 | No universal links or App Links | [V] | D10 |
| G5 | Reflections can't be shared context; no consent, attribution or withdrawal model | [V] | D04 |
| G6 | Ordinary sharing lacks a link on most channels: API posts without a URL; no Web Share API or WhatsApp; Android drops `url` | [V] + [X-S] | D08 |
| G7 | PNG only. Instagram's API accepts JPEG only, and the publisher sends a `data:` URI (flag-gated). | [V] + [X-V] | D08, D09 (compatibility correction) |
| G8 | Each Download, Copy or Publish click creates a new image and a new share | [V] | D11, D12 |
| G9 | No revoke; no clean-up on fragment or account deletion | [V] | D07, D12 |
| G10 | Mobile "Open image" opens the invite page; the Android share message omits the link | [V] + [X-S] | D08, D12 |
| G11 | `visitCount` counts preview crawlers and prefetches | [V] + [A] | D11 |
| G12 | No per-title rights policy, quote limit or removal procedure | [V] (absent) | D06 |
| **C1** | **Requirement conflict.** The existing "Edit before sharing" lets readers rewrite fragment text freely (`PATCH /fragments/:id`, plus the `text` override on share), and the result is presented as the author's words with author · title attribution. This conflicts with **D05**; D09 permits this correction. | [V] | D05, D09 |

**How C1 should be resolved is a PO-level product choice** [D]. Engineering options [R]:
- (a) Restrict card text to excerpts of the source phrases, i.e. trimming, and send reader-written text to the reflection field.
- (b) Allow edits but render them as a reflection with the original quote shown separately.

Option (a) is the closest fit to D05. Either way, existing fragments whose text was edited need handling: re-derive the text from the phrase indices, or flag the fragment.

### 5.5 Smart-link architecture

Requirements: D01, D02, D03, D07, D10 [PO]. Solution: [R].

**URLs**
- **Shared URL (unchanged, D01):** `https://noetia.app/s/<slug>`. The slug is 10 characters from 62, generated with `crypto.randomBytes` (about 59 bits), so it's unguessable [V `sharing.service.ts:12-18`].
- **Canonical book URL (D01):** `https://noetia.app/books/<bookId>`.
- **Campaign attribution (optional):** `utm_source`, `utm_medium` and `utm_campaign` chosen per channel when the link is generated. The stored `platform` already identifies the channel, without visitor identifiers (D11).

**Rendering**
1. `/s/<slug>` server-renders the shared `BookPage` with the highlighted section.
   - `rel=canonical` points to `/books/<bookId>`; `robots: noindex` (D02).
   - `og:image` is the card, with width and height [X-V Facebook webmasters].
   - Rendering directly, with no redirect, keeps the correct OG data for in-app browsers and preview crawlers.
2. `/books/<bookId>` renders the same page without the section. It's indexable when eligible (D02): add `/books/` to the `robots.ts` allow list and list eligible books in the sitemap.
3. The existing `/s/[id]` quote-page layout is replaced, but its OG generation, ES/EN choice and `Accept-Language` logic are reused (P6).

**Data**
- `GET /books/:id/public` returns only:
  - id, title, author, description, coverUrl, language, category, collection
  - `isFree`
  - whether audio exists
- It never returns text or audio URLs or sync maps, and 404s for ineligible books (D02, S14).
- `GET /shares/:id` returns:
  - `kind` (`quote` | `reflection`)
  - the quote snapshot
  - the reflection, only if consented and not withdrawn
  - the attribution name, only if enabled
  - `revoked`
  - `bookId`
- It **must not** return data for ineligible books (S14).

**Behaviour by visitor (D03)**

| Visitor | Behaviour |
|---|---|
| Entitled user | Book page plus section. "Read" / "Listen" → `/reader/<id>`. After Stage 4, the app opens directly. |
| Signed-in, not entitled | Same page and section. CTA from the approved acquisition model; no text or audio exposed. No new pricing or entitlement rules. |
| Anonymous visitor | Same public page, viewable without registration. CTA: register or sign in with `next=/s/<slug>`, then the acquisition route. The destination and shared context survive registration and acquisition. |
| Share revoked or deleted (D07) | Book page without the section; no error. |
| Book no longer public (D07) | Neutral "not available" message plus Discover. Never a dead-end 404 for a share link. |

**Native app links (Stage 4, D10)**
- Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`. Android requires `https://<host>/.well-known/assetlinks.json` [X-V].
- iOS `associatedDomains: ['applinks:noetia.app']` [X-S; the Apple page didn't load].
- Android `intentFilters` with `autoVerify`, `VIEW`, `BROWSABLE` and `DEFAULT`, `https`, paths `/s/*` and `/books/*` [X-V].
- React Navigation `linking` config mapping both paths to the book and the shared context.
- Needs `eas build` and store submission, not OTA [V CLAUDE.md].
- Android 15+ verification can take up to 7 days to propagate [X-V].
- Social in-app browsers often don't trigger universal links [X-S], so the web page must stay fully functional (D10).
- Blocked by the mobile paywall alignment: per PR #12, the app is entirely behind a subscription paywall [V-PR #12, not re-verified].

### 5.6 Book-page highlighted-section specification

Requirements: P2, D01, D04, D05, D07 [PO]. Exact copy and visuals [D], pending UI review.

- **Placement.** Inline below the title and author block, above the description, in normal flow. Not sticky, no overlay, no modal, never blocks navigation or CTAs.
- **Size.** About 25% or less of the first mobile viewport. Long text clamped to 4 lines with "Show more" expanding inline. On desktop it fits the description column.
- **Label:** "Compartido desde Noetia" / "Shared from Noetia" (copy [D]).
- **Quote (D05):**
  - the author's original wording, in quotation marks
  - author · title and the optional citation
- **Reflection (D04):** shown only with per-share consent.
  - A visually distinct style, labelled "Reflexión de un lector" / "A reader's reflection" (copy [D]).
  - Anonymous unless the reader enabled attribution.
  - Never mixed into the quote's quotation marks (D05).
- **States:**
  - normal
  - with reflection
  - reflection withdrawn: quote only
  - share revoked: section omitted
  - book unavailable: neutral fallback (D07)
- **Accessibility.** Real text; contrast ≥ 4.5:1; a labelled region.
- **i18n.** Per CLAUDE.md § Voice & Style: "tú" form, sentence case, "Noetia" by name. Web-only keys unless mobile shows the section.

### 5.7 External-platform sharing compatibility matrix

Access date 2026-11-02. Priorities follow D08: universal sharing first, direct publishing second, Pinterest kept as is.

| Channel | Standalone image | Link with OG preview | Image + clickable link | API publishing | Noetia today [V] | Proposed [R] (stage) |
|---|---|---|---|---|---|---|
| **Download / copy link** | Yes (PNG) | Copy link | Manual | — | Yes | Keep; optional JPEG export (2) |
| **Native share (web)** | `navigator.share({ files })` where `canShare`; HTTPS; user gesture; limited availability [X-V] | `navigator.share({ url, text })` | Platform-dependent | — | Not used | Primary mobile-web action with fallback (2) |
| **Native share (RN)** | `Share.share` doesn't share files [X-V]; needs a file-share module [A] | `url` reads as iOS-only; Android uses `message` [X-V, ambiguous badge] | URL inside `message` | — | Android omits the link (`ShareSheet.tsx:80`) | Fix in Stage 0; file sharing in (2) |
| **WhatsApp** | Via native share | From `og:*` [X-S] | Image + caption through the share sheet [X-S] | No API for personal chats; `wa.me/?text=` [X-S] | Not offered | `wa.me` button and native share, no OAuth (2) |
| **LinkedIn** | Yes | From `og:*` [X-S] | URL in the commentary [X-S] | `ugcPosts` is Legacy; replaced by the Posts API [X-V] | API image post, no link | Link-share without OAuth (2); Posts API migration and link in commentary (5) |
| **Facebook** | Yes | From `og:*`; image cached by URL [X-V] | Link in the photo caption [X-S] | Pages only; no personal-profile posting [X-S] | Posts to the first managed Page | Link-share via sharer or native share (2); Page publishing kept or clarified (5) |
| **Instagram** | Yes (feed, story) | No; caption links not clickable; Stories link sticker is manual [X-S] | No (feed) | Professional accounts; **JPEG only**; public URL; 100 posts per 24h [X-V] | PNG `data:` URI, flag-gated off | Image-first download or native share (2); publisher fix before enabling (5) |
| **Pinterest** | Yes | Pin `link` | Yes | v5 pins support `link` [X-S] | Pins without a link | **Kept, not expanded (D08).** Adding `link` is optional and low priority (5). |

**What an image can't do [PO, X-S].** A PNG or JPEG can't carry a universally clickable link. Clickability comes only from:
- link text in the post or message
- OG link previews
- platform link fields, such as the Pinterest link or Instagram Stories sticker

No URL mark is added to cards (D09).

### 5.8 Analytics: approved scope (D11) and limitations

**Measurable [R], first-party, aggregate where possible, no third-party pixels:**
- **Share created:** `fragment_shared` plus the share row, deduplicated per card (G8).
- **Smart-link opened:** `/s/` render, with known preview crawlers excluded by user agent (heuristic).
- **Book-page visit, and its source:** direct, `/s/` share, or search.
- **Registration or sign-in from a share:** the slug carried via `next`.
- **Acquisition outcome after a share visit:** in Noetia's own data. **Not in Stripe** until separately authorized (D11).

**Approximate:**
- opens by channel, from `platform` and `utm_*`
- crawler-versus-human separation

**Not measurable:**
- forwarding or reposting of downloaded images
- reach and impressions on external platforms
- views of link-less images
- WhatsApp forwarding

**Constraint:** new processing may need Privacy and Cookie Policy updates. That's legal-gated, see NOF-004.

### 5.9 Privacy, copyright and security considerations

| # | Issue | Fact or assessment | Safeguard [R] | Decision |
|---|---|---|---|---|
| S1 | **Missing ownership check.** `sharing.controller.ts:52` loads any fragment by id. A signed-in user who knows a fragment UUID can publish another user's fragment publicly. | [V] | Require `fragment.userId === req.user.id` | D12 |
| S2 | Arbitrary `text` override attributed to the book's author and title | [V] `sharing.controller.ts:40`; `sharing.service.ts:65,99` | Validate as a faithful excerpt (C1); length cap | D05, D12 |
| S3 | Shares and images survive fragment or account deletion (no foreign keys) | [V] migration 065 | Cascade or revoke on fragment delete; delete on account deletion; user revoke | D07, D12 |
| S4 | Reflections are private; the only exposure today is an explicit per-publish caption checkbox | [V] | Per-share consent, anonymous default, withdrawable | D04 |
| S5 | Public pages must not expose restricted content | [V] the guarded endpoint returns presigned URLs | Separate metadata-only endpoint; tests asserting no content URLs | D02, D03 |
| S6 | Quotation rights for copyrighted titles | Internal assessment, **not certified** | Per-title policy, limits, opt-out, removal procedure | D06 |
| S7 | Slug guessing | [V] about 59 random bits | Keep; never expose `createdById` | D01 |
| S8 | Unlimited share creation; permanent public images | [V] | Rate limit; one share per card; admin revoke | D12 |
| S9 | `/s/` indexable today | [V] | `noindex` | D02 |
| S10 | Analytics privacy | [R] | Aggregate, first-party, no unnecessary identifiers | D11 |
| S11 | Link permanence | [PO] | Permanent; revocable; external copies can't be recalled | D07 |
| **S12** *(new, rev 2)* | **Server-side request forgery in the image renderer.** `bgImage` from the share request goes unvalidated to `image-gen`, which opens any URL with `urllib.request.urlopen`. That reaches the internal Docker network and non-HTTP schemes; a fetched image would be rendered onto a **public** card. | [V] `sharing.controller.ts:45,63`; `image-gen/templates/base.py:106-113`; exploitability in production [A] | Accept only `data:` images (size-capped) or an allow-listed preset path. Block internal hosts and non-HTTPS schemes. | D09 (security correction), D12 |
| **S13** *(new, rev 2)* | **Server-side request forgery in social publish.** `POST /social/:platform/publish` downloads the `imageUrl` from the request body, server-side, and uploads the bytes to the user's own social account. | [V] `social.controller.ts:143-162`; exploitability [A] | Accept a share id, or only URLs on Noetia's public image origin; never fetch arbitrary URLs | D12 |
| **S14** *(new, rev 2)* | **Public share API leaks ineligible books.** `GET /shares/:id` returns book metadata without checking `isPublished` or the quality gate, so shares of unpublished or culled titles stay public. | [V] `sharing.service.ts:113-138` | Return the share only for eligible books; the book-unavailable fallback otherwise | D02, D07, D12 |
| **S15** *(new, rev 2)* | **Share inputs unvalidated.** The share endpoint takes 16 body fields with no DTO validation: no length or size limits on `text`, `citation` or base64 `bgImage`. Every call also triggers rendering and storage. | [V] `sharing.controller.ts:31-50` | DTO with limits; rate limit (S8) | D12 |

The S12 and S13 descriptions stay at the level of the vulnerability class on purpose; no exploit detail is recorded.

### 5.10 Relationship to NoetiaX

- SA-001 is Noetia's approved **external knowledge-sharing foundation**, available in every tier (D13).
- NoetiaX remains a **separate** product-feasibility and architecture research mission. It isn't started here.
- Future NoetiaX research should treat SA-001's share, link and book-page infrastructure as the base. NoetiaX may enrich what users develop and share, for example reasoning-derived reflections, which would be D04 reflections and never presented as quotes (D05). It must not redefine Noetia as an internal social network (§3).
- Noetia+ follows the same principle. Per PO-022 it's an independent subscription, so SA-001 must not gate sharing on it.

---

## 6. External references

Accessed 2026-11-02.

| Source | URL | Result |
|---|---|---|
| Instagram Platform: Content publishing | https://developers.facebook.com/docs/instagram-platform/content-publishing/ | [X-V]: JPEG only; public URL; professional account; 100 posts per 24h (50 for carousels, as stated on the page) |
| React Native: Share | https://reactnative.dev/docs/share | [X-V] partial: `url` and `message`; no files; platform badges ambiguous |
| MDN: Navigator.share() | https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share | [X-V]: files where `canShare`; HTTPS; transient activation; limited availability |
| Apple: Supporting associated domains | https://developer.apple.com/documentation/xcode/supporting-associated-domains | **Didn't load**; AASA details are [X-S] |
| Android: Verify App Links | https://developer.android.com/training/app-links/verify-android-applinks | [X-V]: `/.well-known/assetlinks.json`; `autoVerify`; propagation up to 7 days on Android 15+ |
| LinkedIn: UGC Post API (Legacy) | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api | [X-V]: Legacy; the Posts API replaces `ugcPosts` |
| WhatsApp: How to use click to chat | https://faq.whatsapp.com/5913398998672934 | **Didn't load**; `wa.me/?text=` is [X-S] |
| Facebook: Sharing for webmasters | https://developers.facebook.com/docs/sharing/webmasters/ | [X-V]: OG tags; image width and height; cached by URL; Sharing Debugger |

Internal references:
- PO-021, PO-022 and PO-023 decision records (`DECIDED`, on branch `docs/po-021-023-acquisition-noetia-plus`, PR #12, unmerged)
- PR #11 (NEM-011 acquisition bypass fix, open, not merged)
- NOF-004 legal review (`docs/legal/NOF-004-terms-legal-review.md` on PR #22) and audit (PR #23)

## 7. Risks

| Level | Risk |
|---|---|
| **Critical** | None that blocks documentation. Stage 1 public release would be **unsafe** without Stage 0 (S1, S3, S12–S14). |
| **High** | S1: cross-user publishing. S12 and S13: server-side request forgery. S3: shares survive deletion (conflicts with the Privacy Policy). G3: the acquisition model is unmerged. D06: rights values undefined. C1: free-text edits conflict with D05. |
| **Medium** | G10: mobile regressions. S14: ineligible books exposed through shares. S15: unvalidated inputs. G7: the dormant Instagram publisher. G8: duplicate shares. LinkedIn `ugcPosts` is legacy. The mobile paywall blocks D10. |
| **Low** | G11: crawler-inflated counts. Facebook Page-only publishing. Android App Links propagation delay. |

## 8. Recommendations

### 8.1 Proposed scope for the separate corrective mission (Stage 0, D12)

**Proposal only. A separate, explicit PO authorization is required. Not started.**

Working title: *"SA-001 Stage 0: sharing security and integrity corrections"*. It needs a NEM number assigned under `docs/engineering-missions/`.

| # | Correction | Findings | Notes |
|---|---|---|---|
| 1 | Ownership authorization on `POST /fragments/:id/share` | S1 | Returns 403 for a non-owner |
| 2 | Share lifecycle integrity: revoke field and endpoint; revoke or delete when the fragment is deleted; delete shares and card images on account deletion | S3, G9 | **Migration expected** (`revokedAt`, possibly foreign keys). Must match the Privacy Policy's deletion statements. |
| 3 | Mobile regressions: `ShareSheet` uses `res.url` (the page) as the image; the Android share message omits the link | G10 | JS-only, so OTA-eligible [V CLAUDE.md], subject to authorization |
| 4 | Duplicate share generation: one share per card configuration; `shareCount` counts shares, not clicks | G8 | |
| 5 | Close the server-side request forgery in background images: accept only `data:` or allow-listed presets | S12 | |
| 6 | Close the server-side request forgery in social publish: accept a share id or a Noetia image URL only | S13 | |
| 7 | Public share API returns nothing for ineligible books | S14 | |
| 8 | Share request validation: DTO, length and size limits, rate limit | S15, S2, S8 | |
| 9 | *(needs a PO product choice first)* Quotation-integrity enforcement for C1 / D05 | C1, S2 | If the PO picks option (a), it can join Stage 0; otherwise Stage 1 |

**Out of scope for Stage 0:**
- public pages
- the new sharing UX
- reflections
- rights policy
- analytics
- native links

**Tests:** per CLAUDE.md § Testing, at least 80% coverage on touched services.

**Estimate [R, A]:** 4–6 days.

### 8.2 Required for SA-001 feature stages [R]

- Public metadata endpoint, `BookPage`, `/s/` rendering, canonical and `noindex`, eligible-only indexing (Stage 1; D01–D03).
- Rights-policy enforcement and the removal procedure **before** any public release that shows copyrighted quotes (D06; may need to move into Stage 1).
- Consent, anonymity and withdrawal before any reflection is shown (D04).

### 8.3 Optional improvements [R]

- Readable book slugs
- Phrase deep link into the reader
- JPEG export
- Pinterest `link` (low priority, D08)

## 9. Tests and verification performed

- **Rev 1:** read-only inspection of `origin/main` `6a5e5c0`; 8 official sources fetched (Apple and WhatsApp returned no body).
- **Rev 2:**
  - Confirmed `origin/main` is still `6a5e5c0` and that #23 (head `8b0e4f9`) and #24 (head `0b2486c`) were Open, Draft, unmerged and not retargeted.
  - Read `CLAUDE.md` and `docs/engineering-missions/README.md`, and the PO-021…023 records on PR #12's branch.
  - Checked the status of PR #11 and PR #12 (both open, not merged).
  - New targeted inspection for S12–S15 and C1, at the files cited.
- No code executed, no tests run, no database, staging, production or Stripe access.
- Limitations:
  - The mobile paywall behaviour is cited from PR #12.
  - [X-S] platform claims weren't verified on official pages.
  - S12 and S13 exploitability in the production network wasn't tested, by design.
  - Estimates are judgement.

## 10. Open questions, dependencies and decisions

### 10.1 Status of rev 1's questions

**All approved, 2026-11-02:**

| Rev 1 question | Resolved by |
|---|---|
| 1 Canonical URL and routing | D01 |
| 2 Indexing | D02 |
| 3 Acquisition CTA | D03, via the separately approved model |
| 4 Reflections and identity | D04 |
| 5 Edited quotes | D05 (raises conflict C1) |
| 6 Copyright | D06 (values pending the legal and rights assessment) |
| 7 Link permanence | D07 |
| 8 Channels | D08 |
| 9 Card link mark | D09 (no mark) |
| 10 Native links | D10 |
| 11 Analytics and Stripe | D11 (Stripe deferred) |
| 12 Defects first | D12 |
| 13 Tier naming | D13 |

**Remaining dependencies and unresolved details.** None of these are new product policies proposed by engineering.

| Type | Item | Blocks |
|---|---|---|
| Governance | PO authorization and NEM number for Stage 0 (§8.1) | Stage 0, and therefore every later stage |
| Governance | A NEM mission per feature stage | Stages 1–5 |
| Product (PO) | **C1** resolution approach, (a) or (b), and the definition of a "faithful excerpt" (are elisions allowed?) | Stage 0 item 9 / Stage 1 |
| Product and engineering | Acquisition model: PO-021…023 records (PR #12) and NEM-011 (PR #11) are unmerged. `SubscriptionGuard` today grants access by subscription status, which PO-021 changes. | Stage 1 CTA for non-owners (D03), Stage 4 (D10) |
| Legal and rights | Rights and legal assessment: quote limits, licensing, attribution wording, removal-request procedure, author upload-terms amendment | Public release of copyrighted-title quotes (D06) |
| Legal and privacy | Privacy and Cookie Policy updates for public reflections, attribution and analytics, plus the deletion statements (S3). Related to the NOF-004 legal work (PR #22, #23). | Stage 3, and any public release involving reflections |
| Security | Stage 0 complete and reviewed | Stage 1 public release |
| Mobile | Paywall and entitlement alignment (PR #12 finding) | Stage 4 |
| Operational | Apple and Google developer-account access; AASA and assetlinks hosting on `noetia.app`; store review | Stage 4 |
| Operational | Every merge to `main` triggers production CD; check `gh run list` before merging | All stages |
| Detail [D] | Attribution display format; whether revocation deletes or unlinks the image; book slug; Facebook Page button wording; indexing eligibility rule | Respective stages |

### 10.2 Implementation sequence (planning only, not a schedule or authorization)

| Stage | Content | Hard dependencies | Can run in parallel with | Estimate [R, A] |
|---|---|---|---|---|
| **0** Corrections | §8.1 | PO authorization | Legal and rights assessment; UI design of the section | 4–6 d |
| **1** Public book page and smart link | Public endpoint, `BookPage`, `/s/` rendering, highlighted section (quote only), canonical, `noindex`, eligible indexing, unavailable fallback, `next` preservation | Stage 0 **released**. Acquisition model merged for the non-owner CTA. **Minimum rights controls** (per-title share block, removal procedure) if copyrighted titles are public. | Stage 2 web work, once the share APIs are stable | 5–7 d |
| **2** Universal sharing | Web Share API, copy-link and download polish, WhatsApp link, RN share, optional JPEG | Stage 0 items 3 and 4 | Stage 1 | 3–4 d |
| **3** Privacy, reflections, rights, analytics | Reflection consent, attribution and withdrawal; full rights policy and limits; analytics events and crawler filtering | Legal and privacy policy updates; rights assessment values | Stage 4 preparation | 4–6 d |
| **4** Native app links | AASA and assetlinks, app config, `linking`, book screen with shared context, EAS build and submission | Mobile paywall alignment; developer accounts; Stage 1 live | Stage 5 | 4–6 d + store review |
| **5** Direct-publishing improvements | LinkedIn Posts API migration, link in commentary or caption, Facebook Page clarity, Instagram JPEG and public-URL fix, Pinterest kept as is | Stage 0 item 6 (S13) | Stage 4 | 3–5 d |

**Release rule (PO, §5 of the GOV-001 brief):** the security and rights controls needed for an earlier public release ship **with** that release, even when their broader enhancements belong to Stage 3. In practice:
- Stage 1 can't go public before Stage 0.
- Stage 1 can't show copyrighted-title quotes publicly without the minimum D06 controls.
- No reflection is ever shown publicly before D04's consent controls exist.

**Total [R, A]:** about **23–34 engineer-days** across Stages 0–5. The executive summary also gives 20–29 for Stages 0–4, without Stage 5.

## 11. Changes made

- **No application code, test, migration, Stripe, entitlement, legal-document or production change was made.** No native build or deployment; no merge; the NoetiaX mission wasn't started.
- **Rev 2** updated this report in place, keeping a single SA-001 report, and updated its row in `docs/reports/README.md`.
- **Protocol and stacking:** the reporting protocol exists only on PR #23's branch and isn't on `main`. This PR therefore stays stacked on `docs/nof-004-legal-benchmark-audit`; #23 wasn't modified. If #23 merges first, GitHub retargets this PR to `main`. If #23 is abandoned, rebase onto `main`, which needs PO direction.

## 12. Next recommended action

The PO decides whether to authorize the **Stage 0 corrective mission** (§8.1) and how to resolve **C1**. In parallel, the PO can commission the rights and legal assessment (D06) and the privacy-policy updates (D04, D11). **No implementation until a named mission is explicitly authorized.**
