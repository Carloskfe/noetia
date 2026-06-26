# Noetia — Product Requirements Document

> Read. Listen. Capture. Share.

Noetia is a multimodal reading platform that synchronizes text and audio at a phrase-by-phrase level, allowing users to seamlessly switch between reading and listening. It transforms reading into social expression by letting users extract highlights ("fragments") and convert them into shareable, branded visual content.

---

## Table of Contents

1. [Vision](#vision)
2. [Product Hierarchy](#product-hierarchy)
3. [Target Users](#target-users)
4. [Business Architecture](#business-architecture)
5. [MVP Scope](#mvp-scope)
6. [Core Features](#core-features)
7. [Security & DRM](#security--drm)
8. [Engineering Quality](#engineering-quality)
9. [Key Metrics (KPIs)](#key-metrics-kpis)
10. [Risks](#risks)
11. [Growth Strategy](#growth-strategy)
12. [Roadmap](#roadmap)
13. [Future Enhancements](#future-enhancements)

---

## Vision

To become the leading platform where knowledge is not only consumed but expressed — turning reading into a social identity behavior.

**Core value proposition:**
- Synchronized Reading + Listening (phrase-level, seamless switching)
- Frictionless Knowledge Capture (fragments, highlights)
- Instant Social Content Creation (branded quote cards for LinkedIn, Instagram, etc.)

**What Noetia is not:** a content publisher. Noetia is a distribution and reading platform. The catalog is built by authors, publishers, and companies — not by Noetia. This distinction is fundamental to every product decision.

---

## Product Hierarchy

**This hierarchy governs every design, engineering, and prioritization decision.**

### Priority 1 — Reader experience

The reader is the daily active user. Every feature, every screen, every performance decision is evaluated first through the lens of the person who opens the app every day to read or listen. A reader who loves the experience becomes a paying subscriber, creates fragments, shares content, and refers others — which in turn creates demand for author content.

Reader-first means:
- The reading and listening engine must be fast, smooth, and reliable before anything else ships.
- Every UI change is tested for impact on the reading flow first.
- Performance budgets, caching strategy, and DRM all serve the reader first.

### Priority 2 — Author and company experience

Authors and publishers are the business. Without a growing catalog of quality content, there are no readers. Without readers, there is no subscription revenue. The author upload, review, and publishing pipeline must be as seamless as possible because it is the primary content supply chain.

Author-first (within their tier) means:
- The upload guide, portal, and sync tooling must be polished and clear — authors are not developers.
- Review turnaround (3–5 business days) must be treated as a business SLA, not a backlog item.
- Author analytics (readers, shares, revenue) are the author's ROI signal — they must be accurate and current.

### The free library — beta acquisition tool only

The current catalog of public-domain books (Spanish: Gutenberg, Wikisource, LibriVox; English: Gutenberg, LibriVox — in active development) exists for one reason: to give beta users a complete reading experience from day one, before the author catalog is built.

**The free library is not the business.** After 6–12 months of operation, new free-library titles will not be added. The slot in the UI currently occupied by "Biblioteca gratuita" will be replaced by curated author content. All engineering decisions about the free library should be made with this sunset in mind — good enough for beta, not worth over-investing in.

---

## Target Users

### Tier 1 — Readers ("Insight Creators")
- Age: 18–45
- Geography: Spanish-speaking users at launch (Latin America, US Hispanic market, Spain); English-speaking users from Year 2 (US, UK, Canada, Australia); multilingual roadmap thereafter
- Profile: Professionals, learners, and growth-oriented individuals active on TikTok, LinkedIn, Instagram
- Daily behavior: opens the app to continue a book, saves fragments, shares quotes
- Revenue: monthly subscription or per-title token purchase

### Tier 2 — Authors, Publishers, and Companies
- Independent authors, publishing houses, content creators, corporate training teams
- Revenue to Noetia: hosting tiers + revenue share on reader purchases
- Their success = more catalog = more reader retention = more subscriptions
- Key need: frictionless upload, fast review, real-time analytics

> **Note on framing:** "Secondary" in earlier versions of this document was incorrect. Authors are not secondary — they are the content supply chain. Without them, there is no platform. They are called Tier 2 only because readers interact with Noetia daily while authors interact less frequently.

---

## Business Architecture

Noetia is a **marketplace**, not a content company.

```
Authors / Publishers / Companies
        ↓  upload content
    Noetia Platform
        ↓  delivers reading experience
    Readers (daily active users)
        ↓  pay subscriptions / per-title
    Revenue
        ↓  shared back
    Authors / Publishers / Companies
```

**Noetia's role:** curate and deliver. Noetia reviews uploaded content for quality, stores and serves it with DRM, and provides the reading + social sharing layer. Noetia does not write books.

**The free library's role in this architecture:** it fills the catalog gap during beta while the author pipeline is built. Once there are 50+ author titles, the free library becomes a secondary section — still valuable for user acquisition, but no longer the main content surface.

---

## MVP Scope

**Goal:** Validate the multimodal reading experience and social sharing behavior as a growth engine, while simultaneously onboarding the first cohort of authors.

**Beta phase priorities:**
1. Prove the reading + listening + fragment + share loop with real users using the free library.
2. Sign and onboard the first 10–20 authors/publishers.
3. Use the free library data to show authors real engagement metrics (reads, shares, fragments per book).

---

## Core Features

### 1. Authentication
- Google Sign-In
- Facebook Login
- Apple Sign-In (iOS)
- Email + Password
- Email confirmation on registration (24h token via SMTP; OAuth logins auto-confirmed)
- Password recovery via email reset link (1h token)

### 2. Content Catalog

#### Author Catalog (the business)
- Books uploaded by authors and publishers via the author portal
- Each book has a price set by the publisher (pay-per-title or credit redemption)
- Searchable, discoverable, featured on the Colección General home screen
- Author analytics: readers, shares, storage, revenue

#### Beta Catalog (acquisition / engagement)
- ~40 Spanish + ~31 English public-domain classics (Gutenberg, Wikisource, LibriVox)
- Free for all users — no subscription required
- Visible in "Colección General" as a secondary section ("Clásicos gratuitos")
- Not expanded after the first 6–12 months of operation
- UI positioning: yields to author content when author content exists in the same category

### 3. Synchronized Reading Engine ← Priority 1 feature
- Phrase-by-phrase synchronization between text and audio
- Visual highlight of active phrase
- Controls: Play/Pause, speed adjustment (0.75×–2×)
- Seamless switching: Reading ↔ Audio (background) ↔ Escucha Activa (hybrid)

#### Modo Escucha Activa (Core differentiator)
- Combines visible text with live audio — text auto-scrolls, active phrase highlighted in real-time
- Text selection disabled in this mode; exit to reading mode to create fragments
- FAB behavior in reading mode: tap opens audio panel with three start options:
  1. "Toca donde vas leyendo" — user taps exact phrase, audio seeks and plays
  2. "Continuar desde frase N" — resumes from last saved position
  3. "Desde el principio"
- Sync engine: phrase-level highlight driven by `phraseAt()` binary search on `startTime/endTime`
- Sync timestamps come from SRT/VTT files uploaded by authors, or Whisper-generated VTT files for public-domain books (`syncSource = 'whisper'`); books without a sync file are readable but have `startTime=0` throughout

### 4. Highlight & Fragment System
- Select text while reading to save as "fragments"
- Per-book Fragment Sheet per user: store, combine (non-consecutive), and edit
- Voice-triggered highlight (future)

### 5. Social Content Generator — Core Differentiator
- Transform fragments into branded visual quote cards
- Four platforms: LinkedIn, Instagram, Facebook, Pinterest
- Platform-specific formats (IG Post/Story/Reel, FB Post/Story, LI Post, Pinterest Pin/Square)
- Customization: font (7 options), background (solid/gradient/image), text color, bold/italic, citation
- Server-side PNG generation via Python/Pillow; served via MinIO presigned URLs

### 6. Sharing Engine
- Export as image (download)
- Copy link
- Direct social publish: connect LinkedIn, Facebook, Instagram, Pinterest via OAuth
- Attribution tracking (future)

### 7. Offline Mode
- Download books for offline reading/listening
- Store fragments offline
- Sync progress when back online

### 8. Subscription & Monetization

Noetia follows a hybrid model inspired by Audible.

#### Pay-per-Title
- Fixed price set by the publisher; permanently unlocks reading + listening

#### Monthly Subscription Plans

| Plan       | Monthly | Annual   | Tokens/month |
|------------|---------|----------|--------------|
| Individual | $8.99   | $83.99   | 1 token |
| Duo        | $13.99  | $129.99  | 2 tokens (shared pool, up to 2 users) |
| Family     | $18.99  | $179.99  | 3 tokens (shared pool, up to 6 users) |

#### Token Mechanics
- 1 token = 1 book of any list price (redeemed at checkout)
- Paid tokens expire 90 days after issuance; promo/courtesy tokens expire in 30 days
- FIFO redemption — oldest token consumed first
- Token packages for one-time purchase: 1 / 3 / 5 / 10 tokens
- Subscribers can also purchase titles at list price without spending a token

### 9. Author / Publisher Module ← Priority 2 feature
- Upload: text (.txt/.epub/.pdf), audio (MP3/M4A), cover image (.jpg/.png), sync file (SRT/VTT)
- Review workflow: submission → 3–5 day editorial review → publication
- Hosting tiers: 1 / 3 / 12 books (enforced via `hostingTier` on User)
- SRT/VTT sync upload: activates phrase-level highlighting in Modo Escucha Activa
  - Each cue in the SRT = one phrase of the book; `syncSource` field tracks origin (`auto`/`srt`/`vtt`/`whisper`)
  - Can be uploaded at any time, even post-publication
- Analytics: readers, shares, storage per book
- Revenue sharing model (implementation in Phase 2)
- Upload guide: `/upload-guide` — step-by-step instructions for file preparation, tool recommendations (Subtitle Edit, Descript), FAQ

### 10. Book Collections
- Books can belong to a named `collection` (e.g. "Biblia Reina-Valera", "Don Quijote de la Mancha")
- Displayed as collapsible collection cards in Mi Biblioteca
- Shown as a horizontal scrollable row in Colección General

---

## Security & DRM

- JWT-authenticated access to all book content (text, audio, sync maps)
- SubscriptionGuard enforces entitlement on every content endpoint
- Presigned MinIO URLs with 15-minute TTL for text and audio
- No raw file downloads available to users
- Controlled sharing: fragments (text excerpts) only — no full-text export

---

## Engineering Quality

Every backend service must meet:
- Unit test coverage ≥ 80% per service (CI gate on every PR)
- No real I/O in unit tests — all external dependencies mocked
- End-to-end tests (Playwright) covering: sign-up → read, highlight → share, subscribe → unlock

See [CLAUDE.md — Testing](../CLAUDE.md#testing) for naming conventions and run commands.

---

## Key Metrics (KPIs)

### Reader Health
- Daily Active Readers (the north star)
- Session length (time spent reading/listening per session)
- 7-day and 30-day retention
- Trial → Paid conversion rate
- Fragments created per user
- Shares per user

### Author Health
- Books submitted per month
- Time from submission to publication
- Reads per author book
- Shares per author book
- Author retention (authors who upload a second title)

### Platform Health
- Catalog size (author titles)
- Subscription revenue (MRR)
- Viral coefficient (shares that convert to sign-ups)

---

## Risks

| Area | Risk | Mitigation |
|------|------|------------|
| Content supply | Author catalog grows too slowly; free library dominates too long | Prioritize author onboarding; set hard deadline to shift hero placement |
| Market | Competition from Kindle/Audible, Spotify, Apple Books | Focus on phrase-sync differentiator + social layer; language-agnostic architecture serves Spanish and English |
| Technical | Phrase-level sync quality for author-uploaded content | SRT tooling + editorial review checklist includes sync validation |
| Business | Low author upload rate; content quality below expectations | Clear upload guide, fast review turnaround, dedicated autores@noetia.app inbox |
| Engagement | Readers use free library but don't convert to paid | Gate Modo Escucha Activa and Fragment Sharing on subscription after beta |

---

## Growth Strategy

### Phase 1 — Beta (May–Aug 2026, current)
- Spanish public-domain library as the engagement hook for first users
- English public-domain catalog ingestion running in parallel
- Simultaneously: onboard first 5–10 authors via invite codes
- Prove the read → fragment → share loop drives organic referrals
- Collect data: which book categories convert best to subscriptions

### Phase 2 — Growth (Sep 2026–Feb 2027)
- App Store + Google Play launch
- English public-domain catalog live alongside app stores
- Author content replaces free library as the primary hero
- Free library demoted to a secondary "Clásicos gratuitos" section
- Gate advanced features (Modo Escucha Activa, direct social publishing) behind subscription
- Revenue share activated for authors; 25+ authors, 75+ paid titles

### Phase 3 — Scale (Mar 2027+)
- Publisher partnerships (Penguin Random House Latam, Planeta, FCE, etc.)
- Institutional deals (corporate training, universities)
- Portuguese-language market entry (Brazil)
- AI-generated sync for author books that don't have audio files

---

## Roadmap

| Phase | Name | Focus |
|-------|------|-------|
| 0 | Planning | PRD, legal review, design system |
| 1 | Build | Auth, reader engine, library |
| 2 | Social Layer | Fragments, image gen, sharing |
| 3 | Beta Launch | Spanish + English free library; first author onboarding |
| 4 | Growth | App Store launch; author catalog as hero; English audience |
| 5 | Scale | Publisher partnerships; Portuguese market; AI sync |

---

## Future Enhancements

- AI-generated voice narration for author books without audio
- AI-generated sync timestamps (eliminate SRT requirement for authors)
- Smart book recommendations
- Community features: follow users, like fragments, social feed
- Author monetization dashboard with payout tracking
- Institutional licensing (bulk seats for companies and universities)
