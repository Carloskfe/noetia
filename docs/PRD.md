# Noetia — Product Requirements Document

> Read. Listen. Capture. Share.

Noetia is a multimodal reading platform that synchronizes text and audio at a phrase-by-phrase level, allowing users to seamlessly switch between reading and listening. It transforms reading into social expression by letting users extract highlights ("fragments") and convert them into shareable, branded visual content.

---

## Table of Contents

1. [Vision](#vision)
2. [Target Users](#target-users)
3. [MVP Scope](#mvp-scope)
4. [Core Features](#core-features)
5. [Security & DRM](#security--drm)
6. [Engineering Quality](#engineering-quality)
7. [Key Metrics (KPIs)](#key-metrics-kpis)
8. [Risks](#risks)
9. [Growth Strategy](#growth-strategy)
10. [Roadmap](#roadmap)
11. [Future Enhancements](#future-enhancements)

---

## Vision

To become the leading platform where knowledge is not only consumed but expressed — turning reading into a social identity behavior.

**Core value proposition:**
- Synchronized Reading + Listening
- Frictionless Knowledge Capture
- Instant Social Content Creation

---

## Target Users

### Primary — "Insight Creators"
- Age: 30–70
- Geography: Spanish-speaking users (Latin America, US Hispanic market, Spain)
- Profile: Professionals, learners, and growth-oriented individuals active on LinkedIn, Instagram, etc.

### Secondary — Authors & Publishers
- Independent authors, publishing houses, content creators seeking distribution and visibility

---

## MVP Scope

**Goal:** Validate the multimodal reading experience and social sharing behavior as a growth engine.

---

## Core Features

### 1. Authentication
- Google Sign-In
- Facebook Login
- Apple Sign-In (iOS)
- Email + Password

### 2. Content Library
- Initial catalog: 12 Spanish-language books
- Categories: Leadership, Personal Development, Business
- Only titles with existing audio + text

### 3. Synchronized Reading Engine
- Phrase-by-phrase synchronization between text and audio
- Visual highlight of active phrase
- Controls: Play/Pause, speed adjustment
- Seamless switching: Reading ↔ Listening ↔ Hybrid

#### Hybrid Reading Mode
- Combines visible text with live audio playback
- Active phrase is highlighted in real-time as audio plays
- Text selection is **disabled** in this mode — user must exit to create fragments
- Clear mode indicator in the top bar with a single-tap exit action
- Designed for immersive listen-while-reading without accidental selection

### 4. Highlight & Fragment System
- Select text while reading to save as "fragments"
- Voice-triggered highlight (future)
- Per-book Fragment Sheet per user:
  - Store, combine (non-consecutive), and edit fragments

### 5. Social Content Generator _(Core Differentiator)_
- Transform fragments into shareable visual quote cards
- Platform-specific formats: LinkedIn, Instagram, Facebook, WhatsApp, TikTok (future), Snapchat
- Each card includes: quote text, author name, book title, Noetia watermark
- Template-based design (MVP); server-side rendering

### 6. Sharing Engine
- One-click sharing
- Export as image
- Deep links (future)
- Attribution tracking (future)

### 7. Offline Mode
- Download books for offline reading/listening
- Store fragments offline
- Sync progress when back online

### 8. Subscription & Monetization Model

Noetia follows a hybrid model inspired by Audible: users can purchase titles individually or subscribe monthly to receive credits that permanently unlock books.

#### Pay-per-Title
- Every book has a fixed price set by the publisher
- One-time purchase — permanently unlocks reading + listening for that title

#### Monthly Subscription Plans

| Plan         | Monthly | Annual | Credits/month | Max books unlocked/month |
|--------------|---------|--------|---------------|--------------------------|
| Individual   | $9.99   | $89    | 1 credit      | 1 book                   |
| Reader       | $14.99  | $135   | 2 credits     | 2 books                  |

#### Credit Mechanics
- 1 credit = 1 book of any list price (like Audible's credit system)
- Credits are issued at the start of each billing cycle
- Credits expire at end of billing cycle and do not roll over (MVP)
- Redeeming a credit permanently unlocks the title in the user's library
- Subscribers can also buy additional titles at list price without using a credit

- Free trial: 14 days

### 9. Author / Publisher Module
- Upload books (text + audio + metadata)
- Hosting tiers: 1 book / 3 books / 12 books
- Revenue sharing model
- Basic analytics: downloads, reads, shares, storage
- Cloud storage for books, audio files, and generated images

---

## Security & DRM

- Encrypted content streaming
- Limited offline access
- No raw file downloads
- Controlled sharing (fragments only)

---

## Engineering Quality

Every backend service shipped as part of Noetia must meet the following non-negotiable quality gates before it is considered production-ready:

- **Unit test coverage ≥ 80%** per service, verified by CI on every pull request.
- **No real I/O in unit tests** — all external dependencies (database, MinIO, Stripe, Meilisearch, image-gen HTTP) must be mocked.
- **Test-driven Definition of Done** — a feature is not complete until its service tests pass and coverage is above threshold.
- **End-to-end tests** (Playwright) cover the three critical user flows: sign-up → read, highlight → share, subscribe → unlock.

These standards directly reduce the risks identified in the [Risks](#risks) section and protect the phrase-level sync engine and DRM implementation — the two highest-complexity areas — from regressions during rapid iteration.

For implementation details (file structure, naming conventions, run commands per service) see [CLAUDE.md — Testing](../CLAUDE.md#testing).

---

## Key Metrics (KPIs)

### User
- Sign-up conversion rate
- Trial → Paid conversion
- Retention: 7-day, 30-day

### Engagement
- Highlights per user
- Fragments created
- Time spent reading/listening

### Growth
- Shares per user
- Referral installs
- Viral coefficient

### Content
- Completion rate per book
- Most shared fragments
- Most popular titles

---

## Risks

| Area      | Risk                                                  | Mitigation                                        |
|-----------|-------------------------------------------------------|---------------------------------------------------|
| Market    | Competition from Kindle/Audible, Spotify, Apple Books | Focus on social-sharing differentiator            |
| Technical | Complexity of phrase-level sync; mobile performance   | Mandatory unit tests (≥ 80% coverage) + CI gate   |
| Business  | Content licensing costs; user acquisition cost        | Author partnership model; referral program        |

---

## Growth Strategy

### Phase 1 — MVP Launch
- Target Spanish-speaking communities
- Direct author partnerships
- Referral program

### Phase 2
- Influencer collaborations
- Social content virality
- Expand catalog

### Phase 3
- English market
- Publisher partnerships
- Institutional deals

---

## Roadmap

| Phase | Name         | Focus                                                       | Services                                 |
|-------|--------------|-------------------------------------------------------------|------------------------------------------|
| 0     | Planning     | Finalize PRD, legal review, design system                   | —                                        |
| 1     | Build        | Auth, reader engine, library                                | `api`, `db`, `web`, `proxy`, `storage`   |
| 2     | Social Layer | Fragments, image generation, sharing                        | `image-gen`, `worker`, `cache`, `search` |
| 3     | Launch       | Beta release, feedback loop, optimization                   | All services                             |
| 4     | Scale        | English market, publisher partnerships, institutional deals | Kubernetes, S3, CDN                      |

---

## Future Enhancements

- AI-generated voice narration
- AI-generated visual styles for quote cards
- Smart book recommendations
- Community features: follow users, like fragments
- In-app social feed
- Author monetization tools
