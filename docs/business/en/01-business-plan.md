# Noetia — Business Plan
**Version 1.1 | May 2026**

---

## Executive Summary

Noetia is a multimodal reading platform that synchronizes text and audio phrase by phrase, enabling readers to read and listen at the same time. Its language-agnostic architecture launches with Spanish as the primary market and expands to English in Year 2, with additional languages to follow — targeting a combined base of over 2 billion native speakers across Spanish and English.

Noetia combines the immersive depth of a reader app with the habit-forming mechanics of social learning platforms — allowing users to save fragments, generate visual quote cards, share to social networks, and read together in real-time clubs.

Noetia launched its beta in May 2026 following 12 months of development by a 4-person team. The platform is live at **https://noetia.app**, runs on production infrastructure, and is preparing for App Store and Google Play submission.

**Business model:** Subscription (Individual $8.99/mo · Duo $13.99/mo · Family $18.99/mo) plus per-title token purchases and social giving (2.22% of every payment supports partner social causes).

**Target market:** Spanish-speaking audiences at launch (500M+ native speakers; 30M+ paying digital readers in Latin America and Spain); English-speaking markets from Year 2; multilingual expansion thereafter.

**12-month revenue target (post-launch Year 1):** $165,000 total revenue, reaching 2,000 paying subscribers by May 2027.

---

## The Problem

Deep, immersive reading is broken across languages. Spanish is the second most spoken native language in the world, yet the dominant reading platforms (Audible, Blinkist, Storytel) were built for English-first audiences and offer thin Spanish catalogs with poor cultural fit. English-language platforms face the inverse problem: enormous catalogs but fragmented, passive consumption experiences.

Readers who want to engage deeply with books in any language face three compounding problems:

1. **Fragmented consumption** — text and audio exist on separate apps, breaking focus and continuity.
2. **Passive reading** — existing platforms don't help readers retain or share what they learn.
3. **Social isolation** — reading is treated as a solitary activity with no community or accountability layer.

---

## The Solution

Noetia solves all three — in any language:

| Problem | Noetia Solution |
|---------|----------------|
| Fragmented text + audio | Phrase-by-phrase synchronization — audio and text move together, phrase highlighted in real time |
| Passive reading | Fragment capture → visual quote cards → share to LinkedIn, Instagram, Facebook, Pinterest |
| Reading in isolation | Noetia Clubs — phrase-anchored discussion threads, live listening sessions (Escucha Juntos), book polls |

Additional differentiators:
- **Reading statistics** — 7-day activity chart, streak counter, weekly goals — habit loops proven by Duolingo's engagement model
- **Privacy controls** — granular settings for what is shared in clubs
- **Causes Noetia** — 2.22% of every payment routes to vetted social causes (Medio Ambiente, Educación, Salud), turning every subscription into a social contribution

---

## Product Overview

### Core Features (shipped)

**Reader**
- Phrase-synchronized text + audio (read mode, audio mode, active listening mode)
- Offline book download and sync
- Font size, dark mode, chapter navigation
- Reading progress saved and restored across devices

**Fragments & Sharing**
- Long-press phrase selection to save fragments
- Quote card image generation (4 platforms × multiple formats and sizes)
- Direct publish to LinkedIn, Facebook, Instagram, Pinterest via OAuth
- Deep link sharing

**Library & Discovery**
- 38+ curated free public-domain titles (Spanish) at launch; English public-domain catalog in active development
- Author-uploaded paid titles (token gated)
- Collection grouping, search (Meilisearch full-text)

**Noetia Clubs**
- Public / private / author-event club types
- Phrase-anchored discussion threads
- General club chat
- Book nomination polls
- Escucha Juntos — scheduled live listening sessions
- Member roles (admin / moderator / member), ban mechanics

**Monetization**
- 3 subscription tiers (Individual / Duo / Family) with monthly and annual billing
- Token system (1 token = 1 paid book) — 90-day expiry, FIFO redemption
- Token packages (1, 3, 5, 10 tokens) purchased à la carte
- Gift cards with personal message and occasion
- Causes Noetia — 2.22% social giving on every payment

**Platforms**
- Web (Next.js — desktop + mobile browser)
- iOS (React Native via Expo)
- Android (React Native via Expo)

**Languages**
- Full UI localization: Spanish (launch) + English (active)
- Content catalog: Spanish (launch) → English (Year 2) → multilingual roadmap

---

## Market Analysis

> Full source citations, methodology notes, and confidence ratings for every number in this section are in the **Market Intelligence Appendix** (document 05).

### Total Addressable Market (TAM)

The global audiobook market was valued at **$8.70 billion in 2024** and is projected to reach **$35.47 billion by 2030**, growing at a CAGR of 26.2% (Grand View Research, "Audiobook Market Size, Share & Trends Analysis Report," 2024 — scope: global, all formats and distribution channels).

Noetia's phrase-sync + social layer addresses the broader digital reading market, not just audiobooks. The combined global market for ebooks, audiobooks, and reading subscription platforms exceeds $20 billion in 2024.

Spanish and English together represent the two largest native-speaker populations globally (500M + 1.5B), making Noetia's dual-language strategy directly aligned with the highest-volume market segments.

### Serviceable Addressable Market (SAM)

**Spanish-speaking markets (Year 1):**
- Latin America's mobile internet audience reached **413 million users in 2024** (GSMA, "The Mobile Economy: Latin America 2024"), of whom an estimated 130M regularly engage with digital long-form content
- The paid digital reading segment (users paying for books, subscriptions, or audiobooks) in Latin America is estimated at **8–12M users**, growing at ~18% annually (composite estimate — full methodology in Market Intelligence Appendix)
- Spanish-language audiobook catalog: 22,000+ titles as of 2024, growing rapidly (Bookwire, Spanish Market Report 2024)

**English-speaking markets (Year 2):**
- The US alone has 47M+ audiobook listeners (Audio Publishers Association, 2024)
- English-language digital reading subscription market is the most developed globally, with proven willingness to pay

**Combined SAM for Year 1–3 planning:** Spanish-speaking digital readers + English-speaking digital readers in target geographies.

### Serviceable Obtainable Market (SOM)

**Year 1 target:** 2,000 paying subscribers (Spanish-first; English onboarding begins Q3 2026)
**Year 3 target:** 15,000 paying subscribers (blended Spanish + English)

These targets assume organic content marketing, author partnerships, and social sharing virality as primary acquisition channels. Full acquisition model in the Financial Projections section.

### Market Trends

- Spanish-language audiobooks grew **45.7% in 2023** (Bookwire, Spanish Market Report 2024 — based on platform sales data across major Spanish-language publishers and distributors; Latin America regional growth: +9%, Mexico: +12%)
- Social reading (book clubs, discussion apps) is the fastest-growing book discovery channel globally
- Short-form video (TikTok/Instagram Reels) is the primary book discovery platform for under-35 audiences — Noetia's visual quote card sharing plugs directly into this behavior (the "BookTok" phenomenon drove 825M book-related TikTok views in 2023 — Publishers Weekly)
- US Hispanic audiobook consumption is accelerating: the US is the region with the fastest growth in Spanish-language audiobook consumption (Bookwire, 2024), making the US Hispanic market a high-value near-term target

---

## Competitive Landscape

| Competitor | Strengths | Weaknesses vs. Noetia |
|-----------|-----------|----------------------|
| Audible (Amazon) | Huge catalog, global brand | No text sync, no social layer, weak Spanish catalog, no community |
| Storytel | Growing Spanish catalog, subscription model | No phrase sync, no sharing, limited Spanish content |
| Blinkist | Summary-focused, strong UX | Summaries only (no full books), English-first |
| 12min | Spanish-language summaries | Summaries only, no audio sync, no community |
| Kindle | Best-in-class e-reader | No audio sync, weak social features, separate from Audible |
| Scribd | Large catalog, subscription model | No phrase sync, no social sharing, no clubs |
| Wattpad | Strong community | Fiction-only, user-generated, no curated catalog |

**Noetia's defensible differentiators:**
1. Phrase-by-phrase audio-text sync (technical moat — significant implementation complexity; competitors lack this for full books)
2. Language-agnostic architecture with cultural product design per market
3. Social causes integration (emotional stickiness — readers feel their subscription matters)
4. Visual quote card generation for social sharing (virality engine that drives organic acquisition)

---

## Business Model

### Revenue Streams

**1. Subscriptions (recurring MRR)**
| Plan | Monthly | Annual | Users |
|------|---------|--------|-------|
| Individual | $8.99 | $89.99 | 1 user, 1 token/cycle |
| Duo | $13.99 | $139.99 | 2 users, shared pool |
| Family | $18.99 | $189.99 | 5 users, shared pool |

**2. Token Packages (one-time)**
| Package | Price | Per Token |
|---------|-------|-----------|
| 1 token | $3.99 | $3.99 |
| 3 tokens | $9.99 | $3.33 |
| 5 tokens | $14.99 | $3.00 |
| 10 tokens | $29.99 | $3.00 |

**3. Gift Cards** — token gifts with personal message (1 or 3 tokens), sent by email

**4. Author Hosting Fees** — future revenue from hosting-tier upgrades (Basic: 1 book, Starter: 3 books, Pro: 12 books)

### Revenue Distribution Per Payment
- **45%** → Noetia operating revenue
- **36%** → Author / narrator royalties
- **9%** → Narrator fee (when separate from author)
- **2.22%** → Causas Noetia (social giving)
- **7.78%** → Marketing fund

### Unit Economics (Individual Plan, monthly)
- ARPU: $8.99
- Estimated churn: 5%/month (industry avg for niche reading apps: 4–7%)
- LTV (at 5% churn = 20-month avg tenure): **$179.80**
- Customer Acquisition Cost (Year 1, organic-first): **estimated $15–25**
- LTV:CAC ratio: **7:1 – 12:1**

---

## Content & Licensing Strategy

### 1. Public Domain Catalog (Current — 38+ titles)

**License type:** Public domain / Creative Commons Zero

| Source | Content Type | License | Royalty Cost |
|--------|-------------|---------|--------------|
| Project Gutenberg | Text files | Public domain | $0 |
| LibriVox | Audio narrations | CC0 (public domain dedication) | $0 |
| Spanish Wikisource | Spanish text files | Public domain | $0 |

**Rights position:** No licensing costs or contractual obligations. Noetia verifies each title's public domain status by confirming publication date and jurisdictional copyright expiration before ingestion.

**Expansion:** English public-domain catalog is in active development using the same Gutenberg + LibriVox pipeline. Target: 40+ English titles by Q3 2026 alongside App Store launch.

---

### 2. Author-Direct Model (Active — growing)

**License type:** Non-exclusive distribution license

Authors apply via invite codes and upload through the Noetia dashboard. Two content models exist:

| Model | Author Provides | Audio Origin | Royalty |
|-------|----------------|--------------|---------|
| Full submission | Text + narrated audio | Author-owned master recording | 45% (author = narrator) |
| Text-only | Text file only | TBD: author-produced or future Noetia production | 36% author + 9% narrator |

**Key license terms (formalized in Author Agreement):**
- Non-exclusive: authors retain all rights and may distribute through other platforms simultaneously
- Authors self-certify ownership of all uploaded content
- License term: rolling 12-month with auto-renewal; 30-day written notice to withdraw a title
- Territory: worldwide by default; authors may restrict to specific regions upon request
- Payment cycle: monthly, within 15 business days of month-end; minimum payout threshold $25

**Due diligence at current scale:** Authors self-certify rights at upload. Noetia removes content upon DMCA complaint or rights dispute. Editorial pre-review will be added at 50+ active authors.

---

### 3. Publisher Pipeline (Active outreach — no agreements signed as of May 2026)

**Target:** Independent and mid-size Spanish-language publishers in Mexico, Colombia, Argentina, and Spain. English-language independent publishers from Year 2.

**Proposed deal structure:**
- Non-exclusive per-title or catalog license
- Revenue split: 50% to publisher (inclusive of author share), 50% to Noetia
- Minimum catalog commitment: 5 titles per publisher for initial agreement
- Publishers must confirm ownership of both text rights AND audiobook/digital rights before listing

**Current status:** Market introduction phase. First formal publisher discussions targeted for Q4 2026 (post beta traction).

**Priority targets:**
- Penguin Random House Grupo Editorial (Spain / Latin America division)
- Fondo de Cultura Económica (Mexico)
- Planeta Libros (Spanish-language catalog)
- Independent publishers with 50+ title backlists

**Recommended next step:** Engage an IP/publishing rights attorney familiar with Spanish-language markets to draft the standard Publisher License Agreement. Estimated cost: $3,000–$8,000.

---

### 4. Audiobook Rights Ownership

| Catalog Type | Text Rights | Audio Rights | Noetia's Position |
|-------------|------------|--------------|-------------------|
| Public domain | Public domain | CC0 (LibriVox) | Distribution only; no IP ownership |
| Author-direct (full submission) | Author-owned | Author-owned master | Non-exclusive distribution license |
| Author-direct (text-only) | Author-owned | TBD (author or Noetia production) | Distribution + potential production IP |
| Publisher-licensed | Publisher-owned | Publisher-owned | Non-exclusive distribution license |

**Phrase-sync maps** (Whisper alignment data generated by Noetia) are Noetia proprietary data and are not part of the underlying work's copyright. This data represents a proprietary technical asset.

---

### 5. DRM and Copy Protection

**Current approach: Soft DRM (account binding)**

Noetia does not implement full DRM systems (Widevine, FairPlay). Instead:
- Content is encrypted at rest (MinIO server-side encryption, AES-256)
- Streaming and download URLs are presigned with short expiration windows (streaming: 5-min TTL; download: 1-hour TTL)
- Downloaded files are account-bound; not device-transferable
- Offline access is enforced at the API authentication layer

**Rationale:** Full DRM (Widevine/FairPlay) requires platform certification, significant engineering overhead, and is primarily demanded by major publishers. At current catalog scale (public domain + author-direct), soft DRM is contractually sufficient and is disclosed to authors upfront.

**Roadmap:** Full DRM capability will be evaluated before signing any major publisher agreement that requires it (estimated Year 2–3).

---

### 6. Territorial Rights

**Current model:** No territorial restrictions
- Public domain catalog: globally distributable with no restrictions
- Author-direct licenses: worldwide by default (authors may opt to restrict)

**Forward-looking:**
- Publisher deals will require per-territory negotiation; Latin America + Spain is the expected default scope
- US Hispanic market rights will be negotiated as a distinct territory in publisher term sheets
- English-language expansion requires separate territorial rights framework (Year 2)

---

## Go-to-Market Strategy

### Phase 1 — Beta Launch (May–Aug 2026)
- 500 beta users via waitlist (already collecting)
- Invite-only with upload codes for early authors
- Focus: product-market fit validation, churn analysis, NPS
- Channels: founder's network, LinkedIn content, author outreach
- Language: Spanish primary; English UI and onboarding available

### Phase 2 — Growth (Sep 2026–Feb 2027)
- App Store and Google Play launch
- English public-domain catalog launch alongside app stores
- TikTok/Instagram content strategy: "best quotes from [book]" using Noetia share cards (virality loop)
- Author partnership program: 10 Spanish-language + 5 English-language authors with existing audiences
- Book club partnerships: university literary circles, reading communities on WhatsApp/Discord
- Referral program: invite 3 friends → 1 free token

### Phase 3 — Scale (Mar 2027+)
- Publisher catalog deals (Spanish + English)
- Podcast/newsletter sponsorships targeting productivity and self-development audiences
- B2B: corporate wellness programs (reading as a benefit), university licensing
- Portuguese-language market entry (Brazil)

---

## Team

The founding team combines product vision with technical execution across the full stack.

| Role | Responsibilities |
|------|-----------------|
| **Product Manager** | Roadmap, sprint planning, stakeholder management, user research, KPIs, go-to-market |
| **Backend Developer** | NestJS API, PostgreSQL schema, Stripe, auth, subscriptions, clubs, migrations |
| **Frontend Developer** | Next.js web app, React Native mobile (iOS + Android), i18n, UI components |
| **DevOps Engineer** | Docker infrastructure, Traefik, GitHub Actions CI/CD, Grafana monitoring, backups, server security |

12 months of development. 55 database migrations. Zero external contractors. Full ownership of the technology stack.

---

## Financial Projections

### Base Assumptions
- Beta launch: May 2026
- App Store + English catalog launch: Q3 2026
- Average plan mix: 70% Individual, 20% Duo, 10% Family → blended ARPU ≈ $10.20/mo
- Monthly churn: 5% (conservative; declining as product matures and clubs deepen engagement)
- Token purchase attach rate: 15% of subscribers buy at least 1 token package per year
- Year 1 revenue is primarily Spanish-market driven; English subscribers begin contributing from Q4 2026

### Growth Acquisition Model

#### User Acquisition Funnel

**Stage 1 — Awareness (top of funnel)**
- Founder LinkedIn content (Spanish and English reading/productivity topics)
- Author-generated content: authors promote their Noetia titles to existing audiences
- Viral loop: Noetia share cards posted to TikTok/Instagram/Pinterest by readers
- University literary circles, WhatsApp reading communities, Discord book clubs

**Stage 2 — Acquisition**
- Waitlist landing page → invite code → free account creation
- App Store / Google Play organic discovery (Q3 2026+)
- Referral program: invite 3 friends → earn 1 free token (~$3.99 cost per referral)

**Stage 3 — Activation**
- Free public-domain library immediately accessible — no paywall for first reading experience
- Reading streak initialized at first session; club discovery shown at end of session 1
- Target: 60%+ of new users complete their first reading session within 48 hours of signup

**Stage 4 — Conversion (Free → Paid)**
Primary conversion triggers:
- Wanting a paid (token-gated) title from the author catalog
- Joining a club that reads a paid book
- End of a free title — prompt to explore paid author catalog

Target conversion rate: 12–18% of active free users convert within 90 days of signup.

**Stage 5 — Retention and Expansion**
- Reading streaks and weekly goals create habit-loop retention (loss aversion on streak breaks)
- Club membership creates social accountability (significant churn deterrent)
- Annual plan upgrade: 16–17% savings vs. monthly — offered at month 3 with in-app prompt

#### Customer Acquisition Cost (CAC) by Channel

| Channel | Estimated CAC | Notes |
|---------|--------------|-------|
| Organic / founder content | ~$5 | Time cost only; no media spend |
| Author referral (author audiences) | ~$8–12 | Co-marketing with authors who promote Noetia to their following |
| Referral program (3 friends → 1 token) | ~$12–18 | Token cost ($3.99) amortized over 3 referred users |
| Paid social (Phase 2, Sep 2026+) | ~$25–40 | Meta/TikTok ads targeting Spanish/English readers |
| **Blended CAC (Year 1, organic-first)** | **~$15–25** | Weighted heavily toward organic channels |

#### Subscriber Growth Model

| Period | Gross Adds/Mo | Churn (5%) | Net New | Cumulative |
|--------|--------------|-----------|---------|-----------|
| May–Jul 2026 (beta) | ~80 | ~5 | ~75 | 200 |
| Aug–Oct 2026 (App Store launch) | ~150 | ~15 | ~135 | 550 |
| Nov 2026–Jan 2027 | ~250 | ~30 | ~220 | 1,100 |
| Feb–Apr 2027 | ~350 | ~55 | ~295 | 1,700 |
| May 2027 | ~400 | ~80 | ~320 | 2,000+ |

#### Retention Assumptions

| Cohort Age | Expected Monthly Retention |
|------------|--------------------------|
| Month 1–3 | 90–95% (novelty + onboarding habits forming) |
| Month 4–12 | 95% (5% churn; clubs and streaks active) |
| Month 13+ | 96% (4% churn; deep habit formation) |

Primary churn drivers: (1) catalog gaps — user exhausts content they want; (2) price sensitivity at month 3 for non-annual upgraders; (3) life events unrelated to the product.

#### Author Acquisition Model

Authors are the content supply chain. Year 1 prioritizes quality over quantity.

| Period | Target Authors | Active Paid Titles | Acquisition Channel |
|--------|--------------|-------------------|-------------------|
| May–Aug 2026 (beta) | 5–10 | 10–20 | Founder personal network |
| Sep–Dec 2026 | 25 | 40–60 | Author referral + direct outreach |
| May 2027 (Year 1 end) | 50 | 75+ | Author referral program + publisher pipeline |
| May 2028 (Year 2 end) | 150 | 250+ | Publisher deals + English author outreach |

**Author selection criteria (Year 1):** Existing Spanish or English-language audience (1,000+ followers on any platform); nonfiction, self-development, or literary fiction category; willing to promote their Noetia page to their own audience.

**Author incentive structure:**
- 45% royalty — highest in the category (Audible offers 25–40%)
- Free Starter hosting tier for first 12 months
- Co-marketing: Noetia features author in social content and author program newsletter
- Real-time author dashboard: earnings, reader engagement, fragment analytics

### Revenue Projections

| Period | Subscribers | MRR | ARR |
|--------|------------|-----|-----|
| Aug 2026 (3mo post-launch) | 200 | $2,040 | $24,480 |
| Nov 2026 (6mo) | 600 | $6,120 | $73,440 |
| Feb 2027 (9mo) | 1,200 | $12,240 | $146,880 |
| May 2027 (12mo) | 2,000 | $20,400 | $244,800 |
| May 2028 (24mo) | 6,000 | $61,200 | $734,400 |
| May 2029 (36mo) | 15,000 | $153,000 | $1,836,000 |

*Token package revenue and author hosting fees add ~12% on top of subscription ARR from Year 2.*

### Cost Structure (current)
| Item | Monthly Cost |
|------|-------------|
| Contabo VPS (8 vCPU, 24 GB RAM, 400 GB SSD) | ~$25 |
| Resend (email, free tier) | $0 |
| Expo EAS Build | $0–$29 |
| Stripe fees (~2.9% + $0.30) | Variable |
| Domain / DNS (Cloudflare) | ~$12/yr |
| **Total fixed infrastructure** | **< $50/mo** |

Infrastructure cost is negligible at current scale. The primary cost to scale is human capital (customer support, content licensing, marketing) and publisher deal legal fees.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Slow author catalog growth | High | High | 38+ free public-domain titles provide full beta experience; English catalog in parallel |
| App store rejection | Medium | Medium | Privacy policy live, permissions declared, no objectionable content |
| Publisher rights disputes | Medium | Medium | Author self-certification + DMCA takedown process; IP attorney retained before publisher deals |
| Stripe disputes / chargebacks | Low | Medium | No refund policy on tokens (declared at checkout); strong auth |
| Server outage | Low | High | Daily PostgreSQL backups, MinIO backups, Grafana alerts, 99.9% uptime history |
| Competitor copies phrase-sync | Medium | Medium | Technical moat is deep; cultural + community layer is harder to replicate |
| Churn higher than projected | Medium | High | Reading streak gamification, clubs, weekly goals, and annual plan incentive fight churn |
| English market entry too early | Low | Medium | English public-domain catalog has zero licensing cost; risk is engineering time only |

---

*Noetia — Read. Listen. Capture. Share.*
*https://noetia.app | noreply@noetia.app*
